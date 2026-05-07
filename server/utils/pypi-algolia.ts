import { algoliasearch } from 'algoliasearch'
import type { NpmSearchResponse } from '#shared/types/npm-registry'
import {
  ALGOLIA_INDEX_NAME,
  pypiAlgoliaHitToSearchResult,
  type PypiAlgoliaRecord,
} from './pypi-algolia-record'

export type PypiSearchProvider = 'local' | 'algolia'

export interface PypiAlgoliaSearchClient {
  search: (request: { requests: unknown[] }) => Promise<{
    results?: Array<{
      hits?: PypiAlgoliaRecord[]
      nbHits?: number
    }>
  }>
}

export interface PypiAlgoliaSearchConfig {
  provider: PypiSearchProvider
  appId: string
  searchApiKey: string
  indexName: string
  client?: PypiAlgoliaSearchClient
}

export const PYPI_ALGOLIA_ATTRIBUTES_TO_RETRIEVE = [
  'objectID',
  'name',
  'normalizedName',
  'version',
  'summary',
  'keywords',
  'classifiers',
  'requiresPython',
  'projectUrls',
  'homepage',
  'repository',
  'license',
  'author',
  'maintainer',
  'updatedAt',
  'updatedAtTimestamp',
  'yankedLatest',
  'hasVulnerabilities',
  'popularRank',
]

export function getPypiAlgoliaSearchConfig(): PypiAlgoliaSearchConfig {
  const runtimeConfig =
    typeof useRuntimeConfig === 'function'
      ? (useRuntimeConfig() as {
          algolia?: { appId?: string; searchApiKey?: string; indexName?: string }
        })
      : undefined

  return {
    provider: 'local',
    appId: runtimeConfig?.algolia?.appId || process.env.ALGOLIA_APP_ID || '',
    searchApiKey: runtimeConfig?.algolia?.searchApiKey || process.env.ALGOLIA_SEARCH_API_KEY || '',
    indexName:
      runtimeConfig?.algolia?.indexName || process.env.ALGOLIA_INDEX_NAME || ALGOLIA_INDEX_NAME,
  }
}

function createSearchClient(config: PypiAlgoliaSearchConfig): PypiAlgoliaSearchClient {
  return algoliasearch(config.appId, config.searchApiKey) as PypiAlgoliaSearchClient
}

function isConfigured(config: PypiAlgoliaSearchConfig) {
  return (
    config.provider === 'algolia' && !!config.appId && !!config.searchApiKey && !!config.indexName
  )
}

export async function searchPypiAlgolia(
  config: PypiAlgoliaSearchConfig,
  query: string,
  size: number,
  from = 0,
): Promise<NpmSearchResponse | null> {
  if (!isConfigured(config)) return null

  try {
    const client = config.client ?? createSearchClient(config)
    const response = await client.search({
      requests: [
        {
          indexName: config.indexName,
          query,
          offset: Math.max(0, from),
          length: Math.max(1, size),
          analyticsTags: ['pypix.dev'],
          attributesToRetrieve: PYPI_ALGOLIA_ATTRIBUTES_TO_RETRIEVE,
          attributesToHighlight: [],
        },
      ],
    })

    const result = response.results?.[0]
    if (!result || !Array.isArray(result.hits)) return null

    return {
      isStale: false,
      objects: result.hits.map(pypiAlgoliaHitToSearchResult),
      total: result.nbHits ?? result.hits.length,
      time: new Date().toISOString(),
    }
  } catch {
    return null
  }
}
