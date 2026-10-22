"use strict";

// ========================================
// 1. UTILIDADES
// ========================================

const $ = id => document.getElementById(id);

// Unidad de redondeo de float32: u = 2^-24
const U32 = 2 ** -24;

// Espaciado entre dos float32 consecutivos alrededor de x (ulp)
function ulpFloat32(x) {
  x = Math.abs(x);

  if (x === 0) return 2 ** -149;

  let e = Math.floor(Math.log2(x));
  if (2 ** e > x) e--;
  else if (2 ** (e + 1) <= x) e++;

  return 2 ** Math.max(e - 23, -149);
}

// Número con separador de miles; maximumSignificantDigits controla la longitud
function fmtLargo(n, cifras = 12) {
  return n.toLocaleString("es-PE", { maximumSignificantDigits: cifras });
}

// Notación automática: decimal para magnitudes normales, científica para extremos
function fmtAuto(n) {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return "0";

  const abs = Math.abs(n);

  if (abs < 1e-3 || abs >= 1e15) {
    return n.toExponential(3).replace("e+", "e");
  }

  return n.toLocaleString("es-PE", { maximumSignificantDigits: 10 });
}

// Notación científica con superíndice (para insertar como HTML)
function sciHTML(n, decimales = 2) {
  if (n === 0) return "0";

  const [mantisa, exp] = n.toExponential(decimales).split("e");
  const exponente = String(Number(exp)).replace("-", "−");

  return `${mantisa} × 10<sup>${exponente}</sup>`;
}

// Notación científica para LaTeX
function texSci(n, cifras = 4) {
  const [m, e] = n.toExponential(cifras - 1).split("e");
  return `${m}\\times10^{${Number(e)}}`;
}

// Entero con espacios finos para LaTeX
function texInt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\\,");
}

// ========================================
// 2. INICIALIZACIÓN DE LA PÁGINA
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  renderizarFormulas();
  configurarDemoHero();
  configurarBotonInicio();
  configurarMenu();
  configurarSimulador();
  configurarGrafico();
  configurarEjercicio();
  configurarFormulario();
});

// ========================================
// 3. FÓRMULAS MATEMÁTICAS
// ========================================

function renderizarFormulas() {
  if (typeof katex === "undefined") {
    console.warn("No se pudo cargar KaTeX.");
    return;
  }

  const formulas = [
    {
      id: "math-ea",
      formula: "E_a = |x - \\tilde{x}|"
    },
    {
      id: "math-er",
      formula: "E_r = \\frac{|x - \\tilde{x}|}{|x|}, \\quad \\varepsilon_t = E_r \\times 100\\%"
    },
    {
      id: "math-abs",
      formula: "|\\delta| < \\tfrac{1}{2}\\,\\mathrm{ulp}(x) \\;\\Rightarrow\\; \\mathrm{fl}(x+\\delta) = x"
    },
    {
      id: "math-ulp",
      formula: "\\mathrm{ulp}(x) = 2^{\\,e-23}, \\quad 2^{e} \\le |x| < 2^{e+1}"
    }
  ];

  formulas.forEach(({ id, formula }) => {
    const elemento = $(id);

    if (elemento) {
      katex.render(formula, elemento, {
        throwOnError: false,
        displayMode: true
      });
    }
  });
}

// ========================================
// 4. DEMOSTRACIÓN INTERACTIVA DE LA PORTADA
// ========================================

function configurarDemoHero() {
  const entradaX = $("heroX");
  const entradaD = $("heroD");

  if (!entradaX || !entradaD) return;

  entradaX.addEventListener("input", actualizarDemoHero);
  entradaD.addEventListener("input", actualizarDemoHero);

  document.querySelectorAll(".preset").forEach(boton => {
    boton.addEventListener("click", () => {
      entradaX.value = boton.dataset.x;
      entradaD.value = boton.dataset.d;
      actualizarDemoHero();
    });
  });

  actualizarDemoHero();
}

function actualizarDemoHero() {
  const x = Number($("heroX").value);
  const d = Number($("heroD").value);

  const f64 = $("heroF64");
  const f32 = $("heroF32");
  const err = $("heroErr");
  const ulp = $("heroUlp");
  const msg = $("heroMsg");

  f32.classList.remove("is-loss");
  msg.classList.remove("is-loss");

  if (
    $("heroX").value.trim() === "" ||
    $("heroD").value.trim() === "" ||
    !Number.isFinite(x) ||
    !Number.isFinite(d)
  ) {
    [f64, f32, err, ulp].forEach(el => (el.textContent = "—"));
    msg.textContent = "Escribe dos números para comparar float32 con float64.";
    return;
  }

  const x32 = Math.fround(x);
  const d32 = Math.fround(d);
  const r32 = Math.fround(x32 + d32);
  const r64 = x + d;

  if (!Number.isFinite(r32)) {
    f64.textContent = fmtLargo(r64, 17);
    f32.textContent = "desbordamiento";
    err.textContent = "—";
    ulp.textContent = "—";
    msg.textContent = "El resultado excede el rango de float32 (≈ 3.4 × 10³⁸).";
    return;
  }

  const error = Math.abs(r64 - r32);
  const espaciado = ulpFloat32(x32);
  const absorbido = d !== 0 && r32 === x32;

  f64.textContent = fmtLargo(r64, 17);
  f32.textContent = fmtLargo(r32, 17);
  err.textContent = fmtAuto(error);
  ulp.textContent = fmtAuto(espaciado);

  if (absorbido) {
    f32.classList.add("is-loss");
    msg.classList.add("is-loss");
    msg.textContent =
      `Absorción: el incremento se perdió por completo. Junto a x, float32 solo ` +
      `distingue múltiplos de ${fmtAuto(espaciado)}, y δ no supera ½·ulp = ${fmtAuto(espaciado / 2)}.`;
  } else if (error > 0) {
    f32.classList.add("is-loss");
    msg.classList.add("is-loss");
    msg.textContent =
      `Float32 redondea el resultado al múltiplo de ${fmtAuto(espaciado)} más cercano ` +
      `y comete un error absoluto de ${fmtAuto(error)}.`;
  } else {
    msg.textContent = "Sin pérdida: float32 y float64 coinciden en este caso.";
  }
}

