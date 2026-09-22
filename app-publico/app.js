"use strict";
const KEY="planoFinanceiro.v3";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const brl=v=>(v<0?"-":"")+"R$ "+Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const num=v=>{v=parseFloat(String(v).replace(",","."));return isFinite(v)?v:0};
const mkey=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
const addM=(k,n)=>{const[y,m]=k.split("-").map(Number);return mkey(new Date(y,m-1+n,1))};
const mdiff=(a,b)=>{const[y1,m1]=a.split("-").map(Number),[y2,m2]=b.split("-").map(Number);return(y2-y1)*12+m2-m1};
const mname=k=>{const[y,m]=k.split("-").map(Number);return new Date(y,m-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"})};
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const uid=()=>Date.now()*1000+Math.floor(Math.random()*1000);
const FUND={free:"💵 Do salário (livre)",food:"🍽️ Cartão alimentação",fuel:"⛽ Cartão combustível"};

function seed(){
 const s=mkey(new Date());
 return{tithePct:10,reservePct:20,reserve:{goal:1000,deps:[]},
  cats:[
   {id:"mercado",name:"Supermercado",icon:"🛒",fund:"food",weight:60},
   {id:"comer",name:"Comer fora / iFood",icon:"🍔",fund:"food",weight:40},
   {id:"moto",name:"Combustível",icon:"⛽",fund:"fuel",weight:100},
   {id:"casa",name:"Casa",icon:"🏠",fund:"free",weight:20},
   {id:"compras",name:"Compras",icon:"🛍️",fund:"free",weight:20},
   {id:"lazer",name:"Lazer",icon:"🎉",fund:"free",weight:35},
   {id:"saude",name:"Saúde",icon:"💊",fund:"free",weight:15},
   {id:"outros",name:"Outros",icon:"📦",fund:"free",weight:10}],
  plans:{[s]:{salary:0,extra:0,food:0,fuel:0,fixed:[],cards:[],once:[]}},
  tx:[],market:[],fuel:[]};
}
let S;
try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){}
if(!S||!S.plans)S=seed();
const norm=()=>{S.installs=S.installs||[];S.marketHist=S.marketHist||[];S.market=S.market||[];S.fuel=S.fuel||[];S.tx=S.tx||[];S.extraSplit=S.extraSplit||{reserva:50,divida:30,lazer:20};S.reserve=S.reserve||{goal:1000,deps:[]};S.reserve.deps=S.reserve.deps||[]};
norm();
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
save();

let M=mkey(new Date()),TAB="home",FILT="all";
const cat=id=>S.cats.find(c=>c.id===id)||{id,name:"(sem categoria)",icon:"❔",fund:"free",weight:0};
const plan=m=>S.plans[m];

const instDue=m=>S.installs.filter(i=>{const d=mdiff(i.from,m);return d>=0&&d<i.left}).reduce((a,i)=>a+i.amount,0);
function calc(m){
 const p=plan(m);if(!p)return null;
 const income=p.salary+p.extra;
 const tithe=p.salary*S.tithePct/100;
 const fixed=p.fixed.filter(f=>f.active).reduce((a,f)=>a+f.amount,0);
 const cards=p.cards.reduce((a,c)=>a+c.amount,0);
 const once=p.once.reduce((a,o)=>a+o.amount,0);
 const inst=instDue(m);
 const committed=tithe+fixed+cards+once+inst;
 const free=income-committed;
 const reserva=free>0?free*S.reservePct/100:0;
 const pool=free>0?free-reserva:0;
 const pot={free:pool,food:p.food,fuel:p.fuel};
 const sw={free:0,food:0,fuel:0};S.cats.forEach(c=>sw[c.fund]+=c.weight);
 const spent={};S.tx.filter(t=>t.date.slice(0,7)===m).forEach(t=>spent[t.cat]=(spent[t.cat]||0)+t.amount);
 const env=S.cats.map(c=>({c,limit:(sw[c.fund]?pot[c.fund]*c.weight/sw[c.fund]:0)+(c.id==="lazer"?(p.extraLazer||0):0),spent:spent[c.id]||0}));
 const known=new Set(S.cats.map(c=>c.id));
 Object.keys(spent).filter(k=>!known.has(k)).forEach(k=>env.push({c:cat(k),limit:0,spent:spent[k]}));
 return{p,income,tithe,fixed,cards,once,inst,committed,free,reserva,env};
}
function daysLeft(m){
 const[y,mo]=m.split("-").map(Number),now=new Date(),last=new Date(y,mo,0).getDate();
 if(mkey(now)===m)return last-now.getDate()+1;
 return mkey(now)<m?last:1;
}
const bar=(sp,lim)=>{const p=lim>0?sp/lim*100:(sp>0?100:0);return`<div class="bar"><i class="${p>=100?"r":p>=80?"w":""}" style="width:${Math.min(p,100)}%"></i></div>`};
const noPlan=()=>`<div class="card"><h2>Sem plano para ${esc(mname(M))}</h2><div class="mut">Crie o plano deste mês para ver quanto pode gastar.</div>
 <div class="row"><button class="b" data-act="newplan" data-copy="1">Copiar do mês anterior</button><button class="b s" data-act="newplan" data-copy="0">Em branco</button></div></div>`;

/* ---------- INÍCIO ---------- */
function vHome(){
 const c=calc(M);if(!c)return noPlan();
 const d=daysLeft(M);
 let h=c.p.salary===0?`<div class="card"><h2>👋 Comece por aqui</h2><div class="mut">1) Abra a aba <b>Plano</b> e informe salário, cartões-benefício, contas fixas e faturas do cartão. 2) Volte aqui para ver quanto pode gastar. 3) Registre cada gasto com o botão <b>+</b>.</div></div>`:"";
 h+=`<div class="card"><div class="mut">Sobra depois de tudo comprometido</div><div class="big ${c.free<0?"bad":"ok"}">${brl(c.free)}</div>
 <div class="mut">${c.free<0?"DÉFICIT: os compromissos passam da renda.":"Você fecha o mês no azul se seguir o plano."}</div></div>
 <div class="card"><h2>Para onde vai o salário (${brl(c.income)})</h2><table>
 <tr><td>🙏 Dízimo (${S.tithePct}% do salário)</td><td class="n">${brl(c.tithe)}</td></tr>
 <tr><td>🏠 Contas fixas</td><td class="n">${brl(c.fixed)}</td></tr>
 <tr><td>💳 Cartões / parcelas</td><td class="n">${brl(c.cards)}</td></tr>
 <tr><td>📦 Parcelas cadastradas</td><td class="n">${brl(c.inst)}</td></tr>
 <tr><td>📌 Pontuais</td><td class="n">${brl(c.once)}</td></tr>
 <tr><th>Comprometido</th><th class="n">${brl(c.committed)}</th></tr></table></div>`;
 if(c.free<0)h+=`<div class="alert"><b>Faltam ${brl(-c.free)} em ${esc(mname(M))}.</b><ol>
 <li>Adiar ou dividir itens pontuais, se possível.</li><li>Reduzir gastos não essenciais e evitar compras online novas.</li>
 <li>Congelar compras parceladas até zerar o déficit.</li><li>Nunca entrar no rotativo do cartão (juros de 4–12% ao mês).</li>
 <li>Toda renda extra vai primeiro para fechar o buraco.</li></ol></div>`;
 const dep=S.reserve.deps.filter(x=>x.date.slice(0,7)===M).reduce((a,x)=>a+x.amount,0),tot=S.reserve.deps.reduce((a,x)=>a+x.amount,0);
 h+=`<div class="card"><h2>🏦 Reserva de emergência</h2><div>${brl(tot)} de ${brl(S.reserve.goal)}</div>${bar(tot,S.reserve.goal)}
 <div class="mut">Planejado no mês: ${brl(c.reserva)} · depositado: ${brl(dep)}</div>
 <button class="b s" style="width:100%;margin-top:8px" data-act="dep">+ Depositar na reserva</button></div>`;
 h+=`<div class="card"><button class="b s" style="width:100%" data-act="extra">💰 Registrei uma renda extra</button>${c.p.extraDebt?`<div class="mut">Separado para adiantar dívidas: ${brl(c.p.extraDebt)}</div>`:""}</div>`;
 ["free","food","fuel"].forEach(f=>{
  const list=c.env.filter(e=>e.c.fund===f);if(!list.length)return;
  h+=`<div class="card"><h2>${FUND[f]}</h2>`;
  list.forEach(e=>{
   const left=e.limit-e.spent;
   h+=`<div><div style="display:flex;justify-content:space-between"><b>${e.c.icon} ${esc(e.c.name)}</b><span>${brl(e.spent)} / ${brl(e.limit)}</span></div>${bar(e.spent,e.limit)}
   <div class="mut">${left<0?`<span class="bad">Estourou ${brl(-left)}</span>`:`Resta ${brl(left)} · ${brl(left/d)}/dia (${d} dias)`}</div></div><br>`;
  });
  h+=`</div>`;
 });
 return h;
}

/* ---------- GASTOS ---------- */
function vGastos(){
 const all=S.tx.filter(t=>t.date.slice(0,7)===M);
 const list=all.filter(t=>FILT==="all"||t.cat===FILT).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
 const tot=all.reduce((a,t)=>a+t.amount,0);
 let h=`<div class="card"><div class="mut">Total gasto em ${esc(mname(M))}</div><div class="big">${brl(tot)}</div></div>
 <div class="row"><button class="b s" data-act="csv">📥 Importar fatura Nubank (CSV)</button></div><input type="file" id="csv" accept=".csv,text/csv,text/plain" hidden>
 <div class="chips"><button class="chip ${FILT==="all"?"on":""}" data-act="filt" data-id="all">Todos</button>${S.cats.map(c=>`<button class="chip ${FILT===c.id?"on":""}" data-act="filt" data-id="${esc(c.id)}">${c.icon} ${esc(c.name)}</button>`).join("")}</div>
 <div class="card">${list.length?`<table>${list.map(t=>{const c=cat(t.cat);return`<tr data-act="tx-edit" data-id="${t.id}"><td>${t.date.slice(8)}/${t.date.slice(5,7)}</td><td>${c.icon} ${esc(t.desc||c.name)}<div class="mut">${esc(c.name)}</div></td><td class="n">${brl(t.amount)}</td></tr>`}).join("")}</table><div class="mut">Toque para editar ou apagar.</div>`:`<div class="mut">Nada lançado. Use o botão + para registrar.</div>`}</div>`;
 return h;
}

/* ---------- MENUS ---------- */
function vMenus(){
 if(TAB==="market")return vMarket();
 if(TAB==="fuel")return vFuel();
 if(TAB==="inst")return vInst();
 if(TAB==="can")return vCan();
 if(TAB==="hist")return vHist();
 return`<div class="tiles">
 <button class="tile" data-tab="can"><span>🤔</span>Posso comprar isso?</button>
 <button class="tile" data-tab="inst"><span>📦</span>Parcelas</button>
 <button class="tile" data-tab="market"><span>🛒</span>Supermercado</button>
 <button class="tile" data-tab="fuel"><span>⛽</span>Combustível da moto</button>
 <button class="tile" data-tab="hist"><span>📈</span>Histórico</button>
 <button class="tile" data-tab="cats"><span>🏷️</span>Categorias</button>
 <button class="tile" data-tab="plano"><span>📅</span>Plano do mês</button></div>
 <div class="card mut">Dica: para criar outro menu (ex.: farmácia, academia) crie uma categoria nova e filtre em Gastos.</div>`;
}
const back='<button class="b s" data-tab="menus">‹ Menus</button>';
function vInst(){
 const months=Array.from({length:7},(_,i)=>addM(M,i));
 const tot=S.installs.reduce((a,i)=>a+i.amount*i.left,0);
 const lbl=k=>k.slice(5)+"/"+k.slice(2,4);
 return back+`<div class="card"><h2>📦 Compras parceladas</h2><div class="mut">Total ainda a pagar: <b>${brl(tot)}</b></div>
 <div class="mut">Cadastre só parcelas que ainda NÃO estão na fatura que você digitou no Plano (as que vêm depois).</div></div>
 <div class="card"><table>${S.installs.map(i=>`<tr><td>${esc(i.name)}<div class="mut">${i.left}x de ${brl(i.amount)} · de ${lbl(i.from)} a ${lbl(addM(i.from,i.left-1))}</div></td><td class="n">${brl(i.amount*i.left)}</td><td><button class="x" data-act="in-del" data-id="${i.id}">✕</button></td></tr>`).join("")||'<tr><td class="mut">Nenhuma parcela cadastrada.</td></tr>'}</table></div>
 <div class="card"><h2>Próximos meses</h2><div class="scroll"><table><tr>${months.map(m=>`<th class="n">${lbl(m)}</th>`).join("")}</tr><tr>${months.map(m=>`<td class="n">${brl(instDue(m))}</td>`).join("")}</tr></table></div></div>
 <div class="card"><h2>Nova compra parcelada</h2>
 <div class="row"><input id="in-n" placeholder="Nome (ex.: Amazon)"></div>
 <div class="row"><input id="in-v" type="number" step="0.01" placeholder="Valor da parcela"><input id="in-l" type="number" placeholder="Parcelas restantes"></div>
 <label>Primeira parcela restante cai em</label><input id="in-m" type="month" value="${addM(M,1)}">
 <button class="b" style="width:100%;margin-top:10px" data-act="in-add">Adicionar</button></div>`;
}
function vCan(){
 return back+`<div class="card"><h2>🤔 Posso comprar isso?</h2><div class="mut">Digite o valor antes de comprar.</div>
 <label>Valor (R$)</label><input id="cn-v" type="number" step="0.01" inputmode="decimal">
 <label>Seção</label><select id="cn-c">${S.cats.map(c=>`<option value="${esc(c.id)}">${c.icon} ${esc(c.name)}</option>`).join("")}</select>
 <button class="b" style="width:100%;margin-top:10px" data-act="can-go">Avaliar</button><div id="cn-r"></div></div>`;
}
function catTotals(m){const o={};S.tx.filter(t=>t.date.slice(0,7)===m).forEach(t=>o[t.cat]=(o[t.cat]||0)+t.amount);return o}
function vHist(){
 const months=Array.from({length:6},(_,i)=>addM(M,i-5));
 const ct=months.map(catTotals),tot=ct.map(o=>Object.values(o).reduce((a,b)=>a+b,0));
 const mx=Math.max(...tot,1),W=320,bw=36,gap=(W-bw*6)/7;
 const fmt=v=>v>=1000?(v/1000).toFixed(1).replace(".",",")+"k":Math.round(v);
 const bars=tot.map((v,i)=>{const h=v/mx*90,x=gap+i*(bw+gap);return`<rect x="${x}" y="${110-h}" width="${bw}" height="${Math.max(h,1)}" rx="4" style="fill:var(--pri)"/><text class="ct" x="${x+bw/2}" y="${104-h}" text-anchor="middle">${v?fmt(v):""}</text><text class="ct" x="${x+bw/2}" y="126" text-anchor="middle">${months[i].slice(5)}/${months[i].slice(2,4)}</text>`}).join("");
 const cur=ct[5],prev=ct[4],keys=[...new Set([...Object.keys(cur),...Object.keys(prev)])];
 const cmx=Math.max(1,...keys.map(k=>Math.max(cur[k]||0,prev[k]||0)));
 const rows=keys.sort((a,b)=>(cur[b]||0)-(cur[a]||0)).map(k=>{const c=cat(k),v=cur[k]||0,pv=prev[k]||0,d=pv?Math.round((v-pv)/pv*100):null;
  return`<div><div style="display:flex;justify-content:space-between"><b>${c.icon} ${esc(c.name)}</b><span>${brl(v)}${d===null?"":` <span class="${d>0?"bad":"ok"}">${d>0?"▲":"▼"}${Math.abs(d)}%</span>`}</span></div><div class="bar"><i style="width:${v/cmx*100}%"></i></div><div class="mut">mês anterior: ${brl(pv)}</div></div><br>`}).join("");
 return back+`<div class="card"><h2>📈 Gastos por mês (R$)</h2><svg viewBox="0 0 ${W} 134" style="width:100%;height:auto"><style>.ct{fill:var(--mut);font-size:10px}</style>${bars}</svg></div>
 <div class="card"><h2>${esc(mname(M))} × mês anterior</h2>${rows||'<div class="mut">Sem gastos lançados. Registre gastos ou importe uma fatura.</div>'}</div>`;
}
const SEC=[["carne","🥩","Carne"],["limpeza","🧼","Limpeza"],["alimentos","🥫","Alimentos"],["outras","🛍️","Outras"]];
const secOf=k=>SEC.find(x=>x[0]===k)||SEC[3];
const foodSpent=m=>S.tx.filter(t=>t.date.slice(0,7)===m&&cat(t.cat).fund==="food").reduce((a,t)=>a+t.amount,0);
function valeBox(m,extra){
 const p=plan(m);
 if(!p)return`<div class="mut">Crie o plano de ${esc(mname(m))} para acompanhar o vale-alimentação.</div>`;
 const vale=p.food,sp=foodSpent(m),after=sp+extra,left=vale-sp;
 let msg=`Gasto de alimentação em ${esc(mname(m))}: <b>${brl(sp)}</b> de ${brl(vale)} · restam ${brl(Math.max(left,0))}`;
 let st="";
 if(extra>0){
  st=after>vale?`<div class="alert">⚠️ Esta compra de ${brl(extra)} <b>passa do vale-alimentação em ${brl(after-vale)}</b>. Esse valor teria que sair do salário — tire itens da lista ou adie.</div>`
   :after>vale*.85?`<div class="alert" style="background:var(--soft)">🟡 Cabe no vale, mas sobram só ${brl(vale-after)} para o resto do mês.</div>`
   :`<div class="alert" style="background:var(--ok-soft)">✅ Cabe no vale-alimentação. Depois da compra sobram ${brl(vale-after)}.</div>`;
 }else if(sp>vale)st=`<div class="alert">⚠️ Você já passou do vale-alimentação em ${brl(sp-vale)}.</div>`;
 return`<div>${msg}</div>${bar(after,vale)}${st}`;
}
function vMarket(){
 const est=S.market.reduce((a,i)=>a+i.qty*i.price,0),got=S.market.filter(i=>i.done).reduce((a,i)=>a+i.qty*i.price,0);
 const sec=i=>i.sec||"outras";
 let h=back+`<div class="card"><h2>🛒 Supermercado</h2>${valeBox(M,est)}
 <div class="mut">Lista completa: <b>${brl(est)}</b> · já no carrinho (marcados): <b>${brl(got)}</b></div></div>`;
 SEC.forEach(([k,ic,nm])=>{
  const items=S.market.filter(i=>sec(i)===k);if(!items.length)return;
  h+=`<div class="card"><h2>${ic} ${nm} <span class="mut">· ${brl(items.reduce((a,i)=>a+i.qty*i.price,0))}</span></h2><table>${items.map(i=>`<tr class="${i.done?"done":""}"><td style="width:34px"><input type="checkbox" data-chg="mk|${i.id}|done" ${i.done?"checked":""}></td>
  <td>${esc(i.name)}<div class="mut">${brl(i.qty*i.price)}</div></td>
  <td style="width:58px"><input type="number" inputmode="decimal" step="any" data-chg="mk|${i.id}|qty" value="${i.qty}" aria-label="Quantidade"></td>
  <td style="width:92px"><input type="number" inputmode="decimal" step="0.01" data-chg="mk|${i.id}|price" value="${i.price}" aria-label="Preço unitário"></td>
  <td style="width:34px"><button class="x" data-act="mk-del" data-id="${i.id}">✕</button></td></tr>`).join("")}</table></div>`;
 });
 if(!S.market.length)h+=`<div class="card mut">Lista vazia. Adicione itens abaixo.</div>`;
 h+=`<div class="mut" style="padding:0 4px">Colunas: item · quantidade · preço unitário (R$)</div>
 <div class="card"><h2>Adicionar item</h2>
 <div class="row"><input id="mk-n" placeholder="Item (ex.: arroz 5kg)"></div>
 <div class="row"><select id="mk-s">${SEC.map(x=>`<option value="${x[0]}">${x[1]} ${x[2]}</option>`).join("")}</select><input id="mk-q" type="number" inputmode="decimal" placeholder="Qtd" value="1"><input id="mk-p" type="number" inputmode="decimal" step="0.01" placeholder="Preço unit."></div>
 <button class="b" style="width:100%" data-act="mk-add">Adicionar à lista</button>
 <button class="b s" style="width:100%;margin-top:10px" data-act="mk-fin">✅ Finalizar compra (salvar no histórico)</button></div>`;
 // histórico
 const hist=[...S.marketHist].sort((a,b)=>b.date.localeCompare(a.date));
 const months=[...new Set(hist.map(x=>x.date.slice(0,7)))];
 const tot=m=>hist.filter(x=>x.date.slice(0,7)===m).reduce((a,x)=>a+x.total,0);
 h+=`<div class="card"><h2>📚 Histórico de compras</h2>`;
 if(!months.length)h+=`<div class="mut">Quando você finalizar uma compra, ela aparece aqui para comparar os meses.</div>`;
 months.forEach((m,idx)=>{
  const t=tot(m),pm=months[idx+1],pt=pm?tot(pm):0,d=pt?Math.round((t-pt)/pt*100):null;
  const bySec={};hist.filter(x=>x.date.slice(0,7)===m).forEach(x=>x.items.forEach(i=>bySec[i.sec||"outras"]=(bySec[i.sec||"outras"]||0)+i.qty*i.price));
  h+=`<div style="margin-top:12px"><div style="display:flex;justify-content:space-between"><b style="text-transform:capitalize">${esc(mname(m))}</b><b>${brl(t)}${d===null?"":` <span class="${d>0?"bad":"ok"}">${d>0?"▲":"▼"}${Math.abs(d)}%</span>`}</b></div>
  <div class="mut">${SEC.filter(x=>bySec[x[0]]).map(x=>x[1]+" "+brl(bySec[x[0]])).join(" · ")}</div>`;
  hist.filter(x=>x.date.slice(0,7)===m).forEach(x=>{
   h+=`<details style="margin-top:6px"><summary>${x.date.slice(8)}/${x.date.slice(5,7)} · ${brl(x.total)} · ${x.items.length} iten(s)</summary>
   <table>${x.items.map(i=>`<tr><td>${secOf(i.sec)[1]} ${esc(i.name)}</td><td class="n">${i.qty} × ${brl(i.price)}</td></tr>`).join("")}</table>
   <div class="row"><button class="b s" data-act="mk-rep" data-id="${x.id}">🔁 Repetir esta lista</button><button class="b s" data-act="mk-hdel" data-id="${x.id}">Apagar</button></div></details>`;
  });
  h+=`</div>`;
 });
 return h+`</div>`;
}
function fuelStats(){
 const f=[...S.fuel].sort((a,b)=>a.km-b.km),r=[];
 f.forEach((x,i)=>{let kmL=null;if(i>0&&x.liters>0){const d=x.km-f[i-1].km;if(d>0)kmL=d/x.liters}r.push({x,kmL,pl:x.liters>0?x.total/x.liters:0})});
 return r.reverse();
}
function vFuel(){
 const st=fuelStats(),k=st.filter(r=>r.kmL);
 const avg=k.length?k.reduce((a,r)=>a+r.kmL,0)/k.length:0;
 const mon=S.fuel.filter(x=>x.date.slice(0,7)===M).reduce((a,x)=>a+x.total,0);
 return`<button class="b s" data-tab="menus">‹ Menus</button><div class="card"><h2>⛽ Combustível da moto</h2>
 <div class="row"><div><div class="mut">Gasto no mês</div><b>${brl(mon)}</b></div><div><div class="mut">Consumo médio</div><b>${avg?avg.toFixed(1)+" km/l":"—"}</b></div></div>
 <div class="mut">Encha o tanque sempre até o mesmo ponto para o consumo ficar preciso.</div></div>
 <div class="card"><h2>Novo abastecimento</h2><div class="row"><input type="date" id="fu-d" value="${today()}"><input id="fu-l" type="number" step="0.01" placeholder="Litros"></div>
 <div class="row"><input id="fu-t" type="number" step="0.01" placeholder="Total R$"><input id="fu-k" type="number" placeholder="Km do painel"></div>
 <button class="b" style="width:100%" data-act="fu-add">Registrar</button></div>
 <div class="card"><table>${st.map(r=>`<tr><td>${r.x.date.slice(8)}/${r.x.date.slice(5,7)}</td><td>${r.x.liters.toFixed(2)} L · ${brl(r.pl)}/L<div class="mut">${r.x.km} km${r.kmL?" · "+r.kmL.toFixed(1)+" km/l":""}</div></td><td class="n">${brl(r.x.total)}</td><td><button class="x" data-act="fu-del" data-id="${r.x.id}">✕</button></td></tr>`).join("")||`<tr><td class="mut">Nenhum abastecimento.</td></tr>`}</table>
 <div class="mut">O valor entra automaticamente em Gastos › Combustível moto.</div></div>`;
}

/* ---------- PLANO ---------- */
function vPlano(){
 const p=plan(M);if(!p)return noPlan();
 const inp=(k,id,f,v,st)=>`<input type="number" step="0.01" ${st?`style="${st}"`:""} data-chg="${k}|${id}|${f}" value="${v}">`;
 const txt=(k,id,v)=>`<input data-chg="${k}|${id}|name" value="${esc(v)}">`;
 let h=`<div class="card"><h2>Renda de ${esc(mname(M))}</h2>
 <label>Salário (piso)</label>${inp("pl",0,"salary",p.salary)}<label>Renda extra (só se já recebeu)</label>${inp("pl",0,"extra",p.extra)}
 <label>Cartão alimentação</label>${inp("pl",0,"food",p.food)}<label>Cartão combustível</label>${inp("pl",0,"fuel",p.fuel)}</div>
 <div class="card"><h2>Contas fixas</h2><table>${p.fixed.map(f=>`<tr><td><input type="checkbox" title="Pago" data-chg="fx|${f.id}|paid" ${f.paid?"checked":""}></td>
 <td>${txt("fx",f.id,f.name)}<div class="mut">${f.left?`faltam ${f.left} parcela(s) · `:""}<label style="display:inline"><input type="checkbox" data-chg="fx|${f.id}|active" ${f.active?"checked":""}> conta ativa</label></div></td>
 <td style="width:96px">${inp("fx",f.id,"amount",f.amount)}</td><td><button class="x" data-act="del" data-k="fixed" data-id="${f.id}">✕</button></td></tr>`).join("")}</table>
 <div class="mut">☑ à esquerda = pago. Desmarque "conta ativa" para simular sem ela.</div>
 <div class="row"><input id="fx-n" placeholder="Nova conta"><input id="fx-v" type="number" step="0.01" placeholder="Valor"><button class="b" data-act="add" data-k="fixed">Adicionar</button></div></div>
 <div class="card"><h2>Cartões e parcelas</h2><table>${p.cards.map(c=>`<tr><td>${txt("cd",c.id,c.name)}</td><td style="width:96px">${inp("cd",c.id,"amount",c.amount)}</td><td><button class="x" data-act="del" data-k="cards" data-id="${c.id}">✕</button></td></tr>`).join("")}</table>
 <div class="row"><input id="cd-n" placeholder="Novo cartão"><input id="cd-v" type="number" step="0.01" placeholder="Fatura"><button class="b" data-act="add" data-k="cards">Adicionar</button></div></div>
 <div class="card"><h2>Pontuais do mês</h2><table>${p.once.map(o=>`<tr><td>${txt("on",o.id,o.name)}</td><td style="width:96px">${inp("on",o.id,"amount",o.amount)}</td><td><button class="x" data-act="del" data-k="once" data-id="${o.id}">✕</button></td></tr>`).join("")||`<tr><td class="mut">Nenhum.</td></tr>`}</table>
 <div class="row"><input id="on-n" placeholder="Descrição"><input id="on-v" type="number" step="0.01" placeholder="Valor"><button class="b" data-act="add" data-k="once">Adicionar</button></div></div>
 <div class="card"><button class="b d" style="width:100%" data-act="delplan">Apagar plano deste mês</button></div>`;
 return h;
}

/* ---------- MAIS ---------- */
function vCats(){
 return`<button class="b s" data-tab="mais">‹ Mais</button><div class="card"><h2>🏷️ Categorias</h2>
 <div class="mut">O "peso" define quanto cada categoria recebe do dinheiro da sua origem (salário livre, cartão alimentação ou combustível).</div>
 <table>${S.cats.map((c,i)=>`<tr><td style="width:46px"><input data-chg="ct|${i}|icon" value="${esc(c.icon)}"></td><td><input data-chg="ct|${i}|name" value="${esc(c.name)}">
 <select data-chg="ct|${i}|fund">${Object.keys(FUND).map(f=>`<option value="${f}" ${c.fund===f?"selected":""}>${FUND[f]}</option>`).join("")}</select></td>
 <td style="width:70px"><input type="number" data-chg="ct|${i}|weight" value="${c.weight}"></td><td><button class="x" data-act="ct-del" data-id="${i}">✕</button></td></tr>`).join("")}</table>
 <div class="row"><input id="ct-i" placeholder="🙂" style="max-width:60px"><input id="ct-n" placeholder="Nova categoria"><button class="b" data-act="ct-add">Adicionar</button></div></div>`;
}
function vMais(){
 if(TAB==="cats")return vCats();
 return`<div class="card"><h2>Regras</h2><label>Dízimo (% do salário)</label><input type="number" step="0.5" data-chg="cf|0|tithePct" value="${S.tithePct}">
 <label>% da sobra que vai para a reserva</label><input type="number" data-chg="cf|0|reservePct" value="${S.reservePct}">
 <label>Meta da reserva (R$)</label><input type="number" data-chg="cf|0|goal" value="${S.reserve.goal}"></div>
 <div class="card"><h2>Renda extra: para onde vai</h2><div class="mut">Primeiro cobre o déficit do mês. O resto é dividido assim (%):</div>
 <div class="row"><label>Reserva<input type="number" data-chg="cf|0|ex_reserva" value="${S.extraSplit.reserva}"></label><label>Dívidas<input type="number" data-chg="cf|0|ex_divida" value="${S.extraSplit.divida}"></label><label>Lazer<input type="number" data-chg="cf|0|ex_lazer" value="${S.extraSplit.lazer}"></label></div></div>
 <button class="tile" style="width:100%" data-tab="cats"><span>🏷️</span>Gerenciar categorias</button>
 <div class="card"><h2>Dados</h2><div class="row"><button class="b" data-act="exp">Exportar backup</button><button class="b s" data-act="imp">Importar</button></div>
 <div class="row"><button class="b s" data-act="bk-copy">Copiar backup (texto)</button><button class="b s" data-act="bk-paste">Restaurar de texto</button></div>
 <button class="b d" style="width:100%" data-act="rst">Zerar tudo</button><input type="file" id="file" accept=".json" hidden>
 <div class="mut">Os dados ficam só neste aparelho. Exporte um backup de vez em quando (e antes de limpar dados do navegador).</div></div>
 <div class="card mut">Para instalar no Android: abra no Chrome › menu ⋮ › "Instalar app" (ou "Adicionar à tela inicial").</div>`;
}

/* ---------- RENDER ---------- */
function render(){
 $("#mlabel").textContent=mname(M);
 const v=TAB==="home"?vHome():TAB==="gastos"?vGastos():TAB==="plano"?vPlano():["menus","market","fuel","inst","can","hist"].includes(TAB)?vMenus():vMais();
 $("#view").innerHTML=v;
 const root=["market","fuel","inst","can","hist"].includes(TAB)?"menus":TAB==="cats"?"mais":TAB;
 document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("on",b.dataset.tab===root));
}
function setTab(t){TAB=t;render();scrollTo(0,0)}

