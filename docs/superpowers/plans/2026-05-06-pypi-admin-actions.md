# PyPI Admin Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the maximum useful PyPI admin surface pypix.dev can support without storing PyPI credentials or depending on private PyPI APIs.

**Architecture:** Keep pypix.dev as a PyPI browser/inspector and add an official-admin action layer made of links, contextual guidance, and a GitHub Actions Trusted Publishing workflow generator. Centralize PyPI admin URLs and workflow generation in a small utility so header, mobile menu, command palette, and package pages all use the same contract. Avoid account sync, token storage, owners/maintainers automation, or scraping PyPI sessions.

**Tech Stack:** Nuxt 3, Vue components, existing `LinkBase`/`ButtonBase`, VueUse `useClipboard`, Vitest/Nuxt component tests, existing command palette command model, PyPI official docs and pypa/gh-action-pypi-publish.

---

## Scope

Implement these supported actions:

- `Manage projects on PyPI`: opens `https://pypi.org/manage/projects/`.
- `Configure Trusted Publisher`: opens the project publishing page when a package name is known, otherwise opens PyPI's Trusted Publishing docs.
- `Create pending publisher`: opens PyPI account publishing when no project exists yet, plus links to the official pending-publisher docs.
- `View publishing guide`: in-app page explaining the official flow and showing copyable GitHub Actions YAML.
- `Open PyPI organizations`: opens `https://pypi.org/manage/organizations/`.
- `Open PyPI project page`: opens `https://pypi.org/project/<name>/`.
- `Open project settings`: opens the project manage page when a package name is known.

Explicitly do not implement:

- PyPI login inside pypix.dev.
- PyPI API token collection or storage.
- Owners, maintainers, orgs, teams, or trusted publisher mutation via private endpoints.
- Browser automation or scraping against authenticated PyPI pages.

## File Structure

- Create: `app/utils/pypi-admin.ts`
  - Owns all official PyPI URLs, project-name URL encoding, GitHub repository parsing, and Trusted Publishing workflow generation.
- Create: `app/components/PyPI/AdminActions.vue`
  - Reusable action list used in header dropdown and package pages.
- Create: `app/pages/publishing.vue`
  - In-app publishing guide with official action links and workflow snippet.
- Modify: `app/components/Header/AccountMenu.client.vue`
  - Replace single `Manage on PyPI` link with reusable admin actions.
- Modify: `app/components/Header/MobileMenu.client.vue`
  - Use the same admin actions in mobile menu.
- Modify: `app/composables/useCommandPaletteGlobalCommands.ts`
  - Add separate commands for manage projects, trusted publishing, organizations, and publishing guide.
- Modify: `app/components/Package/Header.vue`
  - Add contextual PyPI admin actions for the current package.
- Modify: `i18n/locales/en.json`
  - Add product copy for official PyPI actions and no-token guidance.
- Create: `test/unit/app/utils/pypi-admin.spec.ts`
  - Unit tests for URL generation, GitHub repo parsing, and workflow generation.
- Create: `test/nuxt/components/PyPI/AdminActions.spec.ts`
  - Component tests for contextual and non-contextual admin actions.
- Modify: `test/nuxt/components/HeaderAccountMenu.spec.ts`
  - Assert header has all official actions and no npm/Atmosphere copy.
- Modify: `test/nuxt/components/Header/MobileMenu.spec.ts`
  - Assert mobile menu mirrors official PyPI actions.
- Modify: `test/nuxt/composables/use-command-palette-commands.spec.ts`
  - Assert command palette exposes official PyPI admin commands only.

---

### Task 1: Centralize PyPI Admin URLs and Workflow Generation

**Files:**

- Create: `app/utils/pypi-admin.ts`
- Create: `test/unit/app/utils/pypi-admin.spec.ts`

- [ ] **Step 1: Write failing unit tests**

