# Aiven Provisioning Runbook (rev. 4 — Postgres + custom dashboard)

**Deploys via the Aiven platform — no AI agent required.** Two parts:
- **Deploy the app — Console compose scan** provisions the app + Kafka + Postgres together.
- **Wire the pipeline — CLI** (schema registry, dedicated Kafka Connect, topic, JDBC
  sink) via the terminal notebook `./demo-notebook.sh` (or the Console clickops
  equivalents below). Compose can't express this part.

## Services (four; watchdog deletes all, app last)

| # | Service | Plan | Notes |
|---|---------|------|-------|
| 1 | Kafka (+ Karapace schema registry) | **business-4+** | Topic `github-events` (3 partitions) |
| 2 | Kafka Connect | **dedicated, startup-4+** | Runs the JDBC sink connector |
| 3 | PostgreSQL | **business-4+** | Sink target + dashboard query store |
| 4 | App (this repo) | startup-* (aws-eu-west-1) | Single image, port 8080 |

All in **aws-eu-west-1** (only cloud offering Aiven Apps).

## Prerequisites
- Aiven Apps access (Limited Availability) + a connected GitHub account (repo pushed).
- For the pipeline-wiring notebook: `uv` (runs `uv sync`), `avn` installed + **authenticated**
  (`avn user login`), `jq`, `psql`.
- A ShadowTraffic license (six `LICENSE_*` values) — see next section.
- An Aiven API token (watchdog teardown).

## ShadowTraffic license — per-operator distribution

**No `license.env` ships with this repo** — obtaining a license (shared or
individual) is a required, deliberate step. Only `license.env.example` (placeholder
values that won't work) is committed. The real `license.env` is **gitignored** — it
is a secret, never committed, never baked into the (public, Console-built) image.
Each operator injects it at deploy time as ONE Console secret, `SHADOWTRAFFIC_LICENSE`
(the entrypoint decodes it back into the six `LICENSE_*` vars, correctly preserving
values with spaces like the edition string).

**Each operator, once per deploy:**
1. Obtain a license and place it at the repo root as `license.env`:
   - **Shared:** the team `license.env` from the secret store (1Password / vault /
     internal runbook — distributed out-of-band, never through this repo); or
   - **Individual:** sign up at https://shadowtraffic.io and download your own.
   (`license.env.example` shows the exact shape.)
2. `./scripts/encode-license.sh` → base64 blob is copied to your clipboard.
3. Console → your app → Environment → add a **SECRET** var `SHADOWTRAFFIC_LICENSE`, paste.

> ⚠️ **EXPIRATION — this is a *trial* license (`ShadowTraffic Free Trial`) that
> expires `2026-08-10`.** After that date ShadowTraffic will refuse to start and the
> demo produces no events. Replace the shared blob with a durable (non-trial) license
> before then, or before wider rollout. (Durable licensing is pending confirmation
> from ShadowTraffic; until then we share the trial blob out-of-band.)

## App configuration (env vars set in the Console deploy flow)

| Variable | Secret? | Source |
|----------|---------|--------|
| `KAFKA_BOOTSTRAP_SERVERS`, `KAFKA_CA_CERT`, `KAFKA_ACCESS_CERT`, `KAFKA_ACCESS_KEY` | auto | Auto-injected by the Kafka integration (note: **plural** SERVERS) |
| `DATABASE_URL` (+ `PROJECT_CA_CERT` if offered) | auto | Auto-injected by the Postgres integration |
| `SCHEMA_REGISTRY_URL` | no | Kafka `connection_info.schema_registry_uri` (strip creds) |
| `SCHEMA_REGISTRY_USER`, `SCHEMA_REGISTRY_PASSWORD` | pw secret | Same URI's user:pass (ShadowTraffic produces Avro) |
| `SHADOWTRAFFIC_LICENSE` | yes | **Simplest:** `base64 -i license.env` — one secret; entrypoint decodes it. (Or set the six individual `LICENSE_*`.) |
| `AIVEN_TOKEN` | yes | Aiven API token (must have permission to terminate services) |
| `AIVEN_PROJECT` | no | Aiven project name |
| `AIVEN_SERVICES` | no | `"<kafka>,<postgres>,<app>"` — **app LAST** (Connect is auto-discovered, see below) |
| `KAFKA_SERVICE` | no | The Kafka service name (e.g. `kafka`). Lets the watchdog find + delete the notebook-created Kafka Connect service |

### ⚠️ Watchdog deletion order + Connect discovery
The watchdog runs inside the app container and, at the 60-min TTL, deletes
`AIVEN_SERVICES` **in order** — so list the **app last** (data services torn down
before the app deletes itself). The dedicated **Kafka Connect** service is created
*after* deploy by the notebook, so it can't be in `AIVEN_SERVICES`; instead the
watchdog reads `KAFKA_SERVICE`'s integrations, finds the wired Connect service, and
deletes it first. The TTL is anchored to the app's persisted start time (survives a
watchdog restart), and every failed termination is logged loudly (no silent giving-up).

