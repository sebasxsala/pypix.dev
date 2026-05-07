import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('useSettings - PyPI settings', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('defaults to Python-first install and file preferences', async () => {
    const { useSettings } = await import('~/composables/useSettings')
    const { settings } = useSettings()

    expect(settings.value.pythonInstaller).toBe('uv')
    expect(settings.value.pythonVersionStyle).toBe('unpinned')
    expect(settings.value.pypiFilePreference).toBe('all')
  })

  it('keeps legacy npm settings available for stored preferences compatibility', async () => {
    const { useSettings } = await import('~/composables/useSettings')
    const { settings } = useSettings()

    expect(settings.value.includeTypesInInstall).toBe(true)
    expect(settings.value.hidePlatformPackages).toBe(true)
    expect(settings.value.searchProvider).toBe('npm')
  })
})

describe('useSettings - keyboardShortcuts', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('default value', () => {
    it('should default keyboardShortcuts to true', async () => {
      const { useSettings } = await import('~/composables/useSettings')
      const { settings } = useSettings()
      expect(settings.value.keyboardShortcuts).toBe(true)
    })
  })

  describe('useKeyboardShortcuts composable', () => {
    it('should return true by default', async () => {
      const { useKeyboardShortcuts } = await import('~/composables/useSettings')
      const enabled = useKeyboardShortcuts()
      expect(enabled.value).toBe(true)
    })

    it('should reflect changes made via settings', async () => {
      const { useSettings } = await import('~/composables/useSettings')
      const { useKeyboardShortcuts } = await import('~/composables/useSettings')
      const { settings } = useSettings()
      const enabled = useKeyboardShortcuts()

      settings.value.keyboardShortcuts = false
      expect(enabled.value).toBe(false)

      settings.value.keyboardShortcuts = true
      expect(enabled.value).toBe(true)
    })

    it('should be reactive', async () => {
      const { useSettings } = await import('~/composables/useSettings')
      const { useKeyboardShortcuts } = await import('~/composables/useSettings')
      const { settings } = useSettings()
      const enabled = useKeyboardShortcuts()

      expect(enabled.value).toBe(true)

      settings.value.keyboardShortcuts = false
      expect(enabled.value).toBe(false)
    })
  })
})

describe('useSettings - codeLigatures', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('has a default value of true', async () => {
    const { useSettings } = await import('~/composables/useSettings')
    const codeLigatures = useSettings().settings.value.codeLigatures
    expect(codeLigatures).toBe(true)
  })

  describe('useCodeLigatures', () => {
    it('has a default value of true', async () => {
      const { useCodeLigatures } = await import('~/composables/useSettings')
      const codeLigatures = useCodeLigatures().codeLigatures
      expect(codeLigatures.value).toBe(true)
    })

    it('updates after toggle', async () => {
      const { useCodeLigatures } = await import('~/composables/useSettings')
      const { codeLigatures, toggleCodeLigatures } = useCodeLigatures()
      expect(codeLigatures.value).toBe(true)
      toggleCodeLigatures()
      expect(codeLigatures.value).toBe(false)
    })
  })
})
