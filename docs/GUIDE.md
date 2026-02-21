# プロジェクトガイド

このガイドは **プロジェクト初参加者** を対象に、環境構築から機能追加・トラブルシューティングまでを一通りカバーします。
roblox-ts や Flamework の基礎知識がある前提で、**このプロジェクト固有の構成・ワークフロー・ルール** に焦点を当てています。

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| `README.md` | クイックリファレンス（スタック一覧、コマンド、ディレクトリ概要） |
| `AGENTS.md` | AI エージェント運用ガイド（Takt pieces、コーディング規約の完全版、PR ガイドライン） |
| `CLAUDE.md` | Claude Code 向け設定（AI アシスタント用ルール） |

---

## 1. 前提条件

### 1.1 必要なソフトウェア

| ソフトウェア | バージョン | 確認コマンド |
|-------------|-----------|-------------|
| Node.js | 20 以上 | `node --version` |
| pnpm | 10.14.0（corepack で自動管理） | `pnpm --version` |
| Rojo | 0.7 以上 | `rojo --version` |
| Roblox Studio | 最新版 | — |

```bash
# corepack を有効化（pnpm が自動で使えるようになる）
corepack enable
```

### 1.2 Rojo の導入

Rojo は **CLI ツール** と **Studio プラグイン** の両方が必要です。

**CLI のインストール（いずれかの方法）:**

```bash
# rokit を使う場合
rokit install rojo-rbx/rojo

# aftman を使う場合
aftman add rojo-rbx/rojo

# GitHub Releases から手動ダウンロードも可
```

**Studio プラグインのインストール:**

