# DeepSeek lock and production-consumer verification (#1658)

This is a reviewable evidence snapshot, not a second lockfile. Installation uses `package-lock.json` only. Source: `d755d8ee0789cf0883c48d79f26d41870e25247b`; subsequent documentation and adapter cleanup-quarantine changes leave the lock/dependency bytes unchanged. Regenerate this snapshot after any lock/dependency change. No review filter, check or threshold was disabled. Later adapter regression results and current-head CI belong in the PR, not in this predecessor's packed-consumer receipt.

## Exact canonical lock entries

Entries below are copied from the canonical lock, not inferred from node_modules. SDK root dependencies, peers and runtime plugins are pinned. The toolkit override comes from package.json. Its upstream manifest still declares fflate 0.8.2; the lock resolves 0.8.3 through the override. Prepack aligns the bundled manifest with 0.8.3 so consumers cannot reinstall the unsafe version. SDK/runtime code is unchanged. Other advisories are not claimed resolved.

```json
{
  "lockfileVersion": 3,
  "packageLockSha256": "8a8c88d6ab22aa88e544a9307eaca4ce354be6a26b6a53d9041d16aeaccb52d3",
  "rootDeepSeekDependencies": {
    "@deepseek-ai/cordis-plugin-group": "1.0.4",
    "@deepseek-ai/cordis": "4.0.4",
    "@deepseek-ai/dsh": "0.2.0-rc.2",
    "@deepseek-ai/dsh-anonymous-user-id": "0.2.0-rc.2",
    "@deepseek-ai/dsh-attachment": "0.2.0-rc.2",
    "@deepseek-ai/dsh-bash-local": "0.2.0-rc.2",
    "@deepseek-ai/dsh-client-store": "0.2.0-rc.2",
    "@deepseek-ai/dsh-client-ui-primitives": "0.2.0-rc.2",
    "@deepseek-ai/dsh-client-ui-slots": "0.2.0-rc.2",
    "@deepseek-ai/dsh-compaction": "0.2.0-rc.2",
    "@deepseek-ai/dsh-deepseek-account": "0.2.0-rc.2",
    "@deepseek-ai/dsh-fs": "0.2.0-rc.2",
    "@deepseek-ai/dsh-hook-protocol": "0.2.0-rc.2",
    "@deepseek-ai/dsh-jobs": "0.2.0-rc.2",
    "@deepseek-ai/dsh-llm-deepseek": "0.2.0-rc.2",
    "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
    "@deepseek-ai/dsh-output-retention": "0.2.0-rc.2",
    "@deepseek-ai/dsh-ptc-runtime": "0.2.0-rc.2",
    "@deepseek-ai/dsh-sandbox": "0.2.0-rc.2",
    "@deepseek-ai/dsh-sdk-client": "0.2.0-rc.2",
    "@deepseek-ai/dsh-sdk-protocol": "0.2.0-rc.2",
    "@deepseek-ai/dsh-session": "0.2.0-rc.2",
    "@deepseek-ai/dsh-session-persistence": "0.2.0-rc.2",
    "@deepseek-ai/dsh-session-query": "0.2.0-rc.2",
    "@deepseek-ai/dsh-session-telemetry": "0.2.0-rc.2",
    "@deepseek-ai/dsh-session-title-llm": "0.2.0-rc.2",
    "@deepseek-ai/dsh-shell": "0.2.0-rc.2",
    "@deepseek-ai/dsh-spill": "0.2.0-rc.2",
    "@deepseek-ai/dsh-subagent-in-process-driver": "0.2.0-rc.2",
    "@deepseek-ai/dsh-util-time": "0.2.0-rc.2",
    "@deepseek-ai/dsh-util-workspace-path": "0.2.0-rc.2",
    "@deepseek-ai/dsh-workflow": "0.2.0-rc.2",
    "@deepseek-ai/libreoffice-kit": "0.1.5"
  },
  "bundleDependencies": [
    "@deepseek-ai/cordis",
    "@deepseek-ai/dsh-llm",
    "@deepseek-ai/dsh-session",
    "@deepseek-ai/libreoffice-kit",
    "@deepseek-ai/dsh",
    "@deepseek-ai/dsh-sdk-client",
    "@deepseek-ai/cordis-plugin-group",
    "@deepseek-ai/dsh-anonymous-user-id",
    "@deepseek-ai/dsh-attachment",
    "@deepseek-ai/dsh-bash-local",
    "@deepseek-ai/dsh-client-store",
    "@deepseek-ai/dsh-client-ui-primitives",
    "@deepseek-ai/dsh-client-ui-slots",
    "@deepseek-ai/dsh-compaction",
    "@deepseek-ai/dsh-deepseek-account",
    "@deepseek-ai/dsh-fs",
    "@deepseek-ai/dsh-hook-protocol",
    "@deepseek-ai/dsh-jobs",
    "@deepseek-ai/dsh-llm-deepseek",
    "@deepseek-ai/dsh-output-retention",
    "@deepseek-ai/dsh-ptc-runtime",
    "@deepseek-ai/dsh-sandbox",
    "@deepseek-ai/dsh-sdk-protocol",
    "@deepseek-ai/dsh-session-persistence",
    "@deepseek-ai/dsh-session-query",
    "@deepseek-ai/dsh-session-telemetry",
    "@deepseek-ai/dsh-session-title-llm",
    "@deepseek-ai/dsh-shell",
    "@deepseek-ai/dsh-spill",
    "@deepseek-ai/dsh-subagent-in-process-driver",
    "@deepseek-ai/dsh-util-time",
    "@deepseek-ai/dsh-util-workspace-path",
    "@deepseek-ai/dsh-workflow"
  ],
  "toolkitOverride": null,
  "packages": {
    "node_modules/@deepseek-ai/cordis": {
      "version": "4.0.4",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/cordis/-/cordis-4.0.4.tgz",
      "integrity": "sha512-obgyxqWAmFn3Re8kvsuUnyW+ihrz6eJCnJO4fh1cQzDtmPYz/zzVeUkH9R94I0OwSVOocK67Kgakm04j/oQXzg==",
      "inBundle": true,
      "license": "MIT",
      "dependencies": {
        "@deepseek-ai/cosmokit": "~1.8.5",
        "@standard-schema/spec": "^1.1.0"
      },
      "bin": {
        "cordis": "bin.js"
      },
      "peerDependencies": {
        "@deepseek-ai/cordis-plugin-include": "~1.0.9",
        "@deepseek-ai/cordis-plugin-loader": "~1.0.5"
      },
      "peerDependenciesMeta": {
        "@deepseek-ai/cordis-plugin-include": {
          "optional": true
        },
        "@deepseek-ai/cordis-plugin-loader": {
          "optional": true
        }
      }
    },
    "node_modules/@deepseek-ai/cordis-plugin-group": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/cordis-plugin-group/-/cordis-plugin-group-1.0.4.tgz",
      "integrity": "sha512-/7tuY5pMQetHava4v6QUeOa4CwZA+mleNvbIoj+iqEmzkYUtlXbLqhzJIcbnDa/Hxgr1jaCwROrI77nuLyeCFg==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/cordis-plugin-loader": "~1.0.5"
      }
    },
    "node_modules/@deepseek-ai/dsh": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-0.2.0-rc.2.tgz",
      "integrity": "sha512-EAJ3gPNcVt/uv8X19PMm9NkVhWgT7xXNMk0UKCVm+IQ5rpSQOcsMUa0HWlnYYVybKMsccjcRB21vVVsaXQ6IdA==",
      "inBundle": true,
      "license": "MIT",
      "dependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/cordis-plugin-include": "~1.0.9",
        "@deepseek-ai/cordis-plugin-loader": "~1.0.5",
        "@deepseek-ai/cordis-plugin-timer": "~1.1.6",
        "@deepseek-ai/dsh-acp-app": "0.2.0-rc.2",
        "@deepseek-ai/dsh-agent-instructions": "0.2.0-rc.2",
        "@deepseek-ai/dsh-agent-preset": "0.2.0-rc.2",
        "@deepseek-ai/dsh-agent-tool-presentation": "0.2.0-rc.2",
        "@deepseek-ai/dsh-app-boot": "0.2.0-rc.2",
        "@deepseek-ai/dsh-atomic-write": "0.2.0-rc.2",
        "@deepseek-ai/dsh-base": "0.2.0-rc.2",
        "@deepseek-ai/dsh-client-ui-agent-preset": "0.2.0-rc.2",
        "@deepseek-ai/dsh-client-ui-cordis": "0.2.0-rc.2",
        "@deepseek-ai/dsh-cmdline": "0.2.0-rc.2",
        "@deepseek-ai/dsh-command-compact": "0.2.0-rc.2",
        "@deepseek-ai/dsh-command-goal": "0.2.0-rc.2",
        "@deepseek-ai/dsh-compaction-basic": "0.2.0-rc.2",
        "@deepseek-ai/dsh-compaction-tool-result-pruner": "0.2.0-rc.2",
        "@deepseek-ai/dsh-cordis-client-runner": "0.2.0-rc.2",
        "@deepseek-ai/dsh-experimental-agent-team-profile": "0.2.0-rc.2",
        "@deepseek-ai/dsh-experimental-auto-review": "0.2.0-rc.2",
        "@deepseek-ai/dsh-experimental-schedule-bundle": "0.2.0-rc.2",
        "@deepseek-ai/dsh-experimental-voice-input-bundle": "0.2.0-rc.2",
        "@deepseek-ai/dsh-fs-local": "0.2.0-rc.2",
        "@deepseek-ai/dsh-goal": "0.2.0-rc.2",
        "@deepseek-ai/dsh-goal-round-driver": "0.2.0-rc.2",
        "@deepseek-ai/dsh-headless": "0.2.0-rc.2",
        "@deepseek-ai/dsh-hmr": "0.2.0-rc.2",
        "@deepseek-ai/dsh-home-paths": "0.2.0-rc.2",
        "@deepseek-ai/dsh-hooks-claude-code": "0.2.0-rc.2",
        "@deepseek-ai/dsh-hooks-codex": "0.2.0-rc.2",
        "@deepseek-ai/dsh-http-proxy": "0.2.0-rc.2",
        "@deepseek-ai/dsh-jobs-local": "0.2.0-rc.2",
        "@deepseek-ai/dsh-launch-environment": "0.2.0-rc.2",
        "@deepseek-ai/dsh-mcp-client": "0.2.0-rc.2",
        "@deepseek-ai/dsh-mcp-resources": "0.2.0-rc.2",
        "@deepseek-ai/dsh-persona": "0.2.0-rc.2",
        "@deepseek-ai/dsh-plan-mode": "0.2.0-rc.2",
        "@deepseek-ai/dsh-plugin-manager": "0.2.0-rc.2",
        "@deepseek-ai/dsh-pwsh-local": "0.2.0-rc.2",
        "@deepseek-ai/dsh-pwsh-sandbox": "0.2.0-rc.2",
        "@deepseek-ai/dsh-schedule": "0.2.0-rc.2",
        "@deepseek-ai/dsh-sdk-app": "0.2.0-rc.2",
        "@deepseek-ai/dsh-sdk-minimal": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session-projection": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session-reference": "0.2.0-rc.2",
        "@deepseek-ai/dsh-skill": "0.2.0-rc.2",
        "@deepseek-ai/dsh-skill-filesystem": "0.2.0-rc.2",
        "@deepseek-ai/dsh-skill-office": "0.2.0-rc.2",
        "@deepseek-ai/dsh-terminal": "0.2.0-rc.2",
        "@deepseek-ai/dsh-terminal-bash": "0.2.0-rc.2",
        "@deepseek-ai/dsh-time-context": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tmux-context": "0.2.0-rc.2",
        "@deepseek-ai/dsh-token-meter": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-ask-user": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-bash": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-bash-persistent": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-cordis": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-fs": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-fs-search": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-goal": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-jobs": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-present": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-pwsh": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-pwsh-persistent": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-ralph": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-skill": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-str-replace-editor": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-subagent": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-subagent-control": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-todo": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-web": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-workflow": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-workspace-dependencies": "0.2.0-rc.2",
        "@deepseek-ai/dsh-web-app": "0.2.0-rc.2",
        "@deepseek-ai/dsh-webhook": "0.2.0-rc.2",
        "@deepseek-ai/dsh-webhook-github": "0.2.0-rc.2",
        "@deepseek-ai/dsh-workflow-ptc": "0.2.0-rc.2",
        "@deepseek-ai/schemastery": "~3.18.4",
        "commander": "^15.0.0",
        "js-yaml": "^4.2.0",
        "node-addon-require-builtin": "^0.1.6"
      },
      "bin": {
        "dsh": "lib/bin.js"
      }
    },
    "node_modules/@deepseek-ai/dsh-anonymous-user-id": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-anonymous-user-id/-/dsh-anonymous-user-id-0.2.0-rc.2.tgz",
      "integrity": "sha512-/VDAUjcv/xj+iPDrTTt6rC/+jo8r/H8WXEQPmjbB8W9q/cDnlp3KzM87Dy/6jT085G7a3BjsXTk0K6Bol0AcTg==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-brand": "0.2.0-rc.2",
        "@deepseek-ai/dsh-home-paths": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-attachment": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-attachment/-/dsh-attachment-0.2.0-rc.2.tgz",
      "integrity": "sha512-asUDLv+mfb30vjjlQtMI9aBnC+kmPoUxS1ooadhwAd8wssIlLetq97nzC5W1qd0GQGwZtPG/gpljVAMcSwPr1g==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-brand": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-bash-local": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-bash-local/-/dsh-bash-local-0.2.0-rc.2.tgz",
      "integrity": "sha512-38cihtu0JSBfj4GAH8pPX0v2tPDZBcPbgX9CjjMTPbhNRF30C+Ncg5zhJo5weaHQR0RnqOIJVuDHxcJ3yT50gg==",
      "inBundle": true,
      "license": "MIT",
      "dependencies": {
        "@deepseek-ai/schemastery": "~3.18.4"
      },
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-shell": "0.2.0-rc.2",
        "@deepseek-ai/dsh-subprocess": "0.2.0-rc.2",
        "@deepseek-ai/dsh-timeout": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-client-store": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-client-store/-/dsh-client-store-0.2.0-rc.2.tgz",
      "integrity": "sha512-unHIDNnHudDIj05W99m+dVPXLYy7qNvMJ/D5FWb7cov0CbiQvliqbvFeMAU6LzC+u3vTkVJgSMIAwAVdQgYHEA==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4"
      }
    },
    "node_modules/@deepseek-ai/dsh-client-ui-primitives": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-client-ui-primitives/-/dsh-client-ui-primitives-0.2.0-rc.2.tgz",
      "integrity": "sha512-Zx/MRT8NH6rYEvPnk4FQaHrADM6Dh1PQCprieqdvKj6yFhD/CJUVjSN08suGF6FPQekfVTJtS0WxY1XbQ5Ed9Q==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4"
      }
    },
    "node_modules/@deepseek-ai/dsh-client-ui-slots": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-client-ui-slots/-/dsh-client-ui-slots-0.2.0-rc.2.tgz",
      "integrity": "sha512-zfILCyG3ijHT7S8+WDXFz4RMxBJtG9A3ngtDBnqcLbD5wzKz8H7E+HC657USa6RgG13C2RGSs73sfKcSs4WtWQ==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4"
      }
    },
    "node_modules/@deepseek-ai/dsh-compaction": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-compaction/-/dsh-compaction-0.2.0-rc.2.tgz",
      "integrity": "sha512-aghHthiqhFZK5NlX/EJk54UgdBYJesmqHMxLQqwwzdq35kuFAx1ThxyNCEM/d244MG9IvvD0tSVk0Fj4UPx+Mw==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-brand": "0.2.0-rc.2",
        "@deepseek-ai/dsh-commands": "0.2.0-rc.2",
        "@deepseek-ai/dsh-invariants": "0.2.0-rc.2",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-deepseek-account": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-deepseek-account/-/dsh-deepseek-account-0.2.0-rc.2.tgz",
      "integrity": "sha512-hA1Etqs6oFvcRvkwCBP5Zp3lknSc629WyOgudMF/N7DkOsMBsYC+3Qj4hpkoF/G2pWGO7qsXmC3fRwFk17foHg==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-agent": "0.2.0-rc.2",
        "@deepseek-ai/dsh-brand": "0.2.0-rc.2",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2"
      },
      "peerDependenciesMeta": {
        "@deepseek-ai/dsh-agent": {
          "optional": true
        }
      }
    },
    "node_modules/@deepseek-ai/dsh-fs": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-fs/-/dsh-fs-0.2.0-rc.2.tgz",
      "integrity": "sha512-PuVcI7drTwa19Key54DROoqnDFTTFkl8TPlyrTnS3BSnykm+jKbB13ES/PQEJoRunNdQkNZa12jtbUI4BP/EHw==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-brand": "0.2.0-rc.2",
        "@deepseek-ai/dsh-invariants": "0.2.0-rc.2",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
        "@deepseek-ai/dsh-sandbox": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-hook-protocol": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-hook-protocol/-/dsh-hook-protocol-0.2.0-rc.2.tgz",
      "integrity": "sha512-ew0biR00o9ilXExq71XGYYbC0uJl+sr6Ju/zjzNUf/vXSZEuOMs9I89xA0R82Od8KLPMobPtQIs8YMwTHjiJEQ==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-invariants": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session": "0.2.0-rc.2",
        "@deepseek-ai/dsh-shell": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-jobs": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-jobs/-/dsh-jobs-0.2.0-rc.2.tgz",
      "integrity": "sha512-SuCCfXZDabBxsKbHoulXEeQrRSYuOYLSfhvnflQf+CYeb68wggKraejkLyO60LrCGnBJsgCqKIdIKLCUvIeN+g==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-agent": "0.2.0-rc.2",
        "@deepseek-ai/dsh-brand": "0.2.0-rc.2",
        "@deepseek-ai/dsh-invariants": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session": "0.2.0-rc.2",
        "@deepseek-ai/dsh-workspace": "0.2.0-rc.2"
      },
      "peerDependenciesMeta": {
        "@deepseek-ai/dsh-workspace": {
          "optional": true
        }
      }
    },
    "node_modules/@deepseek-ai/dsh-llm": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-llm/-/dsh-llm-0.2.0-rc.2.tgz",
      "integrity": "sha512-6QFrQn/h0iNqCfPpgQidnHtLSpA99A7ZND/uYKaGSd/4BGP8KBhuRd0w63e9s4u+hfW8jc3j29WKcNLIOeUfcA==",
      "inBundle": true,
      "license": "MIT",
      "dependencies": {
        "@deepseek-ai/dsh-brand": "0.2.0-rc.2",
        "@deepseek-ai/dsh-timeout": "0.2.0-rc.2",
        "@deepseek-ai/dsh-typert-protocol": "0.2.0-rc.2",
        "@deepseek-ai/dsh-util-crypto": "0.2.0-rc.2",
        "@deepseek-ai/dsh-util-values": "0.2.0-rc.2",
        "@deepseek-ai/schemastery": "~3.18.4",
        "zod": "^4.4.3"
      },
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4"
      }
    },
    "node_modules/@deepseek-ai/dsh-llm-deepseek": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-llm-deepseek/-/dsh-llm-deepseek-0.2.0-rc.2.tgz",
      "integrity": "sha512-Vk0oz0qAXYLC/tKoGfhRioank4FNX0Xdx8oDYduKL1HDf2tO72X+Nrq7hZaJp9nwvXCcg5TnPRIvE8ETZ98C5g==",
      "inBundle": true,
      "license": "MIT",
      "dependencies": {
        "@deepseek-ai/cosmokit": "~1.8.5",
        "@deepseek-ai/dsh-brand": "0.2.0-rc.2",
        "@deepseek-ai/dsh-util-values": "0.2.0-rc.2",
        "@deepseek-ai/schemastery": "~3.18.4",
        "eventsource-parser": "^3.1.0"
      },
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/cordis-plugin-loader": "~1.0.5",
        "@deepseek-ai/dsh-anonymous-user-id": "0.2.0-rc.2",
        "@deepseek-ai/dsh-atomic-write": "0.2.0-rc.2",
        "@deepseek-ai/dsh-attachment": "0.2.0-rc.2",
        "@deepseek-ai/dsh-deepseek-llm-api-extensions": "0.2.0-rc.2",
        "@deepseek-ai/dsh-fs": "0.2.0-rc.2",
        "@deepseek-ai/dsh-home-paths": "0.2.0-rc.2",
        "@deepseek-ai/dsh-launch-environment": "0.2.0-rc.2",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
        "@deepseek-ai/dsh-timeout": "0.2.0-rc.2"
      },
      "peerDependenciesMeta": {
        "@deepseek-ai/cordis-plugin-loader": {
          "optional": true
        }
      }
    },
    "node_modules/@deepseek-ai/dsh-output-retention": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-output-retention/-/dsh-output-retention-0.2.0-rc.2.tgz",
      "integrity": "sha512-+yVL95Om473rZTHIyvjZ6JUyDl2orRpyjXeMSqOzJqh66/sERUfPgCtwMbnH9tzhxTF6nw6cC30I9dxgHEz13w==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4"
      }
    },
    "node_modules/@deepseek-ai/dsh-ptc-runtime": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-ptc-runtime/-/dsh-ptc-runtime-0.2.0-rc.2.tgz",
      "integrity": "sha512-HR/3h1VFRcNlAAjCtCAxZ4V3F5pViYicXcLBuYLGjzXWpOhr4zKzeFKh9+UMLjsc9XWIarJMoSvxl662nDV/xQ==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-sandbox": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-sandbox": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-sandbox/-/dsh-sandbox-0.2.0-rc.2.tgz",
      "integrity": "sha512-luKF7ey6HRZkGhImqLCB5Npt4f4omDRk1r+x5qQNqqdNOuN9LXciKDMNPfnSbHfKCcqSZbH3sK+APOmKzRAhVA==",
      "inBundle": true,
      "license": "MIT",
      "dependencies": {
        "@deepseek-ai/dsh-util-values": "0.2.0-rc.2"
      },
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-sdk-client": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-sdk-client/-/dsh-sdk-client-0.2.0-rc.2.tgz",
      "integrity": "sha512-woZfQkq5SMAJa/FYIKfeova97kNO3f8nN7+EpovmB+JKhMP87AHXjuhCdIDkt29J2MxqTZ3OI4xQ8BQTU2iwow==",
      "inBundle": true,
      "license": "MIT",
      "dependencies": {
        "@deepseek-ai/dsh": "0.2.0-rc.2"
      },
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
        "@deepseek-ai/dsh-sdk-protocol": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-sdk-protocol": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-sdk-protocol/-/dsh-sdk-protocol-0.2.0-rc.2.tgz",
      "integrity": "sha512-hs4Kl2x17wAuhSMUWuNpeHvv1mOm+F+A2EQnYu1QmxVux50PR3xHthee7IX/PylpgZybcfBn1JAigKvOFs5GPA==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session": "0.2.0-rc.2",
        "@deepseek-ai/dsh-subagent": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-session": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-session/-/dsh-session-0.2.0-rc.2.tgz",
      "integrity": "sha512-wj+6MeqCYbDcbEvKH3puHyEGdjyu51JwBoN6Ua2tz6griLufDgLM5HpSU40L5xgpbOfrYVhXZs4vRgOrMlFY2g==",
      "inBundle": true,
      "license": "MIT",
      "dependencies": {
        "@deepseek-ai/dsh-brand": "0.2.0-rc.2",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
        "@deepseek-ai/dsh-util-values": "0.2.0-rc.2"
      },
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-scope": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-session-persistence": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-session-persistence/-/dsh-session-persistence-0.2.0-rc.2.tgz",
      "integrity": "sha512-2OoRHZYWi5Vy0+1bPU37Y/NTh6uQiZ3VdpvDmW1oCgsapQr2JS/Lbody1gXOMJ1KXglCSLmePgTMC00uKw/UIg==",
      "inBundle": true,
      "license": "MIT",
      "dependencies": {
        "@deepseek-ai/dsh-util-values": "0.2.0-rc.2"
      },
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-brand": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session": "0.2.0-rc.2",
        "@deepseek-ai/dsh-timeout": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-session-query": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-session-query/-/dsh-session-query-0.2.0-rc.2.tgz",
      "integrity": "sha512-seZkaK6E+L2KVUYbzQ5O3S9kKkINul/1WujXNsE7/9vE4NSg97hJjZxCwqYs81qlEO0Ei3f27+W61EtXOYYoGw==",
      "inBundle": true,
      "license": "MIT",
      "dependencies": {
        "@deepseek-ai/dsh-session-format-catalog": "0.2.0-rc.2"
      },
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-brand": "0.2.0-rc.2",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session-persistence": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session-projection": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session-projection-cache": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session-title": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tool-todo": "0.2.0-rc.2"
      },
      "peerDependenciesMeta": {
        "@deepseek-ai/dsh-session-persistence": {
          "optional": true
        },
        "@deepseek-ai/dsh-session-projection": {
          "optional": true
        },
        "@deepseek-ai/dsh-session-projection-cache": {
          "optional": true
        }
      }
    },
    "node_modules/@deepseek-ai/dsh-session-telemetry": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-session-telemetry/-/dsh-session-telemetry-0.2.0-rc.2.tgz",
      "integrity": "sha512-L0ST+ZmVYdk2YMzgOZLPZNmhB2htF1HqNahuBJpID2d+XyiWYNy3vXhm/lHPs79FxHKN0XVJUR5mUv//MZK4LQ==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-agent": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-session-title-llm": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-session-title-llm/-/dsh-session-title-llm-0.2.0-rc.2.tgz",
      "integrity": "sha512-S3WNORrtkrDI6F9NADF2cKdGO8FxS7tvSsf+cxmOu6qJktidRP0/n2O9ePmOX3azZ93Ta/mGNMbPueSs7Dta+Q==",
      "inBundle": true,
      "license": "MIT",
      "dependencies": {
        "@deepseek-ai/dsh-util-values": "0.2.0-rc.2",
        "@deepseek-ai/schemastery": "~3.18.4"
      },
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session-title": "0.2.0-rc.2",
        "@deepseek-ai/dsh-timeout": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-shell": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-shell/-/dsh-shell-0.2.0-rc.2.tgz",
      "integrity": "sha512-+3uBpxhXSzukUZx7XjdnUVfItj/w4maPQAcDXnVxF8vVt/dHa2NDJBXyYC9fzIA4PnXqVHFURdrhMfFgeD7GJA==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-sandbox": "0.2.0-rc.2",
        "@deepseek-ai/dsh-subprocess": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-spill": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-spill/-/dsh-spill-0.2.0-rc.2.tgz",
      "integrity": "sha512-DWcSeURbNzlxMPOtRCzjmM6QTtEzlt7hD26fypE+9guvKPFJ9HUeCg/GQJRfpLbRQqukm4SJroHTSoZitd/t5g==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-brand": "0.2.0-rc.2",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-subagent-in-process-driver": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-subagent-in-process-driver/-/dsh-subagent-in-process-driver-0.2.0-rc.2.tgz",
      "integrity": "sha512-6ZYAipEyviSo4WlAesVM1DWBkLYQVZw/A8lFWOSVJjl5qOb3q4buZcW/Xy7XKw/forwNSkqaPPvJ/s0kdu1iCw==",
      "inBundle": true,
      "license": "MIT",
      "dependencies": {
        "@deepseek-ai/dsh-brand": "0.2.0-rc.2"
      },
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-agent": "0.2.0-rc.2",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session": "0.2.0-rc.2",
        "@deepseek-ai/dsh-subagent": "0.2.0-rc.2",
        "@deepseek-ai/dsh-system-prompt": "0.2.0-rc.2",
        "@deepseek-ai/dsh-tools": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/dsh-util-time": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-util-time/-/dsh-util-time-0.2.0-rc.2.tgz",
      "integrity": "sha512-x+b6PJ7BQ5HnNs0wa+eojmwkveR5X77VzhfKJ8p7ndB0TAdFGBshji30nxNjn/8aNWMdE90gsIvbtazsrGZn+w==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4"
      }
    },
    "node_modules/@deepseek-ai/dsh-util-workspace-path": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-util-workspace-path/-/dsh-util-workspace-path-0.2.0-rc.2.tgz",
      "integrity": "sha512-pjjpi+hN29dVf9HMitxo5gUAXKNdYcJ75vNVjKp2T6sdBy0wxcMKlfddu/bYx/xDL3teNBhh17EH7w1asYNNZQ==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4"
      }
    },
    "node_modules/@deepseek-ai/dsh-workflow": {
      "version": "0.2.0-rc.2",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/dsh-workflow/-/dsh-workflow-0.2.0-rc.2.tgz",
      "integrity": "sha512-kvRw3d+x+clns+HrknZ6EDy32OEhKTmngS2LBuL7vjQl3XjEbM8QhnxbDW3NaRbEvZ5w2/+2GZqlo0bU/w6Cxw==",
      "inBundle": true,
      "license": "MIT",
      "peerDependencies": {
        "@deepseek-ai/cordis": "~4.0.4",
        "@deepseek-ai/dsh-agent": "0.2.0-rc.2",
        "@deepseek-ai/dsh-brand": "0.2.0-rc.2",
        "@deepseek-ai/dsh-invariants": "0.2.0-rc.2",
        "@deepseek-ai/dsh-llm": "0.2.0-rc.2",
        "@deepseek-ai/dsh-session": "0.2.0-rc.2"
      }
    },
    "node_modules/@deepseek-ai/libreoffice-kit": {
      "version": "0.1.5",
      "resolved": "https://registry.npmjs.org/@deepseek-ai/libreoffice-kit/-/libreoffice-kit-0.1.5.tgz",
      "integrity": "sha512-H12xtUsAyl70zFeQ5pk5GGRc3N1+6zn+DVAcqwlguI6EvqopBGP3xkUmePU7g5f6ydYlDZLWedHT9lTSL7zLxA==",
      "inBundle": true,
      "license": "MPL-2.0",
      "dependencies": {
        "fflate": "0.8.2",
        "fontkit": "2.0.4",
        "koffi": "3.1.1",
        "saxes": "6.0.0"
      },
      "bin": {
        "dsoffice": "lib/cli.js"
      },
      "engines": {
        "node": ">=22.19.0"
      },
      "optionalDependencies": {
        "@deepseek-ai/libreoffice-kit-darwin-arm64": "0.1.5",
        "@deepseek-ai/libreoffice-kit-darwin-x64": "0.1.5",
        "@deepseek-ai/libreoffice-kit-wasm": "0.1.5",
        "@deepseek-ai/libreoffice-kit-win32-arm64": "0.1.5",
        "@deepseek-ai/libreoffice-kit-win32-x64": "0.1.5"
      }
    },
    "node_modules/fflate": {
      "version": "0.8.3",
      "resolved": "https://registry.npmjs.org/fflate/-/fflate-0.8.3.tgz",
      "integrity": "sha512-tbZNuJrLwGUp3zshBtdy4W+ORxZuIh8a5ilyIEQDC5rY1f3U20JMry0Ll3WBzU58EZKsEuJFXhb5gwv8CsPvgA==",
      "inBundle": true,
      "license": "MIT"
    }
  }
}
```

