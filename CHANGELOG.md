# Changelog

All notable changes to `pkg-switch` are documented in this file.

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
- Added bilingual user manuals and release notes.

### Changed

- Updated examples to use generic `work` and `personal` profiles.
- Expanded automated tests for CLI actions, profile lifecycle, backup lifecycle, and release metadata.

## [0.1.1] - 2026-05-02

### Added

- Published the first public npm package with bilingual README and user manuals.
- Added profile add/remove/list/show, switch, doctor, backup list, and restore commands.
- Added npm, yarn, and pnpm profile rendering foundations.

## [0.1.0] - 2026-04-30

### Added

- Initial CLI implementation and core profile switching services.