// ========================================
// 5. BOTÓN VOLVER ARRIBA
// ========================================

function configurarBotonInicio() {
  const boton = $("scrollTopBtn");

  if (!boton) return;

  function actualizarBoton() {
    boton.classList.toggle("active", window.scrollY > 300);
  }

  window.addEventListener("scroll", actualizarBoton, { passive: true });

  actualizarBoton();
}

// ========================================
// 6. MENÚ ADAPTABLE Y SECCIÓN ACTIVA
// ========================================

function configurarMenu() {
  const menu = $("navmenu");
  const enlaces = document.querySelectorAll('#navmenu .nav-link[href^="#"]');

  function marcarActivo(id) {
    enlaces.forEach(enlace => {
      enlace.classList.toggle("active", enlace.getAttribute("href") === "#" + id);
    });
  }

  enlaces.forEach(enlace => {
    enlace.addEventListener("click", () => {
      marcarActivo(enlace.getAttribute("href").slice(1));

      // Cerrar el menú después de seleccionar una sección
      if (
        menu &&
        menu.classList.contains("show") &&
        window.matchMedia("(max-width: 1199.98px)").matches
      ) {
        bootstrap.Collapse.getOrCreateInstance(menu).hide();
      }
    });
  });

  // Resalta la sección visible mientras se desplaza la página
  if ("IntersectionObserver" in window) {
    const observador = new IntersectionObserver(entradas => {
      entradas.forEach(entrada => {
        if (entrada.isIntersecting) marcarActivo(entrada.target.id);
      });
    }, { rootMargin: "-40% 0px -55% 0px" });

    enlaces.forEach(enlace => {
      const seccion = document.querySelector(enlace.getAttribute("href"));
      if (seccion) observador.observe(seccion);
    });
  }
}

// ========================================
// 7. NÚCLEO NUMÉRICO
// ========================================

// Valores de la serie: x_i = base + δ_i, con δ_i = 0.01 + ((13·i) mod 100)·(variación/100)
function generarDatos({ N, base, maxVar }) {
  const v64 = new Float64Array(N);
  const d64 = new Float64Array(N);

  for (let i = 0; i < N; i++) {
    const delta = 0.01 + ((i * 13) % 100) * (maxVar / 100);
    d64[i] = delta;
    v64[i] = base + delta;
  }

  // Float32Array redondea cada dato a la precisión de float32
  return {
    v64,
    v32: Float32Array.from(v64),
    d32: Float32Array.from(d64)
  };
}

// Suma uno a uno en float32 (cada suma parcial se redondea a 24 bits)
function sumaFloat32(a) {
  let s = 0;

  for (let i = 0; i < a.length; i++) {
    s = Math.fround(s + a[i]);
  }

  return s;
}

// Suma uno a uno en float64
function sumaFloat64(a) {
  let s = 0;

  for (let i = 0; i < a.length; i++) {
    s += a[i];
  }

  return s;
}

// Suma compensada de Kahan simulada en float32
function sumaKahan32(a) {
  let s = 0;
  let c = 0;

  for (let i = 0; i < a.length; i++) {
    const y = Math.fround(a[i] - c);
    const t = Math.fround(s + y);

    c = Math.fround(Math.fround(t - s) - y);
    s = t;
  }

  return s;
}

// Suma por pares (recursiva) en float32; los bloques pequeños se suman directamente
function sumaPares32(a, ini = 0, fin = a.length) {
  const n = fin - ini;

  if (n <= 16) {
    let s = 0;

    for (let i = ini; i < fin; i++) {
      s = Math.fround(s + a[i]);
    }

    return s;
  }

  const medio = ini + (n >> 1);

  return Math.fround(sumaPares32(a, ini, medio) + sumaPares32(a, medio, fin));
}

// Suma compensada de Neumaier en float64: referencia de alta precisión
function sumaNeumaier64(a) {
  let s = 0;
  let c = 0;

  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const t = s + x;

    if (Math.abs(s) >= Math.abs(x)) c += (s - t) + x;
    else c += (x - t) + s;

    s = t;
  }

  return s + c;
}

// Mide un método por separado
function medir(funcion) {
  const inicio = performance.now();
  const valor = funcion();

  return { valor, ms: performance.now() - inicio };
}

// ========================================
// 8. SIMULADOR
// ========================================

let ultimosResultados = null;

function configurarSimulador() {
  const formulario = $("formSim");

  if (!formulario) return;

  formulario.addEventListener("submit", evento => {
    evento.preventDefault();
    ejecutarCalculadora();
  });

  $("btnCsv").addEventListener("click", descargarCsv);

  // Resultado inicial con los valores por defecto
  ejecutarCalculadora();
}

function leerParametros() {
  const N = Number($("calcN").value);
  const base = Number($("calcBase").value);
  const maxVar = Number($("calcVar").value);
  const tol = Number($("calcTol").value);

  const problemas = [];

  if (!Number.isInteger(N) || N < 1 || N > 1000000) {
    problemas.push("N debe ser un entero entre 1 y 1,000,000.");
  }

  if (!Number.isFinite(base) || base <= 0) {
    problemas.push("La latencia base debe ser positiva.");
  }

  if (!Number.isFinite(maxVar) || maxVar < 0) {
    problemas.push("La variación máxima no puede ser negativa.");
  }

  if (!Number.isFinite(tol) || tol <= 0) {
    problemas.push("La tolerancia debe ser mayor que cero.");
  }

  const caja = $("calcError");

  if (problemas.length > 0) {
    caja.textContent = problemas.join(" ");
    caja.hidden = false;
    return null;
  }

  caja.hidden = true;

  return { N, base, maxVar, tol };
}

