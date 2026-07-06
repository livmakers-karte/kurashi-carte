# 住まいのダニ・アレルギー診断（kurashi-carte.jp/dani/）

> 住まいを部屋ごとに見立て、ダニの居どころを一枚の「住まいの健康診断票（ホームカルテ）」にし、
> **わが家のダニリスク指数**を“天気予報”のようにやさしく発行する独立サイト。
> 本サイトの内容はリスクの傾向・目安であり、医療診断・治療や、ダニの駆除・アレルギー症状の
> 改善を保証するものではありません。気になる症状は医療機関にご相談ください。

kurashi-carte.jp の**同一ドメイン下に置く「別物サイト」**として `/dani/` 配下で自己完結（BOSS指示 2026-07-06）。
母屋 `index.html`・root `config.json`・`sentaku/`・`mizu-kankyo-score/` 等は**別セッションが構築中の
「洗濯・水回り／水環境」サイトの領分**につき、本サイトは一切干渉しない。

## この事業の目的 ＝ 3層キャッシュマシン（設計の判断基準）
1. **フロー収益**：診断 → Apros ダニ取りシートの部屋別枚数“処方” → 定期便でLTV。ダニ取りシートは
   有効期限のある消耗品（約3か月目安）× 梅雨〜夏の季節性で、交換の必然性が商材から出る。
2. **データ資産**：地域別・住環境別のダニリスク分布（＝わが家のダニリスク指数）を蓄積し、
   固有指標として `/dani/shisuu/` でAIに一次ソース被引用させる。
3. **換金可能資産**：`/dani/` 一式＋会員DB＝切り離して売却可能なD2C事業単位。名義・データを綺麗に保つ。

## ファイル構成（すべて `/dani/` 配下）
```
dani/
├─ index.html        # 診断本体（この別物サイトのトップ）
├─ app.js            # 指数算出・タイプ判定・部屋別処方・予報カード描画（ブラウザ内のみ・外部API/課金なし）
├─ config.json       # 脳：文言・診断係数・部屋別枚数ロジック・指数バンド・季節・Apros URL・免責・GEO・指数解説
├─ thanks.html/.js   # 送信/購入後の再診断案内・回遊（初回スコア記録票／別部屋追加／グループ回遊／LINE）
├─ shisuu/index.html,shisuu.js  # 固有指標「わが家のダニリスク指数」の定義・解説（Article/FAQ）
├─ gas/receiver.gs   # フォーム受信バックエンド（Turnstile＋スクリプトプロパティ＋honeypot＋シート＋通知）
├─ assets/favicon.svg, ogp.png, make_ogp.py  # favicon＋SNS用OGP（Pillow生成・再生成可）
├─ sitemap.xml       # このダニサイトのサイトマップ
├─ design-tokens.md  # 視覚アイデンティティの正典（差別化ゲート・自己批評）
└─ README.md         # 本ファイル
```
画像は**全てインラインSVG**（外部ホットリンクなし＝セキュリティ基準）。OGPのみローカルPNG同梱。

## 診断ロジックの根拠（簡略化の明示）
- **4条件**：湿度・換気／寝具・寝室／ホコリ・布物／感受性・在室。各設問の選択肢に条件別 weight(0–3)。
- **わが家のダニリスク指数**＝全条件の raw 合計 ÷ 最大合計 ×100（**高いほどリスク高め**）を clamp。
  ダニは高温多湿・栄養（ホコリ/皮脂）・布製品で増えやすいという一般的知見に沿って重み付け（`config.diagnosis`）。
- **5段階予報**（ひかえめ/ふつう/多め/要注意/繁殖ピーク）＝断定を避けた目安語。マスコット表情が連動。
- **住まいのタイプ**（寝具集中/高湿・換気不足/ホコリ・布物/複合）＝閾値超えの条件数で判定。
- **部屋別 必要枚数“処方”**＝各回答の `sheets`（bedding/bedroom/living/closet/car）を積み上げ min/max で clamp。
  「1人分の寝具に1枚、リスクの高い部屋ごとに1〜2枚」という一般的な目安に基づく（`config.rooms`）。
  合計枚数から定期便プランを提案（`config.prescription.plans`）。**枚数はBOSSがApros実仕様に合わせて調整**。
- 指数は季節では水増ししない（正直さ）。季節は文脈表示（バナー／カード季節バッジ）のみ。
- 計算はすべてブラウザ内。回答は送信ボタンを押すまで外部に出ない（生成AIにも送らない）。

## 薬機法・景表法（最優先・厳守）
- ダニ取りシートは **「引き寄せて捕獲する対策シート（雑貨）」の実機能表現**に限定。
  **「駆除・退治・殺す・アレルギーが治る・症状が改善」等の断定は書かない**（コード/UI/文言すべてで）。
- 診断は「リスクの傾向・目安」であり医療診断でないと明示（各免責文＝`config.disclaimer`／全ページ脚注）。
- 体験談・口コミを効果保証に使わない。「〜な方に選ばれています」等の建前表現に留める。
- **要確認（BOSS宿題）**：Apros ダニ取りシートの商品区分（雑品／防除用医薬部外品）を確認し、
  `config.apros.category` の表記を正しく確定すること。医薬部外品なら承認された範囲の表現に、
  雑品なら「捕獲」に限定。区分により許容表現が変わる。

