# ShadowTraffic × Aiven Streaming Demo

A single-window sales demo: a control sidebar drives **ShadowTraffic** generating
GitHub-activity events (shaped like [GH Archive](https://www.gharchive.org/)) →
**Aiven Kafka** → dedicated **Kafka Connect** → **Aiven OpenSearch**, with the real
**OpenSearch Dashboards** embedded in the same page reacting live to every control
action. Self-destructs after a hard-coded **60-minute TTL**.

## Architecture

A single Docker image runs three processes under `supervisord`:
- **Backend** (Node/Express) — serves the control SPA, rewrites the ShadowTraffic
  config on each control action, and reverse-proxies OpenSearch Dashboards under
  `/osd/*` (injects Basic auth, strips framing headers) so it embeds same-origin.
- **ShadowTraffic** (`java -jar /home/shadowtraffic.jar --config /data/config.json
  --watch --reload immediate`) — produces keyed GitHub events to Kafka.
- **Watchdog** (Node) — deletes all Aiven services (app last) at the 60-min TTL.

```
Browser ──HTTP control + /osd iframe──▶ Backend ──rewrites──▶ /data/config.json
   ▲                                       │                        │ watched
   └──────── embedded OSD (proxied) ◀───────┘                        ▼
Aiven OpenSearch ◀── sink connector ── Aiven Kafka Connect ◀── Aiven Kafka ◀── ShadowTraffic
        └──────────── OpenSearch Dashboards (proxied into the app) ───────────┘
```

Why one image: ShadowTraffic's only control surface is its watched config file, and
Aiven Apps deploys one image per service — so backend + ShadowTraffic share a
filesystem in one container.

## Controls
- **Start / Stop / Pause.**
- **Per-event-type rate sliders** — PushEvent, PullRequestEvent, IssuesEvent,
  ReleaseEvent — each independent.
- **Global multiplier** — scales all types at once.
- **Scenarios** — *Normal* and *Release rush* (spikes Push/PR/Release).

Each event is keyed by `repo_id` so load spreads across Kafka partitions.
"Stopped/idle" is represented by generators with `maxEvents:0` (ShadowTraffic
rejects an empty config).

## Dashboard
The dashboard **is** OpenSearch Dashboards (not custom charts), embedded via the
`/osd` reverse proxy and auto-refreshing every 5s. Ship it as saved-objects — see
`deploy/README-osd-dashboard.md`.

## Local development
- Backend: `cd backend && npm install && npm test`  (45 tests)
- Frontend: `cd frontend && npm install && npm run build`
- Container (**podman** locally): `podman build -f docker/Dockerfile -t shadowtraffic-demo:local .`
- Validate a ShadowTraffic config without Kafka:
  `podman run --rm --env-file license.env -v "$PWD/somedir:/cfg" shadowtraffic/shadowtraffic:latest --config /cfg/config.json --stdout --sample 3`

A ShadowTraffic license is required. Put `LICENSE_*` values in a git-ignored
`license.env` for local runs, or inject them as Aiven secrets when deploying.

## Deploy to Aiven
Two tracks (Console, MCP) in [`scripts/provision-aiven.md`](scripts/provision-aiven.md).
`compose.yaml` auto-wires Kafka + OpenSearch; the dedicated Kafka Connect service,
the OpenSearch sink connector, and the OSD saved-objects import are separate
provisioning steps documented in the runbook. The repo must be pushed to GitHub
first (Aiven Apps builds from a connected Git repo).

## TTL / cost safety
Self-destructs after **60 minutes**: the watchdog deletes the Kafka, Kafka Connect,
OpenSearch, and App services via the Aiven API (**app last**, since it runs inside
the app container). A countdown shows in the upper-right of the UI.

**Limitation:** the watchdog runs inside the app container. If the App is deleted or
powered off before 60 minutes, the watchdog can't run and the other services won't
auto-delete — remove them manually (`avn service terminate <name>`) or via an
external scheduler.
