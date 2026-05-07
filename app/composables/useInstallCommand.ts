/**
 * Composable for generating PyPI install commands with support for
 * multiple Python installers and optional exact version pins.
 */
export function useInstallCommand(
  packageName: MaybeRefOrGetter<string | null>,
  requestedVersion: MaybeRefOrGetter<string | null>,
  _jsrInfo: MaybeRefOrGetter<unknown | null>,
  typesPackageName: MaybeRefOrGetter<string | null>,
  installVersionOverride?: MaybeRefOrGetter<string | null>,
) {
  const selectedPM = useSelectedPackageManager()
  const { settings } = useSettings()

  // @types packages are npm-only. Keep the return shape for callers during migration.
  const showTypesInInstall = computed(() => {
    void toValue(typesPackageName)
    return false
  })

  const installVersion = computed(() => {
    const override = toValue(installVersionOverride)
    if (override) return override
    if (settings.value.pythonVersionStyle === 'exact') return toValue(requestedVersion)
    return null
  })

  const installCommandParts = computed(() => {
    const name = toValue(packageName)
    if (!name) return []
    return getInstallCommandParts({
      packageName: name,
      packageManager: selectedPM.value,
      version: installVersion.value,
      versionStyle: installVersion.value ? 'exact' : 'unpinned',
    })
  })

  const installCommand = computed(() => {
    const name = toValue(packageName)
    if (!name) return ''
    return getInstallCommand({
      packageName: name,
      packageManager: selectedPM.value,
      version: installVersion.value,
      versionStyle: installVersion.value ? 'exact' : 'unpinned',
    })
  })

  const typesInstallCommandParts = computed(() => {
    void selectedPM.value
    void toValue(typesPackageName)
    return []
  })

  const fullInstallCommand = computed(() => {
    return installCommand.value
  })

  // Copy state
  const { copied, copy } = useClipboard({ copiedDuring: 2000 })

  async function copyInstallCommand() {
    if (!fullInstallCommand.value) return
    await copy(fullInstallCommand.value)
  }

  return {
    selectedPM,
    installCommandParts,
    installCommand,
    typesInstallCommandParts,
    fullInstallCommand,
    showTypesInInstall,
    copied,
    copyInstallCommand,
  }
}
