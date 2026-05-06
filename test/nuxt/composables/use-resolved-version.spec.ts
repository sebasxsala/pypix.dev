import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h, ref, watchEffect } from 'vue'

async function captureResolvedVersion(packageName: string, requestedVersion: string | null = null) {
  const captured = ref<string | null | undefined>()

  const WrapperComponent = defineComponent({
    async setup() {
      const { data } = await useResolvedVersion(
        () => packageName,
        () => requestedVersion,
      )

      watchEffect(() => {
        captured.value = data.value
      })

      return () => h('div')
    },
  })

  await mountSuspended(WrapperComponent)

  return captured
}

describe('useResolvedVersion', () => {
  it('returns null instead of undefined when the API has no resolved version', async () => {
    registerEndpoint('/api/pypi/version/missing-package', () => ({ version: null }))

    const version = await captureResolvedVersion('missing-package')

    expect(version.value).toBeNull()
  })
})
