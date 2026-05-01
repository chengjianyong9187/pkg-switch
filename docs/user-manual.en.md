# pkg-switch User Manual

## Document Info

- **Document ID**: pkg-switch-OPS-EN-001
- **Type**: User manual
- **Scope**: Installation, configuration, profile switching, diagnostics, backups, and restore operations
- **Version**: 1.1
- **Status**: Stable
- **Updated At**: 2026-05-02

## 1. Purpose

`pkg-switch` manages user-level package manager configuration through named profiles.

It can write:

- `.npmrc` for npm and pnpm-compatible user configuration
- `.yarnrc.yml` for yarn user configuration
- State and backup files under `.pkg-switch`

Common use cases:

- Use a private registry profile for work projects.
- Use a public mirror profile for personal projects.
- Use a publish profile that keeps an npmjs host-level token while daily installs still use a mirror.

## 2. Installation

Install from npmjs:

```bash
npm install --global pkg-switch
pkg-switch --help
```

Install with pnpm:

```bash
pnpm add --global pkg-switch
pkg-switch --help
```

Install from source for development:

```bash
git clone git@github.com:chengjianyong9187/pkg-switch.git
cd pkg-switch
pnpm install
pnpm build
pnpm link --global
pkg-switch --help
```

## 3. Runtime Files

Default locations on Windows:

| File | Purpose |
| --- | --- |
| `%USERPROFILE%\.pkg-switch\config.json` | Main profile config |
| `%USERPROFILE%\.pkg-switch\state.json` | Active profile and latest switch status |
| `%USERPROFILE%\.pkg-switch\backups\` | Backups created before writes |
| `%USERPROFILE%\.npmrc` | npm / pnpm user config output |
| `%USERPROFILE%\.yarnrc.yml` | yarn user config output |

Default locations on Linux/macOS:

| File | Purpose |
| --- | --- |
| `$HOME/.pkg-switch/config.json` | Main profile config |
| `$HOME/.pkg-switch/state.json` | Active profile and latest switch status |
| `$HOME/.pkg-switch/backups/` | Backups created before writes |
| `$HOME/.npmrc` | npm / pnpm user config output |
| `$HOME/.yarnrc.yml` | yarn user config output |

## 4. Config Structure

Top-level `config.json` shape:

```json
{
  "meta": {
    "version": 1
  },
  "defaults": {
    "writeTargets": ["npm", "yarn"],
    "backupBeforeWrite": true,
    "clearCacheOnSwitch": true,
    "cacheCleanMode": "smart"
  },
  "common": {},
  "profiles": {}
}
```

Field summary:

| Field | Description |
| --- | --- |
| `defaults.writeTargets` | Targets to write during a switch, commonly `npm` and `yarn` |
| `defaults.backupBeforeWrite` | Whether to back up existing rc files before writing |
| `defaults.clearCacheOnSwitch` | Whether to clean caches after a successful switch |
| `defaults.cacheCleanMode` | Cache clean mode: `smart`, `full`, or `none` |
| `common` | Shared config inherited by all profiles |
| `profiles` | Named profile patches, for example `work` and `personal` |

Merge rules:

- Effective config is `common + profiles.<name>`.
- Profile fields override matching `common` fields.
- A profile field set to `null` removes the inherited value.
- `profile show <name>` prints the merged config and masks sensitive values.

## 5. Generic Config Example

```json
{
  "meta": {
    "version": 1
  },
  "defaults": {
    "writeTargets": ["npm", "yarn"],
    "backupBeforeWrite": true,
    "clearCacheOnSwitch": true,
    "cacheCleanMode": "smart"
  },
  "common": {
    "npm": {
      "registry": "https://registry.npmmirror.com/",
      "cache": "${HOME}/.cache/npm",
      "strictSsl": true,
      "extraConfig": {
        "prefix": "${HOME}/.local/npm-global",
        "electron_mirror": "https://cdn.npmmirror.com/binaries/electron/",
        "sass_binary_site": "https://registry.npmmirror.com/-/binary/node-sass"
      }
    },
    "pnpm": {
      "storeDir": "${HOME}/.local/share/pnpm/store"
    },
    "yarn": {
      "nodeLinker": "node-modules"
    }
  },
  "profiles": {
    "work": {
      "npm": {
        "registry": "https://registry.example.com/repository/npm-group/",
        "alwaysAuth": true,
        "authToken": "<private-registry-token>"
      },
      "scopes": {
        "@example": {
          "registry": "https://registry.example.com/repository/npm-group/"
        }
      }
    },
    "personal": {
      "npm": {
        "registry": "https://registry.npmmirror.com/",
        "alwaysAuth": false,
        "authToken": null,
        "extraConfig": {
          "//registry.npmjs.org/:_authToken": "<npmjs-publish-token>"
        }
      },
      "scopes": {
        "@example": null
      }
    }
  }
}
```

Notes:

- Replace `${HOME}` and token placeholders with values for your machine.
- Place host-level auth entries in `npm.extraConfig`, for example `//registry.npmjs.org/:_authToken`.
- Projects published to npmjs should set `publishConfig.registry=https://registry.npmjs.org/` in their own `package.json`.