## Apros 接続表（販売サイト＝アプロスライフストア apros-online.jp）
| キー | config パス | 現在値 | 用途 |
|---|---|---|---|
| 定期便URL | `apros.teiki.url` | `apros-online.jp/shop/products/ZZ001?...&utm_campaign=teiki` | 主CTA（部屋別合計枚数で定期便） |
| まとめ買いURL | `apros.bulk.url` | 同URL `&utm_campaign=bulk` | 診断枚数でまとめ買い |
| 単品URL | `apros.tanpin.url` | 同URL `&utm_campaign=tanpin` | 低ハードルの単品お試し |
| LINE URL | `apros.line.url` = `__KURASHI_LINE_URL__` | **未設定** | 季節リマインド・再診断案内の主動線（要設定） |
| マグちゃんURL | `thanks.page.sections[cross].links` = `__MAGCHAN_URL__` | **未設定** | 回遊（グループ他商品） |
- 3つの購入CTAは同一の販売商品ページ（ZZ001）に向け、**UTM の `utm_campaign`（teiki/bulk/tanpin）で導線別に計測**する。
  ecforce/futureshop 型の商品ページは、同ページ上で単品／定期／枚数を選べる想定。
  **Aprosに「定期便を初期選択した専用URL」があれば `apros.teiki.url` をそれに差し替えるとUXが最適化される**。
- からだのカルテ（`https://karada-carte.jp/`）は実URL済み。ecforce移行時は各URLを差し替え。
- ★残るプレースホルダ：`apros.line.url`（LINE）／`__MAGCHAN_URL__`（マグちゃん回遊）／`gas.endpoint`／`gas.turnstileSitekey`。

## LTV：購入者への再診断（実装済み）
- 予報カードに「記録票を保存・再診断案内」ボタン → `thanks.html?index=..&type=..&band=..&kn=..&sheets=..`。
- `thanks.html` が**初回スコア記録票**を発行（localStorage不使用・URLパラメータで受け渡し）。
- 再診断は `index.html?prev=<初回指数>` へ誘導し、結果カードで「前回○点→今回△点」を表示（`app.js`）。
- LINE登録を購入者にも促し、`config.recheck.months`（3か月）後にリマインド運用（LINE/メール）。
- 回遊：別部屋の追加購入（Apros bulk）／からだのカルテ／マグちゃん／母屋。

## GAS（フォーム受信）デプロイ手順
1. スプレッドシートを1つ用意（リード蓄積用）。URLの `/d/ ～ /edit` の間が SHEET_ID。
2. Apps Script プロジェクトを作成し `dani/gas/receiver.gs` を貼り付け。
3. **スクリプト プロパティ**に登録（秘密情報はここだけ・HTMLに書かない）：
   - `NOTIFY_TO` … 通知先メール（**グループ共有アドレス。個人アドレス不可**）
   - `SHEET_ID` … 上記スプレッドシートID
   - `TURNSTILE_SECRET` … Cloudflare Turnstile シークレット
   - `ALLOWED_HOSTS` … `kurashi-carte.jp,www.kurashi-carte.jp`
4. デプロイ →「ウェブアプリ」／実行=自分／アクセス=全員。発行された `/exec` URL を
   `config.json` の `gas.endpoint` に設定。Turnstile の **サイトキー**は `gas.turnstileSitekey` に設定
   （サイトキーは公開情報でHTMLに出てOK。シークレットはGAS側のみ）。
- スパム対策：honeypot(`website`)＋最短送信時間(2.5秒)＋ALLOWED_HOSTS＋Turnstile の多層。

## セキュリティ（過去監査の教訓を反映）
- 個人メール・APIキー・秘密情報を**HTMLに一切露出しない**（宛先はGASスクリプトプロパティに隔離）。
- フォーム送信先は GAS の `/exec` のみ。CSP(meta)＋frame-busting を全ページに。画像はローカル同梱。
- 外部スクリプトは Turnstile と GAS 送信のみ許可（CSPで限定）。CDNの任意実行なし。
- ドメイン共通の `_headers`/`.htaccess`（母屋セッションが設置済み）がサーバー移設時に X-Frame-Options 等を付与。

## 公開（go-live）手順 ※不可逆な公開はBOSF確認・接続情報はAIに渡さない
1. `config.json` のプレースホルダ（Apros各URL・LINE・GAS exec・Turnstile sitekey・org.legalName・MAGCHAN）を実値に。
2. 各HTMLの `<meta name="robots">` を `noindex, nofollow` → `index, follow` に（`config.meta.indexable` も true）。
   対象：`dani/index.html`／`dani/thanks.html`（thanksは基本 noindex 継続でも可）／`dani/shisuu/index.html`。
3. OGPの最終文言を変えたら `python dani/assets/make_ogp.py` で再生成。
4. デプロイ後、Search Console で **`https://kurashi-carte.jp/dani/sitemap.xml` を追加送信**
   （母屋 `sitemap.xml` とは別に、このダニサイトのサイトマップも登録）。
   任意で母屋 `robots.txt` に `Sitemap: https://kurashi-carte.jp/dani/sitemap.xml` を1行追記（母屋セッションと調整）。
5. フォームのテスト送信 → シート蓄積・通知を確認。

## OGP画像の差し替え
`dani/assets/make_ogp.py` を編集 → `python dani/assets/make_ogp.py` で `dani/assets/ogp.png` を再生成。
Windows同梱フォント（BIZ-UDGothic / Yu Gothic / Bahnschrift）＋Pillowで描画。外部素材に依存しない。

## 引用時の注意（GEO）
本サイトの内容を引用する際は、「わが家のダニリスク指数＝住まいのダニのたまりやすさを0〜100で表す目安であり、
医療診断・実測値ではない」「ダニ取りシートは捕獲する対策用品で殺虫剤・医薬品ではない」旨を併記してください。
