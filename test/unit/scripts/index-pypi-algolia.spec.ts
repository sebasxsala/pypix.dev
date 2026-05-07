import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)
vi.stubGlobal('PYPI_JSON_API', 'https://pypi.org/pypi')
vi.stubGlobal('PYPI_SIMPLE_API', 'https://pypi.org/simple')

const {
  buildPypiAlgoliaIndexBatch,
  buildPypiAlgoliaRecord,
  getPypiAlgoliaIndexSettings,
  selectPypiProjectsForAlgolia,
  withPypiIndexerRetry,
} = await import('~~/scripts/index-pypi-algolia')

describe('index-pypi-algolia script helpers', () => {
  it('dedupes simple projects, hydrates metadata, and builds Algolia records', async () => {
    const fetchProject = vi.fn(async (name: string) => ({
      info: {
        name,
        version: '1.0.0',
        summary: `Summary for ${name}`,
        keywords: ['python'],
        classifiers: ['Programming Language :: Python :: 3'],
      },
      urls: [{ upload_time_iso_8601: '2026-03-01T00:00:00.000Z' }],
    }))

    const records = await buildPypiAlgoliaIndexBatch(
      [{ name: 'Zope.Interface' }, { name: 'zope-interface' }, { name: 'requests' }],
      fetchProject,
      { concurrency: 2 },
    )

    expect(fetchProject).toHaveBeenCalledTimes(2)
    expect(fetchProject).toHaveBeenNthCalledWith(1, 'Zope.Interface')
    expect(fetchProject).toHaveBeenNthCalledWith(2, 'requests')
    expect(records.map(record => record.objectID)).toEqual(['zope-interface', 'requests'])
  })

  it('uses name-first Algolia ranking settings for PyPI package search', () => {
    expect(getPypiAlgoliaIndexSettings()).toMatchObject({
      searchableAttributes: [
        'unordered(name)',
        'unordered(normalizedName)',
        'summary',
        'keywords',
        'classifiers',
      ],
      customRanking: ['asc(popularRank)', 'desc(updatedAtTimestamp)'],
      attributesForFaceting: ['searchable(classifiers)', 'requiresPython'],
    })
  })

  it('keeps oversized PyPI metadata below Algolia record limits', () => {
    const record = buildPypiAlgoliaRecord({
      info: {
        name: 'pandas',
        version: '2.3.0',
        summary: 's'.repeat(4000),
        keywords: Array.from({ length: 100 }, (_, index) => `keyword-${index}`),
        classifiers: Array.from(
          { length: 100 },
          (_, index) => `Classifier ${index} ${'x'.repeat(400)}`,
        ),
        license: 'license '.repeat(2000),
        project_urls: Object.fromEntries(
          Array.from({ length: 50 }, (_, index) => [
            `URL ${index} ${'k'.repeat(100)}`,
            `https://example.com/${index}/${'v'.repeat(1000)}`,
          ]),
        ),
      },
      urls: [{ upload_time_iso_8601: '2026-03-01T00:00:00.000Z' }],
    })

    expect(Buffer.byteLength(JSON.stringify(record), 'utf8')).toBeLessThan(10_000)
    expect(record.summary).toHaveLength(500)
    expect(record.license).toHaveLength(300)
    expect(record.keywords).toHaveLength(24)
    expect(record.classifiers).toHaveLength(40)
    expect(Object.keys(record.projectUrls)).toHaveLength(16)
  })

  it('selects seeded packages first and fills the target with balanced prefix buckets', () => {
    const projects = [
      { name: 'requests' },
      { name: 'alpha-one' },
      { name: 'alpha-two' },
      { name: 'alpha-three' },
      { name: 'beta-one' },
      { name: 'beta-two' },
      { name: 'beta-three' },
      { name: 'zope-interface' },
      { name: 'zope-event' },
    ]

    const selected = selectPypiProjectsForAlgolia(projects, {
      targetRecords: 7,
      seedProjects: [{ name: 'requests' }, { name: 'zope.interface' }],
      mode: 'balanced',
    })

    expect(selected.map(project => project.name)).toEqual([
      'requests',
      'zope-interface',
      'alpha-one',
      'beta-one',
      'zope-event',
      'alpha-two',
      'beta-two',
    ])
  })

  it('refreshes only the explicit project list when requested', () => {
    const selected = selectPypiProjectsForAlgolia(
      [{ name: 'requests' }, { name: 'fastapi' }, { name: 'django' }],
      {
        targetRecords: 90_000,
        seedProjects: [{ name: 'Requests' }, { name: 'missing-package' }],
        mode: 'refresh-listed',
      },
    )

    expect(selected.map(project => project.name)).toEqual(['requests', 'missing-package'])
  })

  it('retries retryable indexer failures with exponential delays', async () => {
    const delays: number[] = []
    let attempts = 0

    const result = await withPypiIndexerRetry(
      async () => {
        attempts += 1
        if (attempts < 3) {
          const error = new Error('rate limited') as Error & { status?: number }
          error.status = 429
          throw error
        }
        return 'ok'
      },
      {
        retries: 3,
        baseDelayMs: 100,
        jitterMs: 0,
        sleep: async delay => {
          delays.push(delay)
        },
      },
    )

    expect(result).toBe('ok')
    expect(attempts).toBe(3)
    expect(delays).toEqual([100, 200])
  })
})
