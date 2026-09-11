'use strict'

const assert = require('node:assert/strict')
const {execFileSync} = require('node:child_process')
const path = require('node:path')
const {test} = require('node:test')

const repoRoot = path.resolve(__dirname, '..')
const gibibyte = 1024 ** 3

function renderCompose({socketduct = false, memoryLimit} = {}) {
  const args = [
    'compose',
    '--project-name',
    'peakflow-builder-memory-contract-test',
    '--file',
    'docker-compose.yml'
  ]

  if (socketduct) {
    args.push('--file', 'docker-compose.socketduct.yml')
  }

  args.push('config', '--format', 'json')

  const env = {...process.env}
  for (const key of ['COMPOSE_FILE', 'COMPOSE_PROFILES', 'COMPOSE_PROJECT_NAME']) {
    delete env[key]
  }

  if (memoryLimit) env.DOCKER_SERVER_MEMORY_LIMIT = memoryLimit

  return JSON.parse(execFileSync('docker', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  }))
}

function dockerServer(config) {
  return config.services['docker-server']
}

function assertContainedParent(service, expectedBytes) {
  assert.equal(Number(service.mem_limit), expectedBytes)
  assert.equal(Number(service.memswap_limit), expectedBytes)
  assert.equal(service.privileged, true)
  assert.equal(Number(service.shm_size), 2 * gibibyte)
}

test('default parent reserves 16 GiB for admitted work and 4 GiB for DinD overhead', () => {
  const service = dockerServer(renderCompose())

  assertContainedParent(service, 20 * gibibyte)
  assert.equal(Number(service.mem_limit) - (16 * gibibyte), 4 * gibibyte)
})

test('Socketduct mode inherits the same hard RAM and no-swap ceiling', () => {
  const service = dockerServer(renderCompose({socketduct: true}))

  assertContainedParent(service, 20 * gibibyte)
  assert.deepEqual(service.ports, undefined)
  assert(service.command.includes('--host=tcp://0.0.0.0:2375'))
})

test('parent RAM and total RAM-plus-swap ceilings are explicitly configurable together', () => {
  const service = dockerServer(renderCompose({memoryLimit: '22g'}))

  assertContainedParent(service, 22 * gibibyte)
})

test('memory configuration does not replace persistent nested-Docker or certificate mounts', () => {
  const service = dockerServer(renderCompose())
  const mountsByTarget = new Map(service.volumes.map((mount) => [mount.target, mount]))

  assert(mountsByTarget.has('/shared'))
  assert.equal(mountsByTarget.get('/etc/docker/certs.d').read_only, true)
})
