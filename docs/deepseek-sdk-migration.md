# DeepSeek TypeScript SDK migration contract (#1658)

Status: **Unreleased**, replacing the Python/uv managed-environment design from #1560/#1562. This document is the public implementation-context snapshot; no released version or merge is claimed. The breaking-change release number remains a maintainer decision.

## Settled scope

- Use production npm dependencies, with SDK/runtime `0.2.0-rc.2` exactly pinned. Do not resolve mutable `latest`/`next` at runtime or auto-install a provider.
- Remove Python bridge, uv installer, install command, legacy-only configuration and assets completely. No compatibility wrappers, fallback, automatic conversion or user-file deletion.
- Preserve official credential-store references, environment precedence, endpoint consistency, managed-home separation, fixed diagnostics, redaction and supervised process-group cleanup.
- Enable stock native coding/delegation tools. Reject explicit unsupported permission/tool restrictions before execution, including tool-free report/status phases; do not pretend those workflow phases succeed.
- Preserve same-live-runtime FIFO turns. Cross-runtime history restoration is deferred pending SDK support; unsupported continuation fails before SDK startup. Interactive recovery warns, does not replay the failed turn, and starts fresh only on the next user turn. Credential-binding changes remain terminal and do not use this recovery.
- Bound idle runtimes at eight per process with LRU eviction; never evict active/queued turns. Foreign healthy owners exclusively hold the shared home and produce a distinct busy diagnostic. Unconfirmed cleanup retains a durable barrier; a per-instance supervisor exit receipt avoids a false barrier after SDK close errors. Empty owners alone are not proof: an unpublished supervisor remains fail-closed.
- Disable new SDK JSONL session persistence because the upstream format can retain credential-echoing provider errors. Existing user files are untouched.

The operator excluded Linux execution validation and install-size/time adoption gates from this work; declared platform support and existing CI are not removed. The operator separately accepted SDK session-ID changes and deferred history restoration. These amendments supersede the original issue's unamended acceptance wording, not the authentication/cleanup safety contract.

The local design records are `.scratch/takt-deepseek-harness-sdk/PRD.md` (historical uv design, current supersession notice), its issue `09-replace-python-sdk-with-npm-ts-sdk.md`, and `4_Project/OSS/takt-contribution/CONTEXT.md`. They remain in the contributor's Vault, not this source repository. This public snapshot makes the accepted replacement contract reviewable without private Vault access.

## Dependency and distribution proof

The [lock verification snapshot](deepseek-lock-verification.md) exposes exact root/peer/toolkit lock entries, the nested dependency version inventory, a canonical lock digest, public clean-install CI logs, and separately labeled local packed-consumer receipts. It is review evidence, not an alternative installation lockfile.

Root dependencies, root lock entries and bundles must include every SDK peer, even when npm marks it `inBundle` instead of `peer`: `dsh-llm`, `dsh-session`, `dsh-sdk-protocol` at `0.2.0-rc.2`, and `cordis` at `4.0.4`. `libreoffice-kit` is directly pinned/bundled at `0.1.5`, with its bundled `fflate` declaration aligned to patched `0.8.3`; upstream SDK/runtime code is not modified. This addresses the named fflate advisory, not all dependency advisories.

Run `node scripts/verify-deepseek-sdk-lock.mjs --pack` after installing/building to check pins and actual dry-run inventory, then install the actual `npm pack` tarball in a clean consumer with production dependencies only. Verify SDK/runtime resolution, toolkit metadata and fflate resolution in that consumer. Prepack changes local metadata; run `npm ci` after every pack attempt, including failure/interruption, to restore upstream metadata. PR verification records must report actual commands/results rather than infer distribution correctness from the checkout override.

## User migration and regression evidence

- English: [README](../README.md), [configuration and manual cleanup](configuration.md#deepseek-harness-deepseek-harness).
- Japanese: [README](README.ja.md), [configuration and manual cleanup](configuration.ja.md#deepseek-harness-deepseek-harness).
- Chinese: [README](README.zh-CN.md), [configuration and manual cleanup](configuration.zh-CN.md#deepseek-harness-deepseek-harness).
- Report terminal failures: `engine-report-fallback-integration.test.ts`, `parallel-runner-terminal-status.test.ts`, `report-phase-retry.test.ts`.
- Inspection/preview semantics: `team-leader-runner-structured-caller.test.ts`, `workflowResolver.test.ts`, `interactive-summary.test.ts`.
- Runtime ownership, publication, cleanup and cache: `deepseek-harness-client.test.ts`, `deepseek-harness-error-mapping.test.ts`.
- Removed-command entrypoint: `it-cli-dynamic-import-error.test.ts`.
- Dependency metadata, peer/inventory guards: `deepseek-publish-bundle.test.ts`.

These tests cover the contract; their presence alone is not a passing execution result. Current-head test/CI and packed-consumer outcomes belong in the PR verification comment.
