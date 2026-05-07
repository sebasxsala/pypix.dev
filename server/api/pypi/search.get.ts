import { emptyPypiSearchResponse, searchPypiProjects } from '#server/utils/pypi-search'

export default defineEventHandler(async event => {
  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q.trim() : ''
  const size = Number.parseInt(String(query.size ?? '25'), 10)
  const from = Number.parseInt(String(query.from ?? '0'), 10)
  const provider = query.provider === 'algolia' ? 'algolia' : 'local'

  if (!q) {
    return emptyPypiSearchResponse()
  }

  return searchPypiProjects(
    q,
    Number.isFinite(size) ? size : 25,
    Number.isFinite(from) ? from : 0,
    provider,
  )
})
