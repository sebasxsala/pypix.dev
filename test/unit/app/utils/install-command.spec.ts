import { describe, expect, it } from 'vitest'
import {
  getInstallCommand,
  getInstallCommandParts,
  getPackageSpecifier,
  packageManagers,
} from '~/utils/install-command'

describe('Python install command generation', () => {
  it('exposes only Python package installers', () => {
    expect(packageManagers.map(pm => pm.id)).toEqual(['uv', 'pip', 'poetry', 'pipenv', 'conda'])
  })

  it.each([
    ['uv', 'uv add requests', ['uv', 'add', 'requests']],
    ['pip', 'python -m pip install requests', ['python', '-m', 'pip', 'install', 'requests']],
    ['poetry', 'poetry add requests', ['poetry', 'add', 'requests']],
    ['pipenv', 'pipenv install requests', ['pipenv', 'install', 'requests']],
    ['conda', 'conda install requests', ['conda', 'install', 'requests']],
  ] as const)('%s installs an unpinned package', (packageManager, command, parts) => {
    const options = { packageName: 'requests', packageManager }

    expect(getPackageSpecifier(options)).toBe('requests')
    expect(getInstallCommand(options)).toBe(command)
    expect(getInstallCommandParts(options)).toEqual(parts)
  })

  it.each([
    ['uv', 'uv add requests==2.32.0'],
    ['pip', 'python -m pip install requests==2.32.0'],
    ['poetry', 'poetry add requests==2.32.0'],
    ['pipenv', 'pipenv install requests==2.32.0'],
    ['conda', 'conda install requests==2.32.0'],
  ] as const)('%s installs an exact version when requested', (packageManager, command) => {
    expect(
      getInstallCommand({
        packageName: 'requests',
        packageManager,
        version: '2.32.0',
        versionStyle: 'exact',
      }),
    ).toBe(command)
  })

  it('ignores a version when the command style is unpinned', () => {
    expect(
      getInstallCommand({
        packageName: 'requests',
        packageManager: 'uv',
        version: '2.32.0',
        versionStyle: 'unpinned',
      }),
    ).toBe('uv add requests')
  })

  it('returns empty parts for invalid package managers', () => {
    expect(
      getInstallCommandParts({
        packageName: 'requests',
        packageManager: 'npm' as any,
      }),
    ).toEqual([])
  })
})
