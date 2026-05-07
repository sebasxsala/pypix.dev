import { pathToFileURL } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { algoliasearch } from 'algoliasearch'

const PYPI_JSON_API = 'https://pypi.org/pypi'
const PYPI_SIMPLE_API = 'https://pypi.org/simple'
const ALGOLIA_INDEX_NAME = 'pypix_packages'

interface PypiSimpleProject {
  name: string
}

interface PypiProjectFile {
  upload_time?: string
  upload_time_iso_8601?: string
  yanked?: boolean
}

interface PypiProjectJson {
  info: {
    name: string
    version: string
    summary?: string
    home_page?: string
    project_urls?: Record<string, string>
    author?: string
    maintainer?: string
    license?: string
    keywords?: string | string[]
    requires_python?: string
    classifiers?: string[]
  }
  releases?: Record<string, PypiProjectFile[]>
  urls?: PypiProjectFile[]
  vulnerabilities?: Array<{ id?: string }>
}

interface PypiAlgoliaRecord {
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

const POPULAR_PACKAGES = [
  'requests',
  'fastapi',
  'django',
  'numpy',
  'pydantic',
  'pandas',
  'flask',
  'pytest',
  'scipy',
  'matplotlib',
  'sqlalchemy',
  'torch',
  'transformers',
  'beautifulsoup4',
  'click',
  'rich',
  'typer',
  'httpx',
  'uvicorn',
  'starlette',
] as const

const popularRank = new Map<string, number>(
  POPULAR_PACKAGES.map((name, index) => [name, index + 1]),
)

const MAX_SUMMARY_LENGTH = 500
const MAX_STRING_FIELD_LENGTH = 300
const MAX_PROJECT_URLS = 16
const MAX_PROJECT_URL_KEY_LENGTH = 80
const MAX_PROJECT_URL_LENGTH = 180
const MAX_KEYWORDS = 24
const MAX_KEYWORD_LENGTH = 80
const MAX_CLASSIFIERS = 40
const MAX_CLASSIFIER_LENGTH = 80

function loadDotEnv(path = '.env') {
  if (!existsSync(path)) return

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')
    process.env[key] ||= value
  }
}

interface IndexOptions {
  concurrency?: number
}

interface ProjectSelectionOptions {
  targetRecords?: number
  seedProjects?: PypiSimpleProject[]
  mode?: 'balanced' | 'refresh-listed'
}

interface RetryOptions {
  retries?: number
  baseDelayMs?: number
  jitterMs?: number
  sleep?: (delayMs: number) => Promise<void>
}

interface AlgoliaIndexClient {
  saveObjects: (options: {
    indexName: string
    objects: PypiAlgoliaRecord[]
    batchSize?: number
    waitForTasks?: boolean
  }) => Promise<unknown>
  setSettings: (options: {
    indexName: string
    indexSettings: ReturnType<typeof getPypiAlgoliaIndexSettings>
  }) => Promise<unknown>
}

function normalizePypiSearchTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, '-')
}

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
        truncateString(key.trim(), MAX_PROJECT_URL_KEY_LENGTH),
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
    ...(popularRank.get(normalizedName) && { popularRank: popularRank.get(normalizedName) }),
  }
}

function getNumberEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function getOptionalNumberEnv(name: string): number | undefined {
  const value = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function getProjectSeedFile(): PypiSimpleProject[] | undefined {
  const path = process.env.PYPI_INDEX_PROJECTS_FILE || 'scripts/pypi-seed-packages.txt'
  if (!existsSync(path)) return undefined

  const names = readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))

  return names.length ? names.map(name => ({ name })) : undefined
}

function sleep(delayMs: number) {
  return new Promise(resolve => setTimeout(resolve, delayMs))
}

function getErrorStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status
  return typeof status === 'number' ? status : undefined
}

function getRetryAfterDelay(error: unknown): number | undefined {
  const retryAfter = (error as { retryAfter?: unknown })?.retryAfter
  if (typeof retryAfter !== 'string') return undefined

  const seconds = Number.parseInt(retryAfter, 10)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000

  const timestamp = Date.parse(retryAfter)
  if (!Number.isFinite(timestamp)) return undefined

  return Math.max(0, timestamp - Date.now())
}

function isRetryableIndexerError(error: unknown): boolean {
  const status = getErrorStatus(error)
  if (status === undefined) return true
  return status === 408 || status === 429 || status >= 500
}

