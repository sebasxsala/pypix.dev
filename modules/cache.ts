import process from 'node:process'
import { defineNuxtModule, useRuntimeConfig } from 'nuxt/kit'
import { provider } from 'std-env'

// Storage key for fetch cache - must match shared/utils/fetch-cache-config.ts
const FETCH_CACHE_STORAGE_BASE = 'fetch-cache'

// Storage key for payload cache - must match server/plugins/payload-cache.ts
const PAYLOAD_CACHE_STORAGE_KEY = 'payload-cache'

export default defineNuxtModule({
  meta: {
    name: 'vercel-cache',
  },
  setup(_, nuxt) {
    if (provider !== 'vercel') {
      return
    }

    const config = useRuntimeConfig()

    nuxt.hook('nitro:config', nitroConfig => {
      nitroConfig.storage = nitroConfig.storage || {}

      const upstash = {
        driver: 'upstash' as const,
        url: config.upstash.redisRestUrl,
        token: config.upstash.redisRestToken,
      }
      const env = process.env.VERCEL_ENV
      const hasUpstashConfig = Boolean(config.upstash.redisRestUrl && config.upstash.redisRestToken)
      const cacheStorage =
        env === 'production' && hasUpstashConfig
          ? upstash
          : ({ driver: 'vercel-runtime-cache' } as const)

      if (process.env.RUNTIME_CACHE) {
        // Main cache storage (for defineCachedFunction, etc.)
        nitroConfig.storage.cache = {
          ...nitroConfig.storage.cache,
          ...cacheStorage,
        }

        // Fetch cache storage (for SWR fetch caching)
        nitroConfig.storage[FETCH_CACHE_STORAGE_BASE] = {
          ...nitroConfig.storage[FETCH_CACHE_STORAGE_BASE],
          driver: 'vercel-runtime-cache',
        }

        // Payload cache storage (for runtime payload caching)
        nitroConfig.storage[PAYLOAD_CACHE_STORAGE_KEY] = {
          ...nitroConfig.storage[PAYLOAD_CACHE_STORAGE_KEY],
          driver: 'vercel-runtime-cache',
        }
      }

      nitroConfig.storage.atproto =
        env === 'production' && hasUpstashConfig ? upstash : { driver: 'vercel-runtime-cache' }
    })
  },
})
