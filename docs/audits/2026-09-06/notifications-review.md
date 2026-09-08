# Notifications の差分レビュー記録

2026-09-06に既存42ルールを公式本文と再照合し、入力分類8件を補正、1件を追加した。Notificationsは43 active rules、リポジトリ全体は3,674 active rules（deprecatedを含め3,682件）となった。今回の対象はNotifications 1ページと、補助資料のGestures内watchOS / Double tap節。HIG全体の最新化は未完了。

## 照合した根拠

[Apple HIG Notifications](https://developer.apple.com/design/human-interface-guidelines/notifications)を描画後に確認し、2回の取得で同じページhashを確認した。旧49候補すべてについて、根拠段落のhashとsection pathが現行本文と一致した。既存42ルールのstatement、規範強度、条件、例外を支持段落まで確認した。既存のMUST / MUST_NOT 12件を含め、ID、statement、規範強度は維持した。

ページhashは変化しているが、旧本文全文を保存していないため、ページ全体の正確な文章差分は復元できない。今回の修正・追加は再確認で見つけた正規化の補正であり、Appleが新たな規範を追加したと判断したものではない。

取得日時、旧／新ページhash、候補ごとの根拠は[trace evidence](notifications-trace-evidence.json)、判断と変更前の値は[review ledger](notifications-review.json)に保存した。証拠断片は各20語未満で、原文全文や画像は保存していない。

## 反映内容

| 対象ID末尾 | 変更 | 根拠・適用範囲 |
|---|---|---|
| 0019、0021、0038〜0042 | scopeとtagsから誤ったgaze分類を除去 | watchOSのshort look / long lookという通知形式を、視線入力として分類していたため |
| 0025 | touchをgestureへ変更し、対応するApple Watchという条件を追加 | [Apple HIG Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures)のwatchOS / Double tap節を補助確認。[証拠](watchos-gesture-evidence.json) |
| 0043（追加） | 通知の警告音に添える振動を、プログラムから指定できることに依存しない | Notifications / Contentの能力上の制約をAVOID・mediumとして追加。一般の触覚フィードバック全体を禁止する規則ではない |

ID接頭辞はすべて `HIG-COMPONENTS-NOTIFICATIONS-`。既存42件のsource traceを更新し、source-reviewとnormative-reviewに今回の確認範囲を追記した。その他のページを再レビュー済みとは扱っていない。補助確認したGesturesのcanonical dataも更新していない。

## 再現性と検証

入力分類のtags補正を再抽出後も維持するため、抽出処理にsource-reviewのtags上書きを追加した。隔離コピーで再抽出し、既存42件のID・statement・規範強度を保持、補正8件と追加1件の再現、既存ID registryの全対応保持、他ページのruleファイルに変更がないことを確認した。

`npm run ci`は24テスト成功、build成功、3,682 rules / 172 source pagesのvalidation成功、警告0。生成済みアダプター、配布データ、チェックリストを再生成した。[標準rule差分](../../../dist/reports/rule-update-diff.md)は追加1件、削除・deprecated化0、規範強度変更0。scope・tagsの補正は標準差分の対象外なのでreview ledgerに記録している。

利用枠の表示は開始1%、終了1%（7日間のアカウント共有枠）。丸め・反映遅延があるため消費ゼロや正確なトークン数を意味しない。今回のsource reviewでAstraの回答品質や総トークン削減率は測定していない。

## 次回へ残す事項

自動取り込みだけでは、既存の手動補完を含む49候補に対して42候補しか生成されなかった。今回は旧49候補の根拠を現行本文で照合して保持し、新規1候補を加えた。一括syncで候補を置換すると有効な手動補完を失い得る。次回も隔離コピーで候補集合とsource traceを照合し、消えた候補を機械的に廃止しない。対象限定取り込みと候補照合の自動化は未実装。

当初の35変更候補ページのうち、未レビューは34ページ・933既存ルール。[再開用queue](remaining-review-queue.json)は9月6日のhash差分に基づき、要修正件数を示すものではない。次はPlaying audioの42件を候補とする。開始前にそのページのhashと利用枠を再確認し、最大3ページかつ50件、補助1名までで作業する。使用率が開始から5ポイント増加、または残量30%以下なら次のbatchへ進まない。933件すべてを50件以内でレビューする場合は件数だけでも最低19batchとなり、ページ・節の区切りによって増えるため、全件の時間・トークン量は現時点で確約しない。

この記録は出典と正規化のレビューであり、プロダクトのHIG適合認証ではない。画像・動画・複雑な表や、今回対象外のページの最新内容は未検証。