---

## Deploy the app + Kafka + Postgres (Aiven Console)

1. Push this repo to GitHub (public, or connect the private repo to Aiven).
2. Console → **Applications → Deploy app** → connect GitHub → select this repo +
   branch → **Scan**. Aiven reads `compose.yaml`: one app service `demo-app` (built
   from `Dockerfile`, port 8080) + **Kafka** + **PostgreSQL**, all in
   **aws-eu-west-1**.
3. Fill env vars from the table (secrets as secret). `SCHEMA_REGISTRY_*` come from
   the schema-registry step below — you can deploy first and add them after enabling
   the registry, or set them once known and redeploy. `AIVEN_SERVICES` app-last.
4. Deploy. Kafka + Postgres + the app come up together.

## Wire the pipeline (terminal notebook, no agent)

Run the notebook — it performs all of the following as live `avn` cells:
```bash
uv sync            # installs euporie + bash kernel (one time)
./demo-notebook.sh # opens wire-demo.ipynb in the terminal (euporie)
# GUI alternative: ./jupyter.sh (JupyterLab in the browser)
```
The notebook: preflight → set names → enable schema registry → create + integrate
dedicated Kafka Connect → create topic `github-events` (3 partitions) → build +
create the JDBC sink connector (`deploy/jdbc-sink-connector.json`) → verify rows in
Postgres. Then apply the index: `deploy/postgres-schema.sql` (after the table exists).

### Console clickops equivalents (if you prefer the UI)
1. Kafka service → **Service settings → enable schema registry** (Karapace). Note
   `connection_info.schema_registry_uri` (url + user:pass) → set the app's
   `SCHEMA_REGISTRY_*` env.
2. Create a dedicated **Apache Kafka Connect** service (startup-4); on Kafka →
   **Connectors → Integrate standalone service** → select it → Enable.
3. Kafka → Topics → create `github-events` (3 partitions).
4. Kafka/Connect → **Connectors → Create connector → JDBC sink**; paste
   `deploy/jdbc-sink-connector.json` with `connection.*` (from Postgres connection
   info) and `value.converter.schema.registry.*` (from the registry). Create; verify
   RUNNING.
5. Apply `deploy/postgres-schema.sql` (index on `created_at`).

---

## Verify end-to-end
- Open the app URL: control sidebar + custom live dashboard in one window;
  countdown upper-right ~60:00.
- Click **Start** (or **Release rush**). Within a couple seconds the dashboard's
  events/sec chart + KPIs update smoothly (path: ShadowTraffic → Kafka(Avro) →
  JDBC sink → Postgres → backend poll → SSE → charts).
- Move a per-type slider / the multiplier → the hero chart reshapes live.
- Confirm events spread across all 3 partitions (keyed by `repo_id`).
- At 60 min the watchdog deletes all four services (app last). If the app was
  stopped early, delete the rest manually (`avn service terminate <name>`).

## Notes
- **No `avn` app-deploy exists** — the app is deployed only via the Console compose
  scan. `avn` handles the data-pipeline wiring. MCP
  `aiven_application_deploy` is an optional developer shortcut, not the demo path.
- Container: Wolfi base; adds Node + supervisor + openssl via `apk`; `keytool` from
  GraalVM. Three supervised processes: backend (Node), shadowtraffic (`java -jar
  /home/shadowtraffic.jar ... --watch --reload immediate`), watchdog (Node).
- ShadowTraffic produces **Avro** (needs the schema registry); events keyed by
  `repo_id`. "Stopped/idle" = generators with `maxEvents:0`. `created_at` is BIGINT
  epoch-millis; dashboard queries bucket via `to_timestamp(created_at/1000)`.
