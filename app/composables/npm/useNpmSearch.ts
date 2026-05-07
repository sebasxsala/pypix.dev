import type { SearchProvider } from '~/composables/useSettings'

interface NpmSearchOptions {
  size?: number
  from?: number
  provider?: SearchProvider
}

async function checkOrgExists(name: string): Promise<boolean> {
  void name
  return false
}

async function checkUserExists(name: string): Promise<boolean> {
  void name
  return false
}

/**
 * Search PyPI packages through a server-side MVP adapter.
 * The rest of the app still expects the inherited npm-shaped response.
 */
async function search(
  query: string,
  options: NpmSearchOptions = {},
  signal?: AbortSignal,
): Promise<NpmSearchResponse> {
  const params = new URLSearchParams()
  params.set('q', query)
  params.set('size', String(options.size ?? 25))
  params.set('provider', options.provider === 'algolia' ? 'algolia' : 'local')
  if (options.from) {
    params.set('from', String(options.from))
  }

  return await $fetch<NpmSearchResponse>(`/api/pypi/search?${params.toString()}`, { signal })
}

/**
 * Composable providing PyPI search through the inherited npm-named module.
 * Must be called during component setup.
 */
export function useNpmSearch() {
  return {
    search,
    checkOrgExists,
    checkUserExists,
  }
}
