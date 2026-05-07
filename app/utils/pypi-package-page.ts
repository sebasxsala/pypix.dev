import type { SlimPackument } from '#shared/types/npm-registry'
import { getInstallCommand, type PackageManagerId } from '~/utils/install-command'

export function buildPackagePageInstallCommand(options: {
  packageName: string
  packageManager: PackageManagerId
  version?: string | null
}): string {
  return getInstallCommand({
    packageName: options.packageName,
    packageManager: options.packageManager,
    version: options.version ?? null,
    versionStyle: options.version ? 'exact' : 'unpinned',
  })
}

export function resolvePackagePageVersion(
  pkg: SlimPackument | null | undefined,
  requestedVersion: string | null | undefined,
): string | null {
  if (!pkg) return null

  if (!requestedVersion || requestedVersion === 'latest') {
    return pkg['dist-tags']?.latest ?? null
  }

  return pkg.requestedVersion?.version ?? null
}
