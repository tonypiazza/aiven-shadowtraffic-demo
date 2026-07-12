# OpenSearch provisioning for the demo (index mapping + dashboard)

Verified working against Aiven OpenSearch (2026-07-12). Do these steps **before**
starting the sink connector / streaming, in this order.

Set env first (from the OpenSearch service connection info):
```bash
OS_URL="https://HOST:PORT"        # OpenSearch DB endpoint (port ~13xxx)
OSD_URL="https://HOST:443"        # OpenSearch Dashboards endpoint (port 443)
OS_USER=avnadmin OS_PASS=...      # OpenSearch credentials
```

## 1. Index template + pre-create the index  (CRITICAL — do before any data lands)
ShadowTraffic's `now` emits epoch-millis as a NUMBER, which OpenSearch dynamic
mapping types as `long` — breaking the dashboard's time picker & date_histogram.
Apply an explicit mapping so `created_at` is a `date`, then pre-create the index
so the sink connector can't auto-create it with the wrong mapping first.

```bash
# template
curl -u "$OS_USER:$OS_PASS" -k -X PUT "$OS_URL/_index_template/github-events" \
  -H 'Content-Type: application/json' --data @deploy/opensearch-index-template.json
# pre-create the index (inherits the template mapping)
curl -u "$OS_USER:$OS_PASS" -k -X PUT "$OS_URL/github-events"
```
If the index already exists mis-mapped: pause the sink connector + stop the app,
`DELETE $OS_URL/github-events`, then run the two commands above, then resume.

## 2. Import the dashboard saved-objects
`osd-dashboard-objects.ndjson` contains the index pattern + 3 visualizations
(events/sec by type, top repositories, event-type distribution) + the dashboard
`github-events-dashboard` (15-min window, 5s auto-refresh). Aggregations use the
bare keyword fields (`type`, `repo_full_name`) — the template maps those as
`keyword` (no `.keyword` subfield).

```bash
curl -u "$OS_USER:$OS_PASS" -k -X POST \
  "$OSD_URL/api/saved_objects/_import?overwrite=true" \
  -H "osd-xsrf: true" \
  --form file=@deploy/osd-dashboard-objects.ndjson
```

The app's iframe deep-links to dashboard id `github-events-dashboard` by default
(override with the `OSD_DASHBOARD_ID` env var). No app redeploy is needed to
re-import or tweak the dashboard — just re-run the import.

## Files
- `opensearch-index-template.json` — the `created_at`-as-date index template.
- `osd-dashboard-objects.ndjson` — index pattern + visualizations + dashboard.
- `osd-saved-objects.ndjson` — index pattern only (legacy; superseded by the above).
- `opensearch-sink-connector.json` — Kafka→OpenSearch sink connector config.
