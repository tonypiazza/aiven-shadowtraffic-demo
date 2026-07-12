# Aiven Provisioning Runbook (rev. 3 — OpenSearch + GitHub events)

Two supported deployment tracks:
- **Track A — Aiven Console** (click-through UI).
- **Track B — Aiven MCP via Claude** (natural-language tool calls).

> There is **no `avn` CLI command to deploy an Aiven Apps application**. `avn` can
> create the data services + connector, but the app deploys only via Console or MCP.

## Services (four; watchdog deletes all, app last)

| # | Service | Plan | Notes |
|---|---------|------|-------|
| 1 | Kafka | **business-4+** | Topic `github-events` (3 partitions) |
| 2 | Kafka Connect | **dedicated, startup-4+** | Runs the OpenSearch sink connector |
| 3 | OpenSearch | **business-4+** | Sink + OpenSearch Dashboards |
| 4 | App (this repo) | startup-50-1024+ | Single image, port 8080 |

Plan rationale: Kafka + OpenSearch at business tier so they aren't the bottleneck;
Connect dedicated so a throughput surge can't destabilize the brokers. (A live
spike showed startup Connect is not easily saturated — do not undersize Kafka/OS
expecting Connect to be the limit.)

## Prerequisites
- Aiven Apps access (Limited Availability) + a connected GitHub account (repo pushed).
- A ShadowTraffic license (six `LICENSE_*` values).
- An Aiven API token (watchdog teardown).

## App configuration (env vars)

| Variable | Secret? | Source |
|----------|---------|--------|
| `KAFKA_BOOTSTRAP_SERVER`, `KAFKA_CA_CERT`, `KAFKA_ACCESS_CERT`, `KAFKA_ACCESS_KEY` | yes | Auto-injected by the Kafka integration (PEM) |
| `OPENSEARCH_URL` | yes | OpenSearch DB connection URI (https://user:pass@host:PORT, port ~13xxx) |
| `OPENSEARCH_DASHBOARDS_URL` | yes | **Separate** OSD endpoint (`connection_info.opensearch_dashboards_uri`, port 443) — the `/osd` proxy targets THIS, not the DB URL |
| `OPENSEARCH_USER`, `OPENSEARCH_PASSWORD` | pw secret | OpenSearch creds (for the OSD proxy Basic auth) |
| `OSD_DASHBOARD_ID` | no | The imported OpenSearch Dashboards dashboard id |
| `LICENSE_*` (six) | yes | ShadowTraffic license |
| `AIVEN_TOKEN` | yes | Aiven API token |
| `AIVEN_PROJECT` | no | Aiven project name |
| `AIVEN_SERVICES` | no | `"<kafka>,<kafka-connect>,<opensearch>,<app>"` — **app LAST** |

### ⚠️ Watchdog deletion order
The watchdog runs inside the app container and deletes `AIVEN_SERVICES` **in order**.
List the **app last** so the data services are torn down before the app deletes itself.

---

## Track A — Aiven Console

1. **Kafka:** Create service → Apache Kafka → business-4. Enable **Kafka REST**
   (optional). Topics → create `github-events` with **3 partitions**.
2. **Kafka Connect:** Create service → Apache Kafka Connect → startup-4. Then on the
   Kafka service: **Connectors → Integrate standalone service** → select the Connect
   service → Enable. (This is the dedicated-Connect integration.)
3. **OpenSearch:** Create service → OpenSearch → business-4.
4. **OpenSearch index mapping (BEFORE the sink):** apply the index template and
   pre-create the `github-events` index so `created_at` maps as `date` (not `long`,
   which breaks the dashboard's time features). See `deploy/README-osd-dashboard.md` §1
   (`deploy/opensearch-index-template.json`).
5. **Sink connector:** On the Kafka (or Connect) service → **Connectors → Create
   connector → OpenSearch sink**. Paste `deploy/opensearch-sink-connector.json` with
   `connection.*` filled from the OpenSearch connection info, `tasks.max=3`. Create.
6. **OSD dashboard:** import `deploy/osd-dashboard-objects.ndjson` (index pattern +
   3 visualizations + the `github-events-dashboard`) per `deploy/README-osd-dashboard.md` §2.
   The app iframes dashboard id `github-events-dashboard` by default.
6. **App:** Applications → **Deploy app** → connect GitHub → this repo + branch →
   **Scan**. Aiven detects `compose.yaml`: `demo-app` (built from `Dockerfile`,
   port 8080) + Kafka + OpenSearch. Attach to the **existing** Kafka/OpenSearch from
   above. Fill env vars from the table (secrets as secret; `OSD_DASHBOARD_ID` from
   step 5; `AIVEN_SERVICES` app-last). Deploy.
7. **Verify** (below).

## Track B — Aiven MCP (via Claude)

Ask Claude (Aiven MCP connected), in order:
1. `aiven_service_create` Kafka (business-4); create topic `github-events` (3 parts).
2. `aiven_service_create` Kafka Connect (startup-4); `aiven_service_integration_create`
   `kafka_connect` source=kafka dest=connect.
3. `aiven_service_create` OpenSearch (business-4).
4. Create the sink connector (`avn service connector create <connect> @deploy/opensearch-sink-connector.json`
   with real connection.* + tasks.max=3), or the Console connector flow.
5. Import OSD saved-objects + build/export dashboard (see `deploy/README-osd-dashboard.md`);
   capture the dashboard id.
6. `aiven_application_deploy` (repo + branch, `build_path` → Dockerfile, port
   8080, Kafka + OpenSearch `service_integrations`, env vars incl. `OSD_DASHBOARD_ID`,
   `AIVEN_*`, `LICENSE_*`, `AIVEN_SERVICES` app-last).

---

## Verify end-to-end
- Open the app URL: control sidebar + embedded OpenSearch Dashboards in one window;
  countdown upper-right ~60:00.
- Click **Start**. Within seconds the dashboard shows events (path: ShadowTraffic →
  Kafka → sink connector → OpenSearch → OSD auto-refresh).
- Move a per-type slider / the global multiplier / hit **Release rush** → the
  event-type breakdown visibly reshapes.
- Confirm events spread across all 3 partitions (keyed by `repo_id`).
- At 60 min the watchdog deletes all four services (app last). If the app was
  stopped early, delete the rest manually (`avn service terminate <name>`).

## Container facts (verified)
- Wolfi base; image adds Node + supervisor + openssl via `apk`; `keytool` from GraalVM.
- Three supervised processes: backend (Node), shadowtraffic
  (`java -jar /home/shadowtraffic.jar --config /data/config.json --watch --reload immediate`),
  watchdog (Node).
- Kafka producerConfigs require `key.serializer`/`value.serializer` (JsonSerializer);
  events are keyed by `repo_id`. "Stopped/idle" = generators with `maxEvents:0`.
