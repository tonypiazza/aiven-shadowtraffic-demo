#!/usr/bin/env bash
set -euo pipefail

# Wait until the entrypoint has seeded the shared config file.
until [[ -f /data/config.json ]]; do sleep 0.5; done

# The ShadowTraffic image's ENTRYPOINT is `java ... -jar /home/shadowtraffic.jar`
# (verified via `docker inspect`). We invoke the jar the same way and point it at
# the shared, watched config the backend rewrites on each control action.
# --reload immediate: interrupt the running generation and reload as soon as the
# config changes, so throughput/scenario changes take effect quickly in a live demo.
exec java \
  -Djava.security.manager=allow \
  -Dfile.encoding=UTF-8 \
  -XX:MaxRAMPercentage=65.0 \
  -jar /home/shadowtraffic.jar \
  --config /data/config.json --watch --reload immediate
