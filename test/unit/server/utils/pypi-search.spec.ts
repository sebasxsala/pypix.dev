import { beforeEach, describe, expect, it, vi } from 'vitest'

const defineCachedFunctionMock = vi.fn((fn: Function) => fn)

vi.stubGlobal('defineCachedFunction', defineCachedFunctionMock)
vi.stubGlobal('PYPI_JSON_API', 'https://pypi.org/pypi')
vi.stubGlobal('PYPI_SIMPLE_API', 'https://pypi.org/simple')

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

const { normalizePypiSearchTerm } = await import('#server/utils/pypi-search-index')
const { filterPypiProjectNames, searchPypiProjects } = await import('#server/utils/pypi-search')

describe('normalizePypiSearchTerm', () => {
  it('normalizes spaces and PyPI separators to canonical hyphens', () => {
    expect(normalizePypiSearchTerm(' Better Auth ')).toBe('better-auth')
    expect(normalizePypiSearchTerm('better_auth')).toBe('better-auth')
    expect(normalizePypiSearchTerm('better.auth')).toBe('better-auth')
    expect(normalizePypiSearchTerm('better--auth')).toBe('better-auth')
  })
})

describe('filterPypiProjectNames', () => {
  it('prioritizes exact, prefix, then contains matches', () => {
    const projects = [
      { name: 'django-rest-framework' },
      { name: 'requests-cache' },
      { name: 'types-requests' },
      { name: 'requests' },
    ]

    const result = filterPypiProjectNames(projects, 'requests', 10)

    expect(result).toEqual(['requests', 'requests-cache', 'types-requests'])
  })

  it('matches user search text against normalized PyPI project names', () => {
    const projects = [
      { name: 'mcp-better-auth' },
      { name: 'better-auth' },
      { name: 'better_automation' },
    ]

    const result = filterPypiProjectNames(projects, 'better auth', 10)

    expect(result).toEqual(['better-auth', 'mcp-better-auth'])
  })
})

