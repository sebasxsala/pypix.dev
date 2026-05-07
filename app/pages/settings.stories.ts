import Settings from './settings.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { userEvent, expect } from 'storybook/test'
import { pageDecorator } from '../../.storybook/decorators'
import { i18nStatusHandler } from '../storybook/mocks/handlers/lunaria-status'

const meta = {
  component: Settings,
  globals: {
    locale: 'en-US',
  },
  beforeEach: () => {
    localStorage.removeItem('npmx-settings')
    localStorage.removeItem('npmx-pm')
  },
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [i18nStatusHandler],
    },
  },
  decorators: [pageDecorator],
} satisfies Meta<typeof Settings>

export default meta
type Story = StoryObj<typeof meta>

/** English locale (default). The Language section shows a GitHub link to help translate the site. */
export const Default: Story = {}

export const PythonInstallCommands: Story = {
  play: async ({ canvas, step }) => {
    await step('Select pip as the Python installer', async () => {
      const select = await canvas.findByRole('combobox', { name: /python installer/i })
      await userEvent.selectOptions(select, 'pip')
      await expect(select).toHaveValue('pip')
    })
  },
}

/** Non-English locale with incomplete translations. The Language section shows `SettingsTranslationHelper` with a progress bar and list of missing translation keys. `/lunaria/status.json` is intercepted by MSW to provide mock translation status data. */
export const NonEnglishTranslationHelper: Story = {
  globals: {
    locale: 'fr-FR',
  },
}

/** Non-English locale without translations API response. The Language section shows a GitHub link to help translate the site. */
export const WithoutTranslationHelper: Story = {
  globals: {
    locale: 'fr-FR',
  },
  parameters: {
    msw: {
      handlers: [],
    },
  },
}
