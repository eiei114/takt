# Roblox TS 特化 選定メモ

## AgentTeam

- Planner: 構成監査とマルチプレイス移行設計
- Researcher: モダンテンプレート + Studio MCP 調査反映
- Implementer: `places/common` + `places/main` と Flamework networking 実装
- Reviewer: lint/build/rojo 前提で回帰チェック

## Final Structure

- `places/common/src/shared`
  - `network/events.ts`
  - `types/*`
- `places/main/src/client`
  - `main.client.ts`
  - `controllers/*`
  - `components/*`
  - `networking/events.ts`
- `places/main/src/server`
  - `main.server.ts`
  - `services/*`
  - `components/*`
  - `networking/events.ts`
- `places/main/src/shared`

## Decisions

- Package manager: `pnpm`
- Networking: `@flamework/networking`
- Multi-place: `common + main` から開始

## Notes

- Studio 内補助として `studio-rust-mcp-server` は有効。
- ただし、ソース管理の主軸は rbxts コード（Git）を維持する。
