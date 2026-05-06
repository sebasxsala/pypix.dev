import type { ReadmeResponse } from '#shared/types/readme'

const MAX_FILE_SIZE = 500 * 1024

function isProbablyBinary(content: Buffer): boolean {
  const sample = content.subarray(0, Math.min(content.length, 1024))
  return sample.includes(0)
}

export default defineCachedEventHandler(
  async event => {
    const packageName = getRouterParam(event, 'name')
    const version = getRouterParam(event, 'version')
    const filePath = getRouterParam(event, 'filePath')

    if (!packageName || !version || !filePath) {
      throw createError({ statusCode: 404, message: ERROR_PACKAGE_VERSION_AND_FILE_FAILED })
    }

    try {
      const entry = await getPypiPackageFileContent(packageName, version, filePath)

      if ((entry.content?.length ?? 0) > MAX_FILE_SIZE) {
        throw createError({
          statusCode: 413,
          message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024}KB.`,
        })
      }

      const language = getLanguageFromPath(filePath)
      const contentType = isProbablyBinary(entry.content!)
        ? 'application/octet-stream'
        : 'text/plain; charset=utf-8'
      const content = entry.content!.toString('utf8')
      const html =
        contentType === 'application/octet-stream' ? '' : await highlightCode(content, language)

      let markdownHtml: ReadmeResponse | undefined
      if (language === 'markdown' && contentType !== 'application/octet-stream') {
        try {
          markdownHtml = await renderReadmeHtml(content, packageName)
        } catch {
          markdownHtml = undefined
        }
      }

      return {
        package: packageName,
        version,
        path: filePath,
        language,
        contentType,
        content,
        html,
        lines: content.split('\n').length,
        markdownHtml,
      } satisfies PackageFileContentResponse
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: 'Failed to fetch PyPI file content',
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_YEAR,
    getKey: event =>
      `pypi-file:v1:${getRouterParam(event, 'name')}/v/${getRouterParam(event, 'version')}/${getRouterParam(event, 'filePath')}`,
  },
)
