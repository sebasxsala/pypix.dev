<script setup lang="ts">
import type { LocaleObject } from '@nuxtjs/i18n'

const router = useRouter()
const { settings } = useSettings()
const selectedPythonInstaller = useSelectedPackageManager()
const { locale, locales, setLocale: setNuxti18nLocale } = useI18n()
const colorMode = useColorMode()
const { currentLocaleStatus, isSourceLocale } = useI18nStatus()
const keyboardShortcutsEnabled = useKeyboardShortcuts()
const { toggleCodeLigatures } = useCodeLigatures()

// Create a computed property to handle locale binding properly
const localeCodes = computed<LocaleObject['code'][]>(() =>
  locales.value.map(loc => loc.code as LocaleObject['code']),
)

function isLocaleCode(value: string): value is LocaleObject['code'] {
  return localeCodes.value.includes(value as LocaleObject['code'])
}

const currentLocale = computed<string>({
  get: () => locale.value as string,
  set: (newLocale: string) => {
    if (!newLocale || !isLocaleCode(newLocale)) return

    settings.value.selectedLocale = newLocale
    setNuxti18nLocale(newLocale)
  },
})

// Escape to go back (but not when focused on form elements or modal is open)
onKeyStroke(
  e =>
    keyboardShortcutsEnabled.value &&
    isKeyWithoutModifiers(e, 'Escape') &&
    !isEditableElement(e.target) &&
    !document.documentElement.matches('html:has(:modal)'),
  e => {
    e.preventDefault()
    router.back()
  },
  { dedupe: true },
)

