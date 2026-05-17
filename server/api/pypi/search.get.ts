import { setHeader } from 'h3'
import { emptyPypiSearchResponse, searchPypiProjects } from '#server/utils/pypi-search'
import { getRequestAbortSignal } from '#server/utils/request-abort'
import { CACHE_MAX_AGE_ONE_DAY } from '#shared/utils/constants'

export default defineEventHandler(async event => {
  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q.trim() : ''
  const size = Number.parseInt(String(query.size ?? '25'), 10)
  const from = Number.parseInt(String(query.from ?? '0'), 10)
  const provider = query.provider === 'algolia' ? 'algolia' : 'local'
  const cacheControl = `public, max-age=0, s-maxage=${CACHE_MAX_AGE_ONE_DAY}, stale-while-revalidate=${CACHE_MAX_AGE_ONE_DAY}`

  setHeader(event, 'Cache-Control', cacheControl)

  if (!q) {
    return emptyPypiSearchResponse()
  }

  return searchPypiProjects(
    q,
    Number.isFinite(size) ? size : 25,
    Number.isFinite(from) ? from : 0,
    provider,
    { signal: getRequestAbortSignal(event) },
  )
})
