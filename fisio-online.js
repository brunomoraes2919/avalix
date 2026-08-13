(function () {
  'use strict';

  var timers = [];
  var running = false;
  var presence = {};
  var invites = [];
  var conversations = [];
  var matches = [];
  var ONLINE_MS = 45000;
  var GAME_CATEGORIES = [
    {id:'anatomia',name:'Anatomia',color:'#d96b5f'}, {id:'cinesio',name:'Cinesiologia',color:'#d8a83e'},
    {id:'orto',name:'Ortopedia',color:'#3b82c4'}, {id:'neuro',name:'Neurologia',color:'#8858b5'},
    {id:'cardio',name:'Cardiorrespiratória',color:'#d74c72'}, {id:'saude',name:'Saúde Coletiva e UTI',color:'#338f75'}
  ];
  var GAME_QUESTIONS = [
    {id:'a1',cat:'anatomia',q:'Quantos ossos compõem, em média, o esqueleto humano adulto?',a:['196','206','216','226'],c:1,e:'O esqueleto humano adulto possui, em média, 206 ossos.'},
    {id:'a2',cat:'anatomia',q:'Qual plano anatômico divide o corpo em partes anterior e posterior?',a:['Sagital','Transverso','Frontal','Oblíquo'],c:2,e:'O plano frontal, também chamado coronal, separa anterior e posterior.'},
    {id:'c1',cat:'cinesio',q:'Na contração concêntrica, o músculo:',a:['Encurta ao gerar tensão','Alonga sob carga','Não muda de comprimento','Não produz tensão'],c:0,e:'Na contração concêntrica, o músculo encurta enquanto vence a resistência.'},
    {id:'c2',cat:'cinesio',q:'O goniômetro é usado principalmente para medir:',a:['Força muscular','Equilíbrio','Amplitude articular','Frequência cardíaca'],c:2,e:'O goniômetro mede a amplitude de movimento articular em graus.'},
    {id:'o1',cat:'orto',q:'O ligamento cruzado anterior limita principalmente:',a:['Translação anterior da tíbia','Translação posterior da tíbia','Flexão do quadril','Extensão do tornozelo'],c:0,e:'O LCA restringe a translação anterior excessiva da tíbia.'},
    {id:'o2',cat:'orto',q:'A fratura de Colles ocorre tipicamente no:',a:['Úmero proximal','Rádio distal','Fêmur distal','Escafoide'],c:1,e:'A fratura de Colles acomete o rádio distal, frequentemente após queda com a mão estendida.'},
    {id:'n1',cat:'neuro',q:'A escala de Glasgow avalia:',a:['Dor','Consciência','Força de preensão','Equilíbrio'],c:1,e:'A escala de Glasgow avalia abertura ocular, resposta verbal e resposta motora.'},
    {id:'n2',cat:'neuro',q:'A doença de Parkinson está associada principalmente à redução de:',a:['Serotonina','Dopamina','Acetilcolina','Adrenalina'],c:1,e:'A degeneração de neurônios dopaminérgicos da substância negra é central no Parkinson.'},
    {id:'r1',cat:'cardio',q:'Em um adulto saudável, a frequência respiratória de repouso costuma ser:',a:['4–8 irpm','12–20 irpm','25–35 irpm','40–50 irpm'],c:1,e:'Em adultos, a faixa habitual de repouso é de aproximadamente 12 a 20 incursões por minuto.'},
    {id:'r2',cat:'cardio',q:'A saturação periférica de oxigênio é medida por:',a:['Espirômetro','Oxímetro de pulso','Manovacuômetro','Goniômetro'],c:1,e:'O oxímetro de pulso estima a saturação periférica de oxigênio.'},
    {id:'s1',cat:'saude',q:'A higienização das mãos é uma medida fundamental para:',a:['Aumentar força','Prevenir infecções','Medir dor','Avaliar marcha'],c:1,e:'A higiene das mãos reduz a transmissão de microrganismos e infecções relacionadas à assistência.'},
    {id:'s2',cat:'saude',q:'Na UTI, mobilização precoce busca principalmente:',a:['Prolongar sedação','Reduzir perdas funcionais','Aumentar imobilidade','Evitar avaliação'],c:1,e:'A mobilização precoce ajuda a reduzir fraqueza adquirida e perdas funcionais.'}
  ];

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

  function loadMatches() {
    var s=current(); if(!s) return Promise.resolve();
    return api('/rest/v1/avalix_partidas?or=(jogador_1_id.eq.'+encodeURIComponent(s.id)+',jogador_2_id.eq.'+encodeURIComponent(s.id)+')&status=in.(ativa,pausada,aguardando)&order=atualizado_em.desc&select=*').then(function(rows){matches=rows||[];repaintIfOpen();}).catch(function(){matches=[];});
  }

  function loadChatNotifications() {
    var s=current(); if(!s) return Promise.resolve();
    return api('/rest/v1/avalix_conversas?or=(participante_1_id.eq.'+encodeURIComponent(s.id)+',participante_2_id.eq.'+encodeURIComponent(s.id)+')&select=id').then(function(rows){
      conversations=rows||[]; if(!conversations.length) return [];
      var ids=conversations.map(function(c){return c.id;}).join(',');
      return api('/rest/v1/avalix_mensagens_jogo?conversa_id=in.('+encodeURIComponent(ids)+')&autor_id=neq.'+encodeURIComponent(s.id)+'&tipo=eq.texto&order=criado_em.desc&limit=100&select=id,autor_nome,texto,conversa_id,criado_em');
    }).then(function(messages){
      if(!messages || typeof notificacoes_create!=='function') return;
      var db=db_load(), existing=db.notificacoes||[], changed=false;
      messages.slice().reverse().forEach(function(m){
        var marker='fisio-chat-'+m.id;
        if(existing.some(function(n){return n.fisioMarker===marker;})) return;
        var preview=String(m.texto||'').trim(); if(preview.length>70) preview=preview.slice(0,67)+'…';
        notificacoes_create(s.id,'Nova mensagem de '+m.autor_nome+': '+preview,null,'jogar');
        var updated=db_load(); if(updated.notificacoes&&updated.notificacoes[0]) updated.notificacoes[0].fisioMarker=marker;
        db_save(updated); existing=updated.notificacoes||[]; changed=true;
      });
      if(changed){if(window.refreshNotifBadge)window.refreshNotifBadge();if(window.paintNotifList)window.paintNotifList();}
    }).catch(function(){});
  }

  function pickQuestion(used) {
    used=used||[]; var available=GAME_QUESTIONS.filter(function(q){return used.indexOf(q.id)<0;});
    if(!available.length) available=GAME_QUESTIONS.slice();
    return available[Math.floor(Math.random()*available.length)];
  }

  function initialState(firstTurn) {
    var q=pickQuestion([]);
    return {version:1,turno:firstTurn,questao_id:q.id,usadas:[q.id],selos_1:[],selos_2:[],acertos_1:0,acertos_2:0,rodada:1,ultima_resposta:null};
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
        body:JSON.stringify({ jogador_1_id:inviteRow.remetente_id, jogador_1_nome:inviteRow.remetente_nome, jogador_2_id:inviteRow.convidado_id, jogador_2_nome:inviteRow.convidado_nome, turno_id:inviteRow.remetente_id, status:'ativa', estado:initialState(inviteRow.remetente_id), atualizado_em:new Date().toISOString() })
      });
    }).then(function (match) {
      window.showToast && showToast(accept ? 'Convite aceito. A partida foi criada.' : 'Convite recusado.', accept ? 'success' : 'warning');
      return Promise.all([loadInvites(),loadMatches()]).then(function () { if (accept && match && match[0]) renderMatch(match[0]); });
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
      (matches.length ? '<section class="fg-invites"><h3><i class="ti ti-swords"></i> Suas partidas</h3>'+matches.map(function(m){var s=current(),other=m.jogador_1_id===s.id?m.jogador_2_nome:m.jogador_1_nome,isTurn=m.turno_id===s.id;return '<div class="fg-invite"><div><b>'+esc(other)+'</b><span>'+(isTurn?'É sua vez de responder':'Aguardando a jogada do adversário')+'</span></div><button class="btn '+(isTurn?'btn-primary':'btn-ghost')+' btn-sm" data-match="'+esc(m.id)+'">Abrir partida</button></div>';}).join('')+'</section>' : '') +
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
    container.querySelectorAll('[data-match]').forEach(function (b) { b.addEventListener('click', function () { var m=matches.find(function(x){return String(x.id)===String(b.dataset.match);}); if(m) renderMatch(m); }); });
  }

  function renderSolo(container) {
    container.innerHTML = '<style>' + styles + '</style><div class="fg-game-frame"><div class="fg-framebar"><button class="btn btn-ghost btn-sm" id="fgBack"><i class="ti ti-arrow-left"></i> Voltar à comunidade</button><span>Modo de treino · progresso salvo neste aparelho</span></div><iframe title="FisioGame — modo de treino" src="fisiogame.html"></iframe></div>';
    container.querySelector('#fgBack').addEventListener('click', function () { renderView(container); });
  }

  function renderMatch(match) {
    var container = document.getElementById('viewContent');
    if (!container) return;
    var s=current(), state=typeof match.estado==='string'?JSON.parse(match.estado):match.estado||{}, q=GAME_QUESTIONS.find(function(x){return x.id===state.questao_id;})||pickQuestion(state.usadas), mine=match.jogador_1_id===s.id, mySeals=mine?(state.selos_1||[]):(state.selos_2||[]), otherSeals=mine?(state.selos_2||[]):(state.selos_1||[]), myTurn=match.turno_id===s.id, otherName=mine?match.jogador_2_nome:match.jogador_1_nome;
    function seals(list){return GAME_CATEGORIES.map(function(c){return '<i title="'+esc(c.name)+'" style="background:'+(list.indexOf(c.id)>=0?c.color:'#dfe4e2')+'"></i>';}).join('');}
    container.innerHTML='<style>'+styles+gameStyles+'</style><div class="fg-play"><div class="fg-play-head"><button class="btn btn-ghost btn-sm" id="fgReturn"><i class="ti ti-arrow-left"></i></button><div><b>Você × '+esc(otherName)+'</b><span>Rodada '+(state.rodada||1)+'</span></div><span class="fg-turn '+(myTurn?'mine':'wait')+'">'+(myTurn?'Sua vez':'Aguardando '+esc(otherName))+'</span></div><div class="fg-score"><div><b>Você</b><span class="fg-seals">'+seals(mySeals)+'</span></div><div><b>'+esc(otherName)+'</b><span class="fg-seals">'+seals(otherSeals)+'</span></div></div>'+(myTurn?'<div class="fg-question"><span class="fg-category" style="--cat:'+((GAME_CATEGORIES.find(function(c){return c.id===q.cat;})||{}).color||'#338f75')+'">'+esc((GAME_CATEGORIES.find(function(c){return c.id===q.cat;})||{}).name||q.cat)+'</span><h2>'+esc(q.q)+'</h2><div class="fg-options">'+q.a.map(function(a,i){return '<button data-answer="'+i+'">'+String.fromCharCode(65+i)+'. '+esc(a)+'</button>';}).join('')+'</div><div id="fgAnswerNote"></div></div>':'<div class="fg-wait"><i class="ti ti-clock-pause"></i><h2>A partida está aguardando.</h2><p>'+esc(otherName)+' pode responder quando voltar ao Avalix. Você receberá a vez depois da jogada dele.</p></div>')+'</div>';
    container.querySelector('#fgReturn').addEventListener('click', function () { renderView(container); });
    container.querySelectorAll('[data-answer]').forEach(function(btn){btn.onclick=function(){answerMatch(match,state,q,Number(btn.dataset.answer),container);};});
  }

  function answerMatch(match,state,q,answer,container){
    container.querySelectorAll('[data-answer]').forEach(function(b){b.disabled=true;});
    var correct=answer===q.c, p1=match.jogador_1_id===current().id, seals=p1?(state.selos_1||[]):(state.selos_2||[]);
    if(correct&&seals.indexOf(q.cat)<0) seals.push(q.cat);
    if(p1){state.selos_1=seals;if(correct)state.acertos_1=(state.acertos_1||0)+1;}else{state.selos_2=seals;if(correct)state.acertos_2=(state.acertos_2||0)+1;}
    var won=seals.length>=6, next=match.jogador_1_id===current().id?match.jogador_2_id:match.jogador_1_id, nq=pickQuestion(state.usadas||[]);
    state.usadas=(state.usadas||[]).concat([nq.id]); state.questao_id=nq.id; state.rodada=(state.rodada||1)+1; state.ultima_resposta={por:current().id,correta:correct,questao:q.id,em:new Date().toISOString()};
    api('/rest/v1/avalix_partidas?id=eq.'+encodeURIComponent(match.id),{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({estado:state,turno_id:next,status:won?'finalizada':'ativa',atualizado_em:new Date().toISOString()})}).then(function(){window.showToast&&showToast(correct?'Resposta correta! Área conquistada.':'Resposta incorreta. A vez passou para o adversário.',correct?'success':'warning');return loadMatches();}).then(function(){renderView(container);});
  }

  function repaintIfOpen() {
    var active = document.querySelector('.nav-item.active');
    var container = document.getElementById('viewContent');
    if (active && active.dataset.view === 'jogar' && container && !container.querySelector('.fg-game-frame') && !container.querySelector('.fg-chat') && !container.querySelector('.fg-play')) renderView(container);
  }

  function start() {
    if (running || !allowed()) return;
    running = true;
    heartbeat(false); loadPresence(); loadInvites(); loadMatches(); loadChatNotifications();
    timers.push(setInterval(function () { heartbeat(false); }, 20000));
    timers.push(setInterval(loadPresence, 8000));
    timers.push(setInterval(loadInvites, 6000));
    timers.push(setInterval(loadMatches, 7000));
    timers.push(setInterval(loadChatNotifications, 6000));
  }

  function stop() {
    if (!running) return;
    heartbeat(true);
    timers.forEach(clearInterval); timers=[]; running=false; presence={}; invites=[]; paintBadge();
  }


  var gameStyles='.fg-play{max-width:900px;margin:auto}.fg-play-head,.fg-score{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid rgba(30,50,45,.1);padding:13px;border-radius:15px;margin-bottom:12px}.fg-play-head>div{display:grid;flex:1}.fg-play-head span{font-size:11px;color:var(--ac-charcoal-soft)}.fg-turn{padding:7px 10px!important;border-radius:999px;font-weight:700}.fg-turn.mine{background:#dceee9;color:#176354!important}.fg-turn.wait{background:#f2eee4;color:#76633d!important}.fg-score{justify-content:space-between}.fg-score>div{display:grid;gap:5px}.fg-score>div:last-child{text-align:right}.fg-seals{display:flex;gap:5px}.fg-seals i{width:14px;height:14px;border-radius:50%}.fg-question,.fg-wait{background:#fff;border:1px solid rgba(30,50,45,.1);border-radius:20px;padding:clamp(20px,4vw,38px)}.fg-category{display:inline-block;color:#fff;background:var(--cat);border-radius:999px;padding:6px 10px;font-size:11px;font-weight:800}.fg-question h2{margin:15px 0 22px}.fg-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fg-options button{border:1px solid rgba(30,50,45,.15);background:#fff;border-radius:12px;padding:14px;text-align:left;cursor:pointer;font-weight:600}.fg-options button:hover{border-color:#338f75;background:#edf7f4}.fg-wait{text-align:center;padding:60px 25px}.fg-wait>i{font-size:48px;color:#9b8a61}@media(max-width:600px){.fg-options{grid-template-columns:1fr}.fg-play-head{align-items:flex-start;flex-wrap:wrap}.fg-turn{width:100%;text-align:center}}';
  var chatStyles='.fg-person-actions{display:flex;gap:6px}.fg-chat{height:calc(100vh - 145px);min-height:560px;display:flex;flex-direction:column;max-width:860px;margin:auto;background:#fff;border:1px solid rgba(30,50,45,.1);border-radius:18px;overflow:hidden}.fg-chat-head{display:flex;align-items:center;gap:10px;padding:13px;border-bottom:1px solid rgba(30,50,45,.1)}.fg-chat-head .fg-avatar{width:40px;height:40px}.fg-chat-head>div:nth-child(3){display:grid;flex:1}.fg-chat-head span{font-size:11px;color:var(--ac-charcoal-soft)}.fg-chat-messages{flex:1;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:9px;background:#f7f8f7}.fg-message{max-width:74%;padding:9px 12px;border-radius:14px;background:#fff;align-self:flex-start;display:grid}.fg-message.mine{align-self:flex-end;background:#dceee9}.fg-message.event{align-self:center;max-width:90%;background:#fff8e8;text-align:center}.fg-message small{font-size:9px;color:var(--ac-charcoal-soft);margin-top:4px}.fg-chat-form{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(30,50,45,.1)}.fg-chat-form input{flex:1}';

  var styles = '\
.fg-shell{display:grid;gap:18px;max-width:1180px;margin:0 auto}.fg-hero{background:linear-gradient(135deg,#173f3a,#246b5f);color:#fff;border-radius:22px;padding:clamp(22px,4vw,42px);display:flex;align-items:end;justify-content:space-between;gap:24px;box-shadow:0 16px 40px rgba(23,63,58,.18)}.fg-hero h2{font-size:clamp(26px,4vw,44px);line-height:1.06;max-width:720px;margin:8px 0 10px;color:#fff}.fg-hero p{margin:0;color:rgba(255,255,255,.78);max-width:650px}.fg-kicker{font:700 11px/1.2 Inter,sans-serif;letter-spacing:.16em;color:#e7bf72}.fg-community,.fg-invites{background:var(--ac-white,#fff);border:1px solid rgba(30,50,45,.1);border-radius:18px;padding:clamp(16px,3vw,26px)}.fg-section-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:14px}.fg-section-head h3,.fg-invites h3{margin:3px 0 0}.fg-search{display:flex;align-items:center;gap:7px;border:1px solid rgba(30,50,45,.18);border-radius:10px;padding:0 10px;min-width:230px}.fg-search input{border:0!important;box-shadow:none!important;padding:9px 0!important;width:100%}.fg-legend{display:flex;gap:18px;flex-wrap:wrap;font-size:12px;color:var(--ac-charcoal-soft);margin-bottom:14px}.fg-dot,.fg-status{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}.fg-dot.on,.fg-status.on{background:#27ae60;box-shadow:0 0 0 3px rgba(39,174,96,.14)}.fg-dot.off,.fg-status.off{background:#a9b1ad}.fg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.fg-person{display:flex;align-items:center;gap:12px;border:1px solid rgba(30,50,45,.09);border-radius:14px;padding:12px;background:#fff}.fg-avatar{width:46px;height:46px;min-width:46px;min-height:46px;max-width:46px;max-height:46px;aspect-ratio:1/1;border-radius:50%;background:#e8f0ed;color:#1b594f;display:grid;place-items:center;font-weight:800;position:relative;flex:0 0 46px;overflow:visible}.fg-avatar img{display:block;position:absolute;inset:0;width:46px!important;height:46px!important;min-width:46px;min-height:46px;max-width:46px;max-height:46px;aspect-ratio:1/1;border-radius:50%!important;object-fit:cover!important;object-position:center}.fg-status{position:absolute;right:-1px;bottom:1px;margin:0;border:2px solid #fff;width:11px;height:11px}.fg-person-copy{display:grid;min-width:0;flex:1}.fg-person-copy b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fg-person-copy span{font-size:12px;color:var(--ac-charcoal-soft)}.fg-invites{border-color:rgba(231,191,114,.5);background:#fffdf7}.fg-invite{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 0;border-top:1px solid rgba(30,50,45,.08)}.fg-invite>div:first-child{display:grid}.fg-invite span{font-size:13px;color:var(--ac-charcoal-soft)}.fg-invite>div:last-child{display:flex;gap:7px}.fg-empty{text-align:center;padding:32px;color:var(--ac-charcoal-soft);grid-column:1/-1}.fg-game-frame{height:calc(100vh - 118px);min-height:620px;display:flex;flex-direction:column}.fg-framebar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 0 10px;font-size:12px;color:var(--ac-charcoal-soft)}.fg-game-frame iframe{width:100%;flex:1;border:0;border-radius:18px;background:#f4f1e9}.fg-match{max-width:680px;margin:50px auto;text-align:center;background:#fff;border-radius:22px;padding:48px 28px;border:1px solid rgba(30,50,45,.1)}.fg-match-icon{width:74px;height:74px;border-radius:50%;display:grid;place-items:center;margin:0 auto 18px;background:#e7f1ee;color:#1f655a;font-size:36px}.fg-match h2{margin:9px 0}.fg-match p{color:var(--ac-charcoal-soft);margin-bottom:24px}@media(max-width:760px){.fg-hero{align-items:stretch;flex-direction:column}.fg-hero .btn{width:100%}.fg-grid{grid-template-columns:1fr}.fg-section-head{align-items:stretch;flex-direction:column}.fg-search{min-width:0}.fg-person{padding:10px}.fg-invite{align-items:flex-start;flex-direction:column}.fg-game-frame{height:calc(100vh - 92px);min-height:520px}.fg-framebar span{display:none}}';

  window.AvaliaClinViews = window.AvaliaClinViews || {};
  window.FisioGameOnline = { start:start, stop:stop, render:renderView, refresh:function(){return Promise.all([loadPresence(),loadInvites()]);} };
  window.addEventListener('beforeunload', function () { if (running) heartbeat(true); });
})();
