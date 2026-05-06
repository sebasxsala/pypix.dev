import { ERROR_NPM_FETCH_FAILED } from '#shared/utils/constants'
import { fetchPypiProject } from '#server/utils/pypi-package'

export default defineEventHandler(async event => {
  try {
    const name = getRouterParam(event, 'name') ?? ''
    const query = getQuery(event)
    const requestedVersion = typeof query.version === 'string' ? query.version : null
    const project = await fetchPypiProject(name)

    if (!requestedVersion || requestedVersion === 'latest') {
      return { version: project.info.version || null }
    }

    return { version: project.releases?.[requestedVersion]?.length ? requestedVersion : null }
  } catch (error: unknown) {
    handleApiError(error, {
      statusCode: 502,
      message: ERROR_NPM_FETCH_FAILED,
    })
  }
})
