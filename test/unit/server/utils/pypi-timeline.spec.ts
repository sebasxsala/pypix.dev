import { describe, expect, it } from 'vitest'
import { buildPypiTimeline } from '#server/utils/pypi-timeline'
import type { PypiProjectJson } from '#server/utils/pypi-package'

describe('buildPypiTimeline', () => {
  it('returns PyPI releases sorted newest-first with latest tag', () => {
    const project = {
      info: { name: 'demo', version: '2.0.0', license: 'MIT' },
      releases: {
        '1.0.0': [
          { upload_time_iso_8601: '2024-01-01T00:00:00.000Z', filename: 'demo-1.0.0.tar.gz' },
        ],
        '2.0.0': [
          { upload_time_iso_8601: '2025-01-01T00:00:00.000Z', filename: 'demo-2.0.0.tar.gz' },
        ],
        '1.5.0': [],
      },
      urls: [],
    } satisfies PypiProjectJson

    const result = buildPypiTimeline(project, { offset: 0, limit: 10 })

    expect(result.total).toBe(2)
    expect(result.versions).toEqual([
      {
        version: '2.0.0',
        time: '2025-01-01T00:00:00.000Z',
        license: 'MIT',
        tags: ['latest'],
      },
      {
        version: '1.0.0',
        time: '2024-01-01T00:00:00.000Z',
        license: 'MIT',
        tags: [],
      },
    ])
  })

  it('applies offset and limit after sorting', () => {
    const project = {
      info: { name: 'demo', version: '3.0.0' },
      releases: {
        '1.0.0': [{ upload_time_iso_8601: '2024-01-01T00:00:00.000Z' }],
        '2.0.0': [{ upload_time_iso_8601: '2024-02-01T00:00:00.000Z' }],
        '3.0.0': [{ upload_time_iso_8601: '2024-03-01T00:00:00.000Z' }],
      },
      urls: [],
    } satisfies PypiProjectJson

    const result = buildPypiTimeline(project, { offset: 1, limit: 1 })

    expect(result.total).toBe(3)
    expect(result.versions.map(version => version.version)).toEqual(['2.0.0'])
  })

  it('includes yanked release metadata', () => {
    const project = {
      info: { name: 'demo', version: '1.0.1' },
      releases: {
        '1.0.1': [
          {
            upload_time_iso_8601: '2024-02-01T00:00:00.000Z',
            yanked: true,
            yanked_reason: 'Broken release',
          },
        ],
      },
      urls: [],
    } satisfies PypiProjectJson

    const result = buildPypiTimeline(project, { offset: 0, limit: 10 })

    expect(result.versions[0]).toMatchObject({
      version: '1.0.1',
      yanked: true,
      yankedReason: 'Broken release',
    })
  })
})
