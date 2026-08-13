(function () {
  'use strict';

  var timers = [];
  var running = false;
  var presence = {};
  var invites = [];
  var conversations = [];
  var ONLINE_MS = 45000;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (p) { return p[0] || ''; }).join('').toUpperCase();
  }

  function current() { return typeof session_get === 'function' ? session_get() : null; }

  function allowed() {
    var s = current();
    return !!s && ['aluno', 'professor', 'admin'].indexOf(s.papel) >= 0;
  }

  function api(path, options) {
    if (typeof _supa === 'undefined' || !_supa.url || !_supa.key) return Promise.reject(new Error('Supabase indisponível'));
    options = options || {};
    var request = Object.assign({}, options, { headers:Object.assign({
      'Authorization':'Bearer ' + _supa.key,
      'apikey':_supa.key,
      'Content-Type':'application/json'
    }, options.headers || {}) });
    return fetch(_supa.url + path, request).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || ('HTTP ' + r.status)); });
      if (r.status === 204) return null;
      return r.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }

  function colleagues() {
    var db = db_load();
    var list = [];
    (db.users || []).filter(function (u) { return u.ativo && ['admin', 'professor'].indexOf(u.papel) >= 0; }).forEach(function (u) {
      list.push({ id:u.id, nome:u.nome, papel:u.papel, foto:u.fotoDataUrl || '', email:u.email || '' });
    });
    (db.alunos || []).filter(function (a) { return a.ativo; }).forEach(function (a) {
      list.push({ id:a.id, nome:a.nome, papel:'aluno', foto:a.fotoDataUrl || '', email:a.email || '' });
    });
    var s = current();
    return list.filter(function (p) { return !s || p.id !== s.id; }).sort(function (a,b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
  }

  function isOnline(id) {
    var p = presence[id];
    return !!p && Date.now() - new Date(p.ultimo_sinal).getTime() < ONLINE_MS;
  }

  function heartbeat(offline) {
    var s = current();
    if (!s || !allowed()) return Promise.resolve();
    var now = new Date(offline ? Date.now() - ONLINE_MS * 2 : Date.now()).toISOString();
    return api('/rest/v1/avalix_presenca?on_conflict=user_id', {
      method:'POST',
      headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({ user_id:s.id, nome:s.nome, papel:s.papel, ultimo_sinal:now })
    }).catch(function () {});
  }

  function loadPresence() {
    return api('/rest/v1/avalix_presenca?select=user_id,nome,papel,ultimo_sinal').then(function (rows) {
      presence = {};
      (rows || []).forEach(function (p) { presence[p.user_id] = p; });
      repaintIfOpen();
    }).catch(function () {});
  }

  function loadInvites() {
    var s = current();
    if (!s) return Promise.resolve();
    return api('/rest/v1/avalix_convites?or=(convidado_id.eq.' + encodeURIComponent(s.id) + ',remetente_id.eq.' + encodeURIComponent(s.id) + ')&order=criado_em.desc&limit=50&select=*').then(function (rows) {
      invites = rows || [];
      syncInviteNotifications();
      paintBadge();
      repaintIfOpen();
    }).catch(function () { invites = []; paintBadge(); });
  }

  function syncInviteNotifications() {
    var s=current();
    if(!s || typeof notificacoes_create!=='function') return;
    var db=db_load(), existing=db.notificacoes||[];
    pendingReceived().forEach(function(i){
      var marker='fisio-convite-'+i.id;
      if(!existing.some(function(n){return n.fisioMarker===marker;})){
        notificacoes_create(s.id,i.remetente_nome+' convidou você para jogar FisioGame.',null,'jogar');
        var updated=db_load();
        if(updated.notificacoes&&updated.notificacoes[0]) updated.notificacoes[0].fisioMarker=marker;
        db_save(updated); existing=updated.notificacoes||[];
      }
    });
    if(window.refreshNotifBadge) window.refreshNotifBadge();
    if(window.paintNotifList) window.paintNotifList();
  }

  function pairId(a,b){return [String(a),String(b)].sort().join('__');}
  function ensureConversation(person){
    var s=current(),id=pairId(s.id,person.id), first=String(s.id)<String(person.id)?{id:s.id,nome:s.nome}:{id:person.id,nome:person.nome}, second=first.id===s.id?{id:person.id,nome:person.nome}:{id:s.id,nome:s.nome};
    return api('/rest/v1/avalix_conversas?on_conflict=id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=representation'},body:JSON.stringify({id:id,participante_1_id:first.id,participante_1_nome:first.nome,participante_2_id:second.id,participante_2_nome:second.nome,atualizado_em:new Date().toISOString()})}).then(function(rows){return (rows&&rows[0])||{id:id};});
  }
  function postChat(conversation,text,type,referenceId){
    var s=current();
    return api('/rest/v1/avalix_mensagens_jogo',{method:'POST',headers:{'Prefer':'return=minimal'},body:JSON.stringify({conversa_id:conversation.id,autor_id:s.id,autor_nome:s.nome,tipo:type||'texto',texto:text,referencia_id:referenceId||null})});
  }

  function pendingReceived() {
    var s = current();
    return invites.filter(function (i) { return s && i.convidado_id === s.id && i.status === 'pendente'; });
  }

  function paintBadge() {
    var badge = document.getElementById('gameInviteBadge');
    if (!badge) return;
    var count = pendingReceived().length;
    badge.textContent = String(count);
    badge.classList.toggle('hidden', !count);
  }

  function invite(person) {
    var s = current();
    if (!s) return;
    var existing = invites.some(function (i) { return i.remetente_id === s.id && i.convidado_id === person.id && i.status === 'pendente'; });
    if (existing) { window.showToast && showToast('Você já enviou um convite para esta pessoa.', 'warning'); return; }
    var conversation;
    ensureConversation(person).then(function(c){conversation=c;return api('/rest/v1/avalix_convites', {
      method:'POST', headers:{'Prefer':'return=minimal'},
      body:JSON.stringify({ remetente_id:s.id, remetente_nome:s.nome, convidado_id:person.id, convidado_nome:person.nome, status:'pendente' })
    });}).then(function(){return postChat(conversation,s.nome+' enviou um convite para uma nova partida.','convite');}).then(function () {
      window.showToast && showToast('Convite enviado para ' + person.nome + '.', 'success');
      return loadInvites();
    }).catch(function () { window.showToast && showToast('Não foi possível enviar. Execute a migração SQL do FisioGame.', 'danger'); });
  }

  function openChat(person, container) {
    ensureConversation(person).then(function(conversation){
      container.innerHTML='<style>'+styles+chatStyles+'</style><div class="fg-chat"><div class="fg-chat-head"><button class="btn btn-ghost btn-sm" id="fgChatBack"><i class="ti ti-arrow-left"></i></button>'+avatar(person,isOnline(person.id))+'<div><b>'+esc(person.nome)+'</b><span>'+(isOnline(person.id)?'Online agora':'Offline · responderá quando voltar')+'</span></div><button class="btn btn-primary btn-sm" id="fgChatInvite"><i class="ti ti-swords"></i> Nova partida</button></div><div class="fg-chat-messages" id="fgChatMessages"></div><form class="fg-chat-form" id="fgChatForm"><input placeholder="Escreva uma mensagem" maxlength="1000"><button class="btn btn-primary" type="submit"><i class="ti ti-send"></i></button></form></div>';
      var box=container.querySelector('#fgChatMessages');
      function load(){api('/rest/v1/avalix_mensagens_jogo?conversa_id=eq.'+encodeURIComponent(conversation.id)+'&order=criado_em.asc&select=*').then(function(rows){var s=current();box.innerHTML=(rows||[]).length?(rows||[]).map(function(m){return '<div class="fg-message '+(m.autor_id===s.id?'mine':'theirs')+' '+(m.tipo!=='texto'?'event':'')+'"><span>'+esc(m.texto)+'</span><small>'+new Date(m.criado_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+'</small></div>';}).join(''):'<div class="fg-empty">Inicie a conversa ou convide para uma partida.</div>';box.scrollTop=box.scrollHeight;});}
      load(); var chatTimer=setInterval(load,5000);
      container.querySelector('#fgChatBack').onclick=function(){clearInterval(chatTimer);renderView(container);};
      container.querySelector('#fgChatInvite').onclick=function(){invite(person);};
      container.querySelector('#fgChatForm').onsubmit=function(e){e.preventDefault();var input=e.currentTarget.querySelector('input'),t=input.value.trim();if(!t)return;input.value='';postChat(conversation,t,'texto').then(load);};
    }).catch(function(){window.showToast&&showToast('Atualize as tabelas do FisioGame no Supabase para abrir o chat.','danger');});
  }

  function respondInvite(id, accept) {
    var inviteRow = invites.find(function (i) { return String(i.id) === String(id); });
    if (!inviteRow) return;
    var status = accept ? 'aceito' : 'recusado';
    api('/rest/v1/avalix_convites?id=eq.' + encodeURIComponent(id), {
      method:'PATCH', headers:{'Prefer':'return=minimal'}, body:JSON.stringify({status:status, respondido_em:new Date().toISOString()})
    }).then(function () {
      if (!accept) return null;
      return api('/rest/v1/avalix_partidas', {
        method:'POST', headers:{'Prefer':'return=representation'},
        body:JSON.stringify({ jogador_1_id:inviteRow.remetente_id, jogador_1_nome:inviteRow.remetente_nome, jogador_2_id:inviteRow.convidado_id, jogador_2_nome:inviteRow.convidado_nome, turno_id:inviteRow.remetente_id, status:'ativa', estado:{selos_1:[],selos_2:[],rodada:1} })
      });
    }).then(function (match) {
      window.showToast && showToast(accept ? 'Convite aceito. A partida foi criada.' : 'Convite recusado.', accept ? 'success' : 'warning');
      return loadInvites().then(function () { if (accept && match && match[0]) renderMatch(match[0]); });
    }).catch(function () { window.showToast && showToast('Não foi possível responder ao convite.', 'danger'); });
  }

  function avatar(person, online) {
    var photo = person.foto ? '<img src="' + esc(person.foto) + '" alt="">' : '<span>' + esc(initials(person.nome)) + '</span>';
    return '<div class="fg-avatar">' + photo + '<i class="fg-status ' + (online ? 'on' : 'off') + '" aria-label="' + (online ? 'Online' : 'Offline') + '"></i></div>';
  }

  function roleLabel(role) { return role === 'aluno' ? 'Aluno' : role === 'professor' ? 'Professor' : 'Administrador'; }

  function renderView(container) {
    if (!allowed()) {
      container.innerHTML = '<div class="card card-pad"><h2>Acesso restrito</h2><p>O FisioGame está disponível para alunos, professores e administradores.</p></div>';
      return;
    }
    var received = pendingReceived();
    var people = colleagues();
    container.innerHTML = '<style>' + styles + '</style><div class="fg-shell">' +
      '<section class="fg-hero"><div><span class="fg-kicker">FISIOGAME ONLINE</span><h2>Aprenda, desafie e conquiste as 6 áreas.</h2><p>Convide alguém da comunidade Avalix ou treine sozinho enquanto espera.</p></div><button class="btn btn-primary" id="fgSolo"><i class="ti ti-player-play"></i> Treinar sozinho</button></section>' +
      (received.length ? '<section class="fg-invites"><h3><i class="ti ti-mail-opened"></i> Convites recebidos</h3>' + received.map(function (i) { return '<div class="fg-invite"><div><b>' + esc(i.remetente_nome) + '</b><span>quer jogar uma partida com você</span></div><div><button class="btn btn-primary btn-sm" data-accept="' + esc(i.id) + '">Aceitar</button><button class="btn btn-ghost btn-sm" data-decline="' + esc(i.id) + '">Recusar</button></div></div>'; }).join('') + '</section>' : '') +
      '<section class="fg-community"><div class="fg-section-head"><div><span class="eyebrow">Comunidade</span><h3>Escolha seu adversário</h3></div><label class="fg-search"><i class="ti ti-search"></i><input id="fgSearch" placeholder="Buscar colega"></label></div>' +
      '<div class="fg-legend"><span><i class="fg-dot on"></i> Online agora</span><span><i class="fg-dot off"></i> Offline — receberá o convite ao entrar</span></div><div class="fg-grid" id="fgPeople"></div></section></div>';

    function paintPeople(filter) {
      var target = container.querySelector('#fgPeople');
      var q = String(filter || '').toLocaleLowerCase('pt-BR');
      var visible = people.filter(function (p) { return !q || p.nome.toLocaleLowerCase('pt-BR').indexOf(q) >= 0; });
      target.innerHTML = visible.length ? visible.map(function (p) {
        var online = isOnline(p.id);
        var sent = invites.some(function (i) { var s=current(); return s && i.remetente_id===s.id && i.convidado_id===p.id && i.status==='pendente'; });
        return '<article class="fg-person">' + avatar(p, online) + '<div class="fg-person-copy"><b>' + esc(p.nome) + '</b><span>' + roleLabel(p.papel) + ' · ' + (online ? 'Online' : 'Offline') + '</span></div><div class="fg-person-actions"><button class="btn btn-ghost btn-sm" data-chat="'+esc(p.id)+'"><i class="ti ti-message-circle"></i></button><button class="btn ' + (online ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-invite="' + esc(p.id) + '" ' + (sent ? 'disabled' : '') + '><i class="ti ti-swords"></i> ' + (sent ? 'Enviado' : 'Convidar') + '</button></div></article>';
      }).join('') : '<div class="fg-empty">Nenhum colega encontrado.</div>';
    }
    paintPeople('');
    container.querySelector('#fgSearch').addEventListener('input', function () { paintPeople(this.value); });
    container.querySelector('#fgSolo').addEventListener('click', function () { renderSolo(container); });
    container.querySelectorAll('[data-invite]').forEach(function (b) { b.addEventListener('click', function () { var p=people.find(function(x){return x.id===b.dataset.invite;}); if(p) invite(p); }); });
    container.querySelectorAll('[data-chat]').forEach(function (b) { b.addEventListener('click', function () { var p=people.find(function(x){return x.id===b.dataset.chat;}); if(p) openChat(p,container); }); });
    container.querySelectorAll('[data-accept]').forEach(function (b) { b.addEventListener('click', function () { respondInvite(b.dataset.accept, true); }); });
    container.querySelectorAll('[data-decline]').forEach(function (b) { b.addEventListener('click', function () { respondInvite(b.dataset.decline, false); }); });
  }

  function renderSolo(container) {
    container.innerHTML = '<style>' + styles + '</style><div class="fg-game-frame"><div class="fg-framebar"><button class="btn btn-ghost btn-sm" id="fgBack"><i class="ti ti-arrow-left"></i> Voltar à comunidade</button><span>Modo de treino · progresso salvo neste aparelho</span></div><iframe title="FisioGame — modo de treino" src="fisiogame.html"></iframe></div>';
    container.querySelector('#fgBack').addEventListener('click', function () { renderView(container); });
  }

  function renderMatch(match) {
    var container = document.getElementById('viewContent');
    if (!container) return;
    container.innerHTML = '<style>' + styles + '</style><div class="fg-match"><div class="fg-match-icon"><i class="ti ti-swords"></i></div><span class="fg-kicker">PARTIDA ONLINE CRIADA</span><h2>' + esc(match.jogador_1_nome) + ' × ' + esc(match.jogador_2_nome) + '</h2><p>A sala está pronta. O motor de perguntas sincronizadas será conectado na próxima etapa; a presença e os convites já estão funcionando.</p><button class="btn btn-primary" id="fgReturn">Voltar à comunidade</button></div>';
    container.querySelector('#fgReturn').addEventListener('click', function () { renderView(container); });
  }

  function repaintIfOpen() {
    var active = document.querySelector('.nav-item.active');
    var container = document.getElementById('viewContent');
    if (active && active.dataset.view === 'jogar' && container && !container.querySelector('.fg-game-frame') && !container.querySelector('.fg-chat')) renderView(container);
  }

  function start() {
    if (running || !allowed()) return;
    running = true;
    heartbeat(false); loadPresence(); loadInvites();
    timers.push(setInterval(function () { heartbeat(false); }, 20000));
    timers.push(setInterval(loadPresence, 8000));
    timers.push(setInterval(loadInvites, 6000));
  }

  function stop() {
    if (!running) return;
    heartbeat(true);
    timers.forEach(clearInterval); timers=[]; running=false; presence={}; invites=[]; paintBadge();
  }

  var chatStyles='.fg-person-actions{display:flex;gap:6px}.fg-chat{height:calc(100vh - 145px);min-height:560px;display:flex;flex-direction:column;max-width:860px;margin:auto;background:#fff;border:1px solid rgba(30,50,45,.1);border-radius:18px;overflow:hidden}.fg-chat-head{display:flex;align-items:center;gap:10px;padding:13px;border-bottom:1px solid rgba(30,50,45,.1)}.fg-chat-head .fg-avatar{width:40px;height:40px}.fg-chat-head>div:nth-child(3){display:grid;flex:1}.fg-chat-head span{font-size:11px;color:var(--ac-charcoal-soft)}.fg-chat-messages{flex:1;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:9px;background:#f7f8f7}.fg-message{max-width:74%;padding:9px 12px;border-radius:14px;background:#fff;align-self:flex-start;display:grid}.fg-message.mine{align-self:flex-end;background:#dceee9}.fg-message.event{align-self:center;max-width:90%;background:#fff8e8;text-align:center}.fg-message small{font-size:9px;color:var(--ac-charcoal-soft);margin-top:4px}.fg-chat-form{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(30,50,45,.1)}.fg-chat-form input{flex:1}';

  var styles = '\
.fg-shell{display:grid;gap:18px;max-width:1180px;margin:0 auto}.fg-hero{background:linear-gradient(135deg,#173f3a,#246b5f);color:#fff;border-radius:22px;padding:clamp(22px,4vw,42px);display:flex;align-items:end;justify-content:space-between;gap:24px;box-shadow:0 16px 40px rgba(23,63,58,.18)}.fg-hero h2{font-size:clamp(26px,4vw,44px);line-height:1.06;max-width:720px;margin:8px 0 10px;color:#fff}.fg-hero p{margin:0;color:rgba(255,255,255,.78);max-width:650px}.fg-kicker{font:700 11px/1.2 Inter,sans-serif;letter-spacing:.16em;color:#e7bf72}.fg-community,.fg-invites{background:var(--ac-white,#fff);border:1px solid rgba(30,50,45,.1);border-radius:18px;padding:clamp(16px,3vw,26px)}.fg-section-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:14px}.fg-section-head h3,.fg-invites h3{margin:3px 0 0}.fg-search{display:flex;align-items:center;gap:7px;border:1px solid rgba(30,50,45,.18);border-radius:10px;padding:0 10px;min-width:230px}.fg-search input{border:0!important;box-shadow:none!important;padding:9px 0!important;width:100%}.fg-legend{display:flex;gap:18px;flex-wrap:wrap;font-size:12px;color:var(--ac-charcoal-soft);margin-bottom:14px}.fg-dot,.fg-status{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}.fg-dot.on,.fg-status.on{background:#27ae60;box-shadow:0 0 0 3px rgba(39,174,96,.14)}.fg-dot.off,.fg-status.off{background:#a9b1ad}.fg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.fg-person{display:flex;align-items:center;gap:12px;border:1px solid rgba(30,50,45,.09);border-radius:14px;padding:12px;background:#fff}.fg-avatar{width:46px;height:46px;border-radius:50%;background:#e8f0ed;color:#1b594f;display:grid;place-items:center;font-weight:800;position:relative;flex:0 0 auto;overflow:visible}.fg-avatar img{width:100%;height:100%;border-radius:50%;object-fit:cover}.fg-status{position:absolute;right:-1px;bottom:1px;margin:0;border:2px solid #fff;width:11px;height:11px}.fg-person-copy{display:grid;min-width:0;flex:1}.fg-person-copy b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fg-person-copy span{font-size:12px;color:var(--ac-charcoal-soft)}.fg-invites{border-color:rgba(231,191,114,.5);background:#fffdf7}.fg-invite{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 0;border-top:1px solid rgba(30,50,45,.08)}.fg-invite>div:first-child{display:grid}.fg-invite span{font-size:13px;color:var(--ac-charcoal-soft)}.fg-invite>div:last-child{display:flex;gap:7px}.fg-empty{text-align:center;padding:32px;color:var(--ac-charcoal-soft);grid-column:1/-1}.fg-game-frame{height:calc(100vh - 118px);min-height:620px;display:flex;flex-direction:column}.fg-framebar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 0 10px;font-size:12px;color:var(--ac-charcoal-soft)}.fg-game-frame iframe{width:100%;flex:1;border:0;border-radius:18px;background:#f4f1e9}.fg-match{max-width:680px;margin:50px auto;text-align:center;background:#fff;border-radius:22px;padding:48px 28px;border:1px solid rgba(30,50,45,.1)}.fg-match-icon{width:74px;height:74px;border-radius:50%;display:grid;place-items:center;margin:0 auto 18px;background:#e7f1ee;color:#1f655a;font-size:36px}.fg-match h2{margin:9px 0}.fg-match p{color:var(--ac-charcoal-soft);margin-bottom:24px}@media(max-width:760px){.fg-hero{align-items:stretch;flex-direction:column}.fg-hero .btn{width:100%}.fg-grid{grid-template-columns:1fr}.fg-section-head{align-items:stretch;flex-direction:column}.fg-search{min-width:0}.fg-person{padding:10px}.fg-invite{align-items:flex-start;flex-direction:column}.fg-game-frame{height:calc(100vh - 92px);min-height:520px}.fg-framebar span{display:none}}';

  window.AvaliaClinViews = window.AvaliaClinViews || {};
  window.FisioGameOnline = { start:start, stop:stop, render:renderView, refresh:function(){return Promise.all([loadPresence(),loadInvites()]);} };
  window.addEventListener('beforeunload', function () { if (running) heartbeat(true); });
})();
