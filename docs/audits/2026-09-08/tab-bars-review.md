# Tab bars の差分レビュー

2026-09-08 JSTに[Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)の29既存ルールを再レビューした。主担当がBest practices15件、補助担当1名がplatform14件を担当。

16件を補正し、ID・規範強度を維持。MUST3件（0002・0028・0029）を支持。追加・削除なし。

## 主な修正

- 0001: 内部のreview済みrule参照を、自己完結したtoolbar代替案へ。
- 0004: More-tab overflowをiOS/iPadOSに限定しplatform priorityへ。
- 0009・0028: 背景との見分けやlabel可読性をaccessibility priorityへ。
- 0010・0011・0014・0018: sidebar変換の任意性、addまたはremove、appへの適合、where availableを保持。0011のpersonal customizationはexplicit-intent priorityへ。
- 0012: tvOSのdefault scrolling、split-view時のpinning、Menuでのfocus復帰を区別しremote-control tagを補完。
- 0013・0015・0016・0025: sourceメタ説明を任意のtvOS customizationという実際の条件へ。
- 0023・0024: sidebarの「固定」という誤解を招く表現を除き、default tab数5以下は厳密な上限ではなく目標として記述。
- 0027・0028: gaze tag補完。0029は同日レビュー済みSidebars0010と同じplatform navigation invariantとしてpriority4を維持。

## 根拠と検証

[ledger](tab-bars-review.json)に全ID・変更前後・判断を保存。33候補すべてDOM hashとsectionが一致。[証跡](tab-bars-trace-evidence.json)は19語以下の断片のみで、原文全文・mediaは保存しない。

- `npm run ci`: 38テスト、build、validation成功。3,674 active / 3,682 total、172 source pages、警告0。
- 隔離再抽出で172 rule filesとstable-ID registryがbyte一致。
- [query評価](query-evaluation-after-tab-bars.json): 固定12ケース・重点6項目が成功。
- HEAD基準標準差分は累計追加1、statement変更35、削除0、規範強度変更0。`git diff --check`成功。

## 未収録候補

iOS sectionのrow25に、accessory付きtab barを下方向scroll時に任意で縮小し、accessoryをinlineへ移す選択肢がある。tabのtapまたはview最上部へのscrollで復帰する。既存33候補・正本への限定検索で対応するatomic ruleを見つけられなかった。

[追加候補の記録](tab-bars-ios-minimization-followup.json)にMAY候補として根拠・条件を保存し、最新queueにも追加した。旧本文にも存在したかは未確認で、新たに導入された機能とは主張しない。このbatchは29既存ルールの再検証であり、追加ruleの採番・実装は別の小batchで行う。

再開後9ページ / 207ルール、同日合計24ページ / 487ルールを検証まで完了。残り10ページ / 446既存ルールと、追加候補1件。次の既存レビューはMenus31件。再開分の使用率は開始0%、このbatch開始3%、検証後4%。

SDKやOSごとの実機動作、mediaは未確認。コミット・pushはしていない。
