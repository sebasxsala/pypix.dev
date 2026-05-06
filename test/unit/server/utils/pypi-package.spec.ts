import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)

const { transformPypiProject } = await import('#server/utils/pypi-package')

describe('transformPypiProject', () => {
  it('maps PyPI JSON metadata into the package page data contract', () => {
    const transformed = transformPypiProject(
      {
        info: {
          name: 'better-auth',
          version: '0.0.1b11',
          summary: 'API Reference for your Better Auth Instance',
          description: '# better-auth\n\nGenerated Python client.',
          description_content_type: 'text/markdown',
          author: 'Chasen Gao',
          author_email: 'chasenspace@gmail.com',
          home_page: '',
          license: 'MIT',
          keywords: 'OpenAPI, OpenAPI-Generator, Better Auth',
          requires_python: '>=3.9',
          project_urls: {
            Repository: 'https://github.com/chasenlab/better-auth-python',
            Issues: 'https://github.com/chasenlab/better-auth-python/issues',
          },
        },
        releases: {
          '0.0.1b10': [
            {
              filename: 'better_auth-0.0.1b10.tar.gz',
              packagetype: 'sdist',
              python_version: 'source',
              size: 82_000,
              upload_time_iso_8601: '2025-12-02T01:00:00.000Z',
              url: 'https://files.pythonhosted.org/packages/better_auth-0.0.1b10.tar.gz',
              digests: { sha256: 'old-sha' },
            },
          ],
          '0.0.1b11': [
            {
              filename: 'better_auth-0.0.1b11-py3-none-any.whl',
              packagetype: 'bdist_wheel',
              python_version: 'py3',
              size: 195_400,
              upload_time_iso_8601: '2025-12-02T02:00:00.000Z',
              url: 'https://files.pythonhosted.org/packages/better_auth-0.0.1b11-py3-none-any.whl',
              digests: { sha256: 'wheel-sha' },
            },
            {
              filename: 'better_auth-0.0.1b11.tar.gz',
              packagetype: 'sdist',
              python_version: 'source',
              size: 84_300,
              upload_time_iso_8601: '2025-12-02T02:01:00.000Z',
              url: 'https://files.pythonhosted.org/packages/better_auth-0.0.1b11.tar.gz',
              digests: { sha256: 'sdist-sha' },
            },
          ],
        },
        urls: [],
      },
      '0.0.1b11',
    )

    expect(transformed.name).toBe('better-auth')
    expect(transformed.description).toBe('API Reference for your Better Auth Instance')
    expect(transformed['dist-tags'].latest).toBe('0.0.1b11')
    expect(transformed.time.created).toBe('2025-12-02T01:00:00.000Z')
    expect(transformed.time.modified).toBe('2025-12-02T02:01:00.000Z')
    expect(transformed.time['0.0.1b11']).toBe('2025-12-02T02:01:00.000Z')
    expect(transformed.license).toBe('MIT')
    expect(transformed.keywords).toEqual(['OpenAPI', 'OpenAPI-Generator', 'Better Auth'])
    expect(transformed.repository?.url).toBe(
      'git+https://github.com/chasenlab/better-auth-python.git',
    )
    expect(transformed.bugs?.url).toBe('https://github.com/chasenlab/better-auth-python/issues')
    expect(transformed.author).toEqual({
      name: 'Chasen Gao',
      email: 'chasenspace@gmail.com',
    })
    expect(transformed.maintainers).toBeUndefined()
    expect(transformed.requestedVersion).toMatchObject({
      name: 'better-auth',
      version: '0.0.1b11',
      description: 'API Reference for your Better Auth Instance',
      readme: '# better-auth\n\nGenerated Python client.',
      dist: {
        tarball: 'https://files.pythonhosted.org/packages/better_auth-0.0.1b11.tar.gz',
        shasum: 'sdist-sha',
        unpackedSize: 84_300,
      },
      engines: {
        python: '>=3.9',
      },
    })
    expect(transformed.versions['0.0.1b11']).toMatchObject({
      version: '0.0.1b11',
      hasProvenance: false,
      trustLevel: 'none',
      license: 'MIT',
    })
  })

  it('returns null requestedVersion when the requested PyPI release does not exist', () => {
    const transformed = transformPypiProject(
      {
        info: { name: 'better-auth', version: '0.0.1b11' },
        releases: {},
        urls: [],
      },
      '9.9.9',
    )

    expect(transformed.requestedVersion).toBeNull()
  })
})
