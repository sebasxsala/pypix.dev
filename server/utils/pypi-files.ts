import { gunzipSync, inflateRawSync } from 'node:zlib'
import type { PypiProjectFile } from '#server/utils/pypi-package'

const ZIP_EOCD_SIGNATURE = 0x06054b50
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50
const TAR_BLOCK_SIZE = 512
const NULL_BYTE = '\u0000'

export interface PypiArchiveEntry {
  path: string
  size: number
  content?: Buffer
}

export type PypiFilePreference = 'all' | 'wheels' | 'sdist'

function isInspectableFilename(filename: string | undefined): boolean {
  return (
    !!filename &&
    (filename.endsWith('.tar.gz') ||
      filename.endsWith('.tgz') ||
      filename.endsWith('.whl') ||
      filename.endsWith('.zip'))
  )
}

export function pickPypiInspectableFile(
  files: PypiProjectFile[] | undefined,
  preference: PypiFilePreference = 'all',
): PypiProjectFile | undefined {
  if (!files?.length) return undefined
  const sdist = files.find(
    file => file.packagetype === 'sdist' && isInspectableFilename(file.filename) && file.url,
  )
  const wheel = files.find(
    file => file.packagetype === 'bdist_wheel' && isInspectableFilename(file.filename) && file.url,
  )

  if (preference === 'sdist') {
    return sdist ?? wheel ?? files.find(file => isInspectableFilename(file.filename) && file.url)
  }
  if (preference === 'wheels') {
    return wheel ?? sdist ?? files.find(file => isInspectableFilename(file.filename) && file.url)
  }

  return sdist ?? wheel ?? files.find(file => isInspectableFilename(file.filename) && file.url)
}

function parseTarString(buffer: Buffer, start: number, length: number): string {
  const end = buffer.indexOf(0, start)
  const actualEnd = end === -1 || end > start + length ? start + length : end
  return buffer.toString('utf8', start, actualEnd).trim()
}

function parseTarOctal(buffer: Buffer, start: number, length: number): number {
  const raw = parseTarString(buffer, start, length).replaceAll(NULL_BYTE, '').trim()
  return raw ? parseInt(raw, 8) : 0
}

function isEmptyTarBlock(buffer: Buffer, offset: number): boolean {
  for (let i = 0; i < TAR_BLOCK_SIZE; i++) {
    if (buffer[offset + i] !== 0) return false
  }
  return true
}

function extractTarEntries(archive: Buffer): PypiArchiveEntry[] {
  const buffer = gunzipSync(archive)
  const entries: PypiArchiveEntry[] = []
  let offset = 0
  let longName: string | null = null

  while (offset + TAR_BLOCK_SIZE <= buffer.length && !isEmptyTarBlock(buffer, offset)) {
    const name = longName ?? parseTarString(buffer, offset, 100)
    const prefix = parseTarString(buffer, offset + 345, 155)
    const fullName = prefix ? `${prefix}/${name}` : name
    const size = parseTarOctal(buffer, offset + 124, 12)
    const typeflag = buffer.toString('ascii', offset + 156, offset + 157)
    const contentStart = offset + TAR_BLOCK_SIZE
    const contentEnd = contentStart + size
    const content = buffer.subarray(contentStart, contentEnd)

    if (typeflag === 'L') {
      longName = content.toString('utf8').split(NULL_BYTE, 1)[0] ?? ''
    } else {
      longName = null
      if ((typeflag === '0' || typeflag === '\0' || typeflag === '') && fullName) {
        entries.push({ path: fullName.replace(/^\.\//, ''), size, content })
      }
    }

    offset = contentStart + Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE
  }

  return entries
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 65_557)
  for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
    if (buffer.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) return offset
  }
  throw createError({ statusCode: 422, message: 'Invalid zip archive' })
}

function extractZipEntry(
  buffer: Buffer,
  localHeaderOffset: number,
  compressedSize: number,
  method: number,
): Buffer {
  if (buffer.readUInt32LE(localHeaderOffset) !== ZIP_LOCAL_FILE_SIGNATURE) {
    throw createError({ statusCode: 422, message: 'Invalid zip local file header' })
  }

  const nameLength = buffer.readUInt16LE(localHeaderOffset + 26)
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28)
  const dataStart = localHeaderOffset + 30 + nameLength + extraLength
  const compressed = buffer.subarray(dataStart, dataStart + compressedSize)

  if (method === 0) return compressed
  if (method === 8) return inflateRawSync(compressed)
  throw createError({ statusCode: 415, message: `Unsupported zip compression method: ${method}` })
}

