# Playing haptics の差分レビュー記録

2026-09-08 JSTに43ルールを現行の[Apple HIG Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)と照合した。49候補すべての根拠を確認し、ID・source sentence hash・規範強度・例外を保持した。Digital Crownの1件を明確化し、アクセシビリティと利用者の明示的な選択に関わる2件の優先度を補正した。ルールの追加・削除はない。

## 変更と根拠

| ID末尾 | 変更 | 理由 |
|---|---|---|
| 0005 | priority 6 → 3 | 触覚をオフ・ミュートできることは、利用者の明示的な選択に関わる。SHOULDを維持。 |
| 0033 | priority 6 → 2 | 触覚を利用・知覚できない場合も体験を成立させるアクセシビリティ要件。明示的なmake-sureのMUSTを維持。 |
| 0016 | statement・title・conditionsと関連checkを明確化 | linearな反応はシステムの既定動作であり、table viewなどの項目単位の反応を置き換える命令ではない。両方の動作を考慮する文言に変更し、SHOULDを維持。 |

接頭辞は `HIG-PATTERNS-PLAYING-HAPTICS-`。変更はsource-bound overrideへ保存し、canonical storeから生成物へ反映した。もう1件のMUST（0034: 振動によるcamera・gyroscope・microphone体験への妨害を防ぐ）も現行のEnsure表現で確認した。

## 出典確認

共通Best practicesの14件、overview、Custom haptics、resource navigationは主担当が確認。iOS・macOS・watchOSの29件は1名の独立補助担当が同じ公式ページで確認し、Digital Crownの表現は主担当も支持段落まで確認した。Custom hapticsの説明を新たな必須ルールへ変換していない。

初回の照合では、iOSの9パターン（0035〜0043）の根拠が未一致だった。実際の根拠は `figcaption` にあり、画像ではなくキャプションのテキストを取得すると、9件すべての既存hash・section pathが一致した。照合ツールへtext-only caption対応と回帰テストを追加した。画像・音声・振動デモの保存や再生はしていない。

最終の2回描画は同じページhashで、49/49候補を確認。[caption対応後の証拠](playing-haptics-caption-trace-evidence.json)を正とし、[初回の不完全な照合](playing-haptics-trace-evidence.json)は検出経緯として保持する。証拠断片は各19語以下。[review ledger](playing-haptics-review.json)に43件の確認ID、旧hash、変更前後の値、検証結果を記録した。

## 再現性と検証

- 隔離再抽出の最初の試行で、candidateの変更語句 `Account for` が字句フィルターにより除外される問題を検出。candidateの導入語を同義の `Recognize` へ調整し、正本の明確化したstatementはsource-bound overrideで維持した。作業ツリーのルールは削除していない。
- 修正後に再抽出し、canonical rule files 172件とstable-ID registryが作業ツリーにbyte単位で一致。activeは3,674件。
- `npm run ci`: 38テスト成功、build / validation成功、3,682 total rules / 172 source pages、警告0。
- [固定query評価12ケース](query-evaluation-after-haptics.json)で、集合・条件・例外・出典情報の保持を確認。
- HEAD `8ab19dc` を基準にrule差分を再生成。9月6日分のNotifications追加1件、今回のstatement明確化1件、削除・deprecated化0、規範強度変更0。priority差分は標準差分の対象外なので各ledgerに記録。

標準差分のreview queueに出る0016は、この記録で現行本文との意味レビューを済ませた変更である。その他の鮮度未確認ページをレビュー済みと扱っていない。

## 残件

このbatch終了時点で、9月6日の変更候補35ページのうちNotifications・Playing audio・Playing hapticsが完了。残り32ページ / 848既存ルール。次はPlaying videoの40件。[最新queue](remaining-review-queue.json)を参照。

0011と0043は、段落とキャプションを出典とするSelection guidanceに意味の重なりがある。今回の鮮度更新ではIDを維持し、将来の重複レビュー候補として残す。

旧ページ全文との厳密な差分、画像の意味、振動・音声デモ、リンク先API文書、他ページの鮮度は未検証。アカウント共有7日枠は実行開始7%、このbatch後8%の表示で、正確なトークン消費量ではない。
