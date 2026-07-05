/* 送信完了ページ — 購入後/送信後のLTV導線（再診断・LINE・交換・回遊）をconfig駆動で描画。 */
(function(){
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];}); };
  var params = new URLSearchParams(location.search);
  var type = params.get('type') || '';
  var score = params.get('score') || '';
  var karte = params.get('karte') || '';

  if (type){
    var s = document.getElementById('yourType');
    if (s) s.textContent = type + (score ? '（水環境スコア ' + score + '）' : '');
    var k = document.getElementById('yourKarte');
    if (k && karte) k.textContent = 'カルテ番号：' + karte;
  } else {
    var box = document.getElementById('karteRecall');
    if (box) box.hidden = true;
  }

  fetch('../config.json?t=' + Date.now())
    .then(function(r){ return r.json(); })
    .then(render).catch(function(){});

  function render(cfg){
    var D = cfg.diagnosis || {}, line = cfg.line || {}, re = D.reexam || {}, con = D.consumable || {};

    // 再診断
    setText('#reexamHeading', re.heading);
    setText('#reexamMsg', re.message);
    setText('#reexamKeep', re.keep_karte);
    setText('#consumableMsg', con.message);

    // LINE
    var lineUrl = (line.url && line.url.indexOf('__')===-1) ? line.url : '';
    setText('#lineLabel', line.label);
    setText('#lineNote', line.note);
    var lb = document.getElementById('lineBtn');
    if (lb){
      if (lineUrl){ lb.href = lineUrl; }
      else { lb.replaceWith(spanTag('準備中（公開時にLINE導線を有効化）')); }
    }

    // 回遊（別ライン＋グループ）
    var cross = document.getElementById('crossList');
    if (cross && Array.isArray(cfg.cross)){
      cross.innerHTML = '';
      cfg.cross.forEach(function(x){
        var live = x.url && x.url.indexOf('__')===-1;
        var a = document.createElement(live ? 'a' : 'div');
        a.className = 'card'; a.style.textDecoration = 'none'; a.style.display = 'block';
        if (live){ a.href = x.url; a.target = '_blank'; a.rel = 'noopener'; }
        a.innerHTML = '<h3 style="font-size:1.05rem;margin:.1em 0 .3em">' + esc(x.title) + (live?' →':'') + '</h3>' +
                      '<p style="margin:0;color:var(--muted);font-size:.9rem">' + esc(x.desc) + '</p>';
        cross.appendChild(a);
      });
    }

    // マグちゃん本体
    var mag = document.getElementById('magLink');
    if (mag && cfg.brand && cfg.brand.site){ mag.href = cfg.brand.site; }
  }

  function setText(sel,v){ var el=document.querySelector(sel); if(el && v!=null) el.textContent = v; }
  function spanTag(t){ var s=document.createElement('span'); s.className='tag'; s.textContent=t; return s; }
})();
