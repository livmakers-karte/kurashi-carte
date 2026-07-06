/* =========================================================================
   住まいのダニ・アレルギー診断（/dani/）— わが家のダニリスク指数
   - 採点・判定は全てブラウザ内（外部API・生成AIを呼ばない＝継続課金ゼロ）
   - ロジックの根拠・簡略化・薬機法/景表法の前提は README.md / config.json / 本コメントに明記
   ---------------------------------------------------------------------------
   指数：各設問の選択肢は4条件（湿度/寝具/ホコリ/感受性）に weight(0-3) を持つ。
     条件ごと raw=選択weight合計、max=各設問の最大weight合計。
     わが家のダニリスク指数 = 全条件合算 raw/max*100（高いほどリスク高め）、clampで丸め。
   タイプ判定：閾値超えの条件が2つ以上→複合型、1つ→その条件型、感受性が高く1条件該当なら複合寄り、
     該当なしは最大条件を採用。
   処方：各選択肢の sheets（部屋別の必要枚数）を積み上げ、部屋定義の min/max でclamp。
     合計枚数から定期便のおすすめプランを決定（客単価の根拠＝住まいの実態）。
   ※本ツールは「傾向の目安」。医療診断ではなく、駆除やアレルギー改善を保証しない（薬機法・景表法）。
   ========================================================================= */
var CONFIG=null, DG=null, STATE={answers:{}}, STEP=0, MAX_STEP=0, lastResult=null;
var PAGE_START=Date.now();

function el(id){return document.getElementById(id);}
function txt(id,v){var e=el(id); if(e&&v!=null) e.textContent=v;}
function ph(v){return typeof v==='string' && v.indexOf('__')===0;} /* 未設定プレースホルダ判定 */
function num2(n){return String(n<10?'0'+n:n);}
function clampi(v,lo,hi){return Math.max(lo,Math.min(hi,v));}

/* ---------- 季節バンド ---------- */
function seasonBand(){
  var m=new Date().getMonth()+1;
  var bands=(CONFIG.season&&CONFIG.season.bands)||[];
  for(var i=0;i<bands.length;i++){ if(bands[i].months.indexOf(m)!==-1) return bands[i]; }
  return bands[0]||null;
}

