# ShadowTraffic × Aiven Streaming Demo

A single-window sales demo: a control sidebar drives **ShadowTraffic** generating
GitHub-activity events (shaped like [GH Archive](https://www.gharchive.org/)) →
**Aiven Kafka** (as Avro) → dedicated **Kafka Connect** (JDBC sink) →
**Aiven PostgreSQL**, with a **custom real-time dashboard** in the same page
updating live (SSE) as you tune the stream. Self-destructs after a hard-coded
**60-minute TTL**.

## Architecture

A single Docker image runs three processes under `supervisord`:
- **Backend** (Node/Express) — serves the control SPA + dashboard, rewrites the
  ShadowTraffic config on each control action, and **polls Postgres → streams
  metrics over SSE** to the React/Recharts charts (we render the dashboard, so
  updates are smooth — no flicker).
- **ShadowTraffic** (`java -jar /home/shadowtraffic.jar --config /data/config.json
  --watch --reload immediate`) — produces keyed **Avro** GitHub events to Kafka.
- **Watchdog** (Node) — deletes all Aiven services (app last) at the 60-min TTL.

```
Browser ──HTTP control──▶ Backend ──rewrites──▶ /data/config.json
   ▲                         │  ▲                       │ watched
   └──── SSE live metrics ───┘  └── polls (SQL) ── Postgres        ▼
                                                     ▲       ShadowTraffic
   Aiven PostgreSQL ◀── JDBC sink ── Aiven Kafka Connect ◀── Aiven Kafka ◀──┘
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
A **custom React + Recharts** dashboard rendered by our app: a hero events/sec
time-series by type, KPI tiles (events/sec, total, active repos), and breakdowns
(top repos, event-type mix). The backend polls Postgres (`created_at` is BIGINT
epoch-millis; bucketed via `to_timestamp(created_at/1000)`) and pushes updates over
SSE, so the charts update live and smoothly.

## Local development
- Backend: `cd backend && npm install && npm test`  (48 tests)
- Frontend: `cd frontend && npm install && npm run build`
- Container (**podman** locally): `podman build -f Dockerfile -t shadowtraffic-demo:local .`
- Validate a ShadowTraffic config without Kafka:
  `podman run --rm --env-file license.env -v "$PWD/somedir:/cfg" shadowtraffic/shadowtraffic:latest --config /cfg/config.json --stdout --sample 3`

A ShadowTraffic license is required. Put `LICENSE_*` values in a git-ignored
`license.env` for local runs, or inject them as Aiven secrets when deploying.

## Deploy to Aiven (platform-native, no agent)
See [`scripts/provision-aiven.md`](scripts/provision-aiven.md). Two acts:
1. **Console → Deploy app → Scan `compose.yaml`** auto-provisions the app + Kafka +
   PostgreSQL together (in `aws-eu-west-1`).
2. **Wire the pipeline** (schema registry, dedicated Kafka Connect, topic, JDBC
   sink) via the terminal notebook: `uv sync` then `./demo-notebook.sh` (euporie
   TUI) or `./jupyter.sh` (JupyterLab GUI) — or the equivalent Console clicks.

The repo must be pushed to GitHub first (Aiven Apps builds from a connected Git
repo). There is no `avn` CLI app-deploy; the app deploys via the Console compose
scan. `uv sync` provisions the notebook tooling (euporie + bash kernel); the
notebook also needs `avn` (authenticated), `jq`, and `psql`.

## TTL / cost safety
Self-destructs after **60 minutes**: the watchdog deletes the Kafka, Kafka Connect,
PostgreSQL, and App services via the Aiven API (**app last**, since it runs inside
the app container). A countdown shows in the upper-right of the UI.

**Limitation:** the watchdog runs inside the app container. If the App is deleted or
powered off before 60 minutes, the watchdog can't run and the other services won't
auto-delete — remove them manually (`avn service terminate <name>`) or via an
external scheduler.