Create `test/unit/app/utils/pypi-admin.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  createTrustedPublishingWorkflow,
  getPyPIAccountPublishingUrl,
  getPyPIOrganizationsUrl,
  getPyPIProjectManageUrl,
  getPyPIProjectPageUrl,
  getPyPIProjectPublishingUrl,
  getPyPIProjectsUrl,
  getTrustedPublishingDocsUrl,
  parseGitHubRepositoryUrl,
} from '~/utils/pypi-admin'

describe('pypi-admin utils', () => {
  it('builds official PyPI admin links', () => {
    expect(getPyPIProjectsUrl()).toBe('https://pypi.org/manage/projects/')
    expect(getPyPIOrganizationsUrl()).toBe('https://pypi.org/manage/organizations/')
    expect(getPyPIAccountPublishingUrl()).toBe('https://pypi.org/manage/account/publishing/')
    expect(getTrustedPublishingDocsUrl()).toBe('https://docs.pypi.org/trusted-publishers/')
  })

  it('builds project-specific links with encoded package names', () => {
    expect(getPyPIProjectPageUrl('requests')).toBe('https://pypi.org/project/requests/')
    expect(getPyPIProjectManageUrl('my package')).toBe(
      'https://pypi.org/manage/project/my%20package/',
    )
    expect(getPyPIProjectPublishingUrl('requests')).toBe(
      'https://pypi.org/manage/project/requests/settings/publishing/',
    )
  })

  it('parses common GitHub repository URLs', () => {
    expect(parseGitHubRepositoryUrl('https://github.com/psf/requests')).toEqual({
      owner: 'psf',
      repo: 'requests',
    })
    expect(parseGitHubRepositoryUrl('https://github.com/pypa/warehouse.git')).toEqual({
      owner: 'pypa',
      repo: 'warehouse',
    })
    expect(parseGitHubRepositoryUrl('https://gitlab.com/pypa/sampleproject')).toBeNull()
    expect(parseGitHubRepositoryUrl(null)).toBeNull()
  })

  it('creates a no-token GitHub Actions Trusted Publishing workflow', () => {
    expect(
      createTrustedPublishingWorkflow({
        environment: 'pypi',
        pythonVersion: '3.x',
      }),
    ).toContain('uses: pypa/gh-action-pypi-publish@release/v1')
    expect(createTrustedPublishingWorkflow({ environment: 'pypi' })).toContain('id-token: write')
    expect(createTrustedPublishingWorkflow({ environment: 'pypi' })).not.toContain('PYPI_TOKEN')
  })
})
```

- [ ] **Step 2: Run the unit test and verify it fails**

Run:

```bash
pnpm exec vitest run test/unit/app/utils/pypi-admin.spec.ts
```

Expected: FAIL because `~/utils/pypi-admin` does not exist.

- [ ] **Step 3: Implement the utility**

Create `app/utils/pypi-admin.ts`:

```ts
export interface GitHubRepository {
  owner: string
  repo: string
}

export interface TrustedPublishingWorkflowOptions {
  environment?: string
  pythonVersion?: string
}

const PYPI_BASE_URL = 'https://pypi.org'
const PYPI_DOCS_BASE_URL = 'https://docs.pypi.org'

function encodeProjectName(projectName: string) {
  return encodeURIComponent(projectName.trim())
}

export function getPyPIProjectsUrl() {
  return `${PYPI_BASE_URL}/manage/projects/`
}

export function getPyPIOrganizationsUrl() {
  return `${PYPI_BASE_URL}/manage/organizations/`
}

export function getPyPIAccountPublishingUrl() {
  return `${PYPI_BASE_URL}/manage/account/publishing/`
}

export function getPyPIProjectPageUrl(projectName: string) {
  return `${PYPI_BASE_URL}/project/${encodeProjectName(projectName)}/`
}

export function getPyPIProjectManageUrl(projectName: string) {
  return `${PYPI_BASE_URL}/manage/project/${encodeProjectName(projectName)}/`
}

export function getPyPIProjectPublishingUrl(projectName: string) {
  return `${getPyPIProjectManageUrl(projectName)}settings/publishing/`
}

export function getTrustedPublishingDocsUrl() {
  return `${PYPI_DOCS_BASE_URL}/trusted-publishers/`
}

export function getTrustedPublishingExistingProjectDocsUrl() {
  return `${PYPI_DOCS_BASE_URL}/trusted-publishers/adding-a-publisher/`
}

export function getTrustedPublishingPendingProjectDocsUrl() {
  return `${PYPI_DOCS_BASE_URL}/trusted-publishers/creating-a-project-through-oidc/`
}

export function getPublishingGuidePath() {
  return '/publishing'
}

export function parseGitHubRepositoryUrl(url: string | null | undefined): GitHubRepository | null {
  if (!url) return null

  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.hostname !== 'github.com') return null

    const [owner, rawRepo] = parsedUrl.pathname.split('/').filter(Boolean)
    if (!owner || !rawRepo) return null

    return {
      owner,
      repo: rawRepo.replace(/\.git$/, ''),
    }
  } catch {
    return null
  }
}

export function createTrustedPublishingWorkflow(options: TrustedPublishingWorkflowOptions = {}) {
  const environment = options.environment ?? 'pypi'
  const pythonVersion = options.pythonVersion ?? '3.x'

  return `name: release

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: ${environment}
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "${pythonVersion}"
      - name: Install build tooling
        run: python -m pip install --upgrade build
      - name: Build distributions
        run: python -m build
      - name: Publish to PyPI
        uses: pypa/gh-action-pypi-publish@release/v1
