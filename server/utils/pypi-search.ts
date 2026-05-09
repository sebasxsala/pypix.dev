import type { NpmPerson, NpmSearchResponse, NpmSearchResult } from '#shared/types/npm-registry'
import { CACHE_MAX_AGE_ONE_DAY, PYPI_SIMPLE_API } from '#shared/utils/constants'
import { getPypiAlgoliaSearchConfig, searchPypiAlgolia } from './pypi-algolia'
import {
  fetchPypiProject,
  type FetchPypiProjectOptions,
  type PypiProjectJson,
} from './pypi-package'
import {
  getPypiSearchIndex,
  normalizePypiSearchTerm,
  PYPI_SEARCH_INDEX_VERSION,
  searchPypiIndex,
  type PypiSimpleProject,
} from './pypi-search-index'

const SEARCH_METADATA_MIN_QUERY_LENGTH = 3
const SEARCH_RESULT_CACHE_TTL = 60 * 60
const DEFAULT_SEARCH_SIZE = 25
const MAX_SEARCH_SIZE = 100
const MAX_SEARCH_FROM = 1000

interface SearchPypiProjectsOptions {
  signal?: AbortSignal
}

type PypiSearchProjectJson = PypiProjectJson & {
  ownership?: {
    roles?: Array<{ role: string; user: string }>
    organization?: string | null
  }
}

interface PypiSimpleProjectIndex {
  projects: PypiSimpleProject[]
  etag?: string
  lastSerial?: string
}

export function emptyPypiSearchResponse(): NpmSearchResponse {
  return {
    isStale: false,
    source: 'pypi',
    objects: [],
    total: 0,
    time: new Date().toISOString(),
  }
}

export function normalizePypiSearchPagination(size: number, from = 0) {
  const normalizedSize = Number.isFinite(size) ? Math.trunc(size) : DEFAULT_SEARCH_SIZE
  const normalizedFrom = Number.isFinite(from) ? Math.trunc(from) : MAX_SEARCH_FROM

  return {
    size: Math.min(MAX_SEARCH_SIZE, Math.max(0, normalizedSize)),
    from: Math.min(MAX_SEARCH_FROM, Math.max(0, normalizedFrom)),
  }
}

export function getPypiSearchCacheKey(query: string, size: number, from = 0) {
  const pagination = normalizePypiSearchPagination(size, from)
  return `${PYPI_SEARCH_INDEX_VERSION}:${normalizePypiSearchTerm(query)}:${pagination.size}:${pagination.from}`
}

function normalizeKeywords(keywords: string | string[] | undefined): string[] | undefined {
  const values = Array.isArray(keywords) ? keywords : (keywords ?? '').split(',')
  const normalized = values.map(keyword => keyword.trim()).filter(Boolean)
  return normalized.length ? normalized : undefined
}

function createPerson(name?: string, email?: string): NpmPerson | undefined {
  const trimmedName = name?.trim()
  const trimmedEmail = email?.trim()
  if (!trimmedName && !trimmedEmail) return undefined
  return {
    ...(trimmedName && { name: trimmedName }),
    ...(trimmedEmail && { email: trimmedEmail }),
  }
}

function getPypiMaintainers(project: PypiSearchProjectJson) {
  const roleMaintainers: NpmPerson[] =
    project.ownership?.roles
      ?.filter(role => role.user)
      .map(role => ({
        name: role.user,
        username: role.user,
      })) ?? []

  const metadataMaintainer = createPerson(project.info.maintainer, project.info.maintainer_email)

  const maintainers: NpmPerson[] = [...roleMaintainers]
  if (
    metadataMaintainer &&
    !maintainers.some(
      maintainer =>
        maintainer.username === metadataMaintainer.name ||
        maintainer.name === metadataMaintainer.name,
    )
  ) {
    maintainers.push(metadataMaintainer)
  }

  return maintainers.length ? maintainers : undefined
}

export function filterPypiProjectNames(
  projects: PypiSimpleProject[],
  query: string,
  size: number,
  from = 0,
): string[] {
  const normalizedQuery = normalizePypiSearchTerm(query)
  if (!normalizedQuery) return []

  const scored = projects
    .map(project => {
      const name = normalizePypiSearchTerm(project.name)
      if (name === normalizedQuery) return { project, score: 0 }
      if (name.startsWith(normalizedQuery)) return { project, score: 1 }
      if (name.includes(normalizedQuery)) return { project, score: 2 }
      return null
    })
    .filter((result): result is { project: PypiSimpleProject; score: number } => !!result)
    .sort((a, b) => a.score - b.score || a.project.name.localeCompare(b.project.name))

  return scored.slice(from, from + size).map(({ project }) => project.name)
}

