(function () {
  'use strict';

  function sha256(text) {
    if (!window.crypto || !window.crypto.subtle) return Promise.reject(new Error('Navegador sem criptografia segura.'));
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text))).then(function (buffer) {
      return Array.from(new Uint8Array(buffer)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  function alunoAtual() {
    var s = session_get();
    if (!s || s.papel !== 'aluno') return null;
    return alunos_get(s.alunoId || s.id);
  }

  function precisaDefinirSenha() {
    var aluno = alunoAtual();
    return !!aluno && !aluno.senhaHash;
  }

  function criarSessao(aluno, primeiroAcesso) {
    var sess = {
      id: aluno.id,
      nome: aluno.nome,
      email: aluno.email,
      papel: 'aluno',
      alunoId: aluno.id,
      ativo: true,
      primeiroAcesso: !!primeiroAcesso,
      criadoEm: aluno.criadoEm || new Date().toISOString()
    };
    session_set(sess);
    logAction('Login do aluno(a): ' + aluno.nome);
    return { ok:true, user:sess, primeiroAcesso:!!primeiroAcesso };
  }

  function login(aluno, senha) {
    if (!aluno || !aluno.ativo) return Promise.resolve({ ok:false, msg:'Este aluno está inativo. Procure o professor.' });
    if (!aluno.senhaHash) {
      if (!aluno.matricula || String(aluno.matricula).trim() !== String(senha || '').trim()) {
        return Promise.resolve({ ok:false, msg:'Senha incorreta. No primeiro acesso, utilize seu RGA.' });
      }
      return Promise.resolve(criarSessao(aluno, true));
    }
    return sha256(senha).then(function (digest) {
      if (digest !== aluno.senhaHash) return { ok:false, msg:'Senha incorreta.' };
      return criarSessao(aluno, false);
    }).catch(function () { return { ok:false, msg:'Não foi possível validar a senha neste navegador.' }; });
  }

  function validar(nova, confirma, aluno) {
    if (!nova || nova.length < 8) return 'A nova senha deve ter pelo menos 8 caracteres.';
    if (!/[A-Za-zÀ-ÿ]/.test(nova) || !/\d/.test(nova)) return 'Use pelo menos uma letra e um número.';
    if (nova !== confirma) return 'As senhas digitadas não são iguais.';
    if (String(nova).trim() === String(aluno.matricula || '').trim()) return 'A senha definitiva deve ser diferente do seu RGA.';
    return '';
  }

  function show(onComplete) {
    if (!precisaDefinirSenha()) { onComplete(); return; }
    var aluno = alunoAtual();
    var overlay = document.createElement('div');
    overlay.className = 'aluno-password-overlay';
    overlay.innerHTML = '<style>' + styles + '</style><div class="aluno-password-card" role="dialog" aria-modal="true" aria-labelledby="aluno-password-title">' +
      '<div class="aluno-password-icon"><i class="ti ti-lock-check"></i></div><span class="aluno-password-kicker">PRIMEIRO ACESSO</span>' +
      '<h2 id="aluno-password-title">Crie sua senha definitiva</h2><p>Olá, <b>' + escapeText(aluno.nome) + '</b>. O RGA foi usado apenas para confirmar seu primeiro acesso. Agora escolha uma senha pessoal para os próximos logins.</p>' +
      '<form id="alunoPasswordForm"><div class="field"><label for="alunoNovaSenha">Nova senha</label><div class="aluno-password-input"><i class="ti ti-lock"></i><input id="alunoNovaSenha" type="password" autocomplete="new-password" placeholder="Mínimo de 8 caracteres"><button type="button" data-toggle="alunoNovaSenha" aria-label="Mostrar senha"><i class="ti ti-eye"></i></button></div></div>' +
      '<div class="field"><label for="alunoConfirmaSenha">Confirme a nova senha</label><div class="aluno-password-input"><i class="ti ti-lock"></i><input id="alunoConfirmaSenha" type="password" autocomplete="new-password" placeholder="Digite a senha novamente"><button type="button" data-toggle="alunoConfirmaSenha" aria-label="Mostrar senha"><i class="ti ti-eye"></i></button></div></div>' +
      '<div class="aluno-password-rules"><i class="ti ti-info-circle"></i><span>Use 8 ou mais caracteres, com pelo menos uma letra e um número. Não use seu RGA.</span></div><div id="alunoPasswordError" class="aluno-password-error" role="alert"></div>' +
      '<button class="btn btn-primary btn-block" type="submit"><i class="ti ti-check"></i> Confirmar alteração</button></form><button class="aluno-password-exit" type="button"><i class="ti ti-logout"></i> Sair e fazer isso depois</button></div>';
    document.body.appendChild(overlay);
    var form = overlay.querySelector('#alunoPasswordForm');
    var novaEl = overlay.querySelector('#alunoNovaSenha');
    var confirmaEl = overlay.querySelector('#alunoConfirmaSenha');
    novaEl.focus();
    overlay.querySelectorAll('[data-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var input = overlay.querySelector('#' + button.dataset.toggle);
        input.type = input.type === 'password' ? 'text' : 'password';
        button.querySelector('i').className = input.type === 'password' ? 'ti ti-eye' : 'ti ti-eye-off';
      });
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var error = validar(novaEl.value, confirmaEl.value, aluno);
      var errorEl = overlay.querySelector('#alunoPasswordError');
      if (error) { errorEl.textContent = error; return; }
      var submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.innerHTML = '<i class="ti ti-loader-2"></i> Salvando…';
      sha256(novaEl.value).then(function (digest) {
        var result = alunos_update(aluno.id, { senhaHash:digest, senhaDefinidaEm:new Date().toISOString() });
        if (!result.ok) throw new Error(result.msg || 'Não foi possível salvar.');
        var s = session_get();
        if (s) { s.primeiroAcesso = false; session_set(s); }
        logAction('Aluno(a) definiu a senha definitiva no primeiro acesso');
        overlay.remove();
        if (window.showToast) showToast('Senha criada com sucesso.', 'success');
        onComplete();
      }).catch(function (err) {
        submit.disabled = false;
        submit.innerHTML = '<i class="ti ti-check"></i> Confirmar alteração';
        errorEl.textContent = err.message || 'Não foi possível salvar a senha.';
      });
    });
    overlay.querySelector('.aluno-password-exit').addEventListener('click', function () {
      overlay.remove(); auth_logout();
      document.querySelector('#screen-app').classList.add('hidden');
      document.querySelector('#screen-login').classList.remove('hidden');
      document.querySelector('#loginForm').reset();
    });
  }

  function escapeText(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
  }

  var styles = '\
.aluno-password-overlay{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 20% 10%,rgba(77,148,132,.24),transparent 35%),rgba(14,40,37,.96);overflow:auto}.aluno-password-card{width:min(480px,100%);background:#fff;border-radius:22px;padding:clamp(24px,5vw,38px);box-shadow:0 28px 80px rgba(0,0,0,.3);color:var(--ac-charcoal,#24312e)}.aluno-password-icon{width:64px;height:64px;border-radius:19px;display:grid;place-items:center;background:#e5f0ed;color:#1d6558;font-size:31px;margin-bottom:18px}.aluno-password-kicker{font:800 10px/1 Inter,sans-serif;letter-spacing:.16em;color:#a3712e}.aluno-password-card h2{font:600 30px/1.1 "Source Serif 4",serif;margin:8px 0 10px}.aluno-password-card>p{font-size:14px;line-height:1.6;color:var(--ac-charcoal-soft);margin:0 0 22px}.aluno-password-card .field{margin-bottom:14px}.aluno-password-input{display:flex;align-items:center;border:1px solid rgba(35,60,55,.2);border-radius:11px;padding:0 10px;background:#fff}.aluno-password-input>i{color:#66807a}.aluno-password-input input{flex:1;min-width:0;border:0!important;box-shadow:none!important;padding:11px 9px!important}.aluno-password-input button{border:0;background:transparent;color:#66807a;padding:7px;cursor:pointer}.aluno-password-rules{display:flex;gap:8px;font-size:12px;line-height:1.45;color:var(--ac-charcoal-soft);background:#f4f7f6;border-radius:10px;padding:10px;margin:4px 0 2px}.aluno-password-error{min-height:34px;padding-top:7px;color:#b84444;font-size:12px}.aluno-password-exit{display:block;margin:16px auto 0;border:0;background:transparent;color:var(--ac-charcoal-soft);font-size:12px;cursor:pointer}.aluno-password-exit:hover{text-decoration:underline}@media(max-width:520px){.aluno-password-overlay{padding:12px;align-items:start}.aluno-password-card{margin-top:12px;border-radius:17px;padding:22px 18px}}';

  window.AvalixAlunoSenha = { login:login, precisaDefinirSenha:precisaDefinirSenha, show:show };
})();