/* ---------- 採点 ---------- */
function axisMaxes(){
  var mx={humidity:0,bedding:0,dust:0,sensitivity:0};
  DG.steps.forEach(function(st){ st.questions.forEach(function(q){
    var per={humidity:0,bedding:0,dust:0,sensitivity:0};
    (q.options||[]).forEach(function(o){ for(var k in per){ if(o.w&&o.w[k]!=null) per[k]=Math.max(per[k],o.w[k]); } });
    for(var k in mx) mx[k]+=per[k];
  });});
  return mx;
}
function compute(){
  var raw={humidity:0,bedding:0,dust:0,sensitivity:0};
  var rooms={bedding:0,bedroom:0,living:0,closet:0,car:0};
  DG.steps.forEach(function(st){ st.questions.forEach(function(q){
    var a=STATE.answers[q.id]; if(!a) return;
    if(a.w){ for(var k in raw){ if(a.w[k]!=null) raw[k]+=a.w[k]; } }
    if(a.sheets){ for(var r in rooms){ if(a.sheets[r]!=null) rooms[r]+=a.sheets[r]; } }
  });});
  var mx=axisMaxes();
  var risk={}, totalRaw=0, totalMax=0;
  for(var k in raw){ risk[k]=mx[k]>0?(raw[k]/mx[k]*100):0; totalRaw+=raw[k]; totalMax+=mx[k]; }
  var sc=DG.scoring;
  var index=Math.round(totalMax>0?totalRaw/totalMax*100:0);
  index=clampi(index, sc.clampMin, sc.clampMax);

  // タイプ判定
  var core=['humidity','bedding','dust'];
  var th=sc.highThreshold;
  var highs=core.filter(function(a){return risk[a]>=th;});
  var sensHigh=risk.sensitivity>=th;
  var type;
  if(highs.length>=sc.complexMinHighAxes) type='complex';
  else if(highs.length===1 && sensHigh && sc.sensitivityAmplifies) type='complex';
  else if(sensHigh && highs.length===0) type='complex';
  else if(highs.length===1) type=(highs[0]==='bedding'?'bedroom':(highs[0]==='humidity'?'humidity':'fabric'));
  else { var top=core.reduce(function(a,b){return risk[b]>risk[a]?b:a;},core[0]); type=(top==='bedding'?'bedroom':(top==='humidity'?'humidity':'fabric')); }

  // 部屋別 必要枚数（clamp）
  var defs=CONFIG.rooms.defs, order=CONFIG.rooms.order, presc=[], total=0;
  order.forEach(function(rk){
    var d=defs[rk]; if(!d) return;
    var n=clampi(rooms[rk]||0, d.min, d.max);
    if(n>0){ presc.push({key:rk, n:n, def:d}); total+=n; }
  });

  // プラン
  var plan=null, plans=(CONFIG.prescription&&CONFIG.prescription.plans)||[];
  for(var pi=0;pi<plans.length;pi++){ if(total<=plans[pi].maxSheets){ plan=plans[pi]; break; } }
  if(!plan && plans.length) plan=plans[plans.length-1];

  var domCore=core.reduce(function(a,b){return risk[b]>risk[a]?b:a;},core[0]);
  return {index:index, risk:risk, type:type, dominant:domCore, presc:presc, totalSheets:total, plan:plan};
}
function bandFor(index){
  var bands=CONFIG.index.bands;
  for(var i=0;i<bands.length;i++){ if(index<=bands[i].max) return bands[i]; }
  return bands[bands.length-1];
}

/* ---------- カルテ番号 ---------- */
function karteNumber(res){
  var d=new Date();
  var ds=d.getFullYear()+num2(d.getMonth()+1)+num2(d.getDate());
  var seed=res.type+res.index+res.totalSheets+JSON.stringify(Object.keys(STATE.answers).map(function(k){return STATE.answers[k].v;}));
  var h=0; for(var i=0;i<seed.length;i++){ h=(h*31+seed.charCodeAt(i))>>>0; }
  var code=('000'+(h%10000)).slice(-4);
  return {no:'DANI-'+ds+'-'+code, date:d.getFullYear()+'.'+num2(d.getMonth()+1)+'.'+num2(d.getDate())};
}

