# PyPI Endpoint Migration Notes

This document holds the endpoint and file map for migrating the inherited npm data layer to PyPI.

## PyPI Endpoint Map

Primary official endpoints:

- Project JSON: `GET https://pypi.org/pypi/<project>/json`
- Release JSON: `GET https://pypi.org/pypi/<project>/<version>/json`
- Simple/Index API: `GET https://pypi.org/simple/`
- Project files index: `GET https://pypi.org/simple/<project>/`
- Distribution files: `https://files.pythonhosted.org/...` URLs returned by PyPI APIs

Download statistics provider:

- Recent aggregate downloads: `GET https://pypistats.org/api/packages/<project>/recent`

Important PyPI API notes:

- The PyPI JSON API exposes `info`, `releases`, `urls`, `vulnerabilities`, and `last_serial`.
- The release-specific JSON route is the better source for version-specific vulnerability data.
- PyPI JSON `downloads` values are deprecated and always `-1`; do not build download charts from them.
- `pypistats.org` is acceptable for MVP package-level day/week/month counts. Cache these results locally for 24 hours because the service updates daily and applies IP-based rate limiting.
- Use BigQuery (`bigquery-public-data.pypi.file_downloads`) when the app needs large-scale ranking, global sorting, backfills, or custom aggregate dimensions.
- PyPI XML-RPC search is permanently disabled. Search needs another source, such as a maintained external index, a local index built from `/simple/`, or a hosted search pipeline.
- Prefer the Simple/Index JSON API for complete project/version/file listings where possible.

Current search MVP:

- `/api/pypi/search` intentionally does not call PyPI Stats. Download counts are useful package metadata, but they add one extra external request per result and should not block search latency.
- Search uses a local name-first index built from the cached Simple/Index project list. The index normalizes PyPI project names, deduplicates canonical names, ranks exact/prefix/token/contains matches, and is kept in memory per worker.
- Search results are cached per normalized query, page size, and offset for a short TTL. Keep `/api/pypi/search` uncached at the route level unless query-aware ISR is restored with `passQuery` and `allowQuery`; the internal cached functions are the controlled cache layer for now.
- The first visible results are hydrated from cached PyPI project JSON. Remaining results can be name-only so broad searches do not fan out to one JSON request per match.
- A small local popular-package seed boosts obvious packages such as `requests`, `fastapi`, `django`, `numpy`, and `pydantic` without introducing an external ranking provider.
- Current ranking is still name-first and cannot rank by description, classifiers, popularity, recency, or download counts. Full-text search requires a maintained external or scheduled index.

Future search direction:

- Build or adopt a real PyPI search index. Good candidates are Meilisearch, Typesense, Algolia, Postgres full-text search, or a custom scheduled import pipeline backed by PyPI Simple/JSON plus a downloads provider.
- Index at least normalized name, canonical name, summary, keywords, classifiers, latest version, upload time, project URLs, yanked status, vulnerability signals, and optional popularity/download fields from a documented provider.
- Keep download stats out of the synchronous search request. Load them from the index if precomputed, or hydrate them lazily in package cards/details.

References:

- https://docs.pypi.org/api/json/
- https://docs.pypi.org/api/index-api/
- https://warehouse.pypa.io/api-reference/xml-rpc.html

## Where npm Endpoints Live Today

Core constants and fetch clients:

- `shared/utils/constants.ts` defines inherited `NPM_REGISTRY` and `NPM_API`. Add PyPI constants here and migrate callers gradually.
- `app/plugins/npm.ts` provides `$npmRegistry` and `$npmApi`; this is the main client abstraction to replace with `$pypiJson` / `$pypiSimple` or a neutral package-registry client.
- `shared/utils/fetch-cache-config.ts`, `modules/security-headers.ts`, and `modules/runtime/server/cache.ts` whitelist/cache npm hosts for tests and runtime behavior.

Primary package data and search callers:

