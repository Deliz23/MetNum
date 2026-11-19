const $ = (id) => document.getElementById(id);
const factorial = (n) => { let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; };
const fmt = (x, digits = 8) => Number(x).toLocaleString("es-PE", { maximumSignificantDigits: digits });
function calcularTaylor() {
  const t = Number($("tiempoSensor").value), tau = Number($("tauSensor").value), n = Number($("gradoTaylor").value), tolerancia = Number($("toleranciaSensor").value);
  const error = $("errorTaylor"); const resultado = $("resultadoTaylor");
  if (["tiempoSensor", "tauSensor", "gradoTaylor", "toleranciaSensor"].some(id => $(id).value.trim() === "") || ![t, tau, n, tolerancia].every(Number.isFinite) || t < 0 || tau <= 0 || !Number.isInteger(n) || n < 0 || n > 12 || tolerancia <= 0 || t / tau > 0.4) {
    error.textContent = "Usa t ≥ 0, τ > 0, un grado entero entre 0 y 12, una tolerancia positiva y verifica que 0 ≤ t/τ ≤ 0.4."; error.hidden = false; resultado.innerHTML = ""; $("terminosTaylor").innerHTML = ""; return;
  }
  error.hidden = true;
  const u = t / tau;
  const terms = Array.from({ length: n + 1 }, (_, k) => ({ k, value: (-u) ** k / factorial(k) }));
  const approximation = terms.reduce((sum, term) => sum + term.value, 0);
  const exact = Math.exp(-u), absoluteError = Math.abs(exact - approximation);
  const bound = u ** (n + 1) / factorial(n + 1), meetsTolerance = bound <= tolerancia;
  resultado.innerHTML = `<div class="row g-3"><div class="col-md-4"><div class="tema-metric"><span>Variable reducida u=t/τ</span><strong>${fmt(u, 10)}</strong></div></div><div class="col-md-4"><div class="tema-metric"><span>Respuesta aproximada P<sub>${n}</sub>(u)</span><strong>${fmt(approximation, 12)}</strong></div></div><div class="col-md-4"><div class="tema-metric"><span>Referencia e<sup>−u</sup></span><strong>${fmt(exact, 12)}</strong></div></div><div class="col-md-4"><div class="tema-metric"><span>Error absoluto observado</span><strong>${fmt(absoluteError, 8)}</strong></div></div><div class="col-md-4"><div class="tema-metric"><span>Cota de Lagrange</span><strong>${fmt(bound, 8)}</strong></div></div><div class="col-md-4"><div class="tema-metric"><span>Criterio de diseño</span><strong class="${meetsTolerance ? "text-success" : "text-danger"}">${meetsTolerance ? "Cumple ε" : "No cumple ε"}</strong></div></div></div><p class="small text-secondary mt-3 mb-0">P<sub>${n}</sub>(u)=Σ<sub>k=0</sub><sup>${n}</sup>(−u)<sup>k</sup>/k!. Como |f<sup>(${n + 1})</sup>(u)|≤1 en 0≤u≤0.4, se garantiza |R<sub>${n}</sub>|≤u<sup>${n + 1}</sup>/(${n + 1})! = ${fmt(bound, 8)}. ${meetsTolerance ? "El grado elegido satisface la tolerancia solicitada." : "Aumenta el grado hasta que la cota sea menor o igual que ε."}</p>`;
  $("terminosTaylor").innerHTML = terms.map(({ k, value }) => `<span class="tema-term"><small>k=${k}</small>${fmt(value, 8)}</span>`).join("");
}

