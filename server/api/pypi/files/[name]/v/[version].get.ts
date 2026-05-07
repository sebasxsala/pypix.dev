export default defineCachedEventHandler(
  async event => {
    const packageName = getRouterParam(event, 'name')
    const version = getRouterParam(event, 'version')

    if (!packageName || !version) {
      throw createError({ statusCode: 404, message: 'Package name and version are required' })
    }

    try {
      const filePreference = getQuery(event).filePreference
      return await getPypiPackageFileTree(
        packageName,
        version,
        filePreference === 'wheels' || filePreference === 'sdist' ? filePreference : 'all',
      )
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_FILE_LIST_FETCH_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_YEAR,
    swr: true,
    getKey: event => {
      const filePreference = getQuery(event).filePreference
      const preference =
        filePreference === 'wheels' || filePreference === 'sdist' ? filePreference : 'all'
      return `pypi-files:v1:${getRouterParam(event, 'name')}/v/${getRouterParam(event, 'version')}:${preference}`
    },
  },
)