export async function withPypiIndexerRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 4
  const baseDelayMs = options.baseDelayMs ?? 1000
  const jitterMs = options.jitterMs ?? 250
  const sleepFn = options.sleep ?? sleep

  let attempt = 0
  while (true) {
    try {
      return await operation()
    } catch (error) {
      if (attempt >= retries || !isRetryableIndexerError(error)) throw error

      const retryAfterDelay = getRetryAfterDelay(error)
      const backoffDelay = baseDelayMs * 2 ** attempt
      const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0
      await sleepFn(retryAfterDelay ?? backoffDelay + jitter)
      attempt += 1
    }
  }
}

function getProjectByNormalizedName(projects: PypiSimpleProject[]) {
  const byName = new Map<string, PypiSimpleProject>()
  for (const project of projects) {
    const normalizedName = normalizePypiSearchTerm(project.name)
    if (normalizedName && !byName.has(normalizedName)) byName.set(normalizedName, project)
  }
  return byName
}

function getBucketKey(normalizedName: string) {
  const firstChar = normalizedName[0]
  return firstChar && /[a-z0-9]/.test(firstChar) ? firstChar : '#'
}

export function selectPypiProjectsForAlgolia(
  projects: PypiSimpleProject[],
  options: ProjectSelectionOptions = {},
): PypiSimpleProject[] {
  const targetRecords = options.targetRecords ?? projects.length
  const seedProjects = options.seedProjects ?? []
  const mode = options.mode ?? 'balanced'
  const allProjectsByName = getProjectByNormalizedName(projects)

  if (mode === 'refresh-listed') {
    return dedupePypiProjectsForAlgolia(seedProjects)
      .slice(0, targetRecords)
      .map(project => allProjectsByName.get(project.normalizedName) ?? { name: project.name })
  }

  const selected: PypiSimpleProject[] = []
  const seen = new Set<string>()

  for (const project of dedupePypiProjectsForAlgolia(seedProjects)) {
    if (selected.length >= targetRecords) break
    const resolvedProject = allProjectsByName.get(project.normalizedName) ?? { name: project.name }
    selected.push(resolvedProject)
    seen.add(project.normalizedName)
  }

  const buckets = new Map<string, PypiSimpleProject[]>()
  for (const project of dedupePypiProjectsForAlgolia(projects)) {
    if (seen.has(project.normalizedName)) continue

    const key = getBucketKey(project.normalizedName)
    const bucket = buckets.get(key) ?? []
    bucket.push({ name: project.name })
    buckets.set(key, bucket)
  }

  const keys = [...buckets.keys()].sort()
  let bucketIndex = 0
  while (selected.length < targetRecords && keys.length > 0) {
    const key = keys[bucketIndex]
    const bucket = buckets.get(key)
    const project = bucket?.shift()
    if (project) {
      selected.push(project)
      seen.add(normalizePypiSearchTerm(project.name))
    }
    if (!bucket?.length) keys.splice(bucketIndex, 1)
    else bucketIndex += 1
    if (bucketIndex >= keys.length) bucketIndex = 0
  }

  return selected
}

async function mapWithConcurrency<T, R>(
  values: T[],
  mapper: (value: T) => Promise<R | null>,
  concurrency: number,
): Promise<R[]> {
  const results: Array<R | null> = Array.from({ length: values.length }, () => null)
  let index = 0

  async function worker() {
    while (index < values.length) {
      const currentIndex = index++
      const result = await mapper(values[currentIndex])
      results[currentIndex] = result
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker))
  return results.filter((result): result is R => result !== null)
}

export function getPypiAlgoliaIndexSettings() {
  return {
    searchableAttributes: [
      'unordered(name)',
      'unordered(normalizedName)',
      'summary',
      'keywords',
      'classifiers',
    ],
    attributesForFaceting: ['searchable(classifiers)', 'requiresPython'],
    customRanking: ['asc(popularRank)', 'desc(updatedAtTimestamp)'],
    typoTolerance: true,
    queryType: 'prefixLast',
  }
}

export async function buildPypiAlgoliaIndexBatch(
  projects: PypiSimpleProject[],
  fetchProject: (name: string) => Promise<PypiProjectJson>,
  options: IndexOptions = {},
): Promise<PypiAlgoliaRecord[]> {
  const deduped = dedupePypiProjectsForAlgolia(projects)
  return await mapWithConcurrency(
    deduped,
    async project => {
      try {
        return buildPypiAlgoliaRecord(await fetchProject(project.name))
      } catch (error) {
        console.warn(`Skipping ${project.name}: ${(error as Error).message}`)
        return null
      }
    },
    options.concurrency ?? 5,
  )
}

