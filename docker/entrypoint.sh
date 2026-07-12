#!/usr/bin/env bash
set -euo pipefail

DATA_DIR=/data
mkdir -p "$DATA_DIR"

# Convenience: allow the whole ShadowTraffic license.env to be provided as ONE
# base64 secret (SHADOWTRAFFIC_LICENSE) instead of six separate LICENSE_* vars — the
# Aiven Console only adds env vars one at a time. Decode + export it so
# ShadowTraffic (a supervisord child) inherits the LICENSE_* values. Individual
# LICENSE_* vars still work and take precedence if also set.
if [[ -n "${SHADOWTRAFFIC_LICENSE:-}" ]]; then
  echo "$SHADOWTRAFFIC_LICENSE" | base64 -d > "$DATA_DIR/license.env"
  # Parse KEY=VALUE line-by-line (do NOT `source` — license values contain spaces,
  # e.g. LICENSE_EDITION=ShadowTraffic Free Trial, which breaks shell sourcing).
  # IFS='=' + read -r splits only on the first '='; the rest (incl. spaces) is the value.
  while IFS='=' read -r k v; do
    [[ "$k" =~ ^LICENSE_[A-Z]+$ ]] && export "$k=$v"
  done < "$DATA_DIR/license.env"
  echo "Loaded ShadowTraffic license from SHADOWTRAFFIC_LICENSE"
fi

# Materialize Aiven PEM certs (injected as env vars) into keystore/truststore for
# ShadowTraffic's Java Kafka producer, which needs PKCS12 + JKS, not raw PEM.
if [[ -n "${KAFKA_ACCESS_CERT:-}" && -n "${KAFKA_ACCESS_KEY:-}" && -n "${KAFKA_CA_CERT:-}" ]]; then
  printf '%s' "$KAFKA_ACCESS_CERT" > "$DATA_DIR/service.cert"
  printf '%s' "$KAFKA_ACCESS_KEY"  > "$DATA_DIR/service.key"
  printf '%s' "$KAFKA_CA_CERT"     > "$DATA_DIR/ca.pem"

  STORE_PW="${KAFKA_KEYSTORE_PASSWORD:-changeit}"
  export KAFKA_KEYSTORE_PASSWORD="$STORE_PW"
  export KAFKA_TRUSTSTORE_PASSWORD="$STORE_PW"
  export KAFKA_KEYSTORE_PATH="$DATA_DIR/client.keystore.p12"
  export KAFKA_TRUSTSTORE_PATH="$DATA_DIR/client.truststore.jks"

  # Client keystore (PKCS12) from access cert + key.
  openssl pkcs12 -export \
    -in "$DATA_DIR/service.cert" -inkey "$DATA_DIR/service.key" \
    -out "$KAFKA_KEYSTORE_PATH" -name aiven -password "pass:$STORE_PW"

  # Truststore (JKS) from CA cert.
  rm -f "$KAFKA_TRUSTSTORE_PATH"
  keytool -import -noprompt -alias aiven-ca \
    -file "$DATA_DIR/ca.pem" -keystore "$KAFKA_TRUSTSTORE_PATH" \
    -storepass "$STORE_PW" -storetype JKS
else
  echo "WARN: Kafka cert env vars not fully set; ShadowTraffic will fail to connect." >&2
fi

# Record start time for TTL bookkeeping (informational; the watchdog uses its own timer).
date +%s > "$DATA_DIR/started_at"

# Seed an initial (idle) config so ShadowTraffic has a valid file to watch immediately.
# NOTE: ShadowTraffic rejects empty generators/connections, so the idle config carries
# one generator capped at maxEvents:0. The backend overwrites this on the first action.
BOOTSTRAP="${KAFKA_BOOTSTRAP_SERVERS:-${KAFKA_BOOTSTRAP_SERVER:-localhost:9092}}"
cat > "$DATA_DIR/config.json" <<EOF
{
  "connections": {
    "kafka": {
      "kind": "kafka",
      "producerConfigs": {
        "bootstrap.servers": "$BOOTSTRAP",
        "security.protocol": "SSL",
        "ssl.keystore.location": "${KAFKA_KEYSTORE_PATH:-$DATA_DIR/client.keystore.p12}",
        "ssl.keystore.password": "${KAFKA_KEYSTORE_PASSWORD:-changeit}",
        "ssl.keystore.type": "PKCS12",
        "ssl.key.password": "${KAFKA_KEYSTORE_PASSWORD:-changeit}",
        "ssl.truststore.location": "${KAFKA_TRUSTSTORE_PATH:-$DATA_DIR/client.truststore.jks}",
        "ssl.truststore.password": "${KAFKA_TRUSTSTORE_PASSWORD:-changeit}",
        "ssl.truststore.type": "JKS",
        "key.serializer": "io.shadowtraffic.kafka.serdes.JsonSerializer",
        "value.serializer": "io.shadowtraffic.kafka.serdes.JsonSerializer"
      }
    }
  },
  "generators": [
    { "topic": "bootstrap-idle", "connection": "kafka", "localConfigs": { "maxEvents": 0 }, "value": { "x": { "_gen": "uuid" } } }
  ]
}
EOF

exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
