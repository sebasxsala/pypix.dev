import { ERROR_NPM_FETCH_FAILED } from '#shared/utils/constants'
import { fetchPypiProject, transformPypiProject } from '#server/utils/pypi-package'

export default defineEventHandler(async event => {
  try {
    const name = getRouterParam(event, 'name') ?? ''
    const query = getQuery(event)
    const requestedVersion = typeof query.version === 'string' ? query.version : null
    const project = await fetchPypiProject(name)
    return transformPypiProject(project, requestedVersion)
  } catch (error: unknown) {
    handleApiError(error, {
      statusCode: 502,
      message: ERROR_NPM_FETCH_FAILED,
    })
  }
})