/* ---------- MODAL DE GASTO ---------- */
function txDlg(id,pre){
 const t=id?S.tx.find(x=>x.id==id):null;pre=pre||{};
 const d=$("#dlg");
 d.innerHTML=`<h2>${t?"Editar gasto":"Novo gasto"}</h2>
 <label>Valor (R$)</label><input id="d-v" type="number" step="0.01" inputmode="decimal" value="${t?t.amount:(pre.amount||"")}">
 <label>Seção</label><select id="d-c">${S.cats.map(c=>`<option value="${esc(c.id)}" ${(t?t.cat:pre.cat)===c.id?"selected":""}>${c.icon} ${esc(c.name)}</option>`).join("")}</select>
 <label>Descrição</label><input id="d-n" value="${t?esc(t.desc):""}" placeholder="Ex.: pão, gasolina, remédio">
 <label>Data</label><input id="d-d" type="date" value="${t?t.date:today()}">
 <div class="row"><button class="b s" data-act="dlg-x">Cancelar</button>${t?`<button class="b d" data-act="tx-del" data-id="${t.id}">Apagar</button>`:""}<button class="b" data-act="tx-save" data-id="${t?t.id:""}">Salvar</button></div>`;
 d.showModal();
 if(!t)setTimeout(()=>$("#d-v").focus(),50);
}

