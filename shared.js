/* Společné úložiště a profily pro všechny stránky kalkulačky (základní, komplexní).
   Data jsou jen v prohlížeči (localStorage). Profil = jedna nemovitost ke koupi. */
(function(w){
'use strict';
var KEY='bydleni-spolecne-v1',OLD1='kalkulacka-profily-v1',OLD0='kalkulacka-vetsiho-bytu-v1';

/* pole profilu nemovitosti: [id, popis, jednotka, desetinná místa] */
var PF=[
 ['price','Kupní cena','Kč'],
 ['reno','Rekonstrukce a vybavení celkem (z úspor, nezvyšuje úvěr)','Kč'],
 ['newServ','Zálohy, energie a pojištění bytu','Kč/měs'],
 ['usedA','Vlastní peníze do koupě, když starý byt prodáte','Kč'],
 ['usedB','Vlastní peníze do koupě, když starý byt necháte','Kč'],
 ['rateA','Úrok, když starý byt prodáte','% p. a.',2],
 ['rateB','Úrok, když starý byt necháte','% p. a.',2],
 ['term','Splatnost','let'],
 ['insA','Pojištění hypotéky, když starý byt prodáte','Kč/měs'],
 ['insB','Pojištění hypotéky, když starý byt necháte','Kč/měs']
];
/* rozpis rekonstrukce: součet jde do pole reno a platí se z úspor, ne z úvěru */
var RENO=[
 ['r1','Kuchyň (linka, spotřebiče)'],
 ['r2','Koupelna a WC'],
 ['r3','Podlahy a obklady'],
 ['r4','Malování, omítky a štuky'],
 ['r5','Elektroinstalace a osvětlení'],
 ['r6','Rozvody vody a topení'],
 ['r7','Okna, dveře a stínění'],
 ['r8','Vestavěné skříně a nábytek'],
 ['r9','Terasa a balkon (hydroizolace, dlažba, pergola)'],
 ['r10','Stěhování, právník a ostatní']
];
var RIDS=RENO.map(function(f){return f[0];});
/* společné údaje: [id, popis, jednotka, výchozí, desetinná místa] */
var BG=[
 {t:'Domácnost',f:[
  ['income','Čistý příjem domácnosti za měsíc (průměr)','Kč/měs',180000]
 ]},
 {t:'Starý byt dnes',f:[
  ['oldBal','Zbývá doplatit hypotéku dnes','Kč',3000000],
  ['oldRate','Úrok staré hypotéky dnes','% p. a.',1.9,2],
  ['oldYears','Zbývající splatnost staré hypotéky dnes','let',24],
  ['oldIns','Pojištění hypotéky dnes','Kč/měs',1100],
  ['oldServ','Zálohy, energie a garáž dnes, když v něm bydlíte','Kč/měs',13000]
 ]},
 {t:'Starý byt po refixaci',f:[
  ['monthsFix','Za kolik měsíců končí fixace','měsíců',12],
  ['rateAfter','Úrok staré hypotéky po refixaci (odhad)','% p. a.',4.79,2],
  ['oldInsAfter','Pojištění hypotéky po refixaci','Kč/měs',1100],
  ['oldServAfter','Zálohy, energie a garáž po refixaci, když v něm bydlíte','Kč/měs',13000],
  ['oldValue','Cena, za kterou ho prodáte','Kč',8200000],
  ['sellCost','Náklady prodeje (provize, právník)','Kč',0]
 ]},
 {t:'Úspory',f:[
  ['savings','Úspory a investice celkem','Kč',2000000]
 ]},
 {t:'Pronájem starého bytu',f:[
  ['rent','Nájem za měsíc','Kč/měs',28000],
  ['occ','Kolik měsíců v roce je byt pronajatý','z 12',12],
  ['svjTotal','Předpis záloh SVJ za byt celkem','Kč/měs',7292],
  ['owner','z toho platí vlastník (fond oprav, správa, pojištění domu)','Kč/měs',3984],
  ['repairs','Opravy a drobné náklady','Kč/měs',1000],
  ['tax','Daň z nájmu (odhad)','Kč/měs',3452]
 ]}
];
/* měsíční výdaje domácnosti mimo bydlení (výchozí rozdělení je jen odhad, přepiš podle účtu) */
var EXP=[
 ['food','Jídlo a drogerie',12000],
 ['fuel','Benzín',3500],
 ['carRun','Auto: parkování, mytí, drobnosti',1000],
 ['tele','Telefony a internet',1800],
 ['subs','Streaming a předplatné',700],
 ['child','Dítě (školka, kroužky, oblečení, hračky)',5000],
 ['cloth','Oblečení a obuv',2500],
 ['health','Zdraví (léky, lékař, zubař)',1000],
 ['eat','Restaurace a kavárny',3500],
 ['leisure','Volný čas a sport',2500],
 ['gifts','Dárky a oslavy',1000],
 ['pet','Domácí zvíře (krmivo, veterinář)',1000],
 ['misc','Ostatní a drobnosti',4500]
];
/* roční výdaje, jednou nebo dvakrát za rok (výchozí částky jsou jen odhad) */
var ANN=[
 ['carIns','Pojištění auta (povinné a havarijní)',14000],
 ['stk','STK a emise',1500],
 ['carServ','Pravidelný servis auta',12000],
 ['tires','Pneumatiky a přezutí',8000],
 ['vignette','Dálniční známka',2500],
 ['homeIns','Pojištění domácnosti a nemovitosti',5000],
 ['propTax','Daň z nemovitosti',2000],
 ['xmas','Vánoce (dárky, jídlo)',25000],
 ['summer','Dovolená léto',90000],
 ['winter','Dovolená zima',40000],
 ['trips','Víkendy a výlety',20000],
 ['dentist','Zubař a preventivní prohlídky',6000],
 ['school','Škola a školka: zápisné, tábory, pomůcky',10000],
 ['appl','Rezerva na spotřebiče a elektroniku (lednička, TV)',15000]
];

var BDEF={},BIDS=[],PIDS=PF.map(function(f){return f[0];}).concat(RIDS),EDEF={},ADEF={};
BG.forEach(function(g){g.f.forEach(function(f){BDEF[f[0]]=f[3];BIDS.push(f[0]);});});
EXP.forEach(function(e){EDEF[e[0]]=e[2];});
ANN.forEach(function(e){ADEF[e[0]]=e[2];});
function clone(o){return JSON.parse(JSON.stringify(o));}
function seed(){return [
 {id:1,name:'Silurská 4+kk, 94 m²',note:'Ukázka',v:{price:13998700,reno:350000,newServ:17000,usedA:1000000,usedB:1000000,rateA:5,rateB:5.29,term:30,insA:5000,insB:6500}},
 {id:2,name:'Sazovická, Zličín 4+kk, 116 m²',note:'Terasa, 2 garážová stání. Zálohy a pojištění jsou odhad.',v:{price:17950000,reno:350000,newServ:11650,usedA:1000000,usedB:1000000,rateA:4.79,rateB:4.79,term:30,insA:6900,insB:9976}},
 {id:3,name:'Kutrovická, Řepy 4+kk, 141 m²',note:'3. NP z 4, rok 2015, 2 garážová stání a sklep v ceně, cena vč. provize a právního servisu. Pojištění podle kalkulačky Moneta (6 336 Kč při hypotéce 11 mil.), zálohy jsou odhad.',v:{price:16950000,reno:350000,newServ:15000,usedA:1000000,usedB:1000000,rateA:4.79,rateB:4.79,term:30,insA:6336,insB:9386}},
 {id:4,name:'Přeučilova, Stodůlky 4+kk, 86 m²',note:'Poslední patro, výtah, terasa 99 m² + balkon 10 m², 2 parkovací stání a sklep 5 m². Měsíční náklady 4 933 Kč (z toho fond oprav 1 561 Kč). Cena klesla z 16 990 000 Kč. Pojištění hypotéky je odhad podle Moneta (úměrně výši úvěru).',v:{price:15950000,reno:350000,newServ:4933,usedA:1000000,usedB:1000000,rateA:4.79,rateB:4.79,term:30,insA:5800,insB:8800}}
];}

var st={base:clone(BDEF),exp:clone(EDEF),ann:clone(ADEF),profiles:seed(),sel:1,nextId:5};
function isNum(x){return typeof x==='number'&&isFinite(x);}
function renoTotal(v){var t=0;RIDS.forEach(function(k){if(isNum(v[k]))t+=v[k];});return t;}
function fixReno(p){var v=p.v,any=RIDS.some(function(k){return isNum(v[k])&&v[k]>0;});
  if(!any&&isNum(v.reno)&&v.reno>0)v.r10=v.reno;
  RIDS.forEach(function(k){if(!isNum(v[k]))v[k]=0;});v.reno=renoTotal(v);}
function fixAll(){st.profiles.forEach(fixReno);}
function sum(o){var t=0;for(var k in o)if(isNum(o[k]))t+=o[k];return t;}
function scaleExp(total){
  var f=total/sum(EDEF),t=0;
  EXP.forEach(function(e){st.exp[e[0]]=Math.round(EDEF[e[0]]*f/100)*100;});
  st.exp.misc=Math.max(0,st.exp.misc+(total-sum(st.exp)));
}
/* přijme objekt ve starém i novém formátu; vrací počet převzatých hodnot */
function adopt(o){
  if(!o||typeof o!=='object')return 0;
  var n=0,b=o.base||(isNum(o.income)?o:null);
  if(b){BIDS.forEach(function(k){if(isNum(b[k])){st.base[k]=b[k];n++;}});}
  var hadExp=false;
  if(o.exp){EXP.forEach(function(e){if(isNum(o.exp[e[0]])){st.exp[e[0]]=o.exp[e[0]];hadExp=true;n++;}});}
  if(!hadExp&&b&&isNum(b.other)&&b.other!==sum(EDEF))scaleExp(b.other);
  if(o.ann){ANN.forEach(function(e){if(isNum(o.ann[e[0]])){st.ann[e[0]]=o.ann[e[0]];n++;}});}
  if(Array.isArray(o.profiles)&&o.profiles.length){
    var list=[];
    o.profiles.slice(0,30).forEach(function(p,i){
      if(!p||typeof p!=='object')return;
      var v={};PIDS.forEach(function(k){v[k]=p.v&&isNum(p.v[k])?p.v[k]:0;});
      list.push({id:isNum(p.id)?p.id:i+1,name:String(p.name||'Profil').slice(0,60),note:String(p.note||'').slice(0,300),v:v});
    });
    if(list.length){
      st.profiles=list;st.nextId=Math.max.apply(null,list.map(function(p){return p.id;}))+1;
      st.sel=isNum(o.sel)&&list.some(function(p){return p.id===o.sel;})?o.sel:list[0].id;n+=list.length;
    }
  }
  return n;
}
function load(){
  var done=false;
  try{var r=localStorage.getItem(KEY);if(r){adopt(JSON.parse(r));done=true;}}catch(e){}
  if(!done){
    try{var r1=localStorage.getItem(OLD1);if(r1){adopt(JSON.parse(r1));done=true;}}catch(e){}
  }
  if(!done){
    try{var r0=localStorage.getItem(OLD0);if(r0)adopt(JSON.parse(r0));}catch(e){}
  }
  /* odkazy: #d=... vše, #p=... přidá jeden profil */
  try{
    var m=/^#([dp])=(.+)$/.exec(location.hash);
    if(m){
      var o=JSON.parse(decodeURIComponent(escape(atob(m[2]))));
      if(m[1]==='d')adopt(o);
      else{
        var v={};PIDS.forEach(function(k){v[k]=isNum(o.v&&o.v[k])?o.v[k]:0;});
        st.profiles.push({id:st.nextId,name:String(o.name||'Profil').slice(0,60),note:String(o.note||'').slice(0,300),v:v});st.sel=st.nextId++;
      }
      save();history.replaceState(null,'',location.pathname+location.search);
    }
  }catch(e){}
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){}}
function cur(){for(var i=0;i<st.profiles.length;i++)if(st.profiles[i].id===st.sel)return st.profiles[i];return st.profiles[0];}
function expTotal(){return sum(st.exp);}
function annTotal(){return sum(st.ann);}

/* formátování */
var nf=new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:0});
function kc(v){return (v<0?'−':'')+nf.format(Math.abs(Math.round(v))).replace(/[  ]/g,' ')+' Kč';}
function fmtIn(v,d){return new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:d||0,minimumFractionDigits:0}).format(v).replace(/ /g,' ');}
function parse(t){t=String(t).replace(/[\s  ]/g,'').replace(',','.').replace(/[^0-9.\-]/g,'');var n=parseFloat(t);return isFinite(n)?n:0;}
function sgn(v){return v<0?'neg':'pos';}
function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function pmt(P,rate,years){
  var n=Math.round(years*12);if(P<=0||n<=0)return 0;
  var r=rate/1200;if(r===0)return P/n;
  return P*r/(1-Math.pow(1+r,-n));
}

