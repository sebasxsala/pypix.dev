<script setup lang="ts">
import type { Role } from '#server/api/contributors.get'

useSeoMeta({
  title: () => `${$t('about.title')} - pypix`,
  ogTitle: () => `${$t('about.title')} - pypix`,
  twitterTitle: () => `${$t('about.title')} - pypix`,
  description: () => $t('about.meta_description'),
  ogDescription: () => $t('about.meta_description'),
  twitterDescription: () => $t('about.meta_description'),
})

defineOgImage(
  'Page.takumi',
  {
    title: () => `${$t('about.title')}`,
    description: 'a fast, modern browser for the PyPI registry',
  },
  { alt: () => `${$t('about.title')} - pypix` },
)

const pmLinks = {
  pip: 'https://pip.pypa.io/',
  uv: 'https://docs.astral.sh/uv/',
  poetry: 'https://python-poetry.org/',
  pdm: 'https://pdm-project.org/',
  pipenv: 'https://pipenv.pypa.io/',
  conda: 'https://docs.conda.io/',
  pixi: 'https://pixi.sh/',
}

const governanceMembers = [
  {
    name: 'Sebastian',
    login: 'sebasxsala',
    id: 166746975,
    avatar_url: 'https://avatars.githubusercontent.com/sebasxsala?s=160',
    html_url: 'https://github.com/sebasxsala',
    role: 'steward' as Role,
    sponsors_url: null,
  },
]
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('about.heading') }}
          </h1>
          <BackButton />
        </div>
        <p class="text-fg-muted text-lg">
          {{ $t('tagline') }}
        </p>
      </header>

      <section class="max-w-none space-y-12">
        <div>
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('about.what_we_are.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            <i18n-t keypath="about.what_we_are.description" tag="span" scope="global">
              <template #betterUxDx>
                <strong class="text-fg">{{ $t('about.what_we_are.better_ux_dx') }}</strong>
              </template>
              <template #jsr>
                <LinkBase to="https://jsr.io/" no-new-tab-icon>JSR</LinkBase>
              </template>
            </i18n-t>
          </p>
          <p class="text-fg-muted leading-relaxed">
            <i18n-t keypath="about.what_we_are.admin_description" tag="span" scope="global">
              <template #adminUi>
                <strong class="text-fg">{{ $t('about.what_we_are.admin_ui') }}</strong>
              </template>
            </i18n-t>
          </p>
        </div>

        <div>
          <h2 class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('about.what_we_are_not.title') }}
          </h2>
          <ul class="space-y-3 text-fg-muted list-none p-0">
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>
                <strong class="text-fg">{{
                  $t('about.what_we_are_not.not_package_manager')
                }}</strong>
                {{ ' ' }}
                <i18n-t
                  keypath="about.what_we_are_not.package_managers_exist"
                  tag="span"
                  scope="global"
                >
                  <template #already>
                    <LinkBase :to="pmLinks.pip" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.already')
                    }}</LinkBase>
                  </template>
                  <template #people>
                    <LinkBase :to="pmLinks.uv" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.people')
                    }}</LinkBase>
                  </template>
                  <template #building>
                    <LinkBase :to="pmLinks.poetry" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.building')
                    }}</LinkBase>
                  </template>
                  <template #really>
                    <LinkBase :to="pmLinks.pdm" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.really')
                    }}</LinkBase>
                  </template>
                  <template #cool>
                    <LinkBase :to="pmLinks.pipenv" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.cool')
                    }}</LinkBase>
                  </template>
                  <template #package>
                    <LinkBase :to="pmLinks.conda" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.package')
                    }}</LinkBase>
                  </template>
                  <template #managers>
                    <LinkBase :to="pmLinks.pixi" class="font-sans" no-new-tab-icon>{{
                      $t('about.what_we_are_not.words.managers')
                    }}</LinkBase>
                  </template>
                </i18n-t>
              </span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>
                <strong class="text-fg">{{ $t('about.what_we_are_not.not_registry') }}</strong>
                {{ $t('about.what_we_are_not.registry_description') }}
              </span>
            </li>
          </ul>
        </div>

        <div>
          <h2 class="text-lg uppercase tracking-wider mb-4">
            {{ $t('about.team.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-6">
            {{ $t('about.contributors.description') }}
          </p>

          <!-- Governance: stewards + maintainers -->
          <section class="mb-12" aria-labelledby="governance-heading">
            <h3 id="governance-heading" class="text-sm text-fg uppercase tracking-wider mb-4">
              {{ $t('about.team.governance') }}
            </h3>

            <ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 list-none p-0">
              <li
                v-for="person in governanceMembers"
                :key="person.id"
                class="relative flex items-center gap-3 p-3 border border-border rounded-lg hover:border-border-hover hover:bg-bg-muted transition-[border-color,background-color] duration-200 cursor-pointer focus-within:ring-2 focus-within:ring-offset-bg focus-within:ring-offset-2 focus-within:ring-fg/50"
              >
                <img
                  :src="person.avatar_url"
                  :alt="`${person.login}'s avatar`"
                  class="w-12 h-12 rounded-md ring-1 ring-border shrink-0"
                  loading="lazy"
                />
                <div class="min-w-0 flex-1">
                  <div class="text-sm text-fg truncate">
                    <NuxtLink
                      :to="person.html_url"
                      target="_blank"
                      class="decoration-none after:content-[''] after:absolute after:inset-0"
                      :aria-label="$t('about.contributors.view_profile', { name: person.login })"
                    >
                      @{{ person.login }}
                    </NuxtLink>
                  </div>
                  <div class="text-xs text-fg-muted tracking-tight">
                    {{ person.name }}
                  </div>
                  <LinkBase
                    v-if="person.sponsors_url"
                    :to="person.sponsors_url"
                    no-underline
                    no-external-icon
                    classicon="i-lucide:heart"
                    class="relative z-10 text-xs text-fg-muted hover:text-pink-400 mt-0.5"
                    :aria-label="$t('about.team.sponsor_aria', { name: person.login })"
                  >
                    {{ $t('about.team.sponsor') }}
                  </LinkBase>
                </div>
                <span
                  class="i-lucide:external-link rtl-flip w-3.5 h-3.5 text-fg-muted opacity-50 shrink-0 self-start mt-0.5 pointer-events-none"
                  aria-hidden="true"
                />
              </li>
            </ul>
          </section>
        </div>

        <CallToAction />
      </section>
    </article>
  </main>
</template>
