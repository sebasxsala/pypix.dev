<template>
  <div role="status" aria-busy="true" :aria-label="$t('common.loading')">
    <ol class="relative border-s border-border ms-4">
      <li v-for="n in 15" :key="n" class="mb-6 ms-6">
        <SkeletonInline
          class="absolute -start-2 w-4 h-4 rounded-full border border-border"
          :class="n === 1 ? 'bg-accent/70' : 'bg-bg-subtle'"
        />
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <SkeletonBlock class="h-5 rounded-sm" :class="n % 4 === 0 ? 'w-30' : 'w-18'" />
          <SkeletonInline v-if="n === 1 || n % 5 === 0" class="h-3 w-12 rounded-sm" />
          <SkeletonInline class="h-4 rounded-sm" :class="n % 3 === 0 ? 'w-22' : 'w-18'" />
        </div>
        <div v-if="n % 6 === 0" class="mt-3 flex items-center gap-2">
          <SkeletonInline class="h-4 w-4 rounded-full" />
          <SkeletonBlock class="h-4 w-54 max-sm:w-40 rounded-sm" />
        </div>
      </li>
    </ol>
  </div>
</template>
