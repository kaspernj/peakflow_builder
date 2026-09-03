# Peakflow Builder

Docker Compose setup for a Peakflow Docker build server.

## Topology configuration

Copy `.env.example` to `.env` and choose values appropriate for the deployment.
The defaults retain the existing subnet, service addresses, and ports, but no
particular physical network or machine is required:

| Variable | Default | Meaning |
| --- | --- | --- |
| `BUILDER_NETWORK_NAME` | `peakflow-builder` | Docker network name created by Compose |
| `BUILDER_NETWORK_SUBNET` | `58.0.0.0/24` | Non-overlapping subnet assigned to that network |
| `DOCKER_SERVER_IPV4_ADDRESS` | `58.0.0.2` | `docker-server` address inside the subnet |
| `REGISTRY_CACHE_IPV4_ADDRESS` | `58.0.0.3` | Local `registry-cache` address inside the subnet |
| `DOCKER_SERVER_TLS_PORT` | `8676` | TLS Docker API listener inside `docker-server` |
| `HOST_PORT` | `8676` | Host publication for the base TLS listener |
| `DOCKER_SERVER_SOCKETDUCT_PORT` | `2375` | Plaintext Docker API listener in Socketduct mode |
| `REGISTRY_CACHE_HOST` | `registry-cache` | Cache hostname or address reached by the Docker daemon |
| `REGISTRY_CACHE_PORT` | `5000` | Cache listener and Docker daemon endpoint port |
| `REGISTRY_PROXY_REMOTEURL` | `https://registry-1.docker.io` | Upstream registry mirrored by a local cache |
| `REGISTRY_CACHE_BIND` | `127.0.0.1` | Host address used to publish a local cache |
| `REGISTRY_CACHE_BIND_PORT` | `5000` | Host port used to publish a local cache |

Both service addresses must belong to `BUILDER_NETWORK_SUBNET`. Choose a subnet
that does not overlap host routes or other Docker networks.

`docker-server`, `registry-cache`, and `peakflow-builder` remain stable logical
Compose identifiers because the override, service DNS, profile, and network
attachments use them as application contracts. `BUILDER_NETWORK_NAME` controls
the actual Docker network name. Use `registry-cache` as `REGISTRY_CACHE_HOST`
only when the local cache profile is enabled; otherwise provide a resolvable
external hostname or address.

## Docker API modes

### Default: host-published TLS

The base `docker-compose.yml` is the secure default on any network. It keeps the
Unix socket and publishes a certificate-verified TCP listener from
`DOCKER_SERVER_TLS_PORT` to `HOST_PORT` on the host.

Persist this mode in `.env`:

```env
COMPOSE_FILE=docker-compose.yml
```

Then start or recreate `docker-server`:

```bash
docker compose up -d --remove-orphans docker-server
```

### Trusted private network: Socketduct reverse gateway

When the Socketduct gateway and builder share a trusted private Docker network,
layer the tracked override by replacing `COMPOSE_FILE` in `.env`:

```env
COMPOSE_FILE=docker-compose.yml:docker-compose.socketduct.yml
```

Then use the same start command:

```bash
docker compose up -d --remove-orphans docker-server
```

The override replaces the daemon command, disables the image's automatic TLS
setup, and clears the base file's published ports. Its plaintext Docker API is
reachable at `docker-server:${DOCKER_SERVER_SOCKETDUCT_PORT}` by containers
attached to `BUILDER_NETWORK_NAME`. Never publish this port on the host, and do
not select this mode when that Docker network is untrusted or shared.

The override inherits the base image and volume configuration unchanged,
including `/var/lib/docker` data-volume behavior, `/shared`, and the private
registry certificate mount at `/etc/docker/certs.d`.

Docker Compose automatically reads `COMPOSE_FILE` from `.env`, so the bare
commands in this README and the scripts in `scripts/` preserve the selected
mode. Recreating `docker-server` interrupts its nested Docker daemon and all
nested workloads, including running builds, so drain the builder first.

## Registry cache modes

The registry cache mode is independent of the Docker API mode.

### External cache

Leave the local profile disabled and set the cache endpoint to a hostname or IP
address reachable from `docker-server`:

```env
COMPOSE_PROFILES=
REGISTRY_CACHE_HOST=cache.example.net
REGISTRY_CACHE_PORT=5000
```

`cache.example.net` is an example and must be replaced for the deployment.
Start or recreate the Docker server with the selected Docker API mode:

```bash
docker compose up -d --remove-orphans docker-server
```

### Local cache

Enable the profile and use the stable service identifier as the cache host:

```env
COMPOSE_PROFILES=registry-cache
REGISTRY_CACHE_HOST=registry-cache
REGISTRY_CACHE_PORT=5000
REGISTRY_PROXY_REMOTEURL=https://registry-1.docker.io
REGISTRY_CACHE_BIND=127.0.0.1
REGISTRY_CACHE_BIND_PORT=5000
```

Then start both services:

```bash
docker compose up -d
```

Verify the cache through its configured host publication:

```bash
curl "http://${REGISTRY_CACHE_BIND}:${REGISTRY_CACHE_BIND_PORT}/v2/"
```

Expected response:

```json
{}
```

## Private registry certificates

The Docker daemon reads private-registry trust roots from the host-managed
directory mounted at `/etc/docker/certs.d`. The default source directory is:

```text
./shared/docker-certs.d
```

Install each public CA using Docker's registry-specific directory layout:

```text
shared/docker-certs.d/<registry-host>:<port>/ca.crt
```

For example:

```text
shared/docker-certs.d/registry.example:5001/ca.crt
```

The certificate files are host-specific and ignored by Git. Set
`DOCKER_REGISTRY_CERTS_DIR` in `.env` to mount a different host directory.

Validate the configuration before recreating the Docker server:

```bash
docker compose config --quiet
```

As noted above, recreating `docker-server` interrupts its nested workloads. To
install a CA without recreating `docker-server`, copy it on the host to
`DOCKER_REGISTRY_CERTS_DIR/<registry-host>:<port>/ca.crt` (using
`./shared/docker-certs.d` by default). The existing read-only bind exposes that
file at `/etc/docker/certs.d/<registry-host>:<port>/ca.crt` inside the running
container immediately. Do not copy into the container path itself; the mount is
read-only.
