const $ = id => document.getElementById(id);
const fmt = (x, n = 9) => Number(x).toLocaleString("es-PE", { maximumSignificantDigits: n });
const sci = x => Number(x).toExponential(4);
const horner = (a, x) => a.reduce((v, c) => v * x + c, 0);
const derivative = a => a.slice(0, -1).map((c, i) => c * (a.length - 1 - i));
const divideRoot = (a, r) => {
  const q = [a[0]];
  for (let i = 1; i < a.length - 1; i++) q.push(a[i] + r * q[i - 1]);
  return { q, remainder: a[a.length - 1] + r * q[q.length - 1] };
};
function polynomial(a) {
  const n = a.length - 1;
  return a.map((c, i) => {
    const p = n - i;
    if (Math.abs(c) < 1e-14) return "";
    const mag = Math.abs(c), term = (p && mag === 1 ? "" : fmt(mag, 6)) + (p ? "x" + (p > 1 ? "<sup>" + p + "</sup>" : "") : "");
    return (c < 0 ? "− " : "+ ") + term;
  }).filter(Boolean).join(" ").replace(/^\+ /, "") || "0";
}
function calculateRoot(e) {
  if (e) e.preventDefault();
  const ids = ["coefA", "coefB", "coefC", "coefD", "xInicial", "tolPol"], raw = ids.map(id => $(id).value.trim()), v = raw.map(Number);
  const [a, b, c, d, x0, tol] = v, alert = $("errorPolinomio"), out = $("resultadoPolinomio");
  if (raw.some(x => !x) || !v.every(Number.isFinite) || Math.abs(a) < 1e-14 || tol <= 0) {
    alert.textContent = "Ingresa coeficientes finitos, con a distinto de cero, un arranque finito y una tolerancia positiva.";
    alert.hidden = false; out.innerHTML = ""; return;
  }
  alert.hidden = true;
  const p = [a, b, c, d], dp = derivative(p), rows = [];
  let x = x0, converged = false, reason = "Se alcanzó el máximo de 50 iteraciones.";
  for (let k = 0; k <= 50; k++) {
    const px = horner(p, x), dpx = horner(dp, x);
    if (!Number.isFinite(px) || !Number.isFinite(dpx)) { reason = "El cálculo salió del rango numérico finito."; break; }
    if (Math.abs(px) <= tol) { converged = true; reason = "El residuo cumple la tolerancia."; rows.push({ k, x, px, dpx, step: 0 }); break; }
    if (Math.abs(dpx) < 1e-14) { reason = "La derivada es nula o demasiado pequeña; Newton no puede avanzar con seguridad."; rows.push({ k, x, px, dpx, step: null }); break; }
    if (k === 50) break;
    const step = px / dpx, next = x - step;
    rows.push({ k, x, px, dpx, step });
    if (!Number.isFinite(next)) { reason = "El siguiente paso no es finito."; break; }
    x = next;
  }
  const residual = horner(p, x);
  converged = converged || Math.abs(residual) <= tol;
  if (converged) reason = "La aproximación cumple la tolerancia de residuo.";
  const div = divideRoot(p, x), q = div.q, disc = q[1] * q[1] - 4 * q[0] * q[2];
  let rest;
  if (disc >= 0) rest = fmt((-q[1] + Math.sqrt(disc)) / (2 * q[0])) + " y " + fmt((-q[1] - Math.sqrt(disc)) / (2 * q[0]));
  else { const re = -q[1] / (2 * q[0]), im = Math.sqrt(-disc) / (2 * q[0]); rest = fmt(re) + " ± " + fmt(Math.abs(im)) + "i"; }
  const body = rows.map(r => "<tr><td>" + r.k + "</td><td>" + fmt(r.x, 11) + "</td><td>" + sci(r.px) + "</td><td>" + sci(r.dpx) + "</td><td>" + (r.step === null ? "—" : sci(r.step)) + "</td></tr>").join("");
  out.innerHTML = '<div class="root-results"><div class="root-metrics">' +
    metric("Raíz aproximada", fmt(x, 12)) + metric("Residuo |p(r)|", sci(Math.abs(residual))) +
    metric("Estado", converged ? '<span class="text-success">Convergió</span>' : '<span class="text-danger">No convergió</span>') +
    metric("Iteraciones", rows.length) + '</div><p class="root-note mb-0">' + reason + ' La evaluación de p y p′ utiliza Horner.</p>' +
    '<div class="panel"><h3 class="panel-title"><i class="bi bi-table text-primary me-2"></i>Historial de Newton</h3><div class="table-responsive"><table class="table table-sm table-striped root-iteration-table"><thead><tr><th>k</th><th>xₖ</th><th>p(xₖ)</th><th>p′(xₖ)</th><th>p/p′</th></tr></thead><tbody>' + body + '</tbody></table></div></div>' +
    '<div class="panel"><h3 class="panel-title"><i class="bi bi-scissors text-success me-2"></i>Deflación</h3><p>División sintética por (x − r), con r=' + fmt(x, 12) + ':</p><div class="tema-math">p(x)=(x−' + fmt(x, 9) + ')q(x)+' + fmt(div.remainder, 8) + '</div><p>Cociente: <strong>q(x)=' + polynomial(q) + '</strong></p><p class="mb-0">Raíces del cociente: <strong>' + rest + '</strong>. El residuo muestra el efecto de deflactar con una raíz aproximada.</p></div></div>';
}
function metric(label, value) { return '<div class="root-metric"><span>' + label + '</span><strong>' + value + '</strong></div>'; }
$("formPolinomio").addEventListener("submit", calculateRoot);
$("formPolinomio").addEventListener("input", e => { if (e.target.matches("input") && ["coefA","coefB","coefC","coefD","xInicial","tolPol"].every(id => $(id).value.trim())) calculateRoot(); });
$("casoBasePol").addEventListener("click", () => {
  [["coefA",1],["coefB",6],["coefC",11],["coefD",6],["xInicial",-0.5],["tolPol",1e-8]].forEach(([id, v]) => { $(id).value = v; });
  calculateRoot();
});

