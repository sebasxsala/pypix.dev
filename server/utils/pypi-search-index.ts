export interface PypiSimpleProject {
  name: string
}

export interface PypiSearchIndexEntry {
  name: string
  normalizedName: string
  tokens: string[]
  popularRank?: number
}

export interface PypiSearchIndex {
  entries: PypiSearchIndexEntry[]
  exact: Map<string, PypiSearchIndexEntry>
  version: string
}

export interface PypiSearchIndexResult {
  names: string[]
  total: number
}

export const PYPI_SEARCH_INDEX_VERSION = 'v2'

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

export function getPypiPopularRank(normalizedName: string): number | undefined {
  return popularRank.get(normalizedName)
}

let memoryIndex: PypiSearchIndex | null = null
let memoryProjectsRef: PypiSimpleProject[] | null = null

export function normalizePypiSearchTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, '-')
}

function tokenize(normalizedName: string): string[] {
  return normalizedName.split('-').filter(Boolean)
}

function buildEntry(project: PypiSimpleProject): PypiSearchIndexEntry {
  const normalizedName = normalizePypiSearchTerm(project.name)
  return {
    name: project.name,
    normalizedName,
    tokens: tokenize(normalizedName),
    popularRank: getPypiPopularRank(normalizedName),
  }
}

export function buildPypiSearchIndex(projects: PypiSimpleProject[]): PypiSearchIndex {
  const entries: PypiSearchIndexEntry[] = []
  const exact = new Map<string, PypiSearchIndexEntry>()

  for (const project of projects) {
    const entry = buildEntry(project)
    if (!entry.normalizedName || exact.has(entry.normalizedName)) continue
    exact.set(entry.normalizedName, entry)
    entries.push(entry)
  }

  return {
    entries,
    exact,
    version: PYPI_SEARCH_INDEX_VERSION,
  }
}

function getMatchRank(entry: PypiSearchIndexEntry, query: string): number | null {
  if (entry.normalizedName === query) return 0
  if (entry.popularRank && entry.normalizedName.startsWith(query)) return 1
  if (entry.normalizedName.startsWith(query)) return 2
  if (entry.tokens.some(token => token === query || token.startsWith(query))) return 3
  if (entry.normalizedName.includes(query)) return 4
  return null
}

function compareEntries(
  query: string,
  a: { entry: PypiSearchIndexEntry; rank: number },
  b: { entry: PypiSearchIndexEntry; rank: number },
) {
  if (a.rank !== b.rank) return a.rank - b.rank

  const popularA = a.entry.popularRank ?? Number.POSITIVE_INFINITY
  const popularB = b.entry.popularRank ?? Number.POSITIVE_INFINITY
  if (popularA !== popularB) return popularA - popularB

  const aDistance = Math.max(0, a.entry.normalizedName.length - query.length)
  const bDistance = Math.max(0, b.entry.normalizedName.length - query.length)
  if (aDistance !== bDistance) return aDistance - bDistance

  return a.entry.name.localeCompare(b.entry.name)
}

export function searchPypiIndex(
  index: PypiSearchIndex,
  query: string,
  options: { size: number; from?: number },
): PypiSearchIndexResult {
  const normalizedQuery = normalizePypiSearchTerm(query)
  if (!normalizedQuery) return { names: [], total: 0 }

  const matches = index.entries
    .map(entry => {
      const rank = getMatchRank(entry, normalizedQuery)
      return rank === null ? null : { entry, rank }
    })
    .filter((match): match is { entry: PypiSearchIndexEntry; rank: number } => !!match)
    .sort((a, b) => compareEntries(normalizedQuery, a, b))

  const from = Math.max(0, options.from ?? 0)
  const size = Math.max(0, options.size)

  return {
    names: matches.slice(from, from + size).map(match => match.entry.name),
    total: matches.length,
  }
}

export async function getPypiSearchIndex(projects: PypiSimpleProject[]): Promise<PypiSearchIndex> {
  if (memoryIndex && memoryProjectsRef === projects) return memoryIndex

  memoryProjectsRef = projects
  memoryIndex = buildPypiSearchIndex(projects)
  return memoryIndex
}
