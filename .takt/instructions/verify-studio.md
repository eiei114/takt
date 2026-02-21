Studio MCP ツールを使って実装結果を Roblox Studio 上で検証する。

**Reports to reference:**
- Scope: {report:coder-scope.md}
- Decisions: {report:coder-decisions.md}

**検証手順:**

1. ビルド確認: `pnpm run build` を実行（最新のコンパイル結果を反映）
2. Studio モード確認: `get_studio_mode` で Edit モードであることを確認
3. Instance 階層を検証: `run_code` で以下を確認
   - ServerScriptService/TS に期待するサービスが存在するか
   - ReplicatedStorage/TS と Common に期待するモジュールが存在するか
   - StarterPlayerScripts/TS に期待するコントローラーが存在するか
4. コンソール確認（Edit モード）: `get_console_output` でエラー・警告をチェック
5. ランタイムテスト: `run_script_in_play_mode` で検証スクリプトを実行
   - 2-3 秒待って初期化完了を確認
   - 期待するゲーム状態を print で確認
   - エラーがないことを確認
6. コンソール確認（Play 後）: `get_console_output` でランタイムエラーをチェック

**Studio 未接続時:**
- ツールが失敗した場合は「Studio MCP not available」として報告
- FAIL ではなく SKIP として扱う
- review へスキップを推奨

**Required output (include headings):**

## Studio Mode
- {Edit / Play / Not available}

## Instance Hierarchy
- {Expected vs actual, PASS/FAIL/SKIP per item}

## Console Output (Edit Mode)
- {エラー・警告、または "Clean"}

## Runtime Test
- {実行スクリプト内容、出力結果、PASS/FAIL/SKIP}

## Console Output (After Play)
- {ランタイムエラー、または "Clean"}

## Verdict
- {PASS / FAIL with details / SKIP if Studio unavailable}
