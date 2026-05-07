import type { SlimPackument } from '#shared/types/npm-registry'
import { describe, expect, it } from 'vitest'
import {
  buildPackagePageInstallCommand,
  resolvePackagePageVersion,
} from '~/utils/pypi-package-page'

describe('resolvePackagePageVersion', () => {
  const pkg = {
    'dist-tags': { latest: '2.0.0' },
    'requestedVersion': { version: '1.5.0' },
  } as SlimPackument

  it('uses the package payload to resolve the latest version without a version API request', () => {
    expect(resolvePackagePageVersion(pkg, null)).toBe('2.0.0')
    expect(resolvePackagePageVersion(pkg, 'latest')).toBe('2.0.0')
  })

  it('uses requestedVersion from the package payload for concrete versions', () => {
    expect(resolvePackagePageVersion(pkg, '1.5.0')).toBe('1.5.0')
  })

  it('returns null when a requested concrete version is missing from the package payload', () => {
    expect(
      resolvePackagePageVersion(
        {
          'dist-tags': { latest: '2.0.0' },
          'requestedVersion': null,
        } as SlimPackument,
        '9.9.9',
      ),
    ).toBeNull()
  })
})

describe('buildPackagePageInstallCommand', () => {
  it('uses the selected Python installer for unpinned package commands', () => {
    expect(
      buildPackagePageInstallCommand({
        packageName: 'requests',
        packageManager: 'uv',
        version: null,
      }),
    ).toBe('uv add requests')
  })

  it('uses the selected Python installer for exact version package commands', () => {
    expect(
      buildPackagePageInstallCommand({
        packageName: 'requests',
        packageManager: 'poetry',
        version: '2.32.0',
      }),
    ).toBe('poetry add requests==2.32.0')
  })
})
