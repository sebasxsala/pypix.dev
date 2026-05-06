export function useResolvedVersion(
  packageName: MaybeRefOrGetter<string>,
  requestedVersion: MaybeRefOrGetter<string | null>,
) {
  return useAsyncData(
    () => `resolved-version:${toValue(packageName)}:${toValue(requestedVersion) ?? 'latest'}`,
    async () => {
      const version = toValue(requestedVersion)
      const name = toValue(packageName)
      const query = version ? `?version=${encodeURIComponent(version)}` : ''
      const data = await $fetch<{ version: string | null }>(
        `/api/pypi/version/${encodeURIComponent(name)}${query}`,
      )
      return data.version ?? undefined
    },
    { default: () => undefined },
  )
}
