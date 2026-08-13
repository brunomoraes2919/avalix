(function () {
  'use strict';

  /* Somente o hash da chave beta fica no código. */
  var ACCESS_HASH = '5a490a3d0a12c9f17155a1c0880c9ad9ba9d57aadb89e53ddf553ab56f1638da';
  var ACCESS_SESSION_KEY = 'avalix_fisiogame_beta_access_v1';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function normalized(value) {
    return String(value || '').trim().toUpperCase();
  }

  function hash(value) {
    if (!window.crypto || !window.crypto.subtle) return Promise.resolve('');
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized(value))).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  function hasAccess() {
    return sessionStorage.getItem(ACCESS_SESSION_KEY) === ACCESS_HASH;
  }

  function renderGate(container, message) {
    container.innerHTML = '<style>' + styles + '</style>' +
      '<section class="fg-beta"><div class="fg-beta-glow one"></div><div class="fg-beta-glow two"></div>' +
      '<div class="fg-beta-card"><div class="fg-beta-mark"><i class="ti ti-device-gamepad-2"></i></div>' +
      '<span class="fg-beta-kicker">FISIOGAME</span><h2>Uma nova forma de aprender está chegando.</h2>' +
      '<p class="fg-beta-lead">Desafie colegas, conquiste as áreas da fisioterapia e transforme revisão em competição.</p>' +
      '<div class="fg-beta-tags"><span><i class="ti ti-users"></i> Multijogador</span><span><i class="ti ti-bolt"></i> Tempo real</span><span><i class="ti ti-trophy"></i> 6 áreas clínicas</span></div>' +
      '<div class="fg-beta-access"><div><b>Acesso antecipado</b><span>Esta versão está disponível apenas para testadores convidados.</span></div>' +
      '<form id="fgBetaForm"><label for="fgBetaKey">Chave de acesso</label><div class="fg-beta-input"><i class="ti ti-key"></i><input id="fgBetaKey" type="password" autocomplete="off" spellcheck="false" placeholder="Digite sua chave"><button class="btn btn-primary" type="submit">Entrar</button></div><p id="fgBetaError" class="fg-beta-error">' + esc(message || '') + '</p></form></div>' +
      '<small>Em breve para toda a comunidade Avalix.</small></div></section>';
    var form = container.querySelector('#fgBetaForm');
    var input = container.querySelector('#fgBetaKey');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var button = form.querySelector('button');
      button.disabled = true;
      hash(input.value).then(function (result) {
        if (result === ACCESS_HASH) {
          sessionStorage.setItem(ACCESS_SESSION_KEY, ACCESS_HASH);
          renderGame(container);
        } else {
          button.disabled = false;
          input.value = '';
          input.focus();
          container.querySelector('#fgBetaError').textContent = 'Chave inválida. Confira e tente novamente.';
          container.querySelector('.fg-beta-input').classList.add('invalid');
        }
      });
    });
  }

  function renderGame(container) {
    if (window.FisioGameOnline) {
      window.FisioGameOnline.start();
      window.FisioGameOnline.render(container);
      return;
    }
    container.innerHTML = '<style>' + styles + '</style><div class="fg-game-frame">' +
      '<div class="fg-framebar"><div><span class="fg-live-dot"></span><b>Beta fechado</b><span>Acesso liberado nesta sessão</span></div><button class="btn btn-ghost btn-sm" id="fgLock"><i class="ti ti-lock"></i> Bloquear acesso</button></div>' +
      '<iframe title="FisioGame — beta fechado" src="fisiogame.html"></iframe></div>';
    container.querySelector('#fgLock').addEventListener('click', function () {
      sessionStorage.removeItem(ACCESS_SESSION_KEY);
      renderGate(container);
    });
  }

  function render(container) {
    var session = typeof session_get === 'function' ? session_get() : null;
    if (!session || ['aluno', 'professor', 'admin'].indexOf(session.papel) < 0) {
      container.innerHTML = '<div class="card card-pad"><h2>Acesso restrito</h2><p>O FisioGame é exclusivo para alunos, professores e administradores cadastrados.</p></div>';
      return;
    }
    if (hasAccess()) renderGame(container); else renderGate(container);
  }

  var styles = '\
.fg-beta{min-height:calc(100vh - 150px);display:grid;place-items:center;position:relative;overflow:hidden;border-radius:22px;background:radial-gradient(circle at 20% 15%,rgba(70,150,130,.22),transparent 35%),linear-gradient(145deg,#102d2a,#1d5149 62%,#173b37);padding:28px}.fg-beta-glow{position:absolute;border-radius:50%;filter:blur(8px);opacity:.28;pointer-events:none}.fg-beta-glow.one{width:330px;height:330px;background:#e3b963;right:-120px;top:-150px}.fg-beta-glow.two{width:240px;height:240px;background:#77c7b5;left:-100px;bottom:-100px}.fg-beta-card{position:relative;z-index:1;width:min(680px,100%);text-align:center;color:#fff}.fg-beta-mark{width:78px;height:78px;margin:0 auto 18px;border-radius:24px;display:grid;place-items:center;font-size:38px;color:#153d38;background:linear-gradient(145deg,#f5d796,#d9ac55);box-shadow:0 18px 50px rgba(0,0,0,.25);transform:rotate(-3deg)}.fg-beta-kicker{font:800 11px/1 Inter,sans-serif;letter-spacing:.22em;color:#e8c679}.fg-beta h2{font:600 clamp(31px,5vw,52px)/1.05 "Source Serif 4",serif;color:#fff;margin:11px auto 13px;max-width:650px}.fg-beta-lead{font-size:clamp(15px,2vw,18px);line-height:1.6;color:rgba(255,255,255,.74);max-width:600px;margin:0 auto}.fg-beta-tags{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:24px 0}.fg-beta-tags span{display:flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);border-radius:999px;padding:7px 12px;font-size:12px;color:rgba(255,255,255,.82)}.fg-beta-access{margin:28px auto 18px;padding:20px;text-align:left;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(7,30,27,.5);backdrop-filter:blur(12px);max-width:560px}.fg-beta-access>div{display:grid;margin-bottom:15px}.fg-beta-access>div b{font-size:15px}.fg-beta-access>div span{font-size:12px;color:rgba(255,255,255,.62);margin-top:3px}.fg-beta-access label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.64);margin:0 0 6px}.fg-beta-input{display:flex;align-items:center;gap:9px;background:#fff;border:2px solid transparent;border-radius:12px;padding:4px 4px 4px 12px;transition:.2s}.fg-beta-input.invalid{border-color:#df6d6d;animation:fgshake .25s linear}.fg-beta-input>i{color:#54726d}.fg-beta-input input{flex:1;min-width:0;border:0!important;box-shadow:none!important;padding:9px 0!important;font:700 14px/1 Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase}.fg-beta-input .btn{white-space:nowrap}.fg-beta-error{min-height:18px;margin:7px 2px 0;color:#ffb9b9;font-size:12px}.fg-beta-card>small{color:rgba(255,255,255,.46)}.fg-game-frame{height:calc(100vh - 118px);min-height:610px;display:flex;flex-direction:column}.fg-framebar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:0 0 10px}.fg-framebar>div{display:flex;align-items:center;gap:8px;font-size:12px}.fg-framebar>div>span:last-child{color:var(--ac-charcoal-soft)}.fg-live-dot{width:8px;height:8px;border-radius:50%;background:#29a56f;box-shadow:0 0 0 4px rgba(41,165,111,.13)}.fg-game-frame iframe{width:100%;flex:1;border:0;border-radius:18px;background:#f4f1e9}@keyframes fgshake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}@media(max-width:650px){.fg-beta{min-height:calc(100vh - 110px);padding:20px 14px;border-radius:15px}.fg-beta-access{padding:15px}.fg-beta-input{display:grid;grid-template-columns:auto 1fr}.fg-beta-input .btn{grid-column:1/-1;width:100%}.fg-beta-tags{margin:18px 0}.fg-game-frame{height:calc(100vh - 88px);min-height:520px}.fg-framebar>div>span:last-child{display:none}}';

  window.AvaliaClinViews = window.AvaliaClinViews || {};
  window.AvaliaClinViews.jogar = render;
})();
