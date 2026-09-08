# Apple HIG AI Rules

Apple Human Interface Guidelines（HIG）を、AIによるUI生成・デザインレビュー・実装レビューで検索・適用できるatomic ruleへ正規化する非公式プロジェクトです。Apple Inc.とは提携・承認関係にありません。

このリポジトリはHIG本文の複製ではありません。保存するのは公式ページのタイトル、canonical URL、セクション階層、対象プラットフォーム、取得日時、ハッシュ、独自要約、20語未満の短い候補句、独自に正規化したルールです。画像・動画・デザインリソース・長い本文は保存しません。

## Coverage

現行の公式ナビゲーションに従い、Getting started、Foundations、Patterns、Components、Inputs、Technologiesを処理します。対象プラットフォームはiOS、iPadOS、macOS、tvOS、visionOS、watchOS、CarPlayです。実測件数、blocked、ルール未生成ページ、low-confidence項目は[coverage report](dist/reports/coverage.md)に列挙します。

## Setup

Node.js 22以降とChromium互換ブラウザが必要です。macOSではGoogle Chromeを自動検出します。別の実行ファイルを使う場合は`HIG_CHROME_PATH`を設定してください。

```sh
npm install
```

## Discovery and ingestion

公式HIGをJavaScript描画後に再帰探索し、URLをcanonicalへ正規化します。

```sh
npm run discover
npm run ingest
```

`discover`はカテゴリページのグリッドを優先して分類を保持し、本文中のHIG関連リンクを補完します。`ingest`は本文を一時的に解析しますが、リポジトリへ全文を保存しません。処理状態は[src/sources/apple-hig/inventory.json](src/sources/apple-hig/inventory.json)で追跡できます。

## Extract, build, and validate

```sh
npm run extract
npm run build
npm run validate
npm run lint
npm test
```

一括実行は`npm run sync`、CI相当のローカル検証は`npm run ci`です。自動抽出は短い強調見出しをatomic candidateとして扱い、曖昧な規範強度を`low confidence`かつ`review_required`へ送ります。明示的な条件がない数値制約は生成しません。

## Canonical store and generated outputs

- `schemas/`: rule、source page、coverageのJSON Schema
- `src/sources/apple-hig/`: inventory、copyright-safe page records、coverage
- `src/rules/`: canonical rule store。カテゴリ・ページ単位のJSON
- `src/config/rule-id-map.json`: 更新時にrule IDを維持するregistry
- `dist/apple-hig-rules.json`: AI・ツール向けJSON
- `dist/apple-hig-rules.yaml`: YAML
- `dist/apple-hig-rules.md`: 人間向けMarkdown
- `dist/agents/`: 汎用、Codex、Claude Code、Gemini、Copilot、Cursor用アダプター
- `dist/checklists/`: デザイン、実装、アクセシビリティのレビューリスト
- `dist/reports/`: coverage、validation、更新差分

`dist/reports/normative-review.md`と`normative-review.json`には、MUST/MUST_NOTルールをApple公式のsection contextと照合した判断、atomicity修正、source hashを記録します。`dist/reports/duplicate-review.md`と`duplicate-review.json`には、同一statementの候補をsource URL、section、scope、hashで照合した結果を記録します。どちらもHIG適合証明ではありません。

`src/config/normative-review.json`は、レビュー済みsource inventoryのhashと永続的な補正を保持します。HIG更新によってinventory hashまたはMUST/MUST_NOT件数が変わった場合、buildは古いレビュー結果を流用せず、再レビューが必要であることをエラーで示します。

`src/config/duplicate-review.json`は、意図的に保持する文脈重複のrule ID、statement hash、source trace hash、判断理由を保持します。候補集合やsource traceが変わるとvalidationが失敗し、未レビューの新規候補は警告として残ります。

`src/config/source-review.json`は、MUST/MUST_NOT以外で公式本文や数値表まで確認したruleの補正、source trace、レビュー状態を保持します。個別補正に加え、同じ時点の公式page hashでまとめて照合したruleはbatchとして記録します。page本文が変わるとbatch traceのvalidationが失敗します。生成される`dist/reports/source-review.md`と`source-review.json`で判断を追跡できます。

