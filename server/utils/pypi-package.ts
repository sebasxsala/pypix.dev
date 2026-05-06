import type { SlimPackument, SlimPackumentVersion } from '#shared/types/npm-registry'
import { CACHE_MAX_AGE_FIVE_MINUTES, PYPI_JSON_API } from '#shared/utils/constants'

export interface PypiProjectFile {
  filename?: string
  packagetype?: string
  python_version?: string
  size?: number
  upload_time?: string
  upload_time_iso_8601?: string
  url?: string
  digests?: {
    sha256?: string
    md5?: string
    blake2b_256?: string
  }
}

export interface PypiProjectJson {
  info: {
    name: string
    version: string
    summary?: string
    description?: string
    description_content_type?: string
    home_page?: string
    project_urls?: Record<string, string>
    author?: string
    author_email?: string
    maintainer?: string
    maintainer_email?: string
    license?: string
    keywords?: string | string[]
    requires_python?: string
    classifiers?: string[]
  }
  releases?: Record<string, PypiProjectFile[]>
  urls?: PypiProjectFile[]
}

function getUploadTime(file: PypiProjectFile | undefined): string | undefined {
  return file?.upload_time_iso_8601 ?? file?.upload_time
}

function getReleasePublishedAt(files: PypiProjectFile[] | undefined): string | undefined {
  return files?.map(getUploadTime).filter(Boolean).sort().at(-1)
}

function pickDistributionFile(files: PypiProjectFile[] | undefined): PypiProjectFile | undefined {
  if (!files?.length) return undefined
  return (
    files.find(file => file.packagetype === 'sdist') ??
    files.find(file => file.packagetype === 'bdist_wheel') ??
    files[0]
  )
}

function normalizeKeywords(keywords: string | string[] | undefined): string[] | undefined {
  const values = Array.isArray(keywords) ? keywords : (keywords ?? '').split(',')
  const normalized = values.map(keyword => keyword.trim()).filter(Boolean)
  return normalized.length ? normalized : undefined
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

function normalizeRepositoryUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (url.startsWith('git+')) return url
  if (url.includes('github.com') && !url.endsWith('.git')) return `git+${url}.git`
  return url
}

function createPerson(
  name?: string,
  email?: string,
): { name?: string; email?: string } | undefined {
  const trimmedName = name?.trim()
  const trimmedEmail = email?.trim()
  if (!trimmedName && !trimmedEmail) return undefined
  return {
    ...(trimmedName && { name: trimmedName }),
    ...(trimmedEmail && { email: trimmedEmail }),
  }
}

export function transformPypiProject(
  project: PypiProjectJson,
  requestedVersion?: string | null,
): SlimPackument {
  const info = project.info
  const releases = project.releases ?? {}
  const latestVersion = info.version
  const selectedVersion = requestedVersion || latestVersion
  const releaseEntries = Object.entries(releases)
  const releaseTimes = new Map(
    releaseEntries.map(([version, files]) => [version, getReleasePublishedAt(files)] as const),
  )
  const sortedVersions = releaseEntries
    .filter(([, files]) => files.length > 0)
    .sort((a, b) => (releaseTimes.get(b[0]) ?? '').localeCompare(releaseTimes.get(a[0]) ?? ''))
    .map(([version]) => version)

  const time: SlimPackument['time'] = {}
  for (const version of sortedVersions) {
    const publishedAt = releaseTimes.get(version)
    if (publishedAt) time[version] = publishedAt
  }
  const publishedTimes = Object.values(time).sort()
  if (publishedTimes[0]) time.created = publishedTimes[0]
  if (publishedTimes.at(-1)) time.modified = publishedTimes.at(-1)

  const versions: SlimPackument['versions'] = {}
  for (const version of sortedVersions) {
    versions[version] = {
      version,
      tags: [],
      hasProvenance: false,
      trustLevel: 'none',
      license: info.license || undefined,
    }
  }

  const selectedFiles = releases[selectedVersion]
  const selectedFile = pickDistributionFile(selectedFiles)
  const repositoryUrl = normalizeRepositoryUrl(
    getProjectUrl(info.project_urls, ['Repository', 'Source', 'Source Code', 'Code']),
  )
  const homepage =
    getProjectUrl(info.project_urls, ['Homepage', 'Home']) || info.home_page || undefined
  const bugsUrl = getProjectUrl(info.project_urls, ['Issues', 'Tracker', 'Bug Tracker'])
  const keywords = normalizeKeywords(info.keywords)

  let requestedVersionData: SlimPackumentVersion | null = null
  if (selectedFiles?.length) {
    requestedVersionData = {
      _id: `${info.name}@${selectedVersion}`,
      _npmVersion: '',
      name: info.name,
      version: selectedVersion,
      description: info.summary || undefined,
      readme: info.description || undefined,
      keywords,
      license: info.license || undefined,
      homepage,
      repository: repositoryUrl ? { type: 'git', url: repositoryUrl } : undefined,
      bugs: bugsUrl ? { url: bugsUrl } : undefined,
      engines: info.requires_python ? { python: info.requires_python } : undefined,
      dist: {
        shasum: selectedFile?.digests?.sha256 ?? '',
        tarball: selectedFile?.url ?? '',
        fileCount: selectedFiles.length,
        unpackedSize: selectedFile?.size,
        integrity: selectedFile?.digests?.sha256
          ? `sha256-${selectedFile.digests.sha256}`
          : undefined,
        signatures: [],
      },
    } as unknown as SlimPackumentVersion
  }

  return {
    '_id': info.name,
    'name': info.name,
    'description': info.summary || undefined,
    'dist-tags': latestVersion ? { latest: latestVersion } : {},
    time,
    'author': createPerson(info.author, info.author_email),
    'maintainers': createPerson(info.maintainer, info.maintainer_email)
      ? [createPerson(info.maintainer, info.maintainer_email)!]
      : undefined,
    'license': info.license || undefined,
    homepage,
    keywords,
    'repository': repositoryUrl ? { type: 'git', url: repositoryUrl } : undefined,
    'bugs': bugsUrl ? { url: bugsUrl } : undefined,
    'requestedVersion': requestedVersionData,
    versions,
    'securityVersions': sortedVersions.map(version => ({
      version,
      time: time[version],
      hasProvenance: false,
      trustLevel: 'none',
    })),
  }
}

export const fetchPypiProject = defineCachedFunction(
  async (name: string): Promise<PypiProjectJson> => {
    return await $fetch<PypiProjectJson>(`${PYPI_JSON_API}/${encodeURIComponent(name)}/json`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'pypix.dev package page',
      },
    })
  },
  {
    maxAge: CACHE_MAX_AGE_FIVE_MINUTES,
    swr: true,
    name: 'pypi-package',
    getKey: (name: string) => name,
  },
)
