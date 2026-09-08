# Onboarding・Outline views の差分レビュー

2026-09-08 JSTに[Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)20件と[Outline views](https://developer.apple.com/design/human-interface-guidelines/outline-views)22件を再レビューした。主担当がOnboarding、補助担当1名がOutline viewsを確認し、主担当はOutline viewsの修正候補も支持段落と照合した。

42既存ルールのうち17件を補正。ID・規範強度は維持し、追加・削除なし。MUST2件も現行本文で支持された。

## 主な修正

Onboarding（9件）:

- 0004・0018: onboardingへ法的文書等を含める必要がある場合の明示的な例外を復元。「App Store側に置けない場合のみ」という推定条件を除去。法的要件自体は判断していない。
- 0006: separate tutorialを用意する条件に、本文にないprerequisite-flowとの境界を追加しない。
- 0007・0020: private data/resourceへの権限要求をpriority3へ。0007の説明機会はMAYの文脈を保持。
- 0009: 覚えやすさという表現を、覚える情報量を多くしないという本文の趣旨へ。
- 0011: 必須でない設定を後回しにする目的は早く使い始められること。「first use後まで」という推定時点を除去。
- 0015・0016: tutorialをskipした利用者の選択と後からの復帰をpriority3へ。見つけやすさのMUSTは保持し、help/account/settingsは配置の例として扱う。

Outline views（8件）:

- 0002: 単一列ではlabel等で十分なcontextを示す場合にheadingを省略できる例外を追加。複数列のheading MUSTは維持。
- 0010: 展開状態の保持を利用者の選択・context復帰としてpriority3へ。
- 0018: 本文にないstable-orderという技術条件を除去。必要時のsecondary-column sortingはMAYのまま。
- 0021: double-clickの別動作はsingle-click編集の例外ではないためconditionsへ。
- 0003・0017・0019・0020・0021: 本文が明示するclick操作をpointer modalityとtagへ反映。

## 根拠と検証

[Onboarding ledger](onboarding-review.json)と[Outline views ledger](outline-views-review.json)に全ID・変更前後・判断を保存した。

43候補のうちDOM行32件と文単位11件が一致。Outline viewsの11件は同sectionの一文で旧hashに完全一致し、[補足証拠](outline-views-sentence-evidence.json)を主担当も再検証した。旧traceの移行は不要。3 evidence filesの90断片はすべて19語以下で、原文全文は保存していない。

初回CIは、Column views0003 / Outline views0004の重複レビューが旧Outline page hashを保持していたため1件失敗。二つのmacOS component contextを比較し、両方の列幅変更ルールを残す判断を再確認した。[重複レビュー記録](outline-column-duplicate-review.json)に旧・新traceと範囲を保存し、registryのこの1組のみ更新。Column viewsは既存の確認済みsnapshotを保持し、このbatchでそのページ全体の最新性を主張していない。

- 最終`npm run ci`: 38テスト、build、validation成功。3,674 active / 3,682 total、172 source pages、警告0。
- 隔離再抽出で172 rule filesとstable-ID registryがbyte一致。後続のduplicate-review-only変更は抽出器の入力ではない。
- [query評価](query-evaluation-after-onboarding-outline.json): 固定12ケース・重点12項目が成功。
- HEAD基準標準差分は累計追加1、statement変更23、削除0、規範強度変更0。今回のstatement差分3件はOnboarding0009・0011・0018。
- `git diff --check`: 成功。

再開後4ページ / 79ルール、同日合計19ページ / 359ルールを完了。残り15ページ / 574ルール。次候補はSidebars22件・Search fields24件の計46件。再開分の使用率は開始0%、このbatch開始・境界1%。

法的要件、個別SDK/API、実機・assistive technology動作、media、旧全文の厳密な差分は未確認。コミット・pushはしていない。
