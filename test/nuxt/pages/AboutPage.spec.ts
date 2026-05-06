import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

async function mountAboutPage() {
  const AboutPage = await import('~/pages/about.vue')
  return mountSuspended(AboutPage.default, { route: '/about' })
}

describe('about page', () => {
  it('uses pypix maintainer data and Python package manager links', async () => {
    const wrapper = await mountAboutPage()

    expect(wrapper.html()).toContain('https://avatars.githubusercontent.com/sebasxsala?s=160')
    expect(wrapper.html()).toContain('https://pip.pypa.io/')
    expect(wrapper.html()).toContain('https://docs.astral.sh/uv/')
    expect(wrapper.html()).toContain('https://python-poetry.org/')
    expect(wrapper.html()).toContain('https://pdm-project.org/')
    expect(wrapper.html()).toContain('https://pipenv.pypa.io/')
    expect(wrapper.html()).toContain('https://docs.conda.io/')
    expect(wrapper.html()).toContain('https://pixi.sh/')
  })

  it('omits upstream sponsor and partner sections until pypix has its own', async () => {
    const wrapper = await mountAboutPage()

    expect(wrapper.text()).not.toContain('Sponsors')
    expect(wrapper.text()).not.toContain('OSS Partners')
  })
})
