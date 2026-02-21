# studio-rust-mcp-server 調査メモ

更新日: 2026-02-18
対象: https://github.com/Roblox/studio-rust-mcp-server

## 結論（要点）
- Roblox Studio **内**の編集は可能です。MCP 経由で `run_code`（任意コード実行）と `insert_model`（Marketplace からモデル挿入）が提供されています。
- 一方で、Roblox Studio を開いていない状態で「Place を直接編集」する用途には向きません。公式 README の利用手順は「Studio で Place を開いた状態」を前提にしています。
- MCP クライアントは広く接続可能ですが、公式インストーラの自動設定対象は Claude Desktop / Cursor（+ Claude Code への案内）です。

## 根拠

### 1) アーキテクチャ
公式 README では、以下の 2 コンポーネント構成と説明されています。
- Studio プラグインが long poll する `axum` Web サーバ
- MCP 側は `rmcp` の `stdio` トランスポート

この構成のため、ツール実行は Studio 側プラグインとの通信を前提に成立します。

### 2) ツールの実体（何ができるか）
`src/rbx_studio_server.rs` では公開ツールが次の 2 つに定義されています。
- `run_code`: Studio でコマンド実行し、print 出力を返す
- `insert_model`: Roblox Marketplace からモデル挿入

現時点で「公式実装の標準ツール」はこの 2 つです。

### 3) Studio が必要か
README の「Send requests」手順は次を明示しています。
1. Studio で Place を開く
2. MCP クライアントからプロンプト送信
3. Studio 側で反映を確認

したがって「Studio を開かずに編集」は、README の想定フロー外です。

### 4) セットアップとクライアント設定
- リリースバイナリの導入手順あり（Windows/macOS）
- 手動設定は `--stdio` 実行を MCP クライアントへ登録
- `install.rs` の実装は Claude/Cursor 設定ファイルを書き換え、`Roblox_Studio` 名で登録

補足: README の古い例では `Roblox Studio`（スペース）表記が見える箇所があり、実装側は `Roblox_Studio`（アンダースコア）を使用しています。最新版バイナリの自動設定に合わせるのが安全です。

### 5) 最新性（2026-02-18 時点）
- Releases ページ上の最新は `v0.2.321`（2026-02-06）
- リリースノート: `fix: bump rmcp to 0.14 to fix VS Code protocol mismatch (#74)`

## セキュリティ上の注意
README / install メッセージともに、外部 LLM サービスから開いている Place の内容へアクセスしうる点を明示しています。運用時は以下を推奨。
- 機密アセットを開いたまま接続しない
- 検証用 Place で試してから本番 Place に適用
- 実行ログ（何を `run_code` したか）を残す

## 実務観点での適用判断
- 「Studio 上の状態を直接操作して検証を速める」用途には有効
- 「rbxts ソースを Git 管理下で安全に改修し、CI で検証する」用途は従来どおりローカル編集 + Rojo/rbxtsc の方が再現性が高い
- 最適解は併用: 日常はコード主導、探索的な Studio 操作を MCP で補助

## AGENTS.md を Roblox TS 向けに書き換える方針（要約）

### 結論
- 書き換えは妥当です。現状の AGENTS.md は Node/CLI 前提の記述が多く、Roblox TS 開発の実態（rbxtsc + Rojo + Studio）とずれています。

### 置換すべきポイント
- Project Structure:
  - `src/index.ts` / `src/app/cli` 前提を削除し、`src/client` `src/server` `src/shared`（または `places/<place>/src`）前提に変更
  - `default.project.json` / `*.project.json` / `rbxtsconfig.json` を構成の主軸として明記
- Build/Test/Dev Commands:
  - `npm run build/watch/lint/test` を汎用記述で残す場合も、実体を `rbxtsc` `rbxtsc --watch` `rojo serve` `rojo build` に寄せる
  - テストは Vitest 固定ではなく、導入済みランナー（例: TestEZ）に合わせる方針へ変更
- Coding Style:
  - 「ESM なので import 拡張子 .js 固定」を削除（roblox-ts では不整合）
  - クライアント/サーバ境界の厳守、Node 組み込み API をゲーム実行コードに持ち込まないことを追記
- Security/Config:
  - `.takt/*` 中心の注意事項を削減し、Place 公開範囲（ReplicatedStorage など）、秘匿情報、DataStore/Webhook の扱いへ置換

### モダンテンプレート観点での補足
- 近年の Roblox TS テンプレートでは、`rbxtsc` + `rojo` +（任意で）ツールチェーン統合スクリプトが主流です。
- MCP（studio-rust-mcp-server）は Studio 側操作の補助として有効ですが、ソース管理の主軸は引き続きコードベース（Git 管理下の rbxts）に置くのが安全です。

## 参照リンク（一次情報）
- Repository: https://github.com/Roblox/studio-rust-mcp-server
- README: https://github.com/Roblox/studio-rust-mcp-server/blob/main/README.md
- Releases: https://github.com/Roblox/studio-rust-mcp-server/releases
- Tool定義（run_code / insert_model）:
  - https://github.com/Roblox/studio-rust-mcp-server/blob/main/src/rbx_studio_server.rs
- インストール/設定ロジック:
  - https://github.com/Roblox/studio-rust-mcp-server/blob/main/src/install.rs
  - https://github.com/Roblox/studio-rust-mcp-server/blob/main/build.rs
- プラグイン情報:
  - https://github.com/Roblox/studio-rust-mcp-server/blob/main/plugin/README.md
  - https://github.com/Roblox/studio-rust-mcp-server/blob/main/plugin/default.project.json
