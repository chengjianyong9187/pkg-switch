# pkg-switch Release Notes

## Document Info

- **Document ID**: pkg-switch-REL-EN-001
- **Type**: Release notes
- **Scope**: `pkg-switch` P0 / P1 capability changes, command boundaries, and upgrade verification
- **Version**: 1.0
- **Status**: Stable
- **Updated At**: 2026-05-02

## 1. Background and Goal

`pkg-switch@0.2.0` completes the P0 and P1 capability set around profile initialization, switch preview, profile maintenance, backup maintenance, and restore consistency.

This document records what changed from `0.1.1` to `0.2.0`. For full installation, configuration, and daily usage, see the [English User Manual](user-manual.en.md).

## 2. Scope and Non-Goals

Covered:

- P0: initialization, version output, switch preview, masked diff, profile set/unset, pnpm store-dir rendering, and restore state consistency.
- P1: profile clone/rename, backup delete/prune, related documentation, and tests.

Not covered:

- Graphical user interface.
- Project-level `.npmrc` merge strategy.
- Registry connectivity load testing.
- Token lifecycle management or secret vault integration.

## 3. P0 Changes

### 3.1 Config Initialization

New commands:

```bash
pkg-switch init
pkg-switch init --force
```

Behavior:

- `init` creates a default `config.json`.
- If `config.json` already exists, it fails by default.
- Existing config is overwritten only when `--force` is passed.

### 3.2 CLI Version Output

New command:

```bash
pkg-switch --version
```

The output includes package name, version, platform, and Node.js version:

```text
pkg-switch/0.2.0 win32-x64 node-v22.x.x
```

### 3.3 Switch Preview and Diff

New commands:

```bash
pkg-switch switch work --dry-run
pkg-switch switch work --diff
```

Behavior:

- `--dry-run` prints the target file contents.
- `--diff` prints a line-level diff between current files and target files.
- Neither command writes `.npmrc` or `.yarnrc.yml`.
- Neither command creates backups, changes state, or cleans caches.
- Output masks sensitive fields such as token, auth, password, username, and email.

### 3.4 profile set/unset

New commands:

```bash
pkg-switch profile set personal npm.registry https://registry.npmmirror.com/
pkg-switch profile set personal npm.alwaysAuth false
pkg-switch profile set personal "npm.extraConfig[//registry.npmjs.org/:_authToken]" "YOUR_NPMJS_TOKEN"
pkg-switch profile unset personal npm.authToken
pkg-switch profile unset personal "npm.extraConfig[//registry.npmjs.org/:_authToken]"
```

Behavior:

- `profile set` updates a profile patch by path.
- `true`, `false`, and `null` are parsed as boolean or null values; all other values are saved as strings.
- Use bracket notation when a path segment contains `.`, `/`, or `:`.
- Success output prints only the profile name and path; sensitive values are not echoed.

### 3.5 pnpm store-dir Rendering

Config:

```json
{
  "pnpm": {
    "storeDir": "${HOME}/.local/share/pnpm/store"
  }
}
```

Now renders to `.npmrc`:

```ini
store-dir=${HOME}/.local/share/pnpm/store
```

### 3.6 restore State Consistency

New behavior:

- Backups created by newer versions include a snapshot of `state.json` before the switch.
- `restore <backupId>` restores rc files and then restores the saved state.
- Older backups without state snapshots are handled by writing a compatible `lastSwitchStatus=restored` state.

## 4. P1 Changes

### 4.1 profile clone

New command:

```bash
pkg-switch profile clone work staging
```

Behavior:

- Copies the source profile patch to the target profile.
- Does not expand inherited `common` values into the target profile.
- Fails when the source profile does not exist or the target profile already exists.

### 4.2 profile rename

New command:

```bash
pkg-switch profile rename staging staging-v2
```

Behavior:

- Renames an existing profile.
- Fails when the target profile already exists.
- If the renamed profile is currently active, `state.activeProfile` is updated as well.

### 4.3 backup delete

New command:

```bash
pkg-switch backup delete <backupId>
```

Behavior:

- Deletes the specified backup directory.
- Reads the manifest before deleting, so missing or invalid backup IDs fail safely.
- Backup IDs must not contain path separators or `..`.

### 4.4 backup prune

New command:

```bash
pkg-switch backup prune --keep 5
```

Behavior:

- Keeps the newest N backups by creation time.
- Deletes older backups.
- `--keep` must be an integer greater than or equal to 0.

## 5. Edge Cases and Error Handling

| Scenario | Behavior |
| --- | --- |
| `init` with existing config | Fails by default and reports that the config already exists |
| `profile set` without path or value | Fails with a missing-argument message |
| `profile clone` target already exists | Fails with profile already exists |
| `profile rename` source missing | Fails with profile not found |
| `switch --dry-run` or `--diff` | Does not write files, back up, clean caches, or update state |
| `backup delete` missing backup | Fails because the backup manifest is missing |
| `backup prune --keep invalid` | Fails with an invalid keep count |

## 6. Upgrade Verification

Recommended checks after upgrade:

```bash
pkg-switch --version
pkg-switch --help
pkg-switch doctor
pkg-switch switch personal --dry-run
pkg-switch switch personal --diff
pkg-switch profile clone personal personal-test
pkg-switch profile rename personal-test personal-temp
pkg-switch profile remove personal-temp
pkg-switch backup list
```

Expected result:

- Version output shows `0.2.0` or later.
- `--help` includes `init`, `profile clone`, `profile rename`, `backup delete`, and `backup prune`.
- `doctor` has no config, registry, or token errors.
- dry-run and diff do not write rc files and do not print plain-text tokens.
- Temporary profiles can be cloned, renamed, and removed.

## 7. Related Documents

- [中文版本变更说明](release-notes.zh-CN.md)
- [English User Manual](user-manual.en.md)
- [中文操作手册](user-manual.zh-CN.md)
- [README](../README.md)
- [中文 README](../README.zh-CN.md)

## 8. Changelog

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| v1.0 | 2026-05-02 | Codex | Added P0 / P1 release notes |
