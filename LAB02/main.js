"use strict";

const $ = id => document.getElementById(id);
const SLA = 140, Q_MIN = 100, Q_MAX = 1100;
let latest = null, functionChart = null, convergenceChart = null;

function latency(q) { return 18 + (0.0025 * q * q) / (1 - q / 1200); }
function f(q) { return latency(q) - SLA; }
function fmt(x, digits = 6) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("es-PE", { maximumSignificantDigits: digits });
}
function validNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${name} debe ser un número finito.`);
  return number;
}
function validateInterval(a, b, tolX, tolF, maxIter) {
  if (!(a < b)) throw new Error("El intervalo debe cumplir a < b.");
  if (a < Q_MIN || b > Q_MAX) throw new Error(`Usa un intervalo dentro de [${Q_MIN}, ${Q_MAX}].`);
  if (!(tolX > 0) || !(tolF > 0)) throw new Error("Las tolerancias deben ser mayores que cero.");
  if (!Number.isInteger(maxIter) || maxIter < 1 || maxIter > 5000) throw new Error("El máximo debe ser un entero entre 1 y 5000.");
  const fa = f(a), fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) throw new Error("La función no es finita en los extremos.");
  if (fa !== 0 && fb !== 0 && fa * fb > 0) throw new Error("El intervalo no encierra una raíz: f(a) y f(b) deben tener signos opuestos.");
}
function bisection(a, b, tolX, tolF, maxIter) {
  let fa = f(a), fb = f(b), rows = [];
  if (fa === 0) return { root: a, rows, method: "Bisección", converged: true };
  if (fb === 0) return { root: b, rows, method: "Bisección", converged: true };
  for (let k = 1; k <= maxIter; k++) {
    const c = a + (b - a) / 2, fc = f(c), errorX = (b - a) / 2;
    const done = Math.abs(fc) <= tolF && errorX <= tolX;
    rows.push({ k, a, b, c, fc, errorX, decision: done ? "PARAR" : Math.abs(fc) <= tolF ? "Cumple tol f" : errorX <= tolX ? "Cumple tol x" : "Continuar" });
    if (done) return { root: c, rows, method: "Bisección", converged: true };
    if (fa * fc < 0) { b = c; fb = fc; } else { a = c; fa = fc; }
  }
  return { root: rows.at(-1)?.c ?? NaN, rows, method: "Bisección", converged: false };
}
function falsePosition(a, b, tolX, tolF, maxIter) {
  let fa = f(a), fb = f(b), previous = null, rows = [];
  if (fa === 0) return { root: a, rows, method: "Falsa posición", converged: true };
  if (fb === 0) return { root: b, rows, method: "Falsa posición", converged: true };
  for (let k = 1; k <= maxIter; k++) {
    const denom = fb - fa;
    if (!Number.isFinite(denom) || Math.abs(denom) < Number.EPSILON) return { root: previous, rows, method: "Falsa posición", converged: false, error: "Denominador casi cero." };
    const c = (a * fb - b * fa) / denom, fc = f(c);
    if (!Number.isFinite(c) || !Number.isFinite(fc) || c < a || c > b) return { root: previous, rows, method: "Falsa posición", converged: false, error: "La interpolación produjo un valor inválido." };
    const errorX = previous === null ? Math.abs(b - a) : Math.abs(c - previous);
    const done = Math.abs(fc) <= tolF && errorX <= tolX;
    rows.push({ k, a, b, c, fc, errorX, decision: done ? "PARAR" : Math.abs(fc) <= tolF ? "Cumple tol f" : errorX <= tolX ? "Cumple tol x" : "Continuar" });
    if (done) return { root: c, rows, method: "Falsa posición", converged: true };
    if (fa * fc < 0) { b = c; fb = fc; } else { a = c; fa = fc; }
    previous = c;
  }
  return { root: rows.at(-1)?.c ?? NaN, rows, method: "Falsa posición", converged: false };
}
function renderSummary(results) {
  const html = results.map(result => {
    if (!Number.isFinite(result.root)) return `<article class="summary-card is-error"><h3>${result.method}</h3><p>${result.error || "No convergió dentro del máximo de iteraciones."}</p></article>`;
    const floorQ = Math.floor(result.root), ceilQ = Math.ceil(result.root);
    return `<article class="summary-card"><h3>${result.method}</h3><dl><div><dt>Raíz aproximada</dt><dd>${fmt(result.root, 9)}</dd></div><div><dt>Iteraciones</dt><dd>${result.rows.length}</dd></div><div><dt>|f(q)| final</dt><dd>${fmt(Math.abs(f(result.root)), 4)}</dd></div><div><dt>Entero inferior</dt><dd>${floorQ} · ${latency(floorQ) <= SLA ? "cumple" : "no cumple"}</dd></div><div><dt>Entero superior</dt><dd>${ceilQ} · ${latency(ceilQ) <= SLA ? "cumple" : "no cumple"}</dd></div></dl><p class="small mt-2 mb-0">${result.converged ? "Convergió con ambas tolerancias." : "Alcanzó el máximo sin cumplir ambas tolerancias."}</p></article>`;
  }).join("");
  $("summary").innerHTML = `<div class="summary-grid">${html}</div>`;
}
function renderHistory() {
  if (!latest) return;
  const key = $("historyMethod").value, result = latest[key];
  $("historyBody").innerHTML = result.rows.map(row => `<tr><td>${row.k}</td><td>${fmt(row.a, 7)}</td><td>${fmt(row.b, 7)}</td><td>${fmt(row.c, 9)}</td><td>${fmt(row.fc, 5)}</td><td>${fmt(row.errorX, 5)}</td><td>${row.decision}</td></tr>`).join("") || `<tr><td colspan="7">La raíz coincidió con un extremo del intervalo.</td></tr>`;
}
function renderCharts(a, b) {
  if (typeof Chart === "undefined") return;
  const points = Array.from({ length: 101 }, (_, i) => { const x = a + (b - a) * i / 100; return { x, y: f(x) }; });
  const rootPoints = [latest.biseccion, latest.falsa].filter(r => Number.isFinite(r.root)).map(r => ({ x: r.root, y: f(r.root) }));
  functionChart?.destroy();
  functionChart = new Chart($("functionChart"), { type: "scatter", data: { datasets: [{ label: "f(q)", data: points, showLine: true, pointRadius: 0, borderColor: "#4f46e5", borderWidth: 2 }, { label: "Raíces aproximadas", data: rootPoints, backgroundColor: "#722f37", pointRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, parsing: false, scales: { x: { type: "linear", title: { display: true, text: "q (solicitudes/s)" } }, y: { title: { display: true, text: "f(q) (ms)" } } } } });
  convergenceChart?.destroy();
  const series = [latest.biseccion, latest.falsa].map((r, idx) => ({ label: r.method, data: r.rows.map(row => ({ x: row.k, y: Math.max(Math.abs(row.fc), 1e-16) })), showLine: true, borderColor: idx ? "#d97706" : "#4f46e5", backgroundColor: idx ? "#d97706" : "#4f46e5", pointRadius: 3 }));
  convergenceChart = new Chart($("convergenceChart"), { type: "scatter", data: { datasets: series }, options: { responsive: true, maintainAspectRatio: false, parsing: false, scales: { x: { type: "linear", title: { display: true, text: "Iteración" } }, y: { type: "logarithmic", title: { display: true, text: "|f(c)|" } } } } });
}
function run() {
  try {
    const a = validNumber($("inputA").value, "a"), b = validNumber($("inputB").value, "b"), tolX = validNumber($("tolX").value, "Tolerancia en x"), tolF = validNumber($("tolF").value, "Tolerancia en f"), maxIter = validNumber($("maxIter").value, "Máximo de iteraciones");
    validateInterval(a, b, tolX, tolF, maxIter);
    latest = { biseccion: bisection(a, b, tolX, tolF, maxIter), falsa: falsePosition(a, b, tolX, tolF, maxIter) };
    $("errorMsg").hidden = true;
    renderSummary([latest.biseccion, latest.falsa]); renderCharts(a, b); renderHistory();
  } catch (error) { $("errorMsg").textContent = error.message; $("errorMsg").hidden = false; }
}
$("formSim").addEventListener("submit", event => { event.preventDefault(); run(); });
$("historyMethod").addEventListener("change", renderHistory);
run();

const assessmentRules = {
  bolzano: { correct: value => value === "exist", hint: value => value === "unique" ? "Estás suponiendo unicidad. El cambio de signo solo garantiza existencia; revisa qué dice exactamente el teorema de Bolzano." : "Revisa las hipótesis: continuidad en el intervalo y signos opuestos en los extremos." },
  bisection: { correct: value => Number.isFinite(Number(value)) && Number(value) === 17, hint: value => Number(value) === 16 ? "Estás muy cerca: al obtener 16.61, el número de iteraciones debe redondearse hacia arriba." : "Vuelve a despejar n en 1000/2ⁿ ≤ 0.01 y verifica la cota del ancho después de n pasos." },
  tolerances: { correct: value => value === "continue", hint: value => value === "stop" ? "El cambio entre iteraciones pequeño no basta si la ecuación aún tiene un residuo grande." : "No relajes el criterio para ocultar el residuo; revisa ambas condiciones de parada." },
  capacity: { correct: value => Number.isFinite(Number(value)) && Number(value) === 166, hint: value => Number(value) === 167 ? "Redondear al más cercano puede incumplir el SLA. Como la carga aumenta la latencia, toma el entero inferior y verifícalo en el modelo." : "Parte de la raíz continua y considera que la carga admisible debe permanecer por debajo del umbral." }
};
document.querySelectorAll(".assessment-card").forEach(card => {
  const key = card.dataset.assessment, input = card.querySelector(".assessment-input"), feedback = card.querySelector(".assessment-feedback"), solution = card.querySelector(".assessment-solution");
  card.querySelector(".assess-check").addEventListener("click", () => {
    const value = input.value.trim();
    if (!value) { feedback.className = "assessment-feedback mt-3 text-warning"; feedback.textContent = "Responde antes de corregir."; return; }
    if (assessmentRules[key].correct(value)) {
      feedback.className = "assessment-feedback mt-3 text-success fw-semibold";
      feedback.textContent = "Correcto. Buen razonamiento; revisa la solución para comparar el desarrollo.";
      solution.hidden = false;
    } else {
      feedback.className = "assessment-feedback mt-3 text-danger";
      feedback.textContent = assessmentRules[key].hint(value);
    }
  });
});
