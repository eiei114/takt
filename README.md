# takt-rbxts

> Roblox TypeScript + Flamework + Rojo + takt テンプレート

roblox-ts + Flamework + Rojo を前提とした Roblox ゲーム開発テンプレートです。
AI エージェントオーケストレーションツール [takt](https://github.com/nrslib/takt) によるレビュー付き自動開発ワークフローを内蔵しています。

---

## Overview

このテンプレートに含まれるもの:

- **roblox-ts プロジェクト構成** — Multi-Place 対応、Flamework DI、型安全ネットワーキング
- **サンプル実装** — Service / Controller / Component / ネットワーク通信の参考コード
- **takt ワークフロー** — 5 種類のカスタム Piece（AI レビュー付き開発パイプライン）
- **ドキュメント一式** — プロジェクトガイド、takt 詳細ガイド、開発ワークフロー
- **GDD（ゲーム仕様書）** — ゲームデザインドキュメントのサンプル構成

---

## Quick Start

```bash
corepack enable
pnpm install
pnpm run build
pnpm run lint
pnpm run serve   # Rojo サーバー起動 → Studio で接続
```

---

## テンプレートからの新規プロジェクト作成

### GitHub UI から作成

1. このリポジトリの **"Use this template"** ボタンをクリック
2. 新しいリポジトリ名を入力して作成

### CLI から作成

```bash
gh repo create my-roblox-game --template eiei114/takt-rbxts --clone
cd my-roblox-game
```

### 初回セットアップ

```bash
# 1. 依存インストール
corepack enable
pnpm install

# 2. ビルド確認
pnpm run build && pnpm run lint

# 3. takt の動作確認
npx takt --help
```

### 変更が必要な箇所

| ファイル | 変更内容 |
|---------|---------|
| `package.json` | `name` をプロジェクト名に変更 |
| `default.project.json` | `name` をゲーム名に変更 |
| `gdd/` | プロジェクトの仕様書に差し替え |
| `.takt/config.yaml` | 必要に応じて `provider` を変更 |

---

## Stack

- roblox-ts 3.x
- Flamework (`@flamework/core`, `@flamework/components`, `@flamework/networking`)
- Rojo
- TypeScript strict
- ESLint
- pnpm
- takt（AI オーケストレーション）

---

## Project Structure

```
places/
  common/src/shared/          # 共有型・ネットワーク契約
    network/events.ts         #   RemoteEvent 定義（唯一のソース）
  main/src/
    client/                   # クライアントコード
      controllers/            #   Flamework Controller
      components/             #   Flamework Component
    server/                   # サーバーコード
      services/               #   Flamework Service
      components/             #   Flamework Component
    shared/                   # place 固有の共有コード

gdd/                          # ゲーム仕様書
docs/                         # 開発ドキュメント
.takt/                        # takt ワークフロー設定
  pieces/                     #   ワークフロー定義（5 種類）
  personas/                   #   AI エージェントロール
  knowledge/                  #   ドメイン知識
  policies/                   #   コーディングポリシー
  instructions/               #   実装手順

out/                          # rbxtsc 生成物（git 管理外）
default.project.json          # Rojo マッピング
```

---

## Development Commands

| コマンド | 説明 |
|---------|------|
| `pnpm run build` | roblox-ts コンパイル |
| `pnpm run watch` | roblox-ts ウォッチモード |
| `pnpm run serve` | Rojo サーバー起動（Studio と同期） |
| `pnpm run build:place` | place ファイルを `build/main.rbxlx` に出力 |
| `pnpm run lint` | TypeScript Lint |

---

## takt ワークフロー

takt を使うと、**plan → implement → review → fix → complete** の開発パイプラインを AI エージェントが自動実行します。

### Piece 一覧

| Piece | 用途 | コマンド |
|-------|------|---------|
| `roblox-mini` | バグ修正、小規模変更（デフォルト） | `npx takt "タスク説明"` |
| `roblox-default` | 本格開発（AI アンチパターンレビュー付き） | `npx takt -w roblox-default "タスク説明"` |
| `roblox-network` | ネットワーク機能（セキュリティレビュー付き） | `npx takt -w roblox-network "タスク説明"` |
| `roblox-studio` | Studio 検証付き開発 | `npx takt -w roblox-studio "タスク説明"` |
| `roblox-builder` | マップ・モデル構築（Studio MCP） | `npx takt -w roblox-builder "タスク説明"` |

### 主要コマンド

```bash
npx takt "タスク説明"           # タスク実行（デフォルト piece）
npx takt                       # インタラクティブモード
npx takt -c                    # 前回セッションを継続
npx takt list                  # ブランチ管理
npx takt switch                # デフォルト piece 変更
npx takt "#12" --auto-pr       # Issue から自動 PR 作成
```

> 詳細: [docs/WORKFLOW.md](docs/WORKFLOW.md) | [docs/TAKT_GUIDE.md](docs/TAKT_GUIDE.md)

---

## GDD（ゲーム仕様書）

`gdd/` ディレクトリにゲームの仕様書を配置しています。

| ファイル | 内容 |
|---------|------|
| `GDD.md` | ゲームデザインドキュメント |
| `Requirements.md` | 機能要件・非機能要件 |
| `Sprint-Plan.md` | スプリント計画 |
| `Technical-Architecture.md` | 技術アーキテクチャ |
| `Monetization-Growth-Strategy.md` | 収益化・成長戦略 |

---

## Docs Index

| ドキュメント | 内容 |
|-------------|------|
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | 開発フロー全体像、Piece 選択ガイド |
| [docs/TAKT_GUIDE.md](docs/TAKT_GUIDE.md) | takt CLI 詳細ガイド、カスタマイズ方法 |
| [docs/GUIDE.md](docs/GUIDE.md) | プロジェクト構成、環境構築、トラブルシュート |
| [AGENTS.md](AGENTS.md) | AI エージェント運用、コーディング規約 |
| [CLAUDE.md](CLAUDE.md) | Claude Code 向け設定 |

---

## Networking Example

サンプルとして最小のネットワーク通信を実装しています。

- 契約: `places/common/src/shared/network/events.ts`
- Server: `places/main/src/server/services/NetworkService.ts`
- Client: `places/main/src/client/controllers/NetworkController.ts`

Client が `requestPing` を送信し、Server が `notifyPong` を返すユースケースです。

---

## Quality Gate

PR 作成前に以下を確認してください。

```bash
pnpm run build    # コンパイルエラーなし
pnpm run lint     # lint エラー・警告なし
```

**テストについて:** 現在テストフレームワークは未構成です。導入する場合は [TestEZ](https://github.com/Roblox/testez) または `@rbxts/jest` を検討してください。

---

## Security Notes

- API キー、Webhook URL、認証トークンはコミットしない（`.env` を使用）
- `ReplicatedStorage` に機密データを配置しない
- DataStore キーや課金関連 ID のハードコードを避ける
- クライアントからのデータは必ずサーバーで検証する
- `.mcp.json` はマシン固有のパスを含むためコミットしない

---

## Optional: Roblox Studio MCP

Studio を開いた状態で MCP プラグインを使うと、takt ワークフロー内から `run_code` / `insert_model` を実行できます。
詳細は [docs/TAKT_GUIDE.md](docs/TAKT_GUIDE.md) の「Studio MCP ツールについて」を参照してください。
