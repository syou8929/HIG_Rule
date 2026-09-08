# Scroll views の差分レビュー

2026-09-08 JSTに[Scroll views](https://developer.apple.com/design/human-interface-guidelines/scroll-views)の25既存ルールを再レビューした。主担当がBest practices / Scroll edge effectsの12件、補助担当1名がPlatform considerationsの13件を担当し、主担当も修正根拠を照合した。

18件を補正し、ID・規範強度を維持。MUST3件（0010・0015・0022）を支持。追加・削除なし。

## 主な修正

- 0001・0015は入力、0005・0006・0019・0020はplatform、0018はlegibility、0016は選択・入力とcontext保持のpriorityへ。
- 0003: 異なる向きのscroll viewを入れ子にできることは、同じ向きの入れ子を避ける規則の適用範囲として整理。
- 0004・0005・0017: page sizeの「通常」「可能」、automatic edge styleの一般的な推奨、zoom例示の「多くの状況で」という条件を保持。
- 0016: 自動scrollの四つの状況は代替的な例であり、同時に成立すべき条件ではない。部分的に見える選択をすべて表示する必要がないことも保持。
- 0009・0012・0023・0025: In general、縦積み時のsystem動作、tight margin拡大の任意性、長いwatchOS pageも使える条件を補正。
- 0011: Digital Crownによる標準動作を追加実装命令と区別。0010・0013のgaze、0011・0012・0025のdigital-crown tagsを既存scopeに整合。

## 根拠と検証

[ledger](scroll-views-review.json)に全ID・変更前後・判断を記録。32候補はDOM27件＋同sectionの一文5件で完全一致。[補足証跡](scroll-views-sentence-evidence.json)は主担当も再検証。旧trace移行なし、原文全文・mediaの保存なし。

- `npm run ci`: 38テスト、build、validation成功。3,674 active / 3,682 total、172 source pages、警告0。
- 隔離再抽出で172 rule filesとstable-ID registryがbyte一致。
- HEAD基準標準差分は累計追加1、statement変更31、削除0、規範強度変更0。
- [query評価](query-evaluation-after-scroll-views.json): 固定12ケース・重点7項目が成功。25ID、MUST3件、3件単位paginationを確認。
- 2 evidence filesの断片はすべて19語以下。`git diff --check`成功。

再開後7ページ / 150ルール、同日合計22ページ / 430ルールを検証まで完了。残り12ページ / 503ルール。次候補はPointing devices28件。再開分の使用率は開始0%、このbatch開始・検証後2%。

Look to Scroll、legibility、Digital Crownの実機動作、SDKのavailabilityは未確認。tvOS固有のcustom indicator対応は推定していない。コミット・pushはしていない。