`
}
```

- [ ] **Step 4: Run the unit test and verify it passes**

Run:

```bash
pnpm exec vitest run test/unit/app/utils/pypi-admin.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/utils/pypi-admin.ts test/unit/app/utils/pypi-admin.spec.ts
git commit -m "feat: add PyPI admin action utilities"
```

---

### Task 2: Add i18n Copy for Official PyPI Admin Actions

**Files:**

- Modify: `i18n/locales/en.json`

- [ ] **Step 1: Add translation keys**

In `i18n/locales/en.json`, add this object under the existing top-level keys:

```json
"pypi_admin": {
  "actions": {
    "manage_projects": "Manage projects",
    "manage_project": "Manage project",
    "project_page": "View on PyPI",
    "trusted_publisher": "Configure Trusted Publisher",
    "pending_publisher": "Create pending publisher",
    "publishing_guide": "Publishing guide",
    "organizations": "Organizations"
  },
  "descriptions": {
    "manage_projects": "Open official PyPI project admin",
    "manage_project": "Open this project in official PyPI admin",
    "project_page": "Open the public PyPI project page",
    "trusted_publisher": "Configure OIDC publishing on PyPI",
    "pending_publisher": "Prepare publishing for a project that does not exist yet",
    "publishing_guide": "Generate the no-token GitHub Actions workflow",
    "organizations": "Manage PyPI organizations and teams on pypi.org"
  },
  "guide": {
    "title": "Publishing to PyPI",
    "subtitle": "Use official PyPI admin for account actions. pypix.dev can guide the workflow, but it does not store PyPI tokens or mutate PyPI accounts.",
    "trusted_publishing": "Trusted Publishing",
    "trusted_publishing_body": "Use PyPI Trusted Publishing to publish from CI with short-lived OIDC credentials instead of long-lived API tokens.",
    "official_actions": "Official PyPI actions",
    "github_workflow": "GitHub Actions workflow",
    "copy_workflow": "Copy workflow",
    "copied": "Copied",
    "no_tokens": "No PyPI token is needed for this workflow after the trusted publisher is configured on PyPI."
  }
}
```

- [ ] **Step 2: Run i18n-related tests**

Run:

```bash
pnpm exec vp test --project nuxt test/nuxt/components/HeaderAccountMenu.spec.ts
```

Expected: PASS with no missing translation warnings for `pypi_admin.*`.

- [ ] **Step 3: Commit**

```bash
git add i18n/locales/en.json
git commit -m "feat: add PyPI admin action copy"
```

---

### Task 3: Build Reusable PyPI Admin Actions Component

**Files:**

- Create: `app/components/PyPI/AdminActions.vue`
- Create: `test/nuxt/components/PyPI/AdminActions.spec.ts`

- [ ] **Step 1: Write failing component tests**

