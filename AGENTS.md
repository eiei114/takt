# Repository Guidelines (Roblox TS 特化)
このドキュメントは、roblox-ts + Rojo を前提とした実務ガイドです。  
参考: `docs/modern-roblox-ts-research.md`, `docs/studio-rust-mcp-server-research.md`

## Project Structure & Module Organization
- 基本構成は `places/<place>/src/{client,server,shared}` を採用します。
- 共通コードは `places/common/src` に集約します。
- エントリーポイントは `main.client.ts` と `main.server.ts` を原則にします。
- Rojo マッピングは `default.project.json` を基準にし、必要なら `production.project.json` などを追加します。
- roblox-ts 設定は `tsconfig.json` を主軸に管理します。生成物は `out/`（本番で `dist/`）を使います。
- 共有型やリモート定義は `places/common/src/shared` を優先します。

## Build, Test, and Development Commands
- パッケージマネージャーは `pnpm` を標準とします。
- `build`: `rbxtsc` 実行。必要に応じて `rojo build` まで含めます。
- `watch`: `rbxtsc --watch` を使用します。
- `serve` / `dev`: `rojo serve` を利用し Studio と同期します。
- `lint`: ESLint（必要に応じて `selene`, `stylua` も併用）を実行します。
- `test`: 導入済みの Roblox 向けテスト（TestEZ または `@rbxts/jest`）を実行します。
- 本番ビルドでは必要に応じて DarkLua 最適化を挟みます（`out/ -> dist/`）。

## Coding Style & Naming Conventions
- TypeScript `strict` を前提にし、`any` の常用を避けます。
- roblox-ts では `import` の `.js` 拡張子は付けません。
- 命名は `camelCase`（関数/変数）と `PascalCase`（クラス/コンポーネント）を使用します。
- `client` からのみ使える API と `server` 専用 API を混在させないでください。
- Node.js 組み込み API（`fs`, `path`, `process` など）をゲーム実行コードへ持ち込まないでください。
- リモート通信は型安全を優先し、`places/common/src/shared/network` で契約を定義します。
- Flamework 利用時は `Service`, `Controller`, `Component` の責務を明確に分離します。

## Testing Guidelines
- テストファイル名は `*.test.ts` または `*.spec.ts` を使用します。
- 計算ロジック、状態遷移、データ変換など純粋関数を優先してユニットテストを追加します。
- Roblox 依存箇所はモック化し、テスト間で状態を共有しないようにします。
- バグ修正時は再発防止テストを追加してから修正します。

## AgentTeam Workflow
- 本プロジェクトでは以下の役割で並列思考し、実装は最小手数で進めます。
- `Planner`: 要件分解、影響範囲特定、実装順序決定
- `Researcher`: API/テンプレート/既存実装の確認、技術選定根拠の提示
- `Implementer`: 変更実装、設定更新、必要なスクリプト追加
- `Reviewer`: 回帰・安全性・境界条件の確認、テスト観点提示
- 1 PR 内では責務を混在させすぎず、レビュー可能な単位に分割します。

## Commit & Pull Request Guidelines
- コミットは小さく保ち、1 つの目的に絞ります。
- メッセージは `feat:`, `fix:`, `refactor:`, `chore:`, `test:` を推奨します。
- PR には以下を必須で記載します。
- 変更概要
- 実行したコマンドと結果（`lint`, `test`, `build`）
- 関連 Issue
- Studio 見た目変更がある場合はスクリーンショットまたは動画

## Security & Configuration Tips
- API キー、Webhook URL、認証トークンはコミットしません。
- `ReplicatedStorage` に機密データを配置しないでください。
- DataStore キーや課金関連 ID のハードコードを避け、環境別設定で分離します。
- `default.project.json` 変更時は公開範囲（Client/Server/Shared）を必ず再確認します。

## Roblox Studio MCP Server 運用
- `studio-rust-mcp-server` は Studio 内編集の補助として使用します。
- 主な操作は `run_code` と `insert_model` です。
- Studio を開いた状態で使う前提であり、未起動での直接編集用途には向きません。
- 生成 AI 連携中は機密アセットを開かない運用を徹底してください。