/* ---------- ステップUI ---------- */
function renderSteps(){
  var host=el('steps'); host.innerHTML='';
  DG.steps.forEach(function(st,si){
    var div=document.createElement('div'); div.className='step'; div.setAttribute('data-step',si); if(si!==0) div.hidden=true;
    var html='<p class="steplabel">STEP '+(si+1)+' / '+DG.steps.length+' ・ '+st.label+'</p>'+
             '<h3>'+st.title+'</h3>'+(st.hint?'<p class="hint">'+st.hint+'</p>':'');
    st.questions.forEach(function(q){
      var cls=(q.options.length===2)?' two':(q.options.length===3?' three':'');
      html+='<fieldset class="q"><legend class="ql">'+q.q+'</legend><div class="opts'+cls+'" data-q="'+q.id+'">';
      q.options.forEach(function(o){
        html+='<label class="opt"><input type="radio" name="'+q.id+'" value="'+o.v+'"><span class="t">'+o.label+'</span></label>';
      });
      html+='</div></fieldset>';
    });
    html+='<div class="err" id="err'+si+'"></div>';
    div.innerHTML=html; host.appendChild(div);
  });
  DG.steps.forEach(function(st){ st.questions.forEach(function(q){
    var box=document.querySelector('.opts[data-q="'+q.id+'"]');
    box.querySelectorAll('input').forEach(function(inp){
      inp.addEventListener('change', function(){
        var opt=null; q.options.forEach(function(o){ if(o.v===inp.value) opt=o; });
        STATE.answers[q.id]={v:inp.value, w:opt?(opt.w||{}):{}, sheets:opt?(opt.sheets||{}):{}};
        box.querySelectorAll('.opt').forEach(function(l){l.classList.remove('sel');});
        inp.closest('.opt').classList.add('sel');
        validateStep();
      });
    });
  });});
  MAX_STEP=DG.steps.length-1;
}
function renderStepbar(){
  var bar=el('stepbar'); bar.innerHTML='';
  for(var i=0;i<=MAX_STEP;i++){ var s=document.createElement('div'); s.className='seg'+(i<STEP?' done':'')+(i===STEP?' on':''); bar.appendChild(s); }
}
function showStep(n,noScroll){
  STEP=n; renderStepbar();
  document.querySelectorAll('.step').forEach(function(s){ s.hidden=(Number(s.getAttribute('data-step'))!==n); });
  el('btnBack').style.visibility=n===0?'hidden':'visible';
  el('btnNext').textContent=(n===MAX_STEP)?'ダニ予報カードを発行 →':'次へ';
  validateStep();
  if(!noScroll) el('wizard').scrollIntoView({behavior:'smooth',block:'start'});
}
function validateStep(show){
  var st=DG.steps[STEP], ok=true;
  st.questions.forEach(function(q){ if(!STATE.answers[q.id]) ok=false; });
  var e=el('err'+STEP); if(e) e.textContent=(!ok&&show)?'すべての項目をお選びください。':'';
  el('btnNext').disabled=!ok;
  return ok;
}

/* ---------- 結果（ダニ予報カード）描画 ---------- */
var AXORDER=[['humidity','湿度・換気'],['bedding','寝具・寝室'],['dust','ホコリ・布物'],['sensitivity','感受性・在室']];
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

