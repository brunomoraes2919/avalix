(function () {
  'use strict';

  var timers = [];
  var running = false;
  var presence = {};
  var invites = [];
  var conversations = [];
  var matches = [];
  var pendingResult = null;
  var gameProfile = null;
  var gameRanking = [];
  var ONLINE_MS = 45000;
  var audioActive=false;
  var audioState={ctx:null,musicTimer:null,musicStep:0,music:localStorage.getItem('fg_music')!=='off',sfx:localStorage.getItem('fg_sfx')!=='off',volume:Math.min(1,Math.max(.82,Number(localStorage.getItem('fg_volume')||.82))),mode:'ambient'};
  function audioContext(){if(!audioState.ctx){var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;audioState.ctx=new AC();}if(audioState.ctx.state==='suspended')audioState.ctx.resume();return audioState.ctx;}
  function tone(freq,duration,type,gain,delay){var c=audioContext();if(!c)return;var o=c.createOscillator(),g=c.createGain(),now=c.currentTime+(delay||0);o.type=type||'sine';o.frequency.setValueAtTime(freq,now);g.gain.setValueAtTime(0.0001,now);g.gain.exponentialRampToValueAtTime(Math.max(.0001,(gain||.08)*audioState.volume),now+.018);g.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(g);g.connect(c.destination);o.start(now);o.stop(now+duration+.03);}
  function sound(name){if(!audioActive||!audioState.sfx)return;var notes={click:[[520,.07,'sine',.035,0]],tick:[[720,.035,'square',.018,0]],spin:[[110,.75,'sawtooth',.022,0],[165,.7,'triangle',.035,.05],[220,.6,'triangle',.03,.12]],land:[[660,.12,'sine',.07,0],[880,.22,'sine',.07,.1]],question:[[392,.11,'triangle',.05,0],[523,.13,'triangle',.06,.08],[659,.24,'sine',.06,.17]],turn:[[330,.1,'sine',.04,0],[440,.17,'sine',.05,.09]],correct:[[523,.13,'triangle',.08,0],[659,.13,'triangle',.08,.09],[784,.27,'triangle',.09,.18]],wrong:[[220,.18,'sawtooth',.045,0],[165,.28,'sawtooth',.04,.13]],defeat:[[294,.22,'triangle',.055,0],[247,.28,'sine',.05,.18],[196,.52,'sine',.045,.4]],message:[[740,.09,'sine',.05,0],[988,.12,'sine',.04,.08]],unlock:[[523,.14,'triangle',.07,0],[659,.14,'triangle',.07,.1],[784,.14,'triangle',.08,.2],[1047,.36,'sine',.08,.3]],victory:[[392,.12,'triangle',.07,0],[523,.12,'triangle',.08,.1],[659,.14,'triangle',.08,.2],[784,.4,'sine',.1,.32]]};(notes[name]||notes.click).forEach(function(n){tone.apply(null,n);});}
  function musicVoice(freq,duration,type,gain,delay,cutoff){var c=audioContext();if(!c)return;var o=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain(),n=c.currentTime+(delay||0);o.type=type||'sine';o.frequency.setValueAtTime(freq,n);f.type='lowpass';f.frequency.setValueAtTime(cutoff||1800,n);f.Q.value=.8;g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(Math.max(.0001,(gain||.025)*audioState.volume),n+.025);g.gain.exponentialRampToValueAtTime(.0001,n+duration);o.connect(f);f.connect(g);g.connect(c.destination);o.start(n);o.stop(n+duration+.04);}
  function musicKick(delay){var c=audioContext();if(!c)return;var o=c.createOscillator(),g=c.createGain(),n=c.currentTime+(delay||0);o.type='sine';o.frequency.setValueAtTime(120,n);o.frequency.exponentialRampToValueAtTime(45,n+.13);g.gain.setValueAtTime(.075*audioState.volume,n);g.gain.exponentialRampToValueAtTime(.0001,n+.18);o.connect(g);g.connect(c.destination);o.start(n);o.stop(n+.2);}
  function musicBeat(){if(!audioActive||!audioState.music)return;var i=audioState.musicStep++,mode=audioState.mode;if(mode==='match'){var bass=[110,110,130.81,146.83,98,98,123.47,146.83],pluck=[440,659.25,523.25,783.99,392,587.33,493.88,739.99];if(i%2===0)musicKick(0);musicVoice(bass[i%8],.25,'sawtooth',.024,0,420);musicVoice(pluck[i%8],.12,'triangle',.038,.035,2400);if(i%4===2)musicVoice(pluck[i%8]*2,.055,'square',.012,.02,3600);return;}if(mode==='victory'){var up=[523.25,659.25,783.99,1046.5,783.99,987.77,1174.66,1318.51];musicKick(0);musicVoice(up[i%8],.18,'triangle',.05,.02,3200);musicVoice(up[(i+2)%8]/2,.42,'sine',.025,0,1500);return;}if(mode==='defeat'){var down=[329.63,293.66,261.63,246.94,220,246.94,196,174.61];if(i%2===0)musicVoice(down[i%8]/2,.95,'sine',.025,0,650);musicVoice(down[i%8],.48,'triangle',.028,.04,1250);return;}var roots=[220,246.94,196,220],chords=[[440,523.25,659.25],[493.88,587.33,739.99],[392,493.88,587.33],[440,523.25,659.25]],ch=chords[Math.floor(i/8)%4];if(i%8===0){musicVoice(roots[Math.floor(i/8)%4],1.8,'sine',.022,0,550);ch.forEach(function(n,j){musicVoice(n,1.7,'sine',.014,j*.025,1350);});}var sparkle=[659.25,0,783.99,0,587.33,0,523.25,0][i%8];if(sparkle)musicVoice(sparkle,.16,'triangle',.018,.03,2600);}
  function startMusic(){if(!audioActive)return;audioContext();if(!audioState.musicTimer){musicBeat();var speed=audioState.mode==='victory'?260:audioState.mode==='match'?270:audioState.mode==='defeat'?620:430;audioState.musicTimer=setInterval(musicBeat,speed);}}
  function stopMusic(){if(audioState.musicTimer){clearInterval(audioState.musicTimer);audioState.musicTimer=null;}}
  function refreshSoundDock(){var d=document.getElementById('fgSoundDock');if(!d)return;d.querySelector('[data-fg-music]').classList.toggle('off',!audioState.music);d.querySelector('[data-fg-sfx]').classList.toggle('off',!audioState.sfx);d.querySelector('[data-fg-music] i').className='ti '+(audioState.music?'ti-music':'ti-music-off');d.querySelector('[data-fg-sfx] i').className='ti '+(audioState.sfx?'ti-volume':'ti-volume-off');}
  function ensureSoundDock(){if(document.getElementById('fgSoundDock'))return;var style=document.createElement('style');style.textContent='.fg-sound-dock{position:fixed;right:18px;bottom:18px;z-index:9998;display:flex;gap:7px;padding:7px;border-radius:16px;background:rgba(19,60,55,.9);box-shadow:0 12px 30px rgba(12,45,41,.25);backdrop-filter:blur(12px)}.fg-sound-dock button{width:39px;height:39px;border:1px solid rgba(255,255,255,.25);border-radius:11px;background:#f0c861;color:#173f3a;font-size:18px;cursor:pointer;transition:.2s}.fg-sound-dock button:hover{transform:translateY(-2px)}.fg-sound-dock button.off{background:rgba(255,255,255,.1);color:#fff}@media(max-width:600px){.fg-sound-dock{right:10px;bottom:74px;transform:scale(.9);transform-origin:right bottom}}';document.head.appendChild(style);var d=document.createElement('div');d.id='fgSoundDock';d.className='fg-sound-dock';d.innerHTML='<button data-fg-music title="Música de fundo"><i class="ti ti-music"></i></button><button data-fg-sfx title="Efeitos sonoros"><i class="ti ti-volume"></i></button>';document.body.appendChild(d);d.querySelector('[data-fg-music]').onclick=function(){audioState.music=!audioState.music;localStorage.setItem('fg_music',audioState.music?'on':'off');if(audioState.music)startMusic();else stopMusic();refreshSoundDock();sound('click');};d.querySelector('[data-fg-sfx]').onclick=function(){audioState.sfx=!audioState.sfx;localStorage.setItem('fg_sfx',audioState.sfx?'on':'off');refreshSoundDock();sound('click');};refreshSoundDock();}
  function setMusicMode(mode){mode=['ambient','match','victory','defeat'].indexOf(mode)>=0?mode:'ambient';if(audioState.mode===mode)return;stopMusic();audioState.mode=mode;audioState.musicStep=0;if(audioActive&&audioState.music)startMusic();}
  function setAudioActive(active){audioActive=!!active;if(audioActive){ensureSoundDock();setMusicMode('ambient');if(audioState.music)startMusic();}else{stopMusic();var dock=document.getElementById('fgSoundDock');if(dock)dock.remove();}}
  window.FisioGameAudio={sound:sound,start:startMusic,stop:stopMusic,setMode:setMusicMode,state:audioState};
  var GAME_CATEGORIES = [
    {id:'anatomia',name:'Anatomia',color:'#d96b5f'}, {id:'cinesio',name:'Cinesiologia',color:'#d8a83e'},
    {id:'orto',name:'Ortopedia',color:'#3b82c4'}, {id:'neuro',name:'Neurologia',color:'#8858b5'},
    {id:'cardio',name:'Cardiorrespiratória',color:'#d74c72'}, {id:'saude',name:'Saúde Coletiva',color:'#338f75'},
    {id:'hospitalar',name:'Hospitalar',color:'#5869b2'}, {id:'esportiva',name:'Fisioterapia Esportiva',color:'#df7b32'}
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
    {id:'s1',cat:'saude',q:'Na Atenção Primária à Saúde, uma ação coerente com a atuação fisioterapêutica coletiva é:',a:['Restringir-se ao hospital','Desenvolver promoção e prevenção','Atuar apenas após cirurgias','Substituir a equipe'],c:1,e:'Na Atenção Primária, a fisioterapia atua em promoção da saúde, prevenção de agravos e cuidado coletivo.'},
    {id:'s2',cat:'saude',q:'A educação em saúde realizada com a comunidade busca principalmente:',a:['Aumentar dependência','Favorecer autonomia e práticas saudáveis','Eliminar o trabalho em equipe','Substituir avaliações'],c:1,e:'A educação em saúde fortalece autonomia, participação e práticas de cuidado.'},
    {id:'h1',cat:'hospitalar',q:'No ambiente hospitalar, a mobilização precoce busca principalmente:',a:['Prolongar imobilidade','Reduzir perdas funcionais da internação','Evitar avaliação','Manter sedação'],c:1,e:'A mobilização precoce auxilia na prevenção de fraqueza e perdas funcionais durante a internação.'},
    {id:'h2',cat:'hospitalar',q:'A higienização das mãos antes e após o contato com o paciente contribui para:',a:['Aumentar força','Prevenir infecções assistenciais','Medir amplitude','Avaliar equilíbrio'],c:1,e:'A higiene das mãos é central na prevenção da transmissão de microrganismos no hospital.'},
    {id:'e1',cat:'esportiva',q:'O retorno seguro ao esporte deve considerar principalmente:',a:['Apenas o tempo','Critérios funcionais e avaliação clínica','Somente a vontade do atleta','Ausência de exercícios'],c:1,e:'O retorno seguro considera critérios funcionais, avaliação clínica e as demandas do esporte.'},
    {id:'e2',cat:'esportiva',q:'O treinamento neuromuscular pode prevenir lesões ao melhorar:',a:['Somente massa corporal','Controle motor, força e estabilidade','Só frequência respiratória','Apenas flexibilidade passiva'],c:1,e:'O treinamento neuromuscular trabalha controle motor, força, equilíbrio e estabilidade.'}
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

  var ACHIEVEMENTS = [
    {id:'primeiro_passo',icon:'ti-sparkles',name:'Primeiro passo',desc:'Responda sua primeira pergunta.',test:function(p){return p.perguntas>=1;}},
    {id:'mente_afiada',icon:'ti-brain',name:'Mente afiada',desc:'Acerte 10 perguntas.',test:function(p){return p.acertos>=10;}},
    {id:'em_chamas',icon:'ti-flame',name:'Em chamas',desc:'Estude por 3 dias seguidos.',test:function(p){return p.sequencia_dias>=3;}},
    {id:'primeira_vitoria',icon:'ti-trophy',name:'Primeira vitória',desc:'Vença sua primeira partida.',test:function(p){return p.vitorias>=1;}},
    {id:'residente',icon:'ti-stethoscope',name:'Residente FisioGame',desc:'Alcance o nível 5.',test:function(p){return levelOf(p.xp)>=5;}},
    {id:'especialista',icon:'ti-award',name:'Especialista',desc:'Acerte 50 perguntas.',test:function(p){return p.acertos>=50;}},
    {id:'invicto',icon:'ti-crown',name:'Sequência de vitórias',desc:'Vença 5 partidas.',test:function(p){return p.vitorias>=5;}},
    {id:'veterano',icon:'ti-shield-check',name:'Veterano clínico',desc:'Conclua 20 partidas.',test:function(p){return p.partidas>=20;}}
  ];

  function levelOf(xp) { return Math.max(1, Math.floor(Math.sqrt(Math.max(0, Number(xp)||0) / 100)) + 1); }
  function levelStart(level) { return Math.pow(Math.max(0, level-1), 2) * 100; }
  function levelEnd(level) { return Math.pow(level, 2) * 100; }
  function todayKey() { return new Date().toISOString().slice(0,10); }
  function seasonKey() { return todayKey().slice(0,7); }
  function turmaAtualId() {
    var s=current(), db=typeof db_load==='function'?db_load():{};
    if(!s || s.papel!=='aluno') return null;
    var aluno=(db.alunos||[]).find(function(a){return a.id===s.id || a.id===s.alunoId;});
    return aluno ? (aluno.turmaId || null) : null;
  }
  function defaultProfile() {
    var s=current();
    return {user_id:s.id,nome:s.nome,papel:s.papel,turma_id:turmaAtualId(),xp:0,moedas:0,perguntas:0,acertos:0,partidas:0,vitorias:0,derrotas:0,desistencias:0,sequencia_dias:0,ultimo_dia:null,temporada_id:seasonKey(),temporada_pontos:0,estatisticas:{},conquistas:[],missoes:{dia:todayKey(),respostas:0,acertos:0,partidas:0}};
  }
  function normalizeProfile(p) {
    p=Object.assign(defaultProfile(),p||{});
    if(typeof p.estatisticas==='string'){try{p.estatisticas=JSON.parse(p.estatisticas);}catch(e){p.estatisticas={};}}
    if(typeof p.conquistas==='string'){try{p.conquistas=JSON.parse(p.conquistas);}catch(e){p.conquistas=[];}}
    if(typeof p.missoes==='string'){try{p.missoes=JSON.parse(p.missoes);}catch(e){p.missoes={};}}
    if(!Array.isArray(p.conquistas))p.conquistas=[];
    if(!p.missoes || p.missoes.dia!==todayKey())p.missoes={dia:todayKey(),respostas:0,acertos:0,partidas:0};
    if(p.temporada_id!==seasonKey()){p.temporada_id=seasonKey();p.temporada_pontos=0;}
    return p;
  }
  function unlockAchievements(p) {
    var unlocked=[];
    ACHIEVEMENTS.forEach(function(a){if(a.test(p)&&p.conquistas.indexOf(a.id)<0){p.conquistas.push(a.id);unlocked.push(a);}});
    return unlocked;
  }
  function saveProfile(p) {
    p=normalizeProfile(p); p.nome=current().nome; p.papel=current().papel; p.turma_id=turmaAtualId(); p.atualizado_em=new Date().toISOString();
    gameProfile=p;
    return api('/rest/v1/avalix_jogo_perfis?on_conflict=user_id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=representation'},body:JSON.stringify(p)}).then(function(rows){gameProfile=normalizeProfile(rows&&rows[0]||p);return gameProfile;});
  }
  function loadGameProfile() {
    var s=current(); if(!s)return Promise.resolve(null);
    if(s.papel==='admin'){gameProfile=normalizeProfile(defaultProfile());return Promise.resolve(gameProfile);}
    return api('/rest/v1/avalix_jogo_perfis?user_id=eq.'+encodeURIComponent(s.id)+'&select=*').then(function(rows){
      if(rows&&rows[0]){gameProfile=normalizeProfile(rows[0]);return gameProfile;}
      return saveProfile(defaultProfile());
    }).catch(function(){gameProfile=normalizeProfile(gameProfile||defaultProfile());return gameProfile;});
  }
  function loadRanking() {
    return api('/rest/v1/avalix_jogo_perfis?temporada_id=eq.'+encodeURIComponent(seasonKey())+'&papel=neq.admin&order=temporada_pontos.desc,xp.desc&limit=100&select=*').then(function(rows){gameRanking=(rows||[]).filter(function(p){return p.papel!=='admin';}).map(normalizeProfile);return gameRanking;}).catch(function(){return gameRanking.filter(function(p){return p.papel!=='admin';});});
  }
  function recordAnswer(correct,category,won,opponentId) {
    if(current()&&current().papel==='admin')return Promise.resolve(normalizeProfile(gameProfile||defaultProfile()));
    return loadGameProfile().then(function(p){
      var previousLevel=levelOf(p.xp);
      var yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10), today=todayKey();
      if(p.ultimo_dia!==today){p.sequencia_dias=p.ultimo_dia===yesterday?(p.sequencia_dias||0)+1:1;p.ultimo_dia=today;}
      p.perguntas++; p.missoes.respostas=(p.missoes.respostas||0)+1;
      p.estatisticas[category]=p.estatisticas[category]||{perguntas:0,acertos:0}; p.estatisticas[category].perguntas++;
      p.xp+=correct?25:8; p.temporada_pontos+=correct?10:2; p.moedas+=correct?5:1;
      if(correct){p.acertos++;p.missoes.acertos=(p.missoes.acertos||0)+1;p.estatisticas[category].acertos++;}
      if(won){p.vitorias++;p.partidas++;p.missoes.partidas=(p.missoes.partidas||0)+1;p.xp+=100;p.temporada_pontos+=50;p.moedas+=30;}
      if(p.missoes.respostas>=5&&!p.missoes.premio_respostas){p.missoes.premio_respostas=true;p.xp+=25;p.moedas+=10;}
      if(p.missoes.acertos>=3&&!p.missoes.premio_acertos){p.missoes.premio_acertos=true;p.xp+=35;p.moedas+=15;}
      if(p.missoes.partidas>=1&&!p.missoes.premio_partida){p.missoes.premio_partida=true;p.xp+=50;p.moedas+=20;}
      var unlocked=unlockAchievements(p);
      return saveProfile(p).then(function(saved){
        if(levelOf(saved.xp)>previousLevel&&window.showToast)showToast('Novo nível alcançado: '+levelOf(saved.xp)+'!','success');
        if(unlocked.length&&window.showToast)showToast('Conquista desbloqueada: '+unlocked[0].name+'!','success');
        if(won&&opponentId)recordOpponentLoss(opponentId);
        return saved;
      });
    });
  }
  function recordOpponentLoss(userId) {
    api('/rest/v1/avalix_jogo_perfis?user_id=eq.'+encodeURIComponent(userId)+'&select=*').then(function(rows){
      if(!rows||!rows[0]||rows[0].papel==='admin')return; var p=normalizeProfile(rows[0]);p.derrotas++;p.partidas++;p.atualizado_em=new Date().toISOString();
      return api('/rest/v1/avalix_jogo_perfis?user_id=eq.'+encodeURIComponent(userId),{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({derrotas:p.derrotas,partidas:p.partidas,atualizado_em:p.atualizado_em})});
    }).catch(function(){});
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
    var scope='or=(jogador_1_id.eq.'+encodeURIComponent(s.id)+',jogador_2_id.eq.'+encodeURIComponent(s.id)+')';
    return Promise.all([
      api('/rest/v1/avalix_partidas?'+scope+'&status=in.(ativa,pausada,aguardando)&order=atualizado_em.desc&select=*'),
      api('/rest/v1/avalix_partidas?'+scope+'&status=eq.finalizada&order=atualizado_em.desc&limit=10&select=*')
    ]).then(function(result){
      matches=result[0]||[];
      var finals=result[1]||[];
      pendingResult=finals.find(function(m){
        var st=typeof m.estado==='string'?JSON.parse(m.estado):m.estado||{};
        return st.vencedor_id&&!localStorage.getItem('fg_result_seen_'+m.id);
      })||null;
      var active=document.querySelector('.nav-item.active'),container=document.getElementById('viewContent');
      if(pendingResult&&active&&active.dataset.view==='jogar'&&container&&!container.querySelector('.fg-result-screen'))renderMatchResult(container,pendingResult);
      else repaintIfOpen();
    }).catch(function(){matches=[];});
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
  function pickQuestionByCategory(category,used){
    used=used||[];var available=GAME_QUESTIONS.filter(function(q){return q.cat===category&&used.indexOf(q.id)<0;});
    if(!available.length)available=GAME_QUESTIONS.filter(function(q){return q.cat===category;});
    return available[Math.floor(Math.random()*available.length)]||pickQuestion(used);
  }
  function turnDeadline(){return new Date(Date.now()+36*60*60*1000).toISOString();}

  function initialState(firstTurn) {
    var q=pickQuestion([]);
    return {version:2,turno:firstTurn,questao_id:q.id,usadas:[q.id],selos_1:[],selos_2:[],acertos_1:0,acertos_2:0,sequencia_1:0,sequencia_2:0,rodada:1,jogada:1,coroa_pendente:false,modo_coroa:false,prazo_turno:turnDeadline(),ultima_resposta:null};
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
    return api('/rest/v1/avalix_mensagens_jogo',{method:'POST',headers:{'Prefer':'return=minimal'},body:JSON.stringify({conversa_id:conversation.id,autor_id:s.id,autor_nome:s.nome,tipo:type||'texto',texto:text,referencia_id:referenceId||null})}).then(function(v){sound('message');return v;});
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
  function personById(id,name){var db=typeof db_load==='function'?db_load():{},all=(db.users||[]).concat(db.alunos||[]),p=all.find(function(x){return String(x.id)===String(id);})||all.find(function(x){return String(x.nome||'').toLowerCase()===String(name||'').toLowerCase();});return {id:id,nome:(p&&p.nome)||name||'Jogador',foto:(p&&p.fotoDataUrl)||''};}
  function duelPortrait(id,name,opponent){var p=personById(id,name),content=p.foto?'<img src="'+esc(p.foto)+'" alt="'+esc(p.nome)+'">':'<span>'+esc(initials(p.nome))+'</span>';return '<div class="fg-duel-photo '+(opponent?'opponent':'')+'">'+content+'<i class="fg-duel-online '+(isOnline(id)?'on':'off')+'"></i></div>';}

  function roleLabel(role) { return role === 'aluno' ? 'Aluno' : role === 'professor' ? 'Professor' : 'Administrador'; }

  function gameNav(active) {
    return '<nav class="fg-game-nav" aria-label="Navegação do FisioGame">'+[
      ['home','ti-home','Jogar'],['ranking','ti-trophy','Ranking'],['perfil','ti-user-circle','Meu perfil'],['conquistas','ti-medal','Conquistas']
    ].map(function(item){return '<button class="'+(active===item[0]?'active':'')+'" data-game-view="'+item[0]+'"><i class="ti '+item[1]+'"></i><span>'+item[2]+'</span></button>';}).join('')+'</nav>';
  }
  function bindGameNav(container) {
    container.querySelectorAll('[data-game-view]').forEach(function(btn){btn.onclick=function(){var v=btn.dataset.gameView;if(v==='home')renderView(container);else if(v==='ranking')renderRanking(container);else if(v==='perfil')renderProfile(container);else renderAchievements(container);};});
  }
  function profileStrip(p) {
    var level=levelOf(p.xp), start=levelStart(level), end=levelEnd(level), pct=Math.max(0,Math.min(100,((p.xp-start)/(end-start))*100));
    return '<section class="fg-profile-strip"><div class="fg-level-orb"><span>NÍVEL</span><b>'+level+'</b></div><div class="fg-profile-progress"><div><b>'+esc(p.nome)+'</b><span>'+p.xp+' XP · '+p.temporada_pontos+' pontos na temporada</span></div><div class="fg-xp-track"><i style="width:'+pct+'%"></i></div></div><div class="fg-currency"><i class="ti ti-coin"></i><b>'+p.moedas+'</b><span>moedas</span></div><div class="fg-streak"><i class="ti ti-flame"></i><b>'+p.sequencia_dias+'</b><span>dias</span></div></section>';
  }
  function missionsHtml(p) {
    var missions=[{icon:'ti-message-question',name:'Aquecimento',now:p.missoes.respostas||0,goal:5,reward:25},{icon:'ti-bulb',name:'Mente clínica',now:p.missoes.acertos||0,goal:3,reward:35},{icon:'ti-swords',name:'Entrar em campo',now:p.missoes.partidas||0,goal:1,reward:50}];
    return '<section class="fg-missions"><div class="fg-section-title"><div><span class="eyebrow">OBJETIVOS DE HOJE</span><h3>Missões diárias</h3></div><small>Renovam todos os dias</small></div><div class="fg-mission-grid">'+missions.map(function(m){var done=m.now>=m.goal,pct=Math.min(100,m.now/m.goal*100);return '<article class="fg-mission '+(done?'done':'')+'"><i class="ti '+(done?'ti-circle-check':m.icon)+'"></i><div><b>'+m.name+'</b><span>'+Math.min(m.now,m.goal)+' de '+m.goal+'</span><div><i style="width:'+pct+'%"></i></div></div><small>+'+m.reward+' XP</small></article>';}).join('')+'</div></section>';
  }
  function classicRulesGuide(){
    return '<details class="fg-rules-guide"><summary><i class="ti ti-crown"></i><span><b>Como jogar</b><small>Regras do duelo clássico</small></span><i class="ti ti-chevron-down"></i></summary><div><article><b>1. Gire e responda</b><span>A roleta define a área. Você tem 20 segundos para responder.</span></article><article><b>2. Acertou? Continue</b><span>Cada acerto mantém sua vez; um erro passa a vez ao adversário.</span></article><article><b>3. Ganhe uma coroa</b><span>Três acertos ou a coroa da roleta liberam uma pergunta especial.</span></article><article><b>4. Conquiste as áreas</b><span>Acerte a pergunta da coroa para obter uma das oito áreas.</span></article><article><b>5. Jogue no seu tempo</b><span>Cada jogador possui até 36 horas para realizar o turno.</span></article><article><b>6. Vença a partida</b><span>Conquiste as oito áreas ou tenha mais áreas ao final de 25 rodadas.</span></article></div></details>';
  }
  function categoryPerformance(p) {
    return GAME_CATEGORIES.map(function(c){var st=p.estatisticas[c.id]||{perguntas:0,acertos:0},pct=st.perguntas?Math.round(st.acertos/st.perguntas*100):0;return {cat:c,pct:pct,total:st.perguntas};}).sort(function(a,b){return b.pct-a.pct;});
  }

  function renderRanking(container) {
    var p=normalizeProfile(gameProfile||defaultProfile());
    container.innerHTML='<style>'+styles+progressStyles+'</style><div class="fg-shell">'+gameNav('ranking')+profileStrip(p)+'<section class="fg-page-card"><div class="fg-ranking-hero"><span class="eyebrow">TEMPORADA ATUAL</span><h2>Liga Acadêmica</h2><p>Ganhe pontos respondendo e vencendo partidas. A classificação é atualizada automaticamente.</p></div><div id="fgRankingList" class="fg-ranking-list"><div class="fg-empty">Carregando classificação...</div></div></section></div>';bindGameNav(container);
    loadRanking().then(function(rows){if(!container.isConnected)return;var list=container.querySelector('#fgRankingList');list.innerHTML=rows.length?rows.map(function(r,i){var me=current()&&r.user_id===current().id;return '<article class="fg-rank-row '+(me?'me':'')+'"><strong>'+(i+1)+'</strong><div class="fg-rank-avatar">'+esc(initials(r.nome))+'</div><div><b>'+esc(r.nome)+'</b><span>Nível '+levelOf(r.xp)+' · '+roleLabel(r.papel)+'</span></div><em>'+r.temporada_pontos+' pts</em></article>';}).join(''):'<div class="fg-empty">O ranking será formado quando os jogadores começarem a responder.</div>';});
  }
  function renderProfile(container) {
    var p=normalizeProfile(gameProfile||defaultProfile()), perf=categoryPerformance(p), best=perf[0], weak=perf.slice().reverse()[0], accuracy=p.perguntas?Math.round(p.acertos/p.perguntas*100):0;
    container.innerHTML='<style>'+styles+progressStyles+'</style><div class="fg-shell">'+gameNav('perfil')+profileStrip(p)+'<section class="fg-page-card"><div class="fg-profile-hero"><div class="fg-big-avatar">'+esc(initials(p.nome))+'</div><div><span class="eyebrow">RESIDÊNCIA FISIOGAME</span><h2>'+esc(p.nome)+'</h2><p>'+roleLabel(p.papel)+' · Nível '+levelOf(p.xp)+'</p></div></div><div class="fg-stat-grid"><div><b>'+p.perguntas+'</b><span>Perguntas</span></div><div><b>'+accuracy+'%</b><span>Precisão</span></div><div><b>'+p.vitorias+'</b><span>Vitórias</span></div><div><b>'+p.partidas+'</b><span>Partidas</span></div></div><div class="fg-insights"><article class="best"><i class="ti ti-award"></i><div><span>Sua especialidade</span><b>'+(best&&best.total?esc(best.cat.name):'Continue jogando')+'</b><small>'+(best&&best.total?best.pct+'% de acertos':'Responda para descobrir')+'</small></div></article><article class="weak"><i class="ti ti-book-2"></i><div><span>Área para estudar</span><b>'+(weak&&weak.total?esc(weak.cat.name):'Ainda analisando')+'</b><small>'+(weak&&weak.total?weak.pct+'% de acertos':'Precisamos de mais respostas')+'</small></div></article></div><h3 class="fg-subtitle">Domínio por área</h3><div class="fg-mastery">'+perf.map(function(x){return '<div><span><i style="background:'+x.cat.color+'"></i>'+esc(x.cat.name)+'</span><div><i style="width:'+x.pct+'%;background:'+x.cat.color+'"></i></div><b>'+x.pct+'%</b></div>';}).join('')+'</div></section></div>';bindGameNav(container);
  }
  function renderAchievements(container) {
    var p=normalizeProfile(gameProfile||defaultProfile());
    container.innerHTML='<style>'+styles+progressStyles+'</style><div class="fg-shell">'+gameNav('conquistas')+profileStrip(p)+'<section class="fg-page-card"><div class="fg-ach-head"><span class="eyebrow">SUA JORNADA</span><h2>Conquistas</h2><p>'+p.conquistas.length+' de '+ACHIEVEMENTS.length+' desbloqueadas</p></div><div class="fg-ach-grid">'+ACHIEVEMENTS.map(function(a){var got=p.conquistas.indexOf(a.id)>=0;return '<article class="fg-ach '+(got?'unlocked':'locked')+'"><div><i class="ti '+(got?a.icon:'ti-lock')+'"></i></div><b>'+a.name+'</b><span>'+a.desc+'</span><small>'+(got?'CONQUISTADA':'BLOQUEADA')+'</small></article>';}).join('')+'</div></section></div>';bindGameNav(container);
  }

  function startMascotRotation(container) {
    var mascot=container.querySelector('.fg-capy-mascot');
    if(!mascot)return;
    var frames=mascot.querySelectorAll('.fg-capy-frame');
    var bubble=mascot.querySelector('small');
    var poses=[
      {src:'capivara-fisioterapeuta.png?v=45',phrase:'Vamos nessa!'},
      {src:'capivara-fisioterapeuta-positivo.png?v=45',phrase:'Você consegue!'},
      {src:'capivara-fisioterapeuta-estudando.png?v=45',phrase:'Hora de aprender!'},
      {src:'capivara-fisioterapeuta-goniometro.png?v=45',phrase:'Movimente-se!'}
    ];
    poses.forEach(function(p){var preload=new Image();preload.src=p.src;});
    Array.prototype.forEach.call(frames,function(frame){
      frame.addEventListener('error',function(){this.classList.add('has-error');});
    });
    if(frames.length<2||window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    var index=0,active=0;
    var timer=window.setInterval(function(){
      if(!mascot.isConnected){window.clearInterval(timer);return;}
      if(document.hidden)return;
      index=(index+1)%poses.length;
      var next=active===0?1:0;
      var nextFrame=frames[next];
      nextFrame.classList.remove('has-error');
      nextFrame.onload=function(){
        if(!mascot.isConnected)return;
        frames[active].classList.remove('is-active');
        nextFrame.classList.add('is-active');
        active=next;
        if(bubble)bubble.textContent=poses[index].phrase;
      };
      nextFrame.src=poses[index].src;
    },5500);
  }

  function renderView(container) {
    setMusicMode('ambient');
    if (window.FisioGameBeta && !window.FisioGameBeta.hasAccess()) {
      window.FisioGameBeta.render(container);
      return;
    }
    if (!allowed()) {
      container.innerHTML = '<div class="card card-pad"><h2>Acesso restrito</h2><p>O FisioGame está disponível para alunos, professores e administradores.</p></div>';
      return;
    }
    var received = pendingReceived();
    var people = colleagues();
    var p=normalizeProfile(gameProfile||defaultProfile());
    container.innerHTML = '<style>' + styles + relockStyles + progressStyles + '</style><div class="fg-shell">' + gameNav('home') + profileStrip(p) +
      '<section class="fg-hero"><div class="fg-hero-shapes"><i></i><i></i><i></i></div><div class="fg-hero-copy"><span class="fg-kicker">FISIOGAME ONLINE</span><h2>Aprenda, desafie e conquiste as 8 áreas.</h2><p>Convide alguém da comunidade Avalix ou treine sozinho enquanto espera.</p></div><div class="fg-hero-stage"><div class="fg-mascot fg-capy-mascot" aria-hidden="true"><img class="fg-capy-frame is-active" src="capivara-fisioterapeuta.png?v=45" alt=""><img class="fg-capy-frame" src="capivara-fisioterapeuta.png?v=45" alt=""><small>Vamos nessa!</small></div><div class="fg-hero-actions"><button class="btn btn-primary fg-play-cta" id="fgSolo"><i class="ti ti-player-play"></i> Treinar sozinho</button><button class="btn fg-lock-btn" id="fgRelock"><i class="ti ti-lock"></i> Bloquear acesso</button></div></div></section>' +
      missionsHtml(p) + classicRulesGuide() +
      (matches.length ? '<section class="fg-invites"><h3><i class="ti ti-swords"></i> Suas partidas</h3>'+matches.map(function(m){var s=current(),other=m.jogador_1_id===s.id?m.jogador_2_nome:m.jogador_1_nome,isTurn=m.turno_id===s.id;return '<div class="fg-invite"><div><b>'+esc(other)+'</b><span>'+(isTurn?'É sua vez de responder':'Aguardando a jogada do adversário')+'</span></div><button class="btn '+(isTurn?'btn-primary':'btn-ghost')+' btn-sm" data-match="'+esc(m.id)+'">Abrir partida</button></div>';}).join('')+'</section>' : '') +
      (received.length ? '<section class="fg-invites"><h3><i class="ti ti-mail-opened"></i> Convites recebidos</h3>' + received.map(function (i) { return '<div class="fg-invite"><div><b>' + esc(i.remetente_nome) + '</b><span>quer jogar uma partida com você</span></div><div><button class="btn btn-primary btn-sm" data-accept="' + esc(i.id) + '">Aceitar</button><button class="btn btn-ghost btn-sm" data-decline="' + esc(i.id) + '">Recusar</button></div></div>'; }).join('') + '</section>' : '') +
      '<section class="fg-community"><div class="fg-section-head"><div><span class="eyebrow">Comunidade</span><h3>Escolha seu adversário</h3></div><label class="fg-search"><i class="ti ti-search"></i><input id="fgSearch" placeholder="Buscar colega"></label></div>' +
      '<div class="fg-legend"><span><i class="fg-dot on"></i> Online agora</span><span><i class="fg-dot off"></i> Offline — receberá o convite ao entrar</span></div><div class="fg-grid" id="fgPeople"></div></section></div>';

    bindGameNav(container);
    startMascotRotation(container);

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
    container.querySelector('#fgRelock').addEventListener('click', function () {
      stop();
      if (window.FisioGameBeta) {
        window.FisioGameBeta.lock();
        window.FisioGameBeta.render(container);
      }
    });
    container.querySelectorAll('[data-invite]').forEach(function (b) { b.addEventListener('click', function () { var p=people.find(function(x){return x.id===b.dataset.invite;}); if(p) invite(p); }); });
    container.querySelectorAll('[data-chat]').forEach(function (b) { b.addEventListener('click', function () { var p=people.find(function(x){return x.id===b.dataset.chat;}); if(p) openChat(p,container); }); });
    container.querySelectorAll('[data-accept]').forEach(function (b) { b.addEventListener('click', function () { respondInvite(b.dataset.accept, true); }); });
    container.querySelectorAll('[data-decline]').forEach(function (b) { b.addEventListener('click', function () { respondInvite(b.dataset.decline, false); }); });
    container.querySelectorAll('[data-match]').forEach(function (b) { b.addEventListener('click', function () { var m=matches.find(function(x){return String(x.id)===String(b.dataset.match);}); if(m) renderMatch(m); }); });
  }

  function renderSolo(container) {
    setMusicMode('ambient');
    container.innerHTML = '<style>' + styles + '</style><div class="fg-game-frame"><div class="fg-framebar"><button class="btn btn-ghost btn-sm" id="fgBack"><i class="ti ti-arrow-left"></i> Voltar à comunidade</button><span>Modo de treino · progresso salvo neste aparelho</span></div><iframe title="FisioGame — modo de treino" src="fisiogame.html?v=52-audio-contemporaneo"></iframe></div>';
    container.querySelector('#fgBack').addEventListener('click', function () { renderView(container); });
  }

  function renderMatchWheel(match,state,q,category,mine,mySeals,otherSeals,otherName) {
    setMusicMode('match');
    var container=document.getElementById('viewContent'), s=current();
    if(!container)return;
    var otherId=mine?match.jogador_2_id:match.jogador_1_id;
    var icons=['ti-bone','ti-run','ti-bandage','ti-brain','ti-heartbeat','ti-users-group','ti-building-hospital','ti-ball-football'];
    var wheelItems=GAME_CATEGORIES.map(function(c,i){return '<span style="--i:'+i+'"><i class="ti '+icons[i]+'"></i><small>'+esc(c.name.split(' ')[0])+'</small></span>';}).join('')+'<span class="fg-crown-slice" style="--i:8"><i class="ti ti-crown"></i><small>Coroa</small></span>';
    container.innerHTML='<style>'+styles+gameStyles+'</style><div class="fg-play fg-spin-scene"><div class="fg-arena-top"><button class="fg-round-btn" id="fgReturn" aria-label="Voltar"><i class="ti ti-arrow-left"></i></button><div><span>RODADA '+(state.rodada||1)+'</span><b>Duelo clínico</b></div><span class="fg-turn mine"><i class="ti ti-player-play"></i> SUA VEZ</span></div><section class="fg-versus"><div class="active-turn">'+duelPortrait(s.id,s.nome,false)+'<b>Você</b><small>'+mySeals.length+' áreas conquistadas</small><em>JOGANDO AGORA</em></div><strong><small>PLACAR</small>'+mySeals.length+' <i>×</i> '+otherSeals.length+'</strong><div>'+duelPortrait(otherId,otherName,true)+'<b>'+esc(otherName)+'</b><small>'+otherSeals.length+' áreas conquistadas</small></div></section><div class="fg-turn-callout"><i class="ti ti-hand-click"></i><div><b>É a sua vez!</b><span>Gire a roleta para descobrir sua categoria.</span></div></div><section class="fg-wheel-stage"><div class="fg-wheel-copy"><span>RODADA '+(state.rodada||1)+'</span><h2>Gire a roleta clínica</h2><p>A área sorteada define o desafio desta rodada.</p></div><div class="fg-wheel-shell" id="fgWheelShell"><i class="fg-wheel-pointer"></i><div class="fg-wheel" id="fgWheel">'+wheelItems+'</div><button class="fg-wheel-center" id="fgSpin"><small>TOQUE PARA</small>GIRAR</button></div><div class="fg-wheel-result" id="fgWheelResult"><i class="ti ti-sparkles"></i><span>Pronto para o desafio?</span></div><button class="fg-spin-button" id="fgSpinButton"><i class="ti ti-refresh"></i> GIRAR ROLETA</button></section></div>';
    container.querySelector('#fgReturn').onclick=function(){renderView(container);};
    function spin(){
      var button=container.querySelector('#fgSpinButton'), center=container.querySelector('#fgSpin'), wheel=container.querySelector('#fgWheel'), shell=container.querySelector('#fgWheelShell'), result=container.querySelector('#fgWheelResult');
      if(button.disabled)return; button.disabled=true; center.disabled=true; sound('spin'); var ticks=0,tickTimer=setInterval(function(){sound('tick');if(++ticks>25)clearInterval(tickTimer);},115); shell.classList.add('spinning'); result.innerHTML='<i class="ti ti-loader-2"></i><span>Sorteando área...</span>';
      var crown=Math.random()<1/9,index=crown?8:Math.max(0,GAME_CATEGORIES.findIndex(function(c){return c.id===q.cat;}));
      requestAnimationFrame(function(){wheel.style.transform='rotate('+(2520-index*(360/9))+'deg)';});
      setTimeout(function(){sound('land');shell.classList.remove('spinning');shell.classList.add('landed');result.style.setProperty('--result',crown?'#e8b83f':category.color);result.innerHTML='<i class="ti '+(crown?'ti-crown':icons[index])+'"></i><span>'+(crown?'COROA! Escolha uma área':esc(category.name))+'</span>';},3700);
      setTimeout(function(){sound('question');if(crown){state.coroa_pendente=true;state.modo_coroa=false;api('/rest/v1/avalix_partidas?id=eq.'+encodeURIComponent(match.id),{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({estado:state,atualizado_em:new Date().toISOString()})}).then(function(){match.estado=state;renderCrownChoice(match,state);});}else{sessionStorage.setItem('fg-wheel-'+match.id+'-'+(state.jogada||1),'1');renderMatch(match);}},4700);
    }
    container.querySelector('#fgSpinButton').onclick=spin; container.querySelector('#fgSpin').onclick=spin;
  }

  function renderCrownChoice(match,state){
    var container=document.getElementById('viewContent'),s=current(),mine=String(match.jogador_1_id)===String(s.id),seals=mine?(state.selos_1||[]):(state.selos_2||[]);
    if(!container)return;
    var icons=['ti-bone','ti-run','ti-bandage','ti-brain','ti-heartbeat','ti-users-group','ti-building-hospital','ti-ball-football'];
    container.innerHTML='<style>'+styles+gameStyles+'</style><div class="fg-play"><section class="fg-crown-choice"><i class="ti ti-crown"></i><span>OPORTUNIDADE DE COROA</span><h2>Escolha uma área para conquistar</h2><p>Responda corretamente à próxima pergunta para ganhar o personagem dessa área.</p><div>'+GAME_CATEGORIES.map(function(c,i){var owned=seals.indexOf(c.id)>=0;return '<button data-crown-cat="'+c.id+'" style="--cat:'+c.color+'" '+(owned?'disabled':'')+'><i class="ti '+(owned?'ti-check':icons[i])+'"></i><b>'+esc(c.name)+'</b><small>'+(owned?'Já conquistada':'Escolher área')+'</small></button>';}).join('')+'</div></section></div>';
    container.querySelectorAll('[data-crown-cat]').forEach(function(btn){btn.onclick=function(){
      var cat=btn.dataset.crownCat,q=pickQuestionByCategory(cat,state.usadas||[]);state.questao_id=q.id;state.usadas=(state.usadas||[]).concat([q.id]);state.coroa_pendente=false;state.modo_coroa=true;state.categoria_coroa=cat;
      api('/rest/v1/avalix_partidas?id=eq.'+encodeURIComponent(match.id),{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({estado:state,atualizado_em:new Date().toISOString()})}).then(function(){match.estado=state;sessionStorage.setItem('fg-wheel-'+match.id+'-'+(state.jogada||1),'1');renderMatch(match);});
    };});
  }

  function renderMatch(match) {
    setMusicMode('match');
    var container = document.getElementById('viewContent');
    if (!container) return;
    var s=current(), state=typeof match.estado==='string'?JSON.parse(match.estado):match.estado||{}, q=GAME_QUESTIONS.find(function(x){return x.id===state.questao_id;})||pickQuestion(state.usadas), mine=match.jogador_1_id===s.id, mySeals=mine?(state.selos_1||[]):(state.selos_2||[]), otherSeals=mine?(state.selos_2||[]):(state.selos_1||[]), mySequence=mine?(state.sequencia_1||0):(state.sequencia_2||0), myTurn=match.turno_id===s.id, otherName=mine?match.jogador_2_nome:match.jogador_1_nome, otherId=mine?match.jogador_2_id:match.jogador_1_id, category=GAME_CATEGORIES.find(function(c){return c.id===q.cat;})||GAME_CATEGORIES[0];
    var facts=['A fisioterapia moderna começou a se consolidar no século XIX, com centros de exercícios terapêuticos na Europa.','A World Physiotherapy conecta organizações nacionais de fisioterapia em diferentes regiões do planeta.','Fisioterapeutas atuam também em missões humanitárias, esportes de alto rendimento e programas ligados à exploração espacial.','A mobilização precoce em hospitais pode ajudar a reduzir perdas funcionais durante internações prolongadas.','A fisioterapia aquática utiliza propriedades como flutuação e resistência da água para auxiliar a reabilitação.','O movimento é uma ferramenta terapêutica presente em diferentes culturas há milhares de anos.','Tecnologias como realidade virtual e robótica já fazem parte da reabilitação em diversos países.','A fisioterapia respiratória tem papel importante tanto em hospitais quanto no acompanhamento domiciliar.'];
    var deadline=state.prazo_turno?new Date(state.prazo_turno).getTime():new Date(match.atualizado_em||Date.now()).getTime()+36*60*60*1000;
    if(Date.now()>deadline){
      var expiredId=match.turno_id,newTurn=String(expiredId)===String(match.jogador_1_id)?match.jogador_2_id:match.jogador_1_id,nqExpired=pickQuestion(state.usadas||[]);
      if(String(expiredId)===String(match.jogador_1_id))state.sequencia_1=0;else state.sequencia_2=0;
      state.coroa_pendente=false;state.modo_coroa=false;state.categoria_coroa=null;state.rodada=(state.rodada||1)+1;state.jogada=(state.jogada||1)+1;state.questao_id=nqExpired.id;state.usadas=(state.usadas||[]).concat([nqExpired.id]);state.prazo_turno=turnDeadline();state.ultima_resposta={por:expiredId,correta:false,tempo_turno_esgotado:true,em:new Date().toISOString()};
      api('/rest/v1/avalix_partidas?id=eq.'+encodeURIComponent(match.id),{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({estado:state,turno_id:newTurn,atualizado_em:new Date().toISOString()})}).then(function(){match.estado=state;match.turno_id=newTurn;window.showToast&&showToast(String(expiredId)===String(s.id)?'Seu prazo de 36 horas terminou. A vez passou.':'O prazo do adversário terminou. Agora é sua vez.','warning');renderMatch(match);});return;
    }
    if(myTurn&&state.coroa_pendente){renderCrownChoice(match,state);return;}
    if(myTurn&&!sessionStorage.getItem('fg-wheel-'+match.id+'-'+(state.jogada||1))){renderMatchWheel(match,state,q,category,mine,mySeals,otherSeals,otherName);return;}
    function sealBoard(list){return GAME_CATEGORIES.map(function(c){var got=list.indexOf(c.id)>=0;return '<div class="'+(got?'got':'')+'" title="'+esc(c.name)+'" style="--seal:'+c.color+'"><i class="ti '+(got?'ti-check':'ti-lock')+'"></i><span>'+esc(c.name.split(' ')[0])+'</span></div>';}).join('');}
    container.innerHTML='<style>'+styles+gameStyles+'</style><div class="fg-play"><div class="fg-arena-top"><button class="fg-round-btn" id="fgReturn" aria-label="Voltar"><i class="ti ti-arrow-left"></i></button><div><span>RODADA '+(state.rodada||1)+' DE 25</span><b>Duelo clínico</b></div><span class="fg-turn '+(myTurn?'mine':'wait')+'"><i class="ti '+(myTurn?'ti-player-play':'ti-clock-hour-4')+'"></i> '+(myTurn?'SUA VEZ':'VEZ DE '+esc(otherName.split(' ')[0]).toUpperCase())+'</span></div><section class="fg-versus"><div class="'+(myTurn?'active-turn':'waiting-turn')+'">'+duelPortrait(s.id,s.nome,false)+'<b>Você</b><small>'+mySeals.length+' áreas conquistadas</small>'+(myTurn?'<em>SUA VEZ</em>':'<em>AGUARDANDO</em>')+'</div><strong><small>PLACAR</small>'+mySeals.length+' <i>×</i> '+otherSeals.length+'</strong><div class="'+(!myTurn?'active-turn':'waiting-turn')+'">'+duelPortrait(otherId,otherName,true)+'<b>'+esc(otherName)+'</b><small>'+otherSeals.length+' áreas conquistadas</small>'+(!myTurn?'<em>JOGANDO AGORA</em>':'')+'</div></section><section class="fg-objective"><div><span>Seu mapa de domínio</span><small>Conquiste as 8 áreas para vencer</small></div><div class="fg-seal-board">'+sealBoard(mySeals)+'</div></section>'+(myTurn?'<div class="fg-crown-meter"><span><i class="ti ti-crown"></i> Progresso para a coroa</span><div><i style="width:'+Math.min(100,mySequence/3*100)+'%"></i></div><b>'+mySequence+'/3 acertos</b></div><div class="fg-turn-callout question"><i class="ti ti-bolt"></i><div><b>'+(state.modo_coroa?'Pergunta da coroa!':'Sua vez de responder')+'</b><span>'+(state.modo_coroa?'Acerte para conquistar '+esc(category.name)+'.':'Se acertar, você continua jogando.')+'</span></div></div><section class="fg-question-card" style="--category:'+category.color+'"><div class="fg-question-meta"><span><i class="ti ti-stethoscope"></i> '+esc(category.name)+'</span><em class="fg-question-timer" id="fgQuestionTimer"><i class="ti ti-clock"></i> 20</em></div><div class="fg-question-index">DESAFIO '+(state.rodada||1)+'</div><h2>'+esc(q.q)+'</h2><div class="fg-options">'+q.a.map(function(a,i){return '<button data-answer="'+i+'"><span>'+String.fromCharCode(65+i)+'</span>'+esc(a)+'</button>';}).join('')+'</div><div id="fgAnswerNote"></div></section>':'<section class="fg-wait fg-wait-world"><div class="fg-wait-player">'+duelPortrait(otherId,otherName,true)+'<div><small>JOGANDO AGORA</small><strong>É a vez de '+esc(otherName)+'</strong><span>Você será avisado assim que o turno terminar.</span></div></div><h2>Enquanto '+esc(otherName.split(' ')[0])+' responde, confira uma curiosidade</h2><p>A partida está salva e continuará mesmo que vocês não estejam online ao mesmo tempo. Cada turno tem prazo de 36 horas.</p><article class="fg-fact-card"><div><i class="ti ti-bulb-filled"></i><span>CURIOSIDADE DA FISIOTERAPIA PELO MUNDO</span></div><p id="fgWorldFact">'+esc(facts[(state.rodada||1)%facts.length])+'</p><small><i></i><i></i><i></i></small></article><div class="fg-wait-actions"><button id="fgWaitTraining"><i class="ti ti-brain"></i> Treinar enquanto espero</button><button id="fgWaitCommunity"><i class="ti ti-users"></i> Voltar à comunidade</button></div></section>')+'</div>';
    container.querySelector('#fgReturn').addEventListener('click', function () { renderView(container); });
    if(!myTurn){var factIndex=(state.rodada||1)%facts.length,factTimer=setInterval(function(){var el=container.querySelector('#fgWorldFact');if(!el||!el.isConnected){clearInterval(factTimer);return;}el.classList.add('changing');setTimeout(function(){factIndex=(factIndex+1)%facts.length;el.textContent=facts[factIndex];el.classList.remove('changing');},280);},6500);var train=container.querySelector('#fgWaitTraining'),community=container.querySelector('#fgWaitCommunity');if(train)train.onclick=function(){clearInterval(factTimer);renderSolo(container);};if(community)community.onclick=function(){clearInterval(factTimer);renderView(container);};(function pollTurn(){setTimeout(function(){var waiting=container.querySelector('.fg-wait-world');if(!waiting||!waiting.isConnected)return;api('/rest/v1/avalix_partidas?id=eq.'+encodeURIComponent(match.id)+'&select=*').then(function(rows){var updated=rows&&rows[0];if(!updated){pollTurn();return;}var updatedState=typeof updated.estado==='string'?JSON.parse(updated.estado):updated.estado||{};if(updated.status==='finalizada'){clearInterval(factTimer);renderMatchResult(container,updated);}else if(updated.turno_id===s.id||updatedState.rodada!==(state.rodada||1)){clearInterval(factTimer);sound('turn');renderMatch(updated);}else pollTurn();}).catch(pollTurn);},6000);})();}
    var questionTimer=null,seconds=20,timerEl=container.querySelector('#fgQuestionTimer');
    if(myTurn&&timerEl){questionTimer=setInterval(function(){seconds--;timerEl.innerHTML='<i class="ti ti-clock"></i> '+seconds;timerEl.classList.toggle('urgent',seconds<=5);if(seconds<=0){clearInterval(questionTimer);answerMatch(match,state,q,-1,container);}},1000);}
    container.querySelectorAll('[data-answer]').forEach(function(btn){btn.onclick=function(){if(questionTimer)clearInterval(questionTimer);answerMatch(match,state,q,Number(btn.dataset.answer),container);};});
  }

  function renderMatchResult(container,match) {
    if(!container||!match)return;
    var s=current(),state=typeof match.estado==='string'?JSON.parse(match.estado):match.estado||{};
    var won=String(state.vencedor_id)===String(s.id);
    var winnerName=state.vencedor_nome||(String(match.jogador_1_id)===String(state.vencedor_id)?match.jogador_1_nome:match.jogador_2_nome)||'Seu adversário';
    var mine=String(match.jogador_1_id)===String(s.id),mySeals=mine?(state.selos_1||[]):(state.selos_2||[]),otherSeals=mine?(state.selos_2||[]):(state.selos_1||[]);
    var colors=['#ffd45f','#ff6f61','#47c9a2','#5b8def','#b875db','#ff78a7','#ffffff'];
    var confetti='',fireworks='';
    if(won){
      for(var i=0;i<110;i++)confetti+='<i class="fg-result-confetti" style="--x:'+((i*43)%101)+'%;--d:'+((i%13)*.08)+'s;--r:'+(i%2?540:-540)+'deg;--c:'+colors[i%colors.length]+'"></i>';
      for(var f=0;f<7;f++){var sparks='';for(var j=0;j<12;j++)sparks+='<i style="--a:'+(j*30)+'deg;--c:'+colors[(f+j)%colors.length]+'"></i>';fireworks+='<span class="fg-firework" style="--fx:'+(10+((f*17)%82))+'%;--fy:'+(12+((f*23)%48))+'%;--fd:'+(f*.38)+'s">'+sparks+'</span>';}
    }
    var mascot=won?'capivara-fisioterapeuta-positivo.png?v=46':'capivara-fisioterapeuta-triste.png?v=46';
    setMusicMode(won?'victory':'defeat');sound(won?'victory':'defeat');
    container.innerHTML='<style>'+styles+resultStyles+'</style><section class="fg-result-screen '+(won?'winner':'loser')+'">'+confetti+fireworks+'<div class="fg-result-glow"></div><div class="fg-result-card"><span class="fg-result-kicker">'+(won?'PARTIDA CONCLUÍDA · VITÓRIA':'PARTIDA CONCLUÍDA')+'</span><div class="fg-result-mascot"><img src="'+mascot+'" alt=""></div><div class="fg-result-copy"><h1>'+(won?'Você venceu!':'Não foi dessa vez')+'</h1><p>'+(won?'Parabéns! Você conquistou as oito áreas da fisioterapia e venceu o duelo clínico.':esc(winnerName)+' completou as oito áreas primeiro. Revise os desafios e prepare-se para a revanche!')+'</p><div class="fg-result-score"><div><small>VOCÊ</small><b>'+mySeals.length+'</b><span>áreas</span></div><strong>×</strong><div><small>ADVERSÁRIO</small><b>'+otherSeals.length+'</b><span>áreas</span></div></div><div class="fg-result-actions"><button class="fg-result-primary" id="fgResultAgain"><i class="ti ti-refresh"></i> Jogar novamente</button><button class="fg-result-secondary" id="fgResultHome"><i class="ti ti-users"></i> Voltar à comunidade</button></div></div></div></section>';
    function closeResult(){localStorage.setItem('fg_result_seen_'+match.id,'1');pendingResult=null;setMusicMode('ambient');renderView(container);}
    container.querySelector('#fgResultAgain').onclick=closeResult;
    container.querySelector('#fgResultHome').onclick=closeResult;
  }

  function gameCelebration(container, correct, won) {
    sound(won?'victory':correct?'correct':'wrong');
    var layer=document.createElement('div');
    layer.className='fg-celebration '+(correct?'success':'try-again')+(won?' victory':'');
    var colors=['#e7bf72','#3ba489','#e66c5b','#4b88c7','#9867c6','#ef4f83'];
    var pieces=correct?(won?42:24):8;
    var confetti='';
    for(var i=0;i<pieces;i++)confetti+='<i style="--x:'+((i*47)%100)+'%;--delay:'+((i%9)*.045)+'s;--spin:'+(120+(i%6)*60)+'deg;--color:'+colors[i%colors.length]+'"></i>';
    layer.innerHTML=confetti+'<div class="fg-reaction"><span class="fg-reaction-face"><i></i><i></i><b></b></span><strong>'+(won?'DOMÍNIO COMPLETO!':correct?'ÁREA CONQUISTADA!':'CONTINUE TENTANDO!')+'</strong><small>'+(won?'Você venceu o duelo clínico':correct?'+25 XP e progresso na temporada':'Cada erro também ensina')+'</small></div>';
    container.appendChild(layer);
    setTimeout(function(){layer.classList.add('show');},20);
    setTimeout(function(){layer.remove();},won?2600:1900);
  }

  function answerMatch(match,state,q,answer,container){
    container.querySelectorAll('[data-answer]').forEach(function(b){b.disabled=true;b.classList.toggle('is-correct',Number(b.dataset.answer)===q.c);b.classList.toggle('is-wrong',Number(b.dataset.answer)===answer&&answer!==q.c);});
    var s=current(),correct=answer===q.c,wasCrown=!!state.modo_coroa,p1=String(match.jogador_1_id)===String(s.id),seals=p1?(state.selos_1||[]):(state.selos_2||[]),otherSeals=p1?(state.selos_2||[]):(state.selos_1||[]),sequence=p1?(state.sequencia_1||0):(state.sequencia_2||0);
    if(correct){
      if(p1)state.acertos_1=(state.acertos_1||0)+1;else state.acertos_2=(state.acertos_2||0)+1;
      if(state.modo_coroa){var crownCat=state.categoria_coroa||q.cat;if(seals.indexOf(crownCat)<0)seals.push(crownCat);sequence=0;state.modo_coroa=false;state.categoria_coroa=null;}
      else{sequence++;if(sequence>=3){sequence=0;state.coroa_pendente=true;}}
    }else{sequence=0;state.modo_coroa=false;state.categoria_coroa=null;state.coroa_pendente=false;state.rodada=(state.rodada||1)+1;}
    if(p1){state.selos_1=seals;state.sequencia_1=sequence;}else{state.selos_2=seals;state.sequencia_2=sequence;}
    var currentWon=seals.length>=GAME_CATEGORIES.length,limitReached=!correct&&(state.rodada||1)>25,winnerId=null,winnerName=null;
    if(currentWon){winnerId=s.id;winnerName=s.nome;}
    else if(limitReached){var myCount=seals.length,otherCount=otherSeals.length;if(myCount!==otherCount){winnerId=myCount>otherCount?s.id:(p1?match.jogador_2_id:match.jogador_1_id);winnerName=String(winnerId)===String(match.jogador_1_id)?match.jogador_1_nome:match.jogador_2_nome;}else{state.rodada=25;state.desempate=true;}}
    var finished=!!winnerId,wonForCurrent=finished&&String(winnerId)===String(s.id),next=correct?s.id:(p1?match.jogador_2_id:match.jogador_1_id),nq=pickQuestion(state.usadas||[]);
    state.usadas=(state.usadas||[]).concat([nq.id]);state.questao_id=nq.id;state.jogada=(state.jogada||1)+1;state.prazo_turno=correct?(state.prazo_turno||turnDeadline()):turnDeadline();state.ultima_resposta={por:s.id,correta:correct,questao:q.id,tempo_esgotado:answer<0,em:new Date().toISOString()};
    if(finished){state.vencedor_id=winnerId;state.vencedor_nome=winnerName;state.finalizada_em=new Date().toISOString();}
    var opponentId=match.jogador_1_id===current().id?match.jogador_2_id:match.jogador_1_id;
    var note=container.querySelector('#fgAnswerNote');
    if(note)note.innerHTML='<div class="fg-answer-feedback '+(correct?'correct':'wrong')+'"><i class="ti '+(correct?'ti-circle-check':'ti-circle-x')+'"></i><div><b>'+(correct?(wasCrown?'Área conquistada!':state.coroa_pendente?'Três acertos! Você ganhou uma coroa.':'Resposta correta — você continua!'):(answer<0?'Tempo esgotado!':'Quase lá!'))+'</b><span>'+esc(q.e||('A resposta correta é '+q.a[q.c]+'.'))+'</span></div></div>';
    gameCelebration(container,wonForCurrent||correct,wonForCurrent);
    api('/rest/v1/avalix_partidas?id=eq.'+encodeURIComponent(match.id),{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({estado:state,turno_id:next,status:finished?'finalizada':'ativa',atualizado_em:new Date().toISOString()})}).then(function(){return recordAnswer(correct,q.cat,wonForCurrent,opponentId).catch(function(){});}).then(function(){return new Promise(function(resolve){setTimeout(resolve,wonForCurrent?1500:correct?1200:1800);});}).then(function(){match.estado=state;match.turno_id=next;match.status=finished?'finalizada':'ativa';if(finished){renderMatchResult(container,match);return;}sessionStorage.removeItem('fg-wheel-'+match.id+'-'+((state.jogada||1)-1));renderMatch(match);});
  }

  function repaintIfOpen() {
    var active = document.querySelector('.nav-item.active');
    var container = document.getElementById('viewContent');
    if (window.FisioGameBeta && !window.FisioGameBeta.hasAccess()) return;
    if (active && active.dataset.view === 'jogar' && container && !container.querySelector('.fg-shell') && !container.querySelector('.fg-game-frame') && !container.querySelector('.fg-chat') && !container.querySelector('.fg-play') && !container.querySelector('.fg-page-card') && !container.querySelector('.fg-result-screen')) renderView(container);
  }

  function renderAdminDashboard(container) {
    var s = current();
    if (!container || !s || s.papel !== 'admin') return;
    var token = String(Date.now()) + Math.random();
    container.dataset.gameDashboardToken = token;

    function statusLabel(status) {
      return status === 'pausada' ? 'Pausada' : status === 'aguardando' ? 'Aguardando' : 'Em andamento';
    }
    function dateLabel(value) {
      if (!value) return 'Sem registro';
      var d = new Date(value);
      if (isNaN(d.getTime())) return 'Sem registro';
      return d.toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    }
    function stateOf(match) {
      if (!match || !match.estado) return {};
      if (typeof match.estado !== 'string') return match.estado;
      try { return JSON.parse(match.estado); } catch (e) { return {}; }
    }
    function onlineFrom(rows) {
      var map = {};
      (rows || []).forEach(function (p) {
        map[p.user_id] = Date.now() - new Date(p.ultimo_sinal).getTime() < ONLINE_MS;
      });
      return map;
    }
    function draw(activeMatches, presenceRows, aiHealthRows) {
      if (!container.isConnected || container.dataset.gameDashboardToken !== token) return;
      var online = onlineFrom(presenceRows);
      var players = {};
      (activeMatches || []).forEach(function (m) {
        players[m.jogador_1_id] = true;
        players[m.jogador_2_id] = true;
      });
      var onlineCount = Object.keys(players).filter(function (id) { return online[id]; }).length;
      var waitingCount = (activeMatches || []).filter(function (m) { return !online[m.turno_id]; }).length;
      var aiFailures = (aiHealthRows || []).filter(function (item) { return item.status === 'erro' && (item.categoria === 'creditos' || Number(item.falhas_consecutivas || 0) >= 3); });
      var aiAlert = aiFailures.length ? '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:18px;padding:15px 17px;border:1px solid #efb3a8;border-left:5px solid #d9553f;border-radius:14px;background:#fff2ef;color:#7b2b20"><i class="ti ti-alert-triangle" style="font-size:25px;color:#d9553f"></i><div style="display:grid;gap:4px"><b style="font-size:14px">Reposição de perguntas interrompida — verificar créditos da IA</b><span style="font-size:11px;line-height:1.45;color:#865047">O jogo continua funcionando com as perguntas já cadastradas. Após regularizar os créditos, o sistema tentará novamente automaticamente.</span></div></div>' : '';
      container.innerHTML = '<style>'+adminDashboardStyles+'</style><section class="fg-admin-dash">' + aiAlert +
        '<div class="fg-admin-head"><div><span class="eyebrow">FISIOGAME EM TEMPO REAL</span><h3>Partidas em andamento</h3><p>Atualização automática a cada 10 segundos. Visível somente para administradores.</p></div><span class="fg-live"><i></i> Ao vivo</span></div>' +
        '<div class="fg-admin-metrics"><div><i class="ti ti-swords"></i><b>'+(activeMatches || []).length+'</b><span>Partidas abertas</span></div><div><i class="ti ti-users"></i><b>'+Object.keys(players).length+'</b><span>Jogadores envolvidos</span></div><div><i class="ti ti-wifi"></i><b>'+onlineCount+'</b><span>Jogadores online</span></div><div><i class="ti ti-clock-pause"></i><b>'+waitingCount+'</b><span>Aguardando jogador offline</span></div></div>' +
        '<div class="fg-admin-list">' + ((activeMatches || []).length ? (activeMatches || []).map(function (m) {
          var state = stateOf(m);
          var turnName = m.turno_id === m.jogador_1_id ? m.jogador_1_nome : m.jogador_2_nome;
          function player(id, name) { return '<div class="fg-admin-player"><i class="'+(online[id]?'on':'off')+'"></i><span>'+esc(name)+'</span><small>'+(online[id]?'Online':'Offline')+'</small></div>'; }
          return '<article class="fg-admin-match"><div class="fg-admin-versus">'+player(m.jogador_1_id,m.jogador_1_nome)+'<strong>×</strong>'+player(m.jogador_2_id,m.jogador_2_nome)+'</div><div class="fg-admin-info"><span class="fg-admin-status '+esc(m.status)+'">'+statusLabel(m.status)+'</span><b>Vez de '+esc(turnName)+'</b><small>Rodada '+esc(state.rodada || 1)+' · atualização '+dateLabel(m.atualizado_em)+'</small></div></article>';
        }).join('') : '<div class="fg-admin-empty"><i class="ti ti-device-gamepad-2"></i><b>Nenhuma partida acontecendo agora</b><span>As partidas aparecerão aqui assim que um convite for aceito.</span></div>') + '</div></section>';
    }
    function load() {
      if (!container.isConnected || container.dataset.gameDashboardToken !== token) return;
      Promise.all([
        api('/rest/v1/avalix_partidas?status=in.(ativa,pausada,aguardando)&order=atualizado_em.desc&select=*'),
        api('/rest/v1/avalix_presenca?select=user_id,ultimo_sinal'),
        api('/rest/v1/avalix_ia_monitoramento?select=rotina,status,categoria,falhas_consecutivas,mensagem,ultimo_erro,ultimo_sucesso')
      ]).then(function (result) {
        draw(result[0] || [], result[1] || [], result[2] || []);
      }).catch(function () {
        if (container.isConnected) container.innerHTML = '<div class="card card-pad"><b>Nao foi possivel carregar as partidas.</b><p style="margin:6px 0 0;color:var(--ac-charcoal-soft);">Verifique a conexao com o Supabase.</p></div>';
      }).then(function () {
        if (container.isConnected && container.dataset.gameDashboardToken === token) setTimeout(load, 10000);
      });
    }
    load();
  }

  function start() {
    if (running || !allowed()) return;
    if (window.FisioGameBeta && !window.FisioGameBeta.hasAccess()) return;
    running = true;
    if(!document.documentElement.dataset.fgAudioBound){document.documentElement.dataset.fgAudioBound='1';document.addEventListener('pointerdown',function(e){if(!running||!audioActive)return;if(e.target.closest&&e.target.closest('button')&&!e.target.closest('#fgSoundDock'))sound('click');if(audioState.music)startMusic();},{passive:true});}
    heartbeat(false); loadPresence(); loadInvites(); loadMatches(); loadChatNotifications(); loadGameProfile(); loadRanking();
    timers.push(setInterval(function () { heartbeat(false); }, 20000));
    timers.push(setInterval(loadPresence, 8000));
    timers.push(setInterval(loadInvites, 6000));
    timers.push(setInterval(loadMatches, 7000));
    timers.push(setInterval(loadChatNotifications, 6000));
  }

  function stop() {
    if (!running) return;
    heartbeat(true);
    timers.forEach(clearInterval); timers=[]; running=false; presence={}; invites=[]; paintBadge(); setAudioActive(false);
  }


  var gameStyles='.fg-play{max-width:900px;margin:auto}.fg-play-head,.fg-score{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid rgba(30,50,45,.1);padding:13px;border-radius:15px;margin-bottom:12px}.fg-play-head>div{display:grid;flex:1}.fg-play-head span{font-size:11px;color:var(--ac-charcoal-soft)}.fg-turn{padding:7px 10px!important;border-radius:999px;font-weight:700}.fg-turn.mine{background:#dceee9;color:#176354!important}.fg-turn.wait{background:#f2eee4;color:#76633d!important}.fg-score{justify-content:space-between}.fg-score>div{display:grid;gap:5px}.fg-score>div:last-child{text-align:right}.fg-seals{display:flex;gap:5px}.fg-seals i{width:14px;height:14px;border-radius:50%}.fg-question,.fg-wait{background:#fff;border:1px solid rgba(30,50,45,.1);border-radius:20px;padding:clamp(20px,4vw,38px)}.fg-category{display:inline-block;color:#fff;background:var(--cat);border-radius:999px;padding:6px 10px;font-size:11px;font-weight:800}.fg-question h2{margin:15px 0 22px}.fg-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fg-options button{border:1px solid rgba(30,50,45,.15);background:#fff;border-radius:12px;padding:14px;text-align:left;cursor:pointer;font-weight:600}.fg-options button:hover{border-color:#338f75;background:#edf7f4}.fg-wait{text-align:center;padding:60px 25px}.fg-wait>i{font-size:48px;color:#9b8a61}@media(max-width:600px){.fg-options{grid-template-columns:1fr}.fg-play-head{align-items:flex-start;flex-wrap:wrap}.fg-turn{width:100%;text-align:center}}';
  gameStyles += '.fg-spin-scene{max-width:980px!important}.fg-wheel-stage{position:relative;overflow:hidden;margin-top:12px;min-height:590px;border-radius:26px;padding:28px;display:grid;justify-items:center;align-content:start;background:radial-gradient(circle at 50% 42%,rgba(83,205,177,.24),transparent 35%),linear-gradient(145deg,#123f3a,#1d645a);color:#fff;box-shadow:0 22px 55px rgba(17,63,57,.22)}.fg-wheel-stage:before,.fg-wheel-stage:after{content:"";position:absolute;border-radius:50%;border:18px solid rgba(255,255,255,.045)}.fg-wheel-stage:before{width:280px;height:280px;left:-150px;top:-130px}.fg-wheel-stage:after{width:190px;height:190px;right:-95px;bottom:-80px}.fg-wheel-copy{text-align:center;position:relative;z-index:2}.fg-wheel-copy>span{font-size:9px;font-weight:900;letter-spacing:.2em;color:#f4ce75}.fg-wheel-copy h2{margin:5px 0 3px;color:#fff;font-size:clamp(24px,4vw,36px)}.fg-wheel-copy p{margin:0;color:rgba(255,255,255,.7);font-size:12px}.fg-wheel-shell{position:relative;width:clamp(270px,42vw,380px);aspect-ratio:1;margin:25px 0 17px;filter:drop-shadow(0 22px 18px rgba(0,0,0,.28));z-index:2}.fg-wheel{position:absolute;inset:5%;border-radius:50%;background:conic-gradient(from -30deg,#43a568 0 60deg,#3689cc 60deg 120deg,#ef8744 120deg 180deg,#8a58bd 180deg 240deg,#25a8a2 240deg 300deg,#e7bc39 300deg 360deg);border:12px solid #efc45e;box-shadow:0 0 0 5px #9f681f,inset 0 0 0 4px rgba(255,255,255,.55),inset 0 0 28px rgba(4,35,31,.25),0 10px 0 #744716;transition:transform 3.7s cubic-bezier(.08,.72,.12,1);will-change:transform}.fg-wheel>span{position:absolute;inset:0;transform:rotate(calc(var(--i)*60deg));display:flex;align-items:flex-start;justify-content:center;padding-top:8%}.fg-wheel>span i{font-size:29px;color:#fff;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25))}.fg-wheel>span small{position:absolute;top:19%;font-size:7px;font-weight:900;text-transform:uppercase;color:#fff;max-width:80px}.fg-wheel>button{position:absolute;z-index:5;left:50%;top:50%;transform:translate(-50%,-50%);width:31%;aspect-ratio:1;border-radius:50%;border:6px solid #fff0b3;background:linear-gradient(145deg,#ffe390,#d79c35);box-shadow:0 0 0 5px #98611c,0 8px 16px rgba(61,35,4,.35);color:#68420f;font-weight:1000;font-size:clamp(15px,2.5vw,22px);cursor:pointer;display:grid;place-content:center;line-height:1}.fg-wheel>button small{font-size:6px;letter-spacing:.1em;margin-bottom:4px}.fg-wheel-pointer{position:absolute;z-index:8;left:50%;top:-1%;transform:translateX(-50%);width:52px;height:62px;background:linear-gradient(145deg,#fff0a9,#d3972f);clip-path:polygon(50% 100%,4% 14%,24% 0,76% 0,96% 14%);filter:drop-shadow(0 5px 3px rgba(0,0,0,.35))}.fg-wheel-shell.spinning .fg-wheel-pointer{animation:fgPointer .15s ease-in-out infinite alternate}.fg-wheel-shell.spinning{animation:fgWheelLift .6s ease}.fg-wheel-shell.landed{animation:fgWheelLand .65s cubic-bezier(.2,.9,.25,1.2)}.fg-wheel-result{min-width:220px;height:38px;border-radius:999px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;font-weight:800;z-index:2}.fg-wheel-result[style]{background:var(--result);box-shadow:0 7px 18px rgba(0,0,0,.2)}.fg-wheel-result .ti-loader-2{animation:fgWheelLoading .7s linear infinite}.fg-spin-button{z-index:2;margin-top:12px;padding:13px 28px;border:2px solid rgba(255,255,255,.72);border-radius:999px;background:linear-gradient(#f3c95e,#d69d35);color:#56370e;font-weight:1000;letter-spacing:.06em;box-shadow:0 6px 0 #8a581e,0 12px 20px rgba(0,0,0,.24);cursor:pointer}.fg-spin-button:active{transform:translateY(4px);box-shadow:0 2px 0 #8a581e}.fg-spin-button:disabled{opacity:.65}.fg-question-card{background:linear-gradient(145deg,#fff,#fffdf6)!important}.fg-question-card:before{content:"";display:block;width:48px;height:5px;border-radius:99px;background:var(--category);margin:-13px auto 15px;box-shadow:0 4px 11px var(--category)}@keyframes fgPointer{to{transform:translateX(-50%) rotate(7deg)}}@keyframes fgWheelLift{50%{transform:scale(1.035)}}@keyframes fgWheelLand{0%{transform:scale(1.04)}60%{transform:scale(.96)}100%{transform:scale(1)}}@keyframes fgWheelLoading{to{transform:rotate(360deg)}}@media(max-width:600px){.fg-wheel-stage{min-height:535px;padding:22px 10px}.fg-wheel-shell{width:min(82vw,330px);margin-top:20px}.fg-wheel>span small{display:none}.fg-spin-button{width:min(290px,90%)}}@media(prefers-reduced-motion:reduce){.fg-wheel{transition-duration:.5s!important}.fg-wheel-shell.spinning .fg-wheel-pointer{animation:none}}';
  gameStyles += '.fg-wheel-center{position:absolute;z-index:9;left:50%;top:50%;transform:translate(-50%,-50%);width:31%;aspect-ratio:1;border-radius:50%;border:6px solid #fff0b3;background:linear-gradient(145deg,#ffe390,#d79c35);box-shadow:0 0 0 5px #98611c,0 8px 16px rgba(61,35,4,.35);color:#68420f;font-weight:1000;font-size:clamp(15px,2.5vw,22px);cursor:pointer;display:grid;place-content:center;line-height:1}.fg-wheel-center small{font-size:6px;letter-spacing:.1em;margin-bottom:4px}.fg-versus{padding:22px!important}.fg-versus>div{position:relative;min-width:150px}.fg-versus>div.active-turn:before{content:"";position:absolute;inset:-10px;border:2px solid #f1c75f;border-radius:25px;box-shadow:0 0 24px rgba(241,199,95,.35);animation:fgTurnGlow 1.6s ease-in-out infinite alternate}.fg-versus>div>em{font-style:normal;font-size:7px;font-weight:1000;letter-spacing:.12em;background:#f0c55f;color:#58380c;border-radius:999px;padding:4px 8px;margin-top:3px}.fg-versus>strong{display:grid;justify-items:center;line-height:1}.fg-versus>strong>small{font-size:7px;letter-spacing:.16em;color:rgba(255,255,255,.55);margin-bottom:7px}.fg-duel-photo{position:relative;width:88px;height:88px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#f2d174,#d99f38);color:#173f3a;font-weight:1000;font-size:24px;border:5px solid #fff;box-shadow:0 0 0 4px #c38b2e,0 12px 24px rgba(0,0,0,.25);overflow:visible}.fg-duel-photo.opponent{background:linear-gradient(145deg,#79c7e9,#397eb4);color:#fff;box-shadow:0 0 0 4px #2e6d9f,0 12px 24px rgba(0,0,0,.25)}.fg-duel-photo img{position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover}.fg-duel-online{position:absolute;right:0;bottom:5px;width:16px;height:16px;border-radius:50%;border:3px solid #fff;background:#9aa8a4;z-index:2}.fg-duel-online.on{background:#35ce79;box-shadow:0 0 0 4px rgba(53,206,121,.18)}.fg-turn-callout{display:flex;align-items:center;gap:12px;margin:12px 0;padding:13px 17px;border-radius:17px;background:linear-gradient(100deg,#fff3bd,#fffdf3);border:2px solid #e5ba4e;box-shadow:0 6px 0 #c7902c;color:#64400f;animation:fgCallout .45s cubic-bezier(.2,.9,.25,1.2)}.fg-turn-callout>i{width:43px;height:43px;border-radius:14px;display:grid;place-items:center;background:#e5ad3e;color:#fff;font-size:23px}.fg-turn-callout>div{display:grid}.fg-turn-callout span{font-size:11px}.fg-turn-callout.question{background:linear-gradient(100deg,#dff6ee,#fff);border-color:#62b99f;box-shadow:0 6px 0 #3d917b;color:#155b4e}.fg-wait-world{position:relative;overflow:hidden;min-height:480px;display:grid;justify-items:center;align-content:center}.fg-wait-orbit{position:relative;width:118px;height:118px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#2a8d78,#14584e);color:#fff;font-size:52px;box-shadow:0 0 0 12px rgba(47,150,127,.12);margin-bottom:25px}.fg-wait-orbit>b{position:absolute;inset:-20px;border:2px dashed rgba(47,150,127,.3);border-radius:50%;animation:fgOrbit 8s linear infinite}.fg-wait-orbit>b:after{content:"";position:absolute;left:50%;top:-6px;width:12px;height:12px;border-radius:50%;background:#e9bd54}.fg-wait-orbit>b:nth-child(2){inset:-34px;animation-duration:12s;animation-direction:reverse}.fg-wait-orbit>b:nth-child(2):after{background:#4c91c9}.fg-wait-orbit>b:nth-child(3){inset:-49px;animation-duration:16s}.fg-wait-orbit>b:nth-child(3):after{background:#9a61bf}.fg-wait-world h2{max-width:650px;margin:8px auto;font-size:clamp(22px,4vw,32px)}.fg-wait-world>p{max-width:570px}.fg-fact-card{width:min(600px,100%);margin-top:24px;padding:18px 20px;border:2px solid #e4bd58;border-radius:20px;background:linear-gradient(145deg,#fff9da,#fff);box-shadow:0 7px 0 #c99631;text-align:left}.fg-fact-card>div{display:flex;align-items:center;gap:8px;color:#8a5b13;font-size:8px;font-weight:1000;letter-spacing:.12em}.fg-fact-card>div i{font-size:20px;color:#d79b31}.fg-fact-card p{font-size:14px;line-height:1.55;color:#4b4d49;transition:.28s}.fg-fact-card p.changing{opacity:0;transform:translateY(8px)}.fg-fact-card small{display:flex;justify-content:center;gap:5px}.fg-fact-card small i{width:6px;height:6px;border-radius:50%;background:#d6b45f}.fg-wait-actions{display:flex;gap:9px;margin-top:22px;flex-wrap:wrap;justify-content:center}.fg-wait-actions button{border:2px solid #dce8e3;border-radius:13px;padding:11px 15px;background:#fff;color:#185d51;font-weight:800;cursor:pointer}.fg-wait-actions button:first-child{background:#1d6e60;color:#fff;border-color:#1d6e60}@keyframes fgTurnGlow{to{box-shadow:0 0 34px rgba(241,199,95,.62);transform:scale(1.025)}}@keyframes fgCallout{from{opacity:0;transform:translateY(-12px) scale(.97)}}@keyframes fgOrbit{to{transform:rotate(360deg)}}@media(max-width:650px){.fg-versus{padding:17px 10px!important}.fg-versus>div{min-width:0}.fg-duel-photo{width:68px;height:68px;font-size:18px}.fg-versus>strong{font-size:24px}.fg-versus>div>em{font-size:6px}.fg-wait-world{padding:55px 13px!important}.fg-wait-orbit{width:90px;height:90px;font-size:40px}.fg-wait-actions{display:grid;width:100%}.fg-wait-actions button{width:100%}}';
  gameStyles += '.fg-wait-player{width:min(620px,100%);display:flex;align-items:center;justify-content:center;gap:20px;margin:0 auto 25px;padding:19px 24px;border:2px solid #e5bd55;border-radius:23px;background:linear-gradient(135deg,#fff7d7,#fff);box-shadow:0 8px 0 #c89432,0 18px 34px rgba(29,83,74,.16);text-align:left}.fg-wait-player>.fg-duel-photo{width:100px!important;height:100px!important;flex:0 0 100px;font-size:28px!important}.fg-wait-player>div:last-child{display:grid;gap:5px}.fg-wait-player>div:last-child>small{font-size:9px;font-weight:1000;letter-spacing:.17em;color:#986319}.fg-wait-player>div:last-child>strong{font-size:clamp(22px,4vw,32px);line-height:1.08;color:#153f3a}.fg-wait-player>div:last-child>span{font-size:12px;color:#687a75}.fg-wait-player .fg-duel-online{width:19px!important;height:19px!important}.fg-wait-world>h2{max-width:760px}@media(max-width:600px){.fg-wait-player{flex-direction:column;gap:13px;padding:18px 15px;text-align:center}.fg-wait-player>.fg-duel-photo{width:88px!important;height:88px!important;flex-basis:88px}.fg-wait-player>div:last-child>strong{font-size:23px}.fg-wait-world>h2{font-size:23px}}';
  var chatStyles='.fg-person-actions{display:flex;gap:6px}.fg-chat{height:calc(100vh - 145px);min-height:560px;display:flex;flex-direction:column;max-width:860px;margin:auto;background:#fff;border:1px solid rgba(30,50,45,.1);border-radius:18px;overflow:hidden}.fg-chat-head{display:flex;align-items:center;gap:10px;padding:13px;border-bottom:1px solid rgba(30,50,45,.1)}.fg-chat-head .fg-avatar{width:40px;height:40px}.fg-chat-head>div:nth-child(3){display:grid;flex:1}.fg-chat-head span{font-size:11px;color:var(--ac-charcoal-soft)}.fg-chat-messages{flex:1;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:9px;background:#f7f8f7}.fg-message{max-width:74%;padding:9px 12px;border-radius:14px;background:#fff;align-self:flex-start;display:grid}.fg-message.mine{align-self:flex-end;background:#dceee9}.fg-message.event{align-self:center;max-width:90%;background:#fff8e8;text-align:center}.fg-message small{font-size:9px;color:var(--ac-charcoal-soft);margin-top:4px}.fg-chat-form{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(30,50,45,.1)}.fg-chat-form input{flex:1}';

  var adminDashboardStyles='.fg-admin-dash{background:#fff;border:1px solid rgba(30,50,45,.1);border-radius:18px;padding:clamp(16px,3vw,26px)}.fg-admin-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.fg-admin-head h3{margin:3px 0 4px}.fg-admin-head p{margin:0;color:var(--ac-charcoal-soft);font-size:12px}.fg-live{display:flex;align-items:center;gap:7px;background:#e8f6ef;color:#187347;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:800;white-space:nowrap}.fg-live i{width:8px;height:8px;border-radius:50%;background:#27ae60;box-shadow:0 0 0 4px rgba(39,174,96,.13)}.fg-admin-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px}.fg-admin-metrics>div{border:1px solid rgba(30,50,45,.09);background:#f8faf9;border-radius:13px;padding:13px;display:grid;grid-template-columns:auto 1fr;column-gap:9px;align-items:center}.fg-admin-metrics i{font-size:20px;color:#267367;grid-row:1/3}.fg-admin-metrics b{font-size:22px;line-height:1}.fg-admin-metrics span{font-size:10px;color:var(--ac-charcoal-soft)}.fg-admin-list{display:grid;gap:9px}.fg-admin-match{display:flex;align-items:center;justify-content:space-between;gap:18px;border-top:1px solid rgba(30,50,45,.08);padding:14px 2px}.fg-admin-versus{display:flex;align-items:center;gap:13px;min-width:0}.fg-admin-versus>strong{color:var(--ac-charcoal-soft)}.fg-admin-player{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:7px;align-items:center;min-width:0}.fg-admin-player>i{width:9px;height:9px;border-radius:50%;grid-row:1/3}.fg-admin-player>i.on{background:#27ae60}.fg-admin-player>i.off{background:#a9b1ad}.fg-admin-player span{font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px}.fg-admin-player small,.fg-admin-info small{font-size:10px;color:var(--ac-charcoal-soft)}.fg-admin-info{display:grid;text-align:right;justify-items:end;min-width:210px}.fg-admin-info b{font-size:12px}.fg-admin-status{font-size:9px;font-weight:800;text-transform:uppercase;color:#176354;background:#dceee9;padding:4px 7px;border-radius:999px;margin-bottom:3px}.fg-admin-status.pausada,.fg-admin-status.aguardando{color:#76633d;background:#f2eee4}.fg-admin-empty{text-align:center;padding:34px 15px;display:grid;gap:5px;color:var(--ac-charcoal-soft)}.fg-admin-empty i{font-size:34px;opacity:.45}.fg-admin-empty b{color:var(--ac-charcoal)}@media(max-width:850px){.fg-admin-metrics{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.fg-admin-head,.fg-admin-match{align-items:stretch;flex-direction:column}.fg-admin-info{text-align:left;justify-items:start;min-width:0}.fg-admin-versus{justify-content:space-between}.fg-admin-player span{max-width:110px}}';

  var progressStyles='.fg-game-nav{display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border:1px solid rgba(30,50,45,.09);border-radius:16px;padding:6px;box-shadow:0 8px 24px rgba(30,50,45,.06)}.fg-game-nav button{border:0;background:transparent;border-radius:11px;padding:10px;display:flex;justify-content:center;align-items:center;gap:7px;color:var(--ac-charcoal-soft);font:700 12px Inter,sans-serif;cursor:pointer}.fg-game-nav button i{font-size:17px}.fg-game-nav button.active{background:#e4f2ee;color:#176354}.fg-profile-strip{display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:14px;background:linear-gradient(120deg,#fff,#f2f8f6);border:1px solid rgba(30,50,45,.1);border-radius:17px;padding:13px 16px}.fg-level-orb{width:57px;height:57px;border-radius:18px;background:linear-gradient(145deg,#e7bf72,#c89438);color:#173f3a;display:grid;place-items:center;align-content:center;box-shadow:0 7px 18px rgba(196,148,56,.25)}.fg-level-orb span{font-size:8px;font-weight:900;letter-spacing:.12em}.fg-level-orb b{font-size:23px;line-height:1}.fg-profile-progress{display:grid;gap:7px;min-width:0}.fg-profile-progress>div:first-child{display:flex;justify-content:space-between;gap:12px}.fg-profile-progress span{font-size:10px;color:var(--ac-charcoal-soft)}.fg-xp-track{height:7px;background:#dfeae7;border-radius:99px;overflow:hidden}.fg-xp-track i{display:block;height:100%;background:linear-gradient(90deg,#2a8b77,#58b89f);border-radius:99px}.fg-currency,.fg-streak{display:grid;grid-template-columns:auto auto;align-items:center;column-gap:5px;text-align:center}.fg-currency i{color:#c89438}.fg-streak i{color:#e36b43}.fg-currency span,.fg-streak span{grid-column:1/3;font-size:9px;color:var(--ac-charcoal-soft)}.fg-missions,.fg-page-card{background:#fff;border:1px solid rgba(30,50,45,.1);border-radius:18px;padding:clamp(16px,3vw,26px)}.fg-section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:13px}.fg-section-title h3{margin:3px 0 0}.fg-section-title small{color:var(--ac-charcoal-soft)}.fg-mission-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.fg-mission{border:1px solid rgba(30,50,45,.09);border-radius:13px;padding:12px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;background:#fafbfa}.fg-mission>i{font-size:22px;color:#2a806f}.fg-mission>div{display:grid;gap:4px}.fg-mission span,.fg-mission small{font-size:10px;color:var(--ac-charcoal-soft)}.fg-mission>div>div{height:5px;background:#e5ece9;border-radius:99px;overflow:hidden}.fg-mission>div>div i{display:block;height:100%;background:#3a9b85}.fg-mission.done{background:#edf8f3;border-color:#b9dfd1}.fg-ranking-hero,.fg-ach-head{text-align:center;padding:14px 10px 24px}.fg-ranking-hero h2,.fg-ach-head h2{font-size:clamp(28px,5vw,42px);margin:5px 0}.fg-ranking-hero p,.fg-ach-head p{color:var(--ac-charcoal-soft);margin:0 auto;max-width:600px}.fg-ranking-list{max-width:760px;margin:auto}.fg-rank-row{display:grid;grid-template-columns:40px 44px 1fr auto;gap:11px;align-items:center;padding:11px;border-top:1px solid rgba(30,50,45,.08)}.fg-rank-row>strong{font-size:18px;text-align:center}.fg-rank-row:nth-child(1)>strong{color:#c89438}.fg-rank-row:nth-child(2)>strong{color:#778480}.fg-rank-row:nth-child(3)>strong{color:#a86c3e}.fg-rank-row.me{background:#eaf6f2;border-radius:12px}.fg-rank-avatar,.fg-big-avatar{display:grid;place-items:center;border-radius:50%;background:#dceee9;color:#176354;font-weight:900}.fg-rank-avatar{width:42px;height:42px}.fg-rank-row>div:nth-child(3){display:grid}.fg-rank-row span{font-size:10px;color:var(--ac-charcoal-soft)}.fg-rank-row em{font-style:normal;font-weight:800;color:#276e62}.fg-profile-hero{display:flex;align-items:center;gap:15px;padding-bottom:18px;border-bottom:1px solid rgba(30,50,45,.08)}.fg-big-avatar{width:76px;height:76px;font-size:23px}.fg-profile-hero h2{margin:4px 0}.fg-profile-hero p{margin:0;color:var(--ac-charcoal-soft)}.fg-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:18px 0}.fg-stat-grid>div{background:#f5f8f7;border-radius:12px;padding:14px;text-align:center;display:grid}.fg-stat-grid b{font-size:23px}.fg-stat-grid span{font-size:10px;color:var(--ac-charcoal-soft)}.fg-insights{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fg-insights article{border-radius:14px;padding:15px;display:flex;gap:12px}.fg-insights article>i{font-size:28px}.fg-insights article>div{display:grid}.fg-insights span,.fg-insights small{font-size:10px}.fg-insights .best{background:#fff6df;color:#805d1c}.fg-insights .weak{background:#edf4fb;color:#315d82}.fg-subtitle{margin:22px 0 12px}.fg-mastery{display:grid;gap:10px}.fg-mastery>div{display:grid;grid-template-columns:180px 1fr 42px;align-items:center;gap:10px;font-size:12px}.fg-mastery span{display:flex;align-items:center;gap:7px}.fg-mastery span i{width:10px;height:10px;border-radius:50%}.fg-mastery>div>div{height:8px;background:#e7ecea;border-radius:99px;overflow:hidden}.fg-mastery>div>div i{display:block;height:100%;border-radius:99px}.fg-mastery>div>b{text-align:right}.fg-ach-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:11px}.fg-ach{border:1px solid rgba(30,50,45,.09);border-radius:15px;padding:17px 12px;text-align:center;display:grid;justify-items:center;gap:7px}.fg-ach>div{width:54px;height:54px;border-radius:18px;display:grid;place-items:center;background:#edf5f2;color:#287563;font-size:26px}.fg-ach span{font-size:11px;color:var(--ac-charcoal-soft);min-height:32px}.fg-ach small{font-size:8px;font-weight:900;letter-spacing:.1em;color:#2b816d}.fg-ach.locked{filter:grayscale(1);opacity:.55}.fg-ach.locked>div{background:#edf0ef}@media(max-width:760px){.fg-game-nav button span{display:none}.fg-profile-strip{grid-template-columns:auto 1fr}.fg-currency,.fg-streak{display:none}.fg-profile-progress>div:first-child{display:grid}.fg-mission-grid,.fg-ach-grid{grid-template-columns:1fr 1fr}.fg-insights{grid-template-columns:1fr}.fg-mastery>div{grid-template-columns:125px 1fr 36px}}@media(max-width:480px){.fg-mission-grid,.fg-ach-grid{grid-template-columns:1fr}.fg-stat-grid{grid-template-columns:1fr 1fr}}';

  var relockStyles = '.fg-hero-actions{display:flex;flex-direction:column;gap:8px;min-width:178px}.fg-lock-btn{background:rgba(255,255,255,.08)!important;color:#fff!important;border:1px solid rgba(255,255,255,.28)!important}.fg-lock-btn:hover{background:rgba(255,255,255,.16)!important}@media(max-width:760px){.fg-hero-actions{width:100%}.fg-hero-actions .btn{width:100%}}';

  var styles = '\
.fg-shell{display:grid;gap:18px;max-width:1180px;margin:0 auto}.fg-hero{background:linear-gradient(135deg,#173f3a,#246b5f);color:#fff;border-radius:22px;padding:clamp(22px,4vw,42px);display:flex;align-items:end;justify-content:space-between;gap:24px;box-shadow:0 16px 40px rgba(23,63,58,.18)}.fg-hero h2{font-size:clamp(26px,4vw,44px);line-height:1.06;max-width:720px;margin:8px 0 10px;color:#fff}.fg-hero p{margin:0;color:rgba(255,255,255,.78);max-width:650px}.fg-kicker{font:700 11px/1.2 Inter,sans-serif;letter-spacing:.16em;color:#e7bf72}.fg-community,.fg-invites{background:var(--ac-white,#fff);border:1px solid rgba(30,50,45,.1);border-radius:18px;padding:clamp(16px,3vw,26px)}.fg-section-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:14px}.fg-section-head h3,.fg-invites h3{margin:3px 0 0}.fg-search{display:flex;align-items:center;gap:7px;border:1px solid rgba(30,50,45,.18);border-radius:10px;padding:0 10px;min-width:230px}.fg-search input{border:0!important;box-shadow:none!important;padding:9px 0!important;width:100%}.fg-legend{display:flex;gap:18px;flex-wrap:wrap;font-size:12px;color:var(--ac-charcoal-soft);margin-bottom:14px}.fg-dot,.fg-status{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}.fg-dot.on,.fg-status.on{background:#27ae60;box-shadow:0 0 0 3px rgba(39,174,96,.14)}.fg-dot.off,.fg-status.off{background:#a9b1ad}.fg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.fg-person{display:flex;align-items:center;gap:12px;border:1px solid rgba(30,50,45,.09);border-radius:14px;padding:12px;background:#fff}.fg-avatar{width:46px;height:46px;min-width:46px;min-height:46px;max-width:46px;max-height:46px;aspect-ratio:1/1;border-radius:50%;background:#e8f0ed;color:#1b594f;display:grid;place-items:center;font-weight:800;position:relative;flex:0 0 46px;overflow:visible}.fg-avatar img{display:block;position:absolute;inset:0;width:46px!important;height:46px!important;min-width:46px;min-height:46px;max-width:46px;max-height:46px;aspect-ratio:1/1;border-radius:50%!important;object-fit:cover!important;object-position:center}.fg-status{position:absolute;right:-1px;bottom:1px;margin:0;border:2px solid #fff;width:11px;height:11px}.fg-person-copy{display:grid;min-width:0;flex:1}.fg-person-copy b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fg-person-copy span{font-size:12px;color:var(--ac-charcoal-soft)}.fg-invites{border-color:rgba(231,191,114,.5);background:#fffdf7}.fg-invite{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 0;border-top:1px solid rgba(30,50,45,.08)}.fg-invite>div:first-child{display:grid}.fg-invite span{font-size:13px;color:var(--ac-charcoal-soft)}.fg-invite>div:last-child{display:flex;gap:7px}.fg-empty{text-align:center;padding:32px;color:var(--ac-charcoal-soft);grid-column:1/-1}.fg-game-frame{height:calc(100vh - 118px);min-height:620px;display:flex;flex-direction:column}.fg-framebar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 0 10px;font-size:12px;color:var(--ac-charcoal-soft)}.fg-game-frame iframe{width:100%;flex:1;border:0;border-radius:18px;background:#f4f1e9}.fg-match{max-width:680px;margin:50px auto;text-align:center;background:#fff;border-radius:22px;padding:48px 28px;border:1px solid rgba(30,50,45,.1)}.fg-match-icon{width:74px;height:74px;border-radius:50%;display:grid;place-items:center;margin:0 auto 18px;background:#e7f1ee;color:#1f655a;font-size:36px}.fg-match h2{margin:9px 0}.fg-match p{color:var(--ac-charcoal-soft);margin-bottom:24px}@media(max-width:760px){.fg-hero{align-items:stretch;flex-direction:column}.fg-hero .btn{width:100%}.fg-grid{grid-template-columns:1fr}.fg-section-head{align-items:stretch;flex-direction:column}.fg-search{min-width:0}.fg-person{padding:10px}.fg-invite{align-items:flex-start;flex-direction:column}.fg-game-frame{height:calc(100vh - 92px);min-height:520px}.fg-framebar span{display:none}}';

  var premiumStyles='.fg-shell{position:relative;padding:clamp(8px,2vw,20px);border-radius:30px;background:radial-gradient(circle at 12% 4%,rgba(92,202,176,.2),transparent 24%),radial-gradient(circle at 90% 12%,rgba(238,196,94,.18),transparent 25%),linear-gradient(155deg,#f2f8f5,#e9f2ef);box-shadow:inset 0 0 0 1px rgba(23,63,58,.06)}.fg-game-nav{position:sticky;top:8px;z-index:40!important;background:rgba(18,63,58,.94)!important;border:2px solid rgba(255,255,255,.15)!important;border-radius:20px!important;box-shadow:0 12px 28px rgba(16,55,50,.2)!important;backdrop-filter:blur(14px)}.fg-game-nav button{color:rgba(255,255,255,.68)!important;border:1px solid transparent!important;transition:.2s!important}.fg-game-nav button:hover{color:#fff!important;background:rgba(255,255,255,.08)!important;transform:translateY(-1px)}.fg-game-nav button.active{background:linear-gradient(180deg,#f7d77e,#dca43f)!important;color:#53350e!important;border-color:#fff0b6!important;box-shadow:0 4px 0 #8d5b1e,0 8px 15px rgba(0,0,0,.2)}.fg-profile-strip{border:2px solid #fff!important;border-radius:22px!important;background:linear-gradient(120deg,#fffef8,#eef8f4)!important;box-shadow:0 14px 35px rgba(23,63,58,.1)!important}.fg-level-orb{border-radius:50%!important;border:4px solid #fff3bd;box-shadow:0 0 0 3px #a66d20,0 9px 20px rgba(148,93,22,.28)!important}.fg-xp-track{height:10px!important;border:2px solid #d5e5df}.fg-xp-track i{background:linear-gradient(90deg,#2b9b7e,#64d2b4,#f0c35d)!important}.fg-hero{border:3px solid rgba(255,255,255,.2);border-radius:28px!important;background:radial-gradient(circle at 75% 50%,rgba(96,208,180,.28),transparent 30%),linear-gradient(135deg,#103d38,#1d685d)!important;box-shadow:0 20px 45px rgba(15,58,52,.25)!important}.fg-community,.fg-invites,.fg-missions,.fg-page-card{border:2px solid #fff!important;border-radius:24px!important;box-shadow:0 14px 35px rgba(23,63,58,.09)!important;background:linear-gradient(145deg,#fff,#fbfdfc)!important}.fg-person{border:2px solid #e6efeb!important;border-radius:18px!important;box-shadow:0 6px 0 #dce9e4;background:linear-gradient(145deg,#fff,#f5faf8)!important}.fg-person:hover{border-color:#60bca5!important;transform:translateY(-4px)!important;box-shadow:0 10px 0 #cce3db,0 16px 25px rgba(23,63,58,.1)!important}.fg-avatar{background:linear-gradient(145deg,#61c6aa,#2c806f)!important;color:#fff!important;border:3px solid #fff;box-shadow:0 0 0 2px #b9ddd3}.fg-person-actions .btn,.fg-invite .btn{border-radius:12px!important;font-weight:900!important}.fg-mission{border:2px solid #e4eee9!important;border-radius:18px!important;background:linear-gradient(145deg,#fff,#f5faf8)!important;box-shadow:0 5px 0 #dce8e3}.fg-mission>i{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:#dff3ec}.fg-mission.done{background:linear-gradient(145deg,#effbf5,#ddf5e9)!important;border-color:#83cbb1!important}.fg-ranking-hero,.fg-ach-head{margin:-1px -1px 22px;border-radius:21px;padding:30px 18px!important;color:#fff;background:radial-gradient(circle at 85% 10%,rgba(239,199,97,.28),transparent 25%),linear-gradient(135deg,#123f3a,#246d61)}.fg-ranking-hero h2,.fg-ach-head h2{color:#fff}.fg-ranking-hero p,.fg-ach-head p{color:rgba(255,255,255,.72)!important}.fg-ranking-hero .eyebrow,.fg-ach-head .eyebrow{color:#f1ca69}.fg-rank-row{border:2px solid #e6eeeb!important;border-radius:16px;margin:8px 0;background:#fff;box-shadow:0 5px 0 #dfe8e4;transition:.2s}.fg-rank-row:nth-child(1){background:linear-gradient(100deg,#fff9df,#fff);border-color:#eac35e!important;box-shadow:0 6px 0 #c9962f}.fg-rank-row:nth-child(2){background:linear-gradient(100deg,#f1f5f4,#fff)}.fg-rank-row:nth-child(3){background:linear-gradient(100deg,#fff1e8,#fff)}.fg-rank-avatar{border:3px solid #fff;box-shadow:0 0 0 2px #b8d7ce}.fg-profile-hero{margin:-1px -1px 22px;padding:26px!important;border:0!important;border-radius:21px;background:linear-gradient(135deg,#153f3a,#286e62);color:#fff}.fg-profile-hero h2{color:#fff}.fg-profile-hero p{color:rgba(255,255,255,.7)!important}.fg-big-avatar{background:linear-gradient(145deg,#f3d270,#d59a34)!important;color:#173f3a!important;border:5px solid #fff2bd;box-shadow:0 0 0 3px #9b651d}.fg-stat-grid>div{border:2px solid #e4eeea;border-radius:17px!important;background:linear-gradient(#fff,#f4f9f7)!important;box-shadow:0 5px 0 #dce8e3}.fg-stat-grid b{color:#176354}.fg-insights article{border:2px solid rgba(255,255,255,.8);border-radius:19px!important;box-shadow:0 7px 18px rgba(23,63,58,.08)}.fg-mastery>div>div{height:12px!important;border:2px solid #dce8e3}.fg-ach{border:2px solid #e3ece8!important;border-radius:20px!important;box-shadow:0 6px 0 #dbe6e2;background:linear-gradient(#fff,#f5faf8);transition:.25s}.fg-ach.unlocked{border-color:#e1b94f!important;background:linear-gradient(145deg,#fffdf1,#fff);box-shadow:0 7px 0 #c99630}.fg-ach>div{width:68px!important;height:68px!important;border-radius:50%!important;border:4px solid #fff;box-shadow:0 0 0 3px #79bca9,0 8px 16px rgba(23,63,58,.15);background:linear-gradient(145deg,#5fc6aa,#277867)!important;color:#fff!important}.fg-ach.unlocked>div{box-shadow:0 0 0 3px #a66a1d,0 8px 16px rgba(117,70,11,.2);background:linear-gradient(145deg,#f5d575,#d79c33)!important;color:#56370e!important}.fg-ach.locked{opacity:.48!important}.fg-empty{border:2px dashed #c8dcd5;border-radius:18px;background:#f5faf8}.fg-wait{border:2px solid #fff!important;border-radius:26px!important;background:radial-gradient(circle at 50% 25%,rgba(86,196,170,.18),transparent 25%),linear-gradient(145deg,#fff,#edf7f3)!important;box-shadow:0 18px 40px rgba(23,63,58,.12)}@media(max-width:600px){.fg-shell{padding:5px;border-radius:20px}.fg-game-nav{top:4px}.fg-profile-strip{border-radius:17px!important}.fg-community,.fg-invites,.fg-missions,.fg-page-card{border-radius:19px!important}.fg-ranking-hero,.fg-ach-head,.fg-profile-hero{border-radius:17px}}';
  styles += premiumStyles;
  progressStyles += premiumStyles;
  gameStyles += premiumStyles+'.fg-question-card{border:3px solid #fff!important;border-top:8px solid var(--category)!important;border-radius:27px!important;box-shadow:0 20px 45px rgba(17,60,54,.16)!important}.fg-question-card .fg-options button{min-height:68px;border:2px solid #dfe9e5!important;border-radius:17px!important;background:linear-gradient(#fff,#f6faf8)!important;box-shadow:0 5px 0 #d9e4df;font-size:14px}.fg-question-card .fg-options button:hover:not(:disabled){border-color:var(--category)!important;box-shadow:0 7px 0 color-mix(in srgb,var(--category) 30%,#d9e4df)!important}.fg-question-card .fg-options button>span{border:2px solid #fff;box-shadow:0 0 0 2px #d6e4df;font-weight:900}.fg-versus{border:3px solid rgba(255,255,255,.18);border-radius:26px!important}.fg-objective{border:2px solid #fff!important;border-radius:20px!important;box-shadow:0 10px 25px rgba(23,63,58,.09)}.fg-seal-board>div{border:2px solid #fff;box-shadow:0 0 0 2px #dfe9e5}.fg-seal-board>div.got{box-shadow:0 0 0 2px color-mix(in srgb,var(--seal) 70%,#333),0 7px 14px color-mix(in srgb,var(--seal) 25%,transparent)}';
  chatStyles += '.fg-chat{border:3px solid #fff!important;border-radius:25px!important;box-shadow:0 20px 50px rgba(23,63,58,.16)!important}.fg-chat-head{background:linear-gradient(135deg,#153f3a,#286d61);color:#fff;padding:16px!important}.fg-chat-head span{color:rgba(255,255,255,.68)!important}.fg-chat-messages{background:radial-gradient(circle at 10% 10%,rgba(89,190,165,.12),transparent 24%),#edf5f2!important}.fg-message{border:1px solid #e0ebe7;box-shadow:0 4px 12px rgba(23,63,58,.07)}.fg-message.mine{background:linear-gradient(145deg,#d8f3e9,#c7eade)!important}.fg-message.event{background:linear-gradient(145deg,#fff8d8,#fff)!important;border-color:#e9ca72}.fg-chat-form{background:#fff;padding:14px!important}.fg-chat-form input{border:2px solid #dce9e4!important;border-radius:14px!important}';

  var responsiveStyles='*,*:before,*:after{box-sizing:border-box}.fg-shell,.fg-play,.fg-chat,.fg-game-frame,.fg-page-card,.fg-community,.fg-invites,.fg-missions{min-width:0;max-width:100%}.fg-shell img,.fg-play img,.fg-chat img{max-width:100%}.fg-person-copy,.fg-profile-progress,.fg-section-title>div,.fg-question-card,.fg-fact-card{min-width:0}.fg-question-card h2,.fg-wait-world h2,.fg-fact-card p,.fg-message{overflow-wrap:anywhere}.fg-game-nav button,.fg-person-actions button,.fg-wait-actions button,.fg-options button,.fg-spin-button,.fg-wheel-center{touch-action:manipulation;-webkit-tap-highlight-color:transparent}.fg-game-nav button,.fg-round-btn,.fg-sound-dock button{min-width:44px;min-height:44px}@media(min-width:1400px){.fg-shell{max-width:1320px!important}.fg-play{max-width:1120px!important}.fg-community,.fg-invites,.fg-missions,.fg-page-card{padding:30px!important}.fg-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.fg-mission-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.fg-ach-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.fg-wheel-stage{min-height:640px}.fg-wheel-shell{width:410px}.fg-question-card h2{font-size:34px}}@media(min-width:901px) and (max-width:1399px){.fg-shell{max-width:1180px}.fg-play{width:min(980px,100%)}.fg-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(min-width:601px) and (max-width:900px){.fg-shell{padding:12px!important}.fg-hero{padding:28px!important}.fg-hero-stage{gap:12px}.fg-grid{grid-template-columns:1fr 1fr}.fg-mission-grid{grid-template-columns:1fr 1fr}.fg-ach-grid{grid-template-columns:repeat(3,1fr)}.fg-stat-grid{grid-template-columns:repeat(4,1fr)}.fg-profile-strip{grid-template-columns:auto 1fr auto}.fg-streak{display:none}.fg-versus{padding:19px!important}.fg-wheel-shell{width:min(48vw,360px)}.fg-question-card{padding:28px!important}.fg-chat{height:calc(100dvh - 125px);min-height:480px}.fg-admin-metrics{grid-template-columns:repeat(2,1fr)!important}}@media(max-width:600px){.fg-shell{width:100%;padding:4px!important;gap:12px!important;border-radius:17px!important}.fg-game-nav{grid-template-columns:repeat(4,minmax(0,1fr));padding:4px!important;border-radius:16px!important;top:max(3px,env(safe-area-inset-top))!important}.fg-game-nav button{padding:9px 4px!important;gap:0!important;border-radius:10px!important}.fg-game-nav button i{font-size:20px!important}.fg-game-nav button span{display:none!important}.fg-profile-strip{grid-template-columns:48px minmax(0,1fr)!important;gap:10px!important;padding:10px!important}.fg-level-orb{width:46px!important;height:46px!important;border-width:3px!important}.fg-level-orb b{font-size:18px!important}.fg-profile-progress>div:first-child{display:grid!important;gap:2px}.fg-currency,.fg-streak{display:none!important}.fg-hero{min-height:0!important;padding:22px 16px!important;border-radius:20px!important;align-items:stretch!important}.fg-hero-copy h2{font-size:clamp(25px,9vw,34px)!important}.fg-hero-copy p{font-size:12px}.fg-hero-stage{width:100%;justify-content:space-between;align-items:flex-end}.fg-mascot{width:68px!important;height:82px!important}.fg-community,.fg-invites,.fg-missions,.fg-page-card{padding:14px!important;border-radius:18px!important}.fg-section-head,.fg-section-title{align-items:stretch!important;display:grid!important;gap:10px}.fg-search{width:100%;min-width:0!important}.fg-grid,.fg-mission-grid,.fg-ach-grid,.fg-insights{grid-template-columns:1fr!important}.fg-person{gap:9px!important;padding:10px!important}.fg-person-actions{display:grid!important;grid-template-columns:1fr;min-width:94px}.fg-person-actions .btn{width:100%;padding-inline:8px!important}.fg-invite{gap:10px!important}.fg-invite>div:last-child{width:100%;display:grid!important;grid-template-columns:1fr 1fr}.fg-mission{grid-template-columns:40px minmax(0,1fr) auto!important;padding:10px!important}.fg-mission>i{width:38px!important;height:38px!important}.fg-ranking-hero,.fg-ach-head{padding:23px 12px!important}.fg-ranking-hero h2,.fg-ach-head h2{font-size:28px!important}.fg-rank-row{grid-template-columns:29px 38px minmax(0,1fr) auto!important;gap:7px!important;padding:9px 7px!important}.fg-rank-avatar{width:36px!important;height:36px!important}.fg-rank-row em{font-size:11px}.fg-profile-hero{display:grid!important;justify-items:center;text-align:center;padding:20px 14px!important}.fg-big-avatar{width:66px!important;height:66px!important}.fg-stat-grid{grid-template-columns:1fr 1fr!important;gap:7px!important}.fg-stat-grid>div{padding:11px 6px!important}.fg-mastery>div{grid-template-columns:minmax(90px,120px) minmax(0,1fr) 34px!important;gap:7px!important}.fg-mastery span{font-size:10px}.fg-ach{padding:14px 10px!important}.fg-ach>div{width:58px!important;height:58px!important}.fg-arena-top{display:grid!important;grid-template-columns:44px minmax(0,1fr);gap:8px!important}.fg-arena-top>.fg-turn{grid-column:1/-1;width:100%;justify-content:center;text-align:center}.fg-versus{grid-template-columns:minmax(0,1fr) 52px minmax(0,1fr)!important;padding:16px 7px!important;border-radius:20px!important}.fg-versus>div{min-width:0!important}.fg-versus>div b{max-width:100px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fg-versus>div small{font-size:7px}.fg-versus>strong{font-size:22px!important}.fg-duel-photo{width:62px!important;height:62px!important;border-width:3px!important}.fg-duel-online{width:13px!important;height:13px!important;border-width:2px!important}.fg-turn-callout{padding:10px 11px!important;gap:9px!important}.fg-turn-callout>i{width:36px!important;height:36px!important;font-size:19px!important}.fg-turn-callout b{font-size:12px}.fg-turn-callout span{font-size:9px!important}.fg-objective{padding:11px!important}.fg-objective>div:first-child{text-align:center}.fg-seal-board{width:100%;display:grid!important;grid-template-columns:repeat(3,1fr)!important}.fg-seal-board>div{width:auto!important;height:43px!important}.fg-wheel-stage{min-height:0!important;padding:20px 8px 25px!important;border-radius:20px!important}.fg-wheel-copy h2{font-size:25px!important}.fg-wheel-copy p{padding:0 8px}.fg-wheel-shell{width:min(84vw,330px)!important;margin:20px 0 14px!important}.fg-wheel{border-width:9px!important}.fg-wheel-pointer{width:43px!important;height:53px!important}.fg-wheel-center{border-width:4px!important;font-size:17px!important}.fg-spin-button{width:min(290px,92%)!important;min-height:48px}.fg-question-card{padding:18px 12px!important;border-radius:20px!important}.fg-question-meta{gap:8px}.fg-question-meta span{max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fg-question-card h2{font-size:clamp(19px,6vw,25px)!important;line-height:1.3!important;margin-bottom:18px!important}.fg-options{grid-template-columns:1fr!important}.fg-question-card .fg-options button{min-height:58px!important;padding:11px!important;font-size:13px}.fg-wait-world{min-height:0!important;padding:55px 11px 30px!important}.fg-wait-world h2{font-size:22px!important}.fg-wait-world>p{font-size:12px}.fg-fact-card{padding:15px!important}.fg-fact-card p{font-size:12px!important}.fg-wait-actions{width:100%;display:grid!important}.fg-wait-actions button{width:100%;min-height:46px}.fg-chat{height:calc(100dvh - 92px)!important;min-height:430px!important;border-radius:17px!important}.fg-chat-head{display:grid!important;grid-template-columns:38px 40px minmax(0,1fr)!important;padding:10px!important}.fg-chat-head .btn:last-child{grid-column:1/-1;width:100%}.fg-chat-messages{padding:12px!important}.fg-message{max-width:88%!important}.fg-chat-form{padding:9px!important}.fg-chat-form input{min-width:0}.fg-game-frame{height:calc(100dvh - 80px)!important;min-height:480px!important}.fg-framebar{padding-inline:4px}.fg-framebar .btn{min-height:44px}.fg-sound-dock{right:max(8px,env(safe-area-inset-right))!important;bottom:max(68px,calc(env(safe-area-inset-bottom) + 58px))!important}.fg-admin-dash{padding:13px!important}.fg-admin-metrics{grid-template-columns:1fr 1fr!important}.fg-admin-metrics>div{padding:10px!important}.fg-admin-match{gap:10px!important}.fg-admin-versus{width:100%;gap:7px!important}.fg-admin-player span{max-width:90px!important}}@media(max-width:359px){.fg-shell{font-size:13px}.fg-game-nav button{min-width:0!important}.fg-profile-strip{grid-template-columns:42px minmax(0,1fr)!important}.fg-level-orb{width:40px!important;height:40px!important}.fg-hero{padding:18px 12px!important}.fg-mascot{display:none!important}.fg-community,.fg-invites,.fg-missions,.fg-page-card{padding:11px!important}.fg-person{display:grid!important;grid-template-columns:46px minmax(0,1fr)}.fg-person-actions{grid-column:1/-1;grid-template-columns:1fr 1fr!important}.fg-versus{grid-template-columns:minmax(0,1fr) 42px minmax(0,1fr)!important}.fg-duel-photo{width:52px!important;height:52px!important}.fg-versus>div b{max-width:78px}.fg-versus>div>em{font-size:5px!important;padding:3px 5px!important}.fg-versus>strong{font-size:18px!important}.fg-wheel-shell{width:min(88vw,285px)!important}.fg-wheel>span i{font-size:22px!important}.fg-wheel-center{font-size:14px!important}.fg-turn-callout>i{display:none}.fg-rank-row{grid-template-columns:24px 34px minmax(0,1fr)!important}.fg-rank-row em{grid-column:3;text-align:left}.fg-mastery>div{grid-template-columns:90px minmax(0,1fr) 30px!important}.fg-admin-metrics{grid-template-columns:1fr!important}}@media(max-height:600px) and (orientation:landscape){.fg-wheel-stage{min-height:0!important;padding:13px!important;grid-template-columns:minmax(210px,38%) 1fr;grid-template-rows:auto 1fr auto;align-items:center;column-gap:18px}.fg-wheel-copy{grid-column:2;grid-row:1}.fg-wheel-shell{grid-column:1;grid-row:1/4;width:min(54vh,300px)!important;margin:5px!important}.fg-wheel-result{grid-column:2;grid-row:2;align-self:end}.fg-spin-button{grid-column:2;grid-row:3;align-self:start}.fg-versus{padding:10px 20px!important}.fg-duel-photo{width:58px!important;height:58px!important}.fg-objective{padding:8px 12px!important}.fg-wait-world{padding:30px 20px!important}.fg-wait-orbit{width:68px!important;height:68px!important;font-size:30px!important;margin-bottom:12px!important}.fg-fact-card{margin-top:12px!important}.fg-question-card{padding:16px!important}.fg-question-card h2{font-size:21px!important;margin:5px auto 14px!important}.fg-question-card .fg-options button{min-height:50px!important}.fg-chat{height:calc(100dvh - 70px)!important;min-height:330px!important}}@media(pointer:coarse){.fg-person:hover,.fg-mission:hover,.fg-ach:hover,.fg-rank-row:hover,.fg-question-card .fg-options button:hover{transform:none!important}.fg-game-nav button,.fg-person-actions button,.fg-wait-actions button,.fg-options button{min-height:44px}}@media(prefers-reduced-motion:reduce){.fg-turn-callout,.fg-versus>div.active-turn:before,.fg-wait-orbit>b,.fg-fact-card p{animation:none!important;transition:none!important}}';
  styles += responsiveStyles;
  progressStyles += responsiveStyles;
  gameStyles += responsiveStyles;
  chatStyles += responsiveStyles;
  adminDashboardStyles += responsiveStyles;

  var iconFixStyles='.fg-shell .ti,.fg-play .ti,.fg-chat .ti,.fg-game-frame .ti,.fg-admin-dash .ti{display:inline-flex;align-items:center;justify-content:center;width:1.15em;height:1.15em;min-width:1.15em;min-height:1.15em;max-width:1.15em;max-height:1.15em;line-height:1;vertical-align:middle;flex:0 0 1.15em;font-style:normal}.fg-shell button>.ti,.fg-play button>.ti,.fg-chat button>.ti{font-size:1.15em}.fg-game-nav button .ti{width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;max-width:22px!important;max-height:22px!important;font-size:20px!important}.fg-level-orb .ti,.fg-currency .ti,.fg-streak .ti{font-size:18px}.fg-mission>i.ti{width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important;max-width:46px!important;max-height:46px!important;font-size:23px!important;flex:0 0 46px!important}.fg-ach>div>.ti{width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;max-width:32px!important;max-height:32px!important;font-size:30px!important}.fg-insights article>i.ti{width:34px!important;height:34px!important;min-width:34px!important;min-height:34px!important;max-width:34px!important;max-height:34px!important;font-size:30px!important}.fg-wheel>span{box-sizing:border-box}.fg-wheel>span>i.ti{width:43px!important;height:43px!important;min-width:43px!important;min-height:43px!important;max-width:43px!important;max-height:43px!important;border-radius:14px;background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.5);font-size:25px!important;padding:0!important;line-height:1!important;flex:0 0 43px!important}.fg-wheel>span>small{width:84px;text-align:center;line-height:1.1}.fg-wheel-pointer{aspect-ratio:52/62}.fg-wheel-center .ti,.fg-spin-button .ti{font-size:18px}.fg-seal-board>div>.ti{width:19px!important;height:19px!important;min-width:19px!important;min-height:19px!important;max-width:19px!important;max-height:19px!important;font-size:18px!important}.fg-turn-callout>i.ti{width:43px!important;height:43px!important;min-width:43px!important;min-height:43px!important;max-width:43px!important;max-height:43px!important;flex:0 0 43px!important;font-size:23px!important}.fg-wait-orbit>i.ti{width:58px!important;height:58px!important;min-width:58px!important;min-height:58px!important;max-width:58px!important;max-height:58px!important;font-size:52px!important}.fg-fact-card>div>i.ti{width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;max-width:22px!important;max-height:22px!important;font-size:20px!important}.fg-question-meta .ti{font-size:15px}.fg-answer-feedback>i.ti{width:27px!important;height:27px!important;min-width:27px!important;min-height:27px!important;max-width:27px!important;max-height:27px!important;font-size:25px!important}.fg-wait-pulse>.ti{width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;max-width:42px!important;max-height:42px!important;font-size:38px!important}.fg-round-btn>.ti,.fg-chat-head button>.ti{font-size:20px}.fg-sound-dock button>.ti{width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;max-width:22px!important;max-height:22px!important;font-size:20px!important}.fg-admin-metrics .ti{width:24px!important;height:24px!important;min-width:24px!important;min-height:24px!important;max-width:24px!important;max-height:24px!important;font-size:22px!important}@media(max-width:600px){.fg-mission>i.ti{width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;max-width:38px!important;max-height:38px!important;font-size:20px!important;flex-basis:38px!important}.fg-ach>div>.ti{width:28px!important;height:28px!important;min-width:28px!important;min-height:28px!important;max-width:28px!important;max-height:28px!important;font-size:26px!important}.fg-wheel>span>i.ti{width:35px!important;height:35px!important;min-width:35px!important;min-height:35px!important;max-width:35px!important;max-height:35px!important;font-size:21px!important;border-radius:11px;flex-basis:35px!important}.fg-turn-callout>i.ti{width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;max-width:36px!important;max-height:36px!important;font-size:19px!important;flex-basis:36px!important}.fg-wait-orbit>i.ti{width:45px!important;height:45px!important;min-width:45px!important;min-height:45px!important;max-width:45px!important;max-height:45px!important;font-size:40px!important}}@media(max-width:359px){.fg-wheel>span>i.ti{width:30px!important;height:30px!important;min-width:30px!important;min-height:30px!important;max-width:30px!important;max-height:30px!important;font-size:18px!important;flex-basis:30px!important}}';
  styles += iconFixStyles;
  progressStyles += iconFixStyles;
  gameStyles += iconFixStyles;
  chatStyles += iconFixStyles;
  adminDashboardStyles += iconFixStyles;

  var mascotStyles='.fg-capy-mascot{display:grid!important;place-items:end center!important;width:168px!important;height:178px!important;position:relative!important;flex:0 0 168px!important;background:transparent!important;border-radius:0!important;box-shadow:none!important;overflow:visible!important;isolation:isolate}.fg-capy-mascot:before,.fg-capy-mascot:after,.fg-capy-mascot .fg-mascot-face,.fg-capy-mascot>em{display:none!important}.fg-capy-mascot>img{display:block!important;width:168px!important;height:168px!important;max-width:none!important;object-fit:contain!important;object-position:center bottom!important;filter:drop-shadow(0 17px 16px rgba(4,35,31,.28));transform-origin:center bottom;animation:fgCapyBreathe 3.2s ease-in-out infinite}.fg-capy-mascot.fg-capy-fallback:before{content:"🦫"!important;display:grid!important;place-items:center!important;width:132px;height:132px;border-radius:50%;background:linear-gradient(145deg,#f3d070,#d99c35);font-size:72px;filter:drop-shadow(0 13px 14px rgba(4,35,31,.25))}.fg-capy-mascot>small{z-index:3!important;top:-4px!important;right:-8px!important;bottom:auto!important;white-space:nowrap;font-size:11px!important;padding:8px 11px!important;border:2px solid rgba(23,63,58,.08);animation:fgPop .6s .3s both,fgCapyBubble 3s 1s ease-in-out infinite!important}.fg-capy-mascot>small:after{content:"";position:absolute;right:21px;bottom:-8px;width:14px;height:14px;background:#fff;transform:rotate(45deg);border-right:2px solid rgba(23,63,58,.08);border-bottom:2px solid rgba(23,63,58,.08)}@keyframes fgCapyBreathe{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-6px) rotate(1deg)}}@keyframes fgCapyBubble{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@media(max-width:850px){.fg-capy-mascot{width:132px!important;height:145px!important;flex-basis:132px!important}.fg-capy-mascot>img{width:138px!important;height:138px!important}.fg-capy-mascot>small{display:block!important;right:-2px!important;top:-6px!important;font-size:9px!important}}@media(max-width:600px){.fg-capy-mascot{width:108px!important;height:120px!important;flex-basis:108px!important}.fg-capy-mascot>img{width:116px!important;height:116px!important}.fg-capy-mascot.fg-capy-fallback:before{width:92px;height:92px;font-size:52px}.fg-capy-mascot>small{font-size:8px!important;padding:6px 8px!important;right:-7px!important}}@media(max-width:359px){.fg-capy-mascot{display:grid!important;width:82px!important;height:96px!important;flex-basis:82px!important}.fg-capy-mascot>img{width:92px!important;height:92px!important}.fg-capy-mascot>small{display:none!important}}@media(prefers-reduced-motion:reduce){.fg-capy-mascot>img,.fg-capy-mascot>small{animation:none!important}}';
  styles += mascotStyles;
  progressStyles += mascotStyles;
  var mascotScaleStyles='.fg-capy-mascot{width:248px!important;height:245px!important;flex-basis:248px!important}.fg-capy-mascot>img{width:242px!important;height:242px!important}.fg-capy-mascot>small{top:5px!important;right:3px!important;font-size:12px!important}.fg-hero-stage{align-items:center!important}@media(max-width:1050px){.fg-capy-mascot{width:190px!important;height:195px!important;flex-basis:190px!important}.fg-capy-mascot>img{width:190px!important;height:190px!important}.fg-capy-mascot>small{font-size:10px!important}}@media(max-width:700px){.fg-capy-mascot{width:150px!important;height:158px!important;flex-basis:150px!important}.fg-capy-mascot>img{width:154px!important;height:154px!important}.fg-capy-mascot>small{display:block!important;top:-2px!important;right:-4px!important;font-size:9px!important}.fg-hero-stage{align-items:flex-end!important}}@media(max-width:420px){.fg-capy-mascot{width:118px!important;height:126px!important;flex-basis:118px!important}.fg-capy-mascot>img{width:124px!important;height:124px!important}.fg-capy-mascot>small{font-size:7px!important;padding:5px 7px!important}.fg-hero-actions{min-width:140px!important}}@media(max-width:359px){.fg-capy-mascot{width:102px!important;height:110px!important;flex-basis:102px!important}.fg-capy-mascot>img{width:108px!important;height:108px!important}.fg-capy-mascot>small{display:none!important}}';
  styles += mascotScaleStyles;
  progressStyles += mascotScaleStyles;
  var mascotRotationStyles='.fg-capy-mascot{animation:fgCapyBreathe 3.2s ease-in-out infinite}.fg-capy-mascot>img.fg-capy-frame{position:absolute!important;left:50%!important;bottom:0!important;grid-area:auto!important;opacity:0!important;visibility:hidden!important;transform:translateX(-50%) scale(.94)!important;transition:opacity .65s ease,transform .65s cubic-bezier(.2,.75,.25,1),visibility 0s linear .65s!important;animation:none!important;pointer-events:none}.fg-capy-mascot>img.fg-capy-frame.is-active{opacity:1!important;visibility:visible!important;transform:translateX(-50%) scale(1)!important;transition-delay:0s!important}.fg-capy-mascot>img.fg-capy-frame.has-error{display:none!important}.fg-capy-mascot>small{transition:opacity .25s ease,transform .25s ease}@media(prefers-reduced-motion:reduce){.fg-capy-mascot{animation:none!important}.fg-capy-mascot>img.fg-capy-frame{transition:none!important}}';
  styles += mascotRotationStyles;
  progressStyles += mascotRotationStyles;
  var rulesGuideStyles='.fg-rules-guide{border:2px solid #e6c263;border-radius:21px;background:linear-gradient(145deg,#fff9de,#fff);box-shadow:0 9px 0 #c99531;overflow:hidden}.fg-rules-guide summary{list-style:none;display:flex;align-items:center;gap:12px;padding:17px 20px;cursor:pointer;color:#68450f}.fg-rules-guide summary::-webkit-details-marker{display:none}.fg-rules-guide summary>i:first-child{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:#edbd4f;color:#fff;font-size:22px}.fg-rules-guide summary>span{display:grid;flex:1}.fg-rules-guide summary b{font-size:15px}.fg-rules-guide summary small{font-size:10px;color:#8d744b}.fg-rules-guide summary>i:last-child{transition:.2s}.fg-rules-guide[open] summary>i:last-child{transform:rotate(180deg)}.fg-rules-guide>div{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:0 17px 18px}.fg-rules-guide article{display:grid;gap:4px;padding:13px;border-radius:14px;background:#fff;border:1px solid #eadfbf}.fg-rules-guide article b{font-size:11px;color:#185d51}.fg-rules-guide article span{font-size:10px;line-height:1.45;color:#6c7773}@media(max-width:700px){.fg-rules-guide>div{grid-template-columns:1fr 1fr;padding:0 11px 14px}.fg-rules-guide summary{padding:13px}.fg-rules-guide article{padding:10px}}@media(max-width:380px){.fg-rules-guide>div{grid-template-columns:1fr}}';
  styles += rulesGuideStyles;
  progressStyles += rulesGuideStyles;

  var classicRulesStyles='.fg-wheel{background:conic-gradient(from -25.714deg,#43a568 0 51.428deg,#3689cc 51.428deg 102.856deg,#ef8744 102.856deg 154.284deg,#8a58bd 154.284deg 205.712deg,#25a8a2 205.712deg 257.14deg,#e7bc39 257.14deg 308.568deg,#e6a934 308.568deg 360deg)!important}.fg-wheel>span{transform:rotate(calc(var(--i)*51.428deg))!important}.fg-wheel .fg-crown-slice i{background:#f8d96c!important;color:#6f470c!important;border-color:#fff1ad!important}.fg-crown-meter{display:grid;grid-template-columns:auto minmax(120px,1fr) auto;align-items:center;gap:12px;margin:13px 0;padding:11px 15px;border-radius:16px;background:#fff8d9;border:2px solid #e4bc50;color:#755015}.fg-crown-meter>span{font-size:11px;font-weight:900}.fg-crown-meter>span i{color:#d39a28}.fg-crown-meter>div{height:11px;border-radius:99px;background:#eadfbd;overflow:hidden}.fg-crown-meter>div i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#e5aa32,#ffe27b);transition:.4s}.fg-crown-meter>b{font-size:11px}.fg-question-timer{display:inline-flex!important;align-items:center;gap:5px;min-width:58px;justify-content:center;background:#e9f5f1!important;color:#176454!important;font-size:14px!important;font-style:normal;border-radius:999px;padding:7px 10px!important}.fg-question-timer.urgent{background:#ffe0dc!important;color:#b83428!important;animation:fgTimerPulse .55s infinite alternate}.fg-crown-choice{min-height:650px;display:grid;justify-items:center;align-content:center;text-align:center;padding:35px;border-radius:28px;background:radial-gradient(circle at 50% 15%,rgba(255,222,112,.3),transparent 32%),linear-gradient(145deg,#123f3a,#1d645a);color:#fff;box-shadow:0 24px 60px rgba(17,63,57,.25)}.fg-crown-choice>i{width:96px;height:96px;display:grid;place-items:center;border-radius:50%;font-size:55px;color:#80520c;background:linear-gradient(145deg,#ffeb8b,#e4a62f);box-shadow:0 0 0 10px rgba(255,220,105,.16),0 15px 30px rgba(0,0,0,.28);animation:fgCrownFloat 1.8s ease-in-out infinite}.fg-crown-choice>span{margin-top:25px;color:#f7ce65;font-size:10px;font-weight:1000;letter-spacing:.18em}.fg-crown-choice h2{margin:7px 0 5px;color:#fff;font-size:clamp(27px,5vw,42px)}.fg-crown-choice>p{margin:0 0 25px;color:rgba(255,255,255,.72)}.fg-crown-choice>div{width:min(720px,100%);display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.fg-crown-choice button{min-height:126px;display:grid;justify-items:center;align-content:center;gap:5px;border:3px solid rgba(255,255,255,.5);border-radius:20px;background:linear-gradient(145deg,color-mix(in srgb,var(--cat) 85%,#fff),var(--cat));color:#fff;box-shadow:0 7px 0 color-mix(in srgb,var(--cat) 60%,#222);cursor:pointer;transition:.2s}.fg-crown-choice button:hover:not(:disabled){transform:translateY(-4px)}.fg-crown-choice button:disabled{filter:grayscale(.65);opacity:.45;cursor:not-allowed}.fg-crown-choice button>i{font-size:30px}.fg-crown-choice button>b{font-size:12px}.fg-crown-choice button>small{font-size:8px;text-transform:uppercase;letter-spacing:.1em}@keyframes fgTimerPulse{to{transform:scale(1.08)}}@keyframes fgCrownFloat{50%{transform:translateY(-10px) rotate(4deg)}}@media(max-width:600px){.fg-crown-meter{grid-template-columns:1fr auto;gap:7px}.fg-crown-meter>div{grid-column:1/-1;grid-row:2}.fg-crown-choice{min-height:calc(100dvh - 100px);padding:28px 12px}.fg-crown-choice>i{width:76px;height:76px;font-size:42px}.fg-crown-choice>div{grid-template-columns:1fr 1fr;gap:9px}.fg-crown-choice button{min-height:102px}.fg-question-timer{font-size:12px!important}}@media(prefers-reduced-motion:reduce){.fg-crown-choice>i,.fg-question-timer.urgent{animation:none!important}}';
  gameStyles += classicRulesStyles;
  gameStyles += '.fg-wheel{background:conic-gradient(from -20deg,#43a568 0 40deg,#3689cc 40deg 80deg,#ef8744 80deg 120deg,#8a58bd 120deg 160deg,#d74c72 160deg 200deg,#338f75 200deg 240deg,#5869b2 240deg 280deg,#df7b32 280deg 320deg,#e6a934 320deg 360deg)!important}.fg-wheel>span{transform:rotate(calc(var(--i)*40deg))!important}.fg-crown-choice>div{grid-template-columns:repeat(4,1fr)!important}.fg-seal-board{grid-template-columns:repeat(4,1fr)!important}@media(max-width:700px){.fg-crown-choice>div{grid-template-columns:1fr 1fr!important}.fg-seal-board{grid-template-columns:repeat(2,1fr)!important}}';

  var resultStyles='.fg-result-screen{--gold:#ffd35f;position:relative;min-height:calc(100vh - 125px);overflow:hidden;display:grid;place-items:center;padding:30px;border-radius:28px;font-family:Inter,system-ui,sans-serif;isolation:isolate}.fg-result-screen.winner{background:radial-gradient(circle at 50% 32%,rgba(255,226,112,.55),transparent 29%),linear-gradient(145deg,#0a5148,#178375 55%,#073b37)}.fg-result-screen.loser{background:radial-gradient(circle at 50% 20%,rgba(128,161,193,.24),transparent 32%),linear-gradient(155deg,#24384e,#17273a 58%,#101d2c)}.fg-result-glow{position:absolute;width:min(76vw,850px);height:min(76vw,850px);border-radius:50%;z-index:-1}.winner .fg-result-glow{background:radial-gradient(circle,rgba(255,218,95,.24),transparent 68%);animation:fgResultGlow 2s ease-in-out infinite}.loser .fg-result-glow{background:radial-gradient(circle,rgba(112,151,185,.18),transparent 68%)}.fg-result-card{position:relative;z-index:4;width:min(920px,94%);display:grid;grid-template-columns:minmax(250px,42%) 1fr;align-items:center;gap:22px;padding:34px;border:1px solid rgba(255,255,255,.28);border-radius:34px;background:rgba(255,255,255,.94);box-shadow:0 28px 80px rgba(1,27,24,.36);backdrop-filter:blur(16px);animation:fgResultCard .8s cubic-bezier(.18,.85,.25,1.15) both}.fg-result-kicker{position:absolute;left:50%;top:20px;transform:translateX(-50%);color:#1c665b;font-size:11px;font-weight:900;letter-spacing:.16em;white-space:nowrap}.loser .fg-result-kicker{color:#506980}.fg-result-mascot{height:390px;display:grid;place-items:end center;position:relative}.fg-result-mascot:after{content:"";position:absolute;bottom:4px;width:70%;height:22px;background:rgba(5,44,40,.16);filter:blur(12px);border-radius:50%;z-index:-1}.fg-result-mascot img{display:block;max-width:100%;width:340px;height:370px;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 18px 14px rgba(9,50,45,.25))}.winner .fg-result-mascot img{animation:fgWinnerMascot 1.25s ease-in-out infinite}.loser .fg-result-mascot img{animation:fgLoserMascot 3s ease-in-out infinite}.fg-result-copy{text-align:center;padding-top:20px}.fg-result-copy h1{margin:0;color:#113e39;font-family:Georgia,serif;font-size:clamp(34px,5vw,62px);line-height:.95}.loser .fg-result-copy h1{color:#2c4257}.fg-result-copy>p{max-width:510px;margin:17px auto 20px;color:#59716e;font-size:16px;line-height:1.55}.fg-result-score{display:flex;align-items:center;justify-content:center;gap:22px;margin:20px auto;padding:15px;border-radius:21px;background:#edf7f4}.loser .fg-result-score{background:#edf1f5}.fg-result-score div{display:grid;grid-template-columns:auto auto;align-items:end;column-gap:5px}.fg-result-score small{grid-column:1/-1;font-size:9px;font-weight:900;letter-spacing:.15em;color:#6a7f7d}.fg-result-score b{font-size:32px;color:#124e46;line-height:1}.loser .fg-result-score b{color:#354c62}.fg-result-score span{font-size:11px;color:#738582}.fg-result-score strong{font-size:24px;color:#d5ab45}.fg-result-actions{display:grid;gap:10px}.fg-result-actions button{min-height:49px;border-radius:15px;font-weight:850;font-size:14px;cursor:pointer;transition:.2s}.fg-result-primary{border:0;background:linear-gradient(135deg,#f3c95e,#e7aa3f);color:#183e39;box-shadow:0 8px 0 #b87925}.loser .fg-result-primary{background:linear-gradient(135deg,#7fb3c8,#5f8fa9);color:#102b3a;box-shadow:0 8px 0 #416a82}.fg-result-primary:hover{transform:translateY(-2px)}.fg-result-secondary{border:1px solid #cbdcd8;background:#fff;color:#355c57}.fg-result-confetti{position:absolute;z-index:3;left:var(--x);top:-30px;width:9px;height:18px;border-radius:3px;background:var(--c);animation:fgResultConfetti 4.4s var(--d) linear infinite}.fg-firework{position:absolute;z-index:2;left:var(--fx);top:var(--fy);width:4px;height:4px;animation:fgFireworkPulse 2.3s var(--fd) ease-out infinite}.fg-firework i{position:absolute;width:5px;height:28px;border-radius:6px;background:linear-gradient(var(--c),transparent);transform-origin:center bottom;transform:rotate(var(--a)) translateY(-38px);animation:fgSpark 2.3s var(--fd) ease-out infinite}@keyframes fgResultCard{from{opacity:0;transform:translateY(45px) scale(.9)}to{opacity:1;transform:none}}@keyframes fgResultGlow{50%{transform:scale(1.12);opacity:.65}}@keyframes fgWinnerMascot{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-15px) rotate(2deg)}}@keyframes fgLoserMascot{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(5px) rotate(-1deg)}}@keyframes fgResultConfetti{0%{transform:translateY(-30px) rotate(0);opacity:1}90%{opacity:1}100%{transform:translateY(110vh) rotate(var(--r));opacity:0}}@keyframes fgFireworkPulse{0%,18%,100%{opacity:0;transform:scale(.2)}25%{opacity:1;transform:scale(1)}55%{opacity:0;transform:scale(1.45)}}@keyframes fgSpark{0%,18%,100%{opacity:0}25%{opacity:1}55%{opacity:0;transform:rotate(var(--a)) translateY(-70px) scaleY(.3)}}@media(max-width:720px){.fg-result-screen{min-height:calc(100vh - 100px);padding:14px;border-radius:18px}.fg-result-card{grid-template-columns:1fr;gap:0;padding:48px 20px 24px;border-radius:25px}.fg-result-mascot{height:250px}.fg-result-mascot img{width:230px;height:245px}.fg-result-copy{padding-top:5px}.fg-result-copy h1{font-size:38px}.fg-result-copy>p{font-size:13px;margin:10px auto 14px}.fg-result-score{margin:13px auto;gap:16px;padding:11px}.fg-result-score b{font-size:26px}.fg-result-actions button{min-height:45px}.fg-result-kicker{top:16px;font-size:8px}}@media(max-width:380px){.fg-result-mascot{height:205px}.fg-result-mascot img{width:190px;height:200px}.fg-result-copy h1{font-size:32px}.fg-result-card{padding-left:14px;padding-right:14px}.fg-result-score{gap:10px}}@media(prefers-reduced-motion:reduce){.fg-result-screen *{animation:none!important}.fg-result-confetti,.fg-firework{display:none}}';

  window.AvaliaClinViews = window.AvaliaClinViews || {};
  window.FisioGameOnline = { start:start, stop:stop, render:renderView, setAudioActive:setAudioActive, renderAdminDashboard:renderAdminDashboard, refresh:function(){return Promise.all([loadPresence(),loadInvites()]);} };
  window.addEventListener('beforeunload', function () { if (running) heartbeat(true); });
})();
