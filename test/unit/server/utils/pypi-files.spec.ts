import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  buildPypiFileTree,
  extractPypiArchiveEntries,
  pickPypiInspectableFile,
} from '#server/utils/pypi-files'
import type { PypiProjectFile } from '#server/utils/pypi-package'

function tarHeader(name: string, size: number, type = '0'): Buffer {
  const header = Buffer.alloc(512)
  header.write(name, 0, 100, 'utf8')
  header.write('0000644\0', 100, 8, 'ascii')
  header.write('0000000\0', 108, 8, 'ascii')
  header.write('0000000\0', 116, 8, 'ascii')
  header.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii')
  header.write('00000000000\0', 136, 12, 'ascii')
  header.fill(' ', 148, 156)
  header.write(type, 156, 1, 'ascii')
  header.write('ustar\0', 257, 6, 'ascii')

  let sum = 0
  for (const byte of header) sum += byte
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')
  return header
}

function tarFile(name: string, content: string): Buffer {
  const body = Buffer.from(content)
  const padding = Buffer.alloc((512 - (body.length % 512)) % 512)
  return Buffer.concat([tarHeader(name, body.length), body, padding])
}

function makeTarGz(files: Record<string, string>): Buffer {
  return gzipSync(
    Buffer.concat([
      ...Object.entries(files).map(([name, content]) => tarFile(name, content)),
      Buffer.alloc(1024),
    ]),
  )
}

describe('pypi-files utils', () => {
  it('prefers source distributions before wheels for source browsing', () => {
    const files: PypiProjectFile[] = [
      {
        filename: 'demo-1.0.0-py3-none-any.whl',
        packagetype: 'bdist_wheel',
        url: 'https://example.test/wheel',
      },
      { filename: 'demo-1.0.0.tar.gz', packagetype: 'sdist', url: 'https://example.test/sdist' },
    ]

    expect(pickPypiInspectableFile(files)?.filename).toBe('demo-1.0.0.tar.gz')
  })

  it('strips the archive root and builds a nested file tree', () => {
    const entries = [
      { path: 'demo-1.0.0/src/demo/__init__.py', size: 12 },
      { path: 'demo-1.0.0/README.md', size: 20 },
    ]

    expect(buildPypiFileTree(entries)).toEqual([
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        size: 12,
        children: [
          {
            name: 'demo',
            path: 'src/demo',
            type: 'directory',
            size: 12,
            children: [
              { name: '__init__.py', path: 'src/demo/__init__.py', type: 'file', size: 12 },
            ],
          },
        ],
      },
      { name: 'README.md', path: 'README.md', type: 'file', size: 20 },
    ])
  })

  it('extracts text files from a PyPI sdist tarball', async () => {
    const archive = makeTarGz({
      'demo-1.0.0/README.md': '# demo\n',
      'demo-1.0.0/src/demo/__init__.py': 'name = "demo"\n',
    })

    const entries = await extractPypiArchiveEntries(archive, 'demo-1.0.0.tar.gz')

    expect(entries.map(entry => entry.path)).toEqual([
      'demo-1.0.0/README.md',
      'demo-1.0.0/src/demo/__init__.py',
    ])
    expect(entries[1]?.content?.toString('utf8')).toBe('name = "demo"\n')
  })
})