- `app/composables/npm/usePackage.ts`
- `app/composables/npm/useNpmSearch.ts`
- `app/composables/npm/useAlgoliaSearch.ts`
- `app/composables/npm/useSearch.ts`
- `app/composables/npm/useUserPackages.ts`
- `app/composables/npm/useOrgPackages.ts`
- `server/utils/npm.ts`
- `server/api/opensearch/suggestions.get.ts`
- `server/api/registry/package-meta/[...pkg].get.ts`
- `server/api/registry/org/[org]/packages.get.ts`

Versions, downloads, timelines, files, and readmes:

- `app/utils/npm/api.ts`
- `server/api/registry/downloads/[...slug].get.ts`
- `server/utils/npm-website-versions.ts`
- `server/utils/file-tree.ts`
- `server/api/registry/file/[...pkg].get.ts`
- `server/api/registry/files/[...pkg].get.ts`
- `server/api/registry/compare-file/[...pkg].get.ts`
- `server/api/registry/compare/[...pkg].get.ts`
- `server/utils/readme.ts`
- `server/utils/readme-loaders.ts`

Inherited npm-only helpers that need redesign:

- `fast-npm-meta` usage in app/server utilities.
- `validate-npm-package-name` in `shared/schemas/package.ts`.
- npm CLI connector/admin code in `cli/src/*` and `app/composables/useConnector.ts`.
- npm fixtures under `test/fixtures/npm-registry` and `test/fixtures/npm-api`.

## Package Page Data Gaps

The PyPI package page now uses official PyPI JSON for package identity, summary,
versions, release upload times, files, hashes, README content, project links,
license, keywords, author/maintainer metadata, and `Requires-Python`.

Sections intentionally not shown from PyPI JSON:

- Download charts: PyPI JSON `downloads` values are deprecated and return `-1`.
  Use PyPI Stats for package-level recent counts, or BigQuery for historical
  charts and ranked comparisons.
- Transitive install size: PyPI JSON gives distribution file sizes, not an
  installed environment size. A first-party implementation should resolve wheel
  metadata and dependency trees in an isolated Python environment; an external
  provider is preferable if this needs to be fast at scale.
- Dependency tree, deprecated dependency tree, and vulnerability tree: PyPI JSON
  can expose project/release vulnerability arrays, but it does not provide a full
  resolved dependency graph. Build a PyPI resolver service around package
  metadata, environment markers, extras, and advisory data.
- npm provenance/trusted publisher downgrade checks: npm attestations do not map
  to PyPI JSON. For PyPI, use PEP 740 attestations and Trusted Publishing data
  when Warehouse exposes the required metadata through a stable API.
- npm org/team access controls and connector admin flows: PyPI ownership and
  organizations are different. Implement a PyPI-specific ownership adapter if
  admin workflows remain in scope.
- Binary/create package helpers and `@types` suggestions: these are JavaScript
  ecosystem affordances. Replace them with Python-specific signals such as console
  scripts, extras, classifiers, and type marker packages only when the metadata
  source is defined.

### Actionable Resolution Plan

