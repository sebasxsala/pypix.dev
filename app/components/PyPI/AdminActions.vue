<script setup lang="ts">
import {
  getPublishingGuidePath,
  getPyPIProjectManageUrl,
  getPyPIProjectsUrl,
} from '~/utils/pypi-admin'

const props = defineProps<{
  packageName?: string | null
  variant?: 'menu' | 'contextual'
}>()

const { t } = useI18n()

const projectName = computed(() => props.packageName?.trim() || null)
const variant = computed(() => props.variant ?? 'menu')

const actions = computed(() => {
  if (variant.value === 'contextual' && projectName.value) {
    return [
      {
        id: 'manage-project',
        label: t('pypi_admin.actions.manage_project'),
        description: t('pypi_admin.descriptions.manage_project'),
        icon: 'i-lucide:settings',
        href: getPyPIProjectManageUrl(projectName.value),
      },
      {
        id: 'publishing-guide',
        label: t('pypi_admin.actions.publishing_guide'),
        description: t('pypi_admin.descriptions.publishing_guide'),
        icon: 'i-lucide:book-open',
        to: getPublishingGuidePath(),
      },
    ]
  }

  return [
    {
      id: 'manage-projects',
      label: t('pypi_admin.actions.manage_projects'),
      description: t('pypi_admin.descriptions.manage_projects'),
      icon: 'i-simple-icons:pypi',
      href: getPyPIProjectsUrl(),
    },
    {
      id: 'publishing-guide',
      label: t('pypi_admin.actions.publishing_guide'),
      description: t('pypi_admin.descriptions.publishing_guide'),
      icon: 'i-lucide:book-open',
      to: getPublishingGuidePath(),
    },
  ]
})
</script>

<template>
  <div class="py-1">
    <LinkBase
      v-for="action in actions"
      :key="action.id"
      :to="'to' in action ? action.to : action.href"
      role="menuitem"
      no-underline
      class="w-full flex items-center gap-x-3 px-3 py-2 rounded-md hover:bg-bg-muted transition-colors duration-200"
    >
      <span class="w-8 h-8 rounded-full bg-bg-muted flex items-center justify-center">
        <span :class="action.icon" class="w-4 h-4 text-fg-muted" aria-hidden="true" />
      </span>
      <span class="flex-1 min-w-0">
        <span class="font-mono text-sm text-fg block">{{ action.label }}</span>
        <span class="text-xs text-fg-subtle">{{ action.description }}</span>
      </span>
    </LinkBase>
  </div>
</template>
