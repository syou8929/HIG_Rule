# Ornaments・Pickers・Ratings and reviews の差分レビュー

2026-09-08 JSTに3ページ / 25既存ルールを再レビューした。主担当が[Ornaments](https://developer.apple.com/design/human-interface-guidelines/ornaments)7件と[Pickers](https://developer.apple.com/design/human-interface-guidelines/pickers)9件、補助担当1名が[Ratings and reviews](https://developer.apple.com/design/human-interface-guidelines/ratings-and-reviews)9件を確認。主担当は補助担当の修正候補も支持段落と照合した。

全候補36件の根拠を確認。9ルールの条件・例外・scope・priorityを補正し、ID・statement・規範強度は維持した。追加・削除はない。

## 主な修正

Ornaments（接頭辞 `HIG-COMPONENTS-ORNAMENTS-`）:

- 0001: windowとの近さはornamentの説明された動作であり、追加のcustom配置義務として扱わない。
- 0003: glass上のbuttonはborderが不要な「場合がある」という条件を保持。視線のhover effectはsystem capabilityで、custom effectの義務ではない。
- 0005: contentに集中するときの非表示は任意の例外であり、video/photo表示中に必ず隠すという命令にしない。
- 0006: 視覚的なbalanceを優先する趣旨を保ち、追加のvisual weightやdistractionを完全になくす保証に広げない。
- 0007: 削除したornamentの要素をwindowへ移す選択肢をexceptionsからconditionsへ。移動は任意、count制限もMAYのまま。

Pickers（接頭辞 `HIG-COMPONENTS-PICKERS-`）:

- 0002: device languageによる順序と、iOS/iPadOS date pickerで説明されるlocation依存を区別。
- 0009: countdownの23時間59分上限を保持。inline/compact非対応という明示的制約に限定し、wheelsの手動選択を追加義務にしたりautomatic styleを排除したりしない。

Ratings and reviews（接頭辞 `HIG-PATTERNS-RATINGS-AND-REVIEWS-`）:

- 0004: 明示されたiOS/iPadOS/macOSのscopeに合わせpriority4へ。tap/clickは例示なのでmodality限定を解除。365日間3回はsystem上限で表示保証ではなく、利用者が閉じたり全appでopt outしたりできる文脈も保持。
- 0005: summary ratingのresetが新version公開時の選択肢である条件を補完。

## 根拠と確認範囲

変更前後・全確認IDは[Ornaments ledger](ornaments-review.json)、[Pickers ledger](pickers-review.json)、[Ratings and reviews ledger](ratings-and-reviews-review.json)に保存。

2回の描画で各page hashが安定。Ornamentsは8候補のうち7件がDOM行、1件が文単位で一致。Pickersは18候補のうち16件がDOM行、2件が文単位で一致。Ratings and reviewsは10候補すべてがDOM行で一致。

根拠は各 `*-trace-evidence.json`、文単位の補足は[Ornaments](ornaments-sentence-evidence.json)と[Pickers](pickers-sentence-evidence.json)に記録。断片は各19語以下で、原文全文は保存していない。通常CLIの未一致3件を欠落と推定せず、同sectionの旧sentence hashと一致することを確認した。

## 検証と残件

- `npm run ci`: 38テスト、build、validation成功。3,674 active / 3,682 total、172 source pages、警告0。
- 隔離再抽出で172 canonical rule filesとstable-ID registryがbyte単位で一致。
- [query評価](query-evaluation-after-small-components.json): 固定12ケースとbatch固有8項目が成功。
- HEAD `8ab19dc` 基準の標準差分は累計追加1、statement変更6、削除0、規範強度変更0。今回の条件等の変更は標準差分には出ないため、各ledgerを参照。
- `git diff --check`: 成功。

今回の実行は9ページ / 224ルール完了。9月6日のNotificationsを含め、当初の変更候補35ページのうち10ページが完了し、残り25ページ / 709ルール。次はSearching11件・Snippets11件・Edit menus15件の37件。[最新queue](remaining-review-queue.json)を参照。

SDK/APIの具体的実装、画像・media、リンク先資料、旧本文の厳密な全文差分は未確認。MUST/MUST_NOTを含まない3ページであり、強度の昇格は行っていない。共通使用率は開始baseline7%、このbatch開始・検証後10%。
