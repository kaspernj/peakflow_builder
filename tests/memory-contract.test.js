import {execFileSync} from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {fileURLToPath} from "node:url"

import {describe, expect, it} from "@velocious/testing"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const gibibyte = 1024 ** 3
const composeFiles = ["docker-compose.yml", "docker-compose.socketduct.yml"]
const emptyEnvFile = path.join("tests", "fixtures", "empty.env")

function composeInterpolationVariables() {
  const variables = new Set(["COMPOSE_FILE", "COMPOSE_PROFILES", "COMPOSE_PROJECT_NAME"])

  for (const composeFile of composeFiles) {
    const source = fs.readFileSync(path.join(repoRoot, composeFile), "utf8")

    for (const match of source.matchAll(/\$\{([A-Z][A-Z0-9_]*)/gu)) {
      variables.add(match[1])
    }
  }

  return variables
}

function renderCompose({inheritedEnvironment = {}, memoryLimit, socketduct = false} = {}) {
  const args = [
    "compose",
    "--project-name",
    "peakflow-builder-memory-contract-test",
    "--env-file",
    emptyEnvFile,
    "--file",
    "docker-compose.yml"
  ]

  if (socketduct) {
    args.push("--file", "docker-compose.socketduct.yml")
  }

  args.push("config", "--format", "json")

  const env = {...process.env, ...inheritedEnvironment}
  for (const key of composeInterpolationVariables()) {
    delete env[key]
  }

  if (memoryLimit) env.DOCKER_SERVER_MEMORY_LIMIT = memoryLimit

  return JSON.parse(execFileSync("docker", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"]
  }))
}

function dockerServer(config) {
  return config.services["docker-server"]
}

function expectContainedParent(service, expectedBytes) {
  expect(Number(service.mem_limit)).toBe(expectedBytes)
  expect(Number(service.memswap_limit)).toBe(expectedBytes)
  expect(service.privileged).toBeTrue()
  expect(Number(service.shm_size)).toBe(2 * gibibyte)
}

describe("docker-server memory containment", () => {
  it("reserves 16 GiB for admitted work and 4 GiB for DinD overhead", () => {
    const service = dockerServer(renderCompose())

    expectContainedParent(service, 20 * gibibyte)
    expect(Number(service.mem_limit) - (16 * gibibyte)).toBe(4 * gibibyte)
  })

  it("isolates checked-in defaults from inherited deployment configuration", () => {
    const service = dockerServer(renderCompose({
      inheritedEnvironment: {
        COMPOSE_FILE: "docker-compose.yml:docker-compose.socketduct.yml",
        COMPOSE_PROJECT_NAME: "production-builder",
        DOCKER_SERVER_MEMORY_LIMIT: "22g"
      }
    }))

    expectContainedParent(service, 20 * gibibyte)
  })

  it("inherits the same hard RAM and no-swap ceiling in Socketduct mode", () => {
    const service = dockerServer(renderCompose({socketduct: true}))

    expectContainedParent(service, 20 * gibibyte)
    expect(service.ports).toBeUndefined()
    expect(service.command).toContain("--host=tcp://0.0.0.0:2375")
  })

  it("configures parent RAM and total RAM-plus-swap ceilings together", () => {
    const service = dockerServer(renderCompose({memoryLimit: "22g"}))

    expectContainedParent(service, 22 * gibibyte)
  })

  it("preserves persistent nested-Docker and certificate mounts", () => {
    const service = dockerServer(renderCompose())
    const mountsByTarget = new Map(service.volumes.map((mount) => [mount.target, mount]))

    expect(mountsByTarget.has("/shared")).toBeTrue()
    expect(mountsByTarget.get("/etc/docker/certs.d").read_only).toBeTrue()
  })
})
