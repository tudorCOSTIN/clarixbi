# ClarixBI k6 Load Tests

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Running the tests

### Minimal (against local dev server)

```bash
k6 run --env BASE_URL=http://localhost:4000 --env JWT_TOKEN=xxx k6-test.js
```

### Full configuration

```bash
k6 run \
  --env BASE_URL=http://localhost:4000 \
  --env JWT_TOKEN=<your-jwt-token> \
  --env ORG_ID=<your-org-uuid> \
  --env DASHBOARD_ID=<your-dashboard-uuid> \
  --env WIDGET_ID=<your-widget-uuid> \
  --env CONVERSATION_ID=<your-conversation-uuid> \
  k6-test.js
```

### With Docker

```bash
docker run --rm -i --network=host \
  -e BASE_URL=http://localhost:4000 \
  -e JWT_TOKEN=xxx \
  grafana/k6 run - < k6-test.js
```

## Scenarios

| Scenario         | VUs | Duration | p95 Target |
| ---------------- | --- | -------- | ---------- |
| health           | 5   | 5m       | < 100ms    |
| auth_me          | 10  | 5m       | < 200ms    |
| dashboards_list  | 15  | 5m       | < 300ms    |
| dashboard_detail | 10  | 5m       | < 1s       |
| widget_data      | 5   | 5m       | < 500ms    |
| ai_message       | 5   | 5m       | < 5s       |

Total: 50 virtual users across all scenarios.

## Thresholds

The test will **fail** (exit code 99) if any of these thresholds are breached:

- Global error rate must be < 10%
- Each scenario p95 must be under its target (see table above)
- Global p95 < 2s, p99 < 5s

## Output to Grafana Cloud / InfluxDB

```bash
# InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 k6-test.js

# Grafana Cloud k6
K6_CLOUD_TOKEN=xxx k6 cloud k6-test.js
```
