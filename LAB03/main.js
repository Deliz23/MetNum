"use strict";

const $ = id => document.getElementById(id);
const Z_MIN = -10, Z_MAX = 10, TARGET = 0.83;
const exactRoot = Math.log(TARGET / (1 - TARGET));
let latest = null, latestMap = null, convergenceChart = null;

function sigmoid(z) {
  if (z >= 0) { const e = Math.exp(-z); return 1 / (1 + e); }
  const e = Math.exp(z); return e / (1 + e);
}
function f(z) { return sigmoid(z) - TARGET; }
function df(z) { const p = sigmoid(z); return p * (1 - p); }
function fmt(x, digits = 7) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("es-PE", { maximumSignificantDigits: digits });
}
function readParams() {
  const z0 = Number($("startZ").value), z1 = Number($("startZ1").value), alpha = Number($("damping").value), lambda = Number($("lambda").value), tolX = Number($("tolX").value), tolF = Number($("tolF").value), maxIter = Number($("maxIter").value);
  if (![z0,z1,alpha,lambda,tolX,tolF,maxIter].every(Number.isFinite)) throw new Error("Completa todos los campos con números finitos.");
  if (z0 < Z_MIN || z0 > Z_MAX || z1 < Z_MIN || z1 > Z_MAX) throw new Error("Los inicios deben estar dentro de [−10, 10].");
  if (!(alpha > 0 && alpha <= 1)) throw new Error("El amortiguamiento debe cumplir 0 < α ≤ 1.");
  if (!(lambda > 0 && lambda < 8)) throw new Error("Para este mapa, usa 0 < λ < 8.");
  if (!(tolX > 0) || !(tolF > 0)) throw new Error("Las tolerancias deben ser mayores que cero.");
  if (!Number.isInteger(maxIter) || maxIter < 1 || maxIter > 2000) throw new Error("El máximo debe ser un entero entre 1 y 2000.");
  return { z0,z1,alpha,lambda,tolX,tolF,maxIter };
}
function bisectRescue(rows, maxIter, tolX, tolF, reason) {
  let a = Z_MIN, b = Z_MAX, fa = f(a), fb = f(b), k = 0;
  if (fa * fb > 0) return { root: null, rows, converged: false, recovered: false, status: `${reason}; el intervalo de rescate no encierra una raíz.` };
  while (k < maxIter) {
    k++;
    const z = a + (b-a)/2, fz = f(z), error = (b-a)/2;
    rows.push({ k: rows.length + 1, z, fz, error, step: "Rescate: bisección", status: "Bisección" });
    if (Math.abs(fz) <= tolF && error <= tolX) return { root:z, rows, converged:true, recovered:true, status:`Rescate por bisección: ${reason}` };
    if (fa*fz < 0) { b=z; fb=fz; } else { a=z; fa=fz; }
  }
  return { root: rows.at(-1)?.z ?? null, rows, converged:false, recovered:true, status:`Rescate por bisección; llegó al máximo. Motivo: ${reason}` };
}
function finish(root, rows, converged, status, recovered = false) { return { root, rows, converged, status, recovered }; }
function newton({z0,alpha,tolX,tolF,maxIter}) {
  let z=z0, rows=[];
  for(let k=1;k<=maxIter;k++) {
    const fz=f(z), derivative=df(z);
    if(!Number.isFinite(fz)||!Number.isFinite(derivative)||Math.abs(derivative)<1e-12) return bisectRescue(rows,maxIter,tolX,tolF,"derivada no válida o demasiado pequeña");
    const next=z-alpha*fz/derivative;
    if(!Number.isFinite(next)||next<Z_MIN||next>Z_MAX) return bisectRescue(rows,maxIter,tolX,tolF,"paso de Newton fuera del dominio");
    const error=Math.abs(next-z), fn=f(next), done=error<=tolX&&Math.abs(fn)<=tolF;
    rows.push({k,z:next,fz:fn,error,step:alpha<1?"Newton amortiguado":"Newton",status:done?"Convergió":"Continuar"});
    if(done)return finish(next,rows,true,"Convergió con Newton");
    z=next;
  }
  return bisectRescue(rows,maxIter,tolX,tolF,"Newton alcanzó el máximo de iteraciones");
}
function secant({z0,z1,alpha,tolX,tolF,maxIter}) {
  let x0=z0,x1=z1,f0=f(x0),f1=f(x1),rows=[];
  for(let k=1;k<=maxIter;k++) {
    const denom=f1-f0;
    if(!Number.isFinite(denom)||Math.abs(denom)<1e-12)return bisectRescue(rows,maxIter,tolX,tolF,"denominador de secante casi cero");
    const raw=x1-f1*(x1-x0)/denom, next=x1+alpha*(raw-x1);
    if(!Number.isFinite(next)||next<Z_MIN||next>Z_MAX)return bisectRescue(rows,maxIter,tolX,tolF,"paso de secante fuera del dominio");
    const fn=f(next),error=Math.abs(next-x1),done=error<=tolX&&Math.abs(fn)<=tolF;
    rows.push({k,z:next,fz:fn,error,step:alpha<1?"Secante amortiguada":"Secante",status:done?"Convergió":"Continuar"});
    if(done)return finish(next,rows,true,"Convergió con secante");
    x0=x1;f0=f1;x1=next;f1=fn;
  }
  return bisectRescue(rows,maxIter,tolX,tolF,"secante alcanzó el máximo de iteraciones");
}
function fixedPoint({z0,lambda,tolX,tolF,maxIter}) {
  let z=z0,rows=[];
  for(let k=1;k<=maxIter;k++) {
    const next=z-lambda*f(z);
    if(!Number.isFinite(next)||next<Z_MIN||next>Z_MAX)return bisectRescue(rows,maxIter,tolX,tolF,"paso de punto fijo fuera del dominio");
    const fn=f(next),error=Math.abs(next-z),done=error<=tolX&&Math.abs(fn)<=tolF;
    rows.push({k,z:next,fz:fn,error,step:"Punto fijo g(z)=z−λf(z)",status:done?"Convergió":"Continuar"});
    if(done)return finish(next,rows,true,"Convergió con punto fijo");
    z=next;
  }
  return bisectRescue(rows,maxIter,tolX,tolF,"punto fijo alcanzó el máximo de iteraciones");
}
function runAll(p) {
  return {
    newton:{method:"Newton-Raphson",...newton(p)},
    secante:{method:"Secante",...secant(p)},
    fijo:{method:"Punto fijo",...fixedPoint(p)}
  };
}
function renderSummary(results) {
  $("summary").innerHTML=`<div class="summary-grid">${Object.values(results).map(r=>{
    if(!Number.isFinite(r.root))return `<article class="summary-card is-error"><h3>${r.method}</h3><p>${r.status}</p></article>`;
    const badge=r.recovered?"warning":"";
    return `<article class="summary-card"><h3>${r.method}</h3><span class="status-badge ${badge}">${r.recovered?"Rescate usado":r.converged?"Convergió":"Sin convergencia"}</span><dl class="mt-2"><div><dt>Raíz</dt><dd>${fmt(r.root,10)}</dd></div><div><dt>Iteraciones</dt><dd>${r.rows.length}</dd></div><div><dt>|f(z)|</dt><dd>${fmt(Math.abs(f(r.root)),4)}</dd></div><div><dt>Error vs. referencia</dt><dd>${fmt(Math.abs(r.root-exactRoot),4)}</dd></div></dl><p class="small mt-2 mb-0">${r.status}</p></article>`;
  }).join("")}</div>`;
}
function renderHistory() {
  if(!latest)return;
  const selected=$("historyMethod").value;
  const result=latestMap?.[selected] || latest[selected];
  $("historyBody").innerHTML=result.rows.map(row=>`<tr><td>${row.k}</td><td>${row.step}</td><td>${fmt(row.z,9)}</td><td>${fmt(row.fz,5)}</td><td>${fmt(row.error,5)}</td><td>${row.status}</td></tr>`).join("")||`<tr><td colspan="6">No se generaron iteraciones.</td></tr>`;
}
function renderChart(results = latest) {
  if(typeof Chart==="undefined"||!latest)return;
  convergenceChart?.destroy();
  const colors={newton:"#4f46e5",secante:"#d97706",fijo:"#059669"};
  const datasets=Object.entries(results).map(([key,r])=>({label:r.initial===undefined?r.method:`${r.method} · z₀=${r.initial}`,data:r.rows.map(row=>({x:row.k,y:Math.max(Math.abs(row.fz),1e-16)})),showLine:true,borderColor:colors[key.split("_")[0]]||"#64748b",backgroundColor:colors[key.split("_")[0]]||"#64748b",pointRadius:2}));
  convergenceChart=new Chart($("convergenceChart"),{type:"scatter",data:{datasets},options:{responsive:true,maintainAspectRatio:false,parsing:false,scales:{x:{type:"linear",title:{display:true,text:"Iteración acumulada"}},y:{type:"logarithmic",title:{display:true,text:"|f(z)|"}}}}});
}
function generateMap(base) {
  const starts=[[-8,-7],[0,1],[8,7]], map={};
  for(const [z0,z1] of starts) {
    const batch=runAll({...base,z0,z1});
    for(const [method,result] of Object.entries(batch)) map[`${method}_${z0}`]={...result,initial:z0};
  }
  latestMap=map;
  $("mapBody").innerHTML=Object.values(map).map(r=>`<tr><td>${r.initial}</td><td>${r.method}</td><td>${fmt(r.root,9)}</td><td>${Number.isFinite(r.root)?fmt(Math.abs(f(r.root)),4):"—"}</td><td>${r.rows.length}</td><td>${r.recovered?"Rescate por bisección":r.converged?"Convergió directamente":"No convergió"}</td></tr>`).join("");
  $("mapPanel").hidden=false;
  const select=$("historyMethod");
  select.innerHTML=Object.entries(map).map(([key,r])=>`<option value="${key}">${r.method} · z₀=${r.initial}</option>`).join("");
  select.value="newton_0";
  renderHistory();
  renderChart(map);
}
function run() {
  try { const p=readParams(); latest=runAll(p); latestMap=null; $("mapPanel").hidden=true; $("errorMsg").hidden=true; $("historyMethod").innerHTML='<option value="newton">Newton-Raphson</option><option value="secante">Secante</option><option value="fijo">Punto fijo</option>'; renderSummary(latest); renderChart(); renderHistory(); }
  catch(error) { $("errorMsg").textContent=error.message; $("errorMsg").hidden=false; }
}
$("formSim").addEventListener("submit",event=>{event.preventDefault();run();});
$("mapBtn").addEventListener("click",()=>{
  try { const p=readParams(); latest=runAll(p); generateMap(p); $("errorMsg").hidden=true; renderSummary(latestMap); }
  catch(error) { $("errorMsg").textContent=error.message; $("errorMsg").hidden=false; }
});
$("historyMethod").addEventListener("change",renderHistory);
document.querySelectorAll(".preset-start").forEach(button=>button.addEventListener("click",()=>{
  const value=Number(button.dataset.value); $("startZ").value=value;
  $("startZ1").value=value===8?7:value-1;
  run();
}));
run();

