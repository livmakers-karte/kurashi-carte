# 暮らしのカルテ / 洗濯・水回りの悩み診断（kurashi-carte.jp）

暮らし・住まいの水環境を「数値で診る」無料診断メディア。母屋（総合ハブ）＋洗濯・水回り診断（第1弾）。
マグちゃん（magchan.com／マグネシウムを使った洗濯・食器・お風呂の暮らし用品）の**3層キャッシュマシン**を
1診断から同時に回す設計：

1. **フロー収益**：診断 → タイプ別マグちゃん定期購入（LTV）。既存の定期コース／消耗品リピートへ接続。
2. **データ資産**：洗剤の悩み・肌トラブル・部屋干し環境の分布を蓄積。独自指標「暮らしの水環境スコア／洗剤過敏度」を発行しGEO被引用の対象に。
3. **換金可能資産**：ドメイン＋リポジトリ＋会員DB＝切り離して売却可能なD2C事業単位（名義・データを綺麗に保つ）。

> 「比較しない・並べない・本人の数字を発行する」が核。押し売りせず、暮らしを継続的に見守るトーン。

---

## 1. ディレクトリ構成
```
/
├─ index.html                # 母屋トップ（暮らし・住まいの総合メディアハブ、config駆動で診断を増設）
├─ sentaku/
│  ├─ index.html             # 洗濯・水回り診断本体（GEO直接回答／7問／カルテ発行／オファー／FAQ）
│  ├─ app.js                 # 診断エンジン（判定・スコア・カルテ・GAS送信）
│  ├─ thanks.html            # 送信後の再診断案内・LINE・回遊（LTV延伸）
│  └─ thanks.js
├─ mizu-kankyo-score/index.html  # 独自指標の定義・算出の解説（GEO一次引用ページ）
├─ assets/                   # オリジナルSVG（ヒーロー/OGP/4タイプ/透かし/favicon）＋ style.css / guard.js
│  └─ photos/                # 写真を後差替する場合の置き場（初期は空）
├─ js/home.js                # 母屋の描画
├─ images.css                # 画像スロット（写真の後差替はこの1ファイル）
├─ config.json               # 全設定（母屋一覧/診断係数/製品URL/LINE/再診断/免責/GAS/Turnstile/画像）
├─ gas/receiver.gs           # フォーム受信レシーバ（Turnstile検証・シート蓄積・通知）
├─ sitemap.xml / robots.txt / llms.txt
├─ .htaccess / _headers      # Apache / Cloudflare・Netlify 用セキュリティヘッダ（GitHub Pagesでは無効）
├─ .nojekyll
└─ CNAME                     # kurashi-carte.jp（※既存ドメイン運用を壊さない。DNSはGitHub Pagesへ）
```

## 2. 公開前チェックリスト（BOSS宿題＝config.json の `__◯◯__` を実値へ）
`config.json` を開き、以下を差し替えるだけで本番接続できます（コードは触らない）。

| 置換トークン | 意味 | 取得先 |
|---|---|---|
| `gas.endpoint` = `__GAS_EXEC_URL__` | フォーム送信先 | GASウェブアプリの /exec URL（§5） |
| `turnstile.sitekey` = `__TURNSTILE_SITEKEY__` | bot対策 | Cloudflare Turnstile サイトキー |
| `line.url` = `__LINE_FRIEND_URL__` | LINE友だち追加 | マグちゃん公式LINE |
| `products.*.productUrl / subscribeUrl` = `__MAGCHAN_URL_*__` | 商品・定期コース | magchan.com の各商品ページ／定期URL |
| `cross[].url` = `__APROS_URL__` | 回遊（Apros等） | 各グループ商品の実URL |

※未設定のままでも画面は動作します（フォームは疑似完了、外部リンクはブランドトップにフォールバック）。

## 3. 診断ロジックの根拠（app.js × config.json）
- **入力**：洗濯頻度／室内干し／洗剤・柔軟剤の使い方／肌トラブル（家族・赤ちゃん）／洗濯槽の臭い・カビ／食器・水回り／お風呂 の7問。
- **4方向の集計**：各選択肢に `w`（重み）を持たせ、`roomdry(部屋干し・洗浄)／baby(敏感肌・赤ちゃん)／kitchen(食器・水回り)／bath(肌・お風呂)` に加点。各軸を「軸の最大値」で正規化し、最大の軸を**主タイプ**に判定。2位が僅差（`complex_threshold` 以内かつ `complex_min` 以上）なら**複合タイプ**として併用提案（客単価最大化）。
- **暮らしの水環境スコア（0〜100）**：`95 −（悩みの合計 ÷ 最大27）× 65`、四捨五入し 30〜95 に収める。高いほど水環境が整っている目安。不安をあおらないよう下限30。
- **洗剤過敏度**：`sensitivity` 軸を0〜100%換算し 低め／中くらい／高め にバンド化。
- すべて**ブラウザ内計算**で完結（外部API・継続課金ゼロ）。係数は `config.json` の `diagnosis` を編集すれば調整可能。
- ※本診断は**傾向の目安**であり、医療診断・特定商品の効果を保証しない旨をUI・カルテ・本READMEに明記。

## 4. タイプ → マグちゃん接続表
| 水環境タイプ | 接続製品（config: products.*） | 定期 |
|---|---|---|
| 部屋干し臭・洗浄不足 | 洗たくマグちゃん／ランドリー系 | らくトク便（定期） |
| 敏感肌・赤ちゃん | ベビー・敏感肌向けライン | 〃 |
| 食器・水回り | キッチン・食器系アイテム | 〃 |
| 肌・お風呂 | バス・お風呂系アイテム | 〃 |
| 複合型 | 上記2ラインの併用提案 | 〃 |

