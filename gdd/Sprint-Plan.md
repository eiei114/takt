---
tags:
  - type/project
  - project/escape-minerals
  - theme/roblox
created: 2026-02-21
modified: 2026-02-21
lead: "Escape Tsunami For Minerals! の2週間スプリント計画。Day 1-7でMVP、Day 8-14で拡張機能とポリッシュ。ソロ開発者向けのデイリータスク分解。"
---

# Sprint Plan — Escape Tsunami For Minerals!

## Sprint Overview

| 項目 | 内容 |
|------|------|
| **ゲームタイトル** | Escape Tsunami For Minerals! |
| **開発体制** | ソロ開発 |
| **技術スタック** | Roblox Studio + Luau (Advanced) |
| **開発期間** | 2週間（14日） |
| **1日の作業時間** | 6〜8時間 |

### マイルストーン

| チェックポイント | 目標 |
|----------------|------|
| **Day 3** | First Playable（最初のプレイアブル版） |
| **Day 7** | MVP Complete（最低限遊べるゲーム完成） |
| **Day 10** | Feature Complete（全機能実装完了） |
| **Day 14** | Launch（公開リリース） |

---

## Week 1 (Day 1-7): MVP — Playable Core Loop

### Day 1: Foundation（基盤構築）

> 目標: プロジェクト骨格を完成させ、データ保存の動作を確認する

- [ ] Roblox Studio プロジェクトセットアップ
- [ ] フォルダ構造作成（`ServerScriptService`, `ReplicatedStorage`, `StarterGui` など）
- [ ] `GameConfig.luau` 作成（定数定義: 鉱石テーブル、アップグレードテーブル）
- [ ] `PlayerDataManager.luau` 作成（DataStore 保存/読込の骨格）
- [ ] 基本的な `RemoteEvent` 定義（収集、購入、ラウンド通知など）

**成果物**: プロジェクト骨格完成、DataStore 保存テスト済み

---

### Day 2: Core Mechanics（コアメカニクス）

> 目標: 水が上昇してプレイヤーが死ぬ基本ループを動作させる

- [ ] `GameManager.luau` 作成（ステートマシン: `LOBBY` → `COUNTDOWN` → `PLAYING` → `ROUND_END`）
- [ ] `WaterSystem` 実装（`Part` + `TweenService` で水位を上昇させる）
- [ ] 死亡判定実装（水位 > プレイヤーの Y 座標）
- [ ] ラウンドタイマー実装（60秒カウントダウン）

**成果物**: 水が上昇してプレイヤーが死ぬ基本ループ動作

---

### Day 3: Map 1 + Minerals ★ First Playable

> 目標: マップを登りながら鉱石を集められる最初のプレイアブル版を完成させる

- [ ] **Beginner Canyon** マップ作成（Terrain または Parts）
- [ ] 足場配置（50個以上のプラットフォーム）
- [ ] 鉱石モデル作成（色違いの立方体 × 10種）
- [ ] `MineralSpawner.luau` 作成（高さベースのレアリティ重み付け）
- [ ] 鉱石収集処理（`Touch` → `RemoteEvent` → Server 検証 → 通貨加算）

**成果物**: ★ マップを登って鉱石を集められる = 最初のプレイアブル

---

### Day 4: UI（HUD + Shop）

> 目標: HUD とショップ UI を完成させ、買い物ができる状態にする

- [ ] HUD 実装（所持通貨、ラウンド番号、ミニマップ/水位バー）
- [ ] ショップ UI 実装（グリッドレイアウト、アップグレードカード）
- [ ] 鉱石収集エフェクト実装（浮遊テキスト `+N`、鉱石カラー付き）
- [ ] 購入処理実装（サーバー検証、即時効果反映）

**成果物**: UI 完成、ショップで買い物ができる

---

### Day 5: Upgrade System + Progression（アップグレードと進行感）

> 目標: アップグレードが機能し、ラウンドが進むにつれて難易度が上がる体験を作る

- [ ] Speed Boost 実装（レベル 1-10、`Humanoid.WalkSpeed` 変更）
- [ ] Jump Power 実装（レベル 1-10、`Humanoid.JumpPower` 変更）
- [ ] Mineral Magnet 実装（範囲内の鉱石を自動収集）
- [ ] コストスケーリング実装（`base_cost * 1.5^level`）
- [ ] ラウンド難易度スケーリング実装（水位上昇速度 +5%/round）

**成果物**: アップグレードが機能し、進行感がある

---

### Day 6: Death Screen + Round Loop（デス画面とラウンドループ）

> 目標: ラウンド全体のループをシームレスに動作させる

- [ ] デス画面実装（獲得サマリー + Play Again ボタン）
- [ ] ラウンドループ完成（`Death` → `Summary` → `Shop` → `Next Round`）
- [ ] ラウンド間トランジション（フェードイン/アウト）
- [ ] AFK 検出（5秒以上移動なし → 警告、10秒 → キック候補）
- [ ] モバイル対応（仮想ジョイスティック + ジャンプボタン）

**成果物**: 完全なラウンドループがシームレスに動作

---

### Day 7: MVP Polish + Testing ★ MVP Complete

> 目標: バグを潰してバランスを調整し、MVP として友人にテストしてもらう

- [ ] バグ修正（Day 1-6 で発見した問題をすべて対処）
- [ ] バランス調整（水の速度、鉱石価値、アップグレードコスト）
- [ ] FTUE 確認（初回プレイ体験が 2分以内にループ理解できるか）
- [ ] DataStore 永続化テスト（退出 → 再参加でデータ保持されるか）
- [ ] 友人に 5分テストプレイ依頼（フィードバック収集）

