<script setup lang="ts">
import {
  createTrustedPublishingWorkflow,
  getPyPIAccountPublishingUrl,
  getPyPIOrganizationsUrl,
  getPyPIProjectsUrl,
  getTrustedPublishingDocsUrl,
  getTrustedPublishingExistingProjectDocsUrl,
  getTrustedPublishingPendingProjectDocsUrl,
} from '~/utils/pypi-admin'

const { t } = useI18n()
const { copied, copy } = useClipboard({ copiedDuring: 2000 })

const workflow = createTrustedPublishingWorkflow({ environment: 'pypi' })
</script>

<template>
  <main class="container mx-auto px-4 py-8 max-w-4xl">
    <header class="mb-8">
      <h1 class="font-mono text-2xl text-fg">
        {{ t('pypi_admin.guide.title') }}
      </h1>
      <p class="mt-3 text-sm text-fg-muted max-w-2xl">
        {{ t('pypi_admin.guide.subtitle') }}
      </p>
    </header>

    <section class="mb-8">
      <h2 class="font-mono text-lg text-fg">
        {{ t('pypi_admin.guide.trusted_publishing') }}
      </h2>
      <p class="mt-2 text-sm text-fg-muted max-w-2xl">
        {{ t('pypi_admin.guide.trusted_publishing_body') }}
      </p>
    </section>

    <section class="mb-8">
      <h2 class="font-mono text-lg text-fg">
        {{ t('pypi_admin.guide.official_actions') }}
      </h2>
      <div class="mt-4 grid gap-2 sm:grid-cols-2">
        <LinkBase
          :to="getPyPIProjectsUrl()"
          class="p-3 rounded border border-border hover:bg-bg-subtle"
        >
          {{ t('pypi_admin.actions.manage_projects') }}
        </LinkBase>
        <LinkBase
          :to="getPyPIAccountPublishingUrl()"
          class="p-3 rounded border border-border hover:bg-bg-subtle"
        >
          {{ t('pypi_admin.actions.pending_publisher') }}
        </LinkBase>
        <LinkBase
          :to="getPyPIOrganizationsUrl()"
          class="p-3 rounded border border-border hover:bg-bg-subtle"
        >
          {{ t('pypi_admin.actions.organizations') }}
        </LinkBase>
        <LinkBase
          :to="getTrustedPublishingDocsUrl()"
          class="p-3 rounded border border-border hover:bg-bg-subtle"
        >
          {{ t('pypi_admin.actions.trusted_publisher') }}
        </LinkBase>
        <LinkBase
          :to="getTrustedPublishingExistingProjectDocsUrl()"
          class="p-3 rounded border border-border hover:bg-bg-subtle"
        >
          Existing project docs
        </LinkBase>
        <LinkBase
          :to="getTrustedPublishingPendingProjectDocsUrl()"
          class="p-3 rounded border border-border hover:bg-bg-subtle"
        >
          Pending project docs
        </LinkBase>
      </div>
    </section>

    <section>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-mono text-lg text-fg">
            {{ t('pypi_admin.guide.github_workflow') }}
          </h2>
          <p class="mt-1 text-sm text-fg-muted">
            {{ t('pypi_admin.guide.no_tokens') }}
          </p>
        </div>
        <ButtonBase type="button" @click="copy(workflow)">
          {{ copied ? t('pypi_admin.guide.copied') : t('pypi_admin.guide.copy_workflow') }}
        </ButtonBase>
      </div>
      <pre
        class="mt-4 overflow-auto rounded border border-border bg-bg-subtle p-4 text-xs"
      ><code>{{ workflow }}</code></pre>
    </section>
  </main>
</template>