| Hidden section                                           | Why PyPI JSON is insufficient                                                                                                                                   | Practical solution                                                                                                                                                                  | Implementation path                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Download charts                                          | The `downloads` field in PyPI JSON is deprecated and returns `-1`, so charts would be fake or misleading.                                                       | Use PyPI Stats for recent package download counts. Use BigQuery public PyPI downloads for historical charts, ranges, ecosystem rankings, and comparisons.                           | MVP: add `server/api/pypi/downloads/[project].get.ts` backed by `https://pypistats.org/api/packages/<project>/recent`, cached for 24 hours. Full charts: create a scheduled BigQuery import into our cache/database and expose normalized daily buckets to the UI.                                                                  |
| Transitive install size                                  | PyPI JSON exposes uploaded file sizes, not the final installed size after dependency resolution, wheel selection, markers, extras, and platform differences.    | Implement a first-party resolver worker for exact environment profiles, or use an external package analysis provider if latency and maintenance cost matter more than full control. | First-party: run `uv pip compile`/`pip download` in an isolated temp environment for `{python version, platform, extras}`, inspect wheel metadata and file sizes, cache by package/version/environment. Provider option: evaluate libraries.io/Snyk-equivalent package metadata providers, but still document method and freshness. |
| Dependency tree                                          | PyPI JSON does not include a resolved dependency graph. Dependencies live in distribution metadata and depend on markers, extras, Python version, and platform. | Build a PyPI dependency resolver service.                                                                                                                                           | Fetch wheel/sdist metadata from PyPI files, parse `Requires-Dist`, evaluate PEP 508 markers, resolve versions with `packaging`/`resolvelib` or `uv`, cache the resulting graph, and expose it through a PyPI-specific endpoint instead of reusing npm dependency types directly.                                                    |
| Vulnerability tree                                       | PyPI JSON may include vulnerability arrays, but not a transitive vulnerability tree for resolved dependencies.                                                  | Combine the dependency resolver with Python advisory sources.                                                                                                                       | Use PyPI vulnerability data where available plus OSV (`https://api.osv.dev`) for package/version advisories. After dependency graph resolution, annotate each node with advisories and severity. Cache by package/version/environment.                                                                                              |
| Deprecated dependency tree                               | PyPI has no npm-style `deprecated` field on package versions. Deprecation/yank/replacement semantics differ.                                                    | Treat yanked releases, classifiers, project status, and advisory data as separate Python health signals.                                                                            | Use release file `yanked`/`yanked_reason` from PyPI/Simple API for version-level warnings. Add a separate “release health” component rather than calling it npm-style deprecated dependencies. Replacement suggestions require a curated first-party mapping or external package intelligence provider.                             |
| Provenance / trusted publisher                           | npm provenance attestations and trusted-publisher fields do not map to PyPI JSON. PyPI uses its own publishing and attestation model.                           | Replace npm trust checks with PyPI-specific trust signals: Trusted Publishing, PEP 740 attestations, file hashes, and verified metadata when available.                             | Short term: show file hashes from PyPI JSON and avoid trust downgrade warnings. Medium term: add a `server/api/pypi/provenance/[project]/[version].get.ts` adapter once Warehouse exposes stable attestation/trusted publishing metadata. Long term: verify attestations server-side and render PyPI-specific provenance UI.        |
| Access controls / npm orgs                               | npm teams/org admin endpoints are not PyPI concepts. PyPI has owners, maintainers, organizations, and project roles with different APIs and permissions.        | Build a PyPI ownership adapter only if admin workflows stay in scope.                                                                                                               | Read public owner/maintainer data when available. For authenticated admin flows, design a separate PyPI connector around PyPI organization/project role APIs or an approved PyPI integration. Do not reuse npm org/team UI as-is.                                                                                                   |
| JS helpers: `@types`, create packages, binary heuristics | These are JavaScript ecosystem patterns. Python packages use classifiers, extras, console scripts, type markers, and entry points instead.                      | Replace with Python-specific package guidance.                                                                                                                                      | Parse wheel metadata for `console_scripts` entry points, `Provides-Extra`, `Typing :: Typed` classifiers, `py.typed`, and `Requires-Python`. Render install extras like `pip install package[extra]` and CLI usage only when metadata confirms it.                                                                                  |

Recommended implementation order:

1. Add PyPI Stats-backed recent downloads because it is low-risk and directly replaces the visible download card.
2. Add file/release browsing from PyPI Simple API because PyPI already exposes the data reliably.
3. Build dependency resolution once, then reuse it for dependency tree, vulnerability tree, install size, and Python-specific package health.
4. Add provenance/trusted publishing only after PyPI exposes a stable metadata source for the trust signals we need.
