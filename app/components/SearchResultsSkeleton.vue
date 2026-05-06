<script setup lang="ts">
import type { PaginationMode, ViewMode } from '#shared/types/preferences'

const props = withDefaults(
  defineProps<{
    viewMode?: ViewMode
    paginationMode?: PaginationMode
  }>(),
  {
    viewMode: 'table',
    paginationMode: 'paginated',
  },
)

const showTable = computed(() => props.viewMode === 'table')
const showPagination = computed(
  () => props.viewMode === 'table' || props.paginationMode === 'paginated',
)

const rowWidths = ['w-34', 'w-42', 'w-30', 'w-48', 'w-38', 'w-44', 'w-32', 'w-46', 'w-36', 'w-40']
</script>

<template>
  <div class="mb-6" aria-hidden="true">
    <div data-testid="search-skeleton-toolbar" class="space-y-4 mb-6">
      <div class="flex flex-col sm:flex-row sm:items-center gap-4">
        <SkeletonBlock class="h-5 w-36 rounded" />
        <div class="flex-1" />
        <div class="flex flex-wrap items-center gap-3">
          <SkeletonBlock class="h-10 w-40 rounded-md" />
          <SkeletonBlock class="h-10 w-32 rounded-md" />
          <div class="inline-flex rounded-md border border-border bg-bg-subtle p-0.5">
            <SkeletonBlock class="h-8 w-10 rounded-sm" />
            <SkeletonBlock class="ms-1 h-8 w-10 rounded-sm" />
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <SkeletonBlock class="h-8 w-44 rounded-md" />
        <SkeletonBlock class="h-8 w-32 rounded-md" />
        <SkeletonBlock class="h-8 w-28 rounded-md" />
      </div>
    </div>

    <div v-if="showTable" class="overflow-x-auto">
      <table class="w-full text-start">
        <thead class="border-b border-border">
          <tr>
            <th scope="col" class="w-8 py-3 px-3">
              <SkeletonBlock class="h-4 w-4 rounded-sm" />
            </th>
            <th scope="col" class="py-3 px-3">
              <SkeletonBlock class="h-4 w-16 rounded" />
            </th>
            <th scope="col" class="py-3 px-3">
              <SkeletonBlock class="h-4 w-18 rounded" />
            </th>
            <th scope="col" class="py-3 px-3">
              <SkeletonBlock class="h-4 w-30 rounded" />
            </th>
            <th scope="col" class="py-3 px-3">
              <SkeletonBlock class="ms-auto h-4 w-28 rounded" />
            </th>
            <th scope="col" class="py-3 px-3">
              <SkeletonBlock class="ms-auto h-4 w-30 rounded" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(width, index) in rowWidths"
            :key="index"
            data-testid="search-skeleton-row"
            class="border-b border-border"
          >
            <td class="py-4 px-3">
              <SkeletonBlock class="h-4 w-4 rounded-sm" />
            </td>
            <td class="py-4 px-3">
              <SkeletonBlock class="h-5 rounded" :class="width" />
            </td>
            <td class="py-4 px-3">
              <SkeletonBlock class="h-4 w-14 rounded" />
            </td>
            <td class="py-4 px-3">
              <SkeletonBlock class="h-4 w-[min(32rem,42vw)] rounded" />
            </td>
            <td class="py-4 px-3">
              <SkeletonBlock class="ms-auto h-4 w-18 rounded" />
            </td>
            <td class="py-4 px-3">
              <SkeletonBlock class="ms-auto h-4 w-24 rounded" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ol v-else class="list-none m-0 p-0">
      <li
        v-for="(width, index) in rowWidths.slice(0, 6)"
        :key="index"
        data-testid="search-skeleton-row"
        class="pb-4"
      >
        <div class="rounded-lg border border-border bg-bg-subtle p-4">
          <div class="flex items-start justify-between gap-4 mb-4">
            <SkeletonBlock class="h-5 rounded" :class="width" />
            <SkeletonBlock class="h-5 w-5 rounded-sm" />
          </div>
          <SkeletonBlock class="h-4 w-full max-w-xl rounded mb-3" />
          <SkeletonBlock class="h-4 w-3/5 rounded" />
        </div>
      </li>
    </ol>

    <div
      v-if="showPagination"
      data-testid="search-skeleton-pagination"
      class="flex flex-wrap items-center justify-between gap-4 py-4 mt-2"
    >
      <SkeletonBlock class="h-10 w-36 rounded-md" />
      <div class="flex items-center gap-3">
        <SkeletonBlock class="h-5 w-24 rounded" />
        <SkeletonBlock class="h-8 w-8 rounded" />
        <SkeletonBlock class="h-8 w-8 rounded" />
        <SkeletonBlock class="h-8 w-8 rounded" />
      </div>
    </div>
  </div>
</template>
