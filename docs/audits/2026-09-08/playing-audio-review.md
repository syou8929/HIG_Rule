# Playing audio の差分レビュー記録

2026-09-08 JSTに既存42ルールをApple公式本文と再照合し、出典の鮮度を更新した。45候補すべてを保持し、ルールの追加・削除、ID・statement・規範強度・条件・例外の変更はない。プライバシーに関わる3ルールの conflict priority だけを6から3に補正した。active rulesは3,674件のまま。

## 根拠と判断

[Apple HIG Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio)を描画し、アクセシビリティ、プライバシー、overview、best practices（5行のaudio category表を含む）、interruptions、全platform section、resource navigationを順に確認した。MUSTの0006・0019・0032・0038は、現行本文の明示的な必須表現と条件に支持されている。任意表現や期待動作を新たにMUSTへ引き上げていない。

| ID末尾 | 維持した規範強度 | 優先度を補正した理由 |
|---|---|---|
| 0038 | MUST | 内蔵マイク使用中にSmart Folioを閉じた場合のVoIP通話終了は、マイクのプライバシーに関わる。 |
| 0039 | AVOID | 利用者に知らせずマイクを再有効化するリスクへの対処。 |
| 0041 | SHOULD | ヘッドホン切断時の即時pauseは、私的な聴取内容が外へ流れることを防ぐ。 |

IDの接頭辞は `HIG-PATTERNS-PLAYING-AUDIO-`。`src/config/source-review.json` の個別overrideにも優先度を保存し、再抽出後も維持する。一般的なaudio guidance全体をprivacy分類へ変更したわけではない。

2回の描画で同じページhashを確認し、全45候補のhashとsection pathが現行本文と一致した。初回の簡易照合では見出しレベルの空きによりResources内の候補を1件誤って未一致としたが、取り込みと同じ階層処理で存在を確認したため削除していない。

取得日時、旧／新hash、19語以下の証拠断片、候補照合結果は[trace evidence](playing-audio-trace-evidence.json)、42件の判断・変更前の優先度・旧batch metadataは[review ledger](playing-audio-review.json)に記録した。ページhashの変更だけを根拠にレビュー判断を付け替えたものではない。

## 検証

- 隔離コピーで再抽出し、canonical rule files 172件が作業ツリーとbyte単位で一致。stable-ID registryも変更なし。
- `npm run ci`: 37テスト成功、build成功、3,682 rules / 172 source pagesのvalidation成功、警告0。
- 検索CLIの固定12ケースで取得集合・条件・例外・source traceの保持を再確認。[評価JSON](query-evaluation.json)
- `git diff --check`: 成功。

今回追加した単一ページ照合ツールは、原文全文を保存せず、見出し階層・入れ子の行・既存candidateの根拠を確認する。evidenceの出力先は `.cache/` または `docs/audits/` 配下の新規JSONに限定し、既存ファイルやsymlink経由の上書きを拒否する。hash一致は存在確認であり、意味的なレビュー完了とは別に扱う。

## 残件と限界

このbatch終了時点では、9月6日の35変更候補ページのうちNotificationsとPlaying audioが完了し、残りは33ページ・891既存ルールだった。後続batchを含む[最新queue](remaining-review-queue.json)を参照。これは変更hashに基づく候補数であり、要修正ルール数ではない。

原文全文を保存していないため旧ページとの厳密な全文差分は復元できない。画像、動画、リンク先のdeveloper API documentation、他のHIGページは今回の確認範囲外。全HIGの最新化やプロダクトの適合認証を意味しない。

実行開始のアカウント共有7日枠使用率は7%、このbatchの検証後は8%。丸めや反映遅延を含み、個別のトークン消費量ではない。開始から5ポイント増加する12%を次batchの停止境界として継続する。