let banco = [], activo = 0, guiaAbierta = null;
const aleatorio = (xs) => xs[Math.floor(Math.random() * xs.length)];
function crearBanco() {
  const h = aleatorio([0.2, 0.3, 0.4, 0.5]);
  const n = aleatorio([2, 3, 4, 5]);
  const x = aleatorio([0.2, 0.4, 0.6, 0.8]);
  const hFD = aleatorio([0.08, 0.1, 0.12, 0.15]);
  const f = (t) => Math.exp(t);
  const pSin = (xx, degree) => Array.from({ length: degree + 1 }, (_, k) => k % 2 === 1 ? (((k - 1) / 2) % 2 === 0 ? 1 : -1) * xx ** k / factorial(k) : 0).reduce((s, v) => s + v, 0);
  const err = Math.abs(Math.sin(h) - pSin(h, n));
  const forward = (f(x + hFD) - f(x)) / hFD, centered = (f(x + hFD) - f(x - hFD)) / (2 * hFD), exactDerivative = f(x);
  const eForward = Math.abs(forward - exactDerivative), eCentered = Math.abs(centered - exactDerivative), ratio = eForward / eCentered;
  banco = [
    { title: "Aproximar sen(h) con un polinomio", context: `Un sensor de vibración requiere evaluar sen(h) cerca de cero. Se toma h = ${h} rad y se trunca la serie en grado n = ${n}.`, questions: [{ title: "Error de truncamiento en sen(h)", prompt: `Usa P${n}(h) = h − h³/3! + h⁵/5! − … hasta grado ${n}. ¿Cuál es el error absoluto observado?`, unit: "", answer: err, tolerance: 0.015, hint: `Incluye las potencias impares que no superan el grado ${n}; luego compara P${n}(${h}) con sen(${h}).`, solution: `P${n}(${h}) = ${fmt(pSin(h, n), 10)} y sen(${h}) = ${fmt(Math.sin(h), 10)}. Por tanto, Eₐ = |sen(h) − P${n}(h)| = ${fmt(err, 7)}.`, steps: [
      { type: "choice", prompt: "¿Qué potencias aparecen en la serie de sen(h)?", options: [["par", "Solo potencias pares"], ["impar", "Solo potencias impares"], ["todas", "Todas las potencias"]], correct: ["impar"], hint: "Recuerda la expansión de sen(h) alrededor de cero.", explain: "sen(h) = h − h³/3! + h⁵/5! − …; solo contiene potencias impares." },
      { type: "number", prompt: `Evalúa P${n}(${h}) incluyendo solo términos hasta ese grado.`, answer: pSin(h, n), tolerance: 0.015, hint: "Sustituye h en cada término y conserva los signos alternados.", explain: `La suma de términos permitidos da P${n}(${h}) = ${fmt(pSin(h, n), 9)}.` },
      { type: "number", prompt: "Resta la aproximación de sen(h) y toma valor absoluto.", answer: err, tolerance: 0.02, hint: `Compara con sen(${h}) ≈ ${fmt(Math.sin(h), 9)}.`, explain: `El error absoluto es |${fmt(Math.sin(h), 9)} − ${fmt(pSin(h, n), 9)}| = ${fmt(err, 7)}.` }
    ] }] },
    { title: "Elegir el grado según una cota", context: `Se aproxima eˣ en x = ${x} con Taylor alrededor de a = 0. En [0, ${x}], la derivada de cualquier orden es eᵗ ≤ e^${x}.`, questions: [{ title: "Cota del resto de Lagrange", prompt: `Calcula la cota M·x^(n+1)/(n+1)! usando M=e^${x} y n=${n}.`, unit: "", answer: Math.exp(x) * x ** (n + 1) / factorial(n + 1), tolerance: 0.02, hint: "En la fórmula del resto, usa el orden siguiente n+1 y la máxima derivada M=eˣ.", solution: `Resto ≤ e^${x} · ${x}^${n + 1}/(${n + 1})! = ${fmt(Math.exp(x) * x ** (n + 1) / factorial(n + 1), 7)}.`, steps: [
      { type: "choice", prompt: "¿Qué orden de derivada aparece en el resto para un polinomio de grado n?", options: [["n", "La derivada n-ésima"], ["next", "La derivada (n+1)-ésima"], ["zero", "La función sin derivar"]], correct: ["next"], hint: "El resto mide el primer orden que quedó fuera del polinomio.", explain: "La forma de Lagrange usa f⁽ⁿ⁺¹⁾(ξ) y divide entre (n+1)!." },
      { type: "number", prompt: `¿Cuánto vale la cota M para eᵗ en 0 ≤ t ≤ ${x}?`, answer: Math.exp(x), tolerance: 0.01, hint: `eᵗ crece en el intervalo, así que usa el valor en t=${x}.`, explain: `M = e^${x} = ${fmt(Math.exp(x), 8)}.` },
      { type: "number", prompt: `Evalúa M·x^${n + 1}/(${n + 1})!.`, answer: Math.exp(x) * x ** (n + 1) / factorial(n + 1), tolerance: 0.02, hint: "Sustituye M, calcula la potencia y divide por el factorial.", explain: `La cota estimada es ${fmt(Math.exp(x) * x ** (n + 1) / factorial(n + 1), 7)}; el error real no supera este valor bajo las hipótesis indicadas.` }
    ] }] },
    { title: "Derivación numérica y orden", context: `Para f(x)=eˣ se aproxima f′(${x}) con diferencias hacia adelante y centradas usando h=${hFD}.`, questions: [{ title: "Orden y error observado", prompt: "¿Cuántas veces mayor es el error hacia adelante que el error centrado?", unit: "veces", answer: ratio, tolerance: 0.02, hint: "Calcula ambos errores comparando las fórmulas con f′(x)=eˣ y divide E_forward/E_centered.", solution: `E adelante = ${fmt(eForward, 7)}; E centrado = ${fmt(eCentered, 7)}. La razón es ${fmt(eForward, 7)}/${fmt(eCentered, 7)} = ${fmt(ratio, 6)}. Para h pequeño, sus órdenes esperados son 1 y 2.`, steps: [
      { type: "choice", prompt: "¿Qué orden tiene la diferencia hacia adelante según Taylor?", options: [["1", "Orden O(h)"], ["2", "Orden O(h²)"], ["3", "Orden O(h³)"]], correct: ["1"], hint: "El término de error dominante de la fórmula unilateral es proporcional al primer poder de h.", explain: "La expansión de f(x+h) deja un error principal proporcional a h: orden O(h)." },
      { type: "choice", prompt: "¿Qué orden tiene la diferencia centrada simétrica?", options: [["1", "Orden O(h)"], ["2", "Orden O(h²)"], ["3", "Orden O(h³)"]], correct: ["2"], hint: "Al restar las expansiones en x+h y x−h, ciertos términos se cancelan.", explain: "La simetría cancela el término de segundo grado de la expansión tras dividir por 2h; el error principal queda O(h²)." },
      { type: "number", prompt: "Divide el error hacia adelante entre el error centrado.", answer: ratio, tolerance: 0.02, hint: `Eadelante≈${fmt(eForward, 7)} y Ecentrado≈${fmt(eCentered, 7)}.`, explain: `La razón observada es aproximadamente ${fmt(ratio, 6)}. La diferencia concreta depende del punto y del paso h.` }
    ] }] }
  ];
  activo = 0; guiaAbierta = null; renderizarEjercicio();
}
function renderizarEjercicio() {
  const selector = $("selectorTaylor"), contexto = $("contextoTaylor"), contenedor = $("preguntasTaylor"), ej = banco[activo];
  selector.innerHTML = banco.map((item, i) => `<button type="button" class="btn ${i === activo ? "btn-primary" : "btn-outline-primary"}" data-ejercicio="${i}">Ejercicio ${i + 1}</button>`).join("");
  contexto.innerHTML = `<h3 class="h5 fw-bold"><i class="bi bi-bezier2 text-primary me-2"></i>${ej.title}</h3><p class="mb-0">${ej.context}</p>`;
  contenedor.innerHTML = ej.questions.map((q, i) => `<article class="panel tema-question" id="pregunta-${i}"><div class="d-flex justify-content-between gap-2 border-bottom pb-3 mb-3"><div><span class="badge bg-primary me-2">Pregunta ${activo + 1}.${i + 1}</span><h3 class="h5 fw-bold d-inline">${q.title}</h3></div></div><p>${q.prompt}</p><div class="input-group mb-2"><input class="form-control" type="text" inputmode="decimal" id="respuesta-${i}" placeholder="Escribe tu respuesta"><span class="input-group-text">${q.unit}</span><button class="btn btn-primary" data-action="check" data-index="${i}">Comprobar</button></div><p class="small text-secondary">Intentos: <strong id="intentos-${i}">0</strong></p><div class="d-flex flex-wrap gap-3"><button class="btn btn-link btn-sm p-0" data-action="solution" data-index="${i}"><i class="bi bi-journal-text me-1"></i>Leer desarrollo completo</button><button class="btn btn-link btn-sm p-0 fw-semibold" data-action="guided" data-index="${i}"><i class="bi bi-stars me-1"></i>Practicar desarrollo guiado</button></div><div id="solucion-${i}" class="tema-solution mt-3" hidden>${q.solution}</div>${guiaAbierta?.index === i ? `<aside class="guided-panel mt-4"><div class="guided-header"><div><span class="guided-kicker">Aprendizaje paso a paso</span><h4 class="h5 mb-0">Desarrollo guiado</h4></div><button class="btn-close btn-close-white" data-action="close-guide" aria-label="Cerrar guía"></button></div><div id="guiaPaso" class="guided-panel-body"></div></aside>` : ""}</article>`).join("");
  if (guiaAbierta) renderizarPaso();
}
function renderizarPaso() {
  const el = $("guiaPaso"); if (!el || !guiaAbierta) return;
  const q = banco[activo].questions[guiaAbierta.index], step = q.steps[guiaAbierta.step], total = q.steps.length, ok = guiaAbierta.feedback?.ok;
  if (guiaAbierta.done) { el.innerHTML = `<div class="guided-finish"><h5>¡Lo lograste! 🎉</h5><p>Resultado: <strong>${fmt(q.answer, 8)} ${q.unit}</strong></p><p class="mb-0">${q.solution}</p></div>`; return; }
  const responseControl = step.type === "choice" ? `<div class="d-grid gap-2 mt-3">${step.options.map(([v, label]) => `<button class="btn guided-choice ${guiaAbierta.value === v ? "is-selected" : ""}" data-option="${v}" ${ok ? "disabled" : ""}>${label}</button>`).join("")}</div>` : `<label class="form-label mt-3" for="respuestaPaso">Tu respuesta</label><input id="respuestaPaso" class="form-control" inputmode="decimal" value="${guiaAbierta.value}" ${ok ? "disabled" : ""}>`;
  let feedback = "";
  if (guiaAbierta.feedback) feedback = ok ? `<div class="guided-feedback is-correct mt-3"><strong>${guiaAbierta.feedback.revealed ? "Respuesta explicada 📘" : "¡Muy bien! ✨"}</strong><p>${guiaAbierta.feedback.text}</p>${guiaAbierta.feedback.revealed ? `<p><strong>Respuesta:</strong> ${step.type === "choice" ? step.options.find(([v]) => step.correct.includes(v))?.[1] : fmt(step.answer, 8)}</p>` : ""}<div class="guided-explanation">${step.explain}</div><button class="btn btn-success mt-3" data-action="next">Continuar <i class="bi bi-arrow-right"></i></button></div>` : `<div class="guided-feedback is-try mt-3"><strong>¡Sigue intentando! 💪</strong><p>${guiaAbierta.feedback.text}</p><p class="mb-0">Pista: ${step.hint}</p>${guiaAbierta.tries >= 3 ? `<button class="btn btn-outline-primary btn-sm mt-2" data-action="reveal">Ver explicación y continuar</button>` : ""}</div>`;
  el.innerHTML = `<div class="d-flex justify-content-between mb-2"><strong>${q.title}</strong><span>${guiaAbierta.step + 1} de ${total}</span></div><div class="guided-progress mb-3"><div class="progress-bar" style="width:${guiaAbierta.step / total * 100}%"></div></div><div class="guided-step-card"><span class="guided-step-number">${guiaAbierta.step + 1}</span><h5 class="mt-3">Resolvamos este paso</h5><p>${step.prompt}</p>${responseControl}${ok ? "" : `<button class="btn btn-primary w-100 mt-3" data-action="check-step">Comprobar este paso</button>`}${feedback}</div>`;
}
function comprobarPaso() {
  const q = banco[activo].questions[guiaAbierta.index], step = q.steps[guiaAbierta.step];
  const raw = String(guiaAbierta.value ?? "").trim().replace(",", "."); let ok = false;
  if (raw) ok = step.type === "choice" ? step.correct.includes(raw) : Number.isFinite(Number(raw)) && Math.abs(Number(raw) - step.answer) <= Math.max(Math.abs(step.answer) * (step.tolerance || 0.01), 1e-9);
  if (!ok) guiaAbierta.tries++;
  guiaAbierta.feedback = { ok, text: raw ? (ok ? (step.success || "Respuesta correcta. Observa el porqué del paso.") : "Aún no coincide. Revisa la pista y vuelve a probar.") : "Elige una opción o escribe un valor antes de comprobar." };
  renderizarPaso();
}
$("formTaylor").addEventListener("submit", e => { e.preventDefault(); calcularTaylor(); });
$("formTaylor").addEventListener("input", calcularTaylor); calcularTaylor();
$("selectorTaylor").addEventListener("click", e => { const b = e.target.closest("[data-ejercicio]"); if (!b) return; activo = Number(b.dataset.ejercicio); guiaAbierta = null; renderizarEjercicio(); });
$("nuevoTaylor").addEventListener("click", crearBanco);
$("preguntasTaylor").addEventListener("click", e => {
  const b = e.target.closest("[data-action], [data-option]"); if (!b) return;
  if (b.dataset.option && guiaAbierta) { guiaAbierta.value = b.dataset.option; guiaAbierta.feedback = null; renderizarPaso(); return; }
  const action = b.dataset.action, i = Number(b.dataset.index);
  if (action === "guided") { guiaAbierta = { index: i, step: 0, value: "", tries: 0, feedback: null, done: false }; renderizarEjercicio(); }
  if (action === "close-guide") { guiaAbierta = null; renderizarEjercicio(); }
  if (action === "solution") { const box = $(`solucion-${i}`); box.hidden = !box.hidden; b.innerHTML = box.hidden ? '<i class="bi bi-journal-text me-1"></i>Leer desarrollo completo' : '<i class="bi bi-eye-slash me-1"></i>Ocultar desarrollo completo'; }
  if (action === "check") { const q = banco[activo].questions[i], val = Number($(`respuesta-${i}`).value.replace(",", ".")); const ok = Number.isFinite(val) && Math.abs(val - q.answer) <= Math.max(Math.abs(q.answer) * (q.tolerance || 0.015), 1e-9); const tries = Number($(`intentos-${i}`).textContent) + 1; $(`intentos-${i}`).textContent = tries; let fb = document.getElementById(`feedback-${i}`); if (!fb) { fb = document.createElement("div"); fb.id = `feedback-${i}`; b.closest("article").append(fb); } fb.className = `guided-feedback mt-3 ${ok ? "is-correct" : "is-try"}`; fb.innerHTML = ok ? `<strong>¡Correcto! 🎉</strong><p class="mb-0">${q.solution}</p>` : `<strong>Revisa el procedimiento</strong><p class="mb-0">Pista: ${q.hint}</p>`; }
  if (action === "check-step") comprobarPaso();
  if (action === "reveal" && guiaAbierta) { guiaAbierta.feedback = { ok: true, revealed: true, text: "Puedes avanzar con esta explicación y volver a practicar el procedimiento cuando quieras." }; renderizarPaso(); }
  if (action === "next" && guiaAbierta) { const q = banco[activo].questions[guiaAbierta.index]; if (guiaAbierta.step + 1 >= q.steps.length) guiaAbierta.done = true; else guiaAbierta.step++; guiaAbierta.value = ""; guiaAbierta.tries = 0; guiaAbierta.feedback = null; renderizarPaso(); }
});
$("preguntasTaylor").addEventListener("input", e => { if (e.target.id === "respuestaPaso" && guiaAbierta) { guiaAbierta.value = e.target.value; guiaAbierta.feedback = null; } });
crearBanco();
