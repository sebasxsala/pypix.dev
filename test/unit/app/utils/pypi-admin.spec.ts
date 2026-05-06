import { describe, expect, it } from 'vitest'
import {
  createTrustedPublishingWorkflow,
  getPyPIAccountPublishingUrl,
  getPyPIOrganizationsUrl,
  getPyPIProjectManageUrl,
  getPyPIProjectPageUrl,
  getPyPIProjectPublishingUrl,
  getPyPIProjectsUrl,
  getTrustedPublishingDocsUrl,
  parseGitHubRepositoryUrl,
} from '~/utils/pypi-admin'

describe('pypi-admin utils', () => {
  it('builds official PyPI admin links', () => {
    expect(getPyPIProjectsUrl()).toBe('https://pypi.org/manage/projects/')
    expect(getPyPIOrganizationsUrl()).toBe('https://pypi.org/manage/organizations/')
    expect(getPyPIAccountPublishingUrl()).toBe('https://pypi.org/manage/account/publishing/')
    expect(getTrustedPublishingDocsUrl()).toBe('https://docs.pypi.org/trusted-publishers/')
  })

  it('builds project-specific links with encoded package names', () => {
    expect(getPyPIProjectPageUrl('requests')).toBe('https://pypi.org/project/requests/')
    expect(getPyPIProjectManageUrl('my package')).toBe(
      'https://pypi.org/manage/project/my%20package/',
    )
    expect(getPyPIProjectPublishingUrl('requests')).toBe(
      'https://pypi.org/manage/project/requests/settings/publishing/',
    )
  })

  it('parses common GitHub repository URLs', () => {
    expect(parseGitHubRepositoryUrl('https://github.com/psf/requests')).toEqual({
      owner: 'psf',
      repo: 'requests',
    })
    expect(parseGitHubRepositoryUrl('https://github.com/pypa/warehouse.git')).toEqual({
      owner: 'pypa',
      repo: 'warehouse',
    })
    expect(parseGitHubRepositoryUrl('https://gitlab.com/pypa/sampleproject')).toBeNull()
    expect(parseGitHubRepositoryUrl(null)).toBeNull()
  })

  it('creates a no-token GitHub Actions Trusted Publishing workflow', () => {
    expect(
      createTrustedPublishingWorkflow({
        environment: 'pypi',
        pythonVersion: '3.x',
      }),
    ).toContain('uses: pypa/gh-action-pypi-publish@release/v1')
    expect(createTrustedPublishingWorkflow({ environment: 'pypi' })).toContain('id-token: write')
    expect(createTrustedPublishingWorkflow({ environment: 'pypi' })).not.toContain('PYPI_TOKEN')
  })
})
