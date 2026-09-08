# 2026-09-08 再開後の保守作業

## 実行条件

- ユーザーの「未完了の作業を進めてください」により12:38 JSTに再開。
- 開始時の共通使用率は0%。こちらからusage resetは実行しておらず、表示が変わった理由は未確認。
- 前回のbaseline7%・12%停止記録は `maintenance-until-2026-09-08-1000.md` に保持。本再開分は新しい実行としてbaseline0%、5ポイント増または残量30%以下で次batchを保留する旨をユーザーに明示した。
- 前回の10:00期限は終了済み。今回の依頼には新しい時刻指定がない。停止済みheartbeat `hig-10` はPAUSEDのまま、自動継続を再開しない。
- 最大3ページかつ50ルール、長いページはsection単位。独立helperは最大1名。原文全文を保存せず証拠断片は19語以下。
- 既存の未コミット変更を保持。コミット・push・公開リリース・mainへのマージは行わない。

## 開始状態

- `main` / `8ab19dc`。前回完了15ページ / 280既存ルール、残り19ページ / 653ルール。
- 最新queue: `docs/audits/2026-09-08/remaining-review-queue.json`。
- 第1batch: Multitasking17件・App shortcuts20件、2ページ / 37ルール。主担当がMultitasking、helper `query_review` がApp shortcutsの意味レビュー。
- 各batchで正本・source-bound判断を更新する前に意味照合。ハッシュ一致だけで再紐付けしない。修正後はCI1回、隔離再抽出、検索検証を行ってから完了を記録。

## 第1batchの記録

- 12:39 JST: 2ページの繰り返し描画は安定。App shortcuts24/24候補が一致。Multitaskingは18候補中17一致、概要の1候補が旧sentence hashと不一致。
- Multitaskingの不一致は文単位の完全一致検査でも解消しなかった。旧根拠が現在も存在すると偽って保存せず、現行本文に対する0006の意味と例外を再確認したうえで、明示的なtrace移行とstable-ID registryの保持を行う。
- この記録時点では新batchのcanonical/config変更は未実施。通常trace evidenceのみ保存済み。原文全文・失敗した文一致の偽の補足証拠は保存していない。
- 12:48 JST: 2ページ37件の更新を反映。Multitasking9件・App Shortcuts20件を補正。別途Multitasking0006は現行概要へ明示的に再traceし、旧IDを維持するため新hashのID-map aliasを追加。旧aliasも保持した。
- App Shortcutsのkeyboard誤分類を全20件から除去。音声3件の分類、音声のみ／画面不可のaccessibility priority、直接的な日英文、内部rule参照・任意性の条件を修正。0009のsnippet応答は同日レビュー済みSnippetsのplatform制約を併用しiOS/iPadOSへ限定。
- CI38 tests / build / validation成功、警告0。隔離再抽出の172 rule filesは一致。ID-mapは初回byte比較でキー順だけの差分（意味差分0）を検出し、抽出器と同じ順に整形後、registryもbyte一致。
- HEAD基準標準差分は累計追加1、statement変更20、削除0、規範強度変更0。今回のstatement変更8件はApp Shortcutsの明確化。原文全文は保存せず、3 evidence filesの199断片はすべて19語以下。
- 記録: `docs/audits/2026-09-08/multitasking-shortcuts-review.md`、各review ledger、通常trace evidence、Multitaskingのretraced evidence。固定query12ケース・重点12項目は成功。旧・新ID alias保持とSnippetsのcross-page scopeも補助担当が確認。git diff --check成功。

## 第2batchの記録

- 13:03 JST: Onboarding20件・Outline views22件の照合と検証を完了。17件を補正（Onboarding9、Outline8）、ID・規範強度を維持。
- Onboarding20候補はDOM一致。OutlineはDOM12候補＋同sectionの一文11候補が一致し、主担当も補足sentence evidenceを検証した。
- 権限・skip尊重のpriority、例示の任意性、過剰な時間条件、法的文書の明示例外、click modality等を修正。旧trace移行はなし。
- CI初回はColumn views0003 / Outline views0004の古いduplicate source fingerprintで1件失敗。異なるcomponentで両ルールを残す判断を再確認し、この1組のみregistry更新後、CI38 tests / build / validation成功・警告0。
- 隔離再抽出172 files / ID registry一致。固定query12＋重点12、git diff --check成功。標準差分は累計追加1、statement変更23、削除0、規範強度変更0。
- 記録: `docs/audits/2026-09-08/onboarding-outline-review.md`、各ledger/evidence/query評価、`outline-column-duplicate-review.json`。Column viewsは既存snapshotの文脈比較であり、ページ全体の新規鮮度レビューには数えない。

## 第3batchの記録

- 13:20 JST: Sidebars22件・Search fields24件の照合と検証を完了。20件を補正（Sidebars11、Search fields9）、ID・規範強度を維持。
- 62候補はDOM54＋同section文単位8件で一致。Sidebarsの固定色の例外、watchOSへの別platform条件の混入、利用者の選択・input分類、APIの任意性を修正。Search fieldsのOR条件、system動作と実装指示の区別、日本語の条件強度等を補正。
- CI38 tests / build / validation成功、警告0。隔離再抽出172 filesとID registry一致。固定query12＋重点12、git diff --check成功。
- 標準差分は累計追加1、statement変更29、削除0、規範強度変更0。関連duplicate groupなし。記録: `docs/audits/2026-09-08/sidebars-search-fields-review.md` と各ledger/evidence/query評価。

## 第4batchの記録