const fetchCachedPypiSimpleProjectIndex = defineCachedFunction(
  async (): Promise<PypiSimpleProjectIndex> => {
    let etag: string | undefined
    let lastSerial: string | undefined

    const response = await $fetch<{
      meta?: { '_last-serial'?: number | string }
      projects: PypiSimpleProject[]
    }>(`${PYPI_SIMPLE_API}/`, {
      headers: {
        'Accept': 'application/vnd.pypi.simple.v1+json',
        'User-Agent': 'pypix.dev search migration MVP',
      },
      onResponse({ response }) {
        etag = response.headers.get('etag') ?? undefined
        lastSerial = response.headers.get('x-pypi-last-serial') ?? undefined
      },
    })

    const metaSerial = response.meta?.['_last-serial']
    return {
      projects: response.projects,
      ...(etag && { etag }),
      ...(lastSerial || metaSerial !== undefined
        ? { lastSerial: lastSerial ?? String(metaSerial) }
        : {}),
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_DAY,
    swr: true,
    name: 'pypi-simple-projects',
    getKey: () => 'all',
  },
)

export async function fetchPypiSimpleProjectIndex(): Promise<PypiSimpleProjectIndex> {
  return await fetchCachedPypiSimpleProjectIndex()
}

export async function fetchPypiSimpleProjects(): Promise<PypiSimpleProject[]> {
  return (await fetchPypiSimpleProjectIndex()).projects
}

async function fetchPypiProjectJson(
  name: string,
  options: FetchPypiProjectOptions = {},
): Promise<PypiSearchProjectJson> {
  return await fetchPypiProject(name, options)
}

async function fetchPypiProjectResult(
  name: string,
  options: FetchPypiProjectOptions = {},
): Promise<NpmSearchResult> {
  const data = await fetchPypiProjectJson(name, options)
  const keywords = normalizeKeywords(data.info.keywords)
  const maintainers = getPypiMaintainers(data)
  const info = data.info
  const upload = data.urls?.[0]
  const date = upload?.upload_time_iso_8601 ?? upload?.upload_time ?? new Date().toISOString()
  const homepage = info.project_urls?.Homepage ?? info.project_urls?.homepage ?? info.home_page
  const repository =
    info.project_urls?.Repository ??
    info.project_urls?.Source ??
    info.project_urls?.['Source Code'] ??
    info.project_urls?.Code
  const bugs = info.project_urls?.Issues ?? info.project_urls?.Tracker

  return {
    package: {
      name: info.name || name,
      version: info.version || '',
      description: info.summary || undefined,
      date,
      links: {
        npm: `https://pypi.org/project/${encodeURIComponent(info.name || name)}/`,
        homepage,
        repository,
        bugs,
      },
      author: info.author
        ? {
            name: info.author,
            email: info.author_email || undefined,
          }
        : undefined,
      license: info.license || undefined,
      keywords,
      maintainers,
    },
    updated: date,
  }
}

function createMinimalSearchResult(name: string): NpmSearchResult {
  return {
    package: {
      name,
      version: '',
      date: '',
      links: {
        npm: `https://pypi.org/project/${encodeURIComponent(name)}/`,
      },
    },
    updated: '',
  }
}

async function hydrateSearchResult(
  name: string,
  options: FetchPypiProjectOptions = {},
): Promise<NpmSearchResult> {
  return await fetchPypiProjectResult(name, options).catch(() => createMinimalSearchResult(name))
}

async function searchPypiProjectsUncached(
  query: string,
  size: number,
  from = 0,
  options: SearchPypiProjectsOptions = {},
): Promise<NpmSearchResponse> {
  const pagination = normalizePypiSearchPagination(size, from)
  const projects = await fetchPypiSimpleProjects()
  const index = await getPypiSearchIndex(projects)
  const { names, total } = searchPypiIndex(index, query, pagination)
  const normalizedQuery = normalizePypiSearchTerm(query)
  const exactMatchIndex =
    normalizedQuery.length >= SEARCH_METADATA_MIN_QUERY_LENGTH
      ? names.findIndex(name => normalizePypiSearchTerm(name) === normalizedQuery)
      : -1
  const objects = names.map(createMinimalSearchResult)

  if (exactMatchIndex >= 0) {
    objects[exactMatchIndex] = await hydrateSearchResult(names[exactMatchIndex]!, options)
  }

  return {
    isStale: false,
    source: 'pypi',
    objects,
    total,
    time: new Date().toISOString(),
  }
}

const searchCachedPypiProjects = defineCachedFunction(searchPypiProjectsUncached, {
  maxAge: SEARCH_RESULT_CACHE_TTL,
  swr: true,
  name: 'pypi-search-results',
  getKey: getPypiSearchCacheKey,
})

export async function searchPypiProjects(
  query: string,
  size: number,
  from = 0,
  provider: 'local' | 'algolia' = 'local',
  options: SearchPypiProjectsOptions = {},
): Promise<NpmSearchResponse> {
  const pagination = normalizePypiSearchPagination(size, from)

  if (provider === 'algolia') {
    const algoliaResult = await searchPypiAlgolia(
      { ...getPypiAlgoliaSearchConfig(), provider: 'algolia' },
      query,
      pagination.size,
      pagination.from,
    )
    if (algoliaResult && algoliaResult.objects.length > 0) return algoliaResult
  }

  const searchProjects = searchCachedPypiProjects as (
    query: string,
    size: number,
    from?: number,
    options?: SearchPypiProjectsOptions,
  ) => Promise<NpmSearchResponse>
  return await searchProjects(query, pagination.size, pagination.from, options)
}
