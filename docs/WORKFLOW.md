# 開発ワークフロー

このドキュメントは、takt-rbxts プロジェクトにおける開発フローの全体像をまとめたものです。

> takt CLI の詳細な使い方やカスタマイズについては [TAKT_GUIDE.md](./TAKT_GUIDE.md) を参照してください。
> プロジェクトのセットアップやアーキテクチャについては [GUIDE.md](./GUIDE.md) を参照してください。

---

## 1. 開発フロー全体図

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────┐
│  GDD / Issue │────→│ Piece 選択   │────→│  takt 実行    │────→│   PR    │
│  で仕様定義   │     │ タスク定義    │     │ plan→impl→rev │     │  作成   │
└─────────────┘     └─────────────┘     └──────────────┘     └─────────┘
```

### 手動開発 vs takt 駆動開発

| 項目 | 手動開発 | takt 駆動開発 |
|------|---------|-------------|
| 適した場面 | 探索的な実装、試行錯誤が多い場合 | 要件が明確なタスク |
| 品質担保 | 自分でレビュー | 自動レビュー（アーキテクチャ + セキュリティ） |
| 速度 | 小規模変更は速い | 中〜大規模タスクで効率的 |
| コマンド | `pnpm run build && pnpm run lint` | `npx takt "タスク説明"` |

---

## 2. takt 駆動開発フロー

### 2.1 標準フロー

```
1. Issue / タスクを定義
2. タスク内容に応じて Piece を選択
3. npx takt [--piece <name>] "タスク説明" を実行
4. takt が自動で plan → implement → review → fix → complete を実行
5. 結果を確認し、PR を作成
```

### 2.2 Piece 選択ガイド

| やりたいこと | 推奨 Piece | コマンド例 |
|-------------|-----------|-----------|
| バグ修正、小規模変更 | `roblox-mini` | `npx takt "バグを修正する"` |
| 新ゲームシステムの実装 | `roblox-default` | `npx takt -w roblox-default "戦闘システムを実装"` |
| RemoteEvent / DataStore 関連 | `roblox-network` | `npx takt -w roblox-network "チャット機能を追加"` |
| Studio で動作確認しながら開発 | `roblox-studio` | `npx takt -w roblox-studio "UI を実装する"` |
| マップ・モデル構築（コード不要） | `roblox-builder` | `npx takt -w roblox-builder "森林マップを作成"` |

### 2.3 各 Piece のワークフロー

#### roblox-mini（デフォルト）

```
plan ──→ implement ──→ reviewers ──→ COMPLETE
                          │    ↑
                          ↓    │
                         fix ──┘

reviewers: Roblox アーキテクチャ + Supervisor（並列）
```

#### roblox-default

```
plan ──→ implement ──→ reviewers ──→ COMPLETE
                          │    ↑
                     ┌────┴────┐
                     ↓         ↓
                  ai_fix     fix
                     └────┬────┘
                          ↑
                   (再レビューへ)

reviewers: AI アンチパターン + Roblox アーキテクチャ + Supervisor（並列）
```

#### roblox-network

```
plan ──→ implement ──→ reviewers ──→ supervise ──→ COMPLETE
                          │    ↑
                          ↓    │
                         fix ──┘

reviewers: Roblox アーキテクチャ + セキュリティ（並列）
supervise: 最終検証（独立ステップ）
```

#### roblox-studio

```
plan ──→ implement ──→ verify ──→ reviewers ──→ COMPLETE
                         ↓           │    ↑
                         └──→ fix ←──┘────┘

verify: Studio MCP で実機検証
reviewers: Roblox アーキテクチャ + Supervisor（並列）
```

#### roblox-builder

```
plan ──→ build ──→ verify ──→ supervise ──→ COMPLETE
                     ↓
                    fix ──→ verify（再検証）

build: Studio MCP で Luau 実行（ファイル編集なし）
verify: 作成物の検証
```

### 2.4 ブランチ・worktree 運用

takt はタスクごとにブランチを自動作成します。

```bash
# ブランチ一覧の確認
npx takt list

# ブランチの差分確認 → マージ → 削除
npx takt list  # インタラクティブに操作

# worktree を使う場合（隔離環境で作業）
npx takt --create-worktree yes "タスク説明"
```

---

## 3. 手動開発フロー（takt なし）

takt を使わず直接開発する場合の手順:

```bash
# 1. ウォッチモードでコンパイル開始
pnpm run watch

# 2. 別ターミナルで Rojo サーバー起動
pnpm run serve

# 3. Roblox Studio で Rojo プラグインから接続

# 4. コードを編集（自動コンパイル → Studio に反映）

# 5. 完了後にビルド検証
pnpm run build && pnpm run lint
```

**ファイル配置ルール:**
- クライアントコード → `places/main/src/client/`
- サーバーコード → `places/main/src/server/`
- 共有型・ネットワーク契約 → `places/common/src/shared/`
- 新しい Service/Controller を追加したら `Flamework.addPaths()` を更新

---

## 4. GDD との連携

`gdd/` ディレクトリにゲーム仕様書を配置し、takt のタスク定義に利用します。

```
gdd/
  GDD.md                         # ゲームデザインドキュメント
  Requirements.md                 # 機能要件・非機能要件
  Sprint-Plan.md                  # スプリント計画
  Technical-Architecture.md       # 技術アーキテクチャ
  Monetization-Growth-Strategy.md # 収益化・成長戦略
