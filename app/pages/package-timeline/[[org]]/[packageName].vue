<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { PypiTimelineResponse, PypiTimelineVersion } from '~~/server/utils/pypi-timeline'

definePageMeta({
  name: 'timeline',
  path: '/package-timeline/:org?/:packageName/v/:version',
})

const route = useRoute('timeline')

const packageName = computed(() =>
  route.params.org ? `${route.params.org}/${route.params.packageName}` : route.params.packageName,
)
const version = computed(() => route.params.version)

const { data: pkg } = usePackage(packageName, version)

const latestVersion = computed(() => {
  if (!pkg.value) return null
  const latestTag = pkg.value['dist-tags']?.latest
  if (!latestTag) return null
  return pkg.value.versions[latestTag] ?? null
})

const versionUrlPattern = computed(() => {
  const { org, packageName: name } = route.params
  return `/package-timeline/${org ? `${org}/` : ''}${name}/v/{version}`
})

function packageRoute(ver: string): RouteLocationRaw {
  return {
    name: 'package-version',
    params: { org: route.params.org, name: route.params.packageName, version: ver },
  }
}

// Paginated timeline data from server
const PAGE_SIZE = 25

const timelineEntries = ref<PypiTimelineVersion[]>([])
const totalVersions = ref(0)
const loadingMore = ref(false)
const loadError = ref(false)

const hasMore = computed(() => timelineEntries.value.length < totalVersions.value)

async function fetchTimeline(offset: number): Promise<PypiTimelineResponse> {
  return $fetch<PypiTimelineResponse>(`/api/pypi/timeline/${packageName.value}`, {
    query: { offset, limit: PAGE_SIZE },
  })
}

// Initial load - useAsyncData serializes the full response across SSR to client
const initialLoadError = ref(false)

const {
  data: initialTimeline,
  status: initialTimelineStatus,
  error: initialTimelineError,
} = await useAsyncData(`timeline:${packageName.value}`, () => fetchTimeline(0), {
  watch: [packageName],
})

watch(
  initialTimeline,
  data => {
    initialLoadError.value = false
    if (data) {
      timelineEntries.value = data.versions
      totalVersions.value = data.total
    } else {
      initialLoadError.value = true
    }
  },
  { immediate: true },
)

async function loadMore() {
  if (loadingMore.value) return
  loadingMore.value = true
  loadError.value = false
  try {
    const offset = timelineEntries.value.length
    const data = await fetchTimeline(offset)
    timelineEntries.value = [...timelineEntries.value, ...data.versions]
    totalVersions.value = data.total
  } catch {
    loadError.value = true
  } finally {
    loadingMore.value = false
  }
}

interface SubEvent {
  key: string
  positive: boolean
  icon: string
  text: string
}

const versionSubEvents = computed<Map<string, SubEvent[]>>(() => new Map())

useSeoMeta({
  title: () => `Timeline - ${packageName.value} - npmx`,
  description: () => `Version timeline for ${packageName.value}`,
})
</script>

<template>
  <main class="flex-1 flex flex-col min-h-0">
    <PackageHeader
      :pkg="pkg"
      :resolved-version="version"
      :display-version="pkg?.requestedVersion"
      :latest-version="latestVersion"
      :version-url-pattern="versionUrlPattern"
      page="timeline"
    />

    <div class="container w-full py-8">
      <!-- Loading state -->
      <PackageTimelineSkeleton
        v-if="initialTimelineStatus === 'pending' && !timelineEntries.length"
      />

      <!-- Error state -->
      <div
        v-else-if="initialLoadError || initialTimelineError"
        class="py-20 text-center"
        role="alert"
      >
        <div class="i-lucide:circle-alert w-8 h-8 mx-auto text-fg-subtle mb-4" />
        <p class="text-fg-muted mb-4">
          {{ $t('package.timeline.load_error') }}
        </p>
        <LinkBase variant="button-secondary" :to="packageRoute(version)">
          {{ $t('code.back_to_package') }}
        </LinkBase>
      </div>

      <!-- Timeline -->
      <ol v-else-if="timelineEntries.length" class="relative border-s border-border ms-4">
        <li v-for="entry in timelineEntries" :key="entry.version" class="mb-6 ms-6">
          <!-- Dot -->
          <span
            class="absolute -start-2 flex items-center justify-center w-4 h-4 rounded-full border border-border"
            :class="
              entry.yanked
                ? 'bg-amber-500 border-amber-600'
                : entry.version === version
                  ? 'bg-accent border-accent'
                  : 'bg-bg-subtle'
            "
          />
          <!-- Content -->
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <LinkBase
              :to="packageRoute(entry.version)"
              class="text-sm font-medium"
              :class="entry.version === version ? 'text-accent' : ''"
              dir="ltr"
            >
              {{ entry.version }}
            </LinkBase>
            <span
              v-for="tag in entry.tags"
              :key="tag"
              class="text-3xs font-semibold uppercase tracking-wide"
              :class="tag === 'latest' ? 'text-accent' : 'text-fg-subtle'"
            >
              {{ tag }}
            </span>
            <span
              v-if="entry.yanked"
              class="text-3xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400"
              :title="entry.yankedReason"
            >
              yanked
            </span>
            <DateTime
              :datetime="entry.time"
              class="text-xs text-fg-subtle"
              year="numeric"
              month="short"
              day="numeric"
            />
          </div>
          <!-- Sub-events -->
          <ol
            v-if="versionSubEvents.has(entry.version)"
            class="relative border-s border-border/50 ms-3 mt-2"
          >
            <li
              v-for="ev in versionSubEvents.get(entry.version)"
              :key="ev.key"
              class="mb-2 ms-4 relative last:mb-0"
            >
              <span
                class="absolute -start-[1.375rem] top-0.5 flex items-center justify-center w-3 h-3 rounded-full border"
                :class="
                  ev.positive ? 'bg-green-500 border-green-600' : 'bg-amber-500 border-amber-600'
                "
              >
                <span class="w-2 h-2 text-white" :class="ev.icon" aria-hidden="true" />
              </span>
              <p
                class="text-xs"
                :class="
                  ev.positive
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-amber-700 dark:text-amber-400'
                "
              >
                {{ ev.text }}
              </p>
            </li>
          </ol>
        </li>
      </ol>

      <PackageTimelineSkeleton v-else />

      <!-- Load more -->
      <div v-if="timelineEntries.length && hasMore" class="mt-4 ms-10">
        <button
          type="button"
          class="text-sm text-accent hover:text-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ $t('package.timeline.load_more') }}
        </button>
        <p v-if="loadError" class="text-xs text-red-600 dark:text-red-400 mt-1">
          {{ $t('package.timeline.load_error') }}
        </p>
      </div>
    </div>
  </main>
</template>

<style scoped>
@keyframes indeterminate {
  0% {
    translate: -100%;
  }
  100% {
    translate: 400%;
  }
}

.animate-indeterminate {
  animation: indeterminate 1.5s ease-in-out infinite;
}
</style>
