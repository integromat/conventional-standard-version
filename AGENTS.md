# conventional-standard-version

Integromat's fork of `standard-version`: a CLI tool that automates semver bumping, CHANGELOG generation, git commit, and git tagging based on [Conventional Commits](https://conventionalcommits.org). Published as `@integromat/standard-version`.

**Stack**: Node.js (CommonJS), yargs CLI, mocha + nyc + chai tests, CircleCI CI.

## Architecture

### Entry Chain

`bin/cli.js` → `command.js` (yargs arg parsing + config merging) → `index.js` (`standardVersion(argv)`) → four sequential lifecycle phases.

### Lifecycle Pipeline

`index.js` runs four async steps in order:

1. **bump** (`lib/lifecycles/bump.js`) — calculates new version via `conventional-recommended-bump` (or `--release-as` override), writes it to all `bumpFiles`
2. **changelog** (`lib/lifecycles/changelog.js`) — generates/prepends to `CHANGELOG.md` via `conventional-changelog`
3. **commit** (`lib/lifecycles/commit.js`) — `git add` + `git commit` the changed files
4. **tag** (`lib/lifecycles/tag.js`) — creates annotated/signed git tag

Each lifecycle checks `args.skip.<name>` at entry and fires `pre<name>`/`post<name>` hooks from `args.scripts`. The `prebump` and `precommit` hooks can override config values via their stdout.

### Configuration Loading (lowest → highest priority)

1. `defaults.js` — hardcoded defaults including `packageFiles`, `bumpFiles`, `tagPrefix: 'v'`, `gitTagFallback: true`
2. `package.json` `"standard-version"` stanza — via yargs `.pkgConf()`
3. `.versionrc` / `.versionrc.json` / `.versionrc.js` / `.versionrc.cjs` — via `lib/configuration.js` + `find-up`; `.js`/`.cjs` may export object or function
4. CLI flags

### packageFiles vs bumpFiles

- **`packageFiles`**: read-only version source. `index.js` iterates the list, takes the first file whose updater successfully reads a version. Defaults: `package.json`, `bower.json`, `manifest.json`.
- **`bumpFiles`**: write targets. `bump.js` writes the new version to every file in this list. Defaults: `packageFiles` + `package-lock.json`, `npm-shrinkwrap.json`. If user provides custom `packageFiles` via config, they are also appended to `bumpFiles` (`index.js`).

### Updater System (`lib/updaters/`)

`resolveUpdaterObjectFromArgument(arg)` in `lib/updaters/index.js` resolves an updater for each file entry:

- Object with `readVersion`/`writeVersion` → used as-is
- Plain string filename → type inferred from filename (JSON files from defaults list → `json`; `VERSION.txt`/`version.txt` → `plain-text`)
- Object with `type` key → explicit built-in type lookup
- Object with `updater` string path → `require`'d custom updater module

**Built-in updater types** (`lib/updaters/types/`):
- `json.js` — reads/writes `.version`; also writes `packages[''].version` for npm package-lock v2; preserves detected indent and newline style
- `plain-text.js` — entire file content is the version string
- `yaml.js` — **Integromat addition**: reads/writes `.version`; if `appVersion` field exists (Helm `Chart.yaml`), also updates it and preserves a `v` prefix if the original value had one

### Version Detection

If no `packageFiles` yields a version and `gitTagFallback` is true (default), `lib/latest-semver-tag.js` calls `git-semver-tags`, strips `tagPrefix`, semver-sorts, and returns the highest tag. Defaults to `'1.0.0'` if no tags exist.

### Git Operations

All git commands run via `lib/run-execFile.js` (`child_process.execFile`). Lifecycle scripts run via `lib/run-exec.js` (`child_process.exec`, shell mode). Both are no-ops when `args.dryRun` is true.

Cross-phase state: `bump.js` populates a module-level `configsToUpdate` map with filenames it wrote; `commit.js` reads this via `bump.getUpdatedConfigs()` to know which files to stage.

## Integromat-Specific Features

The sole upstream deviation is the **YAML updater** (`lib/updaters/types/yaml.js`). Upstream has no YAML support. This addition enables versioning Helm `Chart.yaml` files by updating both `version` and `appVersion` fields, with automatic v-prefix preservation on `appVersion`.

Usage in `.versionrc`:
```json
{
  "packageFiles": [{ "filename": "Chart.yaml", "type": "yaml" }],
  "bumpFiles":    [{ "filename": "Chart.yaml", "type": "yaml" }]
}
```

## Testing

- `npm test` — full suite (mocha + nyc coverage), includes real git integration tests (spins up temp git repos via shelljs in `test/git.spec.js`)
- `npm run test:unit` — unit tests only, excludes `test/git.spec.js` (no git required)

**Test patterns**: `test/core.spec.js` uses mock-fs (virtual filesystem) + mockery (stubs `conventional-recommended-bump`, `conventional-changelog`, `git-semver-tags`, `run-execFile`) + std-mocks (captures stdout). `test/git.spec.js` uses real git with a temp repo created in `tmp/`, cleaned up in `afterEach`. YAML/Helm tests are in `test/core.spec.js` under `yaml 'packageFiles' support`.

Mock fixtures for updater tests live in `test/mocks/` (includes `Chart.yaml`, `Chart-v.yaml`, `simple.yaml`).

## When in Plan Mode
- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- Interview user in detail (for Claude: use the AskUserQuestionTool) about literally anything: technical implementation, UI & UX, concerns, tradeoffs, etc. but make sure the questions are not obvious. Be very in-depth and continue interviewing the user continually until it's complete. Use the answers to create a detailed spec.
- Make assumptions explicit: When you must proceed under uncertainty, list assumptions up front and continue.
