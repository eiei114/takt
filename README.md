# Roblox TS Project (Multi-Place)

roblox-ts + Flamework + Rojo を前提にした Roblox 開発プロジェクトです。

## Stack

- roblox-ts 3.x
- Flamework (`@flamework/core`, `@flamework/components`, `@flamework/networking`)
- Rojo
- TypeScript strict
- ESLint
- pnpm

## Directory

- `places/common/src/shared`: 共有型・ネットワーク契約
- `places/main/src/client`: main place クライアントコード
- `places/main/src/server`: main place サーバーコード
- `places/main/src/shared`: main place 固有 shared
- `out/`: rbxtsc 生成物
- `default.project.json`: Rojo マッピング

## Commands

- `pnpm run build`: roblox-ts コンパイル
- `pnpm run watch`: roblox-ts ウォッチ
- `pnpm run serve`: Rojo サーバー起動
- `pnpm run build:place`: place ファイルを `build/main.rbxlx` に出力
- `pnpm run lint`: TypeScript Lint

## Quick Start

```bash
corepack enable
pnpm install
pnpm run lint
pnpm run build
pnpm run serve
```

## Networking Example

- 契約: `places/common/src/shared/network/events.ts`
- Server: `places/main/src/server/services/NetworkService.ts`
- Client: `places/main/src/client/controllers/NetworkController.ts`

Client が `requestPing` を送信し、Server が `notifyPong` を返す最小ユースケースを実装しています。

## Optional: Roblox Studio MCP

`docs/studio-rust-mcp-server-research.md` を参照してください。
Studio を開いた状態で `studio-rust-mcp-server` を使うと `run_code` / `insert_model` を実行できます。
