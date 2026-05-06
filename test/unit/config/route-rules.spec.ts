import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const rootDir = fileURLToPath(new URL('../../../', import.meta.url))

describe('routeRules', () => {
  it('does not cache PyPI search responses', () => {
    const config = readFileSync(`${rootDir}nuxt.config.ts`, 'utf8')

    expect(config).toContain("'/api/pypi/search': { isr: false, cache: false }")
  })
})