/* výpočet jedné nemovitosti (profilu) */
function calc(p){
  var s={},k;for(k in st.base)s[k]=st.base[k];for(k in p.v)s[k]=p.v[k];
  s.other=expTotal();
  var ann=annTotal();
  var payNow=pmt(s.oldBal,s.oldRate,s.oldYears);
  var m=Math.max(0,Math.min(s.monthsFix,s.oldYears*12)),rr=s.oldRate/1200;
  var balFix=rr===0?s.oldBal-payNow*m:s.oldBal*Math.pow(1+rr,m)-payNow*(Math.pow(1+rr,m)-1)/rr;
  balFix=Math.max(0,balFix);
  var oldPay=pmt(balFix,s.rateAfter,s.oldYears-m/12);
  var cash=s.oldValue-s.sellCost-balFix;
  var need=s.price;                         /* rekonstrukce se platí z úspor, ne z úvěru */
  var loanA=Math.max(0,need-cash-s.usedA);
  var loanB=Math.max(0,need-s.usedB);
  var payA=pmt(loanA,s.rateA,s.term),payB=pmt(loanB,s.rateB,s.term);
  var rentNet=s.rent*s.occ/12-s.owner-s.repairs-s.tax;
  var A={loan:loanA,pay:payA,ins:s.insA,serv:s.newServ,oldPay:0,oldIns:0,oldServ:0,rent:0};
  var B={loan:loanB,pay:payB,ins:s.insB,serv:s.newServ,oldPay:oldPay,oldIns:s.oldInsAfter,oldServ:0,rent:rentNet};
  var C={loan:0,pay:0,ins:0,serv:0,oldPay:oldPay,oldIns:s.oldInsAfter,oldServ:s.oldServAfter,rent:0};
  A.debt=loanA;B.debt=loanB+balFix;C.debt=balFix;
  var D={loan:0,pay:0,ins:0,serv:0,oldPay:payNow,oldIns:s.oldIns,oldServ:s.oldServ,rent:0,debt:s.oldBal};
  A.cash=cash;
  A.savLeft=s.savings-s.usedA-s.reno;B.savLeft=s.savings-s.usedB-s.reno;C.savLeft=s.savings;D.savLeft=s.savings;
  [A,B,C,D].forEach(function(x){
    x.housing=x.pay+x.ins+x.serv+x.oldPay+x.oldIns+x.oldServ-x.rent;
    x.left=s.income-s.other-x.housing;       /* zbývá měsíčně před ročními výdaji */
    x.yearLeft=x.left*12-ann;                 /* zbývá ročně po všech výdajích */
    x.yearMonthly=x.yearLeft/12;
  });
  return {A:A,B:B,C:C,D:D,s:s,ann:ann,oldPay:oldPay,payNow:payNow,balFix:balFix,cash:cash,rentNet:rentNet};
}

