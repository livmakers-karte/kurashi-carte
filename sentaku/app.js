/* =========================================================================
   洗濯・水回りの悩み診断 — 診断エンジン＋カルテ発行＋リード送信
   ・config.json 駆動（診断係数・製品URL・免責・GAS・Turnstile を外部化）
   ・外部の生成AI(LLM)は一切呼ばない＝継続課金ゼロ
   ・秘密情報はHTMLに出さない。送信先はGAS /exec のみ（ALLOWED_HOSTS/Turnstileはサーバ側）
   ========================================================================= */
(function(){
  var CFG = null, D = null;
  var answers = [];          // 各設問の選択index
  var startTime = Date.now();
  var current = 0;
  var result = null;

  var $ = function(s, r){ return (r||document).querySelector(s); };
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];}); };

  fetch('../config.json?t=' + Date.now())
    .then(function(r){ return r.json(); })
    .then(function(cfg){ CFG = cfg; D = cfg.diagnosis || {}; init(); })
    .catch(function(){ $('#diag').innerHTML = '<p>設定の読み込みに失敗しました。時間をおいて再度お試しください。</p>'; });

  /* ---------- init ---------- */
  function init(){
    answers = (D.questions||[]).map(function(){ return -1; });
    current = 0;
    renderQuestion();
  }

  /* ---------- 設問描画 ---------- */
  function renderQuestion(){
    var qs = D.questions||[];
    var total = qs.length;
    var q = qs[current];
    var pct = Math.round((current)/total*100);
    var html =
      '<div class="progress" aria-hidden="true"><i style="width:'+pct+'%"></i></div>'+
      '<div class="progress-label">STEP '+(current+1)+' / '+total+'</div>'+
      '<h2 class="q-title">'+esc(q.label)+'</h2>'+
      '<div class="opts" role="radiogroup" aria-label="'+esc(q.label)+'">';
    q.options.forEach(function(o, oi){
      var sel = answers[current]===oi ? ' sel' : '';
      var checked = answers[current]===oi ? 'true':'false';
      html += '<div class="opt'+sel+'" role="radio" tabindex="0" aria-checked="'+checked+'" data-oi="'+oi+'">'+
                '<span class="dot"></span><span>'+esc(o.text)+'</span></div>';
    });
    html += '</div>'+
      '<div class="diag-nav">'+
        (current>0 ? '<button class="btn btn-ghost" id="prevBtn">← もどる</button>' : '<span></span>')+
        '<button class="btn btn-primary" id="nextBtn"'+(answers[current]<0?' disabled':'')+'>'+
          (current===total-1 ? 'カルテを発行する →' : 'つぎへ →')+'</button>'+
      '</div>';
    $('#diag').innerHTML = html;

    // events
    Array.prototype.forEach.call(document.querySelectorAll('.opt'), function(el){
      var pick = function(){ choose(parseInt(el.getAttribute('data-oi'),10)); };
      el.addEventListener('click', pick);
      el.addEventListener('keydown', function(e){ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); pick(); } });
    });
    if ($('#prevBtn')) $('#prevBtn').addEventListener('click', prev);
    $('#nextBtn').addEventListener('click', next);
  }

  function choose(oi){
    answers[current] = oi;
    // 選択を即時反映
    Array.prototype.forEach.call(document.querySelectorAll('.opt'), function(el){
      var on = parseInt(el.getAttribute('data-oi'),10)===oi;
      el.classList.toggle('sel', on);
      el.setAttribute('aria-checked', on?'true':'false');
    });
    if ($('#nextBtn')) $('#nextBtn').removeAttribute('disabled');
  }
  function prev(){ if(current>0){ current--; renderQuestion(); scrollTop(); } }
  function next(){
    if (answers[current]<0) return;
    if (current < (D.questions.length-1)){ current++; renderQuestion(); scrollTop(); }
    else { result = compute(); renderKarte(result); }
  }
  function scrollTop(){ var t=$('#diagTop'); if(t) t.scrollIntoView({behavior:'smooth', block:'start'}); }

  /* ---------- 判定ロジック ---------- */
  function compute(){
    var acc = { roomdry:0, baby:0, kitchen:0, bath:0, sensitivity:0 };
    D.questions.forEach(function(q, qi){
      var oi = answers[qi]; if(oi<0) return;
      var w = q.options[oi].w || {};
      for (var k in w){ if(acc[k]!=null) acc[k]+= w[k]; }
    });
    var axes = D.axes;
    var norm = {
      roomdry: acc.roomdry / axes.roomdry.max,
      baby:    acc.baby    / axes.baby.max,
      kitchen: acc.kitchen / axes.kitchen.max,
      bath:    acc.bath    / axes.bath.max
    };
    // 水環境スコア
    var sm = D.score_model;
    var totalPts = acc.roomdry + acc.baby + acc.kitchen + acc.bath;
    var score = Math.round(sm.base - (totalPts/sm.denominator)*sm.range);
    score = Math.max(sm.floor, Math.min(sm.ceil, score));
    var band = pickBand(sm.bands, score);
    // 洗剤過敏度
    var sensPct = Math.round(acc.sensitivity / axes.sensitivity.max * 100);
    var sensBand = pickBand(D.sensitivity_bands, sensPct);
    // タイプ（正規化最大）
    var order = ['roomdry','baby','kitchen','bath'].sort(function(a,b){ return norm[b]-norm[a]; });
    var primary = order[0], secondary = order[1];
    var isComplex = (norm[primary]-norm[secondary] <= D.complex_threshold) && (norm[secondary] >= D.complex_min);
    // 全ゼロの保険（悩みが無い＝良好） → roomdryを既定にせず「良好」寄りの案内
    var allZero = totalPts === 0;

    return {
      acc: acc, norm: norm, score: score, band: band,
      sensPct: sensPct, sensBand: sensBand,
      primary: primary, secondary: secondary, isComplex: isComplex, allZero: allZero,
      karteNo: makeKarteNo()
    };
  }
  function pickBand(bands, v){
    for (var i=0;i<bands.length;i++){ if(v>=bands[i].min) return bands[i]; }
    return bands[bands.length-1];
  }
  function makeKarteNo(){
    var d = new Date();
    var p = function(n){ return (n<10?'0':'')+n; };
    var ymd = d.getFullYear()+p(d.getMonth()+1)+p(d.getDate());
    var rnd = ('000'+Math.floor(Math.random()*10000)).slice(-4);
    return 'KM-'+ymd+'-'+rnd;
  }

  /* ---------- カルテ結果票 ---------- */
  function renderKarte(r){
    var t = D.types[r.primary];
    var t2 = r.isComplex ? D.types[r.secondary] : null;
    var typeName = r.isComplex ? (t.name + ' × ' + t2.name.replace(/タイプ$/,'') + ' の複合') : t.name;
    var d = new Date();
    var issued = d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日';

    var html =
    '<div class="karte" id="karte">'+
      '<div class="karte-head">'+
        '<div><div class="en">WATER CARE RECORD</div><h3>暮らしの水環境カルテ</h3></div>'+
        '<div class="karte-no">No. '+esc(r.karteNo)+'<br>発行日 '+issued+'</div>'+
      '</div>'+
      '<div class="karte-body">'+
        '<div>'+ gaugeBox(r.score, r.band) +'</div>'+
        '<div>'+
          '<div class="karte-type"><img src="'+esc(t.icon)+'" alt="" width="60" height="60">'+
            '<span class="name">'+esc(typeName)+'</span></div>'+
          '<p class="finding">'+esc(r.allZero ? '大きな乱れは少なめです。今の習慣を続けながら、季節の変化を見守りましょう。' : t.finding)+'</p>'+
          (r.isComplex ? '<p class="finding" style="color:#3c6a55">＋ '+esc(t2.finding)+'</p>' : '')+
          '<div class="subidx">'+
            '<span class="band">水環境スコア '+r.score+'／100・'+esc(r.band.label)+'</span>'+
            '<span class="band" style="background:var(--coral-soft);color:#b5432c">洗剤過敏度 '+esc(r.sensBand.label)+'</span>'+
          '</div>'+
        '</div>'+
      '</div>'+
      sealSVG()+
      '<div class="karte-foot">所見：'+esc(r.band.note)+'　／　'+esc(r.sensBand.note)+'。<br>※本カルテは傾向の目安です。医療診断や特定商品の効果を保証するものではありません。</div>'+
    '</div>'+
    '<p class="center no-print" style="margin:14px 0 0">'+
      '<button class="btn btn-ghost" id="printBtn">🖨 このカルテを保存／印刷</button>'+
      '<span style="display:block;font-size:.8rem;color:var(--muted);margin-top:8px">カルテ番号・スコアを控えておくと、次回の再診断で「暮らしの変化」を比べられます。</span>'+
    '</p>';

    $('#resultWrap').innerHTML = html;
    $('#resultWrap').hidden = false;
    $('#diagCard').hidden = true;
    renderOffer(r);
    $('#offerWrap').hidden = false;
    $('#leadWrap').hidden = false;
    prefillLead(r);

    // アニメ：ゲージ充填＋シール押印
    requestAnimationFrame(function(){
      var fill = $('#waterFill'); if(fill){ animateFill(fill, r.score); }
      var num = $('#gaugeNum'); if(num){ countUp(num, r.score); }
      var seal = $('#sealEl'); if(seal){ seal.classList.add('stamp'); }
      revealInit();
    });
    if ($('#printBtn')) $('#printBtn').addEventListener('click', function(){ window.print(); });
    $('#karte').scrollIntoView({behavior:'smooth', block:'start'});
  }

  function gaugeBox(score, band){
    // 水滴の輪郭でクリップした水面(#waterFill)を下から充填してスコアを表現
    return '<div class="gauge">'+
      '<svg viewBox="0 0 200 240" aria-label="水環境スコア '+score+'／100">'+
        '<defs>'+
          '<linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">'+
            '<stop offset="0" stop-color="#5EBACE"/><stop offset="1" stop-color="#2C7E92"/></linearGradient>'+
          '<clipPath id="dropClip"><path d="M100 12 C150 84 178 120 178 152 a78 78 0 0 1-156 0 C22 120 50 84 100 12 Z"/></clipPath>'+
        '</defs>'+
        '<path d="M100 12 C150 84 178 120 178 152 a78 78 0 0 1-156 0 C22 120 50 84 100 12 Z" fill="#EAF7F8" stroke="#4FB0C4" stroke-width="3"/>'+
        '<g clip-path="url(#dropClip)">'+
          '<rect id="waterFill" x="0" y="240" width="200" height="240" fill="url(#wg)"/>'+
        '</g>'+
        '<path d="M100 12 C150 84 178 120 178 152 a78 78 0 0 1-156 0 C22 120 50 84 100 12 Z" fill="none" stroke="#4FB0C4" stroke-width="3"/>'+
      '</svg>'+
      '<span class="num" id="gaugeNum">0</span>'+
      '<span class="cap">水環境スコア</span>'+
      '</div>';
  }

  function animateFill(el, score){
    // el: <rect> 水面。0→scoreへ。reduced-motionは即時
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var endY = 230 - (score/100)*200;  // score↑ → 水位が上（y小）。範囲 y=30(満)〜230(空)
    if (reduce){ el.setAttribute('y', endY); return; }
    var startY = 240, t0 = null, dur = 900;
    function step(ts){ if(!t0) t0=ts; var k=Math.min(1,(ts-t0)/dur);
      var e = 1-Math.pow(1-k,3);
      el.setAttribute('y', startY + (endY-startY)*e);
      if(k<1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function countUp(el, score){
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    if (reduce){ el.textContent = score; return; }
    var t0=null, dur=900;
    function step(ts){ if(!t0) t0=ts; var k=Math.min(1,(ts-t0)/dur);
      el.textContent = Math.round(score*(1-Math.pow(1-k,3)));
      if(k<1) requestAnimationFrame(step); else el.textContent = score;
    }
    requestAnimationFrame(step);
  }
  function sealSVG(){
    return '<svg class="seal" id="sealEl" viewBox="0 0 92 92" aria-hidden="true">'+
      '<circle cx="46" cy="46" r="44" fill="none" stroke="#F4795B" stroke-width="3"/>'+
      '<circle cx="46" cy="46" r="37" fill="#F4795B"/>'+
      '<text x="46" y="42" text-anchor="middle" fill="#fff" font-size="15" font-weight="bold" font-family="\'Hiragino Maru Gothic ProN\',sans-serif">診断済</text>'+
      '<text x="46" y="60" text-anchor="middle" fill="#FBDDD3" font-size="9" letter-spacing="1.5" font-family="Trebuchet MS,sans-serif">KURASHI</text>'+
    '</svg>';
  }

  /* ---------- タイプ別 マグちゃんオファー ---------- */
  function renderOffer(r){
    var keys = r.isComplex ? [r.primary, r.secondary] : [r.primary];
    var prods = D.products, types = D.types;
    var offer = D.offer || {};
    var html = '<h2 class="center" style="font-size:1.5rem;margin:.2em 0 .3em">あなたのタイプに合う、マグちゃんのアプローチ</h2>'+
      '<p class="center lead" style="margin-bottom:1.2em">'+esc(r.isComplex ? '複合タイプのため、2つのラインの併用が選ばれています。' : '押し売りはしません。合いそうなものから、無理なく。')+'</p>';
    keys.forEach(function(k){
      var t = types[k], p = prods[t.product_key] || {};
      var pUrl = (p.productUrl && p.productUrl.indexOf('__')===-1) ? p.productUrl : (CFG.brand && CFG.brand.site) || '#';
      var sUrl = (p.subscribeUrl && p.subscribeUrl.indexOf('__')===-1) ? p.subscribeUrl : pUrl;
      html += '<div class="prod reveal">'+
        '<img src="'+esc(t.icon)+'" alt="">'+
        '<div><strong>'+esc(p.name||t.name)+'</strong><br>'+
          '<span style="color:#33454a;font-size:.94rem">'+esc(t.approach)+'</span></div>'+
        '<div class="pcta">'+
          '<a class="btn btn-primary" href="'+esc(pUrl)+'" target="_blank" rel="noopener">商品を見る</a>'+
          '<a class="btn btn-ghost" href="'+esc(sUrl)+'" target="_blank" rel="noopener">定期コース</a>'+
        '</div></div>';
    });
    // オファー説明
    html += '<div class="offer reveal" style="margin-top:16px">'+
      '<h3 style="margin:.1em 0 .5em">'+esc(offer.heading||'続けやすい定期コース')+'</h3><ul>';
    (offer.points||[]).forEach(function(pt){ html += '<li>'+esc(pt)+'</li>'; });
    html += '</ul><p style="color:var(--muted);font-size:.85rem;margin:.4em 0 0">'+esc(offer.guard||'')+'</p></div>';

    // LINE / 再診断 / 交換
    var line = CFG.line||{}, re = D.reexam||{}, con = D.consumable||{};
    var lineUrl = (line.url && line.url.indexOf('__')===-1) ? line.url : '';
    html += '<div class="grid g2" style="margin-top:16px">'+
      '<div class="block-line reveal"><span class="tag mint">LINEで見守り</span>'+
        '<h3 style="margin:.4em 0 .3em">'+esc(line.label||'公式LINEで暮らしを見守り')+'</h3>'+
        '<p style="font-size:.94rem">'+esc(line.note||'')+'</p>'+
        (lineUrl ? '<a class="btn btn-line" href="'+esc(lineUrl)+'" target="_blank" rel="noopener">LINEで友だち追加</a>'
                 : '<span class="tag">準備中（公開時にLINE導線を有効化）</span>')+
      '</div>'+
      '<div class="block-reexam reveal"><span class="tag coral">'+esc(re.months||3)+'ヶ月後</span>'+
        '<h3 style="margin:.4em 0 .3em">'+esc(re.heading||'暮らしの変化を無料で再診断')+'</h3>'+
        '<p style="font-size:.94rem">'+esc(re.message||'')+'</p>'+
        '<p style="font-size:.85rem;color:var(--muted);margin:0">'+esc(con.message||'')+'</p>'+
      '</div>'+
    '</div>';

    $('#offerWrap').innerHTML = html;
  }

  /* ---------- リード送信（GAS） ---------- */
  function prefillLead(r){
    var f = $('#leadForm'); if(!f) return;
    var set = function(n,v){ var el=f.elements[n]; if(el) el.value = v; };
    var t = D.types[r.primary];
    set('causeType', r.isComplex ? (t.name+' × '+D.types[r.secondary].name) : t.name);
    set('score', r.score);
    set('axisRoomdry', r.acc.roomdry); set('axisBaby', r.acc.baby);
    set('axisKitchen', r.acc.kitchen); set('axisBath', r.acc.bath);
    set('sensitivity', r.sensPct);
    set('karteNo', r.karteNo);
    set('ua', navigator.userAgent);
    set('pageHost', location.hostname);
    // Turnstile（実サイトキー時のみ）
    var sk = (CFG.turnstile && CFG.turnstile.sitekey) || '';
    if (sk.indexOf('__')===-1 && sk){
      var slot = $('#tsSlot');
      slot.innerHTML = '<div class="cf-turnstile" data-sitekey="'+esc(sk)+'"></div>';
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      s.async = true; s.defer = true; document.head.appendChild(s);
    } else {
      var note = $('#tsNote'); if(note) note.hidden = false;
    }
  }

  document.addEventListener('submit', function(e){
    if (e.target && e.target.id === 'leadForm'){
      e.preventDefault(); submitLead(e.target);
    }
  });

  function submitLead(f){
    var msg = $('#formMsg');
    var name = (f.elements['name'].value||'').trim();
    var email = (f.elements['email'].value||'').trim();
    if (!name || !email){ msg.textContent = 'お名前とメールアドレスをご入力ください。'; msg.style.color = 'var(--danger)'; return; }
    if (f.elements['website'] && f.elements['website'].value){ /* honeypot */ done(); return; }

    f.elements['elapsedMs'].value = String(Date.now() - startTime);
    var endpoint = (CFG.gas && CFG.gas.endpoint) || '';
    var btn = $('#leadSubmit'); if(btn){ btn.disabled = true; btn.textContent = '送信中…'; }
    msg.textContent = '';

    if (!endpoint || endpoint.indexOf('__')!==-1){
      // 送信先未設定（公開前）— 疑似完了で導線確認可能に
      done(); return;
    }
    var fd = new FormData(f);
    fetch(endpoint, { method:'POST', body:fd, mode:'no-cors' })
      .then(function(){ done(); })
      .catch(function(){ done(); }); // no-cors は結果不可視のため楽観的完了（保存はサーバ側で実施）
  }

  function done(){
    // thanks.html へ（カルテ番号・タイプを引き継いでLTV導線を出す）
    var q = '';
    if (result){
      var t = D.types[result.primary];
      q = '?type=' + encodeURIComponent(result.isComplex ? (t.name+' × '+D.types[result.secondary].name) : t.name) +
          '&score=' + encodeURIComponent(result.score) +
          '&karte=' + encodeURIComponent(result.karteNo) +
          '&primary=' + encodeURIComponent(result.primary);
    }
    location.href = 'thanks.html' + q;
  }

  /* ---------- reveal ---------- */
  function revealInit(){
    var els = document.querySelectorAll('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)){ Array.prototype.forEach.call(els,function(e){e.classList.add('in');}); return; }
    var io = new IntersectionObserver(function(en){ en.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} }); }, {threshold:.1});
    Array.prototype.forEach.call(els, function(e){ io.observe(e); });
  }
})();
