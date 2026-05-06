import type { PypiProjectJson } from '#server/utils/pypi-package'

export interface PypiTimelineOptions {
  offset: number
  limit: number
}

export interface PypiTimelineVersion {
  version: string
  time: string
  license?: string
  tags: string[]
  yanked?: boolean
  yankedReason?: string
}

export interface PypiTimelineResponse {
  versions: PypiTimelineVersion[]
  total: number
}

function getUploadTime(
  files: NonNullable<PypiProjectJson['releases']>[string],
): string | undefined {
  return files
    .map(file => file.upload_time_iso_8601 ?? file.upload_time)
    .filter(Boolean)
    .sort()
    .at(-1)
}

function getReleaseYankedReason(
  files: NonNullable<PypiProjectJson['releases']>[string],
): string | undefined {
  const yankedFile = files.find(file => file.yanked)
  if (!yankedFile) return undefined
  return yankedFile.yanked_reason?.trim() || 'Yanked release'
}

export function buildPypiTimeline(
  project: PypiProjectJson,
  options: PypiTimelineOptions,
): PypiTimelineResponse {
  const latestVersion = project.info.version
  const allVersions: PypiTimelineVersion[] = Object.entries(project.releases ?? {})
    .flatMap(([version, files]) => {
      const time = getUploadTime(files)
      if (!time) return []
      const entry: PypiTimelineVersion = {
        version,
        time,
        tags: version === latestVersion ? ['latest'] : [],
      }
      const yankedReason = getReleaseYankedReason(files)
      if (yankedReason) {
        entry.yanked = true
        entry.yankedReason = yankedReason
      }
      if (project.info.license) entry.license = project.info.license
      return [entry]
    })
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))

  return {
    versions: allVersions.slice(options.offset, options.offset + options.limit),
    total: allVersions.length,
  }
}
