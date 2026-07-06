/* shisuu/ — 「わが家のダニリスク指数」解説の config 差し込み＋Article/FAQ JSON-LD（ブラウザ内のみ） */
(function(){
  function el(id){return document.getElementById(id);}
  function txt(id,v){var e=el(id); if(e&&v!=null) e.textContent=v;}
  fetch('../config.json?t='+Date.now()).then(function(r){return r.json();}).then(function(c){
    var s=c.shisuu||{}, idx=c.index||{};
    document.title=(s.meta&&s.meta.title)||document.title;
    txt('h1', s.h1); txt('lead', s.lead); txt('definition', s.definition);
    txt('factorsTitle', s.factorsTitle); txt('bandsTitle', s.bandsTitle);
    txt('howTitle', s.howTitle); txt('howText', s.howText);
    txt('faqTitle', s.faqTitle);
    txt('citation', s.citation);
    txt('footCopyright', (c.footer&&c.footer.copyright)||'');
    txt('discBox', ((c.disclaimer&&c.disclaimer.short)||'')+' '+((c.disclaimer&&c.disclaimer.yakkihou)||''));

    // 4条件
    var fh=el('factors'); fh.innerHTML='';
    (s.factors||[]).forEach(function(f){ var d=document.createElement('div'); d.className='factor';
      d.innerHTML='<p class="fl">'+f.label+'</p><p class="ft">'+f.text+'</p>'; fh.appendChild(d); });

    // 5段階バンド
    var bh=el('bands'); bh.innerHTML=''; var prev=-1;
    (idx.bands||[]).forEach(function(b){
      var lo=prev+1, hi=b.max; prev=b.max;
      var row=document.createElement('div'); row.className='bandrow';
      row.innerHTML='<span class="sw" style="background:'+b.color+'"></span>'+
        '<span class="bl" style="color:'+b.color+'">'+b.label+'</span>'+
        '<span class="br num">'+lo+'〜'+hi+'点</span>'+
        '<span class="bt">'+b.advice+'</span>';
      bh.appendChild(row);
    });

    // FAQ（可視＋schema）
    var fl=el('faqList'); fl.innerHTML='';
    var faq=(c.geo&&c.geo.faq)?c.geo.faq.slice(0,3):[];
    // 指数固有のQ&Aを先頭に足す
    faq=[{q:'わが家のダニリスク指数は、実際のダニの数ですか？',a:'いいえ。指数は実測のダニの数ではなく、ダニが増えやすい住まいの条件（寝具・湿度・布物・感受性）がどれだけ重なっているかを0〜100で表した目安です。数値が大きいほどリスクが高めであることを示し、対策の優先順位を考えるために使います。医療診断や実測値ではありません。'}].concat(faq);
    faq.forEach(function(f){ var d=document.createElement('details'); d.innerHTML='<summary>'+f.q+'</summary><div class="a">'+f.a+'</div>'; fl.appendChild(d); });

    // JSON-LD Article
    var art={"@context":"https://schema.org","@type":"Article",
      "headline":(s.h1||'わが家のダニリスク指数とは'),
      "description":(s.meta&&s.meta.description)||'',
      "inLanguage":"ja",
      "about":{"@type":"Thing","name":"わが家のダニリスク指数"},
      "isPartOf":{"@type":"WebSite","name":"暮らしのカルテ","url":"https://kurashi-carte.jp/"},
      "mainEntityOfPage":"https://kurashi-carte.jp/dani/shisuu/",
      "publisher":(function(){var o={"@type":"Organization","name":(c.org&&c.org.name)||"暮らしのカルテ","url":"https://kurashi-carte.jp/"}; if(c.org&&c.org.legalName&&c.org.legalName.indexOf('__')!==0) o.legalName=c.org.legalName; return o;})(),
      "articleBody":(s.definition||'')+' '+(s.howText||'')};
    el('ld-article').textContent=JSON.stringify(art);
    var faqLd={"@context":"https://schema.org","@type":"FAQPage","mainEntity":faq.map(function(f){return {"@type":"Question","name":f.q,"acceptedAnswer":{"@type":"Answer","text":f.a}};})};
    el('ld-faq').textContent=JSON.stringify(faqLd);
  }).catch(function(e){ el('lead').textContent='設定の読み込みに失敗しました。'; console.error(e); });
})();
try{ if(window.top!==window.self){ window.top.location=window.self.location; } }catch(e){ document.documentElement.style.display='none'; }