export function clampPypiAlgoliaRecordsToTarget(
  records: PypiAlgoliaRecord[],
  savedRecords: number,
  targetRecords: number,
) {
  const remainingRecords = Math.max(0, targetRecords - savedRecords)
  return records.slice(0, remainingRecords)
}

async function fetchPypiSimpleProjects(): Promise<PypiSimpleProject[]> {
  const response = await withPypiIndexerRetry(async () => {
    const response = await fetch(`${PYPI_SIMPLE_API}/`, {
      headers: {
        'Accept': 'application/vnd.pypi.simple.v1+json',
        'User-Agent': 'pypix.dev Algolia indexer',
      },
    })
    if (!response.ok) {
      const error = new Error(`Failed to fetch PyPI Simple index: ${response.status}`) as Error & {
        status?: number
        retryAfter?: string | null
      }
      error.status = response.status
      error.retryAfter = response.headers.get('Retry-After')
      throw error
    }
    return response
  })

  const body = (await response.json()) as { projects?: PypiSimpleProject[] }
  return body.projects ?? []
}

async function fetchPypiProject(name: string): Promise<PypiProjectJson> {
  const response = await withPypiIndexerRetry(async () => {
    const response = await fetch(`${PYPI_JSON_API}/${encodeURIComponent(name)}/json`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'pypix.dev Algolia indexer',
      },
    })
    if (!response.ok) {
      const error = new Error(`Failed to fetch ${name}: ${response.status}`) as Error & {
        status?: number
        retryAfter?: string | null
      }
      error.status = response.status
      error.retryAfter = response.headers.get('Retry-After')
      throw error
    }
    return response
  })

  return (await response.json()) as PypiProjectJson
}

async function run() {
  loadDotEnv()

  const appId = process.env.ALGOLIA_APP_ID
  const adminApiKey = process.env.ALGOLIA_ADMIN_API_KEY
  const indexName = process.env.ALGOLIA_INDEX_NAME || ALGOLIA_INDEX_NAME
  const batchSize = getNumberEnv('PYPI_INDEX_BATCH_SIZE', 100)
  const concurrency = getNumberEnv('PYPI_INDEX_CONCURRENCY', 5)
  const saveBatchSize = getNumberEnv('PYPI_INDEX_SAVE_BATCH_SIZE', 1000)
  const batchDelayMs = getNumberEnv('PYPI_INDEX_BATCH_DELAY_MS', 0)
  const targetRecords = getOptionalNumberEnv('PYPI_INDEX_TARGET_RECORDS')
  const selectionMode =
    process.env.PYPI_INDEX_MODE === 'refresh-listed' ? 'refresh-listed' : 'balanced'
  const waitForTasks = process.env.PYPI_INDEX_WAIT_FOR_TASKS !== 'false'
  const seededProjects = getProjectSeedFile()

  if (!appId || !adminApiKey) {
    throw new Error('ALGOLIA_APP_ID and ALGOLIA_ADMIN_API_KEY are required')
  }

  const client = algoliasearch(appId, adminApiKey) as AlgoliaIndexClient
  await withPypiIndexerRetry(() =>
    client.setSettings({ indexName, indexSettings: getPypiAlgoliaIndexSettings() }),
  )

  const projects = await fetchPypiSimpleProjects()
  const targetRecordCount = targetRecords ?? projects.length
  const selectedProjects = selectPypiProjectsForAlgolia(projects, {
    targetRecords: projects.length,
    seedProjects: seededProjects,
    mode: selectionMode,
  })

  console.log(
    `Indexing up to ${targetRecordCount} records into ${indexName} with ${selectionMode} mode`,
  )

  let savedRecords = 0
  for (let offset = 0; offset < selectedProjects.length; offset += batchSize) {
    if (savedRecords >= targetRecordCount) break

    const batch = selectedProjects.slice(offset, offset + batchSize)
    const records = await buildPypiAlgoliaIndexBatch(batch, fetchPypiProject, { concurrency })
    const recordsToSave = clampPypiAlgoliaRecordsToTarget(records, savedRecords, targetRecordCount)
    if (recordsToSave.length > 0) {
      await withPypiIndexerRetry(() =>
        client.saveObjects({
          indexName,
          objects: recordsToSave,
          batchSize: saveBatchSize,
          waitForTasks,
        }),
      )
      savedRecords += recordsToSave.length
    }
    console.log(
      `Indexed ${savedRecords} / ${targetRecordCount} records (${Math.min(offset + batch.length, selectedProjects.length)} candidates checked)`,
    )
    if (batchDelayMs > 0 && offset + batchSize < selectedProjects.length) await sleep(batchDelayMs)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
