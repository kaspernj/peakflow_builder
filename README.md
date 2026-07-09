# Peakflow Builder

Docker Compose setup for a Peakflow Docker build server.

## Registry cache modes

The same checkout can run in two modes controlled by `.env`.

### Normal builder

Most builder machines should use the central registry cache on Switch and should not run their own cache:

```env
HOST_PORT=8676
COMPOSE_PROFILES=
REGISTRY_CACHE_HOST=192.168.86.82
REGISTRY_CACHE_PORT=5000
```

Then start/recreate the Docker server:

```bash
docker compose up -d --remove-orphans docker-server
```

### Switch

Switch runs the registry cache and exposes it on the home LAN:

```env
HOST_PORT=2677
COMPOSE_PROFILES=registry-cache
REGISTRY_CACHE_HOST=registry-cache
REGISTRY_CACHE_PORT=5000
REGISTRY_CACHE_BIND=192.168.86.82
```

Then start both services:

```bash
docker compose up -d
```

Verify the cache from Switch or another home-network machine:

```bash
curl http://192.168.86.82:5000/v2/
```

Expected response:

```json
{}
```
