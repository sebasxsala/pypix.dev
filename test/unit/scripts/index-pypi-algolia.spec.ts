import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)
vi.stubGlobal('PYPI_JSON_API', 'https://pypi.org/pypi')
vi.stubGlobal('PYPI_SIMPLE_API', 'https://pypi.org/simple')

const { buildPypiAlgoliaIndexBatch, buildPypiAlgoliaRecord, getPypiAlgoliaIndexSettings } =
  await import('~~/scripts/index-pypi-algolia')

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
})