```

**GDD → タスクの流れ:**

1. `Sprint-Plan.md` からタスクを抽出
2. タスクの内容に応じて Piece を選択
3. GDD の関連セクションを参照しながら `npx takt "タスク説明"` を実行
4. takt の Planner が GDD を読み取り、要件に沿った実装計画を策定

```bash
# Sprint-Plan.md の Day 1 タスクを実行する例
npx takt "GameConfig と PlayerDataManager を実装する。gdd/Technical-Architecture.md の DataStore 設計に従う"
```

---

## 5. MCP ツール連携

### Studio MCP（robloxstudio-mcp）

Roblox Studio と直接連携するツール群。Studio が起動している場合に利用可能。

| ツール | 用途 |
|--------|------|
| `run_code` | Studio 内で Luau を実行 |
| `insert_model` | Creator Store からモデルを挿入 |
| `get_console_output` | コンソール出力を取得 |
| `start_stop_play` | プレイモードの制御 |
| `run_script_in_play_mode` | プレイモードでスクリプト実行 |
| `get_studio_mode` | Edit/Play モードの確認 |

### Roblox Docs MCP（roblox-docs）

Roblox API ドキュメントを検索・参照するツール群。

| ツール | 用途 |
|--------|------|
| `roblox_search` | API クラス・メンバーの検索 |
| `roblox_get_class` | クラスの詳細情報 |
| `roblox_get_datatype` | データ型の情報 |
| `roblox_search_devforum` | DevForum の検索 |
| `roblox_get_luau_topic` | Luau 言語ドキュメント |

**Studio MCP の利用タイミング:**
- `roblox-studio` piece: implement → **verify** → reviewers の verify ステップ
- `roblox-builder` piece: **build** ステップ全体（Studio で直接構築）
- 他の piece: implement/review/fix で任意に利用（Studio 接続時）

---

## 6. 完了条件（Definition of Done）

タスク完了の基準:

- [ ] `pnpm run build` がエラーなく成功
- [ ] `pnpm run lint` が警告・エラーなし
- [ ] client/server の分離が守られている
- [ ] ネットワーク契約は `places/common/src/shared/network/events.ts` に定義
- [ ] 新しい Service/Controller のディレクトリが `Flamework.addPaths()` に登録済み
- [ ] Studio 接続時: コンソールにエラーなし（任意）
- [ ] takt 使用時: 全レビュワーが PASS

---

## 7. 失敗時のハンドリング

### takt が ABORT した場合

```bash
# 原因: 要件が不明瞭、情報不足
# 対処: タスク説明をより具体的にして再実行
npx takt "具体的なタスク説明。対象ファイル: places/main/src/server/services/..."
```

### review → fix のループが止まらない場合

```bash
# max_movements (20-25) に達して自動停止する
# 対処 1: セッションを継続して手動で方針を指示
npx takt -c

# 対処 2: ポリシーを一時的に緩和して再実行
```

### 途中で止まった場合

```bash
# セッションを継続
npx takt -c
npx takt --continue
```

---

## 8. レポートの読み方

takt は各 movement の完了時にレポートファイルを生成します。

| レポート | 内容 | 確認ポイント |
|---------|------|------------|
| `00-plan.md` | 実装計画 | 要件の解釈が正しいか、影響範囲の見落としがないか |
| `coder-scope.md` | 変更スコープ宣言 | 意図しないファイルが含まれていないか |
| `coder-decisions.md` | 実装判断ログ | 重要な設計判断の根拠が妥当か |
| `03-roblox-review.md` | アーキテクチャレビュー | REJECT 項目がないか |
| `supervisor-validation.md` | 最終検証結果 | ビルド・lint の結果、残課題 |
| `summary.md` | タスク完了サマリ | 全体の変更概要と次のアクション |

---

## 9. PR 前チェックリスト

```bash
# 1. ビルド確認
pnpm run build

# 2. lint 確認
pnpm run lint

# 3. 変更差分の確認
git diff

# 4. (任意) Studio で動作確認
pnpm run serve
# Studio で Rojo プラグインから接続して動作確認

# 5. コミット
git add <変更ファイル>
git commit -m "feat: タスクの説明"

# 6. PR 作成
gh pr create --title "タスクの説明" --body "変更内容の説明"
```

takt 使用時は `--auto-pr` オプションで自動 PR 作成も可能:

```bash
npx takt "#12" --auto-pr
```

---

## 10. ドキュメント相関図

```
README.md ─────────── プロジェクト概要・クイックスタート
  │
  ├── docs/WORKFLOW.md ── 開発フロー全体像（このドキュメント）
  │     │
  │     ├── docs/TAKT_GUIDE.md ── takt CLI の詳細ガイド
  │     └── docs/GUIDE.md ──── プロジェクト構成・セットアップ
  │
  ├── AGENTS.md ──────── AI エージェント運用・コーディング規約
  ├── CLAUDE.md ──────── Claude Code 向け設定
  │
  └── gdd/ ────────────── ゲーム仕様書
        ├── GDD.md
        ├── Requirements.md
        ├── Sprint-Plan.md
        ├── Technical-Architecture.md
        └── Monetization-Growth-Strategy.md
```

| ドキュメント | 対象読者 | 内容 |
|-------------|---------|------|
| `README.md` | 全員 | プロジェクト概要、初回セットアップ |
| `docs/WORKFLOW.md` | 開発者 | 開発フロー全体像、Piece 選択ガイド |
| `docs/TAKT_GUIDE.md` | 開発者 | takt CLI の詳細操作、カスタマイズ方法 |
| `docs/GUIDE.md` | 新規参加者 | 環境構築、アーキテクチャ、トラブルシュート |
| `AGENTS.md` | AI / 開発者 | コーディング規約、PR ガイドライン |
| `CLAUDE.md` | AI | Claude Code 向けルール |
| `gdd/*.md` | 企画 / 開発者 | ゲーム仕様・要件・計画 |