function renderResult(){
  var res=compute(); lastResult=res;
  var band=bandFor(res.index);
  var t=CONFIG.types[res.type];
  var season=seasonBand();

  el('wizard').style.display='none';
  var rw=el('resultwrap'); rw.style.display='block';
  var fc=el('forecast'); if(!reduce){ fc.classList.add('fc-issue'); }

  var kn=karteNumber(res);
  txt('karteNo',kn.no); txt('karteDate',kn.date);

  // 季節チップ
  if(season){
    var chip=el('seasonChip'); txt('seasonChipTxt','いまは「'+season.label+'」'); if(season.peak) chip.classList.add('peak');
    txt('seasonBoxTitle','いまの季節：'+season.label);
    txt('seasonBoxText', season.message);
  }

  // 指数（カウントアップ＋針）
  txt('idxCap', CONFIG.index.name+'（目安）');
  animateCount(el('idxVal'), res.index, reduce);
  var bl=el('bandLab'); bl.textContent=band.label; bl.style.background=band.color;
  txt('bandAdvice', band.advice);
  el('explainLink').setAttribute('href', CONFIG.index.explainHref||'shisuu/');
  el('explainLink').textContent=CONFIG.index.explainCta||'指数の見かたを詳しく';
  setTimeout(function(){ el('idxNeedle').style.left=res.index+'%'; },80);

  // マスコット表情
  el('mascotUse').setAttribute('href','#mascot-'+(band.mascot||'smile'));

  // 前回比較（?prev=NN）
  var params=new URLSearchParams(location.search);
  var prev=parseInt(params.get('prev'),10);
  if(!isNaN(prev)){
    var d=res.index-prev, sign=d>0?'+':'';
    var pd=el('prevDelta'); pd.style.display='block';
    var word=d<0?'下がりました。対策の手ごたえです':'（前回とくらべた変化です）';
    pd.innerHTML='前回の指数 '+prev+' → 今回 '+res.index+'（<b>'+sign+d+'</b>）　'+(d<0?'指数が'+word:word);
  }

  // タイプ＋シール
  txt('sealText', t.seal); txt('typeName', t.name); txt('typeSub', t.sub);
  var stamp=el('sealStamp');
  if(!reduce){ stamp.classList.remove('seal-anim'); void stamp.offsetWidth; stamp.classList.add('seal-anim'); }

  // 条件別バー
  var ab=el('axisBars'); ab.innerHTML='';
  AXORDER.forEach(function(a){
    var key=a[0], val=Math.round(res.risk[key]);
    var dom=(key===res.dominant)?' dom':'';
    var row=document.createElement('div'); row.className='axis'+dom;
    row.innerHTML='<span class="an">'+a[1]+'</span><span class="at"><span class="af"></span></span><span class="av">'+val+'</span>';
    ab.appendChild(row);
    (function(fill,v){ setTimeout(function(){fill.style.width=v+'%';},120); })(row.querySelector('.af'),val);
  });

  // 部屋別 必要枚数マップ
  txt('totalSheets', res.totalSheets);
  var rl=el('roomList'); rl.innerHTML='';
  var priSet={}; (t.priorityRooms||[]).forEach(function(r){priSet[r]=1;});
  res.presc.forEach(function(p,i){
    var d=p.def, isPri=priSet[p.key];
    var row=document.createElement('div'); row.className='room'+(isPri?' pri':'');
    row.innerHTML='<span class="ri"><svg aria-hidden="true"><use href="#'+d.icon+'"/></svg></span>'+
      '<span class="rn"><p class="rnm">'+d.label+(isPri?' <span style="font-size:10.5px;color:#D98A26;font-weight:800">優先</span>':'')+'</p><p class="rnote">'+d.note+'</p></span>'+
      '<span class="rq"><span class="n num">'+p.n+'</span><span class="un">'+d.unit+'</span></span>';
    rl.appendChild(row);
    (function(r){ setTimeout(function(){r.classList.add('on');}, 200+i*130); })(row);
  });
  txt('roomNote', (CONFIG.prescription&&CONFIG.prescription.validityNote)||'');

  // finding / approach / Apros
  txt('findingText', t.finding);
  txt('approachText', t.approach);
  var ap=CONFIG.apros;
  txt('aprosName', ap.brand); txt('aprosCat', ap.category); txt('aprosIntro', ap.intro);

  // 免責
  el('resultDisclaimer').innerHTML='<strong>これは傾向の目安です。</strong> '+CONFIG.disclaimer.onResult+' '+CONFIG.disclaimer.yakkihou;

  // オファー＋CTA（部屋別枚数で客単価最大化）
  var off=CONFIG.offer;
  txt('offerTitle', off.title); txt('offerLead', off.lead);
  var pb=el('planBadge'); pb.textContent=res.plan? ('おすすめ：'+res.plan.label+'（合計'+res.totalSheets+'枚）') : ('合計 '+res.totalSheets+' 枚');
  var ctas=el('offerCtas'); ctas.innerHTML='';
  var teiki=ap.teiki||{}, bulk=ap.bulk||{}, tanpin=ap.tanpin||{}, line=ap.line||{};
  // 枚数は“目安”であり自動でカートに入らない旨（約束と実挙動を一致させる）
  if(off.quantityNote){ var qn=document.createElement('p'); qn.className='small'; qn.style.cssText='color:#c3cee8;margin:0 0 12px;font-size:11.5px;position:relative;line-height:1.65'; qn.textContent=off.quantityNote; ctas.appendChild(qn); }
  // ① 定期便（主CTA・販売ページで“選ぶ”／診断枚数は目安として併記）
  ctas.appendChild(mkCta((off.ctaTeikiLabel||teiki.cta||'販売ページで定期便を選ぶ')+'（目安 合計'+res.totalSheets+'枚）', teiki.url, 'main'));
  // ② まとめ買い（診断枚数を目安に）
  if(bulk.url) ctas.appendChild(mkCta(bulk.cta||'診断した枚数を目安にまとめ買い', bulk.url, 'ghost'));
  // ③ 単品で試す（低ハードル）
  if(tanpin.url) ctas.appendChild(mkCta(tanpin.cta||'単品で試す', tanpin.url, 'ghost'));
  // ④ LINE（設定時のみ）
  if(line.url && !ph(line.url)) ctas.appendChild(mkCta(line.cta||'LINEで受け取る', line.url, 'line'));
  if(off.microtrust){ var mt=document.createElement('p'); mt.className='small'; mt.style.cssText='color:#b9c6e2;text-align:center;margin:12px 0 0;font-size:11.5px;position:relative'; mt.textContent=off.microtrust; ctas.appendChild(mt); }

  // 再診断
  var rc=CONFIG.recheck;
  txt('recheckTitle', rc.title); txt('recheckText', rc.text);
  var rcc=el('recheckCta'); rcc.textContent=rc.cta;
  if(line.url && !ph(line.url)){ rcc.className='ctabtn line'; rcc.setAttribute('href', line.url); }
  else { rcc.className='ctabtn main'; rcc.removeAttribute('target'); rcc.setAttribute('href','#formCard'); }

  // hidden lead 値
  el('hKarteNo').value=kn.no;
  el('hIndex').value=res.index;
  el('hBand').value=band.label;
  el('hType').value=t.name;
  el('hAxHumidity').value=Math.round(res.risk.humidity);
  el('hAxBedding').value=Math.round(res.risk.bedding);
  el('hAxDust').value=Math.round(res.risk.dust);
  el('hAxSensitivity').value=Math.round(res.risk.sensitivity);
  el('hSheets').value=res.totalSheets;
  el('hRooms').value=res.presc.map(function(p){return p.def.label+' '+p.n+p.def.unit;}).join(' / ');
  el('hPlan').value=res.plan?res.plan.label:'';

  // 記録票・再診断リンク（thanks.html へ初回スコアをURLで引き継ぎ）
  var q=new URLSearchParams();
  q.set('index',res.index); q.set('type',res.type); q.set('band',band.label);
  q.set('kn',kn.no); q.set('sheets',res.totalSheets);
  var thanksHref='thanks.html?'+q.toString();
  el('btnSave').setAttribute('href', thanksHref);
  el('toThanksLink').setAttribute('href', thanksHref);

  // URL に結果を保存（localStorage不使用・共有/再診断比較用）
  try{
    var qs=new URLSearchParams(); qs.set('type',res.type); qs.set('index',res.index); qs.set('kn',kn.no);
    history.replaceState(null,'', location.pathname+'?'+qs.toString());
  }catch(e){}

  rw.scrollIntoView({behavior:'smooth',block:'start'});
}

