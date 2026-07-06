/**
 * 住まいのダニ・カルテ（/dani/）— リード受信レシーバ (Google Apps Script)
 * ---------------------------------------------------------------------------
 * 役割：
 *   1) /dani/ の相談・枚数確認・再診断希望フォーム(FormData / POST)を受信
 *   2) Cloudflare Turnstile トークンをサーバー側で検証（bot/スパム除去）
 *   3) honeypot(website)・最短送信時間・送信元ホスト(ALLOWED_HOSTS)を検査
 *   4) スプレッドシートに1行追記（連絡先＋わが家のダニリスク指数・タイプ・部屋別枚数）
 *   5) 管理者へメール通知（受け取るのは「指数・部屋別枚数を判定済みの濃いリード」）
 *
 * 秘密情報は一切コード内に書かない。すべて「スクリプトプロパティ」に隔離する。
 *   プロジェクトの設定 → スクリプト プロパティ に以下4つを登録：
 *     NOTIFY_TO        … 通知先メール（グループ共有アドレス。個人アドレス不可）
 *     SHEET_ID         … 蓄積先スプレッドシートのID（URLの /d/ と /edit の間）
 *     TURNSTILE_SECRET … Cloudflare Turnstile のシークレットキー
 *     ALLOWED_HOSTS    … 送信を許可するホスト（カンマ区切り。例 kurashi-carte.jp,www.kurashi-carte.jp）
 *
 * デプロイ：「ウェブアプリ」／実行するユーザー=自分／アクセスできるユーザー=全員。
 *          発行された /exec URL を config.json の gas.endpoint に設定する。
 * このスクリプトは外部の生成AI(LLM)を一切呼ばない（継続課金ゼロ）。
 * 【薬機法・景表法】本フォームは診断の傾向・連絡先の受け渡しのみを行い、
 *   ダニの駆除・アレルギー症状の改善など効果効能の判定・保証は行わない。
 */

var SHEET_NAME = 'dani_leads';
var HEADERS = [
  '受信日時','ご希望','ダニリスク指数','予報','住まいのタイプ',
  '湿度・換気','寝具・寝室','ホコリ・布物','感受性・在室',
  '必要枚数(合計)','部屋別内訳','おすすめプラン',
  'カルテ番号','お名前','メール','電話','ご相談内容','送信元ホスト','UA'
];

/* ===== エントリポイント ===== */
function doPost(e){
  try{
    var p = (e && e.parameter) ? e.parameter : {};
    var props = PropertiesService.getScriptProperties();

    // 1) honeypot
    if (p.website && String(p.website).trim() !== ''){
      return json_({ ok:true, skipped:'honeypot' });
    }
    // 1.5) 最短送信時間（bot対策）
    var elapsed = parseInt(p.elapsedMs, 10);
    if (!isNaN(elapsed) && elapsed >= 0 && elapsed < 2500){
      return json_({ ok:true, skipped:'too_fast' });
    }
    // 2) 送信元ホストの許可チェック（未設定なら素通し）
    var allowed = String(props.getProperty('ALLOWED_HOSTS') || '').split(',')
      .map(function(s){ return s.trim().toLowerCase(); }).filter(String);
    var host = String(p.pageHost || '').trim().toLowerCase();
    if (allowed.length && host && allowed.indexOf(host) === -1){
      return json_({ ok:false, error:'host_not_allowed' });
    }
    // 3) Turnstile 検証（SECRET 設定時のみ）
    var secret = props.getProperty('TURNSTILE_SECRET');
    if (secret){
      var token = p['cf-turnstile-response'] || '';
      if (!token || !verifyTurnstile_(secret, token)){
        return json_({ ok:false, error:'turnstile_failed' });
      }
    }
    // 4) 必須項目の最低限バリデーション
    var name = clean_(p.name), email = clean_(p.email);
    if (!name || !email){ return json_({ ok:false, error:'missing_required' }); }

    // 5) スプレッドシートへ追記
    var row = [
      new Date(),
      clean_(p.purposeText), clean_(p.daniIndex), clean_(p.riskBand), clean_(p.homeType),
      clean_(p.axisHumidity), clean_(p.axisBedding), clean_(p.axisDust), clean_(p.axisSensitivity),
      clean_(p.totalSheets), cleanMulti_(p.roomBreakdown), clean_(p.planLabel),
      clean_(p.karteNo), name, email, clean_(p.tel),
      cleanMulti_(p.message), host, clean_(p.ua)
    ];
    appendRow_(row);

    // 6) 通知
    notify_(props.getProperty('NOTIFY_TO'), p);

    return json_({ ok:true });
  }catch(err){
    return json_({ ok:false, error:String(err) });
  }
}

/* ヘルスチェック */
function doGet(){ return json_({ ok:true, service:'kurashi-carte-dani-receiver' }); }

/* ===== ヘルパ ===== */
function verifyTurnstile_(secret, token){
  try{
    var res = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method:'post', payload:{ secret:secret, response:token }, muteHttpExceptions:true
    });
    var data = JSON.parse(res.getContentText() || '{}');
    return data.success === true;
  }catch(e){ return false; }
}
function getSheet_(){
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh){ sh = ss.insertSheet(SHEET_NAME); }
  if (sh.getLastRow() === 0){ sh.appendRow(HEADERS); }
  return sh;
}
function appendRow_(row){ getSheet_().appendRow(row); }
function notify_(to, p){
  if (!to) return;
  var subject = '【住まいのダニ・カルテ】診断リード（指数 ' + (p.daniIndex || '—') + '／' + (p.riskBand || '—') + '／' + (p.totalSheets || '—') + '枚）';
  var body = [
    '住まいのダニ・アレルギー診断から相談リードが届きました。',
    '（わが家のダニリスク指数・部屋別の必要枚数を判定済みの見込み客です）',
    '',
    '■ ご希望　　　：' + (p.purposeText || '—'),
    '■ ダニリスク指数：' + (p.daniIndex || '—') + ' / 100（' + (p.riskBand || '—') + '）',
    '■ 住まいのタイプ：' + (p.homeType || '—'),
    '■ 条件別(湿/寝/埃/感)：' + [p.axisHumidity, p.axisBedding, p.axisDust, p.axisSensitivity].join(' / '),
    '■ 必要枚数(合計)：' + (p.totalSheets || '—') + ' 枚',
    '■ 部屋別内訳　：' + (p.roomBreakdown || '—'),
    '■ おすすめプラン：' + (p.planLabel || '—'),
    '■ カルテ番号　：' + (p.karteNo || '—'),
    '',
    '── 連絡先 ──',
    'お名前　：' + clean_(p.name),
    'メール　：' + clean_(p.email),
    '電話　　：' + (clean_(p.tel) || '—'),
    'ご相談　：' + (cleanMulti_(p.message) || '（記入なし）'),
    '',
    '送信元ホスト：' + (p.pageHost || '—')
  ].join('\n');
  try{ MailApp.sendEmail(to, subject, body); }catch(e){}
}
/* ヘッダインジェクション対策 */
function clean_(v){ return String(v == null ? '' : v).replace(/[\r\n\t]+/g,' ').trim().slice(0, 200); }
function cleanMulti_(v){ return String(v == null ? '' : v).replace(/[\r\n]+/g,' / ').replace(/\t/g,' ').trim().slice(0, 1000); }
function json_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
