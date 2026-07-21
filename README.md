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

`AGENTS.md`、`CLAUDE.md`、`GEMINI.md`、`.github/copilot-instructions.md`、`.cursor/rules/apple-hig.mdc`もcanonical rulesから再生成します。生成ファイルを直接修正せず、storeまたはgeneratorを更新してください。

## Rule retrieval

全ルールを毎回コンテキストへ投入せず、必要なサブセットを取得します。

```sh
npm run query -- --platform ios --category components --component buttons --limit 20
npm run query -- --platform macos --category inputs --task keyboard --format markdown
npm run query -- --platform visionos --modality gaze --confidence low --limit 20
npm run query -- --category foundations --task accessibility --normative MUST
```

検索結果にはrule ID、normative level、confidence、対象範囲、公式source traceが含まれます。

## AI runtime

AIは対象プラットフォーム、デバイス、入力方式、主要タスクを特定し、アクセシビリティとプライバシーを先に確認します。その後、プラットフォーム固有ルール、コンポーネント、パターン、空・読み込み中・エラー・権限拒否・オフライン状態をレビューします。HIG適合を保証する権威として振る舞わず、確認した根拠、例外、競合、未確認事項を提示します。

## Coverage report

[coverage JSON](dist/reports/coverage.json)には、発見・取得・分類・rules抽出済みページ数、rule総数、カテゴリ・プラットフォーム・規範強度・testability別集計、blockedページ、rules未生成ページ、low-confidence rule、人間レビュー対象を収録します。完了率だけで網羅性を主張しません。

## Updating the HIG snapshot

差分確認はcanonical storeを書き換えません。

```sh
npm run check-updates
```

結果は`dist/reports/update-diff.json`と`update-diff.md`へ出力され、新規・削除・本文hash変更ページ、影響rule、review queueを示します。更新を取り込む場合は`npm run sync`を実行し、既存IDをregistryで維持します。消えたcandidateは即時削除せずdeprecated ruleとして保持します。

`npm run sync`は実行前のactive ruleを最小スナップショットへ退避し、同期後に`dist/reports/rule-update-diff.json`と`rule-update-diff.md`を生成します。IDが変わった近似replacementも同一source section内で照合し、規範強度の変更をreview queueへ送ります。一時スナップショットは差分生成後に削除されます。

## Known limitations

- 自動抽出は公式文脈を完全には解釈できないため、多くのルールが人間レビュー対象です。
- 数値表、動画、画像内の意味、複雑な例外、複数段落にまたがる条件は手動レビューが必要です。
- Appleのページ構造変更によりselectorが壊れた場合、ページを`blocked`として理由付きで記録します。
- Webや他プラットフォームへ応用する際は`portability`と`portable_interpretation`を確認し、Apple固有コンポーネント名を必須要件として転用しないでください。

## License and source policy

コードとプロジェクト独自の正規化は[LICENSE](LICENSE)を参照してください。一次情報は[Apple公式HIG](https://developer.apple.com/design/human-interface-guidelines)だけを使用します。Appleの権利物は再配布しません。
