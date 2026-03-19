#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

docker compose up -d --force-recreate docker-server

cat <<'EOF'
Recreated docker-server.

Recommended verification:
  docker compose ps docker-server
  docker compose exec docker-server sh -lc 'ulimit -n && ulimit -u && df -h /dev/shm'
EOF
