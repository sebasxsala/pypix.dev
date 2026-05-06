const DEFAULT_LIMIT = 25

export default defineCachedEventHandler(
  async event => {
    const packageName = getRouterParam(event, 'name')
    if (!packageName) {
      throw createError({ statusCode: 404, message: 'Package name is required' })
    }

    const query = getQuery(event)
    const offset = Math.max(0, Number(query.offset) || 0)
    const limit = Math.max(1, Math.min(100, Number(query.limit) || DEFAULT_LIMIT))

    try {
      const project = await fetchPypiProject(packageName)
      return buildPypiTimeline(project, { offset, limit })
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: `Failed to fetch PyPI timeline for ${packageName}`,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_FIVE_MINUTES,
    swr: true,
    getKey: event => {
      const query = getQuery(event)
      const offset = Math.max(0, Number(query.offset) || 0)
      const limit = Math.max(1, Math.min(100, Number(query.limit) || DEFAULT_LIMIT))
      return `pypi-timeline:v1:${getRouterParam(event, 'name')}:${offset}:${limit}`
    },
  },
)