**成果物**: ★ MVP 完成 — 遊べるゲーム

---

## Week 2 (Day 8-14): Extended Features + Polish + Launch Prep

### Day 8: Map 2-3 + Double/Triple Jump（追加マップとジャンプ強化）

> 目標: 3マップで遊べるようにし、後半ラウンドの移動自由度を上げる

- [ ] **Rocky Mountain** マップ作成（小さい足場、動く障害物）
- [ ] **Crystal Cave** マップ作成（動く足場、落下する鍾乳石）
- [ ] Double Jump 実装（Round 10 で解放）
- [ ] Triple Jump 実装（Round 25 で解放）
- [ ] マップ自動切り替え実装（ラウンド数ベース）

**成果物**: 3マップで遊べる

---

### Day 9: Prestige System + Leaderboard（プレステージとリーダーボード）

> 目標: エンドゲームコンテンツとして、リセットして永続乗数を得るプレステージを実装する

- [ ] プレステージロジック実装（Round 50 以降、リセット + 永続乗数 25%）
- [ ] プレステージ UI 実装（確認ダイアログ、エフェクト演出）
- [ ] プレステージバッジ実装（キャラ頭上に表示）
- [ ] リーダーボード実装（`OrderedDataStore`、デイリー/全期間）
- [ ] ロビーにリーダーボード看板設置

**成果物**: エンドゲームコンテンツ完成

---

### Day 10: Sound + Visual Polish ★ Feature Complete

> 目標: サウンドとビジュアルを整え、全機能を実装完了させる

- [ ] BGM 実装（ロビー: 穏やか、ラウンド中: テンポ上昇）
- [ ] SFX 実装（鉱石収集 ding、水 splash、ジャンプ、死亡、プレステージファンファーレ）
- [ ] 鉱石パーティクルエフェクト（レア以上は光る）
- [ ] 水のビジュアル改善（透明度、波エフェクト）
- [ ] Lucky Boost + Shield アップグレード実装

**成果物**: ★ Feature Complete

---

### Day 11: GamePass + Monetization（マネタイズ）

> 目標: GamePass を作成・実装し、収益化の仕組みを完成させる

- [ ] GamePass 作成 — **2x Minerals**（99 Robux）
- [ ] GamePass 作成 — **VIP Trail**（49 Robux）
- [ ] GamePass 作成 — **Auto Shield**（149 Robux）
- [ ] ショップ UI 内 GamePass セクション追加
- [ ] 購入確認・即時反映テスト

**成果物**: マネタイズ機能完成

---

### Day 12: Spectator + Social Features（スペクテーターとソーシャル機能）

> 目標: 死亡後の体験を改善し、フレンドと遊びやすい環境を作る

- [ ] スペクテーターモード実装（死亡後に生存者を自動フォロー）
- [ ] "I survived with [Mineral]!" チャットメッセージ実装
- [ ] ロビーシステム改善（待機エリア、テレポーター）
- [ ] フレンド招待ボタン実装

**成果物**: ソーシャル機能完成

---

### Day 13: QA + Balance + Optimization（QA・バランス・最適化）

> 目標: 全フローを通してテストし、パフォーマンスとバランスを最終調整する

- [ ] 全フロー通しテスト（FTUE → Round 50 → Prestige）
- [ ] モバイル最終テスト
- [ ] パフォーマンス最適化（60FPS 確認、メモリリーク確認）
- [ ] バランスファイナル調整（全アップグレード・鉱石価値の見直し）
- [ ] DataStore 耐久テスト（複数プレイヤーの同時アクセス）
- [ ] 友人テストプレイ（3人以上、フィードバック収集）

**成果物**: QA 完了

---

### Day 14: Launch ★ Release（リリース）

> 目標: ゲームを公開し、初回の宣伝コンテンツを投稿する

- [ ] ゲームアイコン作成（鉱石 + 津波のサムネイル）
- [ ] ゲーム説明文作成（英語 + 日本語）
- [ ] ゲームタグ設定（`Escape`, `Survival`, `Minerals`, `Simulator`）
- [ ] 公開設定（`Public`、`Allow Copying: OFF`）
- [ ] TikTok 用スクリーンキャプチャ録画（3本分）
- [ ] 初回 TikTok / YouTube Shorts 投稿
- [ ] ソーシャルリンク設定（Discord、X など）

**成果物**: ★ ゲームリリース完了

---

## Risk Mitigation（リスク対策）

| リスク | 対策 | 発動条件 |
|--------|------|----------|
| Day 3 で大幅遅延 | Map 2-3 をカット、Map 1 のみでリリース | Day 3 終了時に First Playable 未達成 |
| アップグレードバランス崩壊 | スプレッドシートで事前計算 | テストプレイで即死 or 永久生存が発生 |
| モバイル動作不良 | PC 版のみで先行リリース | Day 10 でモバイル 60FPS 未達 |
| DataStore 問題 | ProfileService 採用を検討 | Day 1 の DataStore テストで不具合 |
| CCU が伸びない | TikTok 動画投稿頻度を上げる（毎日 1本） | リリース後 3日で CCU 100 未満 |

---

## Progress Tracker

```dataview
TABLE WITHOUT ID
    file.link as "タスク",
    status as "ステータス",
    (date(today) - file.cday).day as "経過日数"
FROM "4_Project/Escape-Minerals"
SORT file.cday asc
```
