export interface GitHubRepository {
  owner: string
  repo: string
}

export interface TrustedPublishingWorkflowOptions {
  environment?: string
  pythonVersion?: string
}

const PYPI_BASE_URL = 'https://pypi.org'
const PYPI_DOCS_BASE_URL = 'https://docs.pypi.org'

function encodeProjectName(projectName: string) {
  return encodeURIComponent(projectName.trim())
}

export function getPyPIProjectsUrl() {
  return `${PYPI_BASE_URL}/manage/projects/`
}

export function getPyPIOrganizationsUrl() {
  return `${PYPI_BASE_URL}/manage/organizations/`
}

export function getPyPIAccountPublishingUrl() {
  return `${PYPI_BASE_URL}/manage/account/publishing/`
}

export function getPyPIProjectPageUrl(projectName: string) {
  return `${PYPI_BASE_URL}/project/${encodeProjectName(projectName)}/`
}

export function getPyPIProjectManageUrl(projectName: string) {
  return `${PYPI_BASE_URL}/manage/project/${encodeProjectName(projectName)}/`
}

export function getPyPIProjectPublishingUrl(projectName: string) {
  return `${getPyPIProjectManageUrl(projectName)}settings/publishing/`
}

export function getTrustedPublishingDocsUrl() {
  return `${PYPI_DOCS_BASE_URL}/trusted-publishers/`
}

export function getTrustedPublishingExistingProjectDocsUrl() {
  return `${PYPI_DOCS_BASE_URL}/trusted-publishers/adding-a-publisher/`
}

export function getTrustedPublishingPendingProjectDocsUrl() {
  return `${PYPI_DOCS_BASE_URL}/trusted-publishers/creating-a-project-through-oidc/`
}

export function getPublishingGuidePath() {
  return '/publishing'
}

export function parseGitHubRepositoryUrl(url: string | null | undefined): GitHubRepository | null {
  if (!url) return null

  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.hostname !== 'github.com') return null

    const [owner, rawRepo] = parsedUrl.pathname.split('/').filter(Boolean)
    if (!owner || !rawRepo) return null

    return {
      owner,
      repo: rawRepo.replace(/\.git$/, ''),
    }
  } catch {
    return null
  }
}

export function createTrustedPublishingWorkflow(options: TrustedPublishingWorkflowOptions = {}) {
  const environment = options.environment ?? 'pypi'
  const pythonVersion = options.pythonVersion ?? '3.x'

  return `name: release

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: ${environment}
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "${pythonVersion}"
      - name: Install build tooling
        run: python -m pip install --upgrade build
      - name: Build distributions
        run: python -m build
      - name: Publish to PyPI
        uses: pypa/gh-action-pypi-publish@release/v1
`
}
