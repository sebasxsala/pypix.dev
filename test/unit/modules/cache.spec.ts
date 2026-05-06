import { beforeEach, describe, expect, it, vi } from 'vitest'

const { runtimeConfig, providerRef } = vi.hoisted(() => ({
  runtimeConfig: {
    upstash: {
      redisRestUrl: '',
      redisRestToken: '',
    },
  },
  providerRef: {
    value: 'vercel',
  },
}))

vi.mock('nuxt/kit', () => ({
  defineNuxtModule: <T>(module: T) => module,
  useRuntimeConfig: () => runtimeConfig,
}))

vi.mock('std-env', () => ({
  get provider() {
    return providerRef.value
  },
}))

import cacheModule from '../../../modules/cache'

type NitroConfig = {
  storage?: Record<string, Record<string, string>>
}

function runNitroConfigHook() {
  let nitroConfigHook: ((config: NitroConfig) => void) | undefined
  const nuxt = {
    hook(name: string, callback: (config: NitroConfig) => void) {
      if (name === 'nitro:config') {
        nitroConfigHook = callback
      }
    },
  }

  cacheModule.setup({}, nuxt)
  const nitroConfig: NitroConfig = {}
  nitroConfigHook?.(nitroConfig)
  return nitroConfig
}

describe('cache module', () => {
  beforeEach(() => {
    providerRef.value = 'vercel'
    process.env.VERCEL_ENV = 'production'
    delete process.env.RUNTIME_CACHE
    runtimeConfig.upstash.redisRestUrl = ''
    runtimeConfig.upstash.redisRestToken = ''
  })

  it('uses Upstash for defineCachedFunction storage in Vercel production when configured', () => {
    process.env.RUNTIME_CACHE = '1'
    runtimeConfig.upstash.redisRestUrl = 'https://redis.example.com'
    runtimeConfig.upstash.redisRestToken = 'token-123'

    const nitroConfig = runNitroConfigHook()

    expect(nitroConfig.storage?.cache).toEqual({
      driver: 'upstash',
      url: 'https://redis.example.com',
      token: 'token-123',
    })
  })

  it('falls back to Vercel runtime cache outside production', () => {
    process.env.RUNTIME_CACHE = '1'
    process.env.VERCEL_ENV = 'preview'
    runtimeConfig.upstash.redisRestUrl = 'https://redis.example.com'
    runtimeConfig.upstash.redisRestToken = 'token-123'

    const nitroConfig = runNitroConfigHook()

    expect(nitroConfig.storage?.cache).toEqual({
      driver: 'vercel-runtime-cache',
    })
  })
})
