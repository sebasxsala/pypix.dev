import { beforeEach, describe, expect, it, vi } from 'vitest'

const algoliaSearchMock = vi.fn()

vi.mock('algoliasearch', () => ({
  algoliasearch: () => ({ search: algoliaSearchMock }),
}))

vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)
vi.stubGlobal('PYPI_JSON_API', 'https://pypi.org/pypi')
vi.stubGlobal('PYPI_SIMPLE_API', 'https://pypi.org/simple')

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

const { searchPypiProjects } = await import('#server/utils/pypi-search')

describe('searchPypiProjects Algolia provider fallback', () => {
  beforeEach(() => {
    algoliaSearchMock.mockReset()
    fetchMock.mockReset()
  })

  it('uses Algolia when configured server-side', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      algolia: {
        appId: 'app',
        searchApiKey: 'search-key',
        indexName: 'pypix_packages',
      },
    }))
    algoliaSearchMock.mockResolvedValue({
      results: [
        {
          hits: [
            {
              objectID: 'requests',
              name: 'requests',
              normalizedName: 'requests',
              version: '2.32.5',
              summary: 'Python HTTP for Humans.',
              keywords: ['http'],
              classifiers: [],
              projectUrls: {},
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          nbHits: 1,
        },
      ],
    })

    const result = await searchPypiProjects('requests', 25, 0, 'algolia')

    expect(result.objects.map(item => item.package.name)).toEqual(['requests'])
    expect(algoliaSearchMock).toHaveBeenCalledWith({
      requests: [
        expect.objectContaining({
          indexName: 'pypix_packages',
          query: 'requests',
          offset: 0,
          length: 25,
        }),
      ],
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to the local PyPI Simple index when Algolia fails', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      algolia: {
        appId: 'app',
        searchApiKey: 'search-key',
        indexName: 'pypix_packages',
      },
    }))
    algoliaSearchMock.mockRejectedValue(new Error('429'))
    fetchMock.mockImplementation(async (url: string) => {
      if (url === 'https://pypi.org/simple/') {
        return { projects: [{ name: 'requests' }] }
      }

      if (url === 'https://pypi.org/pypi/requests/json') {
        return {
          info: {
            name: 'requests',
            version: '2.32.5',
            summary: 'Python HTTP for Humans.',
          },
          urls: [{ upload_time_iso_8601: '2026-01-01T00:00:00.000Z' }],
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    const result = await searchPypiProjects('requests', 25, 0, 'algolia')

    expect(result.objects.map(item => item.package.name)).toEqual(['requests'])
    expect(fetchMock).toHaveBeenCalledWith('https://pypi.org/simple/', expect.any(Object))
  })

  it('falls back to the local PyPI Simple index when Algolia returns no hits', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      algolia: {
        appId: 'app',
        searchApiKey: 'search-key',
        indexName: 'pypix_packages',
      },
    }))
    algoliaSearchMock.mockResolvedValue({
      results: [
        {
          hits: [],
          nbHits: 0,
        },
      ],
    })
    fetchMock.mockImplementation(async (url: string) => {
      if (url === 'https://pypi.org/simple/') {
        return { projects: [{ name: 'fastapi' }] }
      }

      if (url === 'https://pypi.org/pypi/fastapi/json') {
        return {
          info: {
            name: 'fastapi',
            version: '0.125.0',
            summary: 'FastAPI framework',
          },
          urls: [{ upload_time_iso_8601: '2026-02-01T00:00:00.000Z' }],
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    const result = await searchPypiProjects('fastapi', 25, 0, 'algolia')

    expect(result.objects.map(item => item.package.name)).toEqual(['fastapi'])
    expect(fetchMock).toHaveBeenCalledWith('https://pypi.org/simple/', expect.any(Object))
  })
})