## Nested-package version inventory

All canonical lock entries under the DeepSeek namespace, including bundled nested dependencies, plus every fflate entry. The lock digest above binds this excerpt to the canonical artifact.

| Lock path | Exact version | Bundled |
|---|---|---|
| `node_modules/@deepseek-ai/cordis` | `4.0.4` | yes |
| `node_modules/@deepseek-ai/cordis-plugin-group` | `1.0.4` | yes |
| `node_modules/@deepseek-ai/cordis-plugin-include` | `1.0.9` | yes |
| `node_modules/@deepseek-ai/cordis-plugin-loader` | `1.0.5` | yes |
| `node_modules/@deepseek-ai/cordis-plugin-timer` | `1.1.6` | yes |
| `node_modules/@deepseek-ai/cosmokit` | `1.8.5` | yes |
| `node_modules/@deepseek-ai/dsh` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-acp` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-acp-app` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-acp-app/node_modules/commander` | `15.0.0` | yes |
| `node_modules/@deepseek-ai/dsh-agent` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-agent-default-model` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-agent-instructions` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-agent-loop` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-agent-preset` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-agent-preset-registry` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-agent-tool-presentation` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-anonymous-user-id` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-api-account-controller` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-api-gateway` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-api-job-controller` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-api-remotes` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-api-session-controller` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-api-settings-controller` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-api-terminal-controller` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-api-workspace-controller` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-api-workspace-files` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-app-boot` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-app-boot/node_modules/ajv` | `8.20.0` | yes |
| `node_modules/@deepseek-ai/dsh-app-boot/node_modules/json-schema-traverse` | `1.0.0` | yes |
| `node_modules/@deepseek-ai/dsh-atomic-write` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-attachment` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-darwin-arm64` | `0.35.5` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-darwin-x64` | `0.35.5` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-libvips-darwin-arm64` | `1.3.4` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-libvips-darwin-x64` | `1.3.4` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-libvips-linux-arm` | `1.3.4` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-libvips-linux-arm64` | `1.3.4` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-libvips-linux-ppc64` | `1.3.4` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-libvips-linux-riscv64` | `1.3.4` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-libvips-linux-s390x` | `1.3.4` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-libvips-linux-x64` | `1.3.4` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-libvips-linuxmusl-arm64` | `1.3.4` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-libvips-linuxmusl-x64` | `1.3.4` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-linux-arm` | `0.35.5` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-linux-arm64` | `0.35.5` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-linux-ppc64` | `0.35.5` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-linux-riscv64` | `0.35.5` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-linux-s390x` | `0.35.5` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-linux-x64` | `0.35.5` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-linuxmusl-arm64` | `0.35.5` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-linuxmusl-x64` | `0.35.5` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-win32-arm64` | `0.35.5` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-win32-ia32` | `0.35.5` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/@img/sharp-win32-x64` | `0.35.5` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/detect-libc` | `2.1.2` | yes |
| `node_modules/@deepseek-ai/dsh-attachment-local/node_modules/sharp` | `0.35.5` | yes |
| `node_modules/@deepseek-ai/dsh-authorization` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-base` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-bash-local` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-bash-sandbox` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-brand` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-chunked-list` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-connection` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-file-upload` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-hmr` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-locale` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-modules` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-product-analytics` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-resources` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-shortcuts` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-store` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-agent-preset` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-approval` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-attachment` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-brand-official` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-chat` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-commands` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-conversation` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-cordis` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-deliverables` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-directory-picker-browse` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-directory-picker-native` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-goal` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-input-trigger` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-jobs` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-layout` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-message-feedback` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-model-selection` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-open-in-app` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-permission-presets` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-plan` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-plugin-manager` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-primitives` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-reference` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-renderer` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-schedule` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-session` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-settings` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-settings-account` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-settings-agent-loop` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-settings-general` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-settings-models` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-settings-plugin-inventory` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-settings-plugins` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-settings-session-log` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-settings-shell` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-settings-subagent` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-settings-web-search` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-shortcuts` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-sidebar` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-sidebar-browser` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-sidebar-documentpreview` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-sidebar-files` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-sidebar-right` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-sidebar-terminal` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-skill` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-slots` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-subagent` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-theme` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-tool` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-trajectory` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-user-questions` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-workflow-run` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-client-ui-workspace` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-cmdline` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-command-compact` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-command-feedback` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-command-goal` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-commands` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-compaction` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-compaction-basic` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-compaction-image-offload` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-compaction-tool-result-pruner` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-config-editor` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-cordis-client-runner` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-cordis-host-runner` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-credentials` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-credentials-local` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-credentials-local/node_modules/chokidar` | `4.0.3` | yes |
| `node_modules/@deepseek-ai/dsh-credentials-local/node_modules/readdirp` | `4.1.2` | yes |
| `node_modules/@deepseek-ai/dsh-deepseek-account` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-deepseek-account-platform` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-deepseek-llm-api-extensions` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-deque` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-experimental-agent-team` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-experimental-agent-team-profile` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-experimental-api-speech-to-text` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-experimental-auto-review` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-experimental-client-ui-agent-team` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-experimental-client-ui-voice-input` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-experimental-schedule-bundle` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-experimental-speech-to-text` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-experimental-speech-to-text-sensevoice` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-experimental-tool-agent-team` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-experimental-voice-input-bundle` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-file-reference` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-file-reference-local` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-fs` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-fs-local` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-fs-local/node_modules/chokidar` | `4.0.3` | yes |
| `node_modules/@deepseek-ai/dsh-fs-local/node_modules/readdirp` | `4.1.2` | yes |
| `node_modules/@deepseek-ai/dsh-fs-observation-policy` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-fs-sandbox` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-goal` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-goal-round-driver` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-headless` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-headless/node_modules/commander` | `15.0.0` | yes |
| `node_modules/@deepseek-ai/dsh-hmr` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-hmr/node_modules/chokidar` | `4.0.3` | yes |
| `node_modules/@deepseek-ai/dsh-hmr/node_modules/readdirp` | `4.1.2` | yes |
| `node_modules/@deepseek-ai/dsh-home-paths` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-hook-protocol` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-hooks-claude-code` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-hooks-codex` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-host-directory-picker` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-host-directory-picker-auto` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-host-directory-picker-browse` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-host-directory-picker-native` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-host-frontend-static` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-host-open-in-app` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-host-plugin-inventory` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-host-product-telemetry-otel` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-host-product-telemetry-otel/node_modules/@opentelemetry/api-logs` | `0.220.0` | yes |
| `node_modules/@deepseek-ai/dsh-host-product-telemetry-otel/node_modules/@opentelemetry/core` | `2.9.0` | yes |
| `node_modules/@deepseek-ai/dsh-host-product-telemetry-otel/node_modules/@opentelemetry/otlp-exporter-base` | `0.220.0` | yes |
| `node_modules/@deepseek-ai/dsh-host-product-telemetry-otel/node_modules/@opentelemetry/otlp-transformer` | `0.220.0` | yes |
| `node_modules/@deepseek-ai/dsh-host-product-telemetry-otel/node_modules/@opentelemetry/resources` | `2.9.0` | yes |
| `node_modules/@deepseek-ai/dsh-host-product-telemetry-otel/node_modules/@opentelemetry/sdk-logs` | `0.220.0` | yes |
| `node_modules/@deepseek-ai/dsh-host-product-telemetry-otel/node_modules/@opentelemetry/sdk-metrics` | `2.9.0` | yes |
| `node_modules/@deepseek-ai/dsh-host-webserver` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-http-proxy` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-http-proxy/node_modules/undici` | `8.11.2` | yes |
| `node_modules/@deepseek-ai/dsh-invariants` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-jobs` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-jobs-local` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-launch-environment` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-lazy-require` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-llm` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-llm-deepseek` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-llm-deepseek-account` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-llm-deepseek-api-key` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-llm-pi-ai` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-llm-pi-ai/node_modules/@anthropic-ai/sdk` | `0.124.0` | yes |
| `node_modules/@deepseek-ai/dsh-llm-pi-ai/node_modules/@earendil-works/pi-ai` | `0.87.1` | yes |
| `node_modules/@deepseek-ai/dsh-llm-pi-ai/node_modules/@earendil-works/pi-telemetry` | `0.87.1` | yes |
| `node_modules/@deepseek-ai/dsh-llm-pi-ai/node_modules/agent-base` | `9.0.0` | yes |
| `node_modules/@deepseek-ai/dsh-llm-pi-ai/node_modules/http-proxy-agent` | `9.1.0` | yes |
| `node_modules/@deepseek-ai/dsh-llm-pi-ai/node_modules/https-proxy-agent` | `9.1.0` | yes |
| `node_modules/@deepseek-ai/dsh-llm-pi-ai/node_modules/openai` | `6.40.0` | yes |
| `node_modules/@deepseek-ai/dsh-llm-retry` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-mcp-client` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-mcp-resources` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-message-feedback` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-native-command` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-office-to-pdf` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-otel` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-otel/node_modules/@opentelemetry/api-logs` | `0.220.0` | yes |
| `node_modules/@deepseek-ai/dsh-otel/node_modules/@opentelemetry/core` | `2.9.0` | yes |
| `node_modules/@deepseek-ai/dsh-otel/node_modules/@opentelemetry/otlp-exporter-base` | `0.220.0` | yes |
| `node_modules/@deepseek-ai/dsh-otel/node_modules/@opentelemetry/otlp-transformer` | `0.220.0` | yes |
| `node_modules/@deepseek-ai/dsh-otel/node_modules/@opentelemetry/otlp-transformer/node_modules/@opentelemetry/resources` | `2.9.0` | yes |
| `node_modules/@deepseek-ai/dsh-otel/node_modules/@opentelemetry/resources` | `2.11.0` | yes |
| `node_modules/@deepseek-ai/dsh-otel/node_modules/@opentelemetry/resources/node_modules/@opentelemetry/core` | `2.11.0` | yes |
| `node_modules/@deepseek-ai/dsh-otel/node_modules/@opentelemetry/sdk-logs` | `0.220.0` | yes |
| `node_modules/@deepseek-ai/dsh-otel/node_modules/@opentelemetry/sdk-logs/node_modules/@opentelemetry/resources` | `2.9.0` | yes |
| `node_modules/@deepseek-ai/dsh-otel/node_modules/@opentelemetry/sdk-metrics` | `2.9.0` | yes |
| `node_modules/@deepseek-ai/dsh-otel/node_modules/@opentelemetry/sdk-metrics/node_modules/@opentelemetry/resources` | `2.9.0` | yes |
| `node_modules/@deepseek-ai/dsh-output-retention` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-package-manifest` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-permission-presets` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-persona` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-plan-mode` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-plugin-manager` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-plugin-manager/node_modules/execa` | `10.0.1` | yes |
| `node_modules/@deepseek-ai/dsh-plugin-manager/node_modules/is-stream` | `4.0.1` | yes |
| `node_modules/@deepseek-ai/dsh-plugin-package-inventory-deepseek` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-ptc-runtime` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-ptc-runtime-node` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-pwsh-local` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-pwsh-sandbox` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-repeat-tool-reminder` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-sandbox` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-sandbox-local` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-sandbox-policy` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-sandbox-windows-acl` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-schedule` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-scope` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-sdk-app` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-sdk-app/node_modules/commander` | `15.0.0` | yes |
| `node_modules/@deepseek-ai/dsh-sdk-client` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-sdk-jsonrpc-server` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-sdk-minimal` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-sdk-protocol` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-checkpoint-policy` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-format` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-format-catalog` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-format-v0-to-v1` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-format-v1-to-v2` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-format-v2-to-v3` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-format-v3-to-v4` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-log-deepseek` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-log-export` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-persistence` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-persistence-jsonl` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-projection` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-projection-cache` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-query` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-query-sqlite` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-reference` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-stats` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-telemetry` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-telemetry-otel` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-telemetry-otel/node_modules/@opentelemetry/api-logs` | `0.220.0` | yes |
| `node_modules/@deepseek-ai/dsh-session-telemetry-otel/node_modules/@opentelemetry/core` | `2.9.0` | yes |
| `node_modules/@deepseek-ai/dsh-session-telemetry-otel/node_modules/@opentelemetry/otlp-exporter-base` | `0.220.0` | yes |
| `node_modules/@deepseek-ai/dsh-session-telemetry-otel/node_modules/@opentelemetry/otlp-transformer` | `0.220.0` | yes |
| `node_modules/@deepseek-ai/dsh-session-telemetry-otel/node_modules/@opentelemetry/resources` | `2.9.0` | yes |
| `node_modules/@deepseek-ai/dsh-session-telemetry-otel/node_modules/@opentelemetry/sdk-logs` | `0.220.0` | yes |
| `node_modules/@deepseek-ai/dsh-session-telemetry-otel/node_modules/@opentelemetry/sdk-metrics` | `2.9.0` | yes |
| `node_modules/@deepseek-ai/dsh-session-title` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-title-first-prompt-llm` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-title-llm` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-session-turn-outline` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-settings` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-shell` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-shell-env` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-skill` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-skill-badge` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-skill-filesystem` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-skill-filesystem/node_modules/chokidar` | `5.0.0` | yes |
| `node_modules/@deepseek-ai/dsh-skill-filesystem/node_modules/readdirp` | `5.1.1` | yes |
| `node_modules/@deepseek-ai/dsh-skill-office` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-spill` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-spill-local` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-spill-policy` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-storage` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-storage-domain` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-storage-json` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-subagent` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-subagent-fork-in-process` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-subagent-in-process-driver` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-subagent-spawn-in-process` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-subprocess` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-subprocess-local` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-system-prompt` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-terminal` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-terminal-bash` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-time-context` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-timeout` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tmux-context` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-token-meter` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-ask-user` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-bash` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-bash-persistent` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-call-timeout-policy` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-cordis` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-fs` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-fs-search` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-goal` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-jobs` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-present` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-pwsh` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-pwsh-persistent` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-ralph` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-skill` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-str-replace-editor` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-subagent` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-subagent-control` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-todo` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-web` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-workflow` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tool-workspace-dependencies` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-tools` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-typert-loader` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-typert-protocol` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-typert-registry` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-user-approval` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-user-questions` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-util-code-language` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-util-crypto` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-util-time` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-util-values` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-util-workspace-path` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-web` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-web-app` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-web-app/node_modules/commander` | `15.0.0` | yes |
| `node_modules/@deepseek-ai/dsh-web-app/node_modules/open` | `11.0.4` | yes |
| `node_modules/@deepseek-ai/dsh-web-app/node_modules/wsl-utils` | `1.0.1` | yes |
| `node_modules/@deepseek-ai/dsh-web-fetch-http` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-web-fetch-http/node_modules/ipaddr.js` | `2.5.0` | yes |
| `node_modules/@deepseek-ai/dsh-web-fetch-http/node_modules/undici` | `8.11.2` | yes |
| `node_modules/@deepseek-ai/dsh-web-frontend` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-web-search-deepseek` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-webhook` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-webhook-github` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-win32-process` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-workflow` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-workflow-ptc` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-workspace` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh-workspace-changes` | `0.2.0-rc.2` | yes |
| `node_modules/@deepseek-ai/dsh/node_modules/commander` | `15.0.0` | yes |
| `node_modules/@deepseek-ai/libreoffice-kit` | `0.1.5` | yes |
| `node_modules/@deepseek-ai/libreoffice-kit-darwin-arm64` | `0.1.5` | yes |
| `node_modules/@deepseek-ai/libreoffice-kit-darwin-x64` | `0.1.5` | yes |
| `node_modules/@deepseek-ai/libreoffice-kit-wasm` | `0.1.5` | yes |
| `node_modules/@deepseek-ai/libreoffice-kit-win32-arm64` | `0.1.5` | yes |
| `node_modules/@deepseek-ai/libreoffice-kit-win32-x64` | `0.1.5` | yes |
| `node_modules/@deepseek-ai/node-addon-system` | `0.1.2` | yes |
| `node_modules/@deepseek-ai/node-addon-system-darwin-arm64` | `0.1.2` | yes |
| `node_modules/@deepseek-ai/node-addon-system-darwin-x64` | `0.1.2` | yes |
| `node_modules/@deepseek-ai/node-addon-system-linux-arm64` | `0.1.2` | yes |
| `node_modules/@deepseek-ai/node-addon-system-linux-x64` | `0.1.2` | yes |
| `node_modules/@deepseek-ai/schemastery` | `3.18.4` | yes |
| `node_modules/fflate` | `0.8.3` | yes |

## Independently visible clean install

[CI 37120296023](https://github.com/nrslib/takt/actions/runs/37120296023) passed on the snapshot source. [SDK mock job 111194982834](https://github.com/nrslib/takt/actions/runs/37120296023/job/111194982834) exposes the clean-install/build/real-SDK mock result in its public log:

```text
2026-10-03T11:40:57.2756661Z npm ci
2026-10-03T11:41:41.2828163Z added 1741 packages, and audited 1742 packages in 44s
2026-10-03T11:43:07.0930757Z Test Files 1 passed (1)
2026-10-03T11:43:07.0932123Z Tests 19 passed (19)
```

This is checkout/real-SDK verification, not a packed-consumer claim. Separate local clean `npm ci --ignore-scripts` runs with npm 10.9.4 and 11.12.1 also exited 0 against the same lock.

## Production-only packed consumer: actual local result

Node 22.22.0. Commands: build; `node scripts/verify-deepseek-sdk-lock.mjs --pack`; `npm pack --json`; install that tarball in a fresh consumer with `npm install --omit=dev --ignore-scripts`; run the real packed SDK against a loopback HTTP mock; run the installed CLI help. Install, SDK smoke and CLI help each exited 0. No real model or live credentials were used. Actual npm artifact metadata:

```json
{
  "filename": "takt-0.68.0.tgz",
  "size": 142868949,
  "unpackedSize": 473502992,
  "entryCount": 36748,
  "shasum": "716a209966e3d073e0c785a9c91ea792b642288e"
}
```

Actual tool-smoke receipt (local execution attestation, not GitHub CI or CodeRabbit approval):

```json
{"status":"passed","codingTools":["read","write","edit","bash"],"liveTurns":2,"postTeardownRefused":true,"requestCount":6,"node":"v22.22.0"}
```

Manifests resolved inside the installed consumer:

```json
{"versions":{"dsh-sdk-client":"0.2.0-rc.2","dsh":"0.2.0-rc.2","dsh-llm":"0.2.0-rc.2","dsh-session":"0.2.0-rc.2","dsh-sdk-protocol":"0.2.0-rc.2","cordis":"4.0.4","libreoffice-kit":"0.1.5"},"toolkitFflateDeclaration":"0.8.3","resolvedFflate":"0.8.3"}
```

After packing, `npm ci --ignore-scripts` restored upstream dependency metadata successfully. Reproduce using [the migration contract](deepseek-sdk-migration.md#dependency-and-distribution-proof), never the checkout override alone. The CI result and local packed-consumer evidence are deliberately distinguished.
