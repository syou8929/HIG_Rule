# Sidebars・Search fields の差分レビュー

2026-09-08 JSTに[Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)22件と[Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields)24件を再レビューした。主担当がSidebars、補助担当1名がSearch fieldsを担当し、主担当もSearch fieldsの修正根拠と補足証跡を確認した。

46既存ルールのうち20件を補正（Sidebars11件、Search fields9件）。ID・規範強度は維持し、追加・削除なし。SidebarsのMUST3件も現行本文で支持された。

## 主な修正

- Sidebars0003: fixed colorは明確な目的を持つ色の選択肢であり、目的を不要にする例外ではない。例外から条件へ移動。macOSのaccent color要件0020には原文が認める固定色の例外を保持。
- Sidebars0009: watchOSルールに混ざったtvOSの条件を削除し、watchOSで非対応という正しい条件とplatform priorityへ。
- Sidebars0002・0012・0020: 非表示、並べ替え、system accent colorについて利用者の選択を尊重するpriorityへ。0011はplatform、0015はinput guidanceとして分類。
- Sidebars0004・0014・0021・0022: custom iconの適用条件、primary pane、convertible appearanceやcollection-view APIの任意性を補正。
- Search fields0009: button式search tabのfocusとkeyboardは標準動作として記述し、元tabへの復帰時点を「search退出後」へ。
- Search fields0010・0011・0014・0017・0022: toolbar context、独立したOR条件、専用領域を設けたい場合、関連順表示と分類の関係、detail-view検索の任意の配置案を補正。
- Search fields0015・0021・0023: 不自然な定型文、日本語で失われた「努める」、virtual keyboard時の「unfocusedを優先する」という強さを修正。

## 根拠と検証

[Sidebars ledger](sidebars-review.json)と[Search fields ledger](search-fields-review.json)に全ID、変更前後、判断、未確認事項を記録。

62候補はDOM行54件＋文単位8件で完全一致。補足証跡は[Sidebars](sidebars-sentence-evidence.json)と[Search fields](search-fields-sentence-evidence.json)。旧traceの移行は不要。原文全文・mediaは保存していない。

- `npm run ci`: 38テスト、build、validation成功。3,674 active / 3,682 total、172 source pages、警告0。
- 隔離再抽出で172 rule filesとstable-ID registryがbyte一致。
- HEAD基準標準差分は累計追加1、statement変更29、削除0、規範強度変更0。今回のstatement差分は6件。
- [query評価](query-evaluation-after-sidebars-search-fields.json): 固定12ケース・重点12項目が成功。46件のID・規範強度・3件単位paginationを確認。
- 証跡4ファイルの断片はすべて19語以下。`git diff --check`成功。

再開後6ページ / 125ルール、同日合計21ページ / 405ルールを検証まで完了。残り13ページ / 528ルール。次候補はScroll views25件。再開分の使用率は開始0%、このbatch開始1%、検証後2%。

SDKのOS-version別availability、実機動作、原文旧全文の厳密差分、mediaは未確認。コミット・pushはしていない。