function extractZipEntries(buffer: Buffer): PypiArchiveEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer)
  const entryCount = buffer.readUInt16LE(eocdOffset + 10)
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16)
  const entries: PypiArchiveEntry[] = []
  let offset = centralDirectoryOffset

  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw createError({ statusCode: 422, message: 'Invalid zip central directory' })
    }

    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const uncompressedSize = buffer.readUInt32LE(offset + 24)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)

    if (name && !name.endsWith('/')) {
      entries.push({
        path: name.replace(/^\.\//, ''),
        size: uncompressedSize,
        content: extractZipEntry(buffer, localHeaderOffset, compressedSize, method),
      })
    }

    offset += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

export async function extractPypiArchiveEntries(
  archive: Buffer,
  filename: string,
): Promise<PypiArchiveEntry[]> {
  if (filename.endsWith('.tar.gz') || filename.endsWith('.tgz')) return extractTarEntries(archive)
  if (filename.endsWith('.whl') || filename.endsWith('.zip')) return extractZipEntries(archive)
  throw createError({ statusCode: 415, message: `Unsupported PyPI archive type: ${filename}` })
}

function getArchiveRoot(paths: string[]): string | null {
  const firstSegments = paths.map(path => path.split('/')[0]).filter(Boolean)
  if (!firstSegments.length) return null
  const root = firstSegments[0]
  return root && firstSegments.every(segment => segment === root) ? root : null
}

function stripArchiveRoot(entries: PypiArchiveEntry[]): PypiArchiveEntry[] {
  const root = getArchiveRoot(entries.map(entry => entry.path))
  if (!root) return entries

  return entries
    .map(entry => ({ ...entry, path: entry.path.slice(root.length + 1) }))
    .filter(entry => entry.path)
}

function sortFileTree(nodes: PackageFileTree[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const node of nodes) {
    if (node.children) sortFileTree(node.children)
  }
}

export function buildPypiFileTree(
  entries: Array<Pick<PypiArchiveEntry, 'path' | 'size'>>,
): PackageFileTree[] {
  const normalizedEntries = stripArchiveRoot(entries.map(entry => ({ ...entry })))
  const root: PackageFileTree[] = []

  for (const entry of normalizedEntries) {
    const parts = entry.path.split('/').filter(Boolean)
    let current = root
    let currentPath = ''

    for (let index = 0; index < parts.length; index++) {
      const name = parts[index]!
      const isFile = index === parts.length - 1
      currentPath = currentPath ? `${currentPath}/${name}` : name
      let node = current.find(item => item.name === name)

      if (!node) {
        node = {
          name,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          size: isFile ? entry.size : 0,
          ...(isFile ? {} : { children: [] }),
        }
        current.push(node)
      }

      if (isFile) {
        node.size = entry.size
      } else {
        node.size = (node.size ?? 0) + entry.size
        current = node.children ?? (node.children = [])
      }
    }
  }

  sortFileTree(root)
  return root
}

export async function fetchPypiArchiveEntries(
  packageName: string,
  version: string,
  filePreference: PypiFilePreference = 'all',
): Promise<PypiArchiveEntry[]> {
  const project = await fetchPypiProject(packageName)
  const selectedFile = pickPypiInspectableFile(project.releases?.[version], filePreference)

  if (!selectedFile?.url || !selectedFile.filename) {
    throw createError({ statusCode: 404, message: 'No inspectable PyPI distribution found' })
  }

  const archive = await $fetch<ArrayBuffer>(selectedFile.url, { responseType: 'arrayBuffer' })
  return extractPypiArchiveEntries(Buffer.from(archive), selectedFile.filename)
}

export async function getPypiPackageFileTree(
  packageName: string,
  version: string,
  filePreference: PypiFilePreference = 'all',
): Promise<PackageFileTreeResponse> {
  const entries = await fetchPypiArchiveEntries(packageName, version, filePreference)
  return {
    package: packageName,
    version,
    tree: buildPypiFileTree(entries),
  }
}

export async function getPypiPackageFileContent(
  packageName: string,
  version: string,
  filePath: string,
  filePreference: PypiFilePreference = 'all',
): Promise<PypiArchiveEntry> {
  const entries = stripArchiveRoot(
    await fetchPypiArchiveEntries(packageName, version, filePreference),
  )
  const entry = entries.find(item => item.path === filePath)
  if (!entry?.content) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  return entry
}
