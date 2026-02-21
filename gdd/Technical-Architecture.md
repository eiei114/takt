---
tags:
  - type/project
  - project/escape-minerals
  - theme/roblox
  - theme/programming
created: 2026-02-21
modified: 2026-02-21
lead: "Escape Tsunami For Minerals! の技術アーキテクチャ。Roblox Luauベースのクライアント・サーバー設計、DataStore、パフォーマンス最適化。"
---

# Technical Architecture — Escape Tsunami For Minerals!

## 概要

**プラットフォーム**: Roblox (Luau)
**アーキテクチャ方針**: Roblox 標準のクライアント・サーバーモデル
**開発規模**: ソロ開発、2週間スプリント、上級 Luau スキル想定

---

## 1. プロジェクト構造 (Roblox Studio)

```
game/
├── ServerScriptService/
│   ├── GameManager.luau          -- ラウンドライフサイクル、ゲーム状態管理
│   ├── MineralSpawner.luau       -- ミネラル配置ロジック
│   ├── PlayerDataManager.luau    -- DataStore セーブ/ロード
│   ├── PrestigeManager.luau      -- プレステージ/リバース処理
│   └── LeaderboardManager.luau   -- リーダーボード更新
├── ReplicatedStorage/
│   ├── Modules/
│   │   ├── MineralConfig.luau    -- ミネラルティア定義
│   │   ├── UpgradeConfig.luau    -- アップグレードコスト/効果
│   │   ├── MapConfig.luau        -- マップ定義
│   │   └── GameConfig.luau       -- グローバル定数
│   ├── Events/
│   │   ├── RemoteEvents/         -- クライアント↔サーバー通信
│   │   └── RemoteFunctions/      -- リクエスト・レスポンスパターン
│   └── Assets/
│       ├── Minerals/             -- ミネラルモデル（シンプルなキューブ）
│       └── UI/                   -- UI プレハブ
├── StarterGui/
│   ├── HUD.luau                  -- ゲーム中 HUD
│   ├── Shop.luau                 -- アップグレードショップ UI
│   ├── DeathScreen.luau          -- ラウンド終了画面
│   └── Lobby.luau                -- ロビー UI + リーダーボード
├── StarterPlayerScripts/
│   ├── PlayerController.luau     -- 入力処理、移動制御
│   ├── MineralCollector.luau     -- クライアント側収集処理
│   ├── CameraController.luau     -- カメラ追従ロジック
│   └── SFXManager.luau           -- サウンドエフェクト管理
└── Workspace/
    ├── Maps/                     -- マップモデル群
    ├── Lobby/                    -- ロビーエリア
    └── WaterSystem/              -- 上昇する水オブジェクト
```

---

## 2. コアシステム設計

### 2.1 ゲームステートマシン

```
LOBBY → COUNTDOWN (5s) → PLAYING → ROUND_END → SHOP → LOBBY/NEXT_ROUND
```

- 状態遷移は `GameManager` がサーバー権威で管理
- クライアントは `RemoteEvent` 経由で状態を受信
- ラウンドタイマーはサーバー権威のティックを使用

**状態別の責務:**

| 状態 | サーバー処理 | クライアント処理 |
|------|------------|----------------|
| `LOBBY` | プレイヤー待機、データロード | ロビー UI 表示 |
| `COUNTDOWN` | タイマー管理 | カウントダウン演出 |
| `PLAYING` | 水位上昇、ミネラル管理、死亡判定 | 移動入力、収集、HUD 更新 |
| `ROUND_END` | スコア集計、リーダーボード更新 | 結果画面表示 |
| `SHOP` | 購入検証、データ保存 | ショップ UI |

---

### 2.2 水/溶岩上昇システム

- **実装**: 単一の `Part` の Y 座標を `TweenService` でアニメーション
- **速度計算式**: `base_speed * (1 + 0.05 * round_number)`
- **権威**: サーバーが位置を制御、クライアントは補間
- **死亡判定**:

```lua
-- サーバー側での死亡チェック（毎フレーム実行）
if player.Character.HumanoidRootPart.Position.Y < water.Position.Y then
    -- 死亡処理
end
```

- 物理シミュレーション不使用（`Tween` のみ）でパフォーマンス最適化

---

### 2.3 ミネラルスポーンシステム

**スポーン戦略:**
- マップごとに事前配置されたスポーンポイント（50〜100箇所）
- サーバーがレアリティ重み付きでスポーン位置を決定
- Y 座標が高いほど希少ミネラルの出現率が上昇

**レアリティ重み:**

| レアリティ | 出現率 | 備考 |
|-----------|--------|------|
| Common | 40% | 低所に多く配置 |
| Uncommon | 25% | - |
| Rare | 20% | - |
| Epic | 10% | - |
| Legendary | 4% | 高所限定 |
| Mythic | 1% | 最高所のみ |

**収集フロー:**

```
クライアント: RemoteEvent 発火 (RequestCollectMineral)
    ↓
サーバー: 近接距離チェック（不正防止）
    ↓
サーバー: 通貨付与 + ミネラルオブジェクト削除
    ↓
クライアント: MineralCollected イベントで UI 更新
```

---

### 2.4 プレイヤーデータスキーマ (DataStore)

```lua
PlayerData = {
    minerals = 0,           -- 現在のミネラル通貨
    totalMinerals = 0,      -- 累計獲得数（リーダーボード用）
    upgrades = {
        speed = 0,          -- レベル 0〜10
        jumpPower = 0,       -- レベル 0〜10
        doubleJump = false,
        tripleJump = false,
        magnet = 0,          -- レベル 0〜5
        lucky = 0,           -- レベル 0〜5
    },
    prestige = 0,           -- プレステージ回数
    roundsPlayed = 0,
    highestRound = 0,
    currentMap = 1,         -- 解放済みマップ番号
    shields = 0,            -- 消耗品（シールド）所持数
    stats = {
        totalDeaths = 0,
        totalSurvivals = 0,
        rarestMineral = "",
    },
    gamePasses = {
        doubleMineral = false,
        vipTrail = false,
        autoShield = false,
    },
}
```

