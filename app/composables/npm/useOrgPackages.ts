/**
 * Fetch all packages for an npm organization.
 *
 * 1. Gets the authoritative package list from the npm registry (single request)
 * 2. Fetches lightweight metadata via server-side package-meta lookups
 */
export function useOrgPackages(orgName: MaybeRefOrGetter<string>) {
  const asyncData = useLazyAsyncData(
    () => `org-packages:npm:${toValue(orgName)}`,
    async ({ ssrContext }, { signal }) => {
      const org = toValue(orgName)
      if (!org) {
        return emptySearchResponse()
      }

      // Get the authoritative package list from the npm registry (single request)
      let packageNames: string[]
      try {
        const { packages } = await $fetch<{ packages: string[]; count: number }>(
          `/api/registry/org/${encodeURIComponent(org)}/packages`,
          { signal },
        )
        packageNames = packages
      } catch (err) {
        // Check if this is a 404 (org not found)
        if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 404) {
          const error = createError({
            statusCode: 404,
            statusMessage: 'Organization not found',
            message: `The organization "@${org}" does not exist on npm`,
          })
          if (import.meta.server) {
            ssrContext!.payload.error = error
          }
          throw error
        }
        // For other errors (network, etc.), return empty array to be safe
        packageNames = []
      }

      if (packageNames.length === 0) {
        return emptySearchResponse()
      }

      const metaResults = await mapWithConcurrency(
        packageNames,
        async name => {
          try {
            return await $fetch<PackageMetaResponse>(
              `/api/registry/package-meta/${encodePackageName(name)}`,
              { signal },
            )
          } catch {
            return null
          }
        },
        10,
      )

      const results: NpmSearchResult[] = metaResults
        .filter((meta): meta is PackageMetaResponse => meta !== null)
        .map(metaToSearchResult)

      return {
        isStale: false,
        objects: results,
        total: results.length,
        time: new Date().toISOString(),
      } satisfies NpmSearchResponse
    },
    { default: emptySearchResponse },
  )

  return asyncData
}