const assessmentRules = {
  newton: { correct: value => Number.isFinite(Number(value)) && Math.abs(Number(value) - 0.66) < 0.005, hint: value => Math.abs(Number(value) - 1.32) < 0.01 ? "Calculaste el paso completo de Newton, pero falta multiplicar el incremento por α=0.5." : "Revisa f(0), f′(0), el signo de la actualización de Newton y aplica el amortiguamiento α." },
  fixed: { correct: value => value === "contract", hint: value => value === "continuous" ? "La continuidad sola no garantiza contracción ni convergencia de las iteraciones." : "Si |g′| es mayor que uno cerca de la raíz, los errores tienden a amplificarse." },
  secant: { correct: value => value === "jump", hint: value => value === "safe" ? "Un denominador casi nulo no hace exacto el paso; puede generar un salto muy grande." : "No conviene ignorar un denominador inestable: detecta la condición y aplica una salvaguarda." },
  choice: { correct: value => value === "bisection", hint: value => value === "newton" ? "Newton puede ser rápido, pero sin revisar inicio y derivada no conserva una garantía de encierro." : "La convergencia de punto fijo depende de la elección de g; no cualquier mapa sirve." }
};
document.querySelectorAll(".assessment-card").forEach(card=>{
  const key=card.dataset.assessment,input=card.querySelector(".assessment-input"),feedback=card.querySelector(".assessment-feedback"),solution=card.querySelector(".assessment-solution");
  card.querySelector(".assess-check").addEventListener("click",()=>{
    const value=input.value.trim();
    if(!value){feedback.className="assessment-feedback mt-3 text-warning";feedback.textContent="Responde antes de corregir.";return;}
    if(assessmentRules[key].correct(value)){
      feedback.className="assessment-feedback mt-3 text-success fw-semibold";
      feedback.textContent="Correcto. Compara ahora tu razonamiento con el desarrollo.";
      solution.hidden=false;
    }else{
      feedback.className="assessment-feedback mt-3 text-danger";
      feedback.textContent=assessmentRules[key].hint(value);
    }
  });
});