- 13:28 JST: Scroll views25件の照合と検証を完了。18件を補正、ID・MUST3件を含む規範強度を維持。
- 32候補はDOM27＋同sectionの一文5件で一致。page sizeやzoomの例示、auto scrollの代替ケースと最小量、watchOS縦積み・長いpageの条件、visionOS marginの任意性、priorityとmodality tagsを補正。
- CI38 tests / build / validation成功、警告0。隔離再抽出172 filesとID registry一致。固定query12＋重点7、git diff --check成功。
- 標準差分は累計追加1、statement変更31、削除0、規範強度変更0。関連duplicate groupなし。記録: `docs/audits/2026-09-08/scroll-views-review.md` とledger/evidence/query評価。

## 第5batchの記録

- 13:38 JST: Pointing devices28件の照合と検証を完了。22件を補正、ID・MUST2件を含む規範強度を維持。
- 36候補すべてDOM一致。pointer/keyboard/touch/gestureの分類漏れ、Mac固有例のscope、代替案と例外、macOS操作表のORや状態区別を修正。Arrow説明の最終補正後に検証を再実行。
- 最終CI38 tests / build / validation成功、警告0。隔離再抽出172 filesとID registry一致。固定query12＋主担当の汎用重点6、git diff --check成功。
- 標準差分は累計追加1、statement変更33、削除0、規範強度変更0。関連duplicate groupなし。記録: `docs/audits/2026-09-08/pointing-devices-review.md` とledger/evidence/query評価。

## 第6batchの記録

- 13:47 JST: Tab bars29件の照合と検証を完了。16件を補正、ID・MUST3件を含む規範強度を維持。
- 33候補すべてDOM一致。More-tabのplatform範囲、sidebar変換等の任意性、利用者customization、label可読性、fixed sidebar表現、modality tagsを補正。0029はSidebars0010と整合してpriority4を維持。
- CI38 tests / build / validation成功、警告0。隔離再抽出172 filesとID registry一致。固定query12＋重点6、git diff --check成功。標準差分は累計追加1、statement変更35、削除0、規範強度変更0。
- iOSのaccessory付きtab bar縮小row25が未収録であることを確認し、`tab-bars-ios-minimization-followup.json` とqueueの`coverage_followups`へMAY候補を記録。旧本文での有無は未確認。既存29件の再検証と新規採番・実装を分け、後者は未完了として保持。
- 記録: `docs/audits/2026-09-08/tab-bars-review.md` とledger/evidence/query評価。

## 第7batchの記録

- 14:01 JST: Menus31件の照合と検証を完了。27件を補正、ID・MUST3件を含む規範強度を維持。
- 34候補はDOM29＋同sectionの一文5件で一致。日英文テンプレート、英語限定、一般推奨・任意性、icon-only例外、3操作の過剰な制限、visionOS表示効果の条件、priorityとmodalityを補正。
- 0026は条件付き代替案として既存MAYを維持。SwiftUI viewの記述はAPI capability/referenceとして扱い、新規規範ルールを強制追加しなかった。ページbatchのみだった8件には今回の修正用にsource-bound overrideを追加。
- CI38 tests / build / validation成功、警告0。隔離再抽出172 filesとID registry一致。固定query12＋重点6、git diff --check成功。標準差分は累計追加1、statement変更58、削除0、規範強度変更0。
- 記録: `docs/audits/2026-09-08/menus-review.md` とledger/evidence/query評価。

## 第8batchの記録

- 14:12 JST: App icons40件の照合と検証を完了。33件を補正、ID・MUST6件を含む規範強度を維持。
- Icon Composer固有scope、appearance対応platform、visionOS compatible-app条件、可読性や利用者選択のpriority、gaze誤分類、条件の任意性を修正。
- 43候補中39件はDOM一致。仕様4候補は旧hashが合成パラフレーズ由来だったため、数値・shape・mask・style・appearanceを再確認して現行table row74へ明示的に再trace。新しいduplicate-safe ID alias4件を追加し、旧aliasも保持。
- CI38 tests / build / validation成功、警告0。隔離再抽出172 filesとID registry一致。固定query12＋重点8、git diff --check成功。標準差分は累計追加1、statement変更60、削除0、規範強度変更0。
- alternate icon用appearance variantsの未収録要件1件と、app review義務を独立ruleへ分離するかの審査1件を別follow-upとして保存。既存Tab bars候補と合わせ3件（未収録確認済み2、atomicity審査1）。追加ruleはこのbatchでは採番・実装していない。
- 記録: `docs/audits/2026-09-08/app-icons-review.md` とledger/evidence/query評価、`app-icons-alternate-followups.json`。

## 停止位置と次の手順（14:13 JST）

- 再開分11ページ / 278ルール、同日合計26ページ / 558ルールが検証まで完了。残り8ページ / 375既存ルール、別途追加検討3件（未収録確認済み2、atomicity審査1）。
- 最新使用率5%。本再開分のbaseline0%から5ポイント増というAGENTS停止基準に達したため、次batchは開始しない。完了分・根拠・未解決事項・再開位置を保存済み。usage resetは使用していない。
- 次の既存ruleレビューはApple Pay43件の1ページ。新規Tab bars/App icons候補は別の小batchでatomicity・採番・source-review override・再生成・検証を行う。
- 再開時は最新usageとgit状態を再確認し、完了pageを繰り返さず最新queueを使う。既存のdirty worktreeを保持する。ルートでの一括ingest/sync/extractは避ける。
- heartbeatはPAUSEDのまま。コミット・pushはしていない。

| 未確認ページ | 既存ルール数 |
| --- | ---: |
| Apple Pay | 43 |
| File management | 34 |
| Generative AI | 57 |
| Gestures | 34 |
| Immersive experiences | 35 |
| Machine learning | 83 |
| Siri | 28 |
| Wallet | 61 |

50件を超えるページはsection単位に分割し、全対象を意味レビューする前にpage全体のsource-bound判断を更新しない。