/* uživatelské rozhraní: navigace a čipy profilů */
var CSS='.bnav{display:flex;gap:6px;flex-wrap:wrap}.bnav a{padding:7px 14px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--ink);text-decoration:none;font-weight:500;font-size:14px}.bnav a[aria-current="page"]{background:var(--ink);color:var(--bg);border-color:var(--ink);font-weight:600}'+
 '.bchips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.bchips .lab{color:var(--muted);font-size:13px;margin-right:2px}.bchips button.chip{font:inherit;font-weight:500;font-size:14px;padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}.bchips button.chip[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink);font-weight:600}.bchips button.chip.add{border-style:dashed;color:var(--muted)}';
function injectCss(){if(document.getElementById('bydleni-shared-css'))return;var s=document.createElement('style');s.id='bydleni-shared-css';s.textContent=CSS;document.head.appendChild(s);}
function mountNav(el,active){
  injectCss();
  var pages=[['index.html','Základní kalkulačka','index'],['komplexni.html','Komplexní kalkulačka (BETA)','komplexni']];
  el.className='bnav';
  el.innerHTML=pages.map(function(p){return '<a href="'+p[0]+'"'+(p[2]===active?' aria-current="page"':'')+'>'+p[1]+'</a>';}).join('');
}
var listeners=[];
function onChange(fn){listeners.push(fn);}
function fire(){listeners.forEach(function(f){f();});}
function select(id){st.sel=id;save();fire();}
function addProfile(){
  var c=cur(),v={};PIDS.forEach(function(k){v[k]=0;});
  ['term','usedA','usedB','rateA','rateB'].forEach(function(k){v[k]=c.v[k];});
  var p={id:st.nextId++,name:'Nový profil '+(st.profiles.length+1),note:'',v:v};
  st.profiles.push(p);st.sel=p.id;save();fire();return p;
}
function dupProfile(){
  var c=cur(),v={};PIDS.forEach(function(k){v[k]=c.v[k];});
  var p={id:st.nextId++,name:c.name+' (kopie)',note:c.note,v:v};
  st.profiles.push(p);st.sel=p.id;save();fire();return p;
}
function delProfile(){
  if(st.profiles.length<2)return false;
  var id=cur().id;st.profiles=st.profiles.filter(function(p){return p.id!==id;});st.sel=st.profiles[0].id;save();fire();return true;
}
function mountChips(el,opts){
  opts=opts||{};injectCss();
  function draw(){
    var h='<span class="lab">Nemovitost ke koupi:</span>';
    st.profiles.forEach(function(p){h+='<button type="button" class="chip" data-id="'+p.id+'" aria-pressed="'+(p.id===st.sel)+'">'+esc(p.name||'Bez názvu')+'</button>';});
    if(opts.editable)h+='<button type="button" class="chip add" data-add="1">+ Nový profil</button>';
    el.className='bchips';el.innerHTML=h;
  }
  el.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b)return;
    if(b.dataset.add){addProfile();if(opts.onAdd)opts.onAdd();return;}
    select(+b.dataset.id);
  });
  onChange(draw);draw();
  return draw;
}
function resetAll(){
  st.base=clone(BDEF);st.exp=clone(EDEF);st.ann=clone(ADEF);st.profiles=seed();fixAll();st.sel=1;st.nextId=5;save();fire();
}
function shareUrl(page){
  return location.href.split('#')[0].replace(/[^\/]*$/,'')+(page||'index.html')+'#d='+btoa(unescape(encodeURIComponent(JSON.stringify(st))));
}
w.addEventListener('hashchange',function(){if(/^#[dp]=/.test(location.hash))location.reload();});

load();fixAll();
w.BYD={RENO:RENO,RIDS:RIDS,renoTotal:renoTotal,fixReno:fixReno,st:st,PF:PF,BG:BG,EXP:EXP,ANN:ANN,BDEF:BDEF,PIDS:PIDS,BIDS:BIDS,cur:cur,calc:calc,save:save,expTotal:expTotal,annTotal:annTotal,
  kc:kc,fmtIn:fmtIn,parse:parse,sgn:sgn,esc:esc,pmt:pmt,
  select:select,addProfile:addProfile,dupProfile:dupProfile,delProfile:delProfile,resetAll:resetAll,shareUrl:shareUrl,
  mountNav:mountNav,mountChips:mountChips,onChange:onChange,fire:fire};
})(window);
