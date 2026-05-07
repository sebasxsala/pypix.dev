import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useInstallCommand', () => {
  beforeEach(() => {
    localStorage.clear()
    const pm = useSelectedPackageManager()
    pm.value = 'uv'
    const { settings } = useSettings()
    settings.value.pythonInstaller = 'uv'
    settings.value.pythonVersionStyle = 'unpinned'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('generates an unpinned uv command by default', () => {
    const { installCommand, installCommandParts, selectedPM } = useInstallCommand(
      'requests',
      '2.32.0',
      null,
      null,
    )

    expect(selectedPM.value).toBe('uv')
    expect(installCommand.value).toBe('uv add requests')
    expect(installCommandParts.value).toEqual(['uv', 'add', 'requests'])
  })

  it.each([
    ['pip', 'python -m pip install requests', ['python', '-m', 'pip', 'install', 'requests']],
    ['poetry', 'poetry add requests', ['poetry', 'add', 'requests']],
    ['pipenv', 'pipenv install requests', ['pipenv', 'install', 'requests']],
    ['conda', 'conda install requests', ['conda', 'install', 'requests']],
  ] as const)('uses %s when selected', (packageManager, command, parts) => {
    const { installCommand, installCommandParts, selectedPM } = useInstallCommand(
      'requests',
      null,
      null,
      null,
    )

    selectedPM.value = packageManager

    expect(installCommand.value).toBe(command)
    expect(installCommandParts.value).toEqual(parts)
  })

  it('pins versions with == when exact version style is enabled', () => {
    const { settings } = useSettings()
    settings.value.pythonVersionStyle = 'exact'

    const { installCommand, installCommandParts } = useInstallCommand(
      'requests',
      '2.32.0',
      null,
      null,
    )

    expect(installCommand.value).toBe('uv add requests==2.32.0')
    expect(installCommandParts.value).toEqual(['uv', 'add', 'requests==2.32.0'])
  })

  it('always pins installVersionOverride for security-directed installs', () => {
    const requestedVersion = shallowRef<string | null>(null)
    const installVersionOverride = shallowRef<string | null>('2.31.0')

    const { installCommand } = useInstallCommand(
      'requests',
      requestedVersion,
      null,
      null,
      installVersionOverride,
    )

    expect(installCommand.value).toBe('uv add requests==2.31.0')

    installVersionOverride.value = null
    requestedVersion.value = '2.32.0'
    expect(installCommand.value).toBe('uv add requests')
  })

  it('does not expose @types commands for PyPI packages', () => {
    const { fullInstallCommand, showTypesInInstall, typesInstallCommandParts } = useInstallCommand(
      'requests',
      null,
      null,
      '@types/requests',
    )

    expect(showTypesInInstall.value).toBe(false)
    expect(typesInstallCommandParts.value).toEqual([])
    expect(fullInstallCommand.value).toBe('uv add requests')
  })

  it('reacts to package and version refs', () => {
    const { settings } = useSettings()
    settings.value.pythonVersionStyle = 'exact'
    const packageName = shallowRef<string | null>('requests')
    const version = shallowRef<string | null>(null)

    const { installCommand } = useInstallCommand(packageName, version, null, null)

    expect(installCommand.value).toBe('uv add requests')

    packageName.value = 'fastapi'
    expect(installCommand.value).toBe('uv add fastapi')

    version.value = '0.115.0'
    expect(installCommand.value).toBe('uv add fastapi==0.115.0')
  })

  it('copies the Python install command', async () => {
    vi.useFakeTimers()

    const { copyInstallCommand, copied, fullInstallCommand } = useInstallCommand(
      'requests',
      null,
      null,
      null,
    )

    expect(fullInstallCommand.value).toBe('uv add requests')
    expect(copied.value).toBe(false)

    await copyInstallCommand()

    expect(copied.value).toBe(true)

    await vi.advanceTimersByTimeAsync(2100)
    expect(copied.value).toBe(false)

    vi.useRealTimers()
  })
})
