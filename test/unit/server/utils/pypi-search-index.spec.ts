import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)

const { buildPypiSearchIndex, normalizePypiSearchTerm, searchPypiIndex } =
  await import('#server/utils/pypi-search-index')

describe('pypi search index', () => {
  it('normalizes PyPI project names using PEP 503 separators', () => {
    expect(normalizePypiSearchTerm(' Better.Auth_package ')).toBe('better-auth-package')
  })

  it('deduplicates normalized names while preserving the canonical display name', () => {
    const index = buildPypiSearchIndex([
      { name: 'zope.interface' },
      { name: 'zope-interface' },
      { name: 'requests' },
    ])

    expect(index.entries.map(entry => entry.name)).toEqual(['zope.interface', 'requests'])
  })

  it('ranks exact, popular prefix, prefix, token and contains matches before lexical fallback', () => {
    const index = buildPypiSearchIndex([
      { name: 'django-rest-framework' },
      { name: 'fastapi-users' },
      { name: 'types-requests' },
      { name: 'requests-cache' },
      { name: 'requests' },
      { name: 'my-fast-tools' },
    ])

    expect(searchPypiIndex(index, 'requests', { size: 10 }).names).toEqual([
      'requests',
      'requests-cache',
      'types-requests',
    ])

    expect(searchPypiIndex(index, 'fast', { size: 10 }).names).toEqual([
      'fastapi-users',
      'my-fast-tools',
    ])
  })

  it('paginates ranked index results with size and from', () => {
    const index = buildPypiSearchIndex([
      { name: 'auth-a' },
      { name: 'auth-b' },
      { name: 'auth-c' },
      { name: 'auth-d' },
    ])

    const result = searchPypiIndex(index, 'auth', { size: 2, from: 1 })

    expect(result.names).toEqual(['auth-b', 'auth-c'])
    expect(result.total).toBe(4)
  })
})
