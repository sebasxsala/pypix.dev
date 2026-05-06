# pypix.dev

> A fast, modern browser for the PyPI registry.

pypix.dev is a fork of [npmx.dev](https://npmx.dev), reoriented around the Python packaging ecosystem. The goal is to bring the same speed, polish, keyboard-first navigation, source browsing, package metadata, and modern registry UX to [PyPI](https://pypi.org/).

## Vision

PyPI is the canonical home for Python packages. pypix.dev is not a replacement for PyPI; it is a modern browser on top of it: a faster, denser, more ergonomic way to discover, inspect, compare, and understand Python packages.

What pypix offers:

- **Speed** - fast searching, filtering, and navigation.
- **Clarity** - package metadata, versions, files, project links, requirements, classifiers, and security signals in a focused interface.
- **Developer ergonomics** - keyboard navigation, readable package pages, source browsing, and concise install commands.
- **PyPI compatibility** - familiar project URLs and metadata, adapted for Python packaging conventions.

## Current Status

This repository still carries architecture, naming, fixtures, types, and helper APIs inherited from npmx.dev. The product direction is now PyPI, but the functional migration is incremental.

The most important technical work is replacing npm-specific data access with PyPI equivalents:

- npm packuments -> PyPI JSON API project/release responses.
- npm search -> PyPI-compatible search/index strategy.
- npm download stats -> an external PyPI downloads source, because PyPI JSON download counters are deprecated and always `-1`.
- jsDelivr npm file browsing -> Python package file extraction/indexing from `files.pythonhosted.org` artifacts.
- npm CLI connector/admin flows -> Python packaging and PyPI account workflows, or removal if they do not map cleanly.

See [AGENTS.md](./AGENTS.md) for the current technical map and migration notes.

## PyPI API Direction

Primary PyPI endpoints to target:

- `GET https://pypi.org/pypi/<project>/json` for latest project metadata.
- `GET https://pypi.org/pypi/<project>/<version>/json` for release-specific metadata and vulnerabilities.
- `GET https://pypi.org/simple/` and `GET https://pypi.org/simple/<project>/` with JSON content negotiation for the Simple/Index API.
- Distribution files from `files.pythonhosted.org`, as returned by PyPI JSON/Index API responses.

PyPI's XML-RPC search is permanently disabled, so search needs a separate strategy rather than a direct npm-search equivalent.

## Tech Stack

- [Nuxt 4](https://nuxt.com/)
- [Nitro](https://nuxt.com/docs/guide/concepts/server-engine)
- [UnoCSS](https://unocss.dev/)
- [nuxt-og-image](https://github.com/nuxt-modules/og-image)
- [PyPI JSON API](https://docs.pypi.org/api/json/)
- [PyPI Index API](https://docs.pypi.org/api/index-api/)

## Upstream

pypix.dev is forked from [npmx.dev](https://github.com/npmx-dev/npmx.dev), a fast, modern browser for the npm registry.

## License

Published under the [MIT License](./LICENSE).
