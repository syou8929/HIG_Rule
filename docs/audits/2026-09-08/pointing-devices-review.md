# Pointing devices の差分レビュー

2026-09-08 JSTに[Pointing devices](https://developer.apple.com/design/human-interface-guidelines/pointing-devices)の28既存ルールを再レビューした。主担当がBest practicesとiPadOS標準動作・effectの18件、補助担当1名がcustomizing・magnetism・macOSの10件を担当。

22件を補正し、ID・規範強度を維持。MUST2件（0022・0023）を支持。追加・削除なし。

## 主な修正

- pointer、modifier-keyのkeyboard、touchとの比較、macOS gesturesのmodality/tag漏れを修正。pointerが明示されているルールをpointer検索で取得できるようにした。
- 0001・0002: Mac固有のgesture例と利用者による設定変更を、全platformの機能条件として扱わない。
- 0015・0017・0018・0026: Ideally / In general、明快なUIという代替案、他effectの既定magnetismとhoverの例外の区別を整理。
- 0019–0021: system content effectを採用する文脈を条件へ。0025は精密操作・離脱努力の負担に関するaccessibility priorityへ。12/24ptは概数の出発点として保持。
- 0027: 操作表は対応するinteractionの期待動作として扱い、全system gestureの独自実装を要求しない。primary clickの選択／起動、smart zoomの拡大縮小、force clickとpressureの動作を補正。
- 0028: 標準pointer使用時の意味対応として整理。open handの移動可能状態とclosed handのdrag中を区別し、I-beamの選択と挿入、resizeまたはmoveを保持。

## 根拠と検証

[ledger](pointing-devices-review.json)に全ID・変更前後・判断を保存。36候補はすべてDOM行のhashとsectionが一致。[証跡](pointing-devices-trace-evidence.json)は短い断片のみで、原文全文・mediaを保存していない。補足sentence proofと旧trace移行は不要。

最終の証跡確認で、更新案のArrow条件に足した「moving」を、原文どおり選択・interactionの説明へ修正した。canonical / review override / ledgerを整合させ、この追加変更後にCI・query・隔離再抽出を再実行した。

- 最終`npm run ci`: 38テスト、build、validation成功。3,674 active / 3,682 total、172 source pages、警告0。
- 隔離再抽出で172 rule filesとstable-ID registryがbyte一致。
- [query評価](query-evaluation-after-pointing-devices.json): 固定12ケース・重点6項目が成功。ID・強度、全修正field、3件単位pagination、platform/modality検索、日本語とsource traceを検証。
- HEAD基準標準差分は累計追加1、statement変更33、削除0、規範強度変更0。
- 証跡の断片はすべて19語以下。`git diff --check`成功。

再開後8ページ / 178ルール、同日合計23ページ / 458ルールを検証まで完了。残り11ページ / 475ルール。次候補はTab bars29件。再開分の使用率は開始0%、このbatch開始2%、検証後3%。

OSごとのSDK・hardware・gesture実装は未確認。現行HIG表中のLaunchpad記述はpage-localな根拠として保持し、全macOSバージョンで使えるとは主張しない。コミット・pushはしていない。