function ejecutarCalculadora() {
  const p = leerParametros();

  if (!p) return;

  const datos = generarDatos(p);

  const referencia = medir(() => sumaNeumaier64(datos.v64));

  const metodos = [
    { id: "f32", nombre: "Float32 directa", ...medir(() => sumaFloat32(datos.v32)) },
    { id: "f64", nombre: "Float64 directa", ...medir(() => sumaFloat64(datos.v64)) },
    { id: "kahan", nombre: "Kahan (float32)", ...medir(() => sumaKahan32(datos.v32)) },
    { id: "pares", nombre: "Por pares (float32)", ...medir(() => sumaPares32(datos.v32)) },
    {
      id: "centrados",
      nombre: "Datos centrados (float32)",
      ...medir(() => Math.fround(Math.fround(p.N * p.base) + sumaFloat32(datos.d32)))
    }
  ];

  const S = referencia.valor;

  metodos.forEach(m => {
    m.errorAbs = Math.abs(S - m.valor);
    m.errorRel = S !== 0 ? m.errorAbs / Math.abs(S) : 0;
    m.cumple = m.errorRel < p.tol;
  });

  const filaReferencia = {
    id: "ref",
    nombre: "Referencia (Neumaier, float64)",
    valor: S,
    ms: referencia.ms,
    errorAbs: 0,
    errorRel: 0,
    cumple: true,
    esReferencia: true
  };

  const filas = [...metodos, filaReferencia];

  ultimosResultados = { p, filas, S };

  pintarTabla(filas);
  pintarMetricas(p, metodos, S);
  pintarDiagnostico(p, metodos, S);

  $("simResultados").hidden = false;
  $("btnCsv").disabled = false;

  // El gráfico usa los mismos parámetros
  if ($("errorChart")) generarGrafico();
}

function pintarTabla(filas) {
  const tbody = $("tablaBenchmark");
  tbody.innerHTML = "";

  filas.forEach(m => {
    const fila = document.createElement("tr");

    if (m.esReferencia) fila.className = "is-reference";

    const nombre = document.createElement("th");
    nombre.scope = "row";
    nombre.textContent = m.nombre;

    const suma = document.createElement("td");
    suma.className = "num";
    suma.textContent = m.valor.toLocaleString("es-PE", { maximumFractionDigits: 3 });

    const errorAbs = document.createElement("td");
    errorAbs.className = "num";
    errorAbs.textContent = m.esReferencia ? "—" : fmtAuto(m.errorAbs);

    const errorRel = document.createElement("td");
    errorRel.className = "num";

    if (m.esReferencia) errorRel.textContent = "—";
    else errorRel.innerHTML = sciHTML(m.errorRel);

    const tiempo = document.createElement("td");
    tiempo.className = "num";
    tiempo.textContent = m.ms.toFixed(m.ms < 10 ? 3 : 1);

    const estado = document.createElement("td");
    const insignia = document.createElement("span");

    if (m.esReferencia) {
      insignia.className = "status status-ref";
      insignia.textContent = "Referencia";
    } else if (m.cumple) {
      insignia.className = "status status-ok";
      insignia.innerHTML = '<i class="bi bi-check-lg" aria-hidden="true"></i>Cumple';
    } else {
      insignia.className = "status status-bad";
      insignia.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>Excede';
    }

    estado.appendChild(insignia);

    fila.append(nombre, suma, errorAbs, errorRel, tiempo, estado);
    tbody.appendChild(fila);
  });
}

function pintarMetricas(p, metodos, S) {
  const ulp = ulpFloat32(S);

  // Cota de peor caso de la suma recursiva: (N − 1)·u·Σ|x| más el redondeo inicial de cada dato (u·Σ|x|)
  const cota = p.N * U32 * S;

  $("mSuma").textContent = S.toLocaleString("es-PE", { maximumFractionDigits: 2 });
  $("mUlp").textContent = fmtAuto(ulp);
  $("mCota").textContent = fmtAuto(cota);
}

