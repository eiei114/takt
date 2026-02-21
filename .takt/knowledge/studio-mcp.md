# Roblox Studio MCP Tools

## Overview

Roblox Studio MCP サーバー経由で、開いている Studio インスタンスと直接やり取りできる。
Studio が起動しており、MCP プラグインがインストール済みであることが前提。
Studio 未接続時はツールが失敗するだけで、ワークフロー全体は壊れない。

## Studio MCP ツール（robloxstudio-mcp）

### run_code
- **機能:** Studio 内で任意の Luau コードを実行し、`print()` 出力を返す
- **用途:** Instance 確認、状態検証、パーツ・モデル作成、プロパティ変更
- **例:**
  - 構造確認: `for _, child in game.Workspace:GetChildren() do print(child.Name) end`
  - パーツ作成: `local p = Instance.new("Part"); p.Size = Vector3.new(4,1,4); p.Position = Vector3.new(0,5,0); p.Anchored = true; p.Parent = workspace; print("Created:", p.Name)`
  - サービス確認: `print(game:GetService("ServerScriptService"):FindFirstChild("TS"))`

### insert_model
- **機能:** Roblox Creator Store からモデルをワークスペースに挿入
- **用途:** マーケットプレイスのアセット（モデル、UI キット、アニメーション等）を追加
- **入力:** モデル/アセット ID

### get_console_output
- **機能:** Studio のコンソール/出力ウィンドウの内容を取得
- **用途:** ランタイムエラー、警告、print 出力の確認
- **活用パターン:**
  - ビルド後のエラーチェック
  - Flamework 初期化の警告確認
  - ネットワークイベントの発火確認

### start_stop_play
- **機能:** Studio のプレイモードを開始/停止
- **用途:** ゲームを実行してテスト、終了して編集モードに戻る
- **注意:** 実行前に必ず `get_studio_mode` で現在のモードを確認すること

### run_script_in_play_mode
- **機能:** プレイモードを開始し、Luau スクリプトを実行し、自動停止
- **用途:** エンドツーエンドの動作検証 — ゲーム起動 → 検証コード実行 → 出力キャプチャ → 停止
- **例:**
  - Service 起動確認: `task.wait(3); print(game:GetService("ServerScriptService").TS.services)`
  - エラーチェック: `task.wait(5); print("Play test completed")`

### get_studio_mode
- **機能:** Studio の現在のモードを取得（Edit / Play）
- **用途:** 操作前の安全確認（Edit モードでのみ構造変更可能）

## Roblox Docs MCP（roblox-docs）

Roblox API ドキュメントを検索できる MCP サーバー。27 ツールを提供:

- **API ドキュメント:** クラス検索、メンバー情報、Enum 情報、非推奨チェック、サービス一覧
- **Luau 言語:** グローバル関数、型情報、ライブラリドキュメント、DataType 情報
- **FastFlags:** 14,000+ のエンジンフラグ検索
- **Open Cloud API:** REST エンドポイント検索
- **DevForum:** スレッド検索

不明な Roblox API を調べるときに活用する。

## ベストプラクティス

1. **モード確認が先** — 操作前に `get_studio_mode` で Edit モードを確認
2. **print() で出力** — `run_code` は `print()` の出力のみ取得可能。戻り値は直接取得不可
3. **スクリプトは短く** — MCP にはタイムアウトがある。長時間処理は避ける
4. **ビルドしてから検証** — `pnpm run build` で TS→Luau コンパイル後に Studio で確認
5. **Rojo 同期を確認** — `rojo serve` が動いていれば Studio に最新コードが反映される
6. **レビューでは読み取りのみ** — レビュワーは `run_code` で状態確認のみ行い、変更はしない

## 検証ワークフローパターン

1. ビルド: `pnpm run build`
2. モード確認: `get_studio_mode`（Edit であること）
3. 構造検証: `run_code` で Instance 階層を確認
4. ランタイムテスト: `run_script_in_play_mode` で動作確認
5. エラー確認: `get_console_output` で警告・エラーを確認

## Studio 未接続時の対応

- ツールが失敗/タイムアウトした場合は「Studio 未接続」として報告
- FAIL ではなく SKIP として扱う
- Studio 検証なしでもワークフローは続行可能