describe('searchPypiProjects', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('caches the PyPI Simple project index through Nitro storage', () => {
    expect(defineCachedFunctionMock).toHaveBeenCalledWith(expect.any(Function), {
      maxAge: 86400,
      swr: true,
      name: 'pypi-simple-projects',
      getKey: expect.any(Function),
    })
  })

  it('caches PyPI search results by normalized query and pagination', () => {
    expect(defineCachedFunctionMock).toHaveBeenCalledWith(expect.any(Function), {
      maxAge: 600,
      swr: true,
      name: 'pypi-search-results',
      getKey: expect.any(Function),
    })
  })

  it('puts exact package name matches first while keeping additional results', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === 'https://pypi.org/simple/') {
        return {
          projects: [{ name: 'requests' }, { name: 'requests-cache' }, { name: 'types-requests' }],
        }
      }

      if (url === 'https://pypi.org/pypi/requests/json') {
        return {
          info: {
            name: 'requests',
            version: '2.32.5',
            summary: 'Python HTTP for Humans.',
            keywords: ['http', 'requests'],
          },
          urls: [{ upload_time_iso_8601: '2026-01-01T00:00:00.000Z' }],
        }
      }

      if (url === 'https://pypi.org/pypi/requests-cache/json') {
        return {
          info: {
            name: 'requests-cache',
            version: '1.2.1',
            summary: 'Persistent cache for requests.',
            keywords: ['http', 'cache'],
          },
          urls: [{ upload_time_iso_8601: '2026-01-02T00:00:00.000Z' }],
        }
      }

      if (url === 'https://pypi.org/pypi/types-requests/json') {
        return {
          info: {
            name: 'types-requests',
            version: '2.32.4',
            summary: 'Typing stubs for requests.',
            keywords: ['types', 'requests'],
          },
          urls: [{ upload_time_iso_8601: '2026-01-03T00:00:00.000Z' }],
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    const result = await searchPypiProjects('requests', 25)

    expect(result.objects.map(item => item.package.name)).toEqual([
      'requests',
      'requests-cache',
      'types-requests',
    ])
    expect(result.total).toBe(3)
    expect(result.objects[0]).toMatchObject({
      package: {
        name: 'requests',
        version: '2.32.5',
      },
    })
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://pypistats.org/api/packages/requests/recent',
      expect.anything(),
    )
  })

  it('hydrates PyPI search results with keywords, maintainers and ownership without downloads', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === 'https://pypi.org/simple/') {
        return { projects: [{ name: 'better-auth' }] }
      }

      if (url === 'https://pypi.org/pypi/better-auth/json') {
        return {
          info: {
            name: 'better-auth',
            version: '0.0.1b12',
            summary: 'Python SDK for better-auth',
            author: 'Better Auth',
            author_email: 'sdk@example.com',
            maintainer: 'PyPI Maintainer',
            maintainer_email: 'maintainer@example.com',
            keywords: 'auth, sdk, openapi',
            license: 'MIT',
          },
          urls: [{ upload_time_iso_8601: '2026-05-04T12:00:00.000Z' }],
          ownership: {
            roles: [
              { role: 'Owner', user: 'owner-user' },
              { role: 'Maintainer', user: 'maintainer-user' },
            ],
            organization: null,
          },
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    const result = await searchPypiProjects('better auth', 25)

    expect(result.objects).toHaveLength(1)
    expect(result.objects[0]).toMatchObject({
      package: {
        name: 'better-auth',
        keywords: ['auth', 'sdk', 'openapi'],
        maintainers: [
          { username: 'owner-user', name: 'owner-user' },
          { username: 'maintainer-user', name: 'maintainer-user' },
          { name: 'PyPI Maintainer', email: 'maintainer@example.com' },
        ],
      },
    })
    expect(result.objects[0]?.downloads).toBeUndefined()
  })

  it('does not fetch PyPIStats while building search results', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === 'https://pypi.org/simple/') {
        return { projects: [{ name: 'better-auth' }, { name: 'better-auth-extra' }] }
      }

      if (url.startsWith('https://pypi.org/pypi/') && url.endsWith('/json')) {
        const name = url.split('/').at(-2)
        return {
          info: {
            name,
            version: '0.0.1b12',
            summary: 'Python SDK for better-auth',
            keywords: ['auth', 'sdk'],
          },
          urls: [{ upload_time_iso_8601: '2026-02-01T00:00:00.000Z' }],
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    const result = await searchPypiProjects('better auth', 25)

    expect(result.objects).toHaveLength(2)
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('pypistats.org'))).toBe(false)
  })

  it('hydrates only the first visible results instead of faning out to every match', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === 'https://pypi.org/simple/') {
        return {
          projects: Array.from({ length: 120 }, (_, index) => ({
            name: `auth-package-${index.toString().padStart(2, '0')}`,
          })),
        }
      }

      if (url.startsWith('https://pypi.org/pypi/') && url.endsWith('/json')) {
        const name = url.split('/').at(-2)
        return {
          info: {
            name,
            version: '1.0.0',
            summary: `Metadata for ${name}`,
          },
          urls: [{ upload_time_iso_8601: '2026-02-01T00:00:00.000Z' }],
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    const result = await searchPypiProjects('auth', 100)
    const jsonFetches = fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith('https://pypi.org/pypi/'),
    )

    expect(result.objects).toHaveLength(100)
    expect(jsonFetches).toHaveLength(10)
    expect(result.objects[0]?.package.description).toBe('Metadata for auth-package-00')
    expect(result.objects[10]?.package.description).toBeUndefined()
  })

  it('returns minimal name-only results when package metadata hydration fails', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === 'https://pypi.org/simple/') {
        return { projects: [{ name: 'auth-core' }, { name: 'auth-extra' }] }
      }

      if (url.startsWith('https://pypi.org/pypi/') && url.endsWith('/json')) {
        throw new Error('metadata unavailable')
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    const result = await searchPypiProjects('auth', 25)

    expect(result.objects).toEqual([
      expect.objectContaining({ package: expect.objectContaining({ name: 'auth-core' }) }),
      expect.objectContaining({ package: expect.objectContaining({ name: 'auth-extra' }) }),
    ])
  })
})