Create `test/nuxt/components/PyPI/AdminActions.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { PyPIAdminActions } from '#components'

describe('PyPIAdminActions', () => {
  it('shows global PyPI admin actions without npm or Atmosphere copy', async () => {
    const wrapper = await mountSuspended(PyPIAdminActions)

    expect(wrapper.text()).toContain('Manage projects')
    expect(wrapper.text()).toContain('Configure Trusted Publisher')
    expect(wrapper.text()).toContain('Create pending publisher')
    expect(wrapper.text()).toContain('Publishing guide')
    expect(wrapper.text()).toContain('Organizations')
    expect(wrapper.text()).not.toContain('npm CLI')
    expect(wrapper.text()).not.toContain('Atmosphere')
  })

  it('uses project-specific links when packageName is provided', async () => {
    const wrapper = await mountSuspended(PyPIAdminActions, {
      props: {
        packageName: 'requests',
      },
    })

    const links = wrapper.findAll('a').map(link => link.attributes('href'))

    expect(links).toContain('https://pypi.org/project/requests/')
    expect(links).toContain('https://pypi.org/manage/project/requests/')
    expect(links).toContain('https://pypi.org/manage/project/requests/settings/publishing/')
  })
})
```

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```bash
pnpm exec vp test --project nuxt test/nuxt/components/PyPI/AdminActions.spec.ts
```

Expected: FAIL because `PyPIAdminActions` does not exist.

- [ ] **Step 3: Implement the component**

Create `app/components/PyPI/AdminActions.vue`:

```vue
<script setup lang="ts">
import {
  getPublishingGuidePath,
  getPyPIAccountPublishingUrl,
  getPyPIOrganizationsUrl,
  getPyPIProjectManageUrl,
  getPyPIProjectPageUrl,
  getPyPIProjectPublishingUrl,
  getPyPIProjectsUrl,
  getTrustedPublishingDocsUrl,
} from '~/utils/pypi-admin'

const props = defineProps<{
  packageName?: string | null
}>()

const { t } = useI18n()

const projectName = computed(() => props.packageName?.trim() || null)

const actions = computed(() => [
  ...(projectName.value
    ? [
        {
          id: 'project-page',
          label: t('pypi_admin.actions.project_page'),
          description: t('pypi_admin.descriptions.project_page'),
          icon: 'i-simple-icons:pypi',
          href: getPyPIProjectPageUrl(projectName.value),
        },
        {
          id: 'manage-project',
          label: t('pypi_admin.actions.manage_project'),
          description: t('pypi_admin.descriptions.manage_project'),
          icon: 'i-lucide:settings',
          href: getPyPIProjectManageUrl(projectName.value),
        },
        {
          id: 'trusted-publisher',
          label: t('pypi_admin.actions.trusted_publisher'),
          description: t('pypi_admin.descriptions.trusted_publisher'),
          icon: 'i-lucide:key-round',
          href: getPyPIProjectPublishingUrl(projectName.value),
        },
      ]
    : [
        {
          id: 'manage-projects',
          label: t('pypi_admin.actions.manage_projects'),
          description: t('pypi_admin.descriptions.manage_projects'),
          icon: 'i-simple-icons:pypi',
          href: getPyPIProjectsUrl(),
        },
        {
          id: 'trusted-publisher-docs',
          label: t('pypi_admin.actions.trusted_publisher'),
          description: t('pypi_admin.descriptions.trusted_publisher'),
          icon: 'i-lucide:key-round',
          href: getTrustedPublishingDocsUrl(),
        },
      ]),
  {
    id: 'pending-publisher',
    label: t('pypi_admin.actions.pending_publisher'),
    description: t('pypi_admin.descriptions.pending_publisher'),
    icon: 'i-lucide:package-plus',
    href: getPyPIAccountPublishingUrl(),
  },
  {
    id: 'publishing-guide',
    label: t('pypi_admin.actions.publishing_guide'),
    description: t('pypi_admin.descriptions.publishing_guide'),
    icon: 'i-lucide:book-open',
    to: getPublishingGuidePath(),
  },
  {
    id: 'organizations',
    label: t('pypi_admin.actions.organizations'),
    description: t('pypi_admin.descriptions.organizations'),
    icon: 'i-lucide:building-2',
    href: getPyPIOrganizationsUrl(),
  },
])
</script>

<template>
  <div class="py-1">
    <LinkBase
      v-for="action in actions"
      :key="action.id"
      :to="'to' in action ? action.to : action.href"
      role="menuitem"
      no-underline
      class="w-full flex items-center gap-x-3 px-3 py-2 rounded-md hover:bg-bg-muted transition-colors duration-200"
    >
      <span class="w-8 h-8 rounded-full bg-bg-muted flex items-center justify-center">
        <span :class="action.icon" class="w-4 h-4 text-fg-muted" aria-hidden="true" />
      </span>
      <span class="flex-1 min-w-0">
        <span class="font-mono text-sm text-fg block">{{ action.label }}</span>
        <span class="text-xs text-fg-subtle">{{ action.description }}</span>
      </span>
      <span
        v-if="'href' in action"
        class="i-lucide:external-link w-3 h-3 text-fg-subtle"
        aria-hidden="true"
      />
    </LinkBase>
  </div>
</template>
```

