import type { H3Event } from 'h3'
import { ERROR_NPM_FETCH_FAILED } from '#shared/utils/constants'
import { fetchPypiProject } from '#server/utils/pypi-package'

export default async function getPypiMarkdownReadme(event: H3Event) {
  try {
    const name = getRouterParam(event, 'name') ?? ''
    const project = await fetchPypiProject(name)
    return {
      packageName: project.info.name,
      version: project.info.version,
      markdown: project.info.description,
      repoInfo: undefined,
    }
  } catch (error: unknown) {
    handleApiError(error, {
      statusCode: 502,
      message: ERROR_NPM_FETCH_FAILED,
    })
  }
}
