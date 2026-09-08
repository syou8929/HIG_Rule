# Apple Pay の既存ruleレビュー

2026-09-08、[Apple Pay](https://developer.apple.com/design/human-interface-guidelines/apple-pay)の43既存ルールを、主担当24件・補助担当19件で現行本文に照合。全43件の表現・条件・例外・priorityを補正し、15件のMUST/MUST_NOTを含む規範強度とIDを維持した。

- 壊れた日英文テンプレートを直接的な指針へ。割引機能の提供条件、任意の入力・配送日時・支払い方法の表記を保持。
- 同意・privacy・取引状態の説明を優先。代替ボタンを禁止事項の例外にしていた誤り、承認前validationを必ず成功させるような過剰解釈を修正。
- ボタン最小寸法、余白、markの比較範囲、商標表記をAppleの説明として確認。独立の法律判断や実取引テストはしていない。
- 旧84候補中77件はDOM一致。残り7hashは現行原文の文単位にも保存パラフレーズにも一致しなかったため、根拠を確認して現行段落へ明示的に再trace。旧aliasを残し、新alias7件を追加。0037は実際のData validation errors sectionへ移行。

[ledger](apple-pay-review.json)、[元証跡](apple-pay-trace-evidence.json)、[再trace証跡](apple-pay-retraced-evidence.json)、[query評価](query-evaluation-after-apple-pay.json)に判断と検証を保存。

最終CIは38 tests / build / validation成功・警告0。隔離再抽出172 filesとstable-ID registryはbyte一致。固定query12＋重点6、git diff --check成功。最初の一時適用処理はrule-level overrideが存在しないtrace移行で書出し前に停止したため、ページbatchのレビューを確認して明示overrideを作る処理を補正して再適用・再検証した。

HEAD基準累計は追加1、statement変更93、削除0、規範強度変更0。今回の完了継続分は1ページ43件、残り7ページ332件。

このページには抽出器が認識しなかった動詞で始まる未収録指針がある。既存43件の検証と、次の追加候補batchの完了を区別する。使用率5%→6%、今回はユーザー指示によりusage増加による停止は行わない。