function animateCount(node,to,noAnim){
  node.textContent=noAnim?to:0;
  if(noAnim) return;
  var start=null, dur=1150;
  function frame(ts){ if(!start) start=ts; var p=Math.min(1,(ts-start)/dur);
    var e=1-Math.pow(1-p,3); node.textContent=Math.round(e*to);
    if(p<1) requestAnimationFrame(frame); else node.textContent=to; }
  requestAnimationFrame(frame);
  // 非表示タブ等で rAF が停止しても必ず最終値に着地させる保険
  setTimeout(function(){ node.textContent=to; }, dur+250);
}
function mkCta(label,href,cls){
  var a=document.createElement((href&&!ph(href))?'a':'button'); a.className='ctabtn '+cls; a.textContent=label;
  if(href&&!ph(href)){ a.setAttribute('href',href); a.setAttribute('target','_blank'); a.setAttribute('rel','noopener'); }
  else { a.type='button'; a.disabled=true; a.style.opacity='.55'; a.textContent=label+'（準備中）'; }
  return a;
}

/* ---------- 静的テキスト差し込み ---------- */
function hydrate(){
  document.title=CONFIG.meta.title;
  txt('brandMark', CONFIG.site.name); txt('brandSub', CONFIG.site.sub);
  var h=CONFIG.hero;
  txt('heroEyebrow', h.eyebrow); txt('heroLead', h.lead); txt('heroMeta', h.meta); txt('heroCta', h.cta);
  if(h.titleLines){ el('heroTitle').innerHTML=h.titleLines.map(function(l,i){return i===h.titleLines.length-1?'<span class="accent">'+l+'</span>':l;}).join('<br>'); }
  txt('directAnswer', CONFIG.geo.directAnswer);

  // 季節バナー
  var season=seasonBand();
  if(season){ var sb=el('seasonBar'); sb.style.display='block'; txt('seasonBarEm', season.label); txt('seasonBarMsg', season.message); }

  // method
  txt('howToTitle', CONFIG.geo.howToTitle);
  var ol=el('howToList'); ol.innerHTML=''; CONFIG.geo.howToSteps.forEach(function(s){var li=document.createElement('li');li.textContent=s;ol.appendChild(li);});
  txt('methodDisclaimer', CONFIG.disclaimer.short+' '+CONFIG.disclaimer.yakkihou);

  // faq
  var fl=el('faqList'); fl.innerHTML=''; CONFIG.geo.faq.forEach(function(f){var d=document.createElement('details');d.innerHTML='<summary>'+f.q+'</summary><div class="a">'+f.a+'</div>';fl.appendChild(d);});

  // form
  var fm=CONFIG.form;
  txt('formTitle', fm.title); txt('formBody', fm.body);
  txt('lPurpose', fm.purposeLabel);
  txt('lName', fm.fields.name); txt('lEmail', fm.fields.email); txt('lTel', fm.fields.tel); txt('lMsg', fm.fields.message);
  txt('consentLabel', fm.consentLabel); el('btnSubmit').textContent=fm.submitLabel;
  txt('thanksTitle', CONFIG.thanks.title); txt('thanksBody', CONFIG.thanks.body);
  var pz=el('purposes'); pz.innerHTML='';
  fm.purposes.forEach(function(p){
    var lab=document.createElement('label'); lab.className='pchk';
    lab.innerHTML='<input type="checkbox" value="'+p.label+'"><span>'+p.label+'</span>';
    lab.querySelector('input').addEventListener('change',function(){ lab.classList.toggle('sel',this.checked); });
    pz.appendChild(lab);
  });

  // footer
  el('year').textContent='© '+String(new Date().getFullYear());
  txt('footBrand', CONFIG.footer.brandLine);
  txt('footDisclaimer', CONFIG.footer.disclaimer);
  txt('footCopyright', CONFIG.footer.copyright);

  // JSON-LD（本文と一致）
  var faqLd={"@context":"https://schema.org","@type":"FAQPage","mainEntity":CONFIG.geo.faq.map(function(f){return {"@type":"Question","name":f.q,"acceptedAnswer":{"@type":"Answer","text":f.a}};})};
  el('ld-faq').textContent=JSON.stringify(faqLd);
  var howLd={"@context":"https://schema.org","@type":"HowTo","name":CONFIG.geo.howToTitle,"step":CONFIG.geo.howToSteps.map(function(s,i){return {"@type":"HowToStep","position":i+1,"text":s};})};
  el('ld-howto').textContent=JSON.stringify(howLd);
}

