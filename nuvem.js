/* Ligação do site com o Supabase. A chave publicável pode ficar aqui: quem protege os dados são as regras do banco. */
var NUVEM={url:'https://etfhrckvunyiqchovwya.supabase.co',chave:'sb_publishable_GQdp1ueAwBBryC9dnvpXHQ_ZnUQEEL8',sessao:'imobiliaria-sessao'};

function nuvemErro(r,msg){var e=new Error(msg||'falhou');e.status=r&&r.status;e.sessao=!!r&&r.status===401;return e}
function nuvemSessao(){try{return JSON.parse(sessionStorage.getItem(NUVEM.sessao))}catch(e){return null}}
function nuvemGuarda(s){try{if(s)sessionStorage.setItem(NUVEM.sessao,JSON.stringify(s));else sessionStorage.removeItem(NUVEM.sessao)}catch(e){}}
function nuvemConta(campos,tipo){
  return fetch(NUVEM.url+'/auth/v1/token?grant_type='+tipo,{method:'POST',headers:{apikey:NUVEM.chave,'Content-Type':'application/json'},body:JSON.stringify(campos)}).then(function(r){
    if(!r.ok)throw nuvemErro(r);
    return r.json()}).then(function(d){
    var s={acesso:d.access_token,renova:d.refresh_token,vence:Date.now()+d.expires_in*1000};nuvemGuarda(s);return s})}
function nuvemEntrar(email,senha){return nuvemConta({email:email,password:senha},'password')}
function nuvemSair(){var s=nuvemSessao();nuvemGuarda(null);
  if(!s)return Promise.resolve();
  return fetch(NUVEM.url+'/auth/v1/logout',{method:'POST',headers:{apikey:NUVEM.chave,Authorization:'Bearer '+s.acesso}}).catch(function(){})}
/* O acesso dura pouco tempo; aqui ele é renovado antes de vencer. */
function nuvemToken(){var s=nuvemSessao();
  if(!s)return Promise.reject(nuvemErro({status:401}));
  if(s.vence>Date.now()+60000)return Promise.resolve(s.acesso);
  return nuvemConta({refresh_token:s.renova},'refresh_token').then(function(n){return n.acesso}).catch(function(e){
    if(e.status>=400&&e.status<500){nuvemGuarda(null);throw nuvemErro({status:401})}
    throw e})}
function nuvemPede(caminho,op){op=op||{};
  return nuvemToken().then(function(t){
    op.headers=Object.assign({apikey:NUVEM.chave,Authorization:'Bearer '+t},op.headers);
    return fetch(NUVEM.url+caminho,op)}).then(function(r){
    if(!r.ok)throw nuvemErro(r);return r})}

/* Imóveis: todo mundo lê; só o desenvolvedor grava. */
function nuvemImoveis(){
  return fetch(NUVEM.url+'/rest/v1/imoveis?select=id,dados',{headers:{apikey:NUVEM.chave}}).then(function(r){
    if(!r.ok)throw nuvemErro(r);
    return r.json()}).then(function(l){
    return l.map(function(x){return Object.assign({cod:'',tipo:'Casa',perto:'',cep:'',num:'',q:'',b:'',v:'',m:'',desc:'',fotos:[]},x.dados,{id:x.id})})})}
/* Pede a linha de volta: sem permissão o banco pode responder sem erro, mas sem alterar nada. */
function nuvemConfere(r){return r.json().then(function(l){if(!l.length)throw nuvemErro({status:403});return l})}
function nuvemGrava(id,dados){
  return nuvemPede('/rest/v1/imoveis',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([{id:id,dados:dados}])}).then(nuvemConfere)}
function nuvemExclui(id){
  return nuvemPede('/rest/v1/imoveis?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=representation'}}).then(nuvemConfere)}

/* Fotos ficam no armazenamento do Supabase; o imóvel guarda só o endereço delas. */
var FOTOS='/storage/v1/object/';
function nuvemFoto(dataUrl,nome){
  return fetch(dataUrl).then(function(r){return r.blob()}).then(function(b){
    return nuvemPede(FOTOS+'fotos/'+nome,{method:'POST',headers:{'Content-Type':'image/jpeg','Cache-Control':'31536000'},body:b})}).then(function(){
    return NUVEM.url+FOTOS+'public/fotos/'+nome})}
function nuvemApagaFotos(urls){
  var nomes=urls.map(function(u){return u.split('/fotos/')[1]}).filter(Boolean);
  if(!nomes.length)return Promise.resolve();
  return nuvemPede(FOTOS+'fotos',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:nomes})}).catch(function(){})}
