import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignoreIssues: {
    'app/utils/atproto/helpers.ts': ['exports'],
  },
  workspaces: {
    '.': {
      entry: [
        'i18n/**/*.ts',
        'lunaria.config.ts',
        'lunaria/lunaria.ts',
        'pwa-assets.config.ts',
        'modules/*.ts',
        '.lighthouserc.cjs',
        'lighthouse-setup.cjs',
        'uno-preset-*.ts!',
        'scripts/**/*.ts',
      ],
      project: [
        '**/*.{ts,vue,cjs,mjs}',
        '!test/fixtures/**',
        '!test/test-utils/**',
        '!test/e2e/helpers/**',
        '!cli/src/**',
        '!lexicons/**',
      ],
      msw: {
        entry: ['.storybook/.public/mockServiceWorker.js'],
      },
      ignoreDependencies: [
        '@iconify-json/*',
        'puppeteer',
        'vite-plugin-pwa',
        '@vueuse/shared',

        /** Oxlint plugins don't get picked up yet */
        '@e18e/eslint-plugin',
        'eslint-plugin-regexp',

        /** Used in test/e2e/helpers/ which is excluded from knip project scope */
        'h3-next',
      ],
      ignoreUnresolved: ['#oauth/config'],
      ignoreFiles: [
        'app/assets/logos/oss-partners/index.ts',
        'app/assets/logos/sponsors/index.ts',
        'app/components/About/LogoImg.vue',
        'app/components/About/LogoList.vue',
        'app/components/Alert.vue',
        'app/components/BlogPostListCard.vue',
        'app/components/Header/AuthModal.client.vue',
        'app/components/Header/ConnectorModal.vue',
        'app/components/Header/OrgsDropdown.vue',
        'app/components/Header/PackagesDropdown.vue',
        'app/components/Org/OperationsQueue.vue',
        'app/components/Package/AccessControls.vue',
        'app/components/Package/ClaimPackageModal.vue',
        'app/components/Terminal/Install.vue',
        'app/components/Tooltip/Announce.vue',
        'app/components/UserCombobox.vue',
        'app/composables/useModuleReplacement.ts',
        '**/*.unused.*',
      ],
    },
    'cli': {
      project: ['src/**/*.ts!', '!src/mock-*.ts'],
    },
    'docs': {
      entry: ['app/**/*.{ts,vue,css}', 'shared/**/*.{ts,vue,css}'],
      project: ['**/*.{ts,vue,cjs,mjs}'],
      ignoreDependencies: ['@nuxtjs/mdc'],
    },
  },
}

export default config
