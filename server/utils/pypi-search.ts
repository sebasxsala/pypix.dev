import type { NpmPerson, NpmSearchResponse, NpmSearchResult } from '#shared/types/npm-registry'
import {
  CACHE_MAX_AGE_ONE_DAY,
  PYPI_JSON_API,
  PYPI_SIMPLE_API,
  PYPISTATS_API,
} from '#shared/utils/constants'

interface PypiSimpleProject {
  name: string
}

interface PypiProjectJson {
  info: {
    name: string
    version: string
    summary?: string
    home_page?: string
    project_urls?: Record<string, string>
    author?: string
    author_email?: string
    maintainer?: string
    maintainer_email?: string
    license?: string
    keywords?: string | string[]
  }
  urls?: Array<{ upload_time_iso_8601?: string; upload_time?: string }>
  ownership?: {
    roles?: Array<{ role: string; user: string }>
    organization?: string | null
  }
}

interface PypiStatsRecentResponse {
  data?: {
    last_day?: number
    last_month?: number
    last_week?: number
  }
}

export function emptyPypiSearchResponse(): NpmSearchResponse {
  return {
    isStale: false,
    objects: [],
    total: 0,
    time: new Date().toISOString(),
  }
}

export function normalizePypiSearchTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, '-')
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

function getPypiMaintainers(project: PypiProjectJson) {
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

export const fetchPypiRecentDownloads = defineCachedFunction(
  async (name: string): Promise<PypiStatsRecentResponse> => {
    return await $fetch<PypiStatsRecentResponse>(
      `${PYPISTATS_API}/packages/${encodeURIComponent(name)}/recent`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'pypix.dev search download stats',
        },
      },
    )
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_DAY,
    swr: true,
    name: 'pypi-downloads-recent',
    getKey: (name: string) => name,
  },
)

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

let simpleProjectsCache: { expiresAt: number; projects: PypiSimpleProject[] } | null = null

export async function fetchPypiSimpleProjects(): Promise<PypiSimpleProject[]> {
  if (simpleProjectsCache && simpleProjectsCache.expiresAt > Date.now()) {
    return simpleProjectsCache.projects
  }

  const response = await $fetch<{ projects: PypiSimpleProject[] }>(`${PYPI_SIMPLE_API}/`, {
    headers: {
      'Accept': 'application/vnd.pypi.simple.v1+json',
      'User-Agent': 'pypix.dev search migration MVP',
    },
  })

  simpleProjectsCache = {
    expiresAt: Date.now() + 60 * 60 * 1000,
    projects: response.projects,
  }

  return response.projects
}

async function fetchPypiProjectResult(name: string): Promise<NpmSearchResult> {
  const [data, downloads] = await Promise.all([
    $fetch<PypiProjectJson>(`${PYPI_JSON_API}/${encodeURIComponent(name)}/json`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'pypix.dev search migration MVP',
      },
    }),
    fetchPypiRecentDownloads(name).catch(() => null),
  ])

  const weeklyDownloads = downloads?.data?.last_week
  const normalizedWeeklyDownloads =
    typeof weeklyDownloads === 'number' && weeklyDownloads >= 0 ? weeklyDownloads : undefined

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
    ...(normalizedWeeklyDownloads !== undefined && {
      downloads: {
        weekly: normalizedWeeklyDownloads,
      },
    }),
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

export async function searchPypiProjects(
  query: string,
  size: number,
  from = 0,
): Promise<NpmSearchResponse> {
  const projects = await fetchPypiSimpleProjects()
  const names = filterPypiProjectNames(projects, query, size, from)
  const settled = await Promise.allSettled(names.map(name => fetchPypiProjectResult(name)))
  const objects = settled
    .filter(
      (result): result is PromiseFulfilledResult<NpmSearchResult> => result.status === 'fulfilled',
    )
    .map(result => result.value)

  return {
    isStale: false,
    objects,
    total: names.length,
    time: new Date().toISOString(),
  }
}