function pintarDiagnostico(p, metodos, S) {
  const lista = $("diagnostico");
  lista.innerHTML = "";

  const directa = metodos.find(m => m.id === "f32");
  const ulp = ulpFloat32(S);
  const cota = p.N * U32 * S;

  const items = [];

  // 1. Situación de la suma directa
  if (directa.cumple) {
    items.push({
      clase: "is-ok",
      html: `<strong>La suma directa en float32 cumple la tolerancia.</strong> Su error relativo es ` +
        `${sciHTML(directa.errorRel)}; con estos parámetros el redondeo no llega a acumularse lo suficiente.`
    });
  } else {
    const veces = directa.errorRel / U32;

    items.push({
      clase: "is-warn",
      html: `<strong>La suma directa en float32 excede la tolerancia.</strong> Su error relativo es ` +
        `${sciHTML(directa.errorRel)}, unas ${fmtLargo(veces, 3)} veces la unidad de redondeo ` +
        `<em>u</em> ≈ 5.96 × 10<sup>−8</sup>. El error absoluto es de ${fmtAuto(directa.errorAbs)} μs.`
    });
  }

  // 2. Resolución de float32 a esa magnitud
  const margen = p.maxVar <= ulp / 2 ? "no supera" : "supera";

  items.push({
    clase: "",
    html: `A la magnitud de la suma, float32 solo distingue múltiplos de <strong>${fmtAuto(ulp)} μs</strong>. ` +
      `Cada suma parcial puede redondearse hasta ${fmtAuto(ulp / 2)} μs, y la variación máxima ` +
      `δ = ${fmtAuto(p.maxVar)} μs ${margen} ese margen.`
  });

  // 3. Cota teórica
  if (cota > 0 && directa.errorAbs > 0) {
    const porcentaje = (directa.errorAbs / cota) * 100;

    items.push({
      clase: "",
      html: `El error observado equivale al <strong>${fmtLargo(porcentaje, 3)} %</strong> de la cota teórica de peor caso. ` +
        `La cota es segura, pero pesimista: los redondeos reales no siempre se acumulan en el mismo sentido.`
    });
  }

  // 4. Mejor alternativa en float32
  const alternativas = metodos.filter(m => ["kahan", "pares", "centrados"].includes(m.id));
  const mejor = alternativas.reduce((a, b) => (b.errorAbs < a.errorAbs ? b : a));

  if (directa.errorAbs > 0 && mejor.errorAbs < directa.errorAbs) {
    const factor = mejor.errorAbs > 0
      ? `${fmtLargo(directa.errorAbs / mejor.errorAbs, 3)} veces`
      : "por completo";

    items.push({
      clase: "is-ok",
      html: `<strong>${mejor.nombre}</strong> es la mejor alternativa en float32 (error relativo ` +
        `${sciHTML(mejor.errorRel)}) y reduce el error ${mejor.errorAbs > 0 ? factor + " respecto a" : factor + " frente a"} la suma directa.`
    });
  }

  items.forEach(item => {
    const li = document.createElement("li");
    li.className = item.clase;
    li.innerHTML = item.html;
    lista.appendChild(li);
  });
}

