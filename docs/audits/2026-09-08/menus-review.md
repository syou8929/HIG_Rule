# Menus の差分レビュー

2026-09-08 JSTに[Menus](https://developer.apple.com/design/human-interface-guidelines/menus)の31既存ルールを再レビューした。主担当がLabels・Icons・Organization・Submenusの18件、補助担当1名が残り13件を担当し、最終修正を主担当が確認した。

27件を補正し、ID・規範強度を維持。MUST3件（0010・0017・0027）を支持。追加・削除なし。

## 主な修正

- 日英文の壊れた定型文を直接的な指針に修正。冠詞や大文字表記の英語限定、generally・prefer・canの条件を保持。
- icon-only項目の明示例外、submenusの1階層という一般推奨、別viewを使うことの任意性・典型性を復元。
- ゲーム内メニューの可読性・操作性をaccessibility priority、標準操作への対応をinput priorityへ。touch・gesture・gazeの分類漏れを補完。
- compact layoutのsymbolまたはiconという選択肢、mediumの3操作がapp全体の総数制限ではないことを明確化。
- visionOSのautomaticがsubtleになる3D重複条件を保持し、prominent・noneを義務ではなくリスク付きの選択肢として整理。

0026は、両方の状態を見せることが役立つ場合の代替案として、明示的な前回レビューに従いMAYを維持した。原文の条件付き命令を条件付きSHOULDと読む余地はあるが、文脈上の選択肢として保守的な分類を採用した。原文にconsiderがあるとは主張しない。visionOSのSwiftUI viewによる表示説明はAPI capability/reference contextとして扱い、このbatchで新しい規範ルールを自動追加していない。

## 根拠と検証

[ledger](menus-review.json)に全ID・変更前後・判断を保存。34候補はDOM29件＋同sectionの一文5件が一致し、補足証拠を主担当も再検証した。[通常証跡](menus-trace-evidence.json)と[文単位証跡](menus-sentence-evidence.json)の115断片はすべて19語以下。

8件は従来ページbatchのみでレビューされていたため、今回の明示的な修正に必要なrule-level overrideを追加。最初の適用処理は既存override必須の安全検査で停止し、正本を書き出す前に、レビュー済み修正だけ新規overrideを許すよう一時処理を修正した。

- `npm run ci`: 38テスト、build、validation成功。3,674 active / 3,682 total、172 source pages、警告0。
- 隔離再抽出で172 rule filesとstable-ID registryがbyte一致。
- [query評価](query-evaluation-after-menus.json): 固定12ケース・重点6項目が成功。
- HEAD基準標準差分は累計追加1、statement変更58、削除0、規範強度変更0。`git diff --check`成功。

再開後10ページ / 238ルール、同日合計25ページ / 518ルールを検証まで完了。残り9ページ / 415既存ルールと、Tab bars追加候補1件。次の既存レビューはApp icons40件。再開分の使用率は開始0%、このbatch開始・検証後とも4%。

実機・SDK availability・mediaは未確認。原文全文は保存しない。コミット・pushはしていない。
