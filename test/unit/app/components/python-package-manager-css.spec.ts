import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Python package manager CSS selectors', () => {
  it('shows selected Python install commands through data-pm selectors', () => {
    const source = readFileSync('app/components/Terminal/Install.vue', 'utf8')

    for (const packageManager of ['uv', 'pip', 'poetry', 'pipenv', 'conda']) {
      expect(source).toContain(`:root[data-pm='${packageManager}']`)
      expect(source).toContain(`[data-pm-cmd='${packageManager}']`)
    }
    expect(source).toContain("[data-pm-cmd='uv']")
  })

  it('shows the selected Python package manager label through data-pm selectors', () => {
    const source = readFileSync('app/components/Package/ManagerSelect.vue', 'utf8')

    for (const packageManager of ['uv', 'pip', 'poetry', 'pipenv', 'conda']) {
      expect(source).toContain(`:root[data-pm='${packageManager}']`)
      expect(source).toContain(`[data-pm-select='${packageManager}']`)
    }
    expect(source).toContain("[data-pm-select='uv']")
  })
})