---

### 2.5 アップグレードシステム

**コスト計算式:**

```lua
local cost = math.floor(base_cost * (1.5 ^ current_level))
```

**効果計算式:**

```lua
local effect = base_value * (1 + upgrade_level * multiplier)
```

**設計方針:**
- すべての購入はサーバーで検証（アンチチート）
- クライアントは次レベルのコスト/効果をプレビュー表示
- `UpgradeConfig.luau` に全定義を集約（設定の一元管理）

---

## 3. クライアント・サーバー通信設計

### RemoteEvents: サーバー → クライアント

| イベント名 | 引数 | 説明 |
|-----------|------|------|
| `GameStateChanged` | `state, data` | ステートマシン遷移通知 |
| `MineralCollected` | `mineralType, value` | 収集確認・UI 更新 |
| `WaterPosition` | `y` | 水位同期（10Hz スロットル） |
| `RoundStats` | `data` | ラウンド終了時の統計データ |

### RemoteEvents: クライアント → サーバー

| イベント名 | 引数 | 説明 |
|-----------|------|------|
| `RequestCollectMineral` | `mineralId` | ミネラル収集試行 |
| `RequestPurchaseUpgrade` | `upgradeType` | アップグレード購入要求 |
| `RequestPrestige` | - | プレステージ実行要求 |
| `RequestNextRound` | - | 次ラウンド準備完了通知 |

### RemoteFunctions

| 関数名 | 戻り値 | 説明 |
|--------|--------|------|
| `GetPlayerData()` | `PlayerData` | 初回データ読み込み |
| `GetLeaderboard(type)` | `Array<Entry>` | リーダーボードデータ取得 |

---

## 4. パフォーマンス設計

### 最適化戦略

| 項目 | 方針 | 理由 |
|------|------|------|
| 最大プレイヤー数 | 20人/サーバー | Roblox 最適値 |
| ミネラルモデル | `MeshPart` インスタンシング（同一メッシュ、色変更） | Draw Call 削減 |
| 水オブジェクト | 単一 Part + Tween（物理なし） | 計算負荷ゼロ |
| マップロード | Workspace に事前配置 + Visibility 切替 | ストリーミング不要 |
| ネットワーク | 水位更新を 10Hz にスロットル | 帯域削減 |
| メモリ | 収集後に `Destroy()` | リーク防止 |
| UI | 手動 Frame 管理 または Roact | 再描画コスト削減 |

---

## 5. アンチチート設計

**原則: サーバーを唯一の真実の源とする**

```
クライアントは「申請」する → サーバーが「検証」して「実行」する
```

**実装する検証:**

| 検証項目 | 実装方法 |
|---------|---------|
| ミネラル収集 | サーバー側近接チェック（`magnitude` による距離検証） |
| 通貨管理 | クライアントの通貨値を信頼しない（サーバー管理） |
| 移動速度 | `max_speed * 1.5` 超過でリクエスト拒否 |
| 重複収集 | 収集済み `mineralId` のサーバー側トラッキング |
| DataStore | レート制限（60秒ごとの自動保存 + 離脱時保存） |

---

## 6. DataStore 戦略

**推奨パターン: ProfileService**

```
ProfileService
├── セッションロック（データ重複防止）
├── 自動保存（60秒インターバル）
├── PlayerRemoving 時の保存
├── game:BindToClose 時の保存
└── データバージョニング（将来のマイグレーション対応）
```

**保存タイミング:**

```lua
-- 定期保存
RunService.Heartbeat:Connect(function()
    if tick() - lastSave > 60 then
        saveAllPlayers()
        lastSave = tick()
    end
end)

-- 離脱時保存
Players.PlayerRemoving:Connect(function(player)
    savePlayer(player)
end)

-- サーバーシャットダウン時
game:BindToClose(function()
    saveAllPlayers()
end)
```

---

## 7. スケーラビリティ設計

### 現在の設計（v1）

- 各サーバーが 1 つのマップインスタンスを管理
- `OrderedDataStore` でリーダーボード管理（60秒キャッシュ）

### 将来拡張（v2 候補）

| 機能 | 実装方法 |
|------|---------|
| マップ選択 | `TeleportService` でマップ別サーバーへ遷移 |
| クロスサーバーイベント | `MessagingService` でサーバー間通知 |
| プレイヤー数スケール | MatchmakingService 統合 |

---

## 8. 開発優先順位（2週間スプリント）

### Week 1: コアゲームループ

- [ ] `GameManager` ステートマシン実装
- [ ] 水上昇システム（Tween + 死亡判定）
- [ ] ミネラルスポーン基本実装（3 レアリティのみ）
- [ ] `PlayerDataManager` DataStore 基本実装
- [ ] 収集 RemoteEvent フロー

### Week 2: ゲームコンテンツ

- [ ] アップグレードショップ UI
- [ ] 全 6 レアリティ + 重み付きスポーン
- [ ] プレステージシステム
- [ ] リーダーボード（`OrderedDataStore`）
- [ ] アンチチート検証実装
- [ ] ポリッシュ（SFX、エフェクト、UI）

---

## 9. 関連リソース

- [[Escape Tsunami For Minerals - Game Design]]
- `Docs/` フォルダ内の詳細仕様ドキュメント
- [Roblox ProfileService](https://madstudioroblox.github.io/ProfileService/)
- [Roblox DataStore ベストプラクティス](https://create.roblox.com/docs/cloud-services/datastores)