/* ---------- Turnstile ---------- */
function loadTurnstile(){
  var sk=CONFIG.gas.turnstileSitekey; if(!sk||ph(sk)) return;
  var s=document.createElement('script'); s.src='https://challenges.cloudflare.com/turnstile/v0/api.js'; s.async=true; s.defer=true;
  s.onload=function(){ try{ window.turnstile.render('#turnstile-holder',{sitekey:sk,theme:'light'});}catch(e){} };
  document.head.appendChild(s);
}

/* ---------- 送信 ---------- */
function submitLead(e){
  e.preventDefault();
  var errEl=el('formErr'); errEl.textContent='';
  var f=el('leadForm');
  if(f.website.value.trim()!==''){ showThanks(); return; } // honeypot
  if(!f.name.value.trim()||!f.email.value.trim()){ errEl.textContent='お名前とメールアドレスをご入力ください。'; return; }
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())){ errEl.textContent='メールアドレスの形式をご確認ください。'; return; }
  if(!el('fConsent').checked){ errEl.textContent='プライバシーの取り扱いへの同意にチェックしてください。'; return; }
  var sk=CONFIG.gas.turnstileSitekey, needTs=sk&&!ph(sk);
  if(needTs){ var tk=document.querySelector('#turnstile-holder [name="cf-turnstile-response"]'); if(!tk||!tk.value){ errEl.textContent='セキュリティ認証（Turnstile）を完了してください。'; return; } }

  var ps=[]; document.querySelectorAll('#purposes input:checked').forEach(function(c){ps.push(c.value);});
  el('hPurpose').value=ps.join(' / ')||'（未選択）';
  el('hHost').value=location.hostname;
  el('hUa').value=navigator.userAgent;
  el('hElapsed').value=String(Date.now()-PAGE_START);

  var endpoint=CONFIG.gas.endpoint;
  var btn=el('btnSubmit'); btn.disabled=true; btn.textContent='送信中…';
  if(!endpoint||ph(endpoint)){ console.warn('[dani] GAS endpoint 未設定のため送信をスキップ。config.json の gas.endpoint を設定してください。'); showThanks(); return; }

  var fd=new FormData(f);
  fetch(endpoint,{method:'POST',body:fd,mode:'no-cors'}).then(function(){showThanks();}).catch(function(){showThanks();});
}
function showThanks(){
  el('leadForm').style.display='none';
  el('formTitle').style.display='none';
  el('formBody').style.display='none';
  el('thanks').style.display='block';
  el('thanks').scrollIntoView({behavior:'smooth',block:'center'});
}

