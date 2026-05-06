export type ShowcasedFramework = {
  name: string
  package: string
  color: string
}

export const SHOWCASED_FRAMEWORKS = [
  {
    name: 'django',
    package: 'django',
    color: 'oklch(0.5205 0.132 160.37)',
  },
  { name: 'fastapi', package: 'fastapi', color: 'oklch(0.7025 0.132 160.37)' },
  {
    name: 'flask',
    package: 'flask',
    color: 'oklch(0.7862 0.192 155.63)',
  },
  {
    name: 'requests',
    package: 'requests',
    color: 'oklch(0.832 0.1167 218.69)',
  },
  {
    name: 'pydantic',
    package: 'pydantic',
    color: 'oklch(0.6917 0.1865 35.04)',
  },
  {
    name: 'numpy',
    package: 'numpy',
    color: 'oklch(0.7484 0.1439 294.03)',
  },
  {
    name: 'pandas',
    package: 'pandas',
    color: 'oklch(71.7% .1648 250.794)',
  },
  {
    name: 'pytest',
    package: 'pytest',
    color: 'oklch(0.5295 0.2434 270.23)',
  },
  {
    name: 'sqlalchemy',
    package: 'sqlalchemy',
    color: 'oklch(0.5671 0.1399 253.3)',
  },
  {
    name: 'ruff',
    package: 'ruff',
    color: 'oklch(0.626 0.2663 310.4)',
  },
  {
    name: 'uvicorn',
    package: 'uvicorn',
    color: 'oklch(0.5205 0.2035 21.88)',
  },
  {
    name: 'typer',
    package: 'typer',
    color: 'oklch(0.4237 0.0857 255.45)',
  },
  {
    name: 'httpx',
    package: 'httpx',
    color: 'oklch(60.9% .126 221.723)',
  },
  {
    name: 'better-auth-py',
    package: 'better-auth-py',
    color: 'oklch(67.88% 0.2222 5.18)',
  },
]

export type FrameworkPackageName = (typeof SHOWCASED_FRAMEWORKS)[number]['package']

export function getFrameworkColor(framework: FrameworkPackageName): string {
  return SHOWCASED_FRAMEWORKS.find(f => f.package === framework)!.color
}

export function isListedFramework(name: string): name is FrameworkPackageName {
  return SHOWCASED_FRAMEWORKS.some(f => f.package === name)
}
