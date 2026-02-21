# モダン Roblox TypeScript 開発 調査レポート

## 調査対象リポジトリ

| リポジトリ | 特徴 | パッケージマネージャ | 状態管理 |
|-----------|------|---------------------|---------|
| [eiei114/food-evo](https://github.com/eiei114/food-evo) | 実プロダクト（ゲーム）、マルチプレイス対応 | pnpm workspace | Charm |
| [eiei114/im-roblox-template](https://github.com/eiei114/im-roblox-template) | food-evoのテンプレート版、Claude Code統合が充実 | pnpm workspace | Charm |
| [christopher-buss/roblox-ts-project-template](https://github.com/christopher-buss/roblox-ts-project-template) | 高品質テンプレート、CI/CD完備、厳格なLint | pnpm catalog | Reflex |
| [howmanysmall/modern-roblox-ts-template](https://github.com/howmanysmall/modern-roblox-ts-template) | Bun採用、Jest テスト対応、Luauハイブリッド | Bun | - |

---

## 1. 共通アーキテクチャパターン

### 1.1 ディレクトリ構成（Client / Server / Shared 分離）

全テンプレートで共通するRobloxの3レルム分離:

```
src/
├── client/          → StarterPlayerScripts（クライアント側）
│   ├── controllers/ → Flamework Controller（クライアントシングルトン）
│   ├── components/  → Flamework Component（インスタンス付与動作）
│   ├── ui/          → React UIコンポーネント
│   ├── store/       → クライアントローカル状態
│   └── main.client.ts  → クライアントエントリーポイント
├── server/          → ServerScriptService（サーバー側）
│   ├── services/    → Flamework Service（サーバーシングルトン）
│   ├── components/  → Flamework Component
│   └── main.server.ts  → サーバーエントリーポイント
├── shared/          → ReplicatedStorage（共有コード）
│   ├── network.ts   → リモート定義（Flamework Networking / Remo）
│   ├── store/       → 共有状態定義
│   └── types/       → 型定義
└── types/           → グローバル型定義（services.d.ts等）
```

### 1.2 マルチプレイス構成（food-evo / im-roblox-template）

```
places/
├── common/          → 全プレイス共有コード
│   └── src/
│       ├── client/
│       ├── server/
│       └── shared/
├── main/            → メインプレイス
│   └── src/
│       ├── client/
│       ├── server/
│       └── shared/
└── sub/             → サブプレイス
```

- `pnpm-workspace.yaml` でモノレポ管理
- `tsconfig.json` の `rootDirs` で common を参照

### 1.3 エントリーポイント共通パターン

```typescript
// main.server.ts
Flamework.addPaths("src/server/services");
Flamework.addPaths("src/server/components");
Flamework.addPaths("src/shared/components");
Flamework.ignite();

// main.client.ts
Flamework.addPaths("src/client/controllers");
Flamework.addPaths("src/client/components");
Flamework.addPaths("src/shared/components");
Flamework.ignite();
```

---

## 2. コアフレームワーク・ライブラリ

### 2.1 必須ツールチェーン

| ツール | バージョン | 用途 |
|--------|-----------|------|
| `roblox-ts` | 3.0.0 | TypeScript → Luau コンパイラ |
| `typescript` | 5.4.5〜5.6.2 | TypeScriptコンパイラ（roblox-ts互換版に固定） |
| `@rbxts/compiler-types` | 3.0.0 | roblox-tsコンパイラ型定義 |
| `@rbxts/types` | latest | Roblox API型定義 |

### 2.2 Flamework（DI / ゲームフレームワーク）

全テンプレートで採用されているデファクトスタンダード:

| パッケージ | 用途 |
|-----------|------|
| `@flamework/core` ^1.3.2 | コアDIフレームワーク（`@Service()`, `@Controller()`, `@Component()`） |
| `@flamework/components` ^1.3.2 | タグベースコンポーネントシステム |
| `@flamework/networking` ^1.3.2 | 型安全なネットワーキング（christopher-buss, howmanysmall） |
| `rbxts-transformer-flamework` ^1.3.2 | コンパイル時デコレータ変換 |

### 2.3 React UI

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| `@rbxts/react` | 17.2.3〜17.3.7 | React for Roblox（Roact後継） |
| `@rbxts/react-roblox` | 同上 | React-Robloxレンダラ |
| `@rbxts/ripple` | ^0.9.3 | アニメーション/スプリングライブラリ |
| `@rbxts/pretty-react-hooks` | ^0.6.4 | ユーティリティフック集 |
| `@rbxts/ui-labs` | ^2.3.8〜2.4.2 | UIストーリーブック |

### 2.4 状態管理

2つの流派が存在:

**Charm（food-evo, im-roblox-template）:**
| パッケージ | 用途 |
|-----------|------|
| `@rbxts/charm` | アトムベースリアクティブ状態管理 |
| `@rbxts/charm-sync` | サーバー⇔クライアント状態同期 |

**Reflex（christopher-buss）:**
| パッケージ | 用途 |
|-----------|------|
| `@rbxts/reflex` | Redux風状態管理 |
| `@rbxts/react-reflex` | React用Reflexバインディング |

### 2.5 ネットワーキング

2つの流派:

| ライブラリ | 採用リポジトリ | 特徴 |
|-----------|--------------|------|
| `@rbxts/remo` | food-evo, im-roblox-template | 型安全なリモート定義 |
| `@flamework/networking` | christopher-buss, howmanysmall | Flamework統合ネットワーキング |

### 2.6 データ永続化

| パッケージ | 用途 |
|-----------|------|
| `@rbxts/lapis` ^0.3.8 | DataStore抽象化（全テンプレートで採用） |
| `@rbxts/lapis-mockdatastore` | Studio開発用モックDataStore |

### 2.7 ユーティリティ（共通採用率が高いもの）

| パッケージ | 用途 | 採用数 |
|-----------|------|-------|
| `@rbxts/services` | 型安全なRobloxサービスアクセス | 4/4 |
| `@rbxts/t` | ランタイム型チェック | 4/4 |
| `@rbxts/sift` | 不変データ操作ユーティリティ | 3/4 |
| `@rbxts/log` | 構造化ロギング | 3/4 |
| `@rbxts/janitor` or `@rbxts/maid` | クリーンアップ/ライフサイクル管理 | 3/4 |
| `@rbxts/flamework-binary-serializer` | バイナリシリアライゼーション | 3/4 |
| `@rbxts/lemon-signal` or `@rbxts/rbx-better-signal` | シグナル/イベントシステム | 3/4 |
| `@rbxts/cmdr` | 管理コマンドフレームワーク | 2/4 |
| `@rbxts/set-timeout` | Roblox用setTimeout | 2/4 |

### 2.8 TypeScriptトランスフォーマー

| トランスフォーマー | 用途 | 採用数 |
|-------------------|------|-------|
| `rbxts-transformer-flamework` | Flameworkデコレータコンパイル | 4/4 |
| `rbxts-transformer-services` | Robloxサービス型自動生成 | 3/4 |
| `rbxts-transform-debug` | デバッグプロファイリング | 3/4 |
| `rbxts-transform-env` | 環境変数注入（`$NODE_ENV`） | 3/4 |
| `rbxts-transformer-optimizer` | 出力最適化 | 2/4 |

---

## 3. ビルドツールチェーン

### 3.1 Robloxツール（rokit / mise で管理）

| ツール | 最新バージョン | 用途 |
|--------|-------------|------|
| Rojo | 7.5.1〜7.6.1 | Robloxプロジェクト同期/ビルド |
| DarkLua | 0.16.0〜0.17.3 | Luaコード最適化・ミニファイ |
| Lune | 0.9.3〜0.10.4 | Luauスクリプトランナー |
| Mantle | 0.11.18 | Robloxデプロイメント |
| Asphalt | 0.9.1〜1.2.0 | アセットアップロード/管理 |

**ツールバージョン管理:**
- `rokit.toml`（food-evo, im-roblox-template, howmanysmall）
- `mise.toml`（christopher-buss）

### 3.2 Rojoプロジェクトマッピング

```json
// default.project.json（開発用）
{
  "tree": {
    "ServerScriptService": { "TS": { "$path": "out/server" } },
    "ReplicatedStorage": { "TS": { "$path": "out/shared" } },
    "StarterPlayer": {
      "StarterPlayerScripts": { "TS": { "$path": "out/client" } }
    }
  }
}

// production.project.json（本番用 - DarkLua処理後）
// out/ → dist/ に変更
```

### 3.3 ビルドパイプライン

```
開発: src/ → rbxtsc → out/ → Rojo sync → Roblox Studio
本番: src/ → rbxtsc → out/ → DarkLua → dist/ → Rojo build → .rbxl
```

`rbxts-build` パッケージが開発ワークフロー（compile + build + sync + open）を一括管理。

### 3.4 開発コマンド

| コマンド | 説明 |
|---------|------|
| `start` / `dev:start` | 開発モード（コンパイル + Rojo同期 + Studio起動） |
| `watch` / `dev:watch` | ウォッチモード（ファイル変更時自動リコンパイル） |
| `build` / `dev:build` | Rojoビルド |
| `compile` / `dev:compile` | TypeScriptコンパイルのみ |
| `prod:build` / `prod` | 本番ビルド（DarkLua最適化含む） |
| `lint` | ESLintチェック |
| `clean` | out/, dist/ 削除 |

---

## 4. Lint / フォーマット / コード品質

### 4.1 ESLint

全テンプレートがESLint Flat Config（v9.x）を採用:

| 設定 | food-evo | im-roblox-template | christopher-buss | howmanysmall |
|------|---------|-------------------|-----------------|-------------|
| ベース設定 | `@isentinel/eslint-config` | `typescript-eslint` | `@isentinel/eslint-config` (flawless) | typescript-eslint + unicorn |
| Prettier統合 | Yes | Yes | - | Yes |
| React hooks | - | - | `react-roblox-hooks` | `react-roblox-hooks` |
| perfectionist | - | - | Yes | Yes |
| roblox-ts rules | - | - | - | Yes |

### 4.2 Prettier

| 設定 | food-evo | im-roblox-template | howmanysmall |
|------|---------|-------------------|-------------|
| printWidth | 2048 | 120 | 120 |
| tabWidth | 4 | 4 | 4 |
| useTabs | Yes | Yes | Yes |
| trailingComma | none | none | all |
| endOfLine | lf | lf | auto |

### 4.3 Commitlint

全テンプレートで `@commitlint/config-conventional` を採用:
- Huskyの `commit-msg` フックで強制
- 共通カスタムタイプ: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`, `deps`, `core`, `conf`

### 4.4 テスティング

| リポジトリ | テストフレームワーク |
|-----------|-------------------|
| food-evo | なし（Studio内テスト） |
| im-roblox-template | なし（Claude Codeフック経由） |
| christopher-buss | なし（CI: lint + compile + build） |
| howmanysmall | `@rbxts/jest`（Roblox内Jestポート） |

---

## 5. tsconfig.json 共通設定

```jsonc
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "commonjs",        // roblox-ts必須
    "strict": true,
    "noLib": true,               // Roblox型のみ使用
    "rootDir": "src",
    "outDir": "out",
    "jsx": "react",
    "jsxFactory": "React.createElement",
    "jsxFragmentFactory": "React.Fragment",
    "experimentalDecorators": true,  // Flamework必須
    "incremental": true,
    "typeRoots": [
      "node_modules/@rbxts",
      "node_modules/@flamework"
    ],
    "plugins": [
      { "transform": "rbxts-transformer-flamework" },
      { "transform": "rbxts-transformer-services" },
      { "transform": "rbxts-transform-debug" },
      { "transform": "rbxts-transform-env" }
    ]
  }
}
```

---

## 6. AI統合・MCP

### 6.1 Claude Code統合（food-evo / im-roblox-template）

```
.claude/
├── agents/       → 専門AIエージェント（21個: flamework-architect, roblox-debugger等）
├── commands/     → Claudeコマンド
├── hooks/        → 自動フック（agent-router, auto-commit, bash-validator, typescript-check等）
├── rules/        → コーディングルール（12ファイル: coding-style, react-ui, imports等）
├── skills/       → スキルコマンド（~40個: create-service, create-controller等）
└── settings.json → MCP権限設定
```

### 6.2 Roblox Studio MCP Server

**リポジトリ:** https://github.com/Roblox/studio-rust-mcp-server
**公式Roblox製** | Rust実装 | MIT License | Stars: 300+

Studio内のDataModelを直接操作できるMCPサーバー:

**利用可能なツール:**

| ツール | 説明 |
|--------|------|
| `run_code` | Studio内でLuauコードを実行（DataModel読み書き、インスタンス操作等） |
| `insert_model` | Robloxマーケットプレイスからモデルを挿入 |

**アーキテクチャ:**
```
AI Client (Claude Code等)
  --[MCP stdio]--> Rust Server (rbx-studio-mcp --stdio)
    --[HTTP long-poll localhost:44755]--> Roblox Studio Plugin
      --> Luauコード実行 / モデル挿入
    <--[HTTP POST response]--
  <--[MCP result]--
```

**インストール:**
```bash
# Claude Codeへの登録
claude mcp add --transport stdio Roblox_Studio -- '/path/to/rbx-studio-mcp' --stdio
```

**特徴:**
- 全操作が `ChangeHistoryService` でラップされ、Ctrl+Zで元に戻せる
- 複数AIクライアントからの同時接続をプロキシモードでサポート
- Windows / macOS 対応

---

## 7. 各リポジトリの差別化ポイント

### food-evo
- **実プロダクション品質**のゲーム実装（自動バトル、ペットガチャ、リバース等）
- クリーンアーキテクチャ（`application/`, `infrastructure/`）
- マスターデータパターン（20+設定ファイル）
- GameAnalytics統合
- テレメトリ基盤
- Pencilデザインシステム連携

### im-roblox-template
- food-evoのテンプレート化版
- **Claude Code統合が最も充実**（21エージェント、40スキル、6フック、12ルール）
- Codex CLI / Gemini CLI統合もあり
- マルチプレイス対応の最小構成
- 詳細なドキュメント（日本語）

### christopher-buss/roblox-ts-project-template
- **CI/CD最も充実**（GitHub Actions: lint, compile, build, deploy）
- pnpm catalog mode（依存バージョン一元管理）
- Asphaltアセット管理パイプライン
- Mantleデプロイメント設定
- Renovate自動依存更新
- cspellスペルチェック
- `@isentinel/eslint-config` (flawless) の最も厳格なLint
- UIテーマシステム（REM provider, フォント, 画像）
- PlayerEntity パターン（ライフサイクル管理）

### howmanysmall/modern-roblox-ts-template
- **Bun採用**（高速パッケージ管理）
- **@rbxts/jest テスト対応**（唯一）
- Luauハイブリッド（`.luau` + `.d.ts` の混在）
- Biome（JSONフォーマッタ）+ ESLint + StyLua + Selene のマルチリンター
- Lune スクリプト基盤が最も充実
- ベンチマーク基盤（Lunar）
- Webトンネル経由リモートテスト（serveo.net, pinggy.io）
- `__DEV__` / `__PROFILE__` グローバルフラグによるデッドコード除去

---

## 8. 推奨技術スタック（まとめ）

モダンRoblox TS開発のデファクトスタンダード:

| カテゴリ | 推奨 | 備考 |
|---------|------|------|
| **言語** | roblox-ts 3.0.0 + TypeScript 5.x | |
| **DIフレームワーク** | Flamework 1.3.x | 全テンプレート採用 |
| **UI** | @rbxts/react 17.x | Roact後継 |
| **アニメーション** | @rbxts/ripple | |
| **状態管理** | Charm または Reflex | Charmが新しい流派 |
| **ネットワーキング** | @flamework/networking または @rbxts/remo | |
| **データ永続化** | @rbxts/lapis | |
| **ビルド** | rbxts-build + Rojo + DarkLua | |
| **ツール管理** | rokit または mise | |
| **アセット管理** | Asphalt | |
| **デプロイ** | Mantle | |
| **Lint** | ESLint flat config + Prettier | |
| **コミット** | Commitlint + Husky | |
| **パッケージマネージャ** | pnpm (workspace) または Bun | |
| **AI統合** | Claude Code + Roblox Studio MCP | |
| **テスト** | @rbxts/jest（任意） | |
| **UIテスト** | @rbxts/ui-labs（ストーリーブック） | |