function descargarCsv() {
  if (!ultimosResultados) return;

  const { p, filas } = ultimosResultados;

  const cabecera = ["Método", "Suma (μs)", "Error absoluto (μs)", "Error relativo", "Tiempo (ms)", "Estado"];

  const datos = filas.map(m => [
    m.nombre,
    String(m.valor),
    m.esReferencia ? "" : String(m.errorAbs),
    m.esReferencia ? "" : String(m.errorRel),
    m.ms.toFixed(4),
    m.esReferencia ? "Referencia" : (m.cumple ? "Cumple" : "Excede")
  ]);

  const celda = texto => `"${String(texto).replace(/"/g, '""')}"`;

  const csv = [cabecera, ...datos]
    .map(fila => fila.map(celda).join(","))
    .join("\r\n");

  // El BOM permite que Excel abra bien los acentos
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const enlace = document.createElement("a");

  enlace.href = URL.createObjectURL(blob);
  enlace.download = `simulador_N${p.N}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  URL.revokeObjectURL(enlace.href);
}

// ========================================
// 9. GRÁFICO
// ========================================

let chartInstance = null;
let ultimaSerie = null;

function configurarGrafico() {
  const boton = $("btnGrafico");
  const escala = $("logScale");

  if (boton) boton.addEventListener("click", generarGrafico);

  if (escala) {
    escala.addEventListener("change", () => {
      if (ultimaSerie) dibujarGrafico();
    });
  }
}

function calcularSerie({ N, base, maxVar }, puntos = 40) {
  const paso = Math.max(1, Math.floor(N / puntos));

  const serie = { x: [], f32: [], kahan: [], f64: [] };

  let sRef = 0;
  let cRef = 0;
  let s32 = 0;
  let sK = 0;
  let cK = 0;
  let s64 = 0;

  for (let i = 1; i <= N; i++) {
    const delta = 0.01 + (((i - 1) * 13) % 100) * (maxVar / 100);
    const valor = base + delta;
    const v32 = Math.fround(valor);

    // Referencia de Neumaier acumulada hasta la muestra i
    const t = sRef + valor;

    if (Math.abs(sRef) >= Math.abs(valor)) cRef += (sRef - t) + valor;
    else cRef += (valor - t) + sRef;

    sRef = t;

    s32 = Math.fround(s32 + v32);

    const y = Math.fround(v32 - cK);
    const tK = Math.fround(sK + y);

    cK = Math.fround(Math.fround(tK - sK) - y);
    sK = tK;

    s64 += valor;

    if (i % paso === 0 || i === N) {
      const ref = sRef + cRef;

      serie.x.push(i.toLocaleString("es-PE"));
      serie.f32.push(Math.abs(ref - s32));
      serie.kahan.push(Math.abs(ref - sK));
      serie.f64.push(Math.abs(ref - s64));
    }
  }

  return serie;
}

function generarGrafico() {
  const p = leerParametros();

  if (!p) return;

  if (typeof Chart === "undefined") {
    $("chartVacio").textContent = "No se pudo cargar la biblioteca del gráfico.";
    $("chartVacio").hidden = false;
    return;
  }

  ultimaSerie = calcularSerie(p);
  dibujarGrafico();
}

function dibujarGrafico() {
  const serie = ultimaSerie;
  const logaritmica = $("logScale").checked;

  // En escala logarítmica el cero no se puede dibujar
  const limpiar = datos => datos.map(v => (logaritmica && v <= 0 ? null : v));

  Chart.defaults.font.family = '"IBM Plex Sans", system-ui, sans-serif';
  Chart.defaults.color = "#3d4c66";

  if (chartInstance) chartInstance.destroy();

  const contexto = $("errorChart").getContext("2d");

  chartInstance = new Chart(contexto, {
    type: "line",

    data: {
      labels: serie.x,

      datasets: [
        {
          label: "Float32 directa",
          data: limpiar(serie.f32),
          borderColor: "#b8322c",
          backgroundColor: "#b8322c",
          borderWidth: 2,
          tension: 0.15,
          pointRadius: 2
        },
        {
          label: "Kahan (float32)",
          data: limpiar(serie.kahan),
          borderColor: "#1d4fd7",
          backgroundColor: "#1d4fd7",
          borderWidth: 2,
          tension: 0.15,
          pointRadius: 2
        },
        {
          label: "Float64 directa",
          data: limpiar(serie.f64),
          borderColor: "#5c6b82",
          backgroundColor: "#5c6b82",
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.15,
          pointRadius: 2
        }
      ]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        intersect: false,
        mode: "index"
      },

      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, boxWidth: 8 }
        },

        tooltip: {
          callbacks: {
            label: ctx =>
              ctx.parsed.y === null
                ? `${ctx.dataset.label}: sin error`
                : `${ctx.dataset.label}: ${fmtAuto(ctx.parsed.y)} μs`
          }
        }
      },

      scales: {
        x: {
          title: { display: true, text: "Muestras acumuladas" },
          grid: { display: false }
        },

        y: {
          type: logaritmica ? "logarithmic" : "linear",
          beginAtZero: !logaritmica,
          title: { display: true, text: "Error absoluto (μs)" },
          grid: { color: "#e3e8f0" }
        }
      }
    }
  });

  $("chartVacio").hidden = true;
}

// ========================================
// 10. EJERCICIO: DERIVA DEL RELOJ DE UN CONTROLADOR
// ========================================

const MAX_INTENTOS = 3;
const TOLERANCIA_RELATIVA = 0.005;

let caso = null;

function elegir(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function configurarEjercicio() {
  const contenedor = $("partesEjercicio");

  if (!contenedor) return;

  $("btnNuevoCaso").addEventListener("click", iniciarEjercicio);

  contenedor.addEventListener("click", evento => {
    const boton = evento.target.closest("[data-action]");

    if (!boton) return;

    const i = Number(boton.dataset.i);

    if (boton.dataset.action === "comprobar") comprobar(i);
    if (boton.dataset.action === "pista") alternarPista(i);
    if (boton.dataset.action === "simular") simularRelojFloat32(i);
  });

  contenedor.addEventListener("input", evento => {
    const campo = evento.target.closest("input[data-i]");

    if (campo) caso.partes[Number(campo.dataset.i)].entrada = campo.value;
  });

  contenedor.addEventListener("keydown", evento => {
    const campo = evento.target.closest("input[data-i]");

    if (campo && evento.key === "Enter") {
      evento.preventDefault();
      comprobar(Number(campo.dataset.i));
    }
  });

  iniciarEjercicio();
}

// Genera un caso con datos aleatorios y calcula todas las respuestas esperadas
function crearCaso() {
  const k = elegir([18, 19, 20, 21, 22]);
  const horas = elegir([48, 72, 96, 120]);
  const v = elegir([250, 340, 680, 850]);
  const tolMs = elegir([5, 10, 20]);

  const dt = 0.1;
  const ticks = horas * 3600 * 10;

  // 0.1·2^k = 2^k/10; su parte fraccionaria es (2^k mod 10)/10
  const fraccion = [6, 2, 4, 8][k % 4] / 10;
  const errorTick = fraccion / 2 ** k;
  const errorNs = errorTick * 1e9;
  const deriva = ticks * errorTick;
  const posicion = v * deriva;

  const tau = tolMs / 1000;
  const kMin = Math.floor(Math.log2(ticks / tau)) + 1;

  // Congelamiento en float32: Δt < ½·ulp(t) = 2^(e−24)
  const eCongela = Math.floor(Math.log2(Math.fround(dt) * 2 ** 24)) + 1;
  const tCongela = 2 ** eCongela;
  const dias = tCongela / 86400;

  const p = { k, horas, v, tolMs, dt, ticks, fraccion, errorTick, errorNs, deriva, posicion, tau, kMin, eCongela, tCongela, dias };

  const partes = [
    {
      titulo: "Error de representación de Δt",
      enunciado:
        `<p>¿Qué error absoluto comete el registro al almacenar Δt = 0.1 s truncado a ` +
        `<strong>k = ${k}</strong> bits fraccionarios? Exprésalo en nanosegundos.</p>`,
      unidad: "ns",
      esperado: errorNs,
      decimales: 2,
      tipo: "real",
      pista:
        `El registro guarda ⌊Δt·2<sup>k</sup>⌋ pasos de tamaño 2<sup>−k</sup>. ` +
        `El error es la parte fraccionaria de Δt·2<sup>k</sup>, dividida entre 2<sup>k</sup>.`,
      solucion: [
        { txt: "El registro guarda un número entero de pasos de tamaño 2<sup>−k</sup>; el truncamiento descarta la parte fraccionaria de Δt·2<sup>k</sup>." },
        { tex: `0.1\\cdot 2^{${k}}=${(2 ** k / 10).toFixed(1)}\\;\\Rightarrow\\;\\lfloor 0.1\\cdot 2^{${k}}\\rfloor=${Math.floor(2 ** k / 10)}` },
        { tex: `e_{\\Delta t}=\\frac{${fraccion.toFixed(1)}}{2^{${k}}}=${texSci(errorTick)}\\ \\text{s}=${errorNs.toFixed(2)}\\ \\text{ns}` }
      ]
    },
    {
      titulo: "Deriva acumulada del reloj",
      enunciado:
        `<p>Cada ciclo arrastra ese error y el contador se atrasa un poco más. ¿Cuánto se atrasa el reloj ` +
        `tras <strong>T = ${horas} h</strong> de funcionamiento continuo, a 10 ciclos por segundo? Responde en segundos.</p>`,
      unidad: "s",
      esperado: deriva,
      decimales: 4,
      tipo: "real",
      pista:
        `Primero cuenta los ciclos: horas × 3600 s/h × 10 ciclos/s. Después multiplica por el error de un ciclo ` +
        `(en segundos, no en nanosegundos).`,
      solucion: [
        { tex: `N=T\\cdot 3600\\cdot 10=${horas}\\cdot 36000=${texInt(ticks)}\\ \\text{ciclos}` },
        { tex: `D=N\\cdot e_{\\Delta t}=${texInt(ticks)}\\cdot ${texSci(errorTick)}=${deriva.toFixed(4)}\\ \\text{s}` }
      ]
    },
    {
      titulo: "Propagación al error de posición",
      enunciado:
        `<p>El sistema extrapola la posición del objetivo con ese reloj. Si el objetivo se mueve a ` +
        `<strong>v = ${v} m/s</strong>, ¿qué error de posición produce la deriva del apartado anterior? Responde en metros.</p>`,
      unidad: "m",
      esperado: posicion,
      decimales: 1,
      tipo: "real",
      pista: "El error de posición es la distancia que recorre el objetivo durante el tiempo que el reloj se atrasó: velocidad × deriva.",
      solucion: [
        { tex: `\\Delta x=v\\cdot D=${v}\\cdot ${deriva.toFixed(4)}=${posicion.toFixed(1)}\\ \\text{m}` },
        { txt: "Un error de redondeo diminuto por ciclo se convierte en un error físico apreciable porque se acumula millones de veces y se multiplica por una velocidad alta." }
      ]
    },
    {
      titulo: "Dimensionamiento del registro",
      enunciado:
        `<p>Para <strong>garantizar</strong> una deriva menor que <strong>${tolMs} ms</strong> tras ${horas} h, ` +
        `¿cuántos bits fraccionarios <em>k</em> mínimos necesita el registro? Usa la cota de peor caso del truncamiento, ` +
        `<em>e</em> &lt; 2<sup>−k</sup>, que vale para cualquier Δt.</p>`,
      unidad: "bits",
      esperado: kMin,
      decimales: 0,
      tipo: "entero",
      pista:
        `Exige N·2<sup>−k</sup> &lt; τ y despeja k con logaritmo en base 2. Como la desigualdad es estricta, ` +
        `k debe ser el menor entero mayor que log<sub>2</sub>(N/τ).`,
      solucion: [
        { txt: "Con truncamiento el error por ciclo es menor que un paso completo, así que la deriva máxima garantizada es N·2<sup>−k</sup>." },
        { tex: `N\\cdot 2^{-k}<\\tau\\;\\Rightarrow\\;k>\\log_2\\frac{N}{\\tau}=\\log_2\\frac{${texInt(ticks)}}{${tau}}=${Math.log2(ticks / tau).toFixed(2)}` },
        { tex: `k_{\\min}=${kMin}\\ \\text{bits}` },
        { txt: "Para Δt = 0.1 s el error real puede ser menor que la cota, pero la cota es la que asegura el requisito sin depender del valor concreto de Δt." }
      ]
    },
    {
      titulo: "El mismo reloj en float32",
      enunciado:
        `<p>Un equipo alternativo acumula <em>t</em> ← <em>t</em> + Δt en <strong>float32</strong>, con Δt = 0.1 s y sin reiniciarse. ` +
        `Llega un momento en que <em>t</em> + Δt = <em>t</em> y el reloj se congela. ¿Qué lectura marca el reloj en ese instante? Responde en días.</p>`,
      unidad: "días",
      esperado: dias,
      decimales: 2,
      tipo: "real",
      pista:
        `En float32, ulp(t) = 2<sup>e−23</sup> cuando 2<sup>e</sup> ≤ t &lt; 2<sup>e+1</sup>. El reloj se congela cuando Δt es ` +
        `menor que la mitad del ulp. Busca el menor exponente e que lo cumple y pásalo a días (86 400 s).`,
      solucion: [
        { tex: `\\mathrm{ulp}(t)=2^{e-23}\\quad\\text{y se congela si}\\quad \\Delta t<\\tfrac12\\mathrm{ulp}(t)=2^{e-24}` },
        { tex: `2^{e}>\\Delta t\\cdot 2^{24}=0.1\\cdot 2^{24}=1677721.6\\;\\Rightarrow\\;e\\ge ${eCongela}` },
        { tex: `t^{*}=2^{${eCongela}}\\ \\text{s}=${texInt(tCongela)}\\ \\text{s}=${dias.toFixed(2)}\\ \\text{días}` }
      ],
      simulable: true
    }
  ];

  partes.forEach(parte => {
    parte.estado = "bloqueada";
    parte.intentos = 0;
    parte.entrada = "";
    parte.feedback = null;
    parte.pistaVisible = false;
    parte.simulacion = null;
  });

  partes[0].estado = "activa";

  return { p, partes };
}

function iniciarEjercicio() {
  caso = crearCaso();

  renderEscenario();

  const lista = $("partesEjercicio");
  lista.innerHTML = "";

  caso.partes.forEach((_, i) => {
    const li = document.createElement("li");
    li.id = "paso-" + i;
    lista.appendChild(li);
    renderParte(i);
  });

  $("resumenEjercicio").hidden = true;
  renderProgreso();
}

function renderEscenario() {
  const { k, horas, v, tolMs } = caso.p;

  $("escenarioEjercicio").innerHTML = `
    <h3>Deriva del reloj de un controlador digital</h3>
    <p>
      Un controlador de seguimiento mide el tiempo contando ciclos de Δt = 0.1 s (10 Hz). Para ahorrar hardware,
      Δt se guarda en un registro de punto fijo con <strong>k bits fraccionarios</strong> y se obtiene por
      <strong>truncamiento</strong>: los bits sobrantes se descartan. En cada ciclo el contador suma el valor almacenado.
      El equipo trabaja sin reiniciarse y sigue un objetivo en movimiento.
    </p>
    <dl class="givens">
      <div><dt>Periodo de ciclo</dt><dd>Δt = 0.1 s</dd></div>
      <div><dt>Bits fraccionarios</dt><dd>k = ${k}</dd></div>
      <div><dt>Operación continua</dt><dd>T = ${horas} h</dd></div>
      <div><dt>Velocidad del objetivo</dt><dd>v = ${v} m/s</dd></div>
      <div><dt>Deriva admisible</dt><dd>${tolMs} ms</dd></div>
    </dl>`;
}

function renderProgreso() {
  const resueltas = caso.partes.filter(p => p.estado === "correcta" || p.estado === "fallida").length;
  const total = caso.partes.length;

  $("barraProgresoRelleno").style.width = (resueltas / total) * 100 + "%";
  $("barraProgreso").setAttribute("aria-valuenow", resueltas);
  $("progresoTexto").textContent = `${resueltas} de ${total} apartados`;

  if (resueltas === total) renderResumen();
}

function renderResumen() {
  const correctas = caso.partes.filter(p => p.estado === "correcta").length;
  const primera = caso.partes.filter(p => p.estado === "correcta" && p.intentos === 1).length;
  const total = caso.partes.length;

  let comentario;

  if (correctas === total) {
    comentario = "Dominas el hilo completo: representación, acumulación, propagación y dimensionamiento.";
  } else if (correctas >= 3) {
    comentario = "Buen resultado. Repasa los apartados marcados en rojo y pulsa «Nuevo caso» para practicar con otros datos.";
  } else {
    comentario = "Revisa el desarrollo de cada apartado y la teoría sobre error absoluto y coma flotante; después prueba con un caso nuevo.";
  }

  const caja = $("resumenEjercicio");

  caja.innerHTML = `
    <h3>Resultado</h3>
    <p>Resolviste <strong>${correctas} de ${total}</strong> apartados, ${primera} de ellos al primer intento.</p>
    <p>${comentario}</p>`;

  caja.hidden = false;
}

function marcadorParte(parte, i) {
  if (parte.estado === "bloqueada") return '<i class="bi bi-lock-fill"></i>';
  if (parte.estado === "correcta") return '<i class="bi bi-check-lg"></i>';
  if (parte.estado === "fallida") return '<i class="bi bi-x-lg"></i>';

  return String(i + 1);
}

function renderParte(i) {
  const parte = caso.partes[i];
  const li = $("paso-" + i);

  const claseEstado = {
    bloqueada: "is-locked",
    activa: "is-active",
    correcta: "is-correct",
    fallida: "is-failed"
  }[parte.estado];

  li.className = "step " + claseEstado;

  let html = `<div class="step-marker" aria-hidden="true">${marcadorParte(parte, i)}</div><div class="step-body">`;

  html += `<h3 class="step-title">${parte.titulo}</h3>`;

  if (parte.estado === "bloqueada") {
    html += `<p class="step-text mb-0">Se desbloquea al terminar el apartado anterior.</p></div>`;
    li.innerHTML = html;
    return;
  }

  html += `<div class="step-text">${parte.enunciado}</div>`;

  if (parte.estado === "activa") {
    html += `
      <div class="step-form">
        <label class="visually-hidden" for="resp-${i}">Respuesta del apartado ${i + 1}</label>
        <div class="input-group">
          <input id="resp-${i}" data-i="${i}" type="text" inputmode="decimal" autocomplete="off"
                 class="form-control" placeholder="Tu respuesta" value="${parte.entrada.replace(/"/g, "&quot;")}">
          <span class="input-group-text">${parte.unidad}</span>
          <button type="button" class="btn btn-primary" data-action="comprobar" data-i="${i}">Comprobar</button>
        </div>
        <div class="step-meta">
          <span>Intentos restantes: ${MAX_INTENTOS - parte.intentos} de ${MAX_INTENTOS}</span>
          <button type="button" class="link-button" data-action="pista" data-i="${i}">
            ${parte.pistaVisible ? "Ocultar pista" : "Ver pista"}
          </button>
        </div>
      </div>`;
  }

  if (parte.feedback) {
    html += `<div class="step-feedback ${parte.feedback.clase}" role="status">${parte.feedback.texto}</div>`;
  }

  if (parte.pistaVisible && parte.estado === "activa") {
    html += `<div class="step-hint"><strong>Pista:</strong> ${parte.pista}</div>`;
  }

  if (parte.estado === "correcta" || parte.estado === "fallida") {
    html += `<div class="step-solution math-box"><h4>Desarrollo</h4>`;

    parte.solucion.forEach((linea, j) => {
      if (linea.tex) html += `<div class="sol-tex" data-i="${i}" data-j="${j}"></div>`;
      else html += `<p class="sol-text">${linea.txt}</p>`;
    });

    html += `</div>`;

    if (parte.simulable) {
      html += `
        <div class="sim-box">
          <button type="button" class="btn btn-outline-primary btn-sm" data-action="simular" data-i="${i}">
            <i class="bi bi-play-fill me-1" aria-hidden="true"></i>Verificar con simulación
          </button>
          <p class="sim-output" id="sim-${i}" aria-live="polite">${parte.simulacion || ""}</p>
        </div>`;
    }
  }

  html += `</div>`;

  li.innerHTML = html;

  // Fórmulas de la solución
  li.querySelectorAll(".sol-tex").forEach(elemento => {
    const linea = caso.partes[Number(elemento.dataset.i)].solucion[Number(elemento.dataset.j)];

    if (typeof katex !== "undefined") {
      katex.render(linea.tex, elemento, { throwOnError: false, displayMode: true });
    } else {
      elemento.textContent = linea.tex;
    }
  });
}

function alternarPista(i) {
  caso.partes[i].pistaVisible = !caso.partes[i].pistaVisible;
  renderParte(i);

  const campo = $("resp-" + i);
  if (campo) campo.focus();
}

// Detecta si el valor del estudiante coincide con el correcto en otra unidad
function detectarOtraUnidad(valor, esperado) {
  const factores = [1e3, 1e-3, 1e6, 1e-6, 1e9, 1e-9, 24, 1 / 24, 3600, 1 / 3600, 86400, 1 / 86400];

  return factores.some(f => Math.abs(valor * f - esperado) / Math.abs(esperado) < 0.01);
}

function comprobar(i) {
  const parte = caso.partes[i];

  if (parte.estado !== "activa") return;

  const texto = parte.entrada.trim().replace(/\s/g, "").replace(",", ".");

  if (texto === "") {
    parte.feedback = { clase: "fb-warn", texto: "Escribe tu respuesta numérica antes de comprobar." };
    renderParte(i);
    $("resp-" + i).focus();
    return;
  }

  const valor = Number(texto);

  if (!Number.isFinite(valor)) {
    parte.feedback = { clase: "fb-warn", texto: "Escribe un número válido, por ejemplo 12.5 o 1.2e-6." };
    renderParte(i);
    $("resp-" + i).focus();
    return;
  }

  parte.intentos++;

  const acierto = parte.tipo === "entero"
    ? valor === parte.esperado
    : Math.abs(valor - parte.esperado) / Math.abs(parte.esperado) <= TOLERANCIA_RELATIVA;

  const respuestaTexto =
    parte.esperado.toLocaleString("es-PE", { minimumFractionDigits: parte.decimales, maximumFractionDigits: parte.decimales }) +
    " " + parte.unidad;

  if (acierto) {
    parte.estado = "correcta";
    parte.feedback = {
      clase: "fb-ok",
      texto: parte.intentos === 1
        ? "Correcto, a la primera."
        : `Correcto, en ${parte.intentos} intentos.`
    };

    desbloquearSiguiente(i);
    renderParte(i);
    renderProgreso();
    return;
  }

  if (parte.intentos >= MAX_INTENTOS) {
    parte.estado = "fallida";
    parte.feedback = {
      clase: "fb-bad",
      texto: `Agotaste los intentos. La respuesta era <strong>${respuestaTexto}</strong>; revisa el desarrollo.`
    };

    desbloquearSiguiente(i);
    renderParte(i);
    renderProgreso();
    return;
  }

  // Intento fallido con orientación según el tipo de error
  let ayuda = "No coincide.";

  if (parte.tipo === "entero" && !Number.isInteger(valor)) {
    ayuda = "No coincide: el número de bits debe ser entero.";
  } else if (parte.tipo === "entero" && Math.abs(valor - parte.esperado) === 1) {
    ayuda = "Casi. Revisa si la desigualdad es estricta y si debes redondear hacia arriba.";
  } else if (detectarOtraUnidad(valor, parte.esperado)) {
    ayuda = `Tu cifra parece correcta pero en otra unidad. Responde en ${parte.unidad}.`;
  } else if (parte.tipo === "real" && Math.abs(valor - parte.esperado) / Math.abs(parte.esperado) < 0.05) {
    ayuda = "Estás cerca. Revisa el redondeo de los pasos intermedios; conviene arrastrar más cifras.";
  }

  parte.feedback = { clase: "fb-bad", texto: ayuda };

  renderParte(i);
  $("resp-" + i).focus();
}

function desbloquearSiguiente(i) {
  const siguiente = caso.partes[i + 1];

  if (siguiente && siguiente.estado === "bloqueada") {
    siguiente.estado = "activa";
    renderParte(i + 1);
  }
}

// Simula el reloj float32 con Δt = 0.1 s hasta que se congela
function simularRelojFloat32(i) {
  const dt = Math.fround(0.1);
  const limite = 200000000;

  let t = 0;
  let pasos = 0;

  while (pasos < limite) {
    const siguiente = Math.fround(t + dt);

    if (siguiente === t) break;

    t = siguiente;
    pasos++;
  }

  const diasReloj = t / 86400;
  const diasReales = (pasos * 0.1) / 86400;
  const adelanto = diasReloj - diasReales;

  const parte = caso.partes[i];

  parte.simulacion =
    `El reloj se congeló en <strong>t = ${t.toLocaleString("es-PE")} s</strong> (${diasReloj.toFixed(2)} días) ` +
    `tras ${pasos.toLocaleString("es-PE")} ciclos. En tiempo real esos ciclos duran ${diasReales.toFixed(2)} días, ` +
    `así que antes de congelarse el reloj ya iba <strong>${adelanto.toFixed(2)} días adelantado</strong>. ` +
    `El motivo es el redondeo de cada suma: entre 2<sup>19</sup> s y 2<sup>21</sup> s el reloj avanza 0.125 s por ciclo en lugar de 0.1 s.`;

  const salida = $("sim-" + i);
  if (salida) salida.innerHTML = parte.simulacion;
}

// ========================================
// 11. FORMULARIO DE CONTACTO
// ========================================

function configurarFormulario() {
  const formulario = $("contactForm");
  const feedback = $("contactFeedback");

  if (!formulario || !feedback) return;

  formulario.addEventListener("submit", evento => {
    evento.preventDefault();

    const nombre = $("contactName").value.trim();
    const correo = $("contactEmail").value.trim();
    const asunto = $("contactSubject").value.trim();
    const mensaje = $("contactMessage").value.trim();

    const cuerpo = `${mensaje}\n\n— ${nombre} (${correo})`;

    // Sin servidor propio, el mensaje se redacta en el cliente de correo de la persona
    window.location.href =
      "mailto:ingenieria@metodosnumericos.edu" +
      "?subject=" + encodeURIComponent("[Métodos Numéricos] " + asunto) +
      "&body=" + encodeURIComponent(cuerpo);

    feedback.textContent = "Se abrió tu aplicación de correo con el mensaje listo para enviar.";
    feedback.className = "is-ok";
  });
}