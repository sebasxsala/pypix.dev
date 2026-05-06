<script setup lang="ts">
useSeoMeta({
  title: () => `${$t('pds.title')} - pypix`,
  ogTitle: () => `${$t('pds.title')} - pypix`,
  twitterTitle: () => `${$t('pds.title')} - pypix`,
  description: () => $t('pds.meta_description'),
  ogDescription: () => $t('pds.meta_description'),
  twitterDescription: () => $t('pds.meta_description'),
})

defineOgImage(
  'Page.takumi',
  {
    title: 'pypix.social',
    description: 'A planned AT Protocol identity space for pypix.',
  },
  { alt: 'pypix.social - planned AT Protocol identity space for pypix' },
)
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('pds.title') }}
          </h1>
          <BackButton />
        </div>
        <p class="text-fg-muted text-lg">
          {{ $t('pds.meta_description') }}
        </p>
      </header>

      <section class="max-w-none space-y-12">
        <div>
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('pds.status.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            {{ $t('pds.status.description') }}
          </p>
          <p class="text-fg-muted leading-relaxed">
            {{ $t('pds.status.future') }}
          </p>
        </div>

        <div>
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('pds.moover.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            {{ $t('pds.moover.description') }}
          </p>
          <p class="text-fg-muted leading-relaxed">
            {{ $t('pds.moover.note') }}
          </p>
        </div>
      </section>
    </article>
  </main>
</template>
