# 検索CLI v2 検証結果

実行日時: 2026-09-06T05:05:50.554Z。source snapshotは従来の7月取得分を使用。canonical hash: `a6f4e29d7840bacfc7682f2a88cc4df2b5b1854ff2ee55303dc737499214d57c`。

既定10件・12,000 bytes以下のcompact応答、日本語/英語の部分一致検索、ID詳細取得、事前サイズ確認、優先順位による整列、ページ分割を実装した。全JSONは32,000 bytes以下。1件が収まらない場合は飛ばさず終了コード2と必要サイズを返す。

同じrule集合を全ページにわたって取得した比較で、出力サイズは合計60.4%減少した。旧方式は同じruleのpretty-printed full JSON配列、新方式はmetadataとsource表を含むcompact応答。0件ケースは削減率の集計対象外。

短縮形式はrationaleやchecks等を含まないが、scope・conditions・exceptions・規範強度・confidence・review状態・priority・出典・保存済みportable interpretationを保持することを検証した。全フィールドはID指定のfull JSONで取得できる。したがって、全フィールドを等価に圧縮した率ではない。

| ケース | 該当rule | ページ | compact bytes合計 | 出力サイズ削減 |
|---|---:|---:|---:|---:|
| ios-buttons | 16 | 2 | 17,919 | 60.4% |
| ipados-scroll-views | 14 | 2 | 15,906 | 60.5% |
| macos-menus | 25 | 3 | 28,749 | 60.1% |
| tvos-playing-video | 25 | 3 | 26,990 | 61% |
| visionos-ornaments | 7 | 1 | 7,586 | 60.2% |
| watchos-notifications | 42 | 5 | 47,870 | 60.8% |
| carplay | 119 | 12 | 133,916 | 61.1% |
| accessibility | 40 | 5 | 46,608 | 60.6% |
| permission | 38 | 5 | 46,809 | 57.7% |
| japanese-keyboard | 1 | 1 | 1,631 | 44.3% |
| offline | 0 | 1 | 249 | 対象外 |
| zero-results | 0 | 1 | 249 | 対象外 |

12ケース、延べ327件で指定フィルターに一致するID集合の欠落・重複0。対象範囲・条件・例外とsource traceの復元も照合した。意味上必要なruleの正解ラベルに対するrecallではない。

既定実行は全3673件に一致し、そのうち9件、11,390 bytesを返した。bytes上限により10件未満になる場合がある。has_moreとnext_offsetで続きが分かる。

CIは24テスト成功、build成功、validation警告0。CLIの事前確認も本文なしの有効なJSONを返すことを確認。ルール本体、他モデルのアダプター、作業開始前のupdate-diff変更を保持した。

再実行: `node --import tsx scripts/evaluate-query.ts`。単体テスト: `node --import tsx --test tests/query.test.ts`。必須検証: `npm run ci`。

注意: JSON出力はv2のオブジェクト形式へ変更した。既存利用側はトップレベル配列から`.rules`へ参照を更新する必要がある。source.refは応答内だけで有効。

未検証: Astraの回答品質・総トークン消費・意味検索の網羅性。日本語は保存文言への部分一致であり、キーボードが1件しか見つからないことやofflineが0件であることは、HIGに該当指針が存在しないという意味ではない。

利用枠表示は開始0%・終了1%。共有枠かつ粒度のある表示であり、この作業単独の正確な消費ではない。HIGの35変更ページ・975影響候補ルールのsource reviewは次工程。
