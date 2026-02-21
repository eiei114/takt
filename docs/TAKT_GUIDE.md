# Takt ガイド — AI 駆動開発の実践マニュアル

takt を活用した AI 駆動開発の CLI 操作方法からカスタム Piece の作成・ワークフローのカスタマイズまでを解説します。

> プロジェクト全体のセットアップ・アーキテクチャについては [GUIDE.md](./GUIDE.md) を参照してください。

---

## 1. はじめに

### 1.1 takt とは

[takt](https://github.com/nrslib/takt) は AI エージェントオーケストレーションツールです。タスクを指示すると、**計画（plan）→ 実装（implement）→ レビュー（review）→ 修正（fix）** のワークフローを AI エージェントが自動で実行します。

各ステップ（**Movement** と呼ぶ）には専用のペルソナ・ポリシー・知識が割り当てられ、役割に応じた振る舞いをします。

### 1.2 このプロジェクトでの役割

本プロジェクトでは 3 つのカスタム Piece（ワークフロー定義）を用意しています。

- `roblox-mini` — 軽量タスク向け（デフォルト）
- `roblox-default` — 本格開発向け（AI アンチパターンレビュー付き）
- `roblox-network` — ネットワーク機能向け（セキュリティレビュー付き）

これらは Roblox TypeScript + Flamework に特化したペルソナ・ポリシー・知識を含んでおり、プロジェクト固有のルール（client/server 分離、`any` 禁止、ネットワーク契約の配置先など）を自動的に適用します。

### 1.3 前提条件

- `pnpm install` が完了していること（takt は devDependency に含まれる）
- AI プロバイダーの設定が完了していること（`.takt/config.yaml` で `provider: claude` を指定）
- Claude API キーまたは対応プロバイダーの認証情報が環境変数に設定されていること

---

## 2. 基本的な使い方

### 2.1 タスクの実行

```bash
npx takt "プレイヤーのスコアボードを追加する"
```

**実行時に起きること:**

1. **Worktree 作成の確認** — 隔離された作業環境を作るか聞かれる
2. **ブランチ作成** — タスク用のブランチが自動生成される
3. **plan** — Planner が要件を分析し、実装計画を策定（`00-plan.md` レポート出力）
4. **implement** — Roblox Coder がコードを実装（`coder-scope.md`, `coder-decisions.md` 出力）
5. **reviewers** — 並列レビュー（Piece によりレビュワーの構成が異なる）
6. **fix**（必要な場合）— レビュー指摘を修正し、再レビューへ
7. **COMPLETE** — 全レビュー通過で完了、変更がコミットされる

### 2.2 インタラクティブモード

```bash
npx takt
```

引数なしで起動すると、対話的にタスク内容を入力できます。Piece の選択なども対話で行えます。

### 2.3 GitHub Issue からのタスク実行

```bash
# Issue 番号で指定
npx takt "#6"
npx takt -i 6

# Issue の内容がそのままタスクとして使われる
```

### 2.4 セッションの継続

```bash
npx takt -c
npx takt --continue
```

前回のセッション（AI の会話コンテキスト）を引き継いで再開します。中断したタスクの続行に使います。

### 2.5 タスク結果の確認

takt の実行結果は以下の場所に出力されます。

- **レポートファイル** — 各 movement の output_contracts に基づいて生成
  - `00-plan.md` — 実装計画
  - `coder-scope.md` — 変更スコープ宣言
  - `coder-decisions.md` — 実装判断ログ
  - `03-roblox-review.md` / `03-arch-review.md` — アーキテクチャレビュー結果
  - `supervisor-validation.md` — 最終検証結果
  - `summary.md` — タスク完了サマリ
- **Git ブランチ** — `npx takt list` で一覧・管理

---

## 3. Piece の選び方と使い分け

### 3.1 概要

| Piece | レビュー構成 | max_movements | 主な用途 |
|-------|-------------|---------------|---------|
| `roblox-mini` | Roblox アーキテクチャ + Supervisor | 20 | バグ修正、小規模機能、リファクタ |
| `roblox-default` | AI アンチパターン + Roblox アーキテクチャ + Supervisor | 25 | 複雑なゲームロジック、大規模機能 |
| `roblox-network` | Roblox アーキテクチャ + セキュリティ → Supervisor | 20 | ネットワーク通信、RemoteEvent |
| `roblox-studio` | Studio 検証 + Roblox アーキテクチャ + Supervisor | 25 | Studio 検証付きの開発 |
| `roblox-builder` | Studio 検証 + Supervisor | 20 | マップ構築、モデル作成 |

### 3.2 `roblox-mini`（デフォルト）

```
plan ──→ implement ──→ reviewers ──→ COMPLETE
                          │    ↑
                          │    │
                          ↓    │
                         fix ──┘

reviewers（並列）:
  ├── roblox_review  (roblox-reviewer ペルソナ)
  └── supervise      (supervisor ペルソナ)

分岐条件:
  all("No architecture issues", "All checks passed") → COMPLETE
  any("Architecture issues found", "Requirements unmet") → fix
```

**各 Movement の詳細:**

| Movement | ペルソナ | ポリシー | 知識 | 編集 |
|----------|---------|---------|------|------|
| plan | planner | — | roblox-ts | 不可 |
| implement | roblox-coder | roblox-coding, coding | roblox-ts, flamework | 可 |
| roblox_review | roblox-reviewer | review, roblox-coding | roblox-ts, flamework | 不可 |
| supervise | supervisor | review | roblox-ts | 不可 |
| fix | roblox-coder | roblox-coding, coding | roblox-ts, flamework | 可 |

**使用シーン:**
- `print` 文の修正、UI テキストの変更
- 既存 Service/Controller への小規模な機能追加
- コードのリファクタリング

### 3.3 `roblox-default`

```
plan ──→ implement ──→ reviewers ──→ COMPLETE
                          │    ↑
                     ┌────┴────┐
                     ↓         ↓
                  ai_fix     fix
                     │         │
                     └────┬────┘
                          ↑
                          │
                   (再レビューへ)

reviewers（並列）:
  ├── ai_review      (ai-antipattern-reviewer ペルソナ)
  ├── roblox_review  (roblox-reviewer ペルソナ)
  └── supervise      (supervisor ペルソナ)

分岐条件:
  all("No AI issues", "No architecture issues", "All checks passed") → COMPLETE
  "AI-specific issues found" → ai_fix
  any("Architecture issues found", "Requirements unmet") → fix
```

**roblox-mini との違い:**
- **AI アンチパターンレビュー**が追加 — AI が生成しがちな問題（未使用コード、過剰な抽象化、根拠のない設計判断など）を検出
- **`ai_fix` movement** — AI 固有の問題専用の修正ステップ
- **`session: refresh`** — implement 時にセッションをリフレッシュ（コンテキスト肥大化防止）
- **max_movements: 25** — より多くの反復を許容

**使用シーン:**
- 新しいゲームシステムの実装（戦闘、インベントリ、マッチメイキングなど）
- 複数ファイルにまたがる大規模な変更
- AI が生成するコードの品質を特に重視したい場合

```bash
npx takt --piece roblox-default "マッチメイキングシステムを実装する"
```

### 3.4 `roblox-network`

```
plan ──→ implement ──→ reviewers ──→ supervise ──→ COMPLETE
                          │    ↑        │
                          │    │        ↓
                          ↓    │      plan（問題あり時）
                         fix ──┘

reviewers（並列）:
  ├── roblox_review    (roblox-reviewer ペルソナ)
  └── security_review  (security-reviewer ペルソナ)

分岐条件:
  all("No architecture issues", "No security issues") → supervise
  any("Architecture issues found", "Security issues found") → fix

supervise の分岐:
  "All checks passed" → COMPLETE
  "Requirements unmet, tests failing, build errors" → plan（最初からやり直し）
```

**roblox-mini との違い:**
- **セキュリティレビュー**が追加 — クライアントデータの未検証、権限チェック漏れ、インジェクション脆弱性などを検出
- **Supervisor が独立 movement** — 並列レビューの後に最終検証として実行（mini では並列内）
- **`implement-game` instruction** — ゲーム固有の実装チェックリストを使用
- **Supervisor 不合格時は plan に戻る** — 根本的な問題がある場合、計画からやり直し

**使用シーン:**
- 新しい RemoteEvent / RemoteFunction の追加
- プレイヤーデータの送受信処理
- DataStore 操作を伴うサーバーロジック
- エクスプロイト対策が必要な機能

```bash
npx takt --piece roblox-network "チャット機能を追加する"
```

### 3.5 `roblox-studio`（Studio 検証付き開発）

```
plan ──→ implement ──→ verify ──→ reviewers ──→ COMPLETE
                         ↓           │    ↑
                         ↓           ↓    │
                         └──→ fix ←──┘────┘

reviewers（並列）:
  ├── roblox_review  (roblox-reviewer ペルソナ)
  └── supervise      (supervisor ペルソナ)

分岐条件:
  verify: Studio 検証 PASS → reviewers / FAIL → fix / 未接続 → reviewers
  all("No architecture issues", "All checks passed") → COMPLETE
  any("Architecture issues found", "Requirements unmet") → fix
```

**roblox-mini との違い:**
- **Studio 検証（verify）movement** が implement と reviewers の間に追加
- 実装・レビュー・修正の各 movement で **Studio MCP ツール**（`run_code`, `get_console_output`, `get_studio_mode`）が利用可能
- **roblox-docs MCP** で Roblox API ドキュメントを直接参照可能
- Studio 未接続時は verify をスキップして reviewers に進む（既存ワークフローと同等）
- `session: refresh` で implement 時にコンテキストをリフレッシュ

**使用シーン:**
- Studio で動作を実際に確認しながら開発したい場合
- コンパイル結果が Studio に正しく反映されるか検証したい場合
- ランタイムエラーを実装中に早期発見したい場合

```bash
npx takt --piece roblox-studio "プレイヤーのインベントリ UI を実装する"
```

### 3.6 `roblox-builder`（マップ・モデル構築）

```
plan ──→ build ──→ verify ──→ supervise ──→ COMPLETE
                     ↓            ↓
                     ↓          plan（問題あり時）
                     └→ fix ──→↑
```

**他の piece との違い:**
- **ファイル編集なし** — TypeScript コードは書かない
- **Studio MCP ツールが主力** — `run_code` で Luau を直接実行し、Instance を作成・配置
- **`studio-builder` ペルソナ** — パーツ・モデル・地形・UI の構築に特化
- `insert_model` で Creator Store からアセットを挿入可能
- `roblox-docs` MCP で API を調べながら構築

**使用シーン:**
- マップ・ステージの構築
- モデルの作成・配置
- 地形（Terrain）の生成
- UI レイアウトの構築
- Workspace の整理

```bash
npx takt --piece roblox-builder "森林マップを作成する。木と岩を配置し、地面は草のTerrain"
npx takt --piece roblox-builder "ロビーにスポーン地点とポータルを配置する"
```

**注意:** Studio が起動していて MCP プラグインが有効な状態で実行する必要があります。

### 3.7 Studio MCP ツールについて

全ての piece で Studio MCP ツールが利用可能です（Studio 接続時）:

| ツール | 機能 | 利用可能な movement |
|--------|------|-------------------|
| `run_code` | Studio 内で Luau 実行 | implement, review, fix, verify, build |
| `get_console_output` | コンソール出力取得 | implement, review, fix, verify, supervise |
| `get_studio_mode` | Edit/Play モード確認 | 全 movement |
| `insert_model` | Creator Store からモデル挿入 | implement, build |
| `start_stop_play` | プレイモード制御 | verify |
| `run_script_in_play_mode` | プレイモードでスクリプト実行 | verify, build |

Studio が起動していない場合、これらのツールは単に利用不可になるだけで、ワークフロー全体には影響しません。

### 3.8 Piece の切り替え

```bash
# 実行時に指定
npx takt --piece roblox-network "タスク説明"
npx takt -w roblox-default "タスク説明"

# デフォルト piece をインタラクティブに切り替え
npx takt switch

# 特定の piece に直接切り替え
npx takt switch roblox-default
```

デフォルト piece は `.takt/config.yaml` の `piece` フィールドで設定されています。

---

## 4. CLI コマンドリファレンス

### 4.1 メインコマンド（タスク実行）

```bash
npx takt [options] [task]
```

| オプション | 短縮 | 説明 |
|-----------|------|------|
| `--piece <name>` | `-w` | 使用する Piece を指定 |
| `--issue <number>` | `-i` | GitHub Issue 番号を指定 |
| `--branch <name>` | `-b` | ブランチ名を指定（省略時は自動生成） |
| `--auto-pr` | — | 完了後に自動で PR を作成 |
| `--draft` | — | PR をドラフトとして作成（`--auto-pr` 必須） |
| `--provider <name>` | — | プロバイダーを上書き（`claude`, `codex`, `opencode`, `mock`） |
| `--model <name>` | — | モデルを上書き |
| `--pipeline` | — | パイプラインモード（非対話、worktree なし、直接ブランチ作成） |
| `--skip-git` | — | Git 操作をスキップ（パイプラインモード用） |
| `--create-worktree <yes\|no>` | — | worktree 作成プロンプトをスキップ |
| `--continue` | `-c` | 前回のセッションを継続 |
| `--quiet` | `-q` | AI 出力を抑制（CI 向け） |
| `--repo <owner/repo>` | — | リポジトリを指定 |

### 4.2 サブコマンド一覧

| コマンド | 説明 | 主な用途 |
|---------|------|---------|
| `npx takt run` | `.takt/tasks.yaml` の保留中タスクを一括実行 | バッチ処理 |
| `npx takt watch` | タスクを監視して自動実行 | 継続的なタスク処理 |
| `npx takt add [task]` | タスクを追加 | タスクキューに積む |
| `npx takt list` | タスクブランチの管理（diff/try/merge/delete） | 結果の確認・マージ |
| `npx takt switch [piece]` | アクティブ Piece を切り替え | デフォルト piece の変更 |
| `npx takt clear` | エージェント会話セッションをクリア | セッションのリセット |
| `npx takt prompt [piece]` | 各 movement のプロンプトをプレビュー | Piece のデバッグ・確認 |
| `npx takt eject [type] [name]` | ビルトイン piece/facet をプロジェクトにコピー | カスタマイズの起点 |
| `npx takt catalog [type]` | 利用可能な facet を一覧表示 | 使える素材の確認 |
| `npx takt metrics` | 分析メトリクスを表示 | 利用状況の確認 |
| `npx takt export-cc` | Claude Code Skill としてエクスポート | Claude Code との連携 |
| `npx takt reset` | 設定をデフォルトに戻す | トラブル時のリセット |

### 4.3 `takt list` の詳細

```bash
# インタラクティブモード（デフォルト）
npx takt list

# 非対話モード
npx takt list --non-interactive --format json
npx takt list --non-interactive --action diff
npx takt list --non-interactive --action merge --yes
npx takt list --non-interactive --action delete --yes
```

| アクション | 説明 |
|-----------|------|
| `diff` | ブランチの差分を表示 |
| `try` | ブランチの変更を試す |
| `merge` | ブランチをマージ |
| `delete` | ブランチを削除 |

---

## 5. ワークフローの仕組み

### 5.1 Movement とは

Movement はワークフローの 1 ステップです。各 Movement には以下が定義されます。

| フィールド | 説明 |
|-----------|------|
| `name` | Movement の名前（`plan`, `implement`, `fix` など） |
| `edit` | ファイル編集の可否（`true` = コード変更可能） |
| `persona` | AI エージェントのロール（`planner`, `roblox-coder` など） |
| `policy` | 適用するコーディングポリシー |
| `knowledge` | 参照するドメイン知識 |
| `instruction` | 実行手順（ビルトインまたはカスタム） |
| `allowed_tools` | 使用可能なツール（`Read`, `Edit`, `Write`, `Bash` など） |
| `rules` | 完了条件と次の Movement への分岐 |
| `output_contracts` | 出力するレポートの定義 |

### 5.2 ルール（条件分岐）

各 Movement の終了時に、AI の判断結果に基づいて次の Movement が決まります。

```yaml
rules:
  - condition: Implementation complete    # 条件テキスト
    next: reviewers                       # 次の Movement
  - condition: Cannot proceed, insufficient info
    next: ABORT                           # 中断
  - condition: User input required
    next: implement                       # 自分自身に戻る
    requires_user_input: true             # ユーザー入力を要求
    interactive_only: true                # インタラクティブモードのみ
```

特殊な遷移先:
- `COMPLETE` — ワークフロー正常完了
- `ABORT` — ワークフロー中断（要件不明瞭など）

### 5.3 並列レビュー（Parallel Movement）

複数のレビュワーを同時に実行し、全結果を集約して次の Movement を決定します。

```yaml
- name: reviewers
  parallel:
    - name: roblox_review    # レビュワー 1
      # ...
      rules:
        - condition: No architecture issues
        - condition: Architecture issues found
    - name: security_review  # レビュワー 2
      # ...
      rules:
        - condition: No security issues
        - condition: Security issues found
  rules:  # 集約ルール
    - condition: all("No architecture issues", "No security issues")  # 全員 OK
      next: COMPLETE
    - condition: any("Architecture issues found", "Security issues found")  # いずれか NG
      next: fix
```

**集約関数:**
- `all(...)` — 全レビュワーの条件が満たされた場合
- `any(...)` — いずれかのレビュワーの条件が満たされた場合

### 5.4 出力レポート（output_contracts）

各 Movement は完了時にレポートファイルを生成できます。

```yaml
output_contracts:
  report:
    - name: 00-plan.md           # ファイル名
      format: plan               # レポートフォーマット
    - name: summary.md
      format: summary
      use_judge: false           # AI ジャッジを使わない
```

主要なレポートフォーマット:

| フォーマット | 内容 |
|-------------|------|
| `plan` | 実装計画 |
| `coder-scope` | 変更スコープ宣言 |
| `coder-decisions` | 実装判断ログ |
| `architecture-review` | アーキテクチャレビュー結果 |
| `ai-review` | AI アンチパターンレビュー結果 |
| `security-review` | セキュリティレビュー結果 |
| `supervisor-validation` | 最終検証結果 |
| `summary` | タスク完了サマリ |

### 5.5 セッション管理

```yaml
- name: implement
  session: refresh    # このMovementでセッションをリフレッシュ
```

`session: refresh` を指定すると、その Movement の開始時に AI の会話コンテキストがリセットされます。これにより:

- plan フェーズで蓄積されたコンテキストの肥大化を防止
- implement が新鮮な状態で計画レポートを読み直して実装開始
- `roblox-default` と `roblox-network` の implement で使用

### 5.6 max_movements と ABORT/COMPLETE

```yaml
max_movements: 20    # 最大 Movement 実行回数
```

- ワークフローの無限ループを防止する安全弁
- review → fix → review → fix ... のループが繰り返されると上限に達する
- 上限到達時はワークフローが中断される
- `roblox-mini`/`roblox-network` は 20、`roblox-default` は 25

**ABORT と COMPLETE:**
- `COMPLETE` — 全条件を満たして正常完了。変更がコミットされる
- `ABORT` — 要件不明瞭や情報不足で続行不可能。ユーザーにフィードバックを求める

---

## 6. カスタム設定の詳細

### 6.1 `.takt/config.yaml`

```yaml
piece: roblox-mini    # デフォルトで使用する Piece
provider: claude      # AI プロバイダー（claude, codex, opencode）
```

### 6.2 Piece YAML の構造

`roblox-mini.yaml` を注釈付きで解説します。

```yaml
# ── メタ情報 ──
name: roblox-mini                    # Piece 名（--piece で指定する名前）
description: Roblox TS mini piece    # 説明文

# ── Piece 設定 ──
piece_config:
  provider_options:                  # プロバイダー固有の設定
    codex:
      network_access: true           # codex プロバイダー使用時にネットワークアクセスを許可
    opencode:
      network_access: true

max_movements: 20                    # 最大 Movement 回数（安全弁）
initial_movement: plan               # 最初に実行する Movement

# ── Movement 定義 ──
movements:

  # --- plan: 要件分析・実装計画の策定 ---
  - name: plan
    edit: false                      # ファイル編集不可（読み取り専用）
    persona: planner                 # ビルトインの Planner ペルソナ
    knowledge: roblox-ts             # roblox-ts の知識を参照
    allowed_tools:                   # 使用可能なツール
      - Read
      - Glob
      - Grep
      - Bash
      - WebSearch
      - WebFetch
    rules:                           # 完了条件と遷移先
      - condition: Requirements are clear and implementation is possible
        next: implement
      - condition: User is asking a question (not an implementation task)
        next: COMPLETE
      - condition: Requirements are unclear, insufficient information
        next: ABORT
    instruction: plan                # ビルトインの plan instruction
    output_contracts:                # 出力レポート
      report:
        - name: 00-plan.md
          format: plan

  # --- implement: コード実装 ---
  - name: implement
    edit: true                       # ファイル編集可能
    persona: roblox-coder            # プロジェクト固有の Coder ペルソナ
    policy:                          # 適用するポリシー（複数可）
      - roblox-coding                #   Roblox 固有のコーディングルール
      - coding                       #   汎用コーディングルール（ビルトイン）
    knowledge:                       # 参照する知識（複数可）
      - roblox-ts
      - flamework
    allowed_tools:
      - Read
      - Glob
      - Grep
      - Edit                        # ファイル編集ツール
      - Write                       # ファイル作成ツール
      - Bash
      - WebSearch
      - WebFetch
    required_permission_mode: edit   # エージェントに編集権限を要求
    instruction: implement           # ビルトインの implement instruction
    rules:
      - condition: Implementation complete
        next: reviewers
      - condition: Cannot proceed, insufficient info
        next: ABORT
      - condition: User input required because there are items to confirm with the user
        next: implement
        requires_user_input: true    # ユーザーの入力を待つ
        interactive_only: true       # インタラクティブモードのみ有効
    output_contracts:
      report:
        - name: coder-scope.md
          format: coder-scope
        - name: coder-decisions.md
          format: coder-decisions

  # --- reviewers: 並列レビュー ---
  - name: reviewers
    parallel:                        # 並列実行するレビュワーのリスト
      - name: roblox_review
        edit: false
        persona: roblox-reviewer
        policy:
          - review
          - roblox-coding
        knowledge:
          - roblox-ts
          - flamework
        allowed_tools:
          - Read
          - Glob
          - Grep
          - WebSearch
          - WebFetch
        instruction: review-arch     # アーキテクチャレビュー手順
        rules:
          - condition: No architecture issues
          - condition: Architecture issues found
        output_contracts:
          report:
            - name: 03-roblox-review.md
              format: architecture-review
      - name: supervise
        edit: false
        persona: supervisor
        policy: review
        knowledge: roblox-ts
        allowed_tools:
          - Read
          - Glob
          - Grep
          - Bash
          - WebSearch
          - WebFetch
        instruction: supervise       # 最終検証手順
        rules:
          - condition: All checks passed
          - condition: Requirements unmet, tests failing
        output_contracts:
          report:
            - name: supervisor-validation.md
              format: supervisor-validation
            - name: summary.md
              format: summary
              use_judge: false
    rules:                           # 並列結果の集約ルール
      - condition: all("No architecture issues", "All checks passed")
        next: COMPLETE
      - condition: any("Architecture issues found", "Requirements unmet, tests failing")
        next: fix

  # --- fix: レビュー指摘の修正 ---
  - name: fix
    edit: true
    persona: roblox-coder
    policy:
      - roblox-coding
      - coding
    knowledge:
      - roblox-ts
      - flamework
    allowed_tools:
      - Read
      - Glob
      - Grep
      - Edit
      - Write
      - Bash
      - WebSearch
      - WebFetch
    required_permission_mode: edit
    pass_previous_response: false    # 前の Movement の応答を引き継がない
    rules:
      - condition: Issues fixed
        next: reviewers              # 再レビューへ
      - condition: Cannot proceed, insufficient info
        next: implement              # 実装からやり直し
    instruction: fix                 # ビルトインの fix instruction
```

### 6.3 Persona（`.takt/personas/`）

ペルソナは AI エージェントの「役割」を定義するマークダウンファイルです。

**プロジェクト固有のペルソナ:**

| ペルソナ | ファイル | 役割 |
|---------|---------|------|
| `roblox-coder` | `.takt/personas/roblox-coder.md` | Roblox TypeScript の実装担当。Flamework パターンに従いコードを書く。`any` 禁止、client/server 分離、`@rbxts/services` 使用を徹底 |
| `roblox-reviewer` | `.takt/personas/roblox-reviewer.md` | アーキテクチャレビュー担当。Flamework パターン、Rojo マッピング、セキュリティを検証。REJECT 条件に該当する場合は不合格を出す |

**カスタムペルソナの追加方法:**

1. `.takt/personas/` にマークダウンファイルを作成（例: `my-tester.md`）
2. ファイル内にロール説明、Do/Don't、行動原則を記述
3. Piece YAML の `persona` フィールドでファイル名（拡張子なし）を指定

```yaml
- name: test_review
  persona: my-tester    # .takt/personas/my-tester.md を参照
```

**ビルトインペルソナ（よく使うもの）:**

| ペルソナ | 説明 |
|---------|------|
| `planner` | 要件分析・実装計画の策定 |
| `coder` | 汎用コーダー |
| `supervisor` | 最終検証・バリデーション |
| `ai-antipattern-reviewer` | AI 生成コードの問題検出 |
| `security-reviewer` | セキュリティ脆弱性の検出 |
| `architecture-reviewer` | 汎用アーキテクチャレビュー |
| `qa-reviewer` | QA 観点のレビュー |
| `frontend-reviewer` | フロントエンド観点のレビュー |

全一覧は `npx takt catalog personas` で確認できます。

### 6.4 Knowledge（`.takt/knowledge/`）

Knowledge は AI エージェントに渡すドメイン知識のマークダウンファイルです。

**プロジェクト固有の Knowledge:**

| Knowledge | ファイル | 内容 |
|-----------|---------|------|
| `flamework` | `.takt/knowledge/flamework.md` | Flamework の Service/Controller/Component/Networking パターン、DI、ライフサイクル、セキュリティルール |
| `roblox-ts` | `.takt/knowledge/roblox-ts.md` | プロジェクト構成、ビルドツールチェーン、Rojo マッピング、ファイル配置ルール、制約 |

**カスタム Knowledge の追加方法:**

1. `.takt/knowledge/` にマークダウンファイルを作成（例: `datastore.md`）
2. DataStore の使い方、パターン、注意点を記述
3. Piece YAML の `knowledge` フィールドに追加

```yaml
knowledge:
  - roblox-ts
  - flamework
  - datastore    # .takt/knowledge/datastore.md を参照
```

### 6.5 Policy（`.takt/policies/`）

Policy はコーディングルールを定義するマークダウンファイルです。AI エージェントはこれに従ってコードを書きレビューします。

**プロジェクト固有のポリシー:**

| Policy | ファイル | 内容 |
|--------|---------|------|
| `roblox-coding` | `.takt/policies/roblox-coding.md` | 絶対ルール（7 項目: client/server 分離、ネットワーク契約配置、サーバー検証、Node.js 禁止、`.js` 禁止、型安全、`any` 禁止）、警告ルール（3 項目）、ビルド検証、エントリーポイント更新、Rojo マッピング確認 |

**ビルトインポリシー（よく使うもの）:**

| Policy | 説明 |
|--------|------|
| `coding` | 汎用コーディングルール |
| `review` | レビュー基準 |
| `ai-antipattern` | AI アンチパターン検出基準 |
| `security` | セキュリティポリシー |
| `testing` | テストポリシー |

ポリシーは複数指定可能で、ビルトインとプロジェクト固有を併用します。

```yaml
policy:
  - roblox-coding    # プロジェクト固有
  - coding           # ビルトイン
```

### 6.6 Instruction（`.takt/instructions/`）

Instruction は Movement の実行手順を定義するマークダウンファイルです。

**プロジェクト固有の Instruction:**

| Instruction | ファイル | 内容 |
|-------------|---------|------|
| `implement-game` | `.takt/instructions/implement-game.md` | ゲーム機能実装チェックリスト（8 ステップ: realm 判定 → ネットワークイベント定義 → Service 作成 → Controller 作成 → Component 作成 → addPaths 更新 → Rojo 確認 → ビルド検証）。出力にビルド結果と lint 結果を必須とする |

`roblox-network` piece の implement movement で使用されています。

---

## 7. カスタム Piece を作る

### 7.1 `eject` で既存 Piece をコピー

```bash
# ビルトイン piece をプロジェクトにコピー
npx takt eject default

# 特定の facet をコピー
npx takt eject persona security-reviewer
npx takt eject policy testing
npx takt eject knowledge frontend

# グローバル（~/.takt/）にコピー
npx takt eject default --global
```

コピーされたファイルを編集してカスタマイズの起点にします。

### 7.2 新しい Movement を追加する例

既存の `roblox-mini.yaml` をコピーしてテストレビューを追加する例:

```yaml
# .takt/pieces/roblox-with-test.yaml
name: roblox-with-test
description: Roblox TS piece with test review
max_movements: 25
initial_movement: plan
movements:
  # plan, implement は roblox-mini と同じ...

  - name: reviewers
    parallel:
      - name: roblox_review
        # ... (同じ)
      - name: test_review          # 追加: テストレビュー
        edit: false
        persona: qa-reviewer       # ビルトインの QA レビュワー
        policy:
          - review
          - testing                # ビルトインのテストポリシー
        knowledge:
          - roblox-ts
        allowed_tools:
          - Read
          - Glob
          - Grep
        instruction: review-qa     # ビルトインの QA レビュー手順
        rules:
          - condition: No QA issues
          - condition: QA issues found
        output_contracts:
          report:
            - name: 03-qa-review.md
              format: qa-review
      - name: supervise
        # ... (同じ)
    rules:
      - condition: all("No architecture issues", "No QA issues", "All checks passed")
        next: COMPLETE
      - condition: any("Architecture issues found", "QA issues found", "Requirements unmet")
        next: fix
```

### 7.3 ビルトイン Facet の活用

```bash
# 全 facet を一覧表示
npx takt catalog

# タイプ別に表示
npx takt catalog personas
npx takt catalog policies
npx takt catalog knowledge
npx takt catalog instructions
npx takt catalog output-contracts
```

`[builtin]` はビルトイン、`[project]` はプロジェクト固有の facet です。

### 7.4 プロンプトのプレビュー

```bash
# デフォルト piece のプロンプトを表示
npx takt prompt

# 特定の piece のプロンプトを表示
npx takt prompt roblox-network
```

各 Movement で実際に AI に送信されるプロンプト（ペルソナ + ポリシー + 知識 + instruction の組み合わせ）をプレビューできます。Piece をカスタマイズする際のデバッグに有用です。

---

## 8. 実践シナリオ

### 8.1 バグ修正（roblox-mini）

```bash
npx takt "SpinnyComponent の回転速度が設定値と異なるバグを修正する"
```

**期待される流れ:**
1. **plan** — SpinnyComponent のコードを読み、問題箇所を特定、修正計画を策定
2. **implement** — コードを修正、`pnpm run build && pnpm run lint` で検証
3. **reviewers** — Roblox アーキテクチャレビュー + Supervisor 検証
4. **COMPLETE** — 変更がコミットされる

### 8.2 新しいゲーム機能の追加（roblox-default）

```bash
npx takt --piece roblox-default "プレイヤーのレベルアップシステムを実装する。経験値を獲得してレベルが上がると通知を表示する"
```

**期待される流れ:**
1. **plan** — 要件分解（共有型、Service、Controller、ネットワークイベント）
2. **implement** — 型定義、Service（経験値管理）、Controller（UI 通知）、ネットワークイベントを実装
3. **reviewers** — AI アンチパターン + Roblox アーキテクチャ + Supervisor の 3 者レビュー
4. **fix**（必要時）— 指摘を修正して再レビュー
5. **COMPLETE**

### 8.3 ネットワークイベントの追加（roblox-network）

```bash
npx takt --piece roblox-network "プレイヤー間のアイテムトレード機能を追加する"
```

**期待される流れ:**
1. **plan** — トレードプロトコル設計、セキュリティ要件の洗い出し
2. **implement** — ネットワークイベント（`requestTrade`, `notifyTradeResult` 等）、Service（トレードロジック + 検証）、Controller（UI）を実装
3. **reviewers** — Roblox アーキテクチャレビュー + **セキュリティレビュー**（クライアントデータ検証、権限チェック、レースコンディション）
4. **fix**（必要時）
5. **supervise** — 最終検証
6. **COMPLETE**

### 8.4 Studio 検証付き開発（roblox-studio）

```bash
npx takt --piece roblox-studio "プレイヤーのインベントリ UI を実装する"
```

**期待される流れ:**
1. **plan** — 要件分析、Studio で現在の状態を確認（`run_code`）
2. **implement** — コード実装、ビルド後に `run_code` で Studio 上の結果を確認
3. **verify** — Studio でプレイモードテスト、Instance 階層検証、コンソールエラーチェック
4. **reviewers** — Studio 上の実状態も確認しつつアーキテクチャレビュー
5. **COMPLETE**

### 8.5 マップ・モデル構築（roblox-builder）

```bash
npx takt --piece roblox-builder "森林マップを作成する。木と岩を配置し、地面は草の Terrain"
```

**期待される流れ:**
1. **plan** — 構築計画の策定、roblox-docs MCP で API 確認
2. **build** — `run_code` で Luau を実行し、パーツ・Terrain・モデルを Studio に作成
3. **verify** — 作成物の検証、プレイモードでの動作確認
4. **supervise** — 最終確認
5. **COMPLETE**

**注意:** Studio が起動していて MCP プラグインが有効な状態で実行すること。

### 8.6 GitHub Issue からの自動 PR 作成

```bash
npx takt "#12" --auto-pr

# ドラフト PR として作成
npx takt "#12" --auto-pr --draft
```

Issue の内容をタスクとして実行し、完了後に自動で PR を作成します。

### 8.7 CI/パイプラインでの自動実行

```bash
npx takt --pipeline --quiet --auto-pr "リファクタ: NetworkService を分割する"
```

**パイプラインモードの特徴:**
- 非対話（ユーザー入力を求めない）
- worktree を作成しない（直接ブランチを作成）
- `--quiet` で AI 出力を抑制
- CI 環境での自動実行に最適

---

## 9. トラブルシューティング

### takt が起動しない

| 症状 | 対処 |
|------|------|
| `command not found: takt` | `pnpm install` を実行して devDependency をインストール |
| プロバイダー接続エラー | API キーが環境変数に設定されているか確認 |
| `.takt/config.yaml` のパースエラー | YAML の構文を確認（インデント、コロン後のスペース） |

### ワークフローが ABORT する

| 原因 | 対処 |
|------|------|
| 要件が不明瞭 | タスク説明をより具体的にする（「何を」「どこに」「どう」を明示） |
| 情報不足 | タスク説明に関連ファイルパスや期待動作を含める |
| ユーザー入力が必要（非対話モード） | インタラクティブモード（`npx takt`）で実行する |

### レビューループが繰り返される

review → fix → review → fix が何度も繰り返される場合:

1. `max_movements` に達して自動中断される
2. 原因: レビュワーの基準が厳しすぎる、または fix が的外れ
3. 対処:
   - `npx takt -c` でセッションを継続し、手動で方針を指示
   - Policy を調整して基準を見直す
   - Piece の `max_movements` を増やす

### worktree の後片付け

```bash
# ブランチ一覧を表示
npx takt list

# インタラクティブに管理（merge/delete）
npx takt list

# 非対話で一括削除
npx takt list --non-interactive --action delete --yes
```

### セッションのリセット

```bash
# 会話セッションをクリア
npx takt clear

# 設定をデフォルトに戻す
npx takt reset
```

---

## 10. 参考

### リンク

| リソース | URL |
|---------|-----|
| takt 公式リポジトリ | https://github.com/nrslib/takt |
| プロジェクトガイド | [docs/GUIDE.md](./GUIDE.md) |
| エージェントワークフロー | [AGENTS.md](../AGENTS.md) |

### ビルトイン Facet 一覧（サマリ）

<details>
<summary>Personas（23 種）</summary>

| 名前 | 説明 | ソース |
|------|------|--------|
| `planner` | 要件分析・計画策定 | builtin |
| `coder` | 汎用コーダー | builtin |
| `supervisor` | 最終検証 | builtin |
| `expert-supervisor` | 高度な検証 | builtin |
| `ai-antipattern-reviewer` | AI アンチパターン検出 | builtin |
| `architecture-reviewer` | アーキテクチャレビュー | builtin |
| `security-reviewer` | セキュリティレビュー | builtin |
| `qa-reviewer` | QA レビュー | builtin |
| `frontend-reviewer` | フロントエンドレビュー | builtin |
| `cqrs-es-reviewer` | CQRS+ES レビュー | builtin |
| `test-planner` | テスト計画 | builtin |
| `pr-commenter` | PR コメント | builtin |
| `conductor` | 指揮者 | builtin |
| `research-planner` | リサーチ計画 | builtin |
| `research-digger` | リサーチ実行 | builtin |
| `research-analyzer` | リサーチ分析 | builtin |
| `research-supervisor` | リサーチ検証 | builtin |
| `melchior` | MELCHIOR-1 | builtin |
| `balthasar` | BALTHASAR-2 | builtin |
| `casper` | CASPER-3 | builtin |
| `roblox-coder` | Roblox TypeScript コーダー | project |
| `roblox-reviewer` | Roblox アーキテクチャレビュー | project |
| `studio-builder` | Studio マップ・モデル構築 | project |

</details>

<details>
<summary>Policies（7 種）</summary>

| 名前 | 説明 | ソース |
|------|------|--------|
| `coding` | 汎用コーディングルール | builtin |
| `review` | レビュー基準 | builtin |
| `ai-antipattern` | AI アンチパターン検出 | builtin |
| `qa` | QA 検出基準 | builtin |
| `security` | セキュリティポリシー | builtin |
| `testing` | テストポリシー | builtin |
| `research` | リサーチポリシー | builtin |
| `roblox-coding` | Roblox TypeScript コーディング | project |

</details>

<details>
<summary>Knowledge（9 種）</summary>

| 名前 | 説明 | ソース |
|------|------|--------|
| `architecture` | アーキテクチャ知識 | builtin |
| `backend` | バックエンド知識 | builtin |
| `frontend` | フロントエンド知識 | builtin |
| `security` | セキュリティ知識 | builtin |
| `cqrs-es` | CQRS+ES 知識 | builtin |
| `research` | リサーチ方法論 | builtin |
| `research-comparative` | 比較リサーチ知識 | builtin |
| `flamework` | Flamework フレームワーク | project |
| `roblox-ts` | Roblox TypeScript プロジェクト | project |
| `studio-mcp` | Studio MCP ツールガイド | project |

</details>

### `.takt/` ディレクトリ構成

```
.takt/
  config.yaml                    # デフォルト piece とプロバイダー
  pieces/                        # ワークフロー定義
    roblox-mini.yaml             #   軽量タスク（デフォルト）
    roblox-default.yaml          #   本格開発（AI レビュー付き）
    roblox-network.yaml          #   ネットワーク（セキュリティレビュー付き）
    roblox-studio.yaml           #   Studio 検証付き開発
    roblox-builder.yaml          #   マップ・モデル構築
  personas/                      # AI エージェントロール
    roblox-coder.md              #   実装担当
    roblox-reviewer.md           #   レビュー担当
    studio-builder.md            #   Studio 構築担当
  knowledge/                     # ドメイン知識
    flamework.md                 #   Flamework パターン
    roblox-ts.md                 #   プロジェクト構成
    studio-mcp.md                #   Studio MCP ツールガイド
  policies/                      # コーディングポリシー
    roblox-coding.md             #   Roblox 固有ルール
  instructions/                  # 実装手順
    implement-game.md            #   ゲーム機能実装チェックリスト
    verify-studio.md             #   Studio 検証手順
    build-studio.md              #   Studio 構築手順
```
