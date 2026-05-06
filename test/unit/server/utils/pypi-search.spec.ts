import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)
vi.stubGlobal('PYPI_JSON_API', 'https://pypi.org/pypi')
vi.stubGlobal('PYPI_SIMPLE_API', 'https://pypi.org/simple')

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

const { filterPypiProjectNames, normalizePypiSearchTerm, searchPypiProjects } =
  await import('#server/utils/pypi-search')

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

  it('hydrates PyPI search results with keywords, maintainers, ownership and weekly downloads', async () => {
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

      if (url === 'https://pypistats.org/api/packages/better-auth/recent') {
        return { data: { last_week: 1234 } }
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    const result = await searchPypiProjects('better auth', 25)

    expect(result.objects).toHaveLength(1)
    expect(result.objects[0]).toMatchObject({
      downloads: { weekly: 1234 },
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
  })

  it('keeps search results when pypistats is unavailable', async () => {
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
            keywords: ['auth', 'sdk'],
          },
          urls: [{ upload_time_iso_8601: '2026-02-01T00:00:00.000Z' }],
        }
      }

      if (url === 'https://pypistats.org/api/packages/better-auth/recent') {
        throw new Error('rate limited')
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    const result = await searchPypiProjects('better auth', 25)

    expect(result.objects).toHaveLength(1)
    expect(result.objects[0]).toMatchObject({
      package: {
        name: 'better-auth',
        keywords: ['auth', 'sdk'],
      },
    })
    expect(result.objects[0]?.downloads).toBeUndefined()
  })
})
