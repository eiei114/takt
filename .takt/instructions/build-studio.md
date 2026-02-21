Studio MCP ツールを使って Roblox Studio 内にマップ・モデル・アセットを構築する。

**Reports to reference:**
- Plan: {report:00-plan.md}

**構築手順:**

1. 計画レポートを読み、作成対象を把握する
2. `roblox-docs` MCP で必要な API（Instance プロパティ、Terrain API 等）を確認
3. `get_studio_mode` で Edit モードであることを確認
4. `run_code` で Luau コードを実行し、Instance を作成・配置:
   - パーツ、モデル、地形、UI、Folder 等を段階的に作成
   - 各ステップで `print()` を使い結果を確認
   - 複雑な構造は複数回に分けて実行
5. `insert_model` でマーケットプレイスアセットを追加（計画で指定された場合）
6. `get_console_output` でエラーがないことを確認
7. `run_script_in_play_mode` で作成物の動作を確認（必要な場合）

**注意:**
- 一度に大量の Instance を作らない（MCP タイムアウト回避）
- パーツは `Anchored = true` で配置（意図的に物理演算させる場合を除く）
- Workspace を Folder で整理し、構造を保つ
- 不明な API は必ず `roblox-docs` MCP で確認してから使う

**Required output (include headings):**

## Work results
- {作成したもののサマリ}

## Created instances
- {作成した Instance のリスト（名前、種類、親、位置等）}

## Verification
- {コンソール出力チェック結果}
- {プレイモードテスト結果（実施した場合）}

## Issues
- {問題点、または "None"}
