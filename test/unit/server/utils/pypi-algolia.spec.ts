import { describe, expect, it, vi } from 'vitest'

const defineCachedFunctionMock = vi.fn((fn: Function) => fn)

vi.stubGlobal('defineCachedFunction', defineCachedFunctionMock)
vi.stubGlobal('PYPI_JSON_API', 'https://pypi.org/pypi')
vi.stubGlobal('PYPI_SIMPLE_API', 'https://pypi.org/simple')

const {
  ALGOLIA_INDEX_NAME,
  buildPypiAlgoliaRecord,
  dedupePypiProjectsForAlgolia,
  pypiAlgoliaHitToSearchResult,
} = await import('#server/utils/pypi-algolia-record')

const { searchPypiAlgolia } = await import('#server/utils/pypi-algolia')

describe('pypi algolia records', () => {
  it('uses PEP 503 normalized names as objectID while preserving display names', () => {
    const records = dedupePypiProjectsForAlgolia([
      { name: 'Zope.Interface' },
      { name: 'zope-interface' },
      { name: 'requests' },
    ])

    expect(records).toEqual([
      { name: 'Zope.Interface', normalizedName: 'zope-interface' },
      { name: 'requests', normalizedName: 'requests' },
    ])
  })

  it('maps PyPI JSON metadata into the Algolia record shape without downloads', () => {
    const record = buildPypiAlgoliaRecord({
      info: {
        name: 'requests',
        version: '2.32.5',
        summary: 'Python HTTP for Humans.',
        keywords: 'http, requests, client',
        classifiers: ['Programming Language :: Python :: 3'],
        requires_python: '>=3.9',
        project_urls: {
          Homepage: 'https://requests.readthedocs.io',
          Repository: 'https://github.com/psf/requests',
        },
        license: 'Apache-2.0',
        author: 'Python Software Foundation',
        maintainer: 'Requests Maintainers',
      },
      urls: [
        {
          upload_time_iso_8601: '2026-01-01T00:00:00.000Z',
          yanked: false,
        },
      ],
      releases: {
        '2.32.5': [
          {
            upload_time_iso_8601: '2026-01-01T00:00:00.000Z',
            yanked: false,
          },
        ],
      },
      vulnerabilities: [{ id: 'PYSEC-test' }],
    })

    expect(record).toEqual({
      objectID: 'requests',
      name: 'requests',
      normalizedName: 'requests',
      version: '2.32.5',
      summary: 'Python HTTP for Humans.',
      keywords: ['http', 'requests', 'client'],
      classifiers: ['Programming Language :: Python :: 3'],
      requiresPython: '>=3.9',
      projectUrls: {
        Homepage: 'https://requests.readthedocs.io',
        Repository: 'https://github.com/psf/requests',
      },
      homepage: 'https://requests.readthedocs.io',
      repository: 'https://github.com/psf/requests',
      license: 'Apache-2.0',
      author: 'Python Software Foundation',
      maintainer: 'Requests Maintainers',
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedAtTimestamp: 1767225600000,
      yankedLatest: false,
      hasVulnerabilities: true,
      popularRank: 1,
    })
    expect(record).not.toHaveProperty('downloads')
  })

  it('maps Algolia hits back to the existing search response contract', () => {
    const result = pypiAlgoliaHitToSearchResult({
      objectID: 'fastapi',
      name: 'fastapi',
      normalizedName: 'fastapi',
      version: '0.125.0',
      summary: 'FastAPI framework',
      keywords: ['api'],
      classifiers: [],
      requiresPython: '>=3.9',
      projectUrls: {
        Homepage: 'https://fastapi.tiangolo.com',
        Source: 'https://github.com/fastapi/fastapi',
      },
      updatedAt: '2026-02-01T00:00:00.000Z',
      updatedAtTimestamp: 1769904000000,
      popularRank: 2,
    })

    expect(result).toMatchObject({
      package: {
        name: 'fastapi',
        version: '0.125.0',
        description: 'FastAPI framework',
        keywords: ['api'],
        date: '2026-02-01T00:00:00.000Z',
        links: {
          npm: 'https://pypi.org/project/fastapi/',
          homepage: 'https://fastapi.tiangolo.com',
          repository: 'https://github.com/fastapi/fastapi',
        },
      },
      updated: '2026-02-01T00:00:00.000Z',
    })
    expect(result.downloads).toBeUndefined()
  })
})

describe('searchPypiAlgolia', () => {
  it('returns null when Algolia is not configured', async () => {
    const result = await searchPypiAlgolia(
      { provider: 'algolia', appId: '', searchApiKey: '', indexName: ALGOLIA_INDEX_NAME },
      'requests',
      25,
    )

    expect(result).toBeNull()
  })

  it('caches Algolia search results by normalized query and pagination', () => {
    expect(defineCachedFunctionMock).toHaveBeenCalledWith(expect.any(Function), {
      maxAge: 600,
      swr: true,
      name: 'pypi-algolia-search-results',
      getKey: expect.any(Function),
    })
  })

  it('returns null when Algolia search fails so callers can fallback locally', async () => {
    const result = await searchPypiAlgolia(
      {
        provider: 'algolia',
        appId: 'app',
        searchApiKey: 'key',
        indexName: ALGOLIA_INDEX_NAME,
        client: {
          search: vi.fn(async () => {
            throw new Error('429')
          }),
        },
      },
      'requests',
      25,
    )

    expect(result).toBeNull()
  })

  it('searches the configured Algolia index and maps hits', async () => {
    const search = vi.fn(async () => ({
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
    }))

    const result = await searchPypiAlgolia(
      {
        provider: 'algolia',
        appId: 'app',
        searchApiKey: 'key',
        indexName: ALGOLIA_INDEX_NAME,
        client: { search },
      },
      'requests',
      25,
      5,
    )

    expect(search).toHaveBeenCalledWith({
      requests: [
        expect.objectContaining({
          indexName: ALGOLIA_INDEX_NAME,
          query: 'requests',
          offset: 5,
          length: 25,
          attributesToRetrieve: expect.arrayContaining(['name', 'version', 'requiresPython']),
        }),
      ],
    })
    expect(result?.objects.map(item => item.package.name)).toEqual(['requests'])
    expect(result?.source).toBe('algolia')
    expect(result?.total).toBe(1)
  })
})
