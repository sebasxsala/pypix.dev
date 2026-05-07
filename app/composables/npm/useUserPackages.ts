/** Default page size for incremental loading (npm registry path) */
const PAGE_SIZE = 50 as const

/** npm search API practical limit for maintainer queries */
const MAX_RESULTS = 250

/**
 * Fetch packages for a given npm user/maintainer.
 *
 * The composable incrementally paginates through `maintainer:` search results.
 *
 * @example
 * ```ts
 * const { data, status, hasMore, isLoadingMore, loadMore } = useUserPackages(username)
 * ```
 */
export function useUserPackages(username: MaybeRefOrGetter<string>) {
  const { $npmRegistry } = useNuxtApp()

  // --- Incremental loading state (npm path) ---
  const currentPage = shallowRef(1)

  const cache = shallowRef<{
    username: string
    objects: NpmSearchResult[]
    total: number
  } | null>(null)

  const isLoadingMore = shallowRef(false)

  const asyncData = useLazyAsyncData(
    () => `user-packages:npm:${toValue(username)}`,
    async (_nuxtApp, { signal }) => {
      const user = toValue(username)
      if (!user) {
        return emptySearchResponse()
      }

      cache.value = null
      currentPage.value = 1

      const params = new URLSearchParams()
      params.set('text', `maintainer:${user}`)
      params.set('size', String(PAGE_SIZE))

      const { data: response, isStale } = await $npmRegistry<NpmSearchResponse>(
        `/-/v1/search?${params.toString()}`,
        { signal },
        60,
      )

      // Guard against stale response (user changed during await)
      if (user !== toValue(username)) {
        return emptySearchResponse()
      }

      cache.value = {
        username: user,
        objects: response.objects,
        total: response.total,
      }

      return { ...response, isStale }
    },
    { default: emptySearchResponse },
  )
  // --- Fetch more (npm path only) ---
  /**
   * Fetch the next page of results from npm registry.
   * @param manageLoadingState - When false, caller manages isLoadingMore (used by loadAll to prevent flicker)
   */
  async function fetchMore(manageLoadingState = true): Promise<void> {
    const user = toValue(username)
    if (!user) return

    if (cache.value && cache.value.username !== user) {
      cache.value = null
      await asyncData.refresh()
      return
    }

    const currentCount = cache.value?.objects.length ?? 0
    const total = Math.min(cache.value?.total ?? Infinity, MAX_RESULTS)

    if (currentCount >= total) return

    if (manageLoadingState) isLoadingMore.value = true

    try {
      const from = currentCount
      const size = Math.min(PAGE_SIZE, total - currentCount)

      const params = new URLSearchParams()
      params.set('text', `maintainer:${user}`)
      params.set('size', String(size))
      params.set('from', String(from))

      const { data: response } = await $npmRegistry<NpmSearchResponse>(
        `/-/v1/search?${params.toString()}`,
        {},
        60,
      )

      // Guard against stale response
      if (user !== toValue(username)) return

      if (cache.value && cache.value.username === user) {
        const existingNames = new Set(cache.value.objects.map(obj => obj.package.name))
        const newObjects = response.objects.filter(obj => !existingNames.has(obj.package.name))
        cache.value = {
          username: user,
          objects: [...cache.value.objects, ...newObjects],
          total: response.total,
        }
      } else {
        cache.value = {
          username: user,
          objects: response.objects,
          total: response.total,
        }
      }
    } finally {
      if (manageLoadingState) isLoadingMore.value = false
    }
  }

  /** Load the next page of results. */
  async function loadMore(): Promise<void> {
    if (isLoadingMore.value || !hasMore.value) return
    currentPage.value++
    await fetchMore()
  }

  /** Load all remaining results at once (e.g. when user starts filtering) */
  async function loadAll(): Promise<void> {
    if (!hasMore.value) return

    isLoadingMore.value = true
    try {
      while (hasMore.value) {
        await fetchMore(false)
      }
    } finally {
      isLoadingMore.value = false
    }
  }

  // Computed data that uses cache (only if it belongs to the current username)
  const data = computed<NpmSearchResponse | null>(() => {
    const user = toValue(username)
    if (cache.value && cache.value.username === user) {
      return {
        isStale: false,
        objects: cache.value.objects,
        total: cache.value.total,
        time: new Date().toISOString(),
      }
    }
    return asyncData.data.value
  })

  /** Whether there are more results available to load (npm path only) */
  const hasMore = computed(() => {
    if (!toValue(username)) return false
    if (!cache.value) return true
    // npm path: more available if we haven't hit the server total or our cap
    const fetched = cache.value.objects.length
    const available = cache.value.total
    return fetched < available && fetched < MAX_RESULTS
  })

  return {
    ...asyncData,
    /** Reactive package results */
    data,
    /** Whether currently loading more results */
    isLoadingMore,
    /** Whether there are more results available */
    hasMore,
    /** Load next page of results */
    loadMore,
    /** Load all remaining results (for filter/sort) */
    loadAll,
    /** Default page size (for display) */
    pageSize: PAGE_SIZE,
  }
}