let exercises = [], active = 0, guide = null;
const pick = a => a[Math.floor(Math.random() * a.length)];
function makeExercises() {
  const rs = pick([[-1,-2,-4],[-1,-3,-5],[-2,-3,-4],[-1,-2,-5],[-2,-4,-5]]), [r1,r2,r3] = rs;
  const p = [1, -(r1+r2+r3), r1*r2+r1*r3+r2*r3, -r1*r2*r3], xEval = pick([0.5,1,1.5]), hornerAns = horner(p,xEval);
  const x0 = pick([-0.4,-0.6,-0.8]), p0 = horner(p,x0), dp0 = horner(derivative(p),x0), x1 = x0-p0/dp0;
  const q = divideRoot(p,r1).q, secondRoot = Math.min(r2, r3);
  exercises = [
    { name:"Evaluación estable con Horner", context:"Un controlador evalúa p(x)="+polynomial(p)+" en x="+xEval+". Calcula el residuo del modelo.", question:"¿Cuánto vale p("+xEval+") al evaluarlo con Horner?", answer:hornerAns,
      solution:"Coeficientes: ["+p.join(", ")+ "]. La recurrencia bᵢ=bᵢ₋₁x+aᵢ da p("+xEval+")="+fmt(hornerAns)+".",
      hint:"Comienza con el coeficiente principal. Multiplica el acumulado por x y suma el coeficiente siguiente.",
      steps:[
        {kind:"choice",prompt:"¿Qué operación repite Horner?",options:[["yes","Multiplicar el acumulado por x y sumar el coeficiente siguiente"],["powers","Calcular todas las potencias por separado"],["deriv","Derivar antes de evaluar"]],answer:"yes",hint:"Piensa en la forma anidada del polinomio.",explain:"Horner usa bᵢ=bᵢ₋₁x+aᵢ y evita calcular todas las potencias de x."},
        {kind:"number",prompt:"Calcula el primer paso b₁=1·("+xEval+")+("+p[1]+").",answer:p[1]+xEval,explain:"b₁="+fmt(p[1]+xEval)+". Multiplicamos por x y sumamos el coeficiente siguiente.",hint:"Cuida el signo del coeficiente de x²."},
        {kind:"number",prompt:"Continúa Horner hasta obtener p("+xEval+").",answer:hornerAns,explain:"La evaluación completa da p("+xEval+")="+fmt(hornerAns)+".",hint:"Forma b₂=b₁x+a₂ y después b₃=b₂x+a₃."}
      ]},
    { name:"Un paso de Newton-Raphson",context:"Para p(x)="+polynomial(p)+", Newton parte de x₀="+x0+". Calcula la siguiente aproximación.",question:"Usa x₁=x₀−p(x₀)/p′(x₀).",answer:x1,
      solution:"p("+x0+")="+fmt(p0,10)+" y p′("+x0+")="+fmt(dp0,10)+". Entonces x₁="+x0+"−("+fmt(p0,10)+")/("+fmt(dp0,10)+")="+fmt(x1,10)+".",
      hint:"Evalúa p y p′ en el mismo punto x₀ antes de aplicar Newton.",
      steps:[
        {kind:"choice",prompt:"¿Qué datos requiere la iteración de Newton?",options:[["value","Solo p(x₀)"],["newton","p(x₀) y p′(x₀)"],["root","La raíz exacta"]],answer:"newton",hint:"La fórmula necesita la pendiente de la tangente.",explain:"x₁=x₀−p(x₀)/p′(x₀), así que se evalúan tanto el polinomio como su derivada."},
        {kind:"number",prompt:"Evalúa p("+x0+") con Horner.",answer:p0,tolerance:.01,explain:"Horner da p("+x0+")="+fmt(p0,9)+".",hint:"Sustituye x₀ en la forma anidada del polinomio."},
        {kind:"number",prompt:"Calcula x₁ usando p′("+x0+")="+fmt(dp0,8)+".",answer:x1,tolerance:.01,explain:"x₁="+fmt(x1,9)+".",hint:"Resta p(x₀)/p′(x₀) a x₀."}
      ]},
    {name:"Deflación y raíces restantes",context:"Se conoce la raíz r₁="+r1+" de p(x)="+polynomial(p)+". Reduce el grado y busca la menor raíz del cociente.",question:"Después de dividir por (x−"+r1+"), q(x)="+polynomial(q)+". ¿Cuál es su menor raíz real?",answer:secondRoot,
      solution:"La división sintética por r="+r1+" produce q(x)="+polynomial(q)+" y residuo 0. Como p(x)=(x−"+r1+")(x−"+r2+")(x−"+r3+"), las raíces de q son "+r2+" y "+r3+". La solicitada es "+secondRoot+".",
      hint:"Aplica división sintética para formar el cociente y después factoriza el cuadrático.",
      steps:[
        {kind:"choice",prompt:"¿Qué valor tiene el residuo al dividir p(x) por (x−r)?",options:[["pr","p(r), por el teorema del residuo"],["always","Siempre cero"],["deriv","p′(r)"]],answer:"pr",hint:"Relaciona la división con la evaluación del polinomio.",explain:"p(x)=(x−r)q(x)+p(r); solo será cero si r es una raíz exacta."},
        {kind:"number",prompt:"Calcula el coeficiente de x del cociente: "+p[1]+" + ("+r1+")·1.",answer:q[1],explain:"El coeficiente es "+p[1]+"+("+r1+")="+q[1]+".",hint:"Baja el primer coeficiente y multiplícalo por la raíz conocida."},
        {kind:"number",prompt:"Factoriza q(x)="+polynomial(q)+" y escribe la otra raíz solicitada.",answer:secondRoot,tolerance:.001,explain:"El cociente se factoriza como (x−"+r2+")(x−"+r3+"); sus raíces son "+r2+" y "+r3+".",hint:"Busca factores cuyo producto sea el término independiente y cuya suma coincida con el coeficiente de x."}
      ]}
  ];
  active=0; guide=null; renderExercise();
}
function renderExercise() {
  $("selectorPolinomios").innerHTML=exercises.map((e,i)=>'<button class="btn '+(i===active?"btn-primary":"btn-outline-primary")+'" type="button" data-ex="'+i+'">Problema '+(i+1)+'</button>').join("");
  const e=exercises[active]; $("contextoPolinomios").innerHTML="<h3 class=\"h5 fw-bold\"><i class=\"bi bi-diagram-2 text-primary me-2\"></i>"+e.name+"</h3><p class=\"mb-0\">"+e.context+"</p>";
  $("preguntasPolinomios").innerHTML='<article class="panel root-question"><div class="border-bottom pb-3 mb-3"><span class="badge bg-primary me-2">Problema '+(active+1)+'.1</span><h3 class="h5 fw-bold d-inline">'+e.name+'</h3></div><p>'+e.question+'</p><div class="input-group mb-2"><input class="form-control" id="answerFull" type="text" inputmode="decimal" placeholder="Escribe tu respuesta"><button class="btn btn-primary" data-action="check">Comprobar</button></div><p class="small text-secondary">Intentos: <strong id="answerTries">0</strong></p><div class="d-flex flex-wrap gap-3"><button class="btn btn-link btn-sm p-0" data-action="solution"><i class="bi bi-journal-text me-1"></i>Leer desarrollo completo</button><button class="btn btn-link btn-sm p-0 fw-semibold" data-action="guided"><i class="bi bi-stars me-1"></i>Practicar desarrollo guiado</button></div><div class="root-solution mt-3" id="fullSolution" hidden>'+e.solution+'</div><div id="answerFeedback"></div>'+(guide?'<aside class="guided-panel mt-4"><div class="guided-header"><div><span class="guided-kicker">Aprendizaje paso a paso</span><h4 class="h5 mb-0">Desarrollo guiado</h4></div><button class="btn-close btn-close-white" data-action="close" aria-label="Cerrar guía"></button></div><div id="guideBody" class="guided-panel-body"></div></aside>':"")+'</article>';
  if(guide) renderGuide();
}
function renderGuide() {
  const panel=$("guideBody"); if(!panel||!guide)return; const e=exercises[active],s=e.steps[guide.step],ok=guide.feedback?.ok,total=e.steps.length;
  if(guide.done){panel.innerHTML='<div class="guided-finish"><h5>¡Llegaste al resultado! 🎉</h5><p>Respuesta: <strong>'+fmt(e.answer,10)+'</strong></p><p class="mb-0">'+e.solution+'</p></div>';return;}
  const ctrl=s.kind==="choice"?'<div class="d-grid gap-2 mt-3">'+s.options.map(([v,t])=>'<button type="button" class="btn guided-choice '+(guide.value===v?"is-selected":"")+'" data-choice="'+v+'" '+(ok?"disabled":"")+'>'+t+'</button>').join("")+'</div>':'<label class="form-label mt-3" for="guideAnswer">Tu respuesta</label><input class="form-control" id="guideAnswer" inputmode="decimal" value="'+String(guide.value).replace(/"/g,"&quot;")+'" '+(ok?"disabled":"")+'>';
  let fb=""; if(guide.feedback)fb=ok?'<div class="guided-feedback is-correct mt-3"><strong>'+(guide.feedback.revealed?"Explicación del paso 📘":"¡Correcto, vas avanzando! ✨")+'</strong><p>'+guide.feedback.text+'</p>'+(guide.feedback.revealed?'<p><strong>Respuesta:</strong> '+(s.kind==="choice"?s.options.find(x=>s.answer===x[0])[1]:fmt(s.answer,9))+'</p>':"")+'<div class="guided-explanation">'+s.explain+'</div><button class="btn btn-success mt-3" data-action="next">'+(guide.step+1===total?"Ver resultado final":"Continuar al siguiente paso")+' <i class="bi bi-arrow-right"></i></button></div>':'<div class="guided-feedback is-try mt-3"><strong>¡Sigue intentando! 💪</strong><p>'+guide.feedback.text+'</p><p class="mb-0">Pista: '+s.hint+'</p>'+(guide.tries>=3?'<button class="btn btn-outline-primary btn-sm mt-2" data-action="reveal">Ver explicación y continuar</button>':"")+'</div>';
  panel.innerHTML='<div class="d-flex justify-content-between mb-2"><strong>'+e.name+'</strong><span>Paso '+(guide.step+1)+' de '+total+'</span></div><div class="guided-progress mb-3"><div class="progress-bar" style="width:'+guide.step/total*100+'%"></div></div><div class="guided-step-card"><span class="guided-step-number">'+(guide.step+1)+'</span><h5 class="mt-3">Resolvamos este paso</h5><p>'+s.prompt+'</p>'+ctrl+(ok?"":'<button type="button" class="btn btn-primary w-100 mt-3" data-action="check-step">Comprobar este paso</button>')+fb+'</div>';
}
function checkGuide() {
  const s=exercises[active].steps[guide.step],raw=String(guide.value??"").trim().replace(",","."); let ok=false;
  if(raw)ok=s.kind==="choice"?s.answer===raw:Number.isFinite(Number(raw))&&Math.abs(Number(raw)-s.answer)<=Math.max(Math.abs(s.answer)*(s.tolerance||.005),1e-9);
  if(!ok)guide.tries++; guide.feedback={ok,text:raw?(ok?"Respuesta correcta. Revisa la explicación del paso.":"Todavía no coincide. Usa la pista y vuelve a probar."):"Elige una opción o escribe un número antes de comprobar."}; renderGuide();
}
$("selectorPolinomios").addEventListener("click",e=>{const b=e.target.closest("[data-ex]");if(!b)return;active=Number(b.dataset.ex);guide=null;renderExercise();});
$("nuevosPolinomios").addEventListener("click",makeExercises);
$("preguntasPolinomios").addEventListener("input",e=>{if(e.target.id==="guideAnswer"&&guide){guide.value=e.target.value;guide.feedback=null;}});
$("preguntasPolinomios").addEventListener("click",e=>{
  const b=e.target.closest("[data-action],[data-choice]");if(!b)return;
  if(b.dataset.choice&&guide){guide.value=b.dataset.choice;guide.feedback=null;renderGuide();return;}
  const action=b.dataset.action;
  if(action==="guided"){guide={step:0,value:"",tries:0,feedback:null,done:false};renderExercise();}
  if(action==="close"){guide=null;renderExercise();}
  if(action==="solution"){const box=$("fullSolution");box.hidden=!box.hidden;b.innerHTML=box.hidden?'<i class="bi bi-journal-text me-1"></i>Leer desarrollo completo':'<i class="bi bi-eye-slash me-1"></i>Ocultar desarrollo completo';}
  if(action==="check"){const e=exercises[active],raw=$("answerFull").value.trim().replace(",", "."),n=Number(raw),ok=raw!==""&&Number.isFinite(n)&&Math.abs(n-e.answer)<=Math.max(Math.abs(e.answer)*.01,1e-9);$("answerTries").textContent=String(Number($("answerTries").textContent)+1);$("answerFeedback").className="guided-feedback mt-3 "+(ok?"is-correct":"is-try");$("answerFeedback").innerHTML=ok?"<strong>¡Correcto! 🎉</strong><p class=\"mb-0\">"+e.solution+"</p>":"<strong>Revisa el procedimiento, puedes intentarlo.</strong><p class=\"mb-0\">Pista: "+e.hint+"</p>";}
  if(action==="check-step")checkGuide();
  if(action==="reveal"&&guide){guide.feedback={ok:true,revealed:true,text:"Puedes revisar el desarrollo de este paso y continuar a tu ritmo."};renderGuide();}
  if(action==="next"&&guide){if(guide.step+1>=exercises[active].steps.length)guide.done=true;else guide.step++;guide.value="";guide.tries=0;guide.feedback=null;renderGuide();}
});
makeExercises();
