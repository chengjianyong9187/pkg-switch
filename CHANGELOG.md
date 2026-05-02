# Changelog

All notable changes to `pkg-switch` are documented in this file.

## [0.2.1] - 2026-05-02

### Added

- Added GitHub Actions CI for lint, test, build, and npm pack dry-run verification.
- Added tag-based release workflow for automated npm publishing with provenance.
- Added release tag validation to prevent version/tag mismatches.
- Added `CHANGELOG.md`, MIT `LICENSE`, and bilingual release notes to the public package.
- Added public fixture tests for repository-facing examples and documentation.

### Changed

- Updated test fixtures to use generic `work` and `personal` profile names.
- Expanded package metadata coverage for public npm/GitHub readiness.

## [0.2.0] - 2026-05-02

### Added

- Added `pkg-switch init` and `pkg-switch init --force`.
- Added `pkg-switch --version`.
- Added `switch --dry-run` and `switch --diff` with masked output.
- Added `profile set` and `profile unset`.
- Added `profile clone` and `profile rename`.
- Added `backup delete` and `backup prune --keep <n>`.
- Added pnpm `storeDir` rendering to `.npmrc` as `store-dir=...`.
- Added restore state snapshot support.
- Added bilingual user manuals.

### Changed

- Expanded automated tests for CLI actions, profile lifecycle, and backup lifecycle.

## [0.1.1] - 2026-05-02

### Added

- Published the first public npm package with bilingual README and user manuals.
- Added profile add/remove/list/show, switch, doctor, backup list, and restore commands.
- Added npm, yarn, and pnpm profile rendering foundations.

## [0.1.0] - 2026-04-30

### Added

- Initial CLI implementation and core profile switching services.
