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
  inicializarTestTeorico();
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
// 10. EJERCICIOS AUTÓNOMOS E INDEPENDIENTES
// ========================================

const TOLERANCIA_RELATIVA = 0.01;

let ejercicios = [];
let ejercicioActivo = 0; // 0: Cancelación en Latencias, 1: Raíz Cuadrática
let guiaActiva = null;

function elegir(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function configurarEjercicio() {
  const contenedor = $("preguntasContainer");
  const selector = $("selectorEjercicios");

  if (!contenedor) return;

  contenedor.addEventListener("click", evento => {
    if (evento.target.closest("[data-guide-action='close']")) cerrarGuiaInteractiva();
    if (evento.target.closest("[data-guide-action='check']")) comprobarPasoGuia();
    if (evento.target.closest("[data-guide-action='next']")) avanzarPasoGuia();
    if (evento.target.closest("[data-guide-action='reveal']")) revelarPasoGuia();
    const opcion = evento.target.closest("[data-guide-option]");
    if (opcion && guiaActiva) {
      guiaActiva.valor = opcion.dataset.guideOption;
      guiaActiva.feedback = null;
      renderizarPanelGuia();
    }
  });
  contenedor.addEventListener("input", evento => {
    if (evento.target.matches("[data-guide-answer]") && guiaActiva) {
      guiaActiva.valor = evento.target.value;
      guiaActiva.feedback = null;
    }
  });
  contenedor.addEventListener("keydown", evento => {
    if (evento.key === "Enter" && evento.target.matches("[data-guide-answer]")) {
      evento.preventDefault();
      comprobarPasoGuia();
    }
  });

  $("btnNuevoCaso").addEventListener("click", () => {
    cerrarGuiaInteractiva();
    inicializarEjercicios();
    renderizarEjercicioActual();
  });

  if (selector) {
    selector.addEventListener("click", evento => {
      const boton = evento.target.closest("[data-ej-i]");
      if (!boton) return;
      cambiarEjercicio(Number(boton.dataset.ejI));
    });
  }

  // Delegación de eventos para las preguntas
  contenedor.addEventListener("click", evento => {
    const boton = evento.target.closest("[data-action]");
    if (!boton) return;

    const pIdx = Number(boton.dataset.p);
    const accion = boton.dataset.action;

    if (accion === "comprobar") comprobarRespuesta(pIdx);
    if (accion === "pista") alternarPista(pIdx);
    if (accion === "toggle-solucion") alternarSolucion(pIdx);
    if (accion === "guia-interactiva") abrirGuiaInteractiva(pIdx);
  });

  contenedor.addEventListener("change", evento => {
    const select = evento.target.closest("select[data-action='seleccionar-metodo']");
    if (!select) return;

    const pIdx = Number(select.dataset.p);
    seleccionarMetodo(pIdx, select.value);
  });

  contenedor.addEventListener("input", evento => {
    const campo = evento.target.closest("input[data-p]");
    if (campo) {
      const pIdx = Number(campo.dataset.p);
      ejercicios[ejercicioActivo].preguntas[pIdx].entrada = campo.value;
    }
  });

  contenedor.addEventListener("keydown", evento => {
    const campo = evento.target.closest("input[data-p]");
    if (campo && evento.key === "Enter") {
      evento.preventDefault();
      comprobarRespuesta(Number(campo.dataset.p));
    }
  });

  inicializarEjercicios();
  renderizarEjercicioActual();
}

function inicializarEjercicios() {
  ejercicios = generarDatosEjercicios();
}

function cambiarEjercicio(idx) {
  cerrarGuiaInteractiva();
  ejercicioActivo = idx;
  const botones = document.querySelectorAll("#selectorEjercicios button");
  botones.forEach((btn, i) => {
    if (i === idx) {
      btn.className = "btn btn-primary";
    } else {
      btn.className = "btn btn-outline-primary";
    }
  });
  renderizarEjercicioActual();
}

// Genera datos aleatorios independientes para cada uno de los 2 ejercicios
function generarDatosEjercicios() {
  // EJERCICIO 1: Cancelación al medir latencia pequeña (Ejemplo 1 de la Guía)
  const t1 = elegir([1000000.0, 2000000.0, 4000000.0]); // s
  const delta = elegir([0.05, 0.1, 0.15, 0.2]); // s
  const t2 = t1 + delta;

  const t1_32 = Math.fround(t1);
  const t2_32 = Math.fround(t2);
  const diff_32 = Math.fround(t2_32 - t1_32);
  const errAbs = Math.abs(diff_32 - delta);
  const errRelPct = (errAbs / delta) * 100;

  // Exponente y ulp de t1
  const exp_t1 = Math.floor(Math.log2(t1));
  const ulp_t1 = 2 ** (exp_t1 - 23);

  // EJERCICIO 2: Raíz pequeña de una cuadrática (Ejemplo 2 de la Guía)
  const b = elegir([10000000.0, 20000000.0, 50000000.0, 100000000.0]); // 10^7 a 10^8
  const c = elegir([1.0, 2.0, 4.0]);
  const x1_aprox = b;
  const x2_exacto = c / b;

  const lista = [
    {
      id: "ej1",
      titulo: "Ejercicio 1: Cancelación Catastrófica en Medición de Latencias de Red",
      icono: "bi-speedometer2",
      badge: "Ejemplo 1 de la Guía Oficial",
      contexto: `
        <h3>Cancelación al medir latencias de red en un servidor</h3>
        <p>Un sistema de telemetría registra marcas de tiempo en segundos para auditar el SLA de un servicio web.
        Se capturan dos eventos consecutivos: <strong>t₁ = ${t1.toLocaleString("es-PE")} s</strong> y <strong>t₂ = ${t2.toLocaleString("es-PE", { minimumFractionDigits: 2 })} s</strong>.
        La latencia real exacta entre ambos eventos es <strong>Δt = t₂ − t₁ = ${delta} s</strong>.</p>
        <p class="mb-0 text-secondary small">En float32 (24 bits de precisión), el espaciado alrededor de ${t1.toLocaleString("es-PE")} s es grande, por lo que <code>t₂</code> se aproxima a <code>${t2_32.toFixed(3)} s</code> y la resta directa arroja <code>fl(Δt) = ${diff_32.toFixed(3)} s</code>.</p>
        <dl class="givens mt-3">
          <div><dt>Marca de inicio</dt><dd>t₁ = ${t1.toLocaleString("es-PE")} s</dd></div>
          <div><dt>Marca final</dt><dd>t₂ = ${t2.toLocaleString("es-PE", { minimumFractionDigits: 2 })} s</dd></div>
          <div><dt>Latencia exacta</dt><dd>Δt = ${delta} s</dd></div>
          <div><dt>Resta float32</dt><dd>fl(Δt) = ${diff_32.toFixed(3)} s</dd></div>
        </dl>
      `,
      preguntas: [
        {
          id: "p1_1",
          numero: "Pregunta 1.1 ",
          titulo: "Cálculo del error relativo porcentual por resta directa",
          enunciado: `
            <p>Con los datos del escenario: latencia exacta <strong>Δt = ${delta} s</strong> y latencia calculada directamente en float32 <strong>fl(Δt) = ${diff_32.toFixed(3)} s</strong>.
            ¿Cuál es el <strong>error relativo porcentual (%)</strong> que comete la resta directa debido a la cancelación catastrófica?</p>
          `,
          unidad: "%",
          esperado: errRelPct,
          decimales: 2,
          tipo: "real",
          metodoOpciones: [
            {
              id: "directa",
              nombre: "A) Resta directa de marcas de tiempo absolutas: fl(t₂) − fl(t₁)",
              esOptimo: false,
              analisis: "⚠️ <strong>Cancelación Catastrófica:</strong> Al restar dos magnitudes casi idénticas del orden de 10⁶ s con float32, se cancelan los dígitos más significativos y los bits restantes son únicamente ruido de redondeo. ¡El error relativo se dispara al 25% o más!",
              recomendacion: "El método más apropiado es el <strong>Centrado de Marcas de Tiempo (B)</strong> o el uso de enteros de microsegundos, reduciendo el error relativo prácticamente a 0%."
            },
            {
              id: "centrado",
              nombre: "B) Centrado previo de datos respecto a una base: τ = t − t₀",
              esOptimo: true,
              analisis: "✅ <strong>¡Método recomendado por la guía!</strong> Al restar una base entera común t₀ antes del cálculo en float32, la latencia se almacena cerca de cero, donde float32 posee su máxima resolución y no sufre cancelación.",
              recomendacion: "Es la solución estándar de ingeniería de sistemas para telemetría de alta resolución."
            }
          ],
          pista: `Aplica la fórmula clásica de error relativo: Er = |Valor Real − Valor Calculado| / |Valor Real|. Para expresarlo en porcentaje (εt), multiplica el resultado por 100: |${delta} − ${diff_32.toFixed(3)}| / ${delta} × 100.`,
          guiaInteractiva: {
            final: `El error relativo porcentual de esta resta directa es ${errRelPct.toFixed(2)}%. Para futuras mediciones, el método apropiado es centrar las marcas de tiempo (restarlas de una base común antes de convertirlas a float32) o almacenar ticks enteros; así se evita restar números absolutos casi iguales.`,
            pasos: [
              { tipo: "seleccion", enunciado: "Antes del porcentaje, ¿qué magnitud calculamos primero?", opciones: [{ valor: "abs", texto: "Error absoluto entre la latencia real y la calculada" }, { valor: "ulp", texto: "El ulp de la latencia" }, { valor: "base", texto: "El valor de la marca de tiempo inicial" }], correcto: ["abs"], pista: "Compara primero Δt exacta con fl(Δt); el porcentaje se calcula después.", explicacion: `Eₐ = |${delta} − ${diff_32.toFixed(3)}| = ${errAbs.toFixed(4)} s. Esta diferencia conserva unidades de segundos.` },
              { tipo: "numero", etiqueta: "Error relativo porcentual", unidad: "%", enunciado: "Divide el error absoluto entre la latencia exacta y multiplica por 100.", correcto: errRelPct, pista: `Usa Eₐ / |Δt| × 100, con Eₐ = ${errAbs.toFixed(4)} s y Δt = ${delta} s.`, explicacion: `εₜ = (${errAbs.toFixed(4)} / ${delta}) × 100% = ${errRelPct.toFixed(2)}%.` },
              { tipo: "seleccion", enunciado: "¿Qué estrategia evita mejor la cancelación al calcular latencias pequeñas?", opciones: [{ valor: "directa", texto: "Seguir restando las marcas absolutas directamente en float32" }, { valor: "centrado", texto: "Centrar las marcas con una base común o guardar ticks enteros" }], correcto: ["centrado"], pista: "Busca que la resta ocurra cerca de cero o representa el tiempo como un contador exacto.", explicacion: "Al centrar primero, los datos operan en una escala pequeña y se conservan más bits útiles. Para este problema, centrar las marcas o usar enteros de tiempo es más apropiado que la resta directa." }
            ]
          },
          solucion: [
            { txt: "1. Calculamos el error absoluto cometido por la resta directa en float32:" },
            { tex: `E_a = |\\Delta t - \\text{fl}(\\Delta t)| = |${delta} - ${diff_32.toFixed(3)}| = ${errAbs.toFixed(4)}\\ \\text{s}` },
            { txt: "2. Dividimos entre el valor real exacto y multiplicamos por 100 para obtener el porcentaje:" },
            { tex: `\\varepsilon_t = \\frac{E_a}{|\\Delta t|} \\times 100\\% = \\frac{${errAbs.toFixed(4)}}{${delta}} \\times 100\\% = ${errRelPct.toFixed(2)}\\%` },
            { txt: `Resultado: Una diferencia aparentemente pequeña produce un error relativo inaceptable del ${errRelPct.toFixed(2)}% debido a la escala del dato base.` }
          ]
        },
        {
          id: "p1_2",
          numero: "Pregunta 1.2 ",
          titulo: "Espaciado de máquina (ulp) alrededor de la base t₁",
          enunciado: `
            <p>La precisión en coma flotante no es continua: depende del espaciado entre números representables consecutivos (<code>ulp</code>).
            Para la base <strong>t₁ = ${t1.toLocaleString("es-PE")} s</strong> (cuyo exponente binario es <code>e = ${exp_t1}</code> pues <code>2^${exp_t1} ≤ t₁ < 2^${exp_t1 + 1}</code>),
            ¿cuál es el espaciado <strong>ulp(t₁) = 2^(e−23)</strong> en float32? Expresa tu resultado en segundos.</p>
          `,
          unidad: "s",
          esperado: ulp_t1,
          decimales: 4,
          tipo: "real",
          metodoOpciones: [
            {
              id: "resta_empirica",
              nombre: "A) Estimación por diferencia empírica entre dos números de prueba",
              esOptimo: false,
              analisis: "⚠️ <strong>Aproximación empírica:</strong> Depende de que los números elegidos caigan en el mismo intervalo binario y puede verse afectada por redondeos intermedios.",
              recomendacion: "El método más apropiado es el <strong>Cálculo Analítico del Estándar IEEE 754 (B)</strong> mediante la fórmula cerrada ulp = 2^(e−23)."
            },
            {
              id: "formula_ulp",
              nombre: "B) Fórmula analítica del estándar IEEE 754: ulp(x) = 2^(e−23)",
              esOptimo: true,
              analisis: "✅ <strong>¡Método riguroso y exacto!</strong> Determina con exactitud de hardware la distancia discreta mínima representable para esa potencia de dos.",
              recomendacion: "Permite diagnosticar exactamente cuándo una fluctuación será absorbida por el hardware."
            }
          ],
          pista: `En float32 (23 bits fraccionarios + 1 bit implícito = 24 bits), ulp = 2^(e−23). Para e = ${exp_t1}, calcula 2^(${exp_t1} − 23) = 2^(${exp_t1 - 23}). Por ejemplo, 2^(−4) = 0.0625 s.`,
          guiaInteractiva: {
            final: `Alrededor de t₁ = ${t1.toLocaleString("es-PE")} s, el espaciado float32 es ulp = ${ulp_t1} s. Un incremento menor que la mitad de este valor puede desaparecer al sumarse.`,
            pasos: [
              { tipo: "seleccion", enunciado: "¿En qué intervalo de potencias de 2 cae t₁?", opciones: [{ valor: String(exp_t1 - 1), texto: `[2^${exp_t1 - 1}, 2^${exp_t1})` }, { valor: String(exp_t1), texto: `[2^${exp_t1}, 2^${exp_t1 + 1})` }, { valor: String(exp_t1 + 1), texto: `[2^${exp_t1 + 1}, 2^${exp_t1 + 2})` }], correcto: [String(exp_t1)], pista: `Busca el e que cumple 2^e ≤ ${t1} < 2^(e+1).`, explicacion: `Como 2^${exp_t1} ≤ ${t1.toLocaleString("es-PE")} < 2^${exp_t1 + 1}, el exponente es e = ${exp_t1}.` },
              { tipo: "numero", etiqueta: "Exponente de ulp", unidad: "exponente", enunciado: "En float32, ulp(x) = 2^(e−23). ¿Qué exponente queda al sustituir e?", correcto: exp_t1 - 23, pista: `Sustituye e = ${exp_t1} en e − 23 y conserva el signo.`, explicacion: `e − 23 = ${exp_t1} − 23 = ${exp_t1 - 23}. Por tanto, ulp(t₁) = 2^${exp_t1 - 23}.` },
              { tipo: "numero", etiqueta: "Espaciado ulp", unidad: "s", enunciado: `Calcula 2^${exp_t1 - 23} en segundos.`, correcto: ulp_t1, pista: "Evalúa la potencia de dos del paso anterior. Si el exponente es negativo, el resultado es menor que 1.", explicacion: `ulp(t₁) = 2^(${exp_t1}−23) = 2^${exp_t1 - 23} = ${ulp_t1} s. El umbral de absorción para redondeo al más cercano es aproximadamente ½·ulp = ${(ulp_t1 / 2).toPrecision(4)} s.` }
            ]
          },
          solucion: [
            { txt: `1. Identificamos el intervalo de potencias de 2 en el que se ubica t₁ = ${t1.toLocaleString("es-PE")}:` },
            { tex: `2^{${exp_t1}} = ${texInt(2 ** exp_t1)} \\le ${texInt(t1)} < 2^{${exp_t1 + 1}} = ${texInt(2 ** (exp_t1 + 1))} \\implies e = ${exp_t1}` },
            { txt: "2. Evaluamos la fórmula del ulp para coma flotante simple (float32):" },
            { tex: `\\text{ulp}(t_1) = 2^{e-23} = 2^{${exp_t1} - 23} = 2^{${exp_t1 - 23}} = ${ulp_t1}\\ \\text{s}` },
            { txt: `Interpretación: Cualquier incremento menor a la mitad del ulp (${(ulp_t1 / 2).toFixed(5)} s) se redondea a cero (absorción completa).` }
          ]
        }
      ]
    },
    {
      id: "ej2",
      titulo: "Ejercicio 2: Raíz Pequeña de una Cuadrática y Reformulación Algebraica",
      icono: "bi-calculator",
      badge: "Ejemplo 2 de la Guía Oficial",
      contexto: `
        <h3>Raíz pequeña de una cuadrática sin pérdida de significancia</h3>
        <p>En el modelado dinámico de buffers se obtiene la ecuación cuadrática <strong>x² − bx + c = 0</strong> con 
        <strong>b = ${b.toLocaleString("es-PE")}</strong> y <strong>c = ${c}</strong>.
        Esta ecuación posee dos raíces reales positivas: una raíz grande <code>x₁</code> y una raíz extremadamente pequeña <code>x₂</code>.</p>
        <p class="mb-0 text-secondary small">Al calcular <code>x₂</code> con la fórmula general clásica, se resta <code>b − √(b² − 4c)</code>. Como <code>b² ≫ 4c</code>, la raíz cuadrada da aproximadamente <code>b</code> y la resta directa produce <strong>0</strong> por cancelación catastrófica.</p>
        <dl class="givens mt-3">
          <div><dt>Coeficiente lineal</dt><dd>b = ${b.toLocaleString("es-PE")}</dd></div>
          <div><dt>Término independiente</dt><dd>c = ${c}</dd></div>
          <div><dt>Ecuación cuadrática</dt><dd>x² − (${b.toLocaleString("es-PE")})x + ${c} = 0</dd></div>
          <div><dt>Fórmula estándar</dt><dd>x = [b ± √(b² − 4c)] / 2</dd></div>
        </dl>
      `,
      preguntas: [
        {
          id: "p2_1",
          numero: "Pregunta 2.1 ",
          titulo: "Valor asintótico de la raíz mayor x₁",
          enunciado: `
            <p>Para la ecuación <strong>x² − (${b.toLocaleString("es-PE")})x + ${c} = 0</strong>, analiza la raíz mayor dada por la fórmula general:
            <strong>x₁ = [b + √(b² − 4c)] / 2</strong>.
            Dado que <code>b² = ${(b ** 2).toExponential(0)}</code> es órdenes de magnitud superior a <code>4c = ${4 * c}</code>, la raíz cuadrada es indistinguible de <code>b</code>.
            ¿A qué valor equivale aproximadamente la raíz mayor <strong>x₁</strong>?</p>
          `,
          unidad: "unidades",
          esperado: x1_aprox,
          decimales: 0,
          tipo: "real",
          metodoOpciones: [
            {
              id: "suma_directa",
              nombre: "A) Suma estándar en la fórmula cuadrática: [b + √(b² − 4c)] / 2",
              esOptimo: true,
              analisis: "✅ <strong>¡Método numéricamente estable para x₁!</strong> Al sumar dos cantidades positivas de magnitudes similares (b + b), no existe resta destructiva ni cancelación. El resultado es totalmente confiable.",
              recomendacion: "La fórmula estándar es perfectamente válida para la raíz del mismo signo que b."
            },
            {
              id: "aproximacion",
              nombre: "B) Aproximación asintótica de primer orden: x₁ ≈ b",
              esOptimo: true,
              analisis: "✅ <strong>¡Correcto analíticamente!</strong> Demuestra que el término dominante b absorbe el efecto de c en la raíz grande.",
              recomendacion: "Permite simplificar cálculos analíticos sin pérdida perceptible de exactitud."
            }
          ],
          pista: `Como b² − 4c ≈ b², la raíz cuadrada da prácticamente b. Entonces x₁ ≈ (b + b) / 2 = 2b / 2 = b. Sustituye el valor de b: ${b.toLocaleString("es-PE")}.`,
          guiaInteractiva: {
            final: `La raíz grande es aproximadamente x₁ ≈ ${b.toLocaleString("es-PE")}. La fórmula estándar es estable para esta raíz porque suma dos cantidades positivas; la cancelación afecta principalmente a la raíz pequeña.`,
            pasos: [
              { tipo: "seleccion", enunciado: "Dado que b² ≫ 4c, ¿a qué se aproxima √(b²−4c)?", opciones: [{ valor: "b", texto: "A b, porque 4c es diminuto frente a b²" }, { valor: "c", texto: "A c" }, { valor: "cero", texto: "A cero" }], correcto: ["b"], pista: `Compara b² = ${(b ** 2).toExponential(0)} con 4c = ${4 * c}. El término 4c apenas cambia el radicando relativo a b².`, explicacion: "Como 4c es insignificante frente a b², √(b²−4c) ≈ √(b²) = b, ya que b es positivo." },
              { tipo: "numero", etiqueta: "Raíz mayor aproximada", unidad: "unidades", enunciado: "Sustituye esa aproximación en x₁ = [b + √(b²−4c)]/2.", correcto: x1_aprox, pista: `Con √(b²−4c) ≈ b, calcula (b+b)/2. Aquí b = ${b.toLocaleString("es-PE")}.`, explicacion: `x₁ ≈ (b+b)/2 = b = ${b.toLocaleString("es-PE")}.` },
              { tipo: "seleccion", enunciado: "¿Por qué la fórmula estándar funciona bien para esta raíz grande?", opciones: [{ valor: "suma", texto: "Suma dos cantidades positivas similares, sin resta destructiva" }, { valor: "resta", texto: "Resta dos cantidades casi iguales" }], correcto: ["suma"], pista: "Mira el signo ±: para la raíz grande se usa el signo más.", explicacion: "La cancelación aparece al restar cantidades casi iguales. Para la raíz grande se suman b y una cantidad cercana a b, así que la fórmula estándar es apropiada." }
            ]
          },
          solucion: [
            { txt: `1. Evaluamos el radicando con b = ${b.toLocaleString("es-PE")} y c = ${c}:` },
            { tex: `b^2 - 4ac = (${texSci(b)})^2 - 4(1)(${c}) = ${texSci(b ** 2)} - ${4 * c} \\approx ${texSci(b ** 2)}` },
            { txt: "2. Calculamos la raíz cuadrada y evaluamos la raíz positiva:" },
            { tex: `\\sqrt{b^2 - 4ac} \\approx b = ${texSci(b)}` },
            { tex: `x_1 = \\frac{b + \\sqrt{b^2 - 4ac}}{2} \\approx \\frac{${texSci(b)} + ${texSci(b)}}{2} = ${texSci(b)}` },
            { txt: `Conclusión: La raíz mayor x₁ es numéricamente igual a ${b.toLocaleString("es-PE")}.` }
          ]
        },
        {
          id: "p2_2",
          numero: "Pregunta 2.2",
          titulo: "Raíz pequeña exacta mediante reformulación algebraica",
          enunciado: `
            <p>Para evitar que la raíz pequeña <code>x₂</code> se anule por cancelación catastrófica (<code>b − b = 0</code>),
            la guía oficial establece usar el producto de raíces de Viète: <strong>x₁ · x₂ = c ⟹ x₂ = c / x₁</strong>,
            o la forma racionalizada de Citardauq: <strong>x₂ = 2c / [b + √(b² − 4c)]</strong>.
            Con <strong>b = ${b.toLocaleString("es-PE")}</strong> y <strong>c = ${c}</strong>, calcula el valor exacto de la raíz pequeña <strong>x₂</strong> (puedes usar notación científica como <code>1e-7</code> o decimal).</p>
          `,
          unidad: "unidades",
          esperado: x2_exacto,
          decimales: 10,
          tipo: "real",
          metodoOpciones: [
            {
              id: "cuadratica_clasica",
              nombre: "A) Fórmula cuadrática tradicional: x₂ = [b − √(b² − 4c)] / 2",
              esOptimo: false,
              analisis: "❌ <strong>Fallo Crítico por Cancelación:</strong> Como √(b² − 4c) se evalúa como b dentro de la precisión finita, la resta hace b − b = 0, destruyendo completamente la raíz pequeña y devolviendo x₂ = 0.",
              recomendacion: "El método más apropiado es la <strong>Reformulación Algebraica Racionalizada (B)</strong>, que convierte la resta destructiva en una suma en el denominador."
            },
            {
              id: "reformulacion",
              nombre: "B) Reformulación Racionalizada (Viète): x₂ = c / x₁ = 2c / [b + √(b² − 4c)]",
              esOptimo: true,
              analisis: "✅ <strong>¡Método recomendado por la guía docente!</strong> Al racionalizar el numerador multiplicando por el conjugado [b + √(b² − 4c)], la resta desaparece y el denominador suma dos números positivos, conservando todas las cifras significativas.",
              recomendacion: "Es la técnica estándar enseñada en análisis numérico para resolver ecuaciones cuadráticas mal condicionadas."
            }
          ],
          pista: `Aprovecha la propiedad de las raíces: x₁ · x₂ = c / a. Como a = 1 y x₁ ≈ b, se tiene directamente: x₂ = c / b. Divide c = ${c} entre b = ${b.toLocaleString("es-PE")}. Por ejemplo: ${c} / ${b.toLocaleString("es-PE")} = ${(c / b).toExponential(2)}.`,
          guiaInteractiva: {
            final: `La raíz pequeña es x₂ ≈ ${x2_exacto.toExponential(4)}. El enfoque apropiado es la reformulación de Viète o racionalizar con el conjugado: evita restar dos números casi iguales y conserva la raíz pequeña.`,
            pasos: [
              { tipo: "seleccion", enunciado: "¿Qué forma conviene para obtener la raíz pequeña sin cancelar cifras?", opciones: [{ valor: "clasica", texto: "Fórmula clásica: (b−√(b²−4c))/2" }, { valor: "viete", texto: "Viète x₂=c/x₁ o forma racionalizada con suma en el denominador" }], correcto: ["viete"], pista: "La forma problemática contiene la resta b − √(b²−4c), donde ambos términos son casi iguales.", explicacion: "Viète y la forma racionalizada reemplazan la resta destructiva por una división que mantiene la información significativa." },
              { tipo: "numero", etiqueta: "Raíz pequeña", unidad: "unidades", enunciado: `Como x₁ ≈ b y x₁·x₂ = c, calcula x₂ ≈ c/b con c = ${c} y b = ${b.toLocaleString("es-PE")}.`, correcto: x2_exacto, pista: `Divide ${c} entre ${b}. También puedes escribir el resultado en notación científica.`, explicacion: `x₂ = c/x₁ ≈ c/b = ${c}/${b} = ${x2_exacto.toExponential(4)}. Al no restar números casi iguales, esta reformulación conserva la raíz pequeña.` }
            ]
          },
          solucion: [
            { txt: "1. Mostramos la reformulación algebraica racionalizada (multiplicando por el conjugado):" },
            { tex: `x_2 = \\frac{b - \\sqrt{b^2 - 4c}}{2} \\cdot \\frac{b + \\sqrt{b^2 - 4c}}{b + \\sqrt{b^2 - 4c}} = \\frac{b^2 - (b^2 - 4c)}{2(b + \\sqrt{b^2 - 4c})} = \\frac{2c}{b + \\sqrt{b^2 - 4c}}` },
            { txt: "2. Como b + √(b² − 4c) ≈ 2b, la expresión equivale exactamente a la relación de Viète:" },
            { tex: `x_2 = \\frac{2c}{2b} = \\frac{c}{b} = \\frac{${c}}{${texSci(b)}} = ${texSci(x2_exacto)}` },
            { txt: `Resultado: La raíz pequeña es x₂ = ${x2_exacto.toExponential(4)}. Se conservan todas las cifras significativas sin cancelación.` }
          ]
        }
      ]
    }
  ];

  lista.forEach(ej => {
    ej.preguntas.forEach(p => {
      p.estado = "pendiente";
      p.intentos = 0;
      p.entrada = "";
      p.feedback = null;
      p.pistaVisible = false;
      p.metodoSeleccionado = null;
      p.solucionVisible = false;
    });
  });

  return lista;
}

function renderizarEjercicioActual() {
  const ej = ejercicios[ejercicioActivo];
  const escenario = $("escenarioEjercicio");
  const contenedor = $("preguntasContainer");

  if (!ej || !escenario || !contenedor) return;

  // 1. Renderizar escenario del ejercicio
  escenario.innerHTML = ej.contexto;

  // 2. Renderizar las preguntas independientes
  contenedor.innerHTML = "";

  ej.preguntas.forEach((pregunta, pIdx) => {
    const card = document.createElement("div");
    card.id = `pregunta-card-${pIdx}`;
    card.className = "panel" + (pregunta.estado === "correcta" ? " border-success bg-white" : " bg-white");

    let markerClass = pregunta.estado === "correcta" ? "badge bg-success" : "badge bg-primary";
    let statusText = pregunta.estado === "correcta" ? "Resuelto con éxito ✓":"";

    let html = `
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 pb-2 border-bottom">
        <div>
          <span class="${markerClass} me-2">${pregunta.numero}</span>
          <h4 class="d-inline h5 fw-bold text-dark mb-0">${pregunta.titulo}</h4>
        </div>
        <span class="badge bg-light text-secondary border">${statusText}</span>
      </div>

      <div class="mb-3">${pregunta.enunciado}</div>

      <!-- 1. ASESOR DE MÉTODOS -->
      <div class="method-consultation-box mb-3">
        <div class="method-header">
          <span class="fw-bold text-dark d-flex align-items-center gap-2">
            <i class="bi bi-compass text-primary"></i> ¿Qué método o enfoque piensas emplear?
          </span>
        </div>
        <p class="small text-muted mb-2">
          Selecciona una alternativa. La plataforma evaluará si el método es propenso a error numérico o te justificará cuál es la mejor opción.
        </p>
        <select class="form-select form-select-sm" data-action="seleccionar-metodo" data-p="${pIdx}">
          <option value="">-- Elige un método para esta pregunta --</option>`;

    pregunta.metodoOpciones.forEach(m => {
      const selected = pregunta.metodoSeleccionado === m.id ? " selected" : "";
      html += `<option value="${m.id}"${selected}>${m.nombre}</option>`;
    });

    html += `</select>`;

    // Feedback del método seleccionado
    if (pregunta.metodoSeleccionado) {
      const opt = pregunta.metodoOpciones.find(m => m.id === pregunta.metodoSeleccionado);
      if (opt) {
        const claseCard = opt.esOptimo ? "is-optimal" : "is-warning";
        html += `
          <div class="method-feedback-card ${claseCard}">
            <p class="mb-1">${opt.analisis}</p>
            <p class="mb-0 small"><strong>Conclusión técnica:</strong> ${opt.recomendacion}</p>
          </div>`;
      }
    }

    html += `</div>`;

    // 2. PISTA PREVIA PLEGABLE
    html += `
      <div class="mb-3">
        <button type="button" class="btn btn-sm btn-outline-warning d-inline-flex align-items-center gap-1" data-action="pista" data-p="${pIdx}">
          <i class="bi bi-lightbulb"></i>
          <span>${pregunta.pistaVisible ? "Ocultar pista" : "💡 ¿Necesitas una pista?"}</span>
        </button>
        ${pregunta.pistaVisible ? `<div class="step-hint-box mt-2"><i class="bi bi-info-circle-fill me-1"></i><strong>Pista orientativa:</strong> ${pregunta.pista}</div>` : ""}
      </div>`;

    // 3. FORMULARIO DE RESPUESTA
    html += `
      <div class="step-form">
        <label class="form-label small fw-semibold text-secondary mb-1" for="resp-${pIdx}">Tu respuesta numérica:</label>
        <div class="input-group">
          <input id="resp-${pIdx}" data-p="${pIdx}" type="text" inputmode="decimal" autocomplete="off"
                 class="form-control" placeholder="Escribe tu resultado numérico" value="${pregunta.entrada.replace(/"/g, "&quot;")}">
          <span class="input-group-text">${pregunta.unidad}</span>
          <button type="button" class="btn btn-primary" data-action="comprobar" data-p="${pIdx}">
            <i class="bi bi-check2 me-1"></i>Comprobar
          </button>
        </div>
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2">
          <span class="small text-muted">
            <i class="bi bi-arrow-repeat me-1"></i>Intentos realizados: <strong>${pregunta.intentos}</strong> (Intentos ilimitados)
          </span>
          <div class="d-flex flex-wrap gap-3">
            <button type="button" class="btn btn-link btn-sm text-decoration-none p-0" data-action="toggle-solucion" data-p="${pIdx}">
              <i class="bi bi-journal-text me-1"></i>${pregunta.solucionVisible ? "Ocultar desarrollo completo" : "Leer desarrollo completo"}
            </button>
            <button type="button" class="btn btn-link btn-sm text-decoration-none p-0 fw-semibold" data-action="guia-interactiva" data-p="${pIdx}">
              <i class="bi bi-stars me-1"></i>Practicar desarrollo guiado
            </button>
          </div>
        </div>
      </div>`;

    // 4. FEEDBACK DE FELICITACIÓN O ÁNIMO
    if (pregunta.feedback) {
      const esExito = pregunta.feedback.tipo === "exito";
      html += `
        <div class="feedback-cheer ${esExito ? 'is-success' : 'is-encouraging'}" role="status">
          <i class="bi ${esExito ? 'bi-check-circle-fill fs-5 text-success' : 'bi-emoji-smile fs-5 text-warning'}"></i>
          <div>
            <strong>${esExito ? '¡Excelente trabajo! 🎉' : '¡Ánimo, no te rindas! 💪'}</strong>
            <p class="mb-0 mt-1 small">${pregunta.feedback.texto}</p>
          </div>
        </div>`;
    }

    // 5. SOLUCIÓN PASO A PASO DESPLEGABLE
    if (pregunta.solucionVisible) {
      html += `
        <div class="step-solution-box">
          <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
            <h5 class="h6 mb-0 text-dark fw-bold">
              <i class="bi bi-calculator text-primary me-2"></i>Desarrollo paso a paso:
            </h5>
            <span class="badge bg-light text-secondary border">Resolución</span>
          </div>`;

      pregunta.solucion.forEach((linea, j) => {
        if (linea.tex) {
          html += `<div class="sol-step-item"><div class="sol-tex" data-p="${pIdx}" data-j="${j}"></div></div>`;
        } else {
          html += `<div class="sol-step-item"><p class="sol-text small text-secondary mb-0">${linea.txt}</p></div>`;
        }
      });

      html += `</div>`;
    }

    const guiaAbierta = guiaActiva?.ejercicio === ejercicioActivo && guiaActiva?.pregunta === pIdx;
    card.innerHTML = guiaAbierta
      ? `<div class="guided-exercise-layout"><div class="guided-exercise-main">${html}</div><aside class="guided-panel" aria-labelledby="guiaDesarrolloTitulo"><div class="guided-header"><div><span class="guided-kicker"><i class="bi bi-stars me-1"></i>Aprendizaje paso a paso</span><h2 class="h4 mb-0" id="guiaDesarrolloTitulo">Desarrollo guiado</h2></div><button type="button" class="btn-close btn-close-white" data-guide-action="close" aria-label="Cerrar guía"></button></div><div class="guided-panel-body" id="guiaDesarrolloContenido"></div></aside></div>`
      : html;
    contenedor.appendChild(card);

    if (guiaAbierta) renderizarPanelGuia();

    // Renderizar KaTeX
    card.querySelectorAll(".sol-tex").forEach(elem => {
      const pIdxElem = Number(elem.dataset.p);
      const jElem = Number(elem.dataset.j);
      const linea = ej.preguntas[pIdxElem].solucion[jElem];

      if (typeof katex !== "undefined") {
        katex.render(linea.tex, elem, { throwOnError: false, displayMode: true });
      } else {
        elem.textContent = linea.tex;
      }
    });
  });

  // Verificar si ambas preguntas de este ejercicio están resueltas
  const resueltas = ej.preguntas.filter(p => p.estado === "correcta").length;
  const resumen = $("resumenEjercicio");
  if (resueltas === ej.preguntas.length) {
    resumen.innerHTML = `
      <h3>¡Felicitaciones! Has completado el ${ej.titulo}</h3>
      <p>Has resuelto las 2 preguntas de forma autónoma con total precisión. Puedes cambiar de ejercicio arriba o pulsar <strong>«Generar nuevos valores aleatorios»</strong> para seguir practicando.</p>
    `;
    resumen.hidden = false;
  } else {
    resumen.hidden = true;
  }
}

function seleccionarMetodo(pIdx, metodoId) {
  ejercicios[ejercicioActivo].preguntas[pIdx].metodoSeleccionado = metodoId;
  renderizarEjercicioActual();
}

function alternarPista(pIdx) {
  const p = ejercicios[ejercicioActivo].preguntas[pIdx];
  p.pistaVisible = !p.pistaVisible;
  renderizarEjercicioActual();
  const input = $("resp-" + pIdx);
  if (input) input.focus();
}

function alternarSolucion(pIdx) {
  const p = ejercicios[ejercicioActivo].preguntas[pIdx];
  p.solucionVisible = !p.solucionVisible;
  renderizarEjercicioActual();
}

function abrirGuiaInteractiva(pIdx) {
  const pregunta = ejercicios[ejercicioActivo].preguntas[pIdx];
  if (!pregunta?.guiaInteractiva) return;
  guiaActiva = { ejercicio: ejercicioActivo, pregunta: pIdx, paso: 0, valor: "", feedback: null, completada: false, intentosPaso: 0 };
  renderizarEjercicioActual();
  const destino = window.matchMedia("(max-width: 991.98px)").matches
    ? document.querySelector(`#pregunta-card-${pIdx} .guided-panel`)
    : document.getElementById(`pregunta-card-${pIdx}`);
  destino?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cerrarGuiaInteractiva() {
  guiaActiva = null;
  if (ejercicios.length) renderizarEjercicioActual();
}

function datosGuiaActual() {
  if (!guiaActiva) return null;
  const pregunta = ejercicios[guiaActiva.ejercicio]?.preguntas[guiaActiva.pregunta];
  return pregunta ? { pregunta, guia: pregunta.guiaInteractiva } : null;
}

function renderizarPanelGuia() {
  const datos = datosGuiaActual();
  const panel = $("guiaDesarrolloContenido");
  if (!datos || !panel) return;
  const { pregunta, guia } = datos;
  const { paso, completada, feedback, intentosPaso } = guiaActiva;
  const total = guia.pasos.length;
  const pasoCorrecto = feedback?.correcto === true;

  if (completada) {
    const resultado = Math.abs(pregunta.esperado) < 1e-4 || Math.abs(pregunta.esperado) >= 1e7
      ? pregunta.esperado.toExponential(5)
      : pregunta.esperado.toLocaleString("es-PE", { maximumSignificantDigits: 8 });
    panel.innerHTML = `
      <div class="guided-progress mb-4" role="progressbar" aria-label="Progreso del desarrollo guiado" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${total}"><div class="progress-bar" style="width:100%"></div></div>
      <div class="guided-finish">
        <div class="guided-step-number mb-3"><i class="bi bi-check-lg"></i></div>
        <h3 class="h5 fw-bold">¡Lo lograste, llegaste al resultado! 🎉</h3>
        <p class="mb-2">Respuesta final: <strong class="text-primary">${resultado} ${pregunta.unidad}</strong></p>
        <p class="mb-0">${guia.final}</p>
      </div>
      <p class="small text-secondary mt-3 mb-0">También puedes cerrar esta práctica y leer el desarrollo completo desde la pregunta.</p>`;
    return;
  }

  const actual = guia.pasos[paso];
  const opcionesHTML = actual.tipo === "seleccion"
    ? `<div class="d-grid gap-2 mt-3">${actual.opciones.map(opcion => `<button type="button" class="btn guided-choice ${guiaActiva.valor === opcion.valor ? "is-selected" : ""}" data-guide-option="${opcion.valor}" ${pasoCorrecto ? "disabled" : ""}><span>${guiaActiva.valor === opcion.valor ? "●" : "○"}</span> ${opcion.texto}</button>`).join("")}</div>`
    : `<label class="form-label fw-semibold mt-3" for="guidedAnswer">${actual.etiqueta}</label><div class="input-group"><input id="guidedAnswer" data-guide-answer type="text" inputmode="decimal" autocomplete="off" class="form-control" placeholder="Escribe tu respuesta" value="${String(guiaActiva.valor).replace(/"/g, "&quot;")}" ${pasoCorrecto ? "disabled" : ""}><span class="input-group-text">${actual.unidad || ""}</span></div>`;

  let response = "";
  if (feedback) {
    response = feedback.correcto
      ? `<div class="guided-feedback is-correct mt-3"><strong>${feedback.revelado ? "Aquí tienes este paso 📘" : "¡Sí, vas muy bien! ✨"}</strong><p class="mb-2 mt-1">${feedback.texto}</p>${feedback.revelado ? `<p class="mb-2"><strong>Respuesta:</strong> ${respuestaCorrectaPaso(actual)}</p>` : ""}<div class="guided-explanation">${actual.explicacion}</div><button type="button" class="btn btn-success mt-3" data-guide-action="next">${paso + 1 === total ? "Llegar al resultado final" : "Continuar al siguiente paso"} <i class="bi bi-arrow-right ms-1"></i></button></div>`
      : `<div class="guided-feedback is-try mt-3"><strong>¡Vas avanzando, inténtalo otra vez! 💪</strong><p class="mb-1 mt-1">${feedback.texto}</p><span>${actual.pista}</span>${intentosPaso >= 3 ? `<div class="guided-stuck mt-3"><p class="mb-2"><strong>¿Te está costando este paso?</strong> Puedes revisar la respuesta explicada y continuar cuando quieras.</p><button type="button" class="btn btn-outline-primary btn-sm" data-guide-action="reveal"><i class="bi bi-lightbulb me-1"></i>Ver explicación y continuar</button></div>` : ""}</div>`;
  }

  panel.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2"><span class="small fw-semibold text-secondary">${pregunta.titulo}</span><span class="badge rounded-pill text-bg-light">${paso + 1} de ${total}</span></div>
    <div class="guided-progress mb-4" role="progressbar" aria-label="Progreso del desarrollo guiado" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${paso}"><div class="progress-bar" style="width:${paso / total * 100}%"></div></div>
    <article class="guided-step-card">
      <div class="guided-step-number mb-3">${paso + 1}</div>
      <h3 class="h5 fw-bold">Resolvamos este paso</h3>
      <p class="mb-2">${actual.enunciado}</p>
      ${opcionesHTML}
      ${pasoCorrecto ? "" : `<button type="button" class="btn btn-primary w-100 mt-3" data-guide-action="check"><i class="bi bi-check2-circle me-1"></i>Comprobar este paso</button>`}
      ${response}
    </article>
    <p class="small text-secondary mt-3"><i class="bi bi-heart-fill text-danger me-1"></i>No te preocupes si fallas: la pista te orientará y puedes volver a intentarlo.</p>`;
}

function comprobarPasoGuia() {
  const datos = datosGuiaActual();
  if (!datos) return;
  const { guia } = datos;
  const paso = guia.pasos[guiaActiva.paso];
  const valor = String(guiaActiva.valor ?? "").trim().replace(",", ".");
  if (!valor) {
    guiaActiva.feedback = { correcto: false, texto: "Primero elige una alternativa o escribe tu resultado." };
    renderizarPanelGuia();
    return;
  }
  const acierto = paso.tipo === "seleccion"
    ? paso.correcto.includes(valor)
    : (() => {
        const numero = Number(valor);
        const tolerancia = Math.max(Math.abs(paso.correcto) * (paso.tolerancia ?? 0.005), 1e-10);
        return Number.isFinite(numero) && Math.abs(numero - paso.correcto) <= tolerancia;
      })();
  if (!acierto) guiaActiva.intentosPaso++;
  guiaActiva.feedback = acierto
    ? { correcto: true, texto: paso.exito || "¡Correcto! Ya tienes la idea clave. Observa cómo se usa en el cálculo." }
    : { correcto: false, texto: "Ese resultado todavía no coincide. Revisa la pista y prueba otra vez." };
  renderizarPanelGuia();
}

function respuestaCorrectaPaso(paso) {
  if (paso.tipo === "seleccion") {
    return paso.opciones.find(opcion => paso.correcto.includes(opcion.valor))?.texto || paso.correcto[0];
  }
  const numero = Math.abs(paso.correcto) < 1e-4 || Math.abs(paso.correcto) >= 1e7
    ? paso.correcto.toExponential(5)
    : paso.correcto.toLocaleString("es-PE", { maximumSignificantDigits: 8 });
  return `${numero} ${paso.unidad || ""}`.trim();
}

function revelarPasoGuia() {
  if (!guiaActiva) return;
  guiaActiva.feedback = {
    correcto: true,
    revelado: true,
    texto: "No pasa nada si este paso necesitó una ayuda extra. Revisa por qué se hace así y luego continúa a tu ritmo."
  };
  renderizarPanelGuia();
}

function avanzarPasoGuia() {
  const datos = datosGuiaActual();
  if (!datos || !guiaActiva.feedback?.correcto) return;
  if (guiaActiva.paso + 1 >= datos.guia.pasos.length) {
    guiaActiva.completada = true;
  } else {
    guiaActiva.paso++;
  }
  guiaActiva.valor = "";
  guiaActiva.feedback = null;
  guiaActiva.intentosPaso = 0;
  renderizarPanelGuia();
}

function comprobarRespuesta(pIdx) {
  const pregunta = ejercicios[ejercicioActivo].preguntas[pIdx];
  const texto = pregunta.entrada.trim().replace(/\s/g, "").replace(",", ".");

  if (texto === "") {
    pregunta.feedback = {
      tipo: "animo",
      texto: "Por favor, ingresa tu respuesta numérica antes de comprobar."
    };
    renderizarEjercicioActual();
    const input = $("resp-" + pIdx);
    if (input) input.focus();
    return;
  }

  const valor = Number(texto);

  if (!Number.isFinite(valor)) {
    pregunta.feedback = {
      tipo: "animo",
      texto: "Ingresa un número válido (por ejemplo: 25.0 o 1e-7)."
    };
    renderizarEjercicioActual();
    const input = $("resp-" + pIdx);
    if (input) input.focus();
    return;
  }

  pregunta.intentos++;

  const acierto = pregunta.tipo === "entero"
    ? valor === pregunta.esperado
    : Math.abs(valor - pregunta.esperado) / Math.abs(pregunta.esperado) <= TOLERANCIA_RELATIVA;

  const respuestaTexto =
    pregunta.esperado.toLocaleString("es-PE", { minimumFractionDigits: pregunta.decimales, maximumFractionDigits: pregunta.decimales }) +
    " " + pregunta.unidad;

  if (acierto) {
    pregunta.estado = "correcta";
    pregunta.feedback = {
      tipo: "exito",
      texto: pregunta.intentos === 1
        ? `Has obtenido la respuesta exacta (<strong>${respuestaTexto}</strong>) al primer intento. ¡Excelente criterio numérico!`
        : `¡Correcto! La respuesta exacta es <strong>${respuestaTexto}</strong> (alcanzada tras ${pregunta.intentos} intentos). ¡Gran perseverancia!`
    };

    renderizarEjercicioActual();
    return;
  }

  // Intento no coincidente (sin bloqueos ni penalización)
  let ayuda = "El resultado no coincide todavía.";

  if (Math.abs(valor - pregunta.esperado) / Math.abs(pregunta.esperado) < 0.1) {
    ayuda = "¡Estás muy cerca! Revisa los decimales o el redondeo del cálculo.";
  }

  pregunta.feedback = {
    tipo: "animo",
    texto: `${ayuda} Consulta la pista orientativa arriba o revisa las fórmulas e inténtalo de nuevo.`
  };

  renderizarEjercicioActual();
  const input = $("resp-" + pIdx);
  if (input) input.focus();
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

// ========================================
// TEST TEÓRICO SECUENCIAL (RELACIÓN DE CONCEPTOS)
// ========================================

const bancoPreguntasTeoricas = [
  {
    id: "t1",
    titulo: "Fuentes de Error y Aritmética de Máquina",
    instruccion: "Asocia cada concepto con su definición técnica exacta:",
    pares: [
      {
        id: "p1",
        termino: "Error de Truncamiento",
        definicion: "Aparece al cortar un proceso infinito por uno finito (ej. truncar una serie o aproximar derivadas).",
        explicacion: "El error de truncamiento depende del algoritmo/modelo, no de los bits del procesador."
      },
      {
        id: "p2",
        termino: "Absorción Numérica",
        definicion: "Ocurre cuando |δ| < 0.5 · ulp(x), provocando que fl(x + δ) = x y el sumando se pierda por completo.",
        explicacion: "El incremento es menor que la mitad de la distancia entre representables contiguos."
      },
      {
        id: "p3",
        termino: "Cancelación Catastrófica",
        definicion: "Pérdida severa de cifras significativas al restar dos magnitudes casi idénticas.",
        explicacion: "Al cancelarse los dígitos más significativos, los bits restantes son mero ruido de redondeo."
      },
      {
        id: "p4",
        termino: "Épsilon de Máquina (ε)",
        definicion: "Distancia entre 1.0 y el siguiente flotante representable (2^(1−p)); cota de error relativo.",
        explicacion: "En float32 (precisión p=24) equivale a 2^(-23) ≈ 1.19 × 10^(-7)."
      }
    ]
  },
  {
    id: "t2",
    titulo: "Estrategias de Suma y Estabilidad Algorítmica",
    instruccion: "Relaciona cada algoritmo con su mecanismo de control de error y cota teórica:",
    pares: [
      {
        id: "p5",
        termino: "Suma de Kahan",
        definicion: "Suma compensada que arrastra un residuo 'c' con los bits perdidos; cota O(2·u·S).",
        explicacion: "Corrige activamente la absorción en float32 sin recurrir a hardware de doble precisión."
      },
      {
        id: "p6",
        termino: "Suma por Pares (Pairwise)",
        definicion: "Divide el arreglo recursivamente en árbol binario; reduce la cota a O(log₂ N · u · S).",
        explicacion: "Al sumar bloques balanceados, las sumas parciales mantienen magnitudes comparables."
      },
      {
        id: "p7",
        termino: "Datos Centrados",
        definicion: "Calcula N · base por separado y solo acumula las variaciones δ en el rango de alta precisión.",
        explicacion: "Elimina la absorción causada por un valor base grande constante en telemetría."
      },
      {
        id: "p8",
        termino: "Suma Recursiva Directa",
        definicion: "Acumulación lineal clásica en un bucle; su cota de error crece linealmente: O(N·u·S).",
        explicacion: "Es altamente vulnerable a la absorción cuando el acumulador supera 2^24."
      }
    ]
  }
];

let indiceTeoriaActual = 0;
let respuestasTeoria = {};
let estadoTeoriaRevisado = false;

function inicializarTestTeorico() {
  const contenedor = $("cajaTestTeorico");
  if (!contenedor) return;

  // Mezclar opciones de respuesta una sola vez para que no coincidan en orden
  bancoPreguntasTeoricas.forEach(pregunta => {
    if (!pregunta.opcionesBarajadas) {
      pregunta.opcionesBarajadas = [...pregunta.pares]
        .map(p => ({ id: p.id, texto: p.definicion }))
        .sort(() => Math.random() - 0.5);
    }
  });

  renderizarPreguntaTeorica();
}

function renderizarPreguntaTeorica() {
  const contenedor = $("cajaTestTeorico");
  if (!contenedor) return;

  const total = bancoPreguntasTeoricas.length;

  const q = bancoPreguntasTeoricas[indiceTeoriaActual];
  const seleccionadas = respuestasTeoria[q.id] || {};

  let filasHTML = q.pares.map((par, i) => {
    const valorActual = seleccionadas[par.id] || "";
    let claseCorreccion = "";
    let iconoCorreccion = "";

    if (estadoTeoriaRevisado) {
      if (valorActual === par.id) {
        claseCorreccion = "border-success bg-success-subtle";
        iconoCorreccion = '<span class="badge bg-success ms-2"><i class="bi bi-check-lg"></i> Correcto</span>';
      } else {
        claseCorreccion = "border-danger bg-danger-subtle";
        iconoCorreccion = '<span class="badge bg-danger ms-2"><i class="bi bi-x-lg"></i> Incorrecto</span>';
      }
    }

    return `
      <div class="p-3 mb-3 rounded-3 border ${claseCorreccion} transition-all">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <label class="fw-bold text-dark mb-0">
            <span class="badge bg-primary me-2">${i + 1}</span> ${par.termino}
          </label>
          ${iconoCorreccion}
        </div>
        <select class="form-select select-teoria" data-term="${par.id}" ${estadoTeoriaRevisado ? "disabled" : ""}>
          <option value="">-- Selecciona la definición correspondiente --</option>
          ${q.opcionesBarajadas.map(opc => `
            <option value="${opc.id}" ${valorActual === opc.id ? "selected" : ""}>
              ${opc.texto}
            </option>
          `).join("")}
        </select>
        ${estadoTeoriaRevisado && valorActual !== par.id ? `
          <div class="small text-danger mt-2">
            <i class="bi bi-info-circle me-1"></i><strong>Correcto:</strong> ${par.definicion}
          </div>
        ` : ""}
      </div>
    `;
  }).join("");

  // Cabecera de progreso
  let html = `
    <div class="d-flex justify-content-between align-items-center pb-2 border-bottom mb-3">
      <span class="badge bg-light text-primary border fw-semibold">
        Pregunta ${indiceTeoriaActual + 1} de ${total}
      </span>
    </div>

    <h4 class="h5 fw-bold text-dark mb-1">${q.titulo}</h4>
    <p class="text-secondary small mb-3">${q.instruccion}</p>

    <div class="mb-4">${filasHTML}</div>

    <div id="teoriaFeedbackArea"></div>

    <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
      <span class="small text-muted" id="teoriaContadorMsg"></span>
      <div>
        ${!estadoTeoriaRevisado ? `
          <button type="button" class="btn btn-primary" id="btnComprobarTeoria">
            <i class="bi bi-check2-circle me-1"></i>Comprobar Respuestas
          </button>
        ` : `
          <button type="button" class="btn btn-success" id="btnSiguienteTeoria">
            Siguiente Pregunta <i class="bi bi-arrow-right ms-1"></i>
          </button>
        `}
      </div>
    </div>
  `;

  contenedor.innerHTML = html;
  enlazarEventosTeoria();
}

function enlazarEventosTeoria() {
  const q = bancoPreguntasTeoricas[indiceTeoriaActual];
  if (!respuestasTeoria[q.id]) respuestasTeoria[q.id] = {};

  // Guardar selecciones
  document.querySelectorAll(".select-teoria").forEach(sel => {
    sel.addEventListener("change", e => {
      respuestasTeoria[q.id][e.target.dataset.term] = e.target.value;
    });
  });

  // Botón Comprobar
  const btnComprobar = $("btnComprobarTeoria");
  if (btnComprobar) {
    btnComprobar.addEventListener("click", () => {
      const seleccionadas = respuestasTeoria[q.id];
      const faltan = q.pares.some(p => !seleccionadas[p.id]);

      if (faltan) {
        alert("Por favor relaciona todos los conceptos antes de comprobar.");
        return;
      }

      let aciertos = 0;
      q.pares.forEach(p => {
        if (seleccionadas[p.id] === p.id) aciertos++;
      });

      estadoTeoriaRevisado = true;
      renderizarPreguntaTeorica();

      const fb = $("teoriaFeedbackArea");
      const nota = (aciertos / q.pares.length) * 20;

      if (aciertos === q.pares.length) {
        fb.innerHTML = `
          <div class="alert alert-success d-flex align-items-center mb-0">
            <i class="bi bi-check-circle-fill fs-4 me-3"></i>
            <div>
              <strong>¡Excelente calificación: ${nota.toFixed(1)} / 20!</strong>
              <p class="mb-0 small">Todos los conceptos teóricos han sido relacionados con precisión matemática.</p>
            </div>
          </div>
        `;
      } else {
        fb.innerHTML = `
          <div class="alert alert-warning d-flex align-items-center mb-0">
            <i class="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
            <div>
              <strong>Calificación obtenida: ${nota.toFixed(1)} / 20 (${aciertos} de ${q.pares.length} correctas)</strong>
              <p class="mb-0 small">Revisa las correcciones marcadas en rojo antes de avanzar.</p>
            </div>
          </div>
        `;
      }
    });
  }

  // Botón Siguiente
  const btnSiguiente = $("btnSiguienteTeoria");
  if (btnSiguiente) {
    btnSiguiente.addEventListener("click", () => {
      indiceTeoriaActual++;
      estadoTeoriaRevisado = false;
      renderizarPreguntaTeorica();
    });
  }

  // Botón Reintentar
  const btnReintentar = $("btnReintentarTeoria");
  if (btnReintentar) {
    btnReintentar.addEventListener("click", () => {
      estadoTeoriaRevisado = false;
      renderizarPreguntaTeorica();
    });
  }
}