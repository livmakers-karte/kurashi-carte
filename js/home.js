/* 母屋トップ — config.json 駆動で描画。
   ・診断カードは home.contents 配列をループ生成（ハードコードしない＝config追加で自動反映）。
   ・status:"live"→リンク有効カード／"soon"→近日公開の非リンクカード。
   ・静的HTMLにも同内容を用意（configが無くても・JSを実行しないクローラでも読める＝GEO/AEO）。
   ・外部AI・継続課金なし。エスケープしてXSSを防ぐ。 */
(function(){
  var elText = function(s){ return String(s == null ? '' : s); };
  function esc(s){ return elText(s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }
  function attr(s){ return esc(s); }
  function setText(sel, v){ var el = document.querySelector(sel); if (el && v != null) el.textContent = elText(v); }
  function isPlaceholder(u){ return !u || u.indexOf('__') !== -1; }

  fetch('config.json?t=' + Date.now())
    .then(function(r){ return r.json(); })
    .then(function(cfg){ render(cfg); })
    .catch(function(){ /* configが無くても静的HTMLは表示される */ });

  function render(cfg){
    var home = cfg.home || {};

    // hero
    setText('#heroTitle', home.hero_title);
    setText('#heroLead', home.hero_lead);
    var tagWrap = document.getElementById('heroTags');
    if (tagWrap && Array.isArray(home.hero_tags)){
      tagWrap.innerHTML = home.hero_tags.map(function(t, i){
        var cls = i === 0 ? 'tag mint' : (i === 2 ? 'tag coral' : 'tag');
        return '<span class="' + cls + '">' + esc(t) + '</span>';
      }).join(' ');
    }

    // GEO 直接回答ブロック
    if (home.geo_answer){
      setText('#geoHeading', home.geo_answer.heading);
      setText('#geoLead', home.geo_answer.lead);
      var gp = document.getElementById('geoPoints');
      if (gp && Array.isArray(home.geo_answer.points)){
        gp.innerHTML = home.geo_answer.points.map(function(p){ return '<li>' + esc(p) + '</li>'; }).join('');
      }
    }

    // 暮らしのカルテとは（3ステップ）
    if (home.about){
      setText('#aboutHeading', home.about.heading);
      setText('#aboutLead', home.about.lead);
      var as = document.getElementById('aboutSteps');
      if (as && Array.isArray(home.about.steps)){
        as.innerHTML = home.about.steps.map(function(s){
          return '<div class="step reveal">' +
                   '<span class="step-n">' + esc(s.n) + '</span>' +
                   '<h3>' + esc(s.title) + '</h3>' +
                   '<p>' + esc(s.desc) + '</p>' +
                 '</div>';
        }).join('');
      }
    }

    // 診断ラインナップ（config配列をループ／status で live・soon 出し分け）
    setText('#lineupLabel', home.sections_label);
    var live = document.getElementById('liveList');
    if (live && Array.isArray(home.contents)){
      live.innerHTML = '';
      home.contents.forEach(function(c){
        var soon = c.status === 'soon';
        var tagCls = soon ? 'tag' : 'tag coral';
        var inner =
          '<img src="' + attr(c.icon) + '" alt="" width="76" height="76">' +
          '<div>' +
            '<span class="' + tagCls + '">' + esc(c.badge || (soon ? '近日公開' : 'いま使える')) + '</span>' +
            '<h3>' + esc(c.title) + '</h3>' +
            '<p>' + esc(c.desc) + '</p>' +
            (c.connect ? '<p class="connect">→ ' + esc(c.connect) + '</p>' : '') +
            (soon
              ? '<span class="btn btn-ghost btn-soon" aria-disabled="true">' + esc(c.cta || '近日公開') + '</span>'
              : '<span class="btn btn-primary">' + esc(c.cta || '診断する') + ' →</span>') +
          '</div>';
        var card;
        if (soon){
          card = document.createElement('div');
          card.className = 'card feature is-soon reveal';
        } else {
          card = document.createElement('a');
          card.href = c.url; card.className = 'card feature reveal';
          card.style.textDecoration = 'none';
        }
        card.innerHTML = inner;
        live.appendChild(card);
      });
    }

    // upcoming（さらに広げる診断）
    var up = document.getElementById('upList');
    if (up && Array.isArray(home.upcoming)){
      setText('#upLabel', home.upcoming_label);
      up.innerHTML = '';
      home.upcoming.forEach(function(u){
        var d = document.createElement('div');
        d.className = 'tile reveal';
        d.innerHTML =
          '<img src="' + attr(u.icon) + '" alt="" width="56" height="56">' +
          '<h3>' + esc(u.title) + '</h3>' +
          '<p style="font-size:.86rem;margin:.2em 0 .5em">' + esc(u.desc) + '</p>' +
          '<span class="soon">COMING SOON</span>';
        up.appendChild(d);
      });
    }

    // LINE 導線（URLだけconfig駆動。母屋の文言はHTML側の静的コピー）
    var lineBtn = document.getElementById('lineBtn');
    if (lineBtn && cfg.line){
      if (!isPlaceholder(cfg.line.url)){
        lineBtn.href = cfg.line.url;
        lineBtn.removeAttribute('aria-disabled');
      } else {
        lineBtn.href = '#';
        lineBtn.setAttribute('aria-disabled', 'true');
        lineBtn.title = '公開時にLINE友だち追加URLを設定します';
      }
    }

    // 関連メディア（cross）
    var cr = document.getElementById('crossList');
    if (cr && Array.isArray(cfg.cross)){
      cr.innerHTML = '';
      cfg.cross.forEach(function(x){
        var a = document.createElement('a');
        a.className = 'card'; a.style.textDecoration = 'none'; a.style.display = 'block';
        a.href = isPlaceholder(x.url) ? '#' : x.url;
        if (isPlaceholder(x.url)) a.setAttribute('aria-disabled', 'true');
        a.innerHTML = '<h3 style="font-size:1.05rem;margin:.1em 0 .3em">' + esc(x.title) + ' →</h3>' +
                      '<p style="margin:0;color:var(--muted);font-size:.9rem">' + esc(x.desc) + '</p>';
        cr.appendChild(a);
      });
    }

    // 免責
    if (cfg.disclaimer){
      setText('#discKeihyo', cfg.disclaimer.keihyo);
      setText('#discMedical', cfg.disclaimer.medical);
    }

    // 運営表記
    if (cfg.site){
      setText('#footOperator', cfg.site.operator);
      setText('#footCopyright', cfg.site.copyright);
    }

    revealInit();
  }

  function revealInit(){
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)){ els.forEach(function(e){ e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function(en){
      en.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold:.12 });
    els.forEach(function(e){ io.observe(e); });
  }
})();
