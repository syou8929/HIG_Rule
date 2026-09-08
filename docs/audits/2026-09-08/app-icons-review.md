# App icons の差分レビュー

2026-09-08 JSTに[App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)の40既存ルールを再レビューした。主担当がLayer design・Icon shape・Designの21件、補助担当1名が残り19件を担当し、主担当が最終修正と仕様表を再確認した。

33件を補正し、ID・規範強度を維持。MUST6件（0021・0022・0029・0031・0032・0035）を支持。追加・削除なし。

## 主な修正

- Icon Composer import専用の0003・0023・0024をiOS/iPadOS/macOS/watchOSへ限定。共通の背景・opacity・grouping指針は広いscopeを保ち、ツール固有の補足だけ対象platformを明示。
- default/dark/clear/tintedの外観指針をiOS/iPadOS/macOSへ限定。alternate iconsのvisionOS適用はcompatible appsのみという条件を復元。
- 可読性・背景との識別をaccessibility priority、個人のalternate選択をexplicit-intent priority、仕様値やsystem maskingをplatform priorityへ。
- visionOSの凹形状に関する0017から、根拠のないgaze分類を除去。
- 0019のDisplay P3を任意で利用できる色空間として記述。groupingの適合条件、custom effectsの意図的な利用と慎重なテスト、背景やPNGの条件を修正。
- 0009は前回の明示的AVOID判断を維持し、Appleが述べる著作権理由をlegal priorityに反映。独自の法的判断や強度引上げはしていない。

## 仕様表への明示的な再trace

旧43候補のうち39件はDOM一致。0037–0040に対応する4候補は、旧hashが仕様表から作った要約文に対応しており、原文の文単位hashとして一致しなかった。これを原文一致と偽らず、platform別のlayout・数値・mask・style・appearanceを確認して、現行Specifications表row74のDOM hashへ明示的に再traceした。

候補のパラフレーズと4つのIDは維持。同じ表を根拠にする別々のatomic ruleを抽出器のduplicate-key規約で区別し、新alias4件を追加、旧aliasも保持した。[元の未一致証跡](app-icons-trace-evidence.json)と[再trace後の証跡](app-icons-retraced-evidence.json)を分けて保存。再trace後は43候補すべて一致する。

## 根拠と検証

[ledger](app-icons-review.json)に全ID・変更前後・旧trace・新trace・判断・aliasを保存。

- `npm run ci`: 38テスト、build、validation成功。3,674 active / 3,682 total、172 source pages、警告0。
- 隔離再抽出で172 rule filesとstable-ID registryがbyte一致。今回追加した4aliasでIDを維持することも確認。
- [query評価](query-evaluation-after-app-icons.json): 固定12ケース・重点8項目が成功。旧alias保持・新aliasの一意性・明示trace移行も検証。
- HEAD基準標準差分は累計追加1、statement変更60、削除0、規範強度変更0。`git diff --check`成功。
- 通常証拠・再trace証拠・追加候補記録の282断片は19語以下。原文全文やmediaは保存していない。

## 未完了の追加候補

[alternate iconsの追加検討記録](app-icons-alternate-followups.json)を最新queueにも反映した。

1. iOS/iPadOSのalternate iconごとにdark/clear/tinted variantsが必要という要件は未収録。追加MUST候補として別batchで採番・実装を検討する。すべて手作業で描く義務には拡大しない。
2. 全alternate/variant iconのapp review・Guidelines遵守は、現0015のMAY条件に部分的に重なる。独立atomic ruleにするか未確定で、重複・scope審査待ち。

既存Tab bars候補と合わせ、未収録確認済み2件＋atomicity審査1件。今回の40既存ルールの再検証とは区別する。

再開後11ページ / 278ルール、同日合計26ページ / 558ルールを検証まで完了。残り8ページ / 375既存ルール。次はApple Pay43件。使用率が開始0%から5%に達したため、次batchを開始せず停止記録を保存した。

SDK・ツールavailability・実機描画・mediaは未確認。全HIGの鮮度確認完了やHIG適合は主張しない。コミット・pushはしていない。
