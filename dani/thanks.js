/* thanks.html — 初回スコア記録票の表示＋再診断/回遊/LINE導線（外部API・課金なし・ブラウザ内のみ） */
(function(){
  function el(id){return document.getElementById(id);}
  function txt(id,v){var e=el(id); if(e&&v!=null) e.textContent=v;}
  function ph(v){return typeof v==='string' && v.indexOf('__')===0;}
  var P=new URLSearchParams(location.search);
  var idx=parseInt(P.get('index'),10);
  var type=P.get('type')||'';
  var band=P.get('band')||'';
  var kn=P.get('kn')||'';
  var sheets=P.get('sheets')||'';

  fetch('config.json?t='+Date.now()).then(function(r){return r.json();}).then(function(c){
    var tp=(c.thanks&&c.thanks.page)||{};
    txt('brandMark', c.site.name);
    txt('pageTitle', tp.title||'ダニ予報カードを、発行しました。');
    txt('pageLead', tp.lead||'');
    txt('footCopyright', (c.footer&&c.footer.copyright)||'');
    txt('discBox', ((c.disclaimer&&c.disclaimer.short)||'')+' '+((c.disclaimer&&c.disclaimer.yakkihou)||''));

    // 記録票（URLパラメータがあるときだけ）
    if(!isNaN(idx)){
      el('recordCard').style.display='block';
      txt('recordLabel', tp.recordLabel||'初回スコア記録票');
      txt('recKn', kn||'—');
      txt('recIdx', idx);
      txt('recIdxName', (c.index&&c.index.name)||'わが家のダニリスク指数');
      var b=el('recBand'); b.textContent=band||'—';
      // バンド色
      var bands=(c.index&&c.index.bands)||[];
      for(var i=0;i<bands.length;i++){ if(idx<=bands[i].max){ b.style.background=bands[i].color; break; } }
      var tName=(c.types&&c.types[type])?c.types[type].name:'—';
      txt('recType', tName);
      txt('recSheets', sheets? ('合計 '+sheets+' 枚（部屋別はカルテのとおり）') : '—');
      var d=new Date();
      txt('recDate', d.getFullYear()+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+('0'+d.getDate()).slice(-2));
    }

    // セクション（再診断 / 別部屋追加 / 回遊）
    var host=el('sections'); host.innerHTML='';
    var ap=c.apros||{}, line=ap.line||{}, bulk=ap.bulk||{};
    var recheckHref='index.html'+(!isNaN(idx)?('?prev='+idx):'');
    (tp.sections||[]).forEach(function(s){
      var div=document.createElement('div'); div.className='sec'+(s.key==='recheck'?' primary':'');
      var inner='<h3>'+s.title+'</h3><p>'+s.text+'</p>';
      if(s.key==='recheck'){
        inner+='<div style="display:grid;gap:9px">'+
          '<a class="cta main" href="'+recheckHref+'">'+(s.ctaLabel||'3か月後に再診断する')+' →</a>'+
          (line.url&&!ph(line.url)?'<a class="cta line" href="'+line.url+'" target="_blank" rel="noopener">'+(line.cta||'LINEでリマインドを受け取る')+'</a>':'')+
          '</div>';
      } else if(s.key==='addroom'){
        var u=(bulk.url&&!ph(bulk.url))?bulk.url:null;
        inner+=u?('<a class="cta ghost" href="'+u+'" target="_blank" rel="noopener">'+(s.ctaLabel||'別の部屋の枚数を追加する')+' →</a>')
                :('<a class="cta ghost" href="index.html">'+(s.ctaLabel||'もう一度診断して枚数を確認')+' →</a>');
      } else if(s.key==='cross'){
        inner+='<div class="crosslinks">';
        (s.links||[]).forEach(function(l){
          if(l.url&&!ph(l.url)) inner+='<a class="crosslink" href="'+l.url+'"'+(/^https?:/.test(l.url)?' target="_blank" rel="noopener"':'')+'>'+l.label+'<span class="arw">→</span></a>';
        });
        inner+='</div>';
      }
      div.innerHTML=inner; host.appendChild(div);
    });
  }).catch(function(e){ el('pageLead').textContent='設定の読み込みに失敗しました。'; console.error(e); });
})();
try{ if(window.top!==window.self){ window.top.location=window.self.location; } }catch(e){ document.documentElement.style.display='none'; }