- [ ] **Step 4: Run the component test and verify it passes**

Run:

```bash
pnpm exec vp test --project nuxt test/nuxt/components/PyPI/AdminActions.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/PyPI/AdminActions.vue test/nuxt/components/PyPI/AdminActions.spec.ts
git commit -m "feat: add PyPI admin actions component"
```

---

### Task 4: Wire Header and Mobile Connect Menus to PyPI Admin Actions

**Files:**

- Modify: `app/components/Header/AccountMenu.client.vue`
- Modify: `app/components/Header/MobileMenu.client.vue`
- Modify: `test/nuxt/components/HeaderAccountMenu.spec.ts`
- Modify: `test/nuxt/components/Header/MobileMenu.spec.ts`

- [ ] **Step 1: Update header test**

In `test/nuxt/components/HeaderAccountMenu.spec.ts`, replace the assertions with:

```ts
expect(wrapper.text()).toContain('Manage projects')
expect(wrapper.text()).toContain('Configure Trusted Publisher')
expect(wrapper.text()).toContain('Create pending publisher')
expect(wrapper.text()).toContain('Publishing guide')
expect(wrapper.text()).toContain('Organizations')
expect(wrapper.text()).not.toContain('npm CLI')
expect(wrapper.text()).not.toContain('Atmosphere')
```

- [ ] **Step 2: Add or update mobile menu test**

In `test/nuxt/components/Header/MobileMenu.spec.ts`, add:

```ts
it('shows official PyPI admin actions in the mobile account section', async () => {
  const wrapper = await mountSuspended(HeaderMobileMenu, {
    props: {
      open: true,
      links: [],
    },
    attachTo: document.body,
  })

  try {
    expect(wrapper.text()).toContain('Manage projects')
    expect(wrapper.text()).toContain('Configure Trusted Publisher')
    expect(wrapper.text()).toContain('Create pending publisher')
    expect(wrapper.text()).toContain('Publishing guide')
    expect(wrapper.text()).toContain('Organizations')
    expect(wrapper.text()).not.toContain('npm CLI')
    expect(wrapper.text()).not.toContain('Atmosphere')
  } finally {
    wrapper.unmount()
  }
})
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
pnpm exec vp test --project nuxt test/nuxt/components/HeaderAccountMenu.spec.ts test/nuxt/components/Header/MobileMenu.spec.ts
```

Expected: FAIL because header/mobile still render only one PyPI admin link.

- [ ] **Step 4: Update desktop account menu**

In `app/components/Header/AccountMenu.client.vue`, replace the inner menu content:

```vue
<div
  class="bg-bg-subtle/80 backdrop-blur-sm border border-border-subtle rounded-lg shadow-lg shadow-bg-elevated/50 overflow-hidden px-1"
>
  <PyPIAdminActions @click="isOpen = false" />
</div>
```

If Vue event forwarding does not close the menu reliably, wrap the component:

```vue
<div
  class="bg-bg-subtle/80 backdrop-blur-sm border border-border-subtle rounded-lg shadow-lg shadow-bg-elevated/50 overflow-hidden px-1"
  @click="isOpen = false"
>
  <PyPIAdminActions />
</div>
```

- [ ] **Step 5: Update mobile menu account section**

In `app/components/Header/MobileMenu.client.vue`, replace the single `LinkBase` under account section with:

```vue
<div @click="closeMenu">
  <PyPIAdminActions />
</div>
```

- [ ] **Step 6: Run tests and verify they pass**

Run:

```bash
pnpm exec vp test --project nuxt test/nuxt/components/HeaderAccountMenu.spec.ts test/nuxt/components/Header/MobileMenu.spec.ts test/nuxt/components/PyPI/AdminActions.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/components/Header/AccountMenu.client.vue app/components/Header/MobileMenu.client.vue test/nuxt/components/HeaderAccountMenu.spec.ts test/nuxt/components/Header/MobileMenu.spec.ts
git commit -m "feat: expand connect menu with official PyPI actions"
```

