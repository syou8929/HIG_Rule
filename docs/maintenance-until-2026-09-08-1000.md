# 2026-09-08 10:00 JST までの保守作業

12:38 JSTの新しいユーザー依頼により再開。以下は前回実行の履歴として保持し、以後の状況は[再開後の記録](maintenance-resumed-2026-09-08.md)を参照。

## 実行条件

- ユーザー依頼: 10:00 JST まで作業を進める。
- 開始: 2026-09-08 04:44 JST。終了境界: 2026-09-08T01:00:00Z。
- 使用量ベースライン: Codex 7日窓の使用率 7%。同一実行中はリセットしない。
- 使用率が 12% 以上、または残量が 30% 以下なら次バッチを保留し、ここに保存する。使用量リセットは未承認。
- 時間境界を越えて新規作業を始めない。実行済み結果、検証、未解決事項を保存する。
- 継続用 heartbeat: `hig-10`。08:01 JSTに使用量停止基準によりPAUSEDへ更新済み。自動継続は停止している。
- 元からある未コミット変更を保存する。公開リリース、main へのマージはこの時間指定だけでは実行しない。

## 開始状態

- 作業場所: `/Users/moaiworks/Documents/HIG_Rule`。
- HEAD: `main` / `8ab19dc`。9月6日の検索CLI・Notifications・生成物・監査資料に未コミット変更あり。
- 9月6日鮮度スキャン: 変更35ページ / 975 active rules。Notifications完了後の残り34ページ / 933ルール。
- 正本の active rules: 3674。全件の Apple-source freshness は未確認。
- 作業計画: `docs/freshness-astra-plan-2026-09-06.md`。
- 元の残件: `docs/audits/2026-09-06/remaining-review-queue.json`。

## 停止状態（08:01 JST 保存）

- 08:00 JSTの開始時確認で、Codex 7日窓の共通使用率が12%に到達。固定baseline7%から5 percentage points増加したため、設定済みの停止基準を適用した。アカウント残量は88%であり、サービス全体の利用上限に達したわけではない。
- 10:00 JSTより前の予算停止。Multitasking / App shortcutsの新batchは開始していない。使用量リセットは行っていない。
- `hig-10`はPAUSED。自動で次batchを再開しない。再開には作業予算の扱いについてユーザーの指示が必要。baselineを黙ってリセットしない。
- 完了済み15ページ / 280ルール、残り19ページ / 653ルール。完了ID・根拠・判断は各review ledgerに保存済み。直近CI38 tests、build / validation、隔離再抽出172 files / ID registry、query固定12＋重点12が成功している。
- Git: `main` / `8ab19dc4ce0efc257bf434d5116fdd0554144970`。08:00確認時はtracked変更71エントリー、untracked8エントリー（`docs/`配下はまとめて1エントリー）。開始前の変更も保持しており、コミット・push・branch変更はしていない。
- この停止処理はcheckpointとqueueの状態記録のみ。source/rule/schema/generator/adapterは変更していないため、成功済みCIを再実行しない。

## 再開時の次の手順

1. 前回までの12ページに加え、Path controls・Rating indicators・Focus and selectionも完了。今回15ページ / 280ルールを再レビュー。最新queueは `docs/audits/2026-09-08/remaining-review-queue.json`（19ページ / 653ルール）。完了ページはqueueのcompletedと下記記録を参照し、再レビューを繰り返さない。
2. 次候補はMultitasking17件・App shortcuts20件の2ページ / 37 active rules。ユーザーが再開と予算の扱いを指示した後に、時刻・使用量を確認して開始する。1batch最大3ページかつ50件を超えないこと。
3. 各batchで最大3ページかつ50ルール、長いページはsection単位で意味を照合する。本実行のusage baselineは7%、最終観測12%（08:00 JST）。元の停止基準に到達済みであり、再開許可なく新batchを始めない。
4. source trace と判断根拠を保存し、必要な正本修正後に生成・CIを一度実行する。

Appleページ全文を永続化しない。保存する証拠断片は20語未満。ページハッシュが変わっただけでレビュー判断を一括再紐付けしない。

## 検証記録

