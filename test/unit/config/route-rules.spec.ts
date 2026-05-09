import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const rootDir = fileURLToPath(new URL('../../../', import.meta.url))

describe('routeRules', () => {
  it('caches PyPI search responses by search query inputs', () => {
    const config = readFileSync(`${rootDir}nuxt.config.ts`, 'utf8')

    expect(config).toContain("'/api/pypi/search': {")
    expect(config).toContain('passQuery: true')
    expect(config).toContain("allowQuery: ['q', 'size', 'from', 'provider']")
    expect(config).toContain("'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600'")
  })

  it('defines explicit cache rules for PyPI package-page APIs', () => {
    const config = readFileSync(`${rootDir}nuxt.config.ts`, 'utf8')

    expect(config).toContain("'/api/pypi/package/**': { isr: 300 }")
    expect(config).toContain("'/api/pypi/version/**': { isr: 300 }")
    expect(config).toContain("'/api/pypi/timeline/**':")
    expect(config).toContain("'/api/pypi/readme/**':")
    expect(config).toContain("'/api/pypi/readme/markdown/**':")
    expect(config).toContain("'/api/pypi/files/**':")
    expect(config).toContain("'/api/pypi/file/**':")
  })
})