---

### Task 5: Add Publishing Guide Page With Copyable Trusted Publishing Workflow

**Files:**

- Create: `app/pages/publishing.vue`
- Test: `test/nuxt/pages/PublishingPage.spec.ts`

- [ ] **Step 1: Write failing page test**

Create `test/nuxt/pages/PublishingPage.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PublishingPage from '~/pages/publishing.vue'

describe('PublishingPage', () => {
  it('explains official PyPI publishing without asking for tokens', async () => {
    const wrapper = await mountSuspended(PublishingPage)

    expect(wrapper.text()).toContain('Publishing to PyPI')
    expect(wrapper.text()).toContain('Trusted Publishing')
    expect(wrapper.text()).toContain('No PyPI token is needed')
    expect(wrapper.text()).toContain('pypa/gh-action-pypi-publish@release/v1')
    expect(wrapper.text()).toContain('id-token: write')
    expect(wrapper.text()).not.toContain('PYPI_TOKEN')
  })
})
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
pnpm exec vp test --project nuxt test/nuxt/pages/PublishingPage.spec.ts
```

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement the page**

Create `app/pages/publishing.vue`:

```vue
<script setup lang="ts">
import {
  createTrustedPublishingWorkflow,
  getPyPIAccountPublishingUrl,
  getPyPIOrganizationsUrl,
  getPyPIProjectsUrl,
  getTrustedPublishingDocsUrl,
  getTrustedPublishingExistingProjectDocsUrl,
  getTrustedPublishingPendingProjectDocsUrl,
} from '~/utils/pypi-admin'

const { t } = useI18n()
const { copied, copy } = useClipboard({ copiedDuring: 2000 })

const workflow = createTrustedPublishingWorkflow({ environment: 'pypi' })
</script>

<template>
  <main class="container mx-auto px-4 py-8 max-w-4xl">
    <header class="mb-8">
      <h1 class="font-mono text-2xl text-fg">
        {{ t('pypi_admin.guide.title') }}
      </h1>
      <p class="mt-3 text-sm text-fg-muted max-w-2xl">
        {{ t('pypi_admin.guide.subtitle') }}
      </p>
    </header>

    <section class="mb-8">
      <h2 class="font-mono text-lg text-fg">
        {{ t('pypi_admin.guide.official_actions') }}
      </h2>
      <div class="mt-4 grid gap-2 sm:grid-cols-2">
        <LinkBase
          :to="getPyPIProjectsUrl()"
          class="p-3 rounded border border-border hover:bg-bg-subtle"
        >
          {{ t('pypi_admin.actions.manage_projects') }}
        </LinkBase>
        <LinkBase
          :to="getPyPIAccountPublishingUrl()"
          class="p-3 rounded border border-border hover:bg-bg-subtle"
        >
          {{ t('pypi_admin.actions.pending_publisher') }}
        </LinkBase>
        <LinkBase
          :to="getPyPIOrganizationsUrl()"
          class="p-3 rounded border border-border hover:bg-bg-subtle"
        >
          {{ t('pypi_admin.actions.organizations') }}
        </LinkBase>
        <LinkBase
          :to="getTrustedPublishingDocsUrl()"
          class="p-3 rounded border border-border hover:bg-bg-subtle"
        >
          {{ t('pypi_admin.actions.trusted_publisher') }}
        </LinkBase>
        <LinkBase
          :to="getTrustedPublishingExistingProjectDocsUrl()"
          class="p-3 rounded border border-border hover:bg-bg-subtle"
        >
          Existing project docs
        </LinkBase>
        <LinkBase
          :to="getTrustedPublishingPendingProjectDocsUrl()"
          class="p-3 rounded border border-border hover:bg-bg-subtle"
        >
          Pending project docs
        </LinkBase>
      </div>
    </section>

    <section>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-mono text-lg text-fg">
            {{ t('pypi_admin.guide.github_workflow') }}
          </h2>
          <p class="mt-1 text-sm text-fg-muted">
            {{ t('pypi_admin.guide.no_tokens') }}
          </p>
        </div>
        <ButtonBase type="button" @click="copy(workflow)">
          {{ copied ? t('pypi_admin.guide.copied') : t('pypi_admin.guide.copy_workflow') }}
        </ButtonBase>
      </div>
      <pre
        class="mt-4 overflow-auto rounded border border-border bg-bg-subtle p-4 text-xs"
      ><code>{{ workflow }}</code></pre>
    </section>
  </main>
</template>
```