- 04:48 JST: 独立した read-only 検索CLIレビュー完了。具体的な不具合なし。
- query focused tests 12/12、固定評価12ケース、合成境界432ケースを通過。
- 検証対象は決定的な取得・バイト上限・ページング挙動。意味検索の網羅性や Apple-source freshness の証明ではない。
- 05:02 JST: Playing audio の42件 / 45候補を現行公式本文と照合完了。ID・statement・規範強度・条件・例外は保持し、privacy関連0038・0039・0041のpriorityを6から3へ補正。
- 2回の描画でsource hash一致。証拠: `docs/audits/2026-09-08/playing-audio-trace-evidence.json`。レビュー: 同フォルダの `playing-audio-review.md` / `.json`。
- 単一ページ照合用 `scripts/inspect-source.ts` とライブラリ・テストを追加。candidateを消さず、19語以下の証拠と全候補の一致/未一致を記録。出力は新規evidenceファイル限定。
- 隔離再抽出: rule files 172件とstable-ID registryに差分なし。
- `npm run ci`: 37 tests passed、build / validation成功、3682 total / 3674 active、警告0。
- 固定query評価12ケース成功。`git diff --check`成功。
- helper `query_review` の作業は完了。必要なら1名まで再利用できる。
- 05:13 JST: Playing hapticsの43件 / 49候補を照合。根拠がfigcaptionにある9件も旧hashと一致。caption対応と回帰テストを照合ツールへ追加。
- Hapticsの0005をpriority3、0033をpriority2へ補正。0016はlinearなDigital Crown動作を一律に要求しない文言へ明確化。ID・規範強度は変更なし。
- Hapticsの隔離再抽出でcandidateの導入語が字句フィルターから外れる問題を検出し、同義のRecognizeへ調整。修正後は172 rule files / ID registryがbyte単位で一致。
- 最新CI: 38 tests passed、build / validation成功、警告0。固定query評価12ケース成功。
- HEAD基準のrule差分を更新: Notifications追加1、Haptics0016 statement明確化1、削除0、規範強度変更0。差分レポートの0016 review候補は今回レビュー済み。
- 記録: `docs/audits/2026-09-08/playing-haptics-review.md` / `.json`。最新caption証拠は `playing-haptics-caption-trace-evidence.json`。
- 05:28 JST: Playing video40件 / 43候補を照合。全IDと規範強度を保持して、priorityのみを含む24件の正規化を補正。
- Video0014のexit notification誤記、0016の最低0.5秒条件、0019/0022/0023の数値精度、0021のRealityKit能力と義務の混同、0024のgaze誤分類、0037のcontrols対象、profile・loading・exit条件を修正。
- 172 rule files / ID registryの隔離再抽出一致、CI38 tests / build / validation成功、警告0、固定query評価12ケースとgit diff --check成功。
- 最新HEAD基準の標準差分: Notifications追加1、statement変更4（Haptics0016、Video0014/0021/0037）、削除0、規範強度変更0。すべて各source-review ledgerで確認済み。
- 記録: `docs/audits/2026-09-08/playing-video-review.md` / `.json`。source evidenceとquery評価も同じfolder。
- Video0018は最終確認で「警告だけでは不十分」という解釈を除き、本文の明示する開始の選択と予期しない没入の回避に限定。修正後もCI38 tests、隔離再抽出172 files / ID registry、query12ケース、git diff --checkが成功。
- 05:36 JST: 共通使用率9%（開始7%、停止12%）。次batchへ進める範囲。完了ページの再レビューは繰り返さない。
- 05:45 JST: Feedback11件・Settings24件を全件意味照合。候補16件・29件はそれぞれ全hash/section一致、繰り返し描画も安定。
- Feedbackは0001/0004/0009のpriority、0006の例外欄とwatchOS portability、0011の通知予告reassureとportabilityを補正。Settingsは0001の例示条件、0005/0024のaccessibility priority、0017のmain view下部、0020/0021のwatchOS除外、0022/0023のkeyboard priorityを補正。計13件、ID・規範強度は維持。
- 同35件の変更セットでCI38 tests / build / validation成功、警告0。隔離再抽出172 files / ID registry一致。固定query12ケース＋batch固有10項目成功。HEAD標準差分は累計追加1、statement変更5（今回Feedback0011が追加）、削除0、規範強度変更0。
- 記録は `docs/audits/2026-09-08/feedback-review.md` / `.json` と `settings-review.md` / `.json`。根拠・query評価も同folder。source hash一致と意味レビューを区別して記録した。
- Gitはmain / 8ab19dc、既存と今回の未コミット変更を保持。コミット・push・branch変更は行っていない。継続heartbeatは有効のまま。
- 06:10 JST: Design principles39件を8sectionsに分けて全件意味照合。33候補はDOM行、6候補は段落内の文単位で旧hashと完全一致。通常CLIのunmatched6件は欠落ではなく単位の違いで、補足sentence evidenceで解決した。
- 同ページの17件を補正（うちpriority13件）。0033の実環境条件はtestだけに限定し、0020の本文にない表現手段列挙を除去、0036の推定時間指定を除去、0016のinput modality/tagsを補完。ID・規範強度は維持。
- CI38 tests / build / validation成功、警告0。隔離再抽出172 files / ID registry一致。固定query12ケース＋batch固有13項目成功。HEAD標準差分は累計追加1、statement変更6、削除0、規範強度変更0。今回のstatement差分0033は意味レビュー済み。
- 記録は `docs/audits/2026-09-08/design-principles-review.md` / `.json`、通常trace evidenceと補足sentence evidence、query評価。原文全文は保存していない。
- 06:40 JST: Ornaments7件・Pickers9件・Ratings and reviews9件を意味照合。全候補36件を確認（DOM行33件＋文単位3件）。通常CLIの未一致は補足sentence evidenceで解決。
- 同25件のうち9件を補正。Ornaments5件の任意性・system capability・代替案の扱い、Pickers2件のplatform条件・countdown style制約、Ratings2件のplatform priority/input neutrality・新version公開条件を修正。ID・statement・規範強度は維持。
- CI38 tests / build / validation成功、警告0。隔離再抽出172 files / ID registry一致。固定query12ケース＋batch固有8項目成功。HEAD標準差分は累計追加1、statement変更6、削除0、規範強度変更0。
- 記録は `docs/audits/2026-09-08/small-components-review.md`、3ページ各review ledger、trace / sentence evidence、query評価。同じsource hashでも意味の判断は独立に再確認した。
- 07:15 JST: Searching11件・Snippets11件・Edit menus15件を全件意味照合。全候補46件を確認（DOM行38件＋文単位8件）。Searchingに追加されたToolbars / Tab barsの2リンクも本文の具体例内の公式参照であることを確認し、ページの参照metadataへ反映。
- 同37件のうち26件を補正。Searchingのor選択肢とplatform/privacy priority、Snippetsのaccessibility・400pt上限・音声と視覚の役割、Edit menusの通常は/必要に応じて条件・製品要件をApple由来の例外とする誤帰属を修正。ID・規範強度は維持し、既存MUST4件を再確認。
- CI38 tests / build / validation成功、警告0。隔離再抽出172 files / ID registry一致。固定query12ケース＋重点12項目、git diff --checkが成功。HEAD標準差分は累計追加1、statement変更10、削除0、規範強度変更0。今回追加されたstatement差分4件も意味レビュー済み。
- 記録は `docs/audits/2026-09-08/search-snippet-edit-review.md`、3ページ各review ledger、trace / sentence evidence、query評価。使用率はbatch開始10%、検証後11%。原文全文を保存せず、コミット・pushは行っていない。
- 07:40 JST: Path controls1件・Rating indicators2件・Focus and selection16件を意味照合。全候補28件がDOM行単位でhash/section一致、未一致0。前2ページのルール内容はそのまま維持。
- Focus and selectionの9件を補正。0001の通常は条件とexplicit-intent priority、0003のTab文脈、0004の内部参照、0005の最大5状態・button例・unavailable挙動、0006の通常は限定、0007のsystem描画、0009のunavailable例外、0010/0011のcan条件を修正。ID・規範強度を維持し、batch内MUST6件を確認。
- CI38 tests / build / validation成功、警告0。隔離再抽出172 files / ID registry一致。固定query12ケース・重点12項目とgit diff --checkが成功。HEAD標準差分は累計追加1、statement変更12、削除0、規範強度変更0。今回のstatement差分はFocus and selection0005・0006で、意味レビュー済み。
- 記録は `docs/audits/2026-09-08/path-rating-focus-review.md` と3ページ各review ledger・trace evidence。今回の104証拠断片は19語以下。使用率はbatch開始・CI後11%。コミット・push・branch変更は行っていない。
- 08:01 JST: 次回開始時の使用率12%を確認し、新batchを開始せず停止。heartbeat `hig-10` をPAUSEDへ更新した。残件と次候補は変更せず、再開時の判断材料をこのcheckpointと最新queueへ保存した。

