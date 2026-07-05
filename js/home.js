/* 母屋トップ — config.json 駆動でコンテンツ一覧を描画。外部AI・継続課金なし。 */
(function(){
  var elText = function(s){ return String(s == null ? '' : s); };

  fetch('config.json?t=' + Date.now())
    .then(function(r){ return r.json(); })
    .then(function(cfg){ render(cfg); })
    .catch(function(){ /* configが無くても静的テキストは表示される */ });

  function render(cfg){
    var home = cfg.home || {};
    // hero
    setText('#heroTitle', home.hero_title);
    setText('#heroLead', home.hero_lead);

    // live contents
    var live = document.getElementById('liveList');
    if (live && Array.isArray(home.contents)){
      live.innerHTML = '';
      home.contents.forEach(function(c){
        var a = document.createElement('a');
        a.href = c.url; a.className = 'card feature reveal'; a.style.textDecoration = 'none';
        a.innerHTML =
          '<img src="' + attr(c.icon) + '" alt="" width="76" height="76">' +
          '<div>' +
            '<span class="tag coral">' + esc(c.badge || 'いま使える') + '</span>' +
            '<h3 style="margin:.4em 0 .3em;font-size:1.25rem">' + esc(c.title) + '</h3>' +
            '<p style="margin:.2em 0 .8em;color:#33454a">' + esc(c.desc) + '</p>' +
            '<span class="btn btn-primary">' + esc(c.cta || '診断する') + ' →</span>' +
          '</div>';
        live.appendChild(a);
      });
    }

    // upcoming
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

    // cross links
    var cr = document.getElementById('crossList');
    if (cr && Array.isArray(cfg.cross)){
      cr.innerHTML = '';
      cfg.cross.forEach(function(x){
        var a = document.createElement('a');
        a.className = 'card'; a.style.textDecoration = 'none'; a.style.display = 'block';
        a.href = (x.url && x.url.indexOf('__') === -1) ? x.url : '#';
        a.innerHTML = '<h3 style="font-size:1.05rem;margin:.1em 0 .3em">' + esc(x.title) + ' →</h3>' +
                      '<p style="margin:0;color:var(--muted);font-size:.9rem">' + esc(x.desc) + '</p>';
        cr.appendChild(a);
      });
    }

    // disclaimer
    if (cfg.disclaimer){
      setText('#discKeihyo', cfg.disclaimer.keihyo);
      setText('#discMedical', cfg.disclaimer.medical);
    }

    revealInit();
  }

  function setText(sel, v){ var el = document.querySelector(sel); if (el && v != null) el.textContent = elText(v); }
  function esc(s){ return elText(s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }
  function attr(s){ return esc(s); }

  function revealInit(){
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)){ els.forEach(function(e){ e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function(en){
      en.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold:.12 });
    els.forEach(function(e){ io.observe(e); });
  }
})();
