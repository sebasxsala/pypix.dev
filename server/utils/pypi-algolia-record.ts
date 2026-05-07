import type { NpmSearchResult } from '#shared/types/npm-registry'
import type { PypiProjectJson } from './pypi-package'
import {
  getPypiPopularRank,
  normalizePypiSearchTerm,
  type PypiSimpleProject,
} from './pypi-search-index'

export const ALGOLIA_INDEX_NAME = 'pypix_packages'

export interface PypiAlgoliaRecord {
  objectID: string
  name: string
  normalizedName: string
  version: string
  summary?: string
  keywords: string[]
  classifiers: string[]
  requiresPython?: string
  projectUrls: Record<string, string>
  homepage?: string
  repository?: string
  license?: string
  author?: string
  maintainer?: string
  updatedAt?: string
  updatedAtTimestamp?: number
  yankedLatest?: boolean
  hasVulnerabilities?: boolean
  popularRank?: number
}

const MAX_SUMMARY_LENGTH = 500
const MAX_STRING_FIELD_LENGTH = 300
const MAX_PROJECT_URLS = 16
const MAX_PROJECT_URL_LENGTH = 500
const MAX_KEYWORDS = 24
const MAX_KEYWORD_LENGTH = 80
const MAX_CLASSIFIERS = 40
const MAX_CLASSIFIER_LENGTH = 160

export function dedupePypiProjectsForAlgolia(projects: PypiSimpleProject[]) {
  const seen = new Set<string>()
  const deduped: Array<{ name: string; normalizedName: string }> = []

  for (const project of projects) {
    const normalizedName = normalizePypiSearchTerm(project.name)
    if (!normalizedName || seen.has(normalizedName)) continue
    seen.add(normalizedName)
    deduped.push({ name: project.name, normalizedName })
  }

  return deduped
}

function normalizeKeywords(keywords: string | string[] | undefined): string[] {
  const values = Array.isArray(keywords) ? keywords : (keywords ?? '').split(',')
  return values
    .map(keyword => truncateString(keyword.trim(), MAX_KEYWORD_LENGTH))
    .filter((keyword): keyword is string => Boolean(keyword))
    .slice(0, MAX_KEYWORDS)
}

function truncateString(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

function normalizeClassifiers(classifiers: string[] | undefined): string[] {
  return (classifiers ?? [])
    .map(classifier => truncateString(classifier.trim(), MAX_CLASSIFIER_LENGTH))
    .filter((classifier): classifier is string => Boolean(classifier))
    .slice(0, MAX_CLASSIFIERS)
}

function normalizeProjectUrls(urls: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(
    Object.entries(urls ?? {})
      .map(([key, value]) => [
        truncateString(key.trim(), MAX_STRING_FIELD_LENGTH),
        truncateString(value.trim(), MAX_PROJECT_URL_LENGTH),
      ])
      .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1]))
      .slice(0, MAX_PROJECT_URLS),
  )
}

function getProjectUrl(
  urls: Record<string, string> | undefined,
  names: string[],
): string | undefined {
  if (!urls) return undefined
  const entries = Object.entries(urls)
  for (const name of names) {
    const found = entries.find(([key]) => key.toLowerCase() === name.toLowerCase())
    if (found?.[1]) return found[1]
  }
  return undefined
}

function getLatestUploadTime(project: PypiProjectJson): string | undefined {
  const latestVersion = project.info.version
  const latestReleaseTimes =
    project.releases?.[latestVersion]?.map(file => file.upload_time_iso_8601 ?? file.upload_time) ??
    []
  const urlTimes = project.urls?.map(file => file.upload_time_iso_8601 ?? file.upload_time) ?? []
  return [...latestReleaseTimes, ...urlTimes].filter(Boolean).sort().at(-1)
}

function getYankedLatest(project: PypiProjectJson): boolean | undefined {
  const latestFiles = project.releases?.[project.info.version] ?? project.urls
  if (!latestFiles?.length) return undefined
  return latestFiles.every(file => file.yanked === true)
}

export function buildPypiAlgoliaRecord(project: PypiProjectJson): PypiAlgoliaRecord {
  const info = project.info
  const normalizedName = normalizePypiSearchTerm(info.name)
  const projectUrls = normalizeProjectUrls(info.project_urls)
  const updatedAt = getLatestUploadTime(project)
  const updatedAtTimestamp = updatedAt ? Date.parse(updatedAt) : undefined
  const popularRank = getPypiPopularRank(normalizedName)
  const homepage = truncateString(
    getProjectUrl(projectUrls, ['Homepage', 'Home']) || info.home_page,
    MAX_PROJECT_URL_LENGTH,
  )
  const repository = truncateString(
    getProjectUrl(projectUrls, ['Repository', 'Source', 'Source Code', 'Code']),
    MAX_PROJECT_URL_LENGTH,
  )
  const yankedLatest = getYankedLatest(project)

  return {
    objectID: normalizedName,
    name: info.name,
    normalizedName,
    version: info.version || '',
    ...(info.summary && { summary: truncateString(info.summary, MAX_SUMMARY_LENGTH) }),
    keywords: normalizeKeywords(info.keywords),
    classifiers: normalizeClassifiers(info.classifiers),
    ...(info.requires_python && {
      requiresPython: truncateString(info.requires_python, MAX_STRING_FIELD_LENGTH),
    }),
    projectUrls,
    ...(homepage && { homepage }),
    ...(repository && { repository }),
    ...(info.license && { license: truncateString(info.license, MAX_STRING_FIELD_LENGTH) }),
    ...(info.author && { author: truncateString(info.author, MAX_STRING_FIELD_LENGTH) }),
    ...(info.maintainer && {
      maintainer: truncateString(info.maintainer, MAX_STRING_FIELD_LENGTH),
    }),
    ...(updatedAt && { updatedAt }),
    ...(Number.isFinite(updatedAtTimestamp) && { updatedAtTimestamp }),
    ...(yankedLatest !== undefined && { yankedLatest }),
    hasVulnerabilities: (project.vulnerabilities?.length ?? 0) > 0,
    ...(popularRank && { popularRank }),
  }
}

export function pypiAlgoliaHitToSearchResult(hit: PypiAlgoliaRecord): NpmSearchResult {
  const date = hit.updatedAt ?? new Date(0).toISOString()
  return {
    package: {
      name: hit.name,
      version: hit.version,
      description: hit.summary || undefined,
      keywords: hit.keywords,
      date,
      links: {
        npm: `https://pypi.org/project/${encodeURIComponent(hit.name)}/`,
        homepage: hit.homepage || getProjectUrl(hit.projectUrls, ['Homepage', 'Home']),
        repository:
          hit.repository ||
          getProjectUrl(hit.projectUrls, ['Repository', 'Source', 'Source Code', 'Code']),
        bugs: getProjectUrl(hit.projectUrls, ['Issues', 'Tracker', 'Bug Tracker']),
      },
      license: hit.license,
      author: hit.author ? { name: hit.author } : undefined,
      maintainers: hit.maintainer ? [{ name: hit.maintainer }] : undefined,
    },
    updated: date,
  }
}