- [ ] **Step 4: Run test and verify it passes**

Run:

```bash
pnpm exec vp test --project nuxt test/nuxt/pages/PublishingPage.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/pages/publishing.vue test/nuxt/pages/PublishingPage.spec.ts
git commit -m "feat: add PyPI publishing guide"
```

---

### Task 6: Add Contextual Package Page Admin Actions

**Files:**

- Modify: `app/components/Package/Header.vue`
- Test: `test/nuxt/components/Package/Header.spec.ts`

- [ ] **Step 1: Add failing package header test**

In `test/nuxt/components/Package/Header.spec.ts`, add:

```ts
it('shows contextual official PyPI admin actions for the package', async () => {
  const wrapper = await mountSuspended(PackageHeader, {
    props: {
      packageName: 'requests',
      resolvedVersion: '2.32.3',
    },
  })

  expect(wrapper.text()).toContain('Manage project')
  expect(wrapper.text()).toContain('Configure Trusted Publisher')

  const links = wrapper.findAll('a').map(link => link.attributes('href'))
  expect(links).toContain('https://pypi.org/project/requests/')
  expect(links).toContain('https://pypi.org/manage/project/requests/')
  expect(links).toContain('https://pypi.org/manage/project/requests/settings/publishing/')
})
```

- [ ] **Step 2: Run package header test and verify it fails**

Run:

```bash
pnpm exec vp test --project nuxt test/nuxt/components/Package/Header.spec.ts
```

Expected: FAIL because contextual admin actions are not rendered in the package header.

- [ ] **Step 3: Render the component in package header**

In `app/components/Package/Header.vue`, add the action list near the existing external/action controls, keeping it compact:

```vue
<div v-if="packageName" class="mt-4">
  <PyPIAdminActions :package-name="packageName" />
</div>
```

If the package header is too visually dense, wrap it in an existing dropdown pattern instead of placing it inline. Keep the same `PyPIAdminActions` component so behavior remains tested once.

- [ ] **Step 4: Run package header test and verify it passes**

Run:

```bash
pnpm exec vp test --project nuxt test/nuxt/components/Package/Header.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/Package/Header.vue test/nuxt/components/Package/Header.spec.ts
git commit -m "feat: add contextual PyPI admin actions to package pages"
```

---

### Task 7: Expand Command Palette PyPI Admin Commands

**Files:**

- Modify: `app/composables/useCommandPaletteGlobalCommands.ts`
- Modify: `test/nuxt/composables/use-command-palette-commands.spec.ts`

- [ ] **Step 1: Update command palette tests**

In `test/nuxt/composables/use-command-palette-commands.spec.ts`, add or update assertions:

```ts
const commands = globalCommands.value

expect(commands.find(command => command.id === 'pypi-manage-projects')).toMatchObject({
  href: 'https://pypi.org/manage/projects/',
})
expect(commands.find(command => command.id === 'pypi-trusted-publishing')).toMatchObject({
  to: '/publishing',
})
expect(commands.find(command => command.id === 'pypi-organizations')).toMatchObject({
  href: 'https://pypi.org/manage/organizations/',
})
expect(commands.find(command => command.id === 'pypi-pending-publisher')).toMatchObject({
  href: 'https://pypi.org/manage/account/publishing/',
})
expect(commands.some(command => command.label.includes('Atmosphere'))).toBe(false)
expect(commands.some(command => command.label.includes('npm CLI'))).toBe(false)
```

- [ ] **Step 2: Run command palette test and verify it fails**

Run:

```bash
pnpm exec vp test --project nuxt test/nuxt/composables/use-command-palette-commands.spec.ts
```

Expected: FAIL because only `pypi-admin` exists.

- [ ] **Step 3: Replace single command with multiple official commands**

In `app/composables/useCommandPaletteGlobalCommands.ts`, import utility functions:

```ts
import {
  getPublishingGuidePath,
  getPyPIAccountPublishingUrl,
  getPyPIOrganizationsUrl,
  getPyPIProjectsUrl,
} from '~/utils/pypi-admin'
```

Replace the current `pypi-admin` command with:

```ts
{
  id: 'pypi-manage-projects',
  group: 'connections',
  label: t('pypi_admin.actions.manage_projects'),
  keywords: [t('pypi_admin.descriptions.manage_projects'), 'PyPI', 'admin'],
  iconClass: 'i-simple-icons:pypi',
  href: getPyPIProjectsUrl(),
},
{
  id: 'pypi-trusted-publishing',
  group: 'connections',
  label: t('pypi_admin.actions.trusted_publisher'),
  keywords: [t('pypi_admin.descriptions.trusted_publisher'), 'OIDC', 'publish'],
  iconClass: 'i-lucide:key-round',
  to: getPublishingGuidePath(),
},
{
  id: 'pypi-pending-publisher',
  group: 'connections',
  label: t('pypi_admin.actions.pending_publisher'),
  keywords: [t('pypi_admin.descriptions.pending_publisher'), 'OIDC', 'new project'],
  iconClass: 'i-lucide:package-plus',
  href: getPyPIAccountPublishingUrl(),
},
{
  id: 'pypi-organizations',
  group: 'connections',
  label: t('pypi_admin.actions.organizations'),
  keywords: [t('pypi_admin.descriptions.organizations'), 'teams', 'members'],
  iconClass: 'i-lucide:building-2',
  href: getPyPIOrganizationsUrl(),
},
```

- [ ] **Step 4: Run command palette test and verify it passes**

Run:

```bash
pnpm exec vp test --project nuxt test/nuxt/composables/use-command-palette-commands.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useCommandPaletteGlobalCommands.ts test/nuxt/composables/use-command-palette-commands.spec.ts
git commit -m "feat: add PyPI admin command palette actions"
```

---

### Task 8: Final Verification and Browser Check

**Files:**

- Verify only.

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm exec vp test --project nuxt test/nuxt/components/HeaderAccountMenu.spec.ts test/nuxt/components/Header/MobileMenu.spec.ts test/nuxt/components/PyPI/AdminActions.spec.ts test/nuxt/composables/use-command-palette-commands.spec.ts test/nuxt/pages/PublishingPage.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run unit utility tests**

Run:

```bash
pnpm exec vitest run test/unit/app/utils/pypi-admin.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm test:types
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
pnpm run build
```

Expected: PASS. Existing Atproto/JWK warnings may still appear until that legacy subsystem is removed, but this feature must not add new PyPI admin warnings.

- [ ] **Step 5: Browser verification**

Open the local app and verify:

- Header `connect` menu shows `Manage projects`, `Configure Trusted Publisher`, `Create pending publisher`, `Publishing guide`, and `Organizations`.
- Header `connect` menu does not show `npm CLI` or `Atmosphere`.
- `/publishing` renders the guide and workflow.
- Package page for `/package/requests` shows contextual PyPI project/admin/publishing links.
- No UI asks for a PyPI token.

- [ ] **Step 6: Commit final test adjustments if needed**

```bash
git add app test i18n
git commit -m "test: verify PyPI admin action flow"
```

---

## Self-Review

Spec coverage:

- `Configure Trusted Publisher`: covered by project-specific link, docs fallback, command palette command, and publishing guide.
- `View publishing guide`: covered by `/publishing` page, header/mobile action, and command palette command.
- `Open PyPI organizations`: covered by action component, header/mobile, command palette, and guide page.
- `Agregar lo más posible que se permita`: covered by project page, project admin, projects admin, pending publisher, organizations, docs, and GitHub Actions workflow generation.
- No private admin integration: explicitly blocked in scope and reflected in UI copy.

Placeholder scan:

- No `TBD`, `TODO`, or vague implementation steps remain.
- Every code step includes concrete code or exact assertions.

Type consistency:

- Utility names used by components and tests match `app/utils/pypi-admin.ts`.
- Command IDs are stable and unique.
- Translation keys use the `pypi_admin.*` namespace consistently.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-06-pypi-admin-actions.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh worker per task, review between tasks, faster iteration.
2. **Inline Execution** - Execute tasks in this session using `executing-plans`, with checkpoints after each task group.
