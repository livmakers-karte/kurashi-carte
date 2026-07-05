/* frame-busting（クリックジャッキング対策）。
   GitHub Pages はHTTPヘッダを付与できないため、JSで最上位フレームを強制する。
   meta CSP と併せて多層防御。外部通信は一切しない。 */
(function(){
  try{
    if (window.top !== window.self){
      window.top.location = window.self.location;
    }
  }catch(e){
    document.documentElement.style.display = 'none';
    window.location = window.self.location.href;
  }
})();