## 未完了

- Apple-source freshness の残りは19ページ / 653ルール。次はMultitasking・App shortcutsの37件。
- Haptics0011 / 0043のSelection guidanceに意味の重なりがある。今回の鮮度更新ではIDを保持し、将来の重複レビュー候補として記録済み。
- Video0016の遅延起算点、TV app integrationの既存tvOS scope外の利用可否は未確定。今回の本文レビューから追加の時間軸や他platform対応を推定しない。
- Settingsのsystem Settings entryやkeyboard shortcutについて、明示的なwatchOS非対応以外のplatform別利用可否は独立検証していない。残した対応条件を適用すること。
- SearchingのSpotlight importer・open/save・Quick Look個別APIのplatform別可用性、SnippetsのSDK/runtime別400pt制約は独立検証していない。今回の確認範囲はページ本文と既存scopeで、未確認の対応を推定していない。
- source-inspection CLIはDOM行のhashを照合する。手動の文単位traceを持つページでは未一致になり得るため、欠落と判断する前に同sectionの文単位で確認する。Design principlesの6件は補足evidenceで解決済み。
- 9月6日からの既存変更と今回の変更は未コミットのまま。大きいregistryのformat差分も開始時から存在する。意味変更だけを正しく確認すること。
- コミット・pushは未実行。
