# Searching・Snippets・Edit menus の差分レビュー

2026-09-08 JSTに3ページ / 37既存ルールを再レビューした。主担当が[Searching](https://developer.apple.com/design/human-interface-guidelines/searching)11件と[Snippets](https://developer.apple.com/design/human-interface-guidelines/snippets)11件、補助担当1名が[Edit menus](https://developer.apple.com/design/human-interface-guidelines/edit-menus)15件を確認。主担当は補助担当の修正候補も支持段落と照合した。

全候補46件の根拠を確認し、26ルールの条件・例外・priority・statementを補正した。ID・規範強度は維持し、追加・削除はない。4件の既存MUSTも再確認した。

## 主な修正

Searching（接頭辞 `HIG-PATTERNS-SEARCHING-`）:

- 0002: 最近の検索と予測候補はorで提示された選択肢。両方の提供を要求しないstatementと表示タイミング条件へ修正。
- 0003–0006・0011: 既存のplatform-specific scopeにpriorityを整合。0005は組み込みsearch fieldが通常含まれる、という限定を復元。
- 0009・0010: 検索履歴のprivacyをpriority3へ。表示した履歴を消せるという条件付きMUSTは維持。
- Toolbars / Tab barsへの追加リンクを、Notes・Photos・Apple TVの検索位置の具体例で確認。追加2件、削除0件をsource metadataとledgerへ保存。リンク先ページはこのbatchで取得していない。

Snippets（接頭辞 `HIG-COMPONENTS-SNIPPETS-`）:

- 0001・0007: 読みやすさ・文字サイズをaccessibility priority2へ。文字サイズ条件を利用者設定による変動に明確化。
- 0003: 確認するactionを識別するlabelをexplicit-intent priority3へ。
- 0006: 400pt上限の既存MUSTを保持。残りのcomponent/platform制約はpriority4へ整合。
- 0008: 詳細な該当contentへのdeep linkを条件として明示。
- 0009・0010: 視覚的なcustom viewと画面を見ない場面の音声を区別。音声dialogueは、文字として表示する指針の例外ではなく補完する文脈。
- 0011: tvOS / visionOS / watchOS非対応の明示条件を記録し、既存AVOIDを維持。

Edit menus（接頭辞 `HIG-COMPONENTS-EDIT-MENUS-`）:

- 0002: system-defined input interactionをpriority5へ。0004・0012はundo/recovery・削除actionの意味の違いをpriority3へ。
- 0005: 内部の別ruleへの言及をsource条件から外し、簡潔なaction labelという本文の条件に限定。
- 0007・0011: 「通常は」を復元。0007の製品要件例外はApple本文由来ではないためsource例外欄から除去。製品要件とHIGの差分・リスクを説明するリポジトリ共通方針は維持。
- 0012: 「必要に応じて」を復元。0015: 位置は変更できるが形とpointerは変更できないという能力制約をexceptionsからconditionsへ移動。
- 0006の明示的なEnsureに基づくMUSTは維持。

## 根拠と確認範囲

変更前後・全確認IDは[Searching ledger](searching-review.json)、[Snippets ledger](snippets-review.json)、[Edit menus ledger](edit-menus-review.json)に保存。

2回の描画で各page hashが安定。Searchingは12候補のうち11件がDOM行、1件が文単位で一致。Snippetsは14候補のうち7件がDOM行、7件が文単位で一致。Edit menusは20候補すべてがDOM行で一致。文単位の旧hashとsectionの完全一致を[Searching補足証拠](searching-sentence-evidence.json)と[Snippets補足証拠](snippets-sentence-evidence.json)へ保存した。

各証拠断片は19語以下。原文全文は保存していない。根拠の存在と意味の承認は別の検証として行った。

## 検証と残件

- `npm run ci`: 38テスト、build、validation成功。3,674 active / 3,682 total、172 source pages、警告0。
- 隔離再抽出で172 canonical rule filesとstable-ID registryがbyte単位で一致。
- [query評価](query-evaluation-after-search-snippet-edit.json): 固定12ケースと重点12項目が成功。11件の個別条件確認とquery結果の全field保持を確認。
- HEAD `8ab19dc` 基準の標準差分は累計追加1、statement変更10、削除0、規範強度変更0。今回のstatement変更はSearching0002、Edit menus0007 / 0011 / 0012の4件。条件・priority等の変更は各ledgerを参照。
- `git diff --check`: 成功。今回のtrace / sentence evidenceに含む150断片はすべて19語以下。

今回の実行は12ページ / 261ルール完了。9月6日のNotificationsを含め、当初の変更候補35ページのうち13ページが完了し、残り22ページ / 672ルール。次候補はPath controls1件・Rating indicators2件・Focus and selection16件の19件。[最新queue](remaining-review-queue.json)を参照。

Searching個別APIのplatform別可用性、SnippetsのSDK/runtime別表示制約、リンク先資料、画像・media、旧本文の厳密な全文差分は未確認。共通使用率は開始baseline7%、このbatch開始10%、検証後11%。コミット・pushは行っていない。
