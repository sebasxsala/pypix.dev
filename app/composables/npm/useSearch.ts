function emptySearchPayload() {
  return {
    searchResponse: emptySearchResponse(),
    suggestions: [] as SearchSuggestion[],
    packageAvailability: null as { name: string; available: boolean } | null,
    query: '',
    provider: 'npm' as SearchProvider,
  }
}

function searchPayload(
  q: string,
  provider: SearchProvider,
  payload: Omit<ReturnType<typeof emptySearchPayload>, 'query' | 'provider'>,
) {
  return {
    ...payload,
    query: q,
    provider,
  }
}

export interface SearchOptions {
  size?: number
}

export interface UseSearchConfig {
  /**
   * Enable org/user suggestion and package-availability checks alongside search.
   * Algolia bundles these into the same multi-search request.
   * npm runs them as separate API calls in parallel.
   */
  suggestions?: boolean
}

export function useSearch(
  query: MaybeRefOrGetter<string>,
  searchProvider: MaybeRefOrGetter<SearchProvider>,
  options: MaybeRefOrGetter<SearchOptions> = {},
  config: UseSearchConfig = {},
) {
  const {
    search: searchNpm,
    checkOrgExists: checkOrgNpm,
    checkUserExists: checkUserNpm,
  } = useNpmSearch()

  const cache = shallowRef<{
    query: string
    provider: SearchProvider
    objects: NpmSearchResult[]
    total: number
  } | null>(null)

  const isLoadingMore = shallowRef(false)
  const isRateLimited = shallowRef(false)

  const suggestions = shallowRef<SearchSuggestion[]>([])
  const suggestionsLoading = shallowRef(false)
  const packageAvailability = shallowRef<{ name: string; available: boolean } | null>(null)
  const existenceCache = shallowRef<Record<string, boolean>>({})
  const suggestionRequestId = shallowRef(0)

  function effectiveSearchProvider() {
    return toValue(searchProvider)
  }

  function suggestionsEnabled() {
    return config.suggestions === true
  }

  const asyncData = useLazyAsyncData(
    () => `search:${toValue(searchProvider)}:${toValue(query)}`,
    async (_nuxtApp, { signal }) => {
      const q = toValue(query)
      const provider = effectiveSearchProvider()

      if (!q.trim()) {
        isRateLimited.value = false
        return emptySearchPayload()
      }

      const opts = toValue(options)
      cache.value = null

      try {
        const response = await searchNpm(q, { size: opts.size ?? 25, provider }, signal)

        if (q !== toValue(query)) {
          return emptySearchPayload()
        }

        cache.value = {
          query: q,
          provider,
          objects: response.objects,
          total: response.total,
        }

        isRateLimited.value = false
        return searchPayload(q, provider, {
          searchResponse: response,
          suggestions: [],
          packageAvailability: null,
        })
      } catch (error: unknown) {
        const errorMessage = (error as { message?: string })?.message || String(error)
        const isRateLimitError =
          errorMessage.includes('Failed to fetch') || errorMessage.includes('429')

        if (isRateLimitError) {
          isRateLimited.value = true
          return emptySearchPayload()
        }
        throw error
      }
    },
    { default: emptySearchPayload },
  )

  async function fetchMore(targetSize: number): Promise<void> {
    const q = toValue(query).trim()
    const provider = effectiveSearchProvider()

    if (!q) {
      cache.value = null
      return
    }

    if (cache.value && (cache.value.query !== q || cache.value.provider !== provider)) {
      cache.value = null
      await asyncData.refresh()
      return
    }

    // Seed cache from asyncData after the initial server-backed search.
    if (!cache.value && asyncData.data.value) {
      const { searchResponse } = asyncData.data.value
      cache.value = {
        query: q,
        provider,
        objects: [...searchResponse.objects],
        total: searchResponse.total,
      }
    }

    const currentCount = cache.value?.objects.length ?? 0
    const total = cache.value?.total ?? Infinity

    if (currentCount >= targetSize || currentCount >= total) {
      return
    }

    isLoadingMore.value = true

    try {
      const from = currentCount
      const size = Math.min(targetSize - currentCount, total - currentCount)

      const response = await searchNpm(q, { size, from, provider })

      const beforeCount = cache.value?.objects.length ?? 0

      if (cache.value && cache.value.query === q && cache.value.provider === provider) {
        const existingNames = new Set(cache.value.objects.map(obj => obj.package.name))
        const newObjects = response.objects.filter(obj => !existingNames.has(obj.package.name))
        cache.value = {
          query: q,
          provider,
          objects: [...cache.value.objects, ...newObjects],
          total: response.total,
        }
      } else {
        cache.value = {
          query: q,
          provider,
          objects: response.objects,
          total: response.total,
        }
      }

      // Bail if the provider gave us no new unique items
      // Without something like this the recursion below never terminates.
      if ((cache.value?.objects.length ?? 0) === beforeCount) {
        return
      }

      if (
        cache.value &&
        cache.value.objects.length < targetSize &&
        cache.value.objects.length < cache.value.total
      ) {
        await fetchMore(targetSize)
      }
    } finally {
      isLoadingMore.value = false
    }
  }

  watch(
    () => toValue(options).size,
    async (newSize, oldSize) => {
      if (!newSize) return
      if (oldSize && newSize > oldSize && toValue(query).trim()) {
        await fetchMore(newSize)
      }
    },
  )

  watch(
    () => toValue(searchProvider),
    async () => {
      cache.value = null
      existenceCache.value = {}
      await asyncData.refresh()
      const targetSize = toValue(options).size
      if (targetSize) {
        await fetchMore(targetSize)
      }
    },
  )

  watch([() => toValue(query), () => effectiveSearchProvider()], () => {
    cache.value = null
  })

  const data = computed<NpmSearchResponse | null>(() => {
    const q = toValue(query).trim()
    const provider = effectiveSearchProvider()

    if (!q) return emptySearchResponse()

    if (cache.value) {
      if (cache.value.query !== q || cache.value.provider !== provider) return emptySearchResponse()

      return {
        isStale: false,
        objects: cache.value.objects,
        total: cache.value.total,
        time: new Date().toISOString(),
      }
    }

    const payload = asyncData.data.value
    if (!payload || payload.query !== q || payload.provider !== provider) {
      return emptySearchResponse()
    }

    return payload.searchResponse
  })

  const hasMore = computed(() => {
    if (!cache.value) return true
    return cache.value.objects.length < cache.value.total
  })

  async function validateSuggestionsNpm(q: string) {
    const requestId = ++suggestionRequestId.value
    const { intent, name } = parseSuggestionIntent(q)
    let availability: { name: string; available: boolean } | null = null

    const promises: Promise<void>[] = []

    const trimmed = q.trim()
    if (isValidNewPackageName(trimmed)) {
      promises.push(
        checkPackageExists(trimmed)
          .then(exists => {
            if (trimmed === toValue(query).trim()) {
              availability = { name: trimmed, available: !exists }
              packageAvailability.value = availability
            }
          })
          .catch(() => {
            availability = null
          }),
      )
    } else {
      availability = null
    }

    if (!intent || !name) {
      suggestionsLoading.value = false
      await Promise.all(promises)
      return { suggestions: [], packageAvailability: availability }
    }

    suggestionsLoading.value = true
    const result: SearchSuggestion[] = []
    const lowerName = name.toLowerCase()

    try {
      const wantOrg = intent === 'org' || intent === 'both'
      const wantUser = intent === 'user' || intent === 'both'

      if (wantOrg && existenceCache.value[`org:${lowerName}`] === undefined) {
        promises.push(
          checkOrgNpm(lowerName)
            .then(exists => {
              existenceCache.value = { ...existenceCache.value, [`org:${lowerName}`]: exists }
            })
            .catch(() => {
              existenceCache.value = { ...existenceCache.value, [`org:${lowerName}`]: false }
            }),
        )
      }

      if (wantUser && existenceCache.value[`user:${lowerName}`] === undefined) {
        promises.push(
          checkUserNpm(lowerName)
            .then(exists => {
              existenceCache.value = { ...existenceCache.value, [`user:${lowerName}`]: exists }
            })
            .catch(() => {
              existenceCache.value = { ...existenceCache.value, [`user:${lowerName}`]: false }
            }),
        )
      }

      if (promises.length > 0) {
        await Promise.all(promises)
      }

      if (requestId !== suggestionRequestId.value)
        return { suggestions: [], packageAvailability: availability }

      const isOrg = wantOrg && existenceCache.value[`org:${lowerName}`]
      const isUser = wantUser && existenceCache.value[`user:${lowerName}`]

      if (isOrg) {
        result.push({ type: 'org', name: lowerName, exists: true })
      }
      if (isUser && !isOrg) {
        result.push({ type: 'user', name: lowerName, exists: true })
      }
    } finally {
      if (requestId === suggestionRequestId.value) {
        suggestionsLoading.value = false
      }
    }

    if (requestId === suggestionRequestId.value) {
      suggestions.value = result
      return { suggestions: result, packageAvailability: availability }
    }

    return { suggestions: [], packageAvailability: availability }
  }

  const npmSuggestions = useLazyAsyncData(
    () => `npm-suggestions:${toValue(searchProvider)}:${toValue(query)}`,
    async () => {
      const q = toValue(query).trim()
      if (!suggestionsEnabled()) return { suggestions: [], packageAvailability: null }
      if (!q) return { suggestions: [], packageAvailability: null }
      const { intent, name } = parseSuggestionIntent(q)
      if (!intent || !name) return { suggestions: [], packageAvailability: null }
      return validateSuggestionsNpm(q)
    },
    { default: () => ({ suggestions: [], packageAvailability: null }) },
  )

  watch(
    [() => asyncData.data.value.suggestions, () => npmSuggestions.data.value.suggestions],
    ([algoliaSuggestions, npmSuggestionsValue]) => {
      if (!suggestionsEnabled()) return
      if (algoliaSuggestions.length || npmSuggestionsValue.length) {
        suggestions.value = algoliaSuggestions.length ? algoliaSuggestions : npmSuggestionsValue
      }
    },
    { immediate: true },
  )

  watch(
    [
      () => asyncData.data.value?.packageAvailability,
      () => npmSuggestions.data.value.packageAvailability,
    ],
    ([algoliaPackageAvailability, npmPackageAvailability]) => {
      if (!suggestionsEnabled()) return
      if (algoliaPackageAvailability || npmPackageAvailability) {
        packageAvailability.value = algoliaPackageAvailability || npmPackageAvailability
      }
    },
    { immediate: true },
  )

  if (import.meta.client && asyncData.data.value?.searchResponse.isStale) {
    onMounted(() => {
      asyncData.refresh()
    })
  }

  return {
    ...asyncData,
    data,
    isLoadingMore,
    hasMore,
    fetchMore,
    isRateLimited: readonly(isRateLimited),
    suggestions: readonly(suggestions),
    suggestionsLoading: readonly(suggestionsLoading),
    packageAvailability: readonly(packageAvailability),
  }
}