useSeoMeta({
  title: () => `${$t('settings.title')} - pypix`,
  ogTitle: () => `${$t('settings.title')} - pypix`,
  twitterTitle: () => `${$t('settings.title')} - pypix`,
  description: () => $t('settings.meta_description'),
  ogDescription: () => $t('settings.meta_description'),
  twitterDescription: () => $t('settings.meta_description'),
})
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 w-full">
    <article class="max-w-2xl mx-auto">
      <!-- Header -->
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('settings.title') }}
          </h1>
          <BackButton />
        </div>
        <p class="text-fg-muted text-lg">
          {{ $t('settings.tagline') }}
        </p>
      </header>

      <!-- Settings sections -->
      <div class="space-y-8">
        <!-- APPEARANCE Section -->
        <section>
          <h2 class="text-xs text-fg-muted uppercase tracking-wider mb-4">
            {{ $t('settings.sections.appearance') }}
          </h2>
          <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6 space-y-6">
            <!-- Theme selector -->
            <div class="space-y-2">
              <label for="theme-select" class="block text-sm text-fg font-medium">
                {{ $t('settings.theme') }}
              </label>
              <SelectField
                id="theme-select"
                v-model="colorMode.preference"
                block
                size="sm"
                class="max-w-48"
                :items="[
                  { label: $t('settings.theme_system'), value: 'system' },
                  { label: $t('settings.theme_light'), value: 'light' },
                  { label: $t('settings.theme_dark'), value: 'dark' },
                ]"
              />
            </div>

            <!-- Accent colors -->
            <div class="space-y-3">
              <span class="block text-sm text-fg font-medium">
                {{ $t('settings.accent_colors.label') }}
              </span>
              <SettingsAccentColorPicker />
            </div>

            <!-- Background themes -->
            <div class="space-y-3">
              <span class="block text-sm text-fg font-medium">
                {{ $t('settings.background_themes.label') }}
              </span>
              <SettingsBgThemePicker />
            </div>
          </div>
        </section>

        <!-- DISPLAY Section -->
        <section>
          <h2 class="text-xs text-fg-muted uppercase tracking-wider mb-4">
            {{ $t('settings.sections.display') }}
          </h2>
          <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6">
            <!-- Relative dates toggle -->
            <SettingsToggle
              :label="$t('settings.relative_dates')"
              v-model="settings.relativeDates"
            />

            <!-- Divider -->
            <div class="border-t border-border my-4" />

            <!-- Enable weekly download graph pulse looping animation -->
            <SettingsToggle
              :label="$t('settings.enable_graph_pulse_loop')"
              :description="$t('settings.enable_graph_pulse_loop_description')"
              v-model="settings.enableGraphPulseLooping"
            />

            <!-- Divider -->
            <div class="border-t border-border my-4" />

            <!-- Code ligatures toggle -->
            <SettingsToggle
              :label="$t('settings.enable_code_ligatures')"
              :modelValue="settings.codeLigatures"
              @update:modelValue="() => toggleCodeLigatures()"
            />
          </div>
        </section>

        <!-- INSTALL COMMANDS Section -->
        <section>
          <h2 class="text-xs text-fg-muted uppercase tracking-wider mb-4">
            {{ $t('settings.sections.install_commands') }}
          </h2>
          <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6 space-y-6">
            <div class="space-y-2">
              <label for="python-installer-select" class="block text-sm text-fg font-medium">
                {{ $t('settings.python_installer') }}
              </label>
              <p class="text-xs text-fg-muted mb-3">
                {{ $t('settings.python_installer_description') }}
              </p>
              <SelectField
                id="python-installer-select"
                v-model="selectedPythonInstaller"
                block
                size="sm"
                class="max-w-48"
                :items="[
                  { label: 'uv', value: 'uv' },
                  { label: 'pip', value: 'pip' },
                  { label: 'Poetry', value: 'poetry' },
                  { label: 'Pipenv', value: 'pipenv' },
                  { label: 'Conda', value: 'conda' },
                ]"
              />
            </div>

            <div class="space-y-2">
              <label for="python-version-style-select" class="block text-sm text-fg font-medium">
                {{ $t('settings.python_version_style') }}
              </label>
              <p class="text-xs text-fg-muted mb-3">
                {{ $t('settings.python_version_style_description') }}
              </p>
              <SelectField
                id="python-version-style-select"
                v-model="settings.pythonVersionStyle"
                block
                size="sm"
                class="max-w-48"
                :items="[
                  { label: $t('settings.python_version_unpinned'), value: 'unpinned' },
                  { label: $t('settings.python_version_exact'), value: 'exact' },
                ]"
              />
            </div>
          </div>
        </section>

        <!-- PYPI FILES Section -->
        <section>
          <h2 class="text-xs text-fg-muted uppercase tracking-wider mb-4">
            {{ $t('settings.sections.pypi_files') }}
          </h2>
          <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6 space-y-2">
            <label for="pypi-file-preference-select" class="block text-sm text-fg font-medium">
              {{ $t('settings.pypi_file_preference') }}
            </label>
            <p class="text-xs text-fg-muted mb-3">
              {{ $t('settings.pypi_file_preference_description') }}
            </p>
            <SelectField
              id="pypi-file-preference-select"
              v-model="settings.pypiFilePreference"
              block
              size="sm"
              class="max-w-48"
              :items="[
                { label: $t('settings.pypi_files_all'), value: 'all' },
                { label: $t('settings.pypi_files_wheels'), value: 'wheels' },
                { label: $t('settings.pypi_files_sdist'), value: 'sdist' },
              ]"
            />
          </div>
        </section>

        <!-- SEARCH FEATURES Section -->
        <section>
          <h2 class="text-xs text-fg-muted uppercase tracking-wider mb-4">
            {{ $t('settings.sections.search') }}
          </h2>
          <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6 space-y-6">
            <div class="space-y-2">
              <label for="search-provider-select" class="block text-sm text-fg font-medium">
                {{ $t('settings.data_source.label') }}
              </label>
              <p class="text-xs text-fg-muted mb-3">
                {{ $t('settings.data_source.description') }}
              </p>
              <SelectField
                id="search-provider-select"
                v-model="settings.searchProvider"
                block
                size="sm"
                class="max-w-52"
                :items="[
                  { label: $t('settings.data_source.pypi_search'), value: 'npm' },
                  { label: $t('settings.data_source.algolia_search'), value: 'algolia' },
                ]"
              />
            </div>

            <div class="border-t border-border" />

            <!-- Instant Search toggle -->
            <SettingsToggle
              :label="$t('settings.instant_search')"
              :description="$t('settings.instant_search_description')"
              v-model="settings.instantSearch"
            />
          </div>
        </section>

        <!-- LANGUAGE Section -->
        <section>
          <h2 class="text-xs text-fg-muted uppercase tracking-wider mb-4">
            {{ $t('settings.sections.language') }}
          </h2>
          <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6 space-y-4">
            <!-- Language selector -->
            <div class="space-y-2">
              <label for="language-select" class="block text-sm text-fg font-medium">
                {{ $t('settings.language') }}
              </label>

              <ClientOnly>
                <SelectField
                  id="language-select"
                  :items="locales.map(loc => ({ label: loc.name ?? '', value: loc.code }))"
                  v-model="currentLocale"
                  block
                  size="sm"
                  class="max-w-48"
                />
                <template #fallback>
                  <SelectField
                    id="language-select"
                    disabled
                    :items="[{ label: $t('common.loading'), value: 'loading' }]"
                    block
                    size="sm"
                    class="max-w-48"
                  />
                </template>
              </ClientOnly>
            </div>

            <!-- Translation helper for non-source locales -->
            <template v-if="currentLocaleStatus && !isSourceLocale">
              <div class="border-t border-border pt-4">
                <SettingsTranslationHelper :status="currentLocaleStatus" />
              </div>
            </template>

            <!-- Simple help link for source locale -->
            <template v-else>
              <a
                href="https://github.com/sebasxsala/pypix.dev/tree/main/i18n/locales"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg transition-colors duration-200 focus-visible:outline-accent/70 rounded"
              >
                <span class="i-simple-icons:github w-4 h-4" aria-hidden="true" />
                {{ $t('settings.help_translate') }}
              </a>
            </template>
            <div>
              <LinkBase
                :to="{ name: 'translation-status' }"
                class="font-sans text-fg-muted text-sm"
              >
                <span class="i-lucide:languages w-4 h-4" aria-hidden="true" />
                {{ $t('settings.translation_status') }}
              </LinkBase>
            </div>
          </div>
        </section>

        <!-- KEYBOARD SHORTCUTS Section -->
        <section>
          <h2 class="text-xs text-fg-muted uppercase tracking-wider mb-4">
            {{ $t('settings.sections.keyboard_shortcuts') }}
          </h2>
          <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6">
            <SettingsToggle
              :label="$t('settings.keyboard_shortcuts_enabled')"
              :description="$t('settings.keyboard_shortcuts_enabled_description')"
              v-model="settings.keyboardShortcuts"
            />
          </div>
        </section>
      </div>
    </article>
  </main>
</template>
