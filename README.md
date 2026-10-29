# NEON-RESEARCH DIV. — サイバーパンク風 AI会社

ジャンルとターゲットを入れるだけで、AI社員8名が YouTube のテーマリサーチを行い、台本とサムネ案付きのHTMLレポートを納品します。

## 構成
```
.claude/skills/        AI社員（スキル）8名
  yt-research-director   うに  指令室長（統括）
  yt-trend-scout         マシュマロ  トレンド調査
  yt-competitor-analyst  いちご   競合分析
  yt-audience-profiler   ぶどう  ターゲット分析
  yt-theme-planner       にんじん   企画立案
  yt-script-writer       のりまき 台本ライター
  yt-thumbnail-designer  マカロン サムネイルデザイナー
  yt-report-designer     えだまめ 資料作成（assets/report_example.html がデザイン見本）
office/index.html      オフィス画面（サイバーパンク調、時間帯で昼夜が変わる）
server/index.mjs       Claude Agent SDK でAI社員を動かすサーバー
bin/log.sh             社員の作業ログを state/activity.jsonl に書き込む
research/<slug>/       案件ごとの成果物（00〜06のMarkdown、thumbnails/、report.html）
MANUAL.md              業務マニュアル
```

## 使い方 1：オフィス画面から実行する（LIVEモード）
必要なもの：Node.js 18以上、Anthropic の APIキー（または Claude Code にログイン済みであること）。

```bash
cd server
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # Claude Code にログイン済みなら省略可
npm start
```
ブラウザで http://localhost:3000 を開きます。右上に **LIVE · AGENT SDK** と表示されれば接続できています。DISPATCH を押すと、AI社員が実際にリサーチを始めます。作業の様子はリアルタイムで画面に反映されます。

| 環境変数 | 既定値 | 内容 |
|---|---|---|
| `PORT` | 3000 | サーバーのポート |
| `AI_COMPANY_MODEL` | claude-opus-5-5 | 使用するモデル |
| `AI_COMPANY_MAX_BUDGET_USD` | 5 | 1案件あたりの費用上限（USD） |

安全のため、AI社員が使えるツールは許可リストに入れたものだけです（検索、ファイルの読み書き、`bin/log.sh`、`mkdir` など）。それ以外は自動で拒否されます。

## 使い方 2：Claude Code から実行する
このフォルダで Claude Code を開き、次のように入力します。
```
/yt-research-director ジャンル：AI活用・副業 ／ ターゲット：20〜40代の会社員
```

## オフィス画面だけ見る（DEMOモード）
`office/index.html` をサーバーなしで開くと、デモ再生になります。
