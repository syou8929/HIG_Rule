# Settings の差分レビュー記録

2026-09-08 JSTに[Apple HIG Settings](https://developer.apple.com/design/human-interface-guidelines/settings)の既存24ルールを再レビューした。補助担当1名がsection単位で全件を照合し、主担当も修正候補の支持段落とMUSTの根拠を確認した。29候補すべてのhashとsection pathが一致。ID・規範強度は維持し、追加・削除はない。

## 修正した8件

接頭辞は `HIG-PATTERNS-SETTINGS-`。

- 0001: device-awareなゲーム性能最適化は例示であり、すべてのappに課す条件ではない。適切なdefaultsで事前調整を減らす趣旨に整理。
- 0005・0024: systemwide settingsはaccessibility accommodationsを明示的に含むため、priority6から2へ変更。SHOULD / AVOIDは維持。
- 0017: main viewへessential optionsを置く場合は下部に置く条件を補完。More menuの代替案とMAYを維持。
- 0020・0021: custom settingsをsystem Settingsへ追加できないと明記されたwatchOSをplatform/device scopeから除外。他platformの対応条件は残し、未確認の対応を推定しない。
- 0022・0023: physical keyboardとplatform対応を前提とするCommand-Comma / Escapeの指針をinput/device priority5へ変更。

macOS0012のMUSTは、toolbarがあるsettings windowでactive buttonを常に示すという明示的なalwaysに支持されるため維持した。

[source evidence](settings-trace-evidence.json)は2回の描画の安定性、29候補の一致と19語以下の断片を保持する。[review ledger](settings-review.json)に24件の確認IDと8件の変更前後を記録した。今回の修正をAppleによる新しい義務の追加とは扱わない。

## 検証と留保

Feedbackとの35ルールの変更セットで、`npm run ci`の38テスト、build、validationが成功。3,674 active / 3,682 total、172 source pages、警告0。隔離再抽出で172 canonical rule filesとstable-ID registryがbyte単位で一致した。

[query評価](query-evaluation-after-feedback-settings.json)に固定12ケースとbatch固有の確認を記録。watchOS queryに0020・0021が混入しないこと、0017の配置条件がcompact outputに残ることなどを確認した。

他platformにおけるsystem Settings entryやkeyboard shortcutの対応可否を独立検証したわけではない。既存の対応条件を引き続き適用する。リンク先API、画像、media、旧本文の厳密な全文差分は未確認。

今回の実行で5ページ / 160ルールを再レビュー。9月6日のNotifications完了分を含め、変更候補35ページのうち6ページが完了し、残り29ページ / 773ルール。次候補はDesign principles39件。[最新queue](remaining-review-queue.json)を参照。
