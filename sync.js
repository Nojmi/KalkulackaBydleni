/* Synchronizace dat mezi počítači přes Firebase (Firestore + přihlášení Googlem).
   Místní data v prohlížeči (localStorage) zůstávají hlavní kopií; cloud je jen zrcadlo.
   Nic se nepřepíše bez zálohy: před každým přepsáním se druhá strana uloží do klíče bydleni-backup-*. */
(function(){
'use strict';
var CFG={apiKey:'AIzaSyBNyJUUAfssWX5MbwbVA0xhemYwQD-ruCM',authDomain:'kalkulacka-bydleni.firebaseapp.com',projectId:'kalkulacka-bydleni',storageBucket:'kalkulacka-bydleni.firebasestorage.app',messagingSenderId:'329449036310',appId:'1:329449036310:web:f12048f621cf252f843337'};
var KEYS=['bydleni-spolecne-v1','bydleni-uspory-v1','bydleni-kalkulacka-v4'];
var META='bydleni-sync-meta',DOC=['bydleni','data'];
var SDK='https://www.gstatic.com/firebasejs/10.12.2/';
var db=null,auth=null,user=null,applying=false,timer=null,busy=false;

function ls(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
function getMeta(){try{return JSON.parse(ls(META))||{};}catch(e){return {};}}
function setMeta(m){lsSet(META,JSON.stringify(m));}
function snapshot(){var o={};KEYS.forEach(function(k){o[k]=ls(k);});return o;}
function hasData(o){return KEYS.some(function(k){return o[k];});}
function same(a,b){return KEYS.every(function(k){return (a[k]||null)===(b[k]||null);});}
function backup(tag,o){
  try{
    lsSet('bydleni-backup-'+tag+'-'+Date.now(),JSON.stringify(o));
    var ks=[],i;for(i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('bydleni-backup-')===0)ks.push(k);}
    ks.sort();while(ks.length>6)localStorage.removeItem(ks.shift());
  }catch(e){}
}

/* ---------- stavový panel ---------- */
var chip,pop;
function css(){
  var s=document.createElement('style');
  s.textContent='#syncChip{position:fixed;right:12px;bottom:12px;z-index:50;font:12px/1.3 system-ui,sans-serif;background:var(--surface,#fff);color:var(--ink,#222);border:1px solid var(--line,#bbb);border-radius:999px;padding:6px 12px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.15)}'+
  '#syncChip.err{border-color:#c33;color:#c33}#syncChip.ok{border-color:var(--acc,#2a8)}#syncChip{font-weight:600;border-color:var(--acc,#2a8)}'+
  '#syncPop{position:fixed;right:12px;bottom:50px;z-index:50;font:13px/1.4 system-ui,sans-serif;background:var(--surface,#fff);color:var(--ink,#222);border:1px solid var(--line,#bbb);border-radius:10px;padding:10px 12px;box-shadow:0 4px 16px rgba(0,0,0,.2);display:none;max-width:280px}'+
  '#syncPop button{display:block;width:100%;margin-top:6px;padding:6px 8px;border:1px solid var(--line,#bbb);border-radius:6px;background:transparent;color:inherit;cursor:pointer;font:inherit}';
  document.head.appendChild(s);
  chip=document.createElement('div');chip.id='syncChip';chip.textContent='☁ Sync: načítám…';
  pop=document.createElement('div');pop.id='syncPop';
  document.body.appendChild(pop);document.body.appendChild(chip);
  chip.onclick=function(){pop.style.display=pop.style.display==='block'?'none':'block';drawPop();};
}
function status(t,cls){if(!chip)return;chip.textContent='☁ '+t;chip.className=cls||'';}
function drawPop(){
  var h='';
  if(!user){h+='<div>Data jsou jen v tomto prohlížeči. Po přihlášení se budou ukládat i do cloudu a uvidíš je na každém počítači.</div><button id="syIn">Přihlásit se Googlem</button>';}
  else{h+='<div>Přihlášen: '+(user.email||'')+'</div><button id="syNow">Synchronizovat teď</button><button id="syOut">Odhlásit</button>';}
  h+='<button id="syExp">Stáhnout zálohu (JSON)</button><button id="syImp">Nahrát zálohu ze souboru</button>';
  pop.innerHTML=h;
  var q=function(i){return document.getElementById(i);};
  if(q('syIn'))q('syIn').onclick=signIn;
  if(q('syNow'))q('syNow').onclick=function(){reconcile(true);};
  if(q('syOut'))q('syOut').onclick=function(){auth.signOut();};
  q('syExp').onclick=exportFile;
  q('syImp').onclick=importFile;
}
function exportFile(){
  var b=new Blob([JSON.stringify({exported:new Date().toISOString(),data:snapshot()},null,1)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='bydleni-zaloha-'+new Date().toISOString().slice(0,10)+'.json';a.click();
}
function importFile(){
  var i=document.createElement('input');i.type='file';i.accept='.json,application/json';
  i.onchange=function(){
    var f=i.files[0];if(!f)return;var r=new FileReader();
    r.onload=function(){
      try{
        var o=JSON.parse(r.result);o=o.data||o;
        if(!confirm('Nahradit data v tomto prohlížeči daty ze souboru? Současná se předtím zazálohují.'))return;
        backup('pred-importem',snapshot());applying=true;
        KEYS.forEach(function(k){if(typeof o[k]==='string')lsSet(k,o[k]);});
        applying=false;var m=getMeta();m.dirty=true;setMeta(m);location.reload();
      }catch(e){alert('Soubor se nepodařilo přečíst.');}
    };
    r.readAsText(f);
  };
  i.click();
}

/* ---------- cloud ---------- */
function withTimeout(p,ms){return new Promise(function(res,rej){var t=setTimeout(function(){rej(new Error('Cloud neodpovídá (časový limit). Zkontroluj internet, blokátor reklam nebo firemní síť.'));},ms);p.then(function(v){clearTimeout(t);res(v);},function(e){clearTimeout(t);rej(e);});});}
function ref(){return db.collection(DOC[0]).doc(DOC[1]);}
function fmt(ms){try{return new Date(ms).toLocaleString('cs-CZ');}catch(e){return '';}}
function push(){
  var snap=snapshot(),rev=Date.now();
  return withTimeout(ref().set({data:snap,rev:rev,by:(navigator.userAgent||'').slice(0,80)}),15000).then(function(){
    setMeta({rev:rev,dirty:false});status('uloženo '+new Date().toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'}),'ok');
  });
}
function pull(remote){
  backup('pred-nactenim',snapshot());applying=true;
  KEYS.forEach(function(k){var v=remote.data&&remote.data[k];if(typeof v==='string')lsSet(k,v);});
  applying=false;setMeta({rev:remote.rev,dirty:false});status('načítám data z cloudu…','ok');location.reload();
}
function reconcile(manual){
  if(!user||busy)return Promise.resolve();
  busy=true;status('synchronizuji…');
  return withTimeout(ref().get({source:'server'}),15000).then(function(d){
    var meta=getMeta(),local=snapshot();
    if(!d.exists){return hasData(local)?push():(status('připojeno, cloud je prázdný','ok'));}
    var remote=d.data();
    if(same(local,remote.data||{})){setMeta({rev:remote.rev,dirty:false});status('synchronizováno','ok');return;}
    if(meta.rev===remote.rev){return push();} /* cloud beze změny od poslední synchronizace, ale místní data se liší = místní změna (např. přidaný profil přes odkaz) */
    /* cloud se změnil od posledního setkání */
    if(!hasData(local)||(meta.rev&&!meta.dirty))return pull(remote);
    var useCloud=confirm('V cloudu jsou jiná data (uložena '+fmt(remote.rev)+') než v tomto prohlížeči.\n\nOK = použít data z cloudu (tato místní se zazálohují v prohlížeči)\nZrušit = ponechat místní a přepsat jimi cloud (cloudová se zazálohují v prohlížeči)');
    if(useCloud)return pull(remote);
    backup('cloud',remote.data||{});return push();
  }).catch(function(e){
    status('chyba: '+((e&&e.code)||'sync'),'err');console.error('sync',e);
    if(manual||true)alert('Synchronizace selhala: '+(e&&e.message||e));
  }).then(function(){busy=false;});
}
function schedule(){
  var m=getMeta();m.dirty=true;setMeta(m);
  if(!user){return;}
  status('změny čekají…');clearTimeout(timer);
  timer=setTimeout(function(){reconcile(false);},1500);
}
function hook(){
  var orig=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){
    var r=orig.apply(this,arguments);
    if(!applying&&this===window.localStorage&&KEYS.indexOf(k)>=0)schedule();
    return r;
  };
}
function signIn(){
  var p=new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(p).catch(function(e){status('přihlášení selhalo','err');alert('Přihlášení selhalo: '+(e&&e.message||e));});
}
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);});}

function init(){
  css();hook();
  loadScript(SDK+'firebase-app-compat.js')
   .then(function(){return loadScript(SDK+'firebase-auth-compat.js');})
   .then(function(){return loadScript(SDK+'firebase-firestore-compat.js');})
   .then(function(){
     firebase.initializeApp(CFG);auth=firebase.auth();db=firebase.firestore();try{db.settings({experimentalAutoDetectLongPolling:true,merge:true});}catch(e){}
     auth.onAuthStateChanged(function(u){
       user=u;
       if(u){reconcile(false);}else{status('nepřihlášeno – klikni','');}
       drawPop();
     });
     document.addEventListener('visibilitychange',function(){if(!document.hidden&&user&&!getMeta().dirty)reconcile(false);});
   }).catch(function(e){status('offline – data jen lokálně','err');console.error(e);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
