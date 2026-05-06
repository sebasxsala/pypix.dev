<template>
  <div
    class="w-full container flex-1 min-h-0 overflow-hidden grid grid-cols-[18rem_1fr] max-lg:grid-cols-[16rem_1fr] max-md:grid-cols-[1fr] border-border border-x px-0 mx-auto"
    role="status"
    aria-busy="true"
    :aria-label="$t('code.loading_tree')"
    dir="ltr"
  >
    <aside
      class="w-64 lg:w-72 hidden md:block h-full min-h-0 shrink-0 self-start bg-bg-subtle border-ie border-border overflow-hidden"
    >
      <div class="h-full overflow-y-hidden p-4 space-y-3">
        <div v-for="n in 13" :key="n" class="flex items-center gap-3" :class="{ 'ps-5': n % 4 }">
          <SkeletonInline class="h-4 w-4 rounded-sm shrink-0" />
          <SkeletonBlock class="h-4 rounded-sm" :class="n % 3 === 0 ? 'w-22' : 'w-30'" />
        </div>
      </div>
    </aside>

    <section class="min-w-0 min-h-0 flex flex-col overflow-hidden">
      <div
        class="sticky top-25 z-1 h-13 bg-bg-subtle border-b border-border px-4 flex items-center justify-between gap-4"
      >
        <div class="flex items-center gap-3 min-w-0">
          <SkeletonInline class="md:hidden h-8 w-8 rounded" />
          <SkeletonInline class="h-4 w-4 rounded-sm" />
          <SkeletonBlock class="h-5 w-40 max-sm:w-28 rounded-sm" />
        </div>
        <div class="flex items-center gap-2">
          <SkeletonInline v-for="n in 3" :key="n" class="h-8 w-8 rounded" />
        </div>
      </div>

      <div class="border-b border-border shrink-0">
        <div
          v-for="n in 8"
          :key="n"
          class="h-12 px-4 flex items-center gap-3 border-b border-border last:border-b-0"
        >
          <SkeletonInline class="h-4 w-4 rounded-sm shrink-0" />
          <SkeletonBlock class="h-5 rounded-sm" :class="n % 3 === 0 ? 'w-34' : 'w-48'" />
          <SkeletonInline class="ms-auto h-4 w-12 rounded-sm" />
        </div>
      </div>

      <CodeSkeletonLoader class="flex-1 min-h-0" />
    </section>
  </div>
</template>
