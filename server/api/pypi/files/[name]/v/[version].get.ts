export default defineCachedEventHandler(
  async event => {
    const packageName = getRouterParam(event, 'name')
    const version = getRouterParam(event, 'version')

    if (!packageName || !version) {
      throw createError({ statusCode: 404, message: 'Package name and version are required' })
    }

    try {
      return await getPypiPackageFileTree(packageName, version)
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
    getKey: event =>
      `pypi-files:v1:${getRouterParam(event, 'name')}/v/${getRouterParam(event, 'version')}`,
  },
)