## 6. Profile Management

Show current status:

```bash
pkg-switch current
```

List profiles:

```bash
pkg-switch profile list
```

Show merged profile config:

```bash
pkg-switch profile show work
pkg-switch profile show personal
```

Add an empty profile:

```bash
pkg-switch profile add staging
```

Remove an inactive profile:

```bash
pkg-switch profile remove staging
```

Notes:

- Adding an existing profile fails.
- Removing the active profile fails.
- `profile show` masks tokens, auth fields, passwords, usernames, and emails.

## 7. Switching Profiles

Switch to the work profile:

```bash
pkg-switch switch work
```

Switch to the personal profile:

```bash
pkg-switch switch personal
```

Switch and skip cache cleaning:

```bash
pkg-switch switch personal --no-cache-clean
```

Override cache cleaning for one switch:

```bash
pkg-switch switch work --cache-clean smart
pkg-switch switch work --cache-clean none
pkg-switch switch work --cache-clean full
```

Cache clean modes:

| Mode | Behavior |
| --- | --- |
| `smart` | Runs safe commands: `npm cache clean --force`, `pnpm store prune`, and `yarn cache clean` |
| `none` | Skips cache cleaning |
| `full` | Returns a warning and does not delete user-managed cache directories |

## 8. Diagnostics, Backups, and Restore

Run diagnostics:

```bash
pkg-switch doctor
```

List backups:

```bash
pkg-switch backup list
```

Restore a backup:

```bash
pkg-switch restore <backupId>
```

Recommendations:

- Keep `backupBeforeWrite=true`.
- Run `pkg-switch backup list` before restoring.
- Run `pkg-switch current` and `pkg-switch doctor` after restore.

## 9. npmjs Publishing

A personal or open-source profile can use a mirror for daily installs while keeping an npmjs host-level token:

```json
{
  "npm": {
    "registry": "https://registry.npmmirror.com/",
    "alwaysAuth": false,
    "extraConfig": {
      "//registry.npmjs.org/:_authToken": "<npmjs-publish-token>"
    }
  }
}
```

Publish with the official registry:

```bash
npm publish --registry=https://registry.npmjs.org/
```

Or declare this in the project `package.json`:

```json
{
  "publishConfig": {
    "registry": "https://registry.npmjs.org/"
  }
}
```

## 10. Troubleshooting

### 10.1 `pkg-switch` command not found

```bash
npm install --global pkg-switch
pkg-switch --help
```

If it is still missing, reopen your terminal and confirm the npm global bin directory is in `PATH`.

### 10.2 `doctor` reports missing package manager commands

Check whether the current shell can find them:

```bash
npm -v
pnpm -v
yarn -v
```

Install or repair the missing command and its `PATH` entry.

### 10.3 Invalid registry URL

Registry values must be valid URLs:

```json
{
  "npm": {
    "registry": "https://registry.npmmirror.com/"
  }
}
```

Do not use `registry.npmmirror.com` or an empty string.

## 11. Verification Checklist

```bash
pkg-switch --help
pkg-switch profile list
pkg-switch profile show personal
pkg-switch doctor
pkg-switch switch personal --no-cache-clean
pkg-switch current
pkg-switch backup list
```

Expected result:

- `pkg-switch --help` prints commands.
- `profile list` includes your expected profiles.
- `profile show` does not print plain-text tokens.
- `doctor` has no config, registry, or auth errors.
- `current` shows the profile you just switched to.

## 12. Related Documents

- [中文操作手册](user-manual.zh-CN.md)
- [README](../README.md)
- [中文 README](../README.zh-CN.md)
- [Example config](../examples/config.example.json)

## 13. Changelog

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| v1.1 | 2026-05-02 | Codex | Removed personal profile names, local paths, and private-environment details; added generic publishing guidance |
