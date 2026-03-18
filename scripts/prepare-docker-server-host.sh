#!/usr/bin/env bash

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo $0"
  exit 1
fi

SCRIPT_NAME="$(basename "$0")"
SYSCTL_FILE="/etc/sysctl.d/99-peakflow-builder.conf"
LIMITS_FILE="/etc/security/limits.d/99-peakflow-builder.conf"

cat >"${SYSCTL_FILE}" <<'EOF'
# Peakflow builder host tuning for a process-heavy Docker-in-Docker service.
fs.file-max = 2097152
fs.inotify.max_user_instances = 1024
fs.inotify.max_user_watches = 1048576
kernel.pid_max = 4194304
vm.max_map_count = 262144
EOF

cat >"${LIMITS_FILE}" <<'EOF'
# Raise login-session limits so large container ulimits are not blocked by the host.
* soft nofile 262144
* hard nofile 524288
* soft nproc 65535
* hard nproc 65535
root soft nofile 262144
root hard nofile 524288
root soft nproc 65535
root hard nproc 65535
EOF

sysctl --system

cat <<EOF
Prepared host settings for peakflow-builder.

Files written:
  ${SYSCTL_FILE}
  ${LIMITS_FILE}

Next steps:
  1. Restart any long-lived shell or service session that should inherit the new limits.
  2. Recreate the Compose stack:
       docker compose up -d --force-recreate docker-server
  3. Verify inside the container:
       docker compose exec docker-server sh -lc 'ulimit -n && ulimit -u && df -h /dev/shm'

If you want different limits, adjust these environment variables in your shell or Compose env file before starting:
  DOCKER_SERVER_SHM_SIZE
  DOCKER_SERVER_NOFILE_SOFT
  DOCKER_SERVER_NOFILE_HARD
  DOCKER_SERVER_NPROC

Completed by ${SCRIPT_NAME}.
EOF
