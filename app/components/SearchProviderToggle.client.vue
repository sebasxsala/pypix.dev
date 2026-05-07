<template>
  <div class="relative">
    <div
      class="inline-flex items-center gap-2 h-8 px-2.5 rounded-md text-xs text-fg-muted bg-bg-subtle border border-border-subtle"
      :aria-label="$t('settings.pypi_search_provider')"
    >
      <span class="i-simple-icons:pypi w-4 h-4 text-accent" aria-hidden="true" />
      <span>{{ $t('settings.pypi_search_provider') }}</span>
    </div>
  </div>
</template>
