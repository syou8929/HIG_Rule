# Multitasking・App Shortcuts の差分レビュー

2026-09-08の再開依頼後、[Multitasking](https://developer.apple.com/design/human-interface-guidelines/multitasking)17件と[App Shortcuts](https://developer.apple.com/design/human-interface-guidelines/app-shortcuts)20件を意味照合した。主担当がMultitasking、補助担当1名がApp Shortcutsをsection単位で確認し、主担当はApp Shortcutsの支持段落も独立に確認した。

37既存ルールのうち29件でscope・条件・priority・statement等を補正した。別途、Multitasking0006の根拠trace1件を明示的に移行。ID・規範強度は維持し、追加・削除はない。既存MUST12件も支持本文を確認した。

## Multitasking

- 0004・0007・0008・0009・0014・0017: 利用者が開始した再生・作業・復帰contextを守る指針をpriority3へ。一般的なbackground処理すべてを義務化していない。
- 0005: audioがduckするのは起こり得るsystem behaviorであり、独自実装の必須動作ではない。視線移動というtriggerをgazeへ分類し、Now Playing例外を保持。
- 0008: 注意・参加を要するactivityの条件を明示。ゲームやmedia appは例示。
- 0010: 通知のMAYに、利用者が重要・時間依存のtaskを開始してから別appへ切り替えた文脈を補完。
- 0011: 戻った時にtaskを確認できるようにするのは代替手段であり、不要な通知を許す例外ではないためconditionsへ移動。

0006の旧sentence hashは、DOM行にも同sectionの連続1〜3文にも一致しなかった。[初期証拠](multitasking-trace-evidence.json)の未一致を保持し、現行概要の例外付き要件を意味レビューしたうえで[再trace証拠](multitasking-retraced-evidence.json)を保存した。旧全文との差分や不一致の原因は未確認であり、旧hashが現在も一致すると報告していない。

候補の正規化textとrule IDは保持。stable-ID registryに新traceから0006へのaliasを1件追加し、旧aliasも残した。17候補は旧trace一致、1候補は再trace後に現行根拠と一致する。詳細は[Multitasking ledger](multitasking-review.json)。

## App Shortcuts

- 全20件: App Shortcutsとkeyboard shortcutsの混同によるkeyboard modalityを除去。keyboard tagも除去し、0003・0006・0017は音声専用、他は入力方法を限定しない。
- 0005・0016: 音声のみ／画面を見られない場面への対応をaccessibility priority2へ。0003・0006は発話と記憶の制約としてinput priority5へ。
- 0001・0002・0003・0004・0005・0006・0008・0012: 不自然な日英文・定型文を、直接的なrule statementへ修正。本文にない曖昧な適用条件は除去。
- 0005・0006・0008: 内部の別ruleへの参照を実際の条件へ置換。0007のschema対象外featureへの適性は、採用義務でなく利用可能な選択肢として記述。
- 0009: 同日レビュー済みSnippetsの明示的非対応platformと、App ShortcutsのmacOS非対応を併用し、snippet応答のscopeをiOS / iPadOSに限定。これはcross-page制約であり、App Shortcuts全般のwatchOS / visionOS対応を除外するものではない。
- 1action以上、10shortcuts以下、optional parameter最大1、起動phrase内app名、title case・plural、SF Symbolまたはpreviewという要件は維持。

24候補すべてが旧hash/sectionと一致した。[App Shortcuts ledger](app-shortcuts-review.json)に全ID・変更前後を記録。0009の補助根拠は[Snippets review](snippets-review.json)と[trace evidence](snippets-trace-evidence.json)。追加のページ取得は行っていない。

## 検証・未確認

- `npm run ci`: 38テスト、build、validation成功。3,674 active / 3,682 total、172 source pages、警告0。
- 隔離再抽出: 172 rule filesがbyte一致。ID-mapの最初のbyte差分は新aliasのキー順のみで、意味差分0。抽出器と同じ順へ整形後はregistryもbyte一致。
- [query評価](query-evaluation-after-multitasking-shortcuts.json): 固定12ケース・重点12項目が成功。0006の旧・新ID alias、Snippetsとのplatform共通部分も確認。
- HEAD `8ab19dc` 基準の標準差分は累計追加1、statement変更20、削除0、規範強度変更0。今回追加された8件のstatement差分はApp Shortcutsの明確化。その他の修正とtrace移行は各ledgerを参照。
- `git diff --check`: 成功。

全ページ本文は保存していない。個別SDK/APIのplatform別可用性、Live Activity/app schema実装条件、実機動作、media、旧全文の厳密な差分は未確認。

再開後2ページ / 37ルール、同日合計17ページ / 317ルール完了。残り17ページ / 616ルール。次候補はOnboarding20件・Outline views22件の計42件。再開分の使用率は開始0%、CI後1%。前回実行のbaseline7%・12%停止記録とは分離して保持している。