/* ---------- EVENTOS ---------- */
const listOf=k=>k==="fx"?plan(M).fixed:k==="cd"?plan(M).cards:k==="on"?plan(M).once:S.market;
document.addEventListener("change",e=>{
 const el=e.target,spec=el.dataset&&el.dataset.chg;if(!spec)return;
 const[k,id,f]=spec.split("|"),val=el.type==="checkbox"?el.checked:el.type==="number"?num(el.value):el.value;
 if(k==="pl")plan(M)[f]=val;
 else if(k==="cf"){if(f==="goal")S.reserve.goal=val;else if(f.startsWith("ex_"))S.extraSplit[f.slice(3)]=val;else S[f]=val}
 else if(k==="ct")S.cats[+id][f]=val;
 else if(k==="mk"){const i=S.market.find(x=>x.id==id);i[f]=val}
 else{const i=listOf(k).find(x=>x.id==id);if(i)i[f]=val}
 save();
 if(!(el.type==="text"||!el.type)||el.tagName==="SELECT")render();
});
document.addEventListener("click",async e=>{
 const tabEl=e.target.closest("[data-tab]");
 if(tabEl){setTab(tabEl.dataset.tab);return}
 const el=e.target.closest("[data-act]");if(!el)return;
 const a=el.dataset.act,id=el.dataset.id,k=el.dataset.k;
 const g=s=>$(s).value;
 switch(a){
  case"prev":M=addM(M,-1);break;
  case"next":M=addM(M,1);break;
  case"today":M=mkey(new Date());break;
  case"filt":FILT=id;break;
  case"tx-new":txDlg();return;
  case"tx-edit":txDlg(id);return;
  case"dlg-x":$("#dlg").close();return;
  case"tx-save":{
   const v=num(g("#d-v"));if(v<=0){$("#d-v").focus();return}
   const o={cat:g("#d-c"),desc:g("#d-n").trim(),date:g("#d-d")||today(),amount:v};
   if(id){Object.assign(S.tx.find(x=>x.id==id),o)}else S.tx.push({id:uid(),...o});
   $("#dlg").close();break}
  case"tx-del":{const t=S.tx.find(x=>x.id==id);if(t&&t.ref)S.fuel=S.fuel.filter(f=>f.id!==t.ref);if(t&&t.mref)S.marketHist=S.marketHist.filter(x=>x.id!==t.mref);S.tx=S.tx.filter(x=>x.id!=id);$("#dlg").close();break}
  case"newplan":S.plans[M]=buildPlan(M,el.dataset.copy==="1");break;
  case"delplan":if(confirm("Apagar o plano deste mês? Os gastos lançados continuam."))delete S.plans[M];break;
  case"add":{
   const pre={fixed:"fx",cards:"cd",once:"on"}[k],n=g("#"+pre+"-n").trim();if(!n)return;
   const o={id:uid(),name:n,amount:num(g("#"+pre+"-v"))};if(k==="fixed"){o.active=true;o.paid=false}
   plan(M)[k].push(o);break}
  case"del":plan(M)[k]=plan(M)[k].filter(x=>x.id!=id);break;
  case"dep":{const v=num(prompt("Quanto depositou na reserva? (R$)"));if(v>0)S.reserve.deps.push({id:uid(),date:today(),amount:v});break}
  case"mk-add":{const n=g("#mk-n").trim();if(!n)return;S.market.push({id:uid(),name:n,sec:g("#mk-s"),qty:num(g("#mk-q"))||1,price:num(g("#mk-p")),done:false});break}
  case"mk-del":S.market=S.market.filter(x=>x.id!=id);break;
  case"mk-fin":{
   const sug=S.market.filter(i=>i.done).reduce((t,i)=>t+i.qty*i.price,0),d=$("#dlg");
   d.innerHTML=`<h2>✅ Finalizar compra</h2><div class="mut">Vai para o histórico e para Gastos › Supermercado. Itens marcados saem da lista.</div>
   <label>Data da compra</label><input id="mk-d" type="date" value="${today()}">
   <label>Total real pago (R$)</label><input id="mk-t" type="number" step="0.01" inputmode="decimal" value="${sug?sug.toFixed(2):""}">
   <div id="mk-v" style="margin-top:10px">${valeBox(today().slice(0,7),sug)}</div>
   <div class="row"><button class="b s" data-act="dlg-x">Cancelar</button><button class="b" data-act="mk-save">Salvar compra</button></div>`;
   d.showModal();return}
  case"mk-save":{
   const v=num(g("#mk-t")),d=g("#mk-d")||today();if(v<=0){$("#mk-t").focus();return}
   const items=S.market.filter(i=>i.done).map(i=>({name:i.name,qty:i.qty,price:i.price,sec:i.sec||"outras"})),tid=uid();
   S.marketHist.push({id:tid,date:d,total:v,items});
   S.tx.push({id:uid(),cat:"mercado",desc:"Supermercado",date:d,amount:v,mref:tid});
   S.market=S.market.filter(i=>!i.done);$("#dlg").close();break}
  case"mk-rep":{const h=S.marketHist.find(x=>x.id==id);if(h)h.items.forEach(i=>S.market.push({id:uid(),name:i.name,sec:i.sec,qty:i.qty,price:i.price,done:false}));break}
  case"mk-hdel":if(confirm("Apagar esta compra do histórico e dos gastos?")){S.marketHist=S.marketHist.filter(x=>x.id!=id);S.tx=S.tx.filter(x=>x.mref!=id)}break;
  case"fu-add":{
   const l=num(g("#fu-l")),t=num(g("#fu-t")),km=num(g("#fu-k"));if(l<=0||t<=0)return;
   const fid=uid(),d=g("#fu-d")||today();
   S.fuel.push({id:fid,date:d,liters:l,total:t,km});
   S.tx.push({id:uid(),cat:"moto",desc:"Combustível moto",date:d,amount:t,ref:fid});break}
  case"fu-del":S.fuel=S.fuel.filter(x=>x.id!=id);S.tx=S.tx.filter(x=>x.ref!=id);break;
  case"in-add":{const n=g("#in-n").trim(),v=num(g("#in-v")),l=Math.round(num(g("#in-l")));if(!n||v<=0||l<1)return;S.installs.push({id:uid(),name:n,amount:v,left:l,of:l,from:g("#in-m")||addM(M,1)});break}
  case"in-del":S.installs=S.installs.filter(x=>x.id!=id);break;
  case"can-go":{
   const v=num(g("#cn-v"));if(v<=0)return;
   const c=calc(M),cid=g("#cn-c");if(!c){$("#cn-r").innerHTML='<div class="alert">Crie o plano deste mês primeiro.</div>';return}
   const e=c.env.find(x=>x.c.id===cid),left=e?e.limit-e.spent:0,dim=new Date(+M.slice(0,4),+M.slice(5),0).getDate();
   const fl=c.env.filter(x=>x.c.fund==="free").reduce((a,x)=>a+x.limit,0),perDay=fl/dim,days=perDay>0?v/perDay:0;
   const free=e&&e.c.fund==="free";
   let cls,msg;
   if(free&&c.free<0){cls="alert";msg=`⛔ <b>Não.</b> Você está em déficit de ${brl(-c.free)} em ${esc(mname(M))}. Esta compra aumenta o buraco. Espere 48 horas e só compre se for essencial.`}
   else if(v>left){cls="alert";msg=`⚠️ <b>Estoura o envelope</b> "${esc(e?e.c.name:"")}" em ${brl(v-left)} (restam ${brl(Math.max(left,0))}). Espere 48 horas ou reduza o valor.`}
   else{cls="";msg=`✅ <b>Cabe.</b> Depois da compra sobram ${brl(left-v)} no envelope "${esc(e.c.name)}".`}
   $("#cn-r").innerHTML=`<div class="${cls}" style="margin-top:12px">${msg}</div>${days>0?`<div class="mut">Equivale a ${days.toFixed(1)} dia(s) de todo o seu dinheiro livre do mês.</div>`:""}<button class="b s" style="width:100%;margin-top:8px" data-act="can-reg" data-v="${v}" data-c="${esc(cid)}">Comprei — registrar gasto</button>`;
   return}
  case"can-reg":txDlg(null,{amount:el.dataset.v,cat:el.dataset.c});return;
  case"extra":{
   const v=num(prompt("Valor da renda extra recebida (R$):"));if(v<=0)return;
   const c=calc(M);if(!c){alert("Crie o plano deste mês primeiro.");return}
   const cover=Math.min(v,Math.max(-c.free,0)),rest=v-cover,sp=S.extraSplit,t=(sp.reserva+sp.divida+sp.lazer)||1;
   const r=rest*sp.reserva/t,dv=rest*sp.divida/t,lz=rest*sp.lazer/t,p=plan(M);
   p.extra+=cover;p.extraLazer=(p.extraLazer||0)+lz;p.extraDebt=(p.extraDebt||0)+dv;
   if(r>0)S.reserve.deps.push({id:uid(),date:today(),amount:r});
   alert(`Divisão de ${brl(v)}:\n• Cobrir déficit do mês: ${brl(cover)}\n• Reserva de emergência: ${brl(r)}\n• Adiantar dívidas/parcelas: ${brl(dv)}\n• Lazer: ${brl(lz)}`);break}
  case"csv":$("#csv").click();return;
  case"ct-add":{const n=g("#ct-n").trim();if(!n)return;S.cats.push({id:"c"+uid(),name:n,icon:g("#ct-i")||"📦",fund:"free",weight:10});break}
  case"ct-del":if(confirm("Apagar categoria? Gastos antigos dela ficam sem categoria."))S.cats.splice(+id,1);break;
  case"exp":{const l=document.createElement("a");l.href=URL.createObjectURL(new Blob([JSON.stringify(S)],{type:"application/json"}));l.download="financas-backup-"+today()+".json";l.click();return}
  case"imp":$("#file").click();return;
  case"bk-copy":{const d=$("#dlg");d.innerHTML=`<h2>Backup em texto</h2><div class="mut">Copie e guarde este texto (ex.: mande para você mesmo no WhatsApp). Para voltar os dados, use "Restaurar de texto".</div><textarea id="bk-t" readonly rows="8" style="width:100%;margin-top:8px"></textarea><div class="row"><button class="b s" data-act="dlg-x">Fechar</button><button class="b" data-act="bk-do">Copiar</button></div>`;d.showModal();$("#bk-t").value=JSON.stringify(S);return}
  case"bk-do":{const t=$("#bk-t");t.select();let c=false;try{if(navigator.clipboard){navigator.clipboard.writeText(t.value).catch(()=>{});c=true}}catch(e){}try{c=document.execCommand("copy")||c}catch(e){}el.textContent=c?"Copiado ✓":"Selecione o texto e copie";return}
  case"bk-paste":{const d=$("#dlg");d.innerHTML=`<h2>Restaurar backup</h2><div class="mut">Cole aqui o texto do backup. Isso substitui os dados atuais.</div><textarea id="bk-t" rows="8" style="width:100%;margin-top:8px" placeholder="Cole o backup aqui"></textarea><div class="row"><button class="b s" data-act="dlg-x">Cancelar</button><button class="b" data-act="bk-restore">Restaurar</button></div>`;d.showModal();return}
  case"bk-restore":{try{const d=JSON.parse(g("#bk-t"));if(!d.plans||!d.cats)throw 0;S=d;norm();$("#dlg").close();break}catch(x){alert("Texto de backup inválido");return}}
  case"rst":if(confirm("Apagar TODOS os dados e voltar ao modelo inicial?"))S=seed();norm();break;
  default:return;
 }
 save();render();
});
const parseCSV=t=>{const rows=[];let r=[],f="",q=false;for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=ch}else if(ch==='"')q=true;else if(ch===","){r.push(f);f=""}else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&t[i+1]==="\n")i++;r.push(f);f="";if(r.length>1)rows.push(r);r=[]}else f+=ch}if(f!==""||r.length){r.push(f);if(r.length>1)rows.push(r)}return rows};
function buildPlan(m,copy){
 const prevK=Object.keys(S.plans).filter(x=>x<m).sort().pop(),pv=copy&&prevK?S.plans[prevK]:null;
 if(!pv)return{salary:3000,extra:0,food:0,fuel:0,fixed:[],cards:[],once:[]};
 const gap=mdiff(prevK,m);
 return{salary:pv.salary,extra:0,food:pv.food,fuel:pv.fuel,
  fixed:pv.fixed.filter(f=>!f.left||f.left>gap).map(f=>({...f,id:uid(),paid:false,left:f.left?f.left-gap:undefined})),
  cards:pv.cards.map(c=>({id:uid(),name:c.name,amount:0})),once:[]};
}
let NOW=mkey(new Date());
function sync(){
 const n=mkey(new Date());
 if(n!==NOW){if(M===NOW)M=n;NOW=n}
 if(!plan(n)&&Object.keys(S.plans).some(x=>x<n)){S.plans[n]=buildPlan(n,true);save()}
}
const RULES=[[/ifd\*|ifood|restaurante|lanche|pizza/i,"comer","🍔","Comer fora / iFood"],[/amazon|shopee|mercado ?livre|magalu|aliexpress|shein/i,"compras","🛍️","Compras"],[/rd saude|drogar|farmac|droga/i,"saude","💊","Saúde"],[/gran |udemy|curso|educa|faculdade|universit/i,"educacao","🎓","Educação"],[/academia|claude|youtube|netflix|spotify|subscription|assin|nupay|connect/i,"assin","🔁","Assinaturas"]];
function autoCat(t){for(const[re,id,icon,name]of RULES)if(re.test(t)){if(!S.cats.some(c=>c.id===id))S.cats.push({id,name,icon,fund:"free",weight:10});return id}return S.cats.some(c=>c.id==="outros")?"outros":S.cats[0].id}
function importCSV(text){
 const rows=parseCSV(text).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test((r[0]||"").trim()));
 let added=0,skip=0,dup=0,maxD="";const groups={};
 rows.forEach(([d,t,a])=>{
  d=d.trim();const v=num(String(a).replace(/\s/g,"").replace(/\./g,"").replace(",","."));
  if(v<=0||/pagamento|estorno|desconto antecipa|revers|cr[eé]dito de/i.test(t)){skip++;return}
  const key=d+"|"+t+"|"+v.toFixed(2);if(S.tx.some(x=>x.imp===key)){dup++;return}
  S.tx.push({id:uid(),date:d,cat:autoCat(t),desc:t,amount:v,imp:key});added++;if(d>maxD)maxD=d;
  const pm=t.match(/^(.*?)\s*-\s*Parcela\s+(\d+)\/(\d+)/i);
  if(pm){const k=pm[1].trim()+"|"+pm[3],n=+pm[2],g=groups[k]||(groups[k]={key:k,name:pm[1].trim(),amount:v,of:+pm[3],max:0,date:d});if(n>=g.max){g.max=n;g.amount=v;g.date=d}}
 });
 let ni=0;const nowM=mkey(new Date());
 Object.values(groups).forEach(g=>{
  let left=g.of-g.max,from=addM(g.date.slice(0,7),2);
  const el=mdiff(from,nowM);if(el>0){left-=el;from=nowM}
  const ex=S.installs.find(i=>i.key===g.key);
  if(ex){if(g.max<=ex.maxN)return;S.installs=S.installs.filter(i=>i!==ex)}
  if(left>0){S.installs.push({id:uid(),key:g.key,maxN:g.max,name:g.name,amount:g.amount,left,of:g.of,from});ni++}
 });
 save();render();
 alert(`Importação concluída:\n• ${added} gastos adicionados\n• ${dup} já existiam\n• ${skip} ignorados (pagamentos, estornos, descontos)\n• ${ni} compras parceladas cadastradas em Menus › Parcelas`);
}
document.addEventListener("change",e=>{
 if(e.target.id==="csv"){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>importCSV(String(r.result));r.readAsText(f);e.target.value="";return}
 if(e.target.id!=="file")return;
 const f=e.target.files[0];if(!f)return;
 const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.plans||!d.cats)throw 0;S=d;norm();save();render()}catch(x){alert("Arquivo inválido")}};r.readAsText(f);
});
sync();render();
document.addEventListener("visibilitychange",()=>{if(!document.hidden){sync();render()}});
setInterval(()=>{const before=NOW;sync();if(before!==NOW)render()},60000);
if("serviceWorker"in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js").catch(()=>{});

document.addEventListener("input",e=>{
 if(e.target.id!=="mk-t"&&e.target.id!=="mk-d")return;
 const d=$("#mk-d").value||today();$("#mk-v").innerHTML=valeBox(d.slice(0,7),num($("#mk-t").value));
});
