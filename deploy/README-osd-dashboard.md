# OpenSearch Dashboards saved-objects for the demo

`osd-saved-objects.ndjson` seeds the **index pattern** (`github-events*`, time field
`created_at`). The visualizations + dashboard are best built once in OSD and then
exported, because their `panelsJSON`/references are verbose and version-specific.

## 1. Import the index pattern
Via OSD UI: **Stack Management → Saved Objects → Import** → `osd-saved-objects.ndjson`.
Or via API (through the app's proxy or directly against the OpenSearch Dashboards URL):

```bash
curl -u "$OS_USER:$OS_PASS" -k -X POST \
  "$OSD_URL/api/saved_objects/_import?overwrite=true" \
  -H "osd-xsrf: true" \
  --form file=@deploy/osd-saved-objects.ndjson
```

## 2. Build the dashboard (once) then export
Create these visualizations on the `github-events*` index pattern, then a dashboard
tying them together:

- **Events/sec by type** — line/area, date_histogram on `created_at` (interval auto),
  split series by `type.keyword`.
- **Top repositories** — horizontal bar, terms agg on `repo_full_name.keyword`, size 10.
- **Event-type distribution** — pie, terms agg on `type.keyword`.
- **Activity by hour of day** — vertical bar, terms/histogram on `hour_of_day` (if
  present) or date_histogram hour-of-day on `created_at`.
- **Bot vs human** — pie split on `actor_login.keyword` filtered by `*[bot]` vs not,
  or a scripted/terms field if you add `is_bot` to the generator later.

Set the dashboard's default time range to **Last 15 minutes** and auto-refresh **5s**
so it reacts live during the demo.

Export it back into this repo so deploys are reproducible:

```bash
curl -u "$OS_USER:$OS_PASS" -k -X POST \
  "$OSD_URL/api/saved_objects/_export" \
  -H "osd-xsrf: true" -H "Content-Type: application/json" \
  -d '{"type":["index-pattern","visualization","dashboard"]}' \
  -o deploy/osd-saved-objects.ndjson
```

## 3. Capture the dashboard id
After import, note the dashboard's id (visible in its URL:
`/app/dashboards#/view/<DASHBOARD_ID>`). Set it as the app's `OSD_DASHBOARD_ID`
env var — the SPA embeds `/osd/app/dashboards#/view/$OSD_DASHBOARD_ID?embed=true&...`.

> Note: field names use `.keyword` sub-fields for aggregations because the sink
> connector indexes strings as `text` with a `keyword` multifield by default
> (dynamic mapping). Verify against your index's actual mapping.