1. [Rojo の GitHub Releases](https://github.com/rojo-rbx/rojo/releases) から `.rbxm` プラグインファイルをダウンロード
2. Studio の `Plugins` フォルダに配置
3. Studio を再起動し、Plugins タブに Rojo が表示されることを確認

### 1.3 推奨エディタ

- **VSCode** + [roblox-ts 拡張](https://marketplace.visualstudio.com/items?itemName=AridTheDev.roblox-ts-extensions)
- TypeScript strict mode の補完・エラー表示が効く環境を推奨

### 1.4 前提知識

- roblox-ts の基本概念（TypeScript → Luau コンパイル）
- Flamework デコレータ（`@Service`, `@Controller`, `@Component`）
- Rojo の役割（ファイルシステム ↔ Studio 同期）
- Git の基本操作

---

## 2. 環境セットアップ

### 2.1 クローンと依存インストール

```bash
git clone <リポジトリURL>
cd takt
corepack enable
pnpm install
```

> **注意**: `npm install` や `yarn install` は使えません。`package.json` の `packageManager` フィールドで pnpm が指定されています。

### 2.2 ビルド確認

```bash
pnpm run build && pnpm run lint
```

- `pnpm run build` — `rbxtsc` を実行し、`places/` 配下の TypeScript を `out/` に Luau としてコンパイル
- `pnpm run lint` — ESLint で `places/**/*.ts` を静的チェック

エラーが出なければ環境構築は成功です。

### 2.3 Rojo 接続

```bash
pnpm run serve
```

1. 上記コマンドで Rojo 開発サーバーが起動（デフォルトポート: 34872）
2. Roblox Studio を開く
3. Plugins タブの **Rojo** → **Connect** をクリック
4. 「Connected!」と表示されれば接続完了

**接続確認チェックリスト:**

- [ ] `ServerScriptService` 内に `TS` フォルダが表示される
- [ ] `StarterPlayer > StarterPlayerScripts` 内に `TS` フォルダが表示される
- [ ] `ReplicatedStorage` 内に `TS`、`Common`、`node_modules` フォルダが表示される

### 2.4 開発ループの起動

日常開発では **2 つのターミナル** を同時に起動します。

```bash
# ターミナル 1: TypeScript の自動コンパイル
pnpm run watch

# ターミナル 2: Studio への自動同期
pnpm run serve
```

ファイルを保存するたびに自動コンパイル → 自動同期が走り、Studio にリアルタイム反映されます。

### 2.5 最初の 5 分で確認

セットアップが正しく完了していれば、Studio の **Output** ウィンドウに以下のログが表示されます。

```
[server] BootService initialized        ← サーバー起動確認
[client] BootController started          ← クライアント起動確認
[server] ping from <PlayerName>: hello-from-client  ← ネットワーク通信（サーバー側）
[client] got pong:hello-from-client      ← ネットワーク通信（クライアント側）
```

上記 4 行が出ていれば、ビルド・同期・Flamework 初期化・ネットワーキングがすべて正常に動作しています。

---

## 3. プロジェクト構成を理解する

### 3.1 ディレクトリ構成と責務

```
places/
  common/src/shared/              # 全プレイス共有（型、ネットワーク契約）
    network/events.ts             #   GlobalEvents 定義（単一ソース）
    types/matchSettings.ts        #   共有型定義
  main/src/
    client/                       # クライアントコード → StarterPlayerScripts
      controllers/                #   Flamework Controller（クライアントシングルトン）
      components/                 #   Flamework Component（クライアント側タグベース）
      networking/events.ts        #   ClientEvents = GlobalEvents.createClient()
      main.client.ts              #   エントリーポイント
    server/                       # サーバーコード → ServerScriptService
      services/                   #   Flamework Service（サーバーシングルトン）
      components/                 #   Flamework Component（サーバー側タグベース）
      networking/events.ts        #   ServerEvents = GlobalEvents.createServer()
      main.server.ts              #   エントリーポイント
    shared/                       # main place 固有の共有コード → ReplicatedStorage
```

### 3.2 Rojo マッピング

`default.project.json` で定義されている、コンパイル後のファイルと Roblox 内の配置先の対応です。

| コンパイル後パス | Roblox の場所 | 用途 |
|-----------------|--------------|------|
| `out/main/src/server` | `ServerScriptService.TS` | サーバーコード |
| `out/main/src/client` | `StarterPlayer.StarterPlayerScripts.TS` | クライアントコード |
| `out/main/src/shared` | `ReplicatedStorage.TS` | main place 共有コード |
| `out/common/src/shared` | `ReplicatedStorage.Common` | 全プレイス共有コード |
| `include/` | `ReplicatedStorage.rbxts_include` | ランタイムライブラリ |
| `node_modules/@rbxts` | `ReplicatedStorage.node_modules.@rbxts` | パッケージ |
| `node_modules/@flamework` | `ReplicatedStorage.node_modules.@flamework` | Flamework |

> **重要**: Rojo が読み取るのは `out/`（コンパイル出力）であり、`places/`（ソース）ではありません。

### 3.3 パスエイリアス

`tsconfig.json` で 2 つのパスエイリアスが設定されています。

| エイリアス | 実際のパス | 用途 |
|-----------|-----------|------|
| `@common/*` | `places/common/src/*` | 全プレイス共有コードへのアクセス |
| `@main/*` | `places/main/src/*` | main place コードへのアクセス |

```typescript
// 使用例
import { GlobalEvents } from "@common/shared/network/events";
import { ServerEvents } from "@main/server/networking/events";
```

相対パス（`../../../common/...`）ではなくエイリアスを使ってください。

### 3.4 クライアント/サーバー分離の原則

| | サーバー (`server/`) | クライアント (`client/`) |
|---|---|---|
| 実行場所 | Roblox サーバー | プレイヤーの PC |
| 信頼性 | 権威的（正しいデータの源泉） | 非信頼（エクスプロイター可） |
| 役割 | ゲームロジック、データ管理 | UI、入力処理、表示 |
| API 例 | `DataStoreService`, `ServerStorage` | `UserInputService`, `Players.LocalPlayer` |
| Flamework | `@Service` | `@Controller` |

- サーバーコードからクライアント専用 API を使わないこと
- クライアントから送られたデータは必ずサーバーで検証すること
- 共通で使うコードは `shared/` に配置すること

### 3.5 エントリーポイントと Flamework 初期化

**サーバー** (`places/main/src/server/main.server.ts`):

```typescript
import { Flamework } from "@flamework/core";

Flamework.addPaths("places/main/src/server/services");
Flamework.addPaths("places/main/src/server/components");
Flamework.ignite();
```

**クライアント** (`places/main/src/client/main.client.ts`):

```typescript
import { Flamework } from "@flamework/core";

Flamework.addPaths("places/main/src/client/controllers");
Flamework.addPaths("places/main/src/client/components");
Flamework.ignite();
```

- `addPaths()` で指定したディレクトリ配下のデコレータ付きクラスが自動検出・登録される
- `ignite()` でライフサイクルが開始される（`OnInit` → `OnStart` の順に呼ばれる）
- **新しいディレクトリを作った場合は `addPaths()` の追加が必要**（セクション 5.6 参照）

### 3.6 絶対ルール（必読）

機能追加の前に以下のルールを必ず確認してください。違反するとビルドエラーまたは実行時の問題が発生します。

| ルール | 理由 |
|--------|------|
| Node.js API（`fs`, `path`, `process` 等）禁止 | ゲームコードは Luau VM で実行される |
| import の `.js` 拡張子禁止 | roblox-ts の慣習 |
| クライアント/サーバーコードの混在禁止 | Roblox のセキュリティモデル |
| ネットワークイベントは `places/common/src/shared/network/events.ts` のみ | 型共有の一貫性 |
| `any` 型禁止 | TypeScript strict mode + ESLint ルール |
| クライアントデータの検証なし信頼禁止 | エクスプロイト対策 |

各ルールの詳細と違反例はセクション 8 を参照してください。

---

## 4. 既存コードを読む

### 4.1 Service の例

**BootService** (`places/main/src/server/services/BootService.ts`) — 最小の Service:

```typescript
import { OnInit, Service } from "@flamework/core";

@Service({})
export class BootService implements OnInit {
  onInit(): void {
    print("[server] BootService initialized");
  }
}
```

- `@Service({})` でサーバーシングルトンとして登録
- `OnInit` を実装し、初期化処理を記述
- `onInit` は全 Service で最初に呼ばれる（`onStart` より先）

**NetworkService** (`places/main/src/server/services/NetworkService.ts`) — ネットワーク処理を含む Service:

```typescript
import { OnStart, Service } from "@flamework/core";
import { ServerEvents } from "@main/server/networking/events";

@Service({})
export class NetworkService implements OnStart {
  onStart(): void {
    ServerEvents.requestPing.connect((player, message) => {
      print(`[server] ping from ${player.Name}: ${message}`);
      ServerEvents.notifyPong.fire(player, `pong:${message}`);
    });
  }
}
```

- `ServerEvents.requestPing.connect()` でクライアントからのイベントを受信
- コールバックの第 1 引数は常に `Player`（送信元プレイヤー）
- `ServerEvents.notifyPong.fire(player, ...)` で特定プレイヤーにレスポンスを送信

### 4.2 Controller の例

**BootController** (`places/main/src/client/controllers/BootController.ts`) — 最小の Controller:

```typescript
import { Controller, OnStart } from "@flamework/core";

@Controller({})
export class BootController implements OnStart {
  onStart(): void {
    print("[client] BootController started");
  }
}
```

- `@Controller({})` でクライアントシングルトンとして登録
- Service とほぼ同じ構造だが、クライアント側で動作する

**NetworkController** (`places/main/src/client/controllers/NetworkController.ts`) — ネットワーク通信を含む Controller:

```typescript
import { Controller, OnStart } from "@flamework/core";
import { ClientEvents } from "@main/client/networking/events";

@Controller({})
export class NetworkController implements OnStart {
  onStart(): void {
    ClientEvents.notifyPong.connect((message) => {
      print(`[client] got ${message}`);
    });

    ClientEvents.requestPing.fire("hello-from-client");
  }
}
```

- `ClientEvents.notifyPong.connect()` でサーバーからのイベントを受信（`Player` 引数なし）
- `ClientEvents.requestPing.fire(...)` でサーバーにイベントを送信

### 4.3 Component の例

**SpinnyComponent** (`places/main/src/server/components/SpinnyComponent.ts`) — サーバー側 Component:

```typescript
import { BaseComponent, Component } from "@flamework/components";

type Attributes = Record<string, never>;

@Component({
  tag: "Spinny"
})
export class SpinnyComponent extends BaseComponent<Attributes, BasePart> {
  onStart(): void {
    this.instance.SetAttribute("InitializedBy", "SpinnyComponent");
  }
}
```

**ClickFxComponent** (`places/main/src/client/components/ClickFxComponent.ts`) — クライアント側 Component:

```typescript
import { BaseComponent, Component } from "@flamework/components";

type Attributes = Record<string, never>;

@Component({
  tag: "ClickFx"
})
export class ClickFxComponent extends BaseComponent<Attributes, GuiObject> {
  onStart(): void {
    this.instance.SetAttribute("InitializedBy", "ClickFxComponent");
  }
}
```

- `@Component({ tag: "..." })` で CollectionService のタグに紐づく
- `BaseComponent<Attributes, InstanceType>` — 第 1 型引数は属性、第 2 型引数は対象インスタンス型
- Studio 側でインスタンスにタグを付けると、自動的にこの Component がアタッチされる

### 4.4 ネットワーキングの全体像

このプロジェクトのネットワーキングは **3 層パターン** で構成されています。

```
Layer 1: 契約定義（Contract）
  places/common/src/shared/network/events.ts
    → ClientToServerEvents / ServerToClientEvents インターフェース
    → GlobalEvents = Networking.createEvent<C2S, S2C>()

Layer 2: サーバー再エクスポート（Server re-export）
  places/main/src/server/networking/events.ts
    → ServerEvents = GlobalEvents.createServer({})

Layer 3: クライアント再エクスポート（Client re-export）
  places/main/src/client/networking/events.ts
    → ClientEvents = GlobalEvents.createClient({})
```

**データフロー:**

```
Client                          Server
  |                               |
  | ClientEvents.requestPing      |
  |  .fire("hello")              |
  | ----------------------------→ |
  |                               | ServerEvents.requestPing
  |                               |  .connect((player, msg) => ...)
  |                               |
  |                               | ServerEvents.notifyPong
  |                               |  .fire(player, "pong:hello")
  | ←---------------------------- |
  | ClientEvents.notifyPong       |
  |  .connect((msg) => ...)       |
```

**命名規約:**
- `requestXxx` — クライアント → サーバー（リクエスト系）
- `notifyXxx` — サーバー → クライアント（通知系）

### 4.5 共有型の例

**MatchSettings** (`places/common/src/shared/types/matchSettings.ts`):

```typescript
export interface MatchSettings {
  readonly maxPlayers: number;
  readonly roundSeconds: number;
}

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  maxPlayers: 12,
  roundSeconds: 180
};
```

- `readonly` プロパティで不変性を保つ
- デフォルト値を `const` で一緒に定義するパターン
- `@common/shared/types/...` でインポート可能

---

## 5. 機能を追加する（ステップバイステップ）

> **コーディング前に**: [セクション 3.6 の絶対ルール](#36-絶対ルール必読) を確認してください。

### 5.1 新しい Service を追加する

1. `places/main/src/server/services/` にファイルを作成

```typescript
// places/main/src/server/services/ScoreService.ts
import { OnStart, Service } from "@flamework/core";

@Service({})
export class ScoreService implements OnStart {
  onStart(): void {
    print("[server] ScoreService started");
  }
}
```

2. `main.server.ts` の `addPaths` を確認 — `services/` ディレクトリは既に登録済みなので変更不要
3. ビルド確認:

```bash
pnpm run build && pnpm run lint
```

### 5.2 新しい Controller を追加する

1. `places/main/src/client/controllers/` にファイルを作成

```typescript
// places/main/src/client/controllers/HudController.ts
import { Controller, OnStart } from "@flamework/core";

@Controller({})
export class HudController implements OnStart {
  onStart(): void {
    print("[client] HudController started");
  }
}
```

2. `main.client.ts` の `addPaths` を確認 — `controllers/` ディレクトリは既に登録済みなので変更不要
3. ビルド確認:

```bash
pnpm run build && pnpm run lint
```

### 5.3 新しい Component を追加する

サーバー側かクライアント側かを決めてから、対応する `components/` ディレクトリにファイルを作成します。

**サーバー Component テンプレート:**

```typescript
// places/main/src/server/components/DamageZoneComponent.ts
import { BaseComponent, Component } from "@flamework/components";

interface Attributes {
  Damage: number;
}

@Component({
  tag: "DamageZone"
})
export class DamageZoneComponent extends BaseComponent<Attributes, BasePart> {
  onStart(): void {
    // this.instance でタグ付きインスタンスにアクセス
    // this.attributes.Damage で属性値にアクセス
  }
}
```

**クライアント Component テンプレート:**

```typescript
// places/main/src/client/components/ButtonFxComponent.ts
import { BaseComponent, Component } from "@flamework/components";

interface Attributes {
  Color: Color3;
}

@Component({
  tag: "ButtonFx"
})
export class ButtonFxComponent extends BaseComponent<Attributes, GuiButton> {
  onStart(): void {
    this.instance.MouseButton1Click.Connect(() => {
      // クリック処理
    });
  }
}
```

Studio 側でインスタンスに対応するタグ（例: `DamageZone`）を付けることで、Component が自動アタッチされます。

### 5.4 新しいネットワークイベントを追加する

ネットワークイベントの追加は 4 ステップです。

**Step 1**: 契約を定義 — `places/common/src/shared/network/events.ts` のインターフェースにメソッドを追加

```typescript
export interface ClientToServerEvents {
  requestPing(message: string): void;
  requestScore(action: string): void;  // 追加
}

export interface ServerToClientEvents {
  notifyPong(message: string): void;
  notifyScoreUpdate(score: number): void;  // 追加
}
```

**Step 2**: サーバー側ハンドラを作成 — Service 内で `ServerEvents` を使う

```typescript
// 既存の Service に追加するか、新しい Service を作成
ServerEvents.requestScore.connect((player, action) => {
  // スコア計算ロジック
  const newScore = calculateScore(action);
  ServerEvents.notifyScoreUpdate.fire(player, newScore);
});
```

**Step 3**: クライアント側で送信・受信 — Controller 内で `ClientEvents` を使う

```typescript
// スコア更新を受信
ClientEvents.notifyScoreUpdate.connect((score) => {
  print(`Score updated: ${score}`);
});

// アクションを送信
ClientEvents.requestScore.fire("jump");
```

**Step 4**: ビルド確認

```bash
pnpm run build && pnpm run lint
```

> **注意**: `server/networking/events.ts` と `client/networking/events.ts` の re-export ファイルは変更不要です。`GlobalEvents.createServer/Client` が自動的に新しいイベントを含みます。

### 5.5 新しい共有型を追加する

1. `places/common/src/shared/types/` にファイルを作成

```typescript
// places/common/src/shared/types/playerData.ts
export interface PlayerData {
  readonly level: number;
  readonly experience: number;
  readonly inventory: ReadonlyArray<string>;
}

export const DEFAULT_PLAYER_DATA: PlayerData = {
  level: 1,
  experience: 0,
  inventory: [],
};
```

2. 使用する側でインポート

```typescript
import { PlayerData } from "@common/shared/types/playerData";
```

### 5.6 新しいディレクトリを追加する場合

既存の `services/`, `controllers/`, `components/` の **サブディレクトリ** を作る場合は変更不要です（`addPaths` は再帰的にスキャンします）。

```
services/
  score/
    ScoreService.ts    ← 自動検出される（services/ が addPaths 済み）
```

**新しいトップレベルカテゴリ** を追加する場合は、エントリーポイントの更新が必要です。

```typescript
// main.server.ts に追加
Flamework.addPaths("places/main/src/server/handlers");  // 新しいディレクトリ
```

また、`default.project.json` の Rojo マッピングに新しいディレクトリが含まれていることも確認してください（通常、`server/` 配下は `out/main/src/server` のマッピングで自動的にカバーされます）。

---

## 6. 開発コマンドリファレンス

### 6.1 コマンド一覧

| コマンド | 実行内容 | 説明 |
|---------|---------|------|
| `pnpm run build` | `rbxtsc` | TypeScript → Luau コンパイル（`out/` に出力） |
| `pnpm run watch` | `rbxtsc --watch` | ファイル変更を監視して自動コンパイル |
| `pnpm run serve` | `rojo serve default.project.json` | Rojo 開発サーバー起動（Studio 同期） |
| `pnpm run build:place` | `rojo build ... -o build/main.rbxlx` | .rbxlx Place ファイルを生成 |
| `pnpm run lint` | `eslint "places/**/*.ts"` | TypeScript 静的チェック |
| `pnpm run clean` | `out/`, `dist/`, `build/` を削除 | ビルド成果物のクリーンアップ |
| `pnpm run test` | — | **未導入**（将来 `@rbxts/jest` 等を導入予定） |

### 6.2 日常の開発フロー

```
1. pnpm run watch + pnpm run serve を起動
2. TypeScript ファイルを編集・保存
3. 自動コンパイル → 自動同期 → Studio に反映
4. Studio で動作確認
5. コミット前に: pnpm run build && pnpm run lint
```

### 6.3 CI/CD

GitHub Actions（`.github/workflows/ci.yml`）が `main`/`master` への push と PR で自動実行されます。

```
checkout → Node.js 20 セットアップ → corepack enable → pnpm install --frozen-lockfile → lint → build
```

CI が失敗した場合は、ローカルで以下を実行して再現してください。

```bash
pnpm run lint && pnpm run build
```

### 6.4 Place ファイルのビルド

```bash
pnpm run build        # まずコンパイル
pnpm run build:place  # build/main.rbxlx を生成
```

生成された `.rbxlx` は Studio で直接開けます。配布や CI アーティファクト用途に使います。

---

## 7. Takt AI オーケストレーション

### 7.1 Takt とは

[takt](https://github.com/nrslib/takt) は AI エージェントオーケストレーションツールです。タスクを指示すると、計画 → 実装 → レビュー → 修正 のワークフローを自動実行します。

### 7.2 Piece の選び方

| Piece | 用途 | ワークフロー |
|-------|------|-------------|
| `roblox-mini`（デフォルト） | 軽量タスク、バグ修正 | plan → implement → review → fix |
| `roblox-default` | 本格的な機能開発 | plan → implement → review（AI アンチパターン検出含む）→ fix |
| `roblox-network` | ネットワーク機能 | plan → implement → review（セキュリティレビュー含む）→ fix |

**判断基準:**
- 小さな機能追加・修正 → `roblox-mini`
- 複雑なゲームロジック → `roblox-default`
- RemoteEvent や通信処理が絡む → `roblox-network`

### 7.3 基本コマンド

```bash
# デフォルト piece でタスク実行
npx takt "プレイヤーのスコアボードを追加する"

# piece を指定して実行
npx takt --piece roblox-network "チャット機能を追加する"

# インタラクティブモード
npx takt

# その他
npx takt run     # 保留中タスクを全実行
npx takt list    # タスクブランチ一覧
npx takt switch  # アクティブ piece を切り替え
npx takt add     # 会話でタスク追加
```

### 7.4 カスタム設定の場所

```
.takt/
  config.yaml           # デフォルト piece とプロバイダー
  pieces/               # ワークフロー定義（3 つの piece）
  personas/             # AI エージェントのロール定義
  knowledge/            # ドメイン知識（Flamework、roblox-ts）
  policies/             # コーディングポリシー
  instructions/         # 実装手順テンプレート
```

### 7.5 詳細

エージェントの役割分担、コミットガイドライン、PR フォーマットの詳細は [AGENTS.md](../AGENTS.md) を参照してください。

---

## 8. プロジェクトルールと注意点

### 8.1 絶対ルール

以下に違反するとビルドエラーまたは実行時の問題が発生します。

| ルール | 理由 | 違反例 |
|--------|------|--------|
| Node.js API 禁止 | Luau VM で実行される | `import fs from "fs"` |
| `.js` 拡張子禁止 | roblox-ts の慣習 | `import { X } from "./module.js"` |
| client/server 混在禁止 | セキュリティモデル | `server/` 内で `Players.LocalPlayer` を使用 |
| ネットワークイベントは `common/shared` のみ | 型共有の一貫性 | `main/src/server/` 内で `Networking.createEvent` |
| `any` 型禁止 | strict mode + ESLint | `const data: any = ...` |
| クライアントデータ未検証で信頼禁止 | エクスプロイト対策 | サーバーで player 送信値をそのまま使用 |
| `@rbxts/services` 経由でサービス取得 | 型安全性 | `game.GetService("Players")` |

### 8.2 推奨ルール

| 推奨事項 | 理由 |
|---------|------|
| `@rbxts/services` を使う | `game.GetService()` より型安全 |
| 300 行超えのファイルは分割を検討 | 可読性とメンテナンス性 |
| ライフサイクル（`OnInit`/`OnStart`）を使う | constructor で副作用を起こさない |
| `print()` を使う | `console.log()` ではなく（roblox-ts 環境） |

### 8.3 よくあるミス

| 症状 | 原因 | 対処 |
|------|------|------|
| Service/Controller が動かない | `Flamework.addPaths()` にディレクトリ未登録 | `main.server.ts` / `main.client.ts` に `addPaths` を追加 |
| Studio に反映されない | `pnpm run watch` が未起動 / Rojo 未接続 | ターミナルと Studio の Rojo 接続を確認 |
| `Cannot find module '@common/...'` | `pnpm install` 未実行 / tsconfig の paths 設定不備 | `pnpm install` を実行、tsconfig.json を確認 |
| import パスが通らない | 相対パスとエイリアスの混在 | `@common/*` / `@main/*` エイリアスに統一 |
| `out/` のコードが古い | `pnpm run watch` が動いていない | `pnpm run watch` を起動するか `pnpm run build` を実行 |
| ビルド成功だが lint 失敗 | ビルド成功 ≠ lint 成功 | 必ず `pnpm run build && pnpm run lint` の両方を実行 |

### 8.4 セキュリティ注意事項

- API キー、Webhook URL、認証トークンはコミットしない
- `ReplicatedStorage` に機密データを置かない（クライアントからアクセス可能）
- DataStore キーや課金関連 ID のハードコードを避ける
- `default.project.json` 変更時は公開範囲（Client/Server/Shared）を再確認

> コーディング規約の完全版は [AGENTS.md](../AGENTS.md) を参照してください。

---

## 9. ESLint 設定

ESLint flat config（v9）を使用しています（`eslint.config.js`）。

| ルール | 設定 | 意味 |
|--------|------|------|
| `@typescript-eslint/no-explicit-any` | `error` | `any` 型を使うとエラー |
| `@typescript-eslint/no-unused-vars` | `error`（`_` プレフィックス除外） | 未使用変数はエラー（`_player` のように `_` 始まりは許可） |

- **対象**: `places/**/*.ts`
- **除外**: `out/`, `dist/`, `build/`, `node_modules/`

```bash
# lint 実行
pnpm run lint
```

---

## 10. トラブルシューティング

### ビルドエラー

| エラー | 対処 |
|--------|------|
| `Cannot find module '@common/...'` | `pnpm install` を実行。解決しなければ `tsconfig.json` の `paths` を確認 |
| `Cannot find module '@rbxts/...'` | `pnpm install` を実行。`node_modules` が壊れている場合は削除して再インストール |
| Decorator 関連のエラー | `tsconfig.json` に `"experimentalDecorators": true` があるか確認 |
| 型エラー（strict mode） | `any` を使わず具体的な型を指定する |

### Rojo 同期の問題

| 症状 | 対処 |
|------|------|
| Studio に変更が反映されない | `pnpm run watch` → `pnpm run serve` の両方が動いているか確認 |
| 接続できない | Studio の Rojo プラグインバージョンと CLI バージョンが一致しているか確認 |
| ファイルが見つからない | `default.project.json` のマッピングを確認 |

### Flamework が検出しない

| 症状 | 対処 |
|------|------|
| Service/Controller が `onStart` に入らない | `Flamework.addPaths()` にディレクトリが含まれているか確認 |
| Component がアタッチされない | Studio 側でインスタンスにタグが付いているか確認 |
| デコレータが認識されない | `@Service({})`, `@Controller({})`, `@Component({...})` の構文を確認。`export` を忘れていないか確認 |

### CI が失敗する

```bash
# ローカルで CI と同じ手順を再現
pnpm install --frozen-lockfile
pnpm run lint
pnpm run build
```

`--frozen-lockfile` で依存の不整合を検出できます。ローカルで問題なければ `pnpm-lock.yaml` をコミットし直してください。

---

## 11. 参考リンク

| リソース | URL |
|---------|-----|
| roblox-ts ドキュメント | https://roblox-ts.com/ |
| Flamework ドキュメント | https://flamework.fireboltofdeath.dev/ |
| Rojo ドキュメント | https://rojo.space/ |
| Roblox Creator Hub | https://create.roblox.com/docs |
| takt | https://github.com/nrslib/takt |
| プロジェクト内リサーチ | `docs/modern-roblox-ts-research.md` |
| Studio MCP Server | `docs/studio-rust-mcp-server-research.md` |
