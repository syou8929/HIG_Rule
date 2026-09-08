# Playing video の差分レビュー記録

2026-09-08 JSTに[Apple HIG Playing video](https://developer.apple.com/design/human-interface-guidelines/playing-video)の既存40ルールを再レビューした。43候補すべてのhash・section pathが現行本文と一致し、ID・規範強度を維持した。追加・削除はない。再確認で見つかった正規化の誤りを、priorityだけの補正を含め24ルールで修正した。

## 主な修正

| ID末尾 | 修正内容 |
|---|---|
| 0009 | 複数profile対応という条件を明示。再生requestにprofile指定があれば切り替え、指定がなければ再生前に利用者へ選択を求める。MUSTは維持。 |
| 0011 | 読み込みが「2秒を超える場合」の代替画面を、強制ではなくconsiderとして保持。「約」を除去。 |
| 0013 | detail viewがあればresume操作付きで表示し、なければ対象contentのmenuまたはmain menuを使う条件に修正。 |
| 0014 | 終了画面を準備する契機を、誤ったexit notificationからplayback notificationへ訂正。 |
| 0016 | overlayの最低0.5秒とpause・displayの両方を保持。「約」や「どちらか一方」を除去。遅延の起算点は推定しない。 |
| 0018 | 「警告だけでは不十分」という推論を独立した禁止事項として扱わず、明示された開始の選択と予期しない没入の回避をconditionsへ記録。誤解を招くexceptionsを除去。 |
| 0019・0022・0023 | 160 px幅のthumbnail、30秒以下の推奨clip長、160 kbps / 64 kbpsなど、公式の推奨値から不必要な「約」を除去。SHOULDは維持。 |
| 0021 | RealityKitのSHOULDをsplash / transitional viewに限定。任意のspecial effect利用や自動aspect-ratio処理・caption対応を追加義務にしない。 |
| 0024 | watchOS movie elementの操作分類を、誤ったgazeから本文にあるtouchへ変更。tagsにも反映。 |
| 0029 | additional metadataの適用範囲を、支持段落に明記されたiOS・iPadOS・tvOS・visionOSへ揃える。 |
| 0037 | 遮らない対象をvideo画像全体ではなく、没入再生時のplayback / transport controlsへ修正。 |

接頭辞は `HIG-PATTERNS-PLAYING-VIDEO-`。さらに、すでにtvOS固有scopeへレビュー済みの14件はpriorityを6から4へ、利用者による再生開始の選択を保つ0018・0034は4から3へ補正した。プラットフォーム固有の条件をApple共通条件より先に扱うための整合性修正で、規範強度の引き上げではない。

statementが変わったのは0014・0021・0037。その他の差分は条件・例外・scope・tags・priorityなどであり、標準rule差分だけでは全補正を表示しない。[review ledger](playing-video-review.json)が全24件の変更前後と判断根拠を保持している。

## 根拠の確認範囲

主担当がoverview、Best practices、TV app integration、loading / exit flow、resource navigationを確認した。1名の補助担当がtvOS・visionOS・watchOSの18ルールを独立確認し、主担当も指摘された数値・条件・能力説明を支持段落まで確認した。

ページを2回描画して同じhashを確認。[source evidence](playing-video-trace-evidence.json)に43候補の一致、段落や表のhash、各19語以下の断片を保存した。watchOSの表はH.264 High Profile、160 kbps、最大30 fps、portrait 208×260 px、landscape 320×180 px、HE-AAC 64 kbpsとして確認した。数値が明確でも、元の推奨をMUSTへ変換していない。

旧候補の根拠がすべて残っているため、今回の補正はAppleが新しい義務を追加したという判断ではない。page hashの差だけでレビュー判断を付け替えたものでもない。

## 検証

- 隔離再抽出で3,674 active rulesを再現し、canonical rule files 172件とstable-ID registryが作業ツリーにbyte単位で一致。
- `npm run ci`: 38テスト成功、build / validation成功、3,682 total rules / 172 source pages、警告0。
- [固定query評価12ケース](query-evaluation-after-video.json)で、集合・条件・例外・source trace保持を確認。
- `git diff --check`: 成功。
- HEAD `8ab19dc` 基準の標準差分を再生成。累計でNotifications追加1件、statement変更4件（Haptics0016とVideo0014・0021・0037）、削除0、規範強度変更0。これらのstatement変更は各監査記録で再レビュー済み。

## 残件と留保

今回の実行ではPlaying audio・Playing haptics・Playing videoの125ルールを再確認した。9月6日のNotifications完了分を含め、当初の変更候補35ページのうち4ページが完了し、残りは31ページ・808既存ルール。[最新queue](remaining-review-queue.json)を参照。

0.5秒の遅延の厳密な起算点、TV app integrationの既存tvOS scope以外での利用可否、画像の意味、media demo、リンク先API文書は未検証。これらを今回のレビューから推定しない。旧本文全文を保存していないため、正確な全文差分も復元できない。

アカウント共有7日枠は全実行の開始時7%、このbatchの開始・検証後は9%。遅延や丸めを含む表示で、個別のトークン消費量ではない。
