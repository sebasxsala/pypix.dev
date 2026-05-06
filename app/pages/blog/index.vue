<script setup lang="ts">
definePageMeta({
  name: 'blog',
})

useSeoMeta({
  title: () => `${$t('blog.title')} - pypix`,
  ogTitle: () => `${$t('blog.title')} - pypix`,
  twitterTitle: () => `${$t('blog.title')} - pypix`,
  description: () => $t('blog.meta_description'),
  ogDescription: () => $t('blog.meta_description'),
  twitterDescription: () => $t('blog.meta_description'),
})
</script>

<template>
  <main class="container w-full flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <h1 class="font-mono text-3xl sm:text-4xl font-medium">
          {{ $t('blog.heading') }}
        </h1>
        <p class="text-fg-muted text-lg">
          {{ $t('tagline') }}
        </p>
      </header>
      <div class="border border-border rounded-lg bg-bg-subtle p-8 text-center">
        <p class="font-mono text-lg text-fg mb-2">{{ $t('blog.empty_title') }}</p>
        <p class="text-fg-subtle">{{ $t('blog.no_posts') }}</p>
      </div>
    </article>
  </main>
</template>
