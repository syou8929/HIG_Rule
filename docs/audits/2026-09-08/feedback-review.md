# Feedback の差分レビュー記録

2026-09-08 JSTに[Apple HIG Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)の既存11ルールを、overview・Best practices・watchOSの本文と照合した。16候補すべてのhashとsection pathを確認し、ID・規範強度を維持した。追加・削除はない。

## 修正した5件

接頭辞は `HIG-PATTERNS-FEEDBACK-`。

- 0001: 明示的なアクセシビリティ要件にpriority2を適用。MUSTと複数の受け取り方の条件は維持。
- 0004・0009: 予期しない不可逆な損失の警告と、操作の予期された結果には警告を控える判断を、利用者の意図に関わるpriority3へ変更。SHOULD / AVOIDは維持。
- 0006: 通知による代替案はindeterminate indicatorを許す例外ではないため、exceptionsからconditionsへ移動。watchOS固有のportabilityを明示。
- 0011: 完了時の通知だけでなく、通知が届くと利用者に伝えるreassureの趣旨をstatementへ補完。watchOS固有のportabilityと既存の注視負担の条件を保持。

0004のunexpected・irreversibleという両条件を落としていない。0009は、それ以外の警告を一律禁止するルールではない。0011の候補文は短い要約として更新したが、根拠段落hashとstable IDは保持した。

[source evidence](feedback-trace-evidence.json)は2回の描画の安定性、16候補の一致と19語以下の断片を記録する。[review ledger](feedback-review.json)は11件の確認IDと5件の変更前後を記録する。hash一致だけを根拠に判断を再紐付けしたものではない。

## 検証と留保

Settingsと合わせた35ルールの変更セットで、`npm run ci`の38テスト、build、validationが成功。3,674 active / 3,682 total、172 source pages、警告0。隔離再抽出で172 canonical rule filesとstable-ID registryがbyte単位で一致した。

固定query12ケースと、このbatchの適用範囲・条件・優先順位の確認を[query評価](query-evaluation-after-feedback-settings.json)へ記録。標準rule差分のstatement変更は、このbatchでは0011のみ。その他の条件・scope・priority変更はledgerを参照。

リンク先HIG/API、画像、mediaは未確認。旧本文全文を保存していないため、厳密な全文差分は復元できない。残りはSettingsを含むこのbatch完了時点で29ページ / 773ルール。[最新queue](remaining-review-queue.json)を参照。
