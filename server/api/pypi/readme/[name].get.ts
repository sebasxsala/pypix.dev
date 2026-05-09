import { CACHE_MAX_AGE_ONE_HOUR, ERROR_NPM_FETCH_FAILED } from '#shared/utils/constants'
import { fetchPypiProject } from '#server/utils/pypi-package'

export default defineCachedEventHandler(
  async event => {
    try {
      const name = getRouterParam(event, 'name') ?? ''
      const project = await fetchPypiProject(name)
      const markdown = project.info.description

      if (!markdown) {
        return { html: '', mdExists: false, playgroundLinks: [], toc: [] }
      }

      return await renderReadmeHtml(markdown, project.info.name)
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_NPM_FETCH_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: event => `pypi-readme:v2:${getRouterParam(event, 'name') ?? ''}`,
  },
)