`dist/reports/review-queue.md`と`review-queue.json`は、未レビューのcanonical ruleを競合優先順位、規範強度、カテゴリの順に並べ、次のbatchを先頭の公式ページ単位で提示します。`review_required: false`はsource-context上の分類レビューが完了したことだけを表し、プロダクト固有のデザインレビューが不要という意味ではありません。

`AGENTS.md`、`CLAUDE.md`、`GEMINI.md`、`.github/copilot-instructions.md`、`.cursor/rules/apple-hig.mdc`もcanonical rulesから再生成します。生成ファイルを直接修正せず、storeまたはgeneratorを更新してください。

## Rule retrieval

全ルールを毎回コンテキストへ投入せず、必要なサブセットを取得します。既定は10件までのcompact形式、出力はUTF-8で12,000 bytes以下です。件数とサイズだけ確認する場合は`--preflight`を付けます。

```sh
npm run --silent query -- --platform ios --category components --component buttons --preflight
npm run --silent query -- --platform ios --category components --component buttons --limit 10
npm run --silent query -- --platform macos --modality keyboard --task 'キーボード' --language ja
npm run --silent query -- --platform visionos --modality gaze --confidence low --limit 10
npm run --silent query -- --category foundations --task accessibility --normative MUST
npm run --silent query -- --help
```

**出力契約v2:** 従来のJSON配列から、`total`、`returned`、`has_more`、`next_offset`、`bytes`と`rules`を持つオブジェクトへ変更しました。既存の呼び出し側は配列を直接読む代わりに`.rules`を参照してください。既定形式もfull JSONからcompactへ変更しています。

compactはrule ID、規範強度、confidence、review状態、priority、scope、conditions、exceptions、出典を保持します。statementは`--language en|ja`で一言語を選択します。共通のページ情報は`sources`にまとめ、各ruleの`source.ref`から参照します。URL、ページ名、取得日時、ページhashはその表に、section path、sentence hash、短い証拠は各ruleに残ります。source IDは応答内だけで有効です。`--id`へ検索結果のIDを渡し、`--format json`を指定するとrationaleやchecksを含む全フィールドを取得できます。IDはカンマ区切りまたは`--id`の繰り返しで指定でき、存在しないactive IDはエラーになります。Markdownは候補一覧専用です。

フィルターはANDです。`--task`は英語・日本語のstatement、title、topic、subtopic、tagsをNFKC正規化して各検索語を部分一致で探します。語の区切りは空白や記号で、翻訳・形態素解析・意味検索は行いません。日本語だけの入力も検索条件になり、記号だけの入力はエラーです。`--device`は機器のscopeで絞ります。結果は競合優先順位、指定platformの対象範囲の狭さ、検索語の関連度、IDの順です。該当件数は全HIGの網羅性を表すものではなく、アクセシビリティやプライバシーは別途適切な範囲で確認します。

`--limit`は1〜50、`--max-bytes`は1,024〜32,000。full JSONの既定上限は32,000 bytesです。上限に入る完全なruleだけを返し、`has_more`がtrueなら、同じフィルター・並び順・source snapshotで`--offset`に`next_offset`を渡します。1件も入らない場合は終了コード2、`returned: 0`、`next_offset: null`と`minimum_required_bytes`を返します。上限内でbudgetを増やすか、そのruleをローカルで確認してください。0件検索と取得不能を区別し、途中のruleを飛ばしません。

`--preflight`は本文を返さず、総件数、上限適用前の候補ページサイズ`requested_bytes`、予定取得件数`projected_returned`、予定応答サイズ`projected_bytes`を返します。事前確認が成功すれば、予定取得件数0でも終了コード0です。`bytes`は応答自体のUTF-8実測値で改行を含み、token数ではありません。`npm run --silent`を使うとnpm自身のバナーを省けます。上限は検索応答に適用され、会話履歴・推論・ツール全体の消費を制御するものではありません。未知の引数、欠落値、不正な件数は終了コード1で拒否します。

## AI runtime

AIは対象プラットフォーム、デバイス、入力方式、主要タスクを特定し、アクセシビリティとプライバシーを先に確認します。その後、プラットフォーム固有ルール、コンポーネント、パターン、空・読み込み中・エラー・権限拒否・オフライン状態をレビューします。HIG適合を保証する権威として振る舞わず、確認した根拠、例外、競合、未確認事項を提示します。

