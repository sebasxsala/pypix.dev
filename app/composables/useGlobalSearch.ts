import type { LocationQueryRaw } from 'vue-router'
import type { SearchProvider } from '~/composables/useSettings'
import { normalizeSearchParam } from '#shared/utils/url'
import { debounce } from 'perfect-debounce'

// Pages that have their own local filter using ?q
const pagesWithLocalFilter = new Set(['~username', 'org'])

const SEARCH_DEBOUNCE_MS = 100

function normalizeSubmittedSearchQuery(value: string): string {
  return value.trim().replace(/\s+/g, '-')
}

export function buildGlobalSearchQuery(
  routeQuery: LocationQueryRaw,
  value: string,
  provider: SearchProvider = 'npm',
): LocationQueryRaw {
  return {
    ...routeQuery,
    q: normalizeSubmittedSearchQuery(value) || undefined,
    p: provider === 'algolia' ? 'algolia' : undefined,
  }
}

export function useGlobalSearch(place: 'header' | 'content' = 'content') {
  const { settings } = useSettings()
  const router = useRouter()
  const route = useRoute()
  const searchProviderValue = computed(() => {
    const urlProvider = normalizeSearchParam(route.query.p)
    if (urlProvider === 'algolia') return 'algolia'
    return settings.value.searchProvider
  })
  // Internally used searchQuery state
  const searchQuery = useState<string>('search-query', () => {
    if (pagesWithLocalFilter.has(route.name as string)) {
      return ''
    }
    return normalizeSearchParam(route.query.q)
  })

  // Committed search query: last value submitted by user
  // Syncs instantly when instantSearch is on, but only on Enter press when off
  const committedSearchQuery = useState<string>('committed-search-query', () => searchQuery.value)

  const commitSearchQuery = debounce((val: string) => {
    committedSearchQuery.value = val
  }, SEARCH_DEBOUNCE_MS)

  // This is basically doing instant search as user types
  watch(searchQuery, val => {
    if (settings.value.instantSearch) {
      commitSearchQuery(normalizeSubmittedSearchQuery(val))
    }
  })

  // clean search input when navigating away from search page
  watch(
    () => route.query.q,
    urlQuery => {
      const value = normalizeSearchParam(urlQuery)
      if (!value) searchQuery.value = ''
      if (!searchQuery.value) searchQuery.value = value
    },
  )

  // Updates URL when search query changes (immediately for instantSearch or after Enter hit otherwise)
  const updateUrlQueryImpl = (value: string) => {
    const submittedValue = normalizeSubmittedSearchQuery(value)
    const isSameQuery =
      normalizeSearchParam(route.query.q) === submittedValue &&
      normalizeSearchParam(route.query.p) ===
        (searchProviderValue.value === 'algolia' ? 'algolia' : '')
    if (!submittedValue && route.name !== 'search') {
      return
    }
    // Don't navigate away from pages that use ?q for local filtering
    if ((pagesWithLocalFilter.has(route.name as string) && place === 'content') || isSameQuery) {
      return
    }

    if (route.name === 'search') {
      router.replace({
        query: buildGlobalSearchQuery(route.query, submittedValue, searchProviderValue.value),
      })
      return
    }
    router.push({
      name: 'search',
      query: {
        q: submittedValue || undefined,
        p: searchProviderValue.value === 'algolia' ? 'algolia' : undefined,
      },
    })
  }

  const updateUrlQuery = debounce(updateUrlQueryImpl, SEARCH_DEBOUNCE_MS)

  function flushUpdateUrlQuery() {
    // Commit the current query when explicitly submitted (Enter pressed)
    commitSearchQuery.cancel()
    committedSearchQuery.value = normalizeSubmittedSearchQuery(searchQuery.value)
    // When instant search is off the debounce queue is empty, so call directly
    if (!settings.value.instantSearch) {
      updateUrlQueryImpl(searchQuery.value)
    } else {
      updateUrlQuery.flush()
    }
  }

  const searchQueryValue = computed({
    get: () => searchQuery.value,
    set: async (value: string) => {
      searchQuery.value = value

      // When instant search is off, only explicitly submitted searches navigate
      // Only explicitly called flushUpdateUrlQuery commits and navigates
      if (!settings.value.instantSearch) return

      if (!normalizeSubmittedSearchQuery(value) && route.name !== 'search') {
        updateUrlQuery.cancel()
        return
      }

      // Leading debounce implementation as it doesn't work properly out of the box (https://github.com/unjs/perfect-debounce/issues/43)
      if (!updateUrlQuery.isPending()) {
        updateUrlQueryImpl(value)
      }
      updateUrlQuery(value)
    },
  })

  return {
    model: searchQueryValue,
    committedModel: committedSearchQuery,
    provider: searchProviderValue,
    startSearch: flushUpdateUrlQuery,
  }
}
