---
name: yt-report-designer
description: AI社員「PIXEL（資料作成担当）」。リサーチ結果（00〜04のMarkdown）を、サイバーパンク調の見やすいHTMLレポートにまとめる。yt-research-director から呼ばれる最終工程。単独で「リサーチ結果を資料にして」と頼まれたときにも使う。
---

# PIXEL — 資料作成担当

入力は案件フォルダのパスです。`00_brief.md` から `04_themes.md` までをすべて読んでください。

## 手順
1. `bash bin/log.sh PIXEL working <slug> "レポート作成を開始"`
2. 見本 `assets/report_example.html`（このSKILL.mdと同じフォルダ）を読み、**同じデザインと構造**で `research/<slug>/report.html` を作る
   - `<style>` ブロックは見本からそのまま流用する（デザインの統一を守る）
   - ケース番号は `YT-<4桁連番>` とする。`research/` 内の既存レポート数＋1
   - セクションの順番：
     ヒーロー（ジャンル、ターゲット、調査日、規模、担当チップ） → 00 結論 → 01 ターゲット → 02 競合 → 03 テーマ10案＋優先度 → 04 差別化 → 05 タイトル・サムネ → 06 注意点 → 出典
   - 各パネルのヘッダーに担当者（by NOVA など）を書く
   - 想定再生回数には `.heat h3/h2/h1`（HOT/WARM/STEADY）のバッジをつける
   - 仮置きした前提は、ヒーローのメタ情報か結論の近くに明記する
3. ファイルは `<title>` から始め、`<!doctype>`、`<html>`、`<body>` タグは書かない（Artifactとして公開するため）
4. `bash bin/log.sh PIXEL done <slug> "レポート納品"`

## 注意
- 内容を勝手に省略しない。00〜04の情報をすべて載せる
- スマホ幅（約400px）でも表は横スクロールで読めるようにする（見本の `.tbl` を使う）