## Coverage report

[coverage JSON](dist/reports/coverage.json)には、発見・取得・分類・rules抽出済みページ数、rule総数、カテゴリ・プラットフォーム・規範強度・testability別集計、blockedページ、rules未生成ページ、low-confidence rule、人間レビュー対象、数値表などrule化前のreference noteを収録します。完了率だけで網羅性を主張しません。

## Updating the HIG snapshot

差分確認はcanonical storeを書き換えません。

```sh
npm run check-updates
```

結果は`dist/reports/update-diff.json`と`update-diff.md`へ出力され、新規・削除・本文hash変更ページ、影響rule、review queueを示します。更新はまず隔離コピーで取り込み、candidate集合と公式本文のsource traceを照合してください。`npm run sync`は全件の取り込み・抽出を実行し、既存IDをregistryで維持しますが、手動補完したcandidateを自動的には引き継ぎません。消えたcandidateはdeprecated扱いになるため、本文に残る有効な規則まで廃止しないよう、レビュー後にcanonical storeへ反映します。

2026-09-06のNotificationsレビューでは、自動取り込み42候補に対して、既存の手動補完を含む49候補すべての根拠が現行本文に残っていました。これらを照合・保持し、新規1候補を追加しています。[レビュー記録](docs/audits/2026-09-06/notifications-review.md)と[9月6日時点の未確認候補](docs/audits/2026-09-06/remaining-review-queue.json)を参照してください。

2026-09-08、9月6日の差分対象35ページ・975既存ルールのレビューを完了しました。最後の継続作業では8ページ・375件を確認し、抽出漏れ68件を追加しています。[完了記録と留保](docs/maintenance-completion-2026-09-08.md)、[検証結果](docs/audits/2026-09-08/completion-verification.json)、[対象キュー](docs/audits/2026-09-08/remaining-review-queue.json)を参照してください。CI成功、対象キューの解消、全HIGの現在の鮮度は別の指標です。既存の`dist/reports/update-diff.*`は8月2日の履歴を保持しており、現在の未完了件数ではありません。

単一ページの既存候補は、正本やレビュー判断を書き換えずに照合できます。

```sh
npx tsx scripts/inspect-source.ts --slug playing-audio --output .cache/playing-audio-evidence.json
```

このコマンドは公式ページを2回描画し、本文hashの安定性と、候補ごとの正規化テキストhash・section pathの一致を確認します。保存先は既存の `.cache/` または `docs/audits/` 配下のディレクトリに置く新しいJSONファイルに限り、上書きやsymlink経由の出力は拒否します。保存する証拠断片は各19語以下で、原文全文は保存しません。未一致候補は明示し、本文hashが2回で異なる場合は終了コード2を返します。hashの一致は文章の存在確認であり、statement・規範強度・条件・例外の意味的な再レビューを代替しません。候補の自動削除や対象限定の取り込み・反映は行いません。

`npm run sync`は実行前のactive ruleを最小スナップショットへ退避し、同期後に`dist/reports/rule-update-diff.json`と`rule-update-diff.md`を生成します。IDが変わった近似replacementも同一source section内で照合し、規範強度の変更をreview queueへ送ります。一時スナップショットは差分生成後に削除されます。

## Known limitations

- 自動抽出は公式文脈を完全には解釈できないため、出力にはsource-contextレビューが必要です。現在の未レビュー件数は[coverage report](dist/reports/coverage.md)で確認してください。
- 数値表、動画、画像内の意味、複雑な例外、複数段落にまたがる条件は手動レビューが必要です。
- Appleのページ構造変更によりselectorが壊れた場合、ページを`blocked`として理由付きで記録します。
- Webや他プラットフォームへ応用する際は`portability`と`portable_interpretation`を確認し、Apple固有コンポーネント名を必須要件として転用しないでください。

## License and source policy

コードとプロジェクト独自の正規化は[LICENSE](LICENSE)を参照してください。一次情報は[Apple公式HIG](https://developer.apple.com/design/human-interface-guidelines)だけを使用します。Appleの権利物は再配布しません。
