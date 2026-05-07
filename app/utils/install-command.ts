import type { PythonVersionStyle } from '~/composables/useSettings'

// @unocss-include
export const packageManagers = [
  {
    id: 'uv',
    label: 'uv',
    action: 'add',
    executeLocal: 'uv run',
    executeRemote: 'uvx',
    create: 'uvx',
    icon: 'i-lucide:zap',
  },
  {
    id: 'pip',
    label: 'pip',
    action: 'install',
    executeLocal: 'python -m',
    executeRemote: 'python -m',
    create: 'python -m',
    icon: 'i-simple-icons:pypi',
  },
  {
    id: 'poetry',
    label: 'poetry',
    action: 'add',
    executeLocal: 'poetry run',
    executeRemote: 'poetry run',
    create: 'poetry run',
    icon: 'i-lucide:music',
  },
  {
    id: 'pipenv',
    label: 'pipenv',
    action: 'install',
    executeLocal: 'pipenv run',
    executeRemote: 'pipenv run',
    create: 'pipenv run',
    icon: 'i-lucide:box',
  },
  {
    id: 'conda',
    label: 'conda',
    action: 'install',
    executeLocal: 'conda run',
    executeRemote: 'conda run',
    create: 'conda run',
    icon: 'i-lucide:blocks',
  },
] as const

export type PackageManagerId = (typeof packageManagers)[number]['id']

export interface InstallCommandOptions {
  packageName: string
  packageManager: PackageManagerId
  version?: string | null
  versionStyle?: PythonVersionStyle
  dev?: boolean
}

export function getDevDependencyFlag(packageManager: PackageManagerId): '--dev' | null {
  return packageManager === 'uv' || packageManager === 'poetry' || packageManager === 'pipenv'
    ? '--dev'
    : null
}

export function getPackageSpecifier(options: InstallCommandOptions): string {
  const shouldPin = options.version && options.versionStyle === 'exact'
  return shouldPin ? `${options.packageName}==${options.version}` : options.packageName
}

export function getInstallCommand(options: InstallCommandOptions): string {
  return getInstallCommandParts(options).join(' ')
}

export function getInstallCommandParts(options: InstallCommandOptions): string[] {
  const pm = packageManagers.find(p => p.id === options.packageManager)
  if (!pm) return []

  const devFlag = options.dev ? getDevDependencyFlag(options.packageManager) : null
  const spec = getPackageSpecifier(options)

  if (pm.id === 'pip') {
    return ['python', '-m', 'pip', pm.action, ...(devFlag ? [devFlag] : []), spec]
  }

  return [pm.label, pm.action, ...(devFlag ? [devFlag] : []), spec]
}

export interface ExecuteCommandOptions extends InstallCommandOptions {
  /** Whether this is a binary-only package (download & run vs local run) */
  isBinaryOnly?: boolean
  /** Whether this is a create-* package */
  isCreatePackage?: boolean
  /** Optional executable command exposed by the package */
  command?: string
}

export function getExecuteCommand(options: ExecuteCommandOptions): string {
  return getExecuteCommandParts(options).join(' ')
}

export function getExecuteCommandParts(options: ExecuteCommandOptions): string[] {
  const pm = packageManagers.find(p => p.id === options.packageManager)
  if (!pm) return []

  const executable = options.command || options.packageName

  if (pm.id === 'uv') {
    return options.isBinaryOnly ? ['uvx', executable] : ['uv', 'run', executable]
  }
  if (pm.id === 'pip') {
    return ['python', '-m', executable]
  }
  if (pm.id === 'poetry') {
    return ['poetry', 'run', executable]
  }
  if (pm.id === 'pipenv') {
    return ['pipenv', 'run', executable]
  }
  return ['conda', 'run', executable]
}