/* ---------- スクロール連動フェードイン ---------- */
function initReveal(){
  if(reduce||!('IntersectionObserver' in window)) return;
  var io=new IntersectionObserver(function(ents){ ents.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } }); },{threshold:.12});
  document.querySelectorAll('.answer,.watch .inner,#method .steps-ol,#faq .faq').forEach(function(n){ n.classList.add('reveal'); io.observe(n); });
}

/* ---------- 起動 ---------- */
function bind(){
  el('btnNext').addEventListener('click',function(){ if(!validateStep(true))return; if(STEP===MAX_STEP){renderResult();return;} showStep(STEP+1); });
  el('btnBack').addEventListener('click',function(){ if(STEP>0) showStep(STEP-1); });
  el('btnRedo').addEventListener('click',function(){ location.href=location.pathname; });
  el('btnPrint').addEventListener('click',function(){ window.print(); });
  el('leadForm').addEventListener('submit',submitLead);
}
(function init(){
  fetch('config.json?t='+Date.now())
    .then(function(r){ if(!r.ok) throw new Error('config'); return r.json(); })
    .then(function(c){ CONFIG=c; DG=c.diagnosis; hydrate(); renderSteps(); bind(); loadTurnstile(); showStep(0,true); initReveal(); })
    .catch(function(err){ el('steps').innerHTML='<p style="color:#C7677A">設定ファイル(config.json)の読み込みに失敗しました。時間をおいて再度お試しください。</p>'; console.error(err); });
})();
// frame-busting（クリックジャッキング対策）
try{ if(window.top!==window.self){ window.top.location=window.self.location; } }catch(e){ document.documentElement.style.display='none'; }