**LTV延伸導線**（thanks.html／結果票に実装）：
- 約3ヶ月後の**無料再診断**案内（`diagnosis.reexam` でタイミング・文言を調整）＝「暮らしの変化」を可視化＝継続動機。
- 購入者にも**LINE友だち登録**を強く促し、経過チェック再診断・**消耗品交換のタイミング**をLINE／メールで案内（`line` / `consumable`）。
- 初回カルテは**印刷／画像保存**で控える設計（localStorage不使用）。再診断で前回スコアと比較。
- 別ライン追加・Apros・からだのカルテへの**回遊**（`cross`）。

## 5. GAS（フォーム受信）デプロイ手順
1. スプレッドシートを新規作成 → URL の `/d/ ～ /edit` 間の ID を控える。
2. [script.google.com](https://script.google.com) で新規プロジェクト → `gas/receiver.gs` の中身を貼り付け。
3. **プロジェクトの設定 → スクリプト プロパティ** に4つを登録（**HTMLには絶対に書かない**）：
   - `NOTIFY_TO`：通知先メール（**グループ共有アドレス。個人アドレス不可**）
   - `SHEET_ID`：上記スプレッドシートID
   - `TURNSTILE_SECRET`：Cloudflare Turnstile のシークレットキー
   - `ALLOWED_HOSTS`：`kurashi-carte.jp,www.kurashi-carte.jp`
4. デプロイ → **ウェブアプリ**／実行するユーザー=自分／アクセスできるユーザー=全員。
5. 発行された **/exec URL** を `config.json` の `gas.endpoint` に設定。
- サーバー側で honeypot・最短送信時間・ALLOWED_HOSTS・Turnstile を多層検査。外部LLMは呼ばない（課金ゼロ）。

## 6. セキュリティ（過去監査の教訓を反映）
- **個人メール・APIキー・秘密情報をHTMLに一切露出しない**（Formspree断裂・Web3Forms APIキー露出・個人メール露出の再発防止）。宛先メールは**GASスクリプトプロパティに隔離**。
- **Cloudflare Turnstile**（sitekey=config、secret=GAS側）＋ honeypot＋最短送信時間で bot/スパム除去。
- **画像は全てローカル同梱**（オリジナルSVG）。外部ホットリンク禁止（誤写真・著作権の教訓）。
- 各HTMLに **meta CSP ＋ frame-busting(JS)**（GitHub Pagesはヘッダ不可のため）。Apache/CF移設時は `.htaccess`/`_headers` が有効化。
- 送信先は **GAS /exec のみ**。`connect-src` / `form-action` を GAS ドメインに限定。
- 公開前は全ページ `meta robots=noindex`。公開時に `index,follow` へ切替（=公開ボタン）。

## 7. 景表法・薬機法（厳守）
- 洗浄・消臭・除菌の効果を**断定・誇大にしない**。マグネシウム洗濯は**体感・実証範囲の目安**に留める。
- 「洗剤の代わり」等は断定せず「〜な方に選ばれています」等の**体験ベース表現**。
- 肌へのやさしさも効果保証しない。診断は**傾向の目安であり医療診断でない**旨を明示。
- 文言は `config.json` の `disclaimer` / 各 `guard` に集約。UI・カルテ・本READMEに免責を徹底。

## 8. 生成画像・写真の差し替え方法
- 初期は `assets/` の**オリジナルSVG**（ヒーロー／OGP診断票／4タイプ／透かし／favicon）。
- 写真を使う場合は **`assets/photos/` にローカル同梱**し、**`images.css` の変数（`--photo-*`）のファイル名を差し替えるだけ**。外部URLのホットリンクは禁止。
- OGP画像を写真版にする場合は `assets/ogp.svg` を差し替え、各HTMLの `og:image` パスを合わせる（PNG推奨なら `ogp.png` を追加して参照）。
- 景表法：**before/after・「汚れが落ちた風」の演出写真は使わない**。清潔な洗濯・やさしい水・自然光・赤ちゃん・暮らしのムードのみ。

## 9. 公開／デプロイ（GitHub Pages）
1. `livmakers-karte/kurashi-carte` リポジトリ（未作成なら作成）へ push。
2. Settings → Pages → Source=main、Custom domain=`kurashi-carte.jp`（**CNAMEファイルは新規作成のみ。既存ドメイン運用を壊さない**）。
3. DNS を GitHub Pages へ（A/AAAA もしくは CNAME）。HTTPS 強制を有効化。
4. `noindex` のまま表示確認 → 問題なければ各HTMLの `robots` を `index,follow` に切替＋フォーム有効化（=公開）。
5. **Google Search Console** で所有権確認 → `sitemap.xml` を送信。
6. （任意）SPF/DKIM/DMARC を整備。

## 10. 姉妹サイトとの関係
- 構造（config駆動・GAS・インラインSVG・GEO/JSON-LD・noindex公開ゲート）は `karada-carte`（からだのカルテ）と共通。
- **視覚は完全別系統**：karada=深緑×印泥朱×明朝／kurashi=ディープティール×珊瑚×若葉ミント×丸ゴ＋水滴ゲージ＋まるシール。デザイン正典＝`design/design-tokens.md`。

---
*本サイトの内容は暮らしの傾向の目安であり、医療診断・治療・特定商品の効果を保証するものではありません。*
