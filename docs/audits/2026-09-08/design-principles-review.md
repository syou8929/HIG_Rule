# Design principles の差分レビュー記録

2026-09-08 JSTに[Apple HIG Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)の39ルールを、8つのprinciple sectionと導入文に照合した。主担当がAgency・Responsibility・Flexibility・Simplicityの22件、補助担当1名がPurpose・Familiarity・Craft・Delightの17件を確認。主担当は補助担当の修正候補も支持段落と照合した。

全39候補の根拠を確認し、ID・規範強度は維持。追加・削除なし。条件・modality・priorityなど17件を補正した。

## 根拠の単位

[通常のsource evidence](design-principles-trace-evidence.json)はDOMの段落・見出しなどと比較するため、33候補が一致し、6候補が未一致となった。未一致の6件は手動補完した文単位のhashだった。

[補足のsentence evidence](design-principles-sentence-evidence.json)では同じsectionの現行段落内の文を照合し、6候補すべてが旧hashと完全一致した。2候補は同じpermission/data-disclosure文を異なるatomic ruleに分けたもの。親段落のhash・位置・取得時刻と19語以下の断片を保持し、本文全文は保存していない。

このため、通常CLIの6件の未一致は削除・変更された指針を意味しない。候補やsource-sentence hashを変更せず保持した。存在確認とは別に、すべてのstatement・条件・例外と規範強度を意味レビューした。

## 修正

接頭辞は `HIG-GETTING-STARTED-DESIGN-PRINCIPLES-`。変更前後の全件は[review ledger](design-principles-review.json)を参照。

- 0007・0008: guided flowから抜ける選択と操作を戻す利用者の制御をpriority3へ。
- 0009・0034〜0037: 意図・permission・data disclosure・最小収集をprivacy / explicit-intent priority3へ。
- 0010・0024・0038: 情報の安全性、safety優先、misuse対策をpriority1へ。
- 0014・0039: accessibilityを明示的に含むためpriority2へ。
- 0016: 明記されるvoice・touch・keyboardをmodalityとtagsに追加し、input/device priority5へ。MAYのままで、全入力対応を義務化しない。
- 0017: simplicityとminimalismは同じではないという本文の留保をconditionsへ反映。
- 0020: 本文にないmotion / sound / visualという手段の列挙を削除。各interactionにcharacterを表す機会があるか検討する条件へ修正。
- 0026: 推定したprimary-task保持条件を、可能な限り多様なdevice・interaction・perspectiveを支える本文の条件へ修正。
- 0033: real-world settingsをtestだけに掛け、prototype / refine全体へ広げないstatementへ訂正。
- 0036: 根拠文にない具体的な「利用者がdataを渡す前」の時間指定を除き、収集時の内容と用途の明確な開示へ限定。別の同意・permission指針を無効にする変更ではない。

13件のpriority補正は既存の衝突解決順序への整合であり、規範強度の引き上げではない。一般的なprincipleはdecision toolとして扱い、すべてをMUSTにはしない。既存の6件のMUSTは、明示的なaccessibility・privacy・security・intent outcomeを保持するリポジトリのdecision policyに従って維持した。Apple自身による適合認証を意味しない。

## 検証

- `npm run ci`: 38テスト、build、validation成功。3,674 active / 3,682 total、172 source pages、警告0。
- 隔離再抽出: 172 canonical rule filesとstable-ID registryがbyte単位で一致。
- [query評価](query-evaluation-after-design-principles.json): 固定12ケースとbatch固有13項目が成功。modality検索、priority、MAY / MUST保持、条件の保持を確認。
- HEAD `8ab19dc` 基準の標準差分: 累計追加1、statement変更6、削除0、規範強度変更0。今回追加されたstatement差分は0033のみで、意味レビュー済み。
- `git diff --check`: 成功。

## 残件

今回の実行で6ページ / 199ルールを再レビュー。9月6日のNotificationsを含め、当初の変更候補35ページのうち7ページが完了し、残り28ページ / 734ルール。次候補はOrnaments7件・Pickers9件・Ratings and reviews9件の3ページ / 25件。[最新queue](remaining-review-queue.json)を参照。

使用率は固定baseline7%、このbatch開始・検証後10%。表示には共有利用・遅延・丸めが含まれ、個別のトークン消費量ではない。リンク先資料、画像、media、旧本文の厳密な全文差分は未確認。
