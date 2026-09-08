# Path controls・Rating indicators・Focus and selection の差分レビュー

2026-09-08 JSTに3ページ / 19既存ルールを再レビューした。主担当が[Path controls](https://developer.apple.com/design/human-interface-guidelines/path-controls)1件と[Rating indicators](https://developer.apple.com/design/human-interface-guidelines/rating-indicators)2件、補助担当1名が[Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection)16件を確認。主担当はFocus and selectionのBest practices・platform各sectionの支持段落も独立に照合した。

全候補28件のhashとsectionが一致し、未一致0。Path controls・Rating indicatorsの内容は維持し、Focus and selectionの9ルールを補正した。ID・規範強度は維持。追加・削除はなく、既存MUST6件の明示的な根拠も再確認した。

## 主な判断

Path controls0001はmacOSのwindow body配置とtoolbar/status bar除外、Rating indicators0001はinline編集のSHOULD、0002はcustom symbolの目的を明確にする条件付きMUSTを維持した。overviewにあるsystem behaviorを新たな独自実装義務にはしていない。

Focus and selection（接頭辞 `HIG-INPUTS-FOCUS-AND-SELECTION-`）:

- 0001: 操作なしのfocus変更をexplicit-intent priority3へ。対象消失時にindicatorを隠すのは「通常は最善」であり、強制しない。表示上の条件に移し、方向入力中のfocus移動だけを例外に残す。
- 0003: 読み順でのfocus-group移動はTab操作の文脈と明記。予測可能なcustom-view順序を求めるMUSTは維持。
- 0004: 内部の別ruleへの参照を、pointerが必要な場合の視認性・体験への統合というsource条件へ置換。
- 0005: 最大5状態のうち該当する状態に対応する趣旨を復元。すべての項目に全5状態を要求しない。選択済み表示への遷移順序はbuttonの例なので一般条件から外し、即時feedbackを保持。unavailableはfocus・選択不能という挙動を補完。
- 0006: ring/highlightの使い分けに「通常は」を復元。
- 0007: 配色の説明はsystem drawingの具体例であり、独自に固定色を実装する義務ではないと明確化。
- 0009: tvOS到達性のMUSTとinput priority5を維持。同ページのtvOS状態表で明示されるunavailable項目は到達性の対象外とする。
- 0010: haloの輪郭・位置調整は必要時に選べる手段とし、両方を常時行う条件にしない。
- 0011: priority増加はprimaryにするための手段であり、任意の増加で必ずprimaryになるという断定を弱める。

0013のpointer視認性は明示的MUSTを維持し、platform priority4のまま。core input指針を一律にaccessibilityへ昇格していない。0014・0015の拡大asset品質・周囲の圧迫防止もMUSTを維持。0016のvisionOS hoverとfocusの区別も支持された。

## 根拠と検証

変更前後・全確認IDは[Path controls ledger](path-controls-review.json)、[Rating indicators ledger](rating-indicators-review.json)、[Focus and selection ledger](focus-and-selection-review.json)に保存。

2回の描画で各page hashが安定。Path controls3候補、Rating indicators3候補、Focus and selection22候補がすべてDOM行単位で一致した。各 `*-trace-evidence.json` に含まれる104断片はすべて19語以下。原文全文は保存していない。hash一致とは別に意味をレビューした。

- `npm run ci`: 38テスト、build、validation成功。3,674 active / 3,682 total、172 source pages、警告0。
- 隔離再抽出で172 canonical rule filesとstable-ID registryがbyte単位で一致。
- [query評価](query-evaluation-after-path-rating-focus.json): 固定12ケース・重点12項目がすべて成功。ID単位の条件・MUST維持と取得結果を確認。
- HEAD `8ab19dc` 基準の標準差分は累計追加1、statement変更12、削除0、規範強度変更0。今回のstatement差分はFocus and selection0005・0006。条件・priority等の変更は各ledgerを参照。
- `git diff --check`: 成功。

## 残件

今回の実行は15ページ / 280ルール完了。9月6日のNotificationsを含め、当初の変更候補35ページのうち16ページが完了し、残り19ページ / 653ルール。次候補はMultitasking17件・App shortcuts20件の計37件。[最新queue](remaining-review-queue.json)を参照。

API実装・assistive technologyの実機テスト、リンク先資料、画像・media、旧本文の厳密な全文差分は未確認。共通使用率は開始baseline7%、このbatch開始・CI後11%。コミット・pushは行っていない。
