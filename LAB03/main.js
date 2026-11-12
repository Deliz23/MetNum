/**
 * MetNum - Módulo 03: Ecuaciones No Lineales (Métodos Abiertos)
 * Rapidez y Riesgo: Métodos Abiertos.
 * Punto Fijo, Newton-Raphson, Secante y Algoritmos Híbridos de Rescate.
 * Análisis de saturación en función sigmoide, desvanecimiento de derivada y cuencas de atracción.
 */

"use strict";

// ========================================
// 1. UTILIDADES Y FORMATEO
// ========================================

const $ = id => document.getElementById(id);

const DEFAULT_P = 0.83;
const Z_STAR_EXACT = Math.log(DEFAULT_P / (1 - DEFAULT_P)); // ln(83/17) ≈ 1.585630654
const DOMAIN_MIN = -10;
const DOMAIN_MAX = 10;
const TOLERANCIA_RELATIVA = 0.01;

function fmtLargo(n, cifras = 10) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-PE", { maximumSignificantDigits: cifras });
}

function fmtAuto(n) {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs < 1e-4 || abs >= 1e6) {
    return n.toExponential(4).replace("e+", "e");
  }
  return n.toLocaleString("es-PE", { maximumSignificantDigits: 6 });
}

function sciHTML(n, decimales = 2) {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const [mantisa, exp] = n.toExponential(decimales).split("e");
  const exponente = String(Number(exp)).replace("-", "−");
  return `${mantisa} × 10<sup>${exponente}</sup>`;
}

function texSci(n, cifras = 4) {
  if (!Number.isFinite(n)) return "\\text{—}";
  const [m, e] = n.toExponential(cifras - 1).split("e");
  return `${m}\\times10^{${Number(e)}}`;
}

function texInt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\\,");
}

function elegir(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

// Modelo de la sigmoide y sus derivadas numéricas seguras
function sigmoide(z) {
  if (z >= 40) return 1.0;
  if (z <= -40) return 0.0;
  return 1 / (1 + Math.exp(-z));
}

function dSigmoide(z) {
  if (z >= 40 || z <= -40) return 0.0;
  const s = sigmoide(z);
  return s * (1 - s);
}

function evaluarF(z, p = DEFAULT_P) {
  return sigmoide(z) - p;
}

function evaluarDF(z) {
  return dSigmoide(z);
}

function gPuntoFijo(z, p = DEFAULT_P, lambda = 4.0) {
  return z - lambda * evaluarF(z, p);
}

// ========================================
// 2. FÓRMULAS MATEMÁTICAS (KATEX)
// ========================================

function renderizarFormulas() {
  if (typeof katex === "undefined") {
    console.warn("KaTeX no está disponible.");
    return;
  }

  const formulas = [
    {
      id: "math-newton",
      formula: "z_{k+1} = z_k - \\frac{f(z_k)}{f'(z_k)} = z_k - \\frac{\\sigma(z_k) - 0.83}{\\sigma(z_k)(1 - \\sigma(z_k))}"
    },
    {
      id: "math-secante",
      formula: "z_{k+1} = z_k - f(z_k)\\,\\frac{z_k - z_{k-1}}{f(z_k) - f(z_{k-1})}"
    },
    {
      id: "math-punto-fijo",
      formula: "\\begin{aligned} z_{k+1} &= g(z_k) = z_k - 4\\cdot f(z_k) \\\\[3pt] |g'(z^*)| &= |1 - 4\\cdot\\sigma(z^*)(1 - \\sigma(z^*))| \\approx 0.4356 < 1 \\end{aligned}"
    },
    {
      id: "math-orden",
      formula: "\\lim_{k\\to\\infty} \\frac{|e_{k+1}|}{|e_k|^p} = \\lambda \\quad \\begin{cases} p = 2 & \\text{Newton-Raphson} \\\\ p \\approx 1.618 & \\text{Secante} \\\\ p = 1 & \\text{Punto Fijo} \\end{cases}"
    },
    {
      id: "math-sigmoide",
      formula: "f(z) = \\frac{1}{1 + e^{-z}} - 0.83, \\quad f'(z) = \\frac{e^{-z}}{(1 + e^{-z})^2}"
    },
    {
      id: "math-hibrido",
      formula: "\\text{Paso Híbrido: } \\begin{cases} z_{k+1} = z_k - \\frac{f(z_k)}{f'(z_k)} & \\text{si } |\\Delta z| \\le \\Delta_{\\max} \\land z_{k+1} \\in [a, b] \\\\[4pt] c_{k+1} = \\frac{a_k + b_k}{2} & \\text{en caso de desborde o divergencia} \\end{cases}"
    }
  ];

  formulas.forEach(({ id, formula }) => {
    const el = $(id);
    if (el) {
      katex.render(formula, el, { throwOnError: false, displayMode: true });
    }
  });

  if (typeof renderMathInElement !== "undefined") {
    renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false
    });
  }
}

// ========================================
// 3. DEMOSTRACIÓN DE LA PORTADA (HERO)
// ========================================

function configurarDemoHero() {
  const inputZ0 = $("heroZ0");
  if (!inputZ0) return;

  function actualizar() {
    const z0 = Number(inputZ0.value);
    const outF = $("heroF");
    const outDeriv = $("heroDeriv");
    const outDelta = $("heroDelta");
    const outZ1 = $("heroZ1");
    const outStatus = $("heroStatus");
    const outMsg = $("heroMsg");

    if (!Number.isFinite(z0)) {
      outF.textContent = "—";
      outDeriv.textContent = "—";
      outDelta.textContent = "—";
      outZ1.textContent = "—";
      outStatus.className = "status status-warn";
      outStatus.textContent = "Entrada inválida";
      outMsg.textContent = "Introduce un valor real para z₀.";
      return;
    }

    const f0 = evaluarF(z0);
    const df0 = evaluarDF(z0);

    outF.textContent = `${f0 >= 0 ? "+" : ""}${f0.toFixed(6)}`;
    outDeriv.textContent = df0 < 1e-5 ? df0.toExponential(4) : df0.toFixed(6);

    if (Math.abs(df0) < 1e-14) {
      outDelta.textContent = "∞ (División por cero)";
      outZ1.textContent = "Desbordamiento (NaN)";
      outStatus.className = "status status-bad";
      outStatus.textContent = "Catapulta Total / f′ ≈ 0";
      outMsg.textContent = `En z₀ = ${z0}, la curva está en saturación extrema. La derivada es prácticamente cero y el método no puede dar un paso válido.`;
      return;
    }

    const delta = -f0 / df0;
    const z1 = z0 + delta;

    outDelta.textContent = `${delta >= 0 ? "+" : ""}${Math.abs(delta) > 1e4 ? delta.toExponential(3) : delta.toFixed(3)}`;
    outZ1.textContent = Math.abs(z1) > 1e4 ? z1.toExponential(3) : z1.toFixed(3);

    if (Math.abs(delta) > 10 || Math.abs(z1) > 50) {
      outStatus.className = "status status-bad";
      outStatus.textContent = "Catapulta violenta";
      outMsg.textContent = `¡Alerta de divergencia! En z₀ = ${z0}, f′(z₀) ≈ ${df0.toExponential(2)} es minúscula. El paso de Newton da Δz = ${delta > 0 ? "+" : ""}${delta.toFixed(1)}, catapultando z₁ a ${z1.toFixed(1)}, fuera de cualquier cuenca admisible.`;
    } else if (Math.abs(z0 - Z_STAR_EXACT) < 0.2) {
      outStatus.className = "status status-ok";
      outStatus.textContent = "Zona cuadrática óptima";
      outMsg.textContent = `¡Excelente! z₀ = ${z0} está muy cerca de la raíz exacta (z* ≈ ${Z_STAR_EXACT.toFixed(4)}). El paso Δz = ${delta.toFixed(4)} reduce el error prácticamente a cero en 1 o 2 iteraciones.`;
    } else {
      outStatus.className = "status status-warn";
      outStatus.textContent = "Paso regular / Transición";
      outMsg.textContent = `Para z₀ = ${z0}, la pendiente es f′(z₀) = ${df0.toFixed(4)}. El siguiente punto es z₁ = ${z1.toFixed(4)}. El método avanzará normalmente hacia la raíz.`;
    }
  }

  inputZ0.addEventListener("input", actualizar);

  document.querySelectorAll(".readout-presets .preset").forEach(btn => {
    btn.addEventListener("click", () => {
      inputZ0.value = btn.dataset.z;
      actualizar();
    });
  });

  actualizar();
}

// ========================================
// 4. NAVEGACIÓN Y BOTÓN VOLVER ARRIBA
// ========================================

function configurarNavegacion() {
  const enlaces = document.querySelectorAll('.navbar-nav a[href^="#"]');
  const secciones = Array.from(enlaces)
    .map(a => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  function actualizarEnlaceActivo() {
    const scrollPos = window.scrollY + 120;
    let actual = secciones[0];

    for (const sec of secciones) {
      if (sec.offsetTop <= scrollPos) actual = sec;
    }

    enlaces.forEach(a => {
      a.classList.toggle("active", actual && a.getAttribute("href") === `#${actual.id}`);
    });
  }

  window.addEventListener("scroll", actualizarEnlaceActivo, { passive: true });
  actualizarEnlaceActivo();

  const scrollBtn = $("scrollTopBtn");
  if (scrollBtn) {
    window.addEventListener("scroll", () => {
      scrollBtn.classList.toggle("visible", window.scrollY > 400);
    }, { passive: true });
  }
}

// ========================================
// 5. NÚCLEO NUMÉRICO: ALGORITMOS ABIERTOS
// ========================================

function ejecutarNewtonRaphson(z0, tolX, tolF, maxIter, p = DEFAULT_P) {
  const t0 = performance.now();
  const filas = [];
  let z = z0;
  let convergido = false;
  let motivoFallo = null;

  for (let k = 0; k <= maxIter; k++) {
    const fz = evaluarF(z, p);
    const dfz = evaluarDF(z);
    const errExacto = Math.abs(z - Z_STAR_EXACT);

    if (k === 0) {
      filas.push({
        k,
        z,
        fz,
        dfz,
        delta: null,
        errExacto,
        nota: "Inicio z₀"
      });
    }

    if (Math.abs(fz) <= tolF && k > 0) {
      convergido = true;
      break;
    }

    if (k === maxIter) {
      motivoFallo = "Límite de iteraciones alcanzado.";
      break;
    }

    if (Math.abs(dfz) < 1e-14) {
      motivoFallo = `Derivada desvanecida f′(z) = ${dfz.toExponential(2)} (división por cero).`;
      break;
    }

    const delta = -fz / dfz;
    const zNext = z + delta;

    if (!Number.isFinite(zNext) || Math.abs(zNext) > 1e12) {
      filas.push({
        k: k + 1,
        z: zNext,
        fz: NaN,
        dfz: 0,
        delta,
        errExacto: Infinity,
        nota: "💥 Catapulta violenta: desbordamiento numérico"
      });
      motivoFallo = "Catapulta por desvanecimiento de gradiente.";
      break;
    }

    filas.push({
      k: k + 1,
      z: zNext,
      fz: evaluarF(zNext, p),
      dfz: evaluarDF(zNext),
      delta,
      errExacto: Math.abs(zNext - Z_STAR_EXACT),
      nota: Math.abs(delta) > 10 ? "⚠️ Salto largo (catapulta)" : "Paso de Newton"
    });

    if (Math.abs(delta) <= tolX && Math.abs(evaluarF(zNext, p)) <= tolF) {
      convergido = true;
      z = zNext;
      break;
    }

    z = zNext;
  }

  const t1 = performance.now();
  const ultimaFila = filas[filas.length - 1];

  return {
    metodo: "Newton-Raphson",
    convergido,
    motivoFallo,
    raiz: ultimaFila.z,
    iteraciones: filas.length - 1,
    residuoFinal: Math.abs(ultimaFila.fz),
    errorFinalX: ultimaFila.delta !== null ? Math.abs(ultimaFila.delta) : Math.abs(ultimaFila.z - z0),
    tiempoMs: t1 - t0,
    filas
  };
}

function ejecutarSecante(z0, zPrev, tolX, tolF, maxIter, p = DEFAULT_P) {
  const t0 = performance.now();
  const filas = [];
  let zm1 = zPrev;
  let z = z0;
  let convergido = false;
  let motivoFallo = null;

  filas.push({
    k: 0,
    z: zm1,
    fz: evaluarF(zm1, p),
    dfz: null,
    delta: null,
    errExacto: Math.abs(zm1 - Z_STAR_EXACT),
    nota: "Punto previo z₋₁"
  });

  filas.push({
    k: 1,
    z,
    fz: evaluarF(z, p),
    dfz: null,
    delta: z - zm1,
    errExacto: Math.abs(z - Z_STAR_EXACT),
    nota: "Punto de arranque z₀"
  });

  for (let k = 1; k <= maxIter; k++) {
    const fz = evaluarF(z, p);
    const fzm1 = evaluarF(zm1, p);

    if (Math.abs(fz) <= tolF) {
      convergido = true;
      break;
    }

    const dfAprox = (fz - fzm1) / (z - zm1);

    if (Math.abs(fz - fzm1) < 1e-15 || !Number.isFinite(dfAprox) || Math.abs(dfAprox) < 1e-14) {
      motivoFallo = "Cancelación catastrófica: f(z_k) ≈ f(z_{k-1}) (pendiente nula).";
      break;
    }

    const delta = -fz / dfAprox;
    const zNext = z + delta;

    if (!Number.isFinite(zNext) || Math.abs(zNext) > 1e12) {
      filas.push({
        k: k + 1,
        z: zNext,
        fz: NaN,
        dfz: dfAprox,
        delta,
        errExacto: Infinity,
        nota: "💥 Catapulta de secante: desbordamiento numérico"
      });
      motivoFallo = "Catapulta por aproximación secante casi horizontal.";
      break;
    }

    filas.push({
      k: k + 1,
      z: zNext,
      fz: evaluarF(zNext, p),
      dfz: dfAprox,
      delta,
      errExacto: Math.abs(zNext - Z_STAR_EXACT),
      nota: Math.abs(delta) > 10 ? "⚠️ Salto secante amplio" : "Paso de Secante"
    });

    if (Math.abs(delta) <= tolX && Math.abs(evaluarF(zNext, p)) <= tolF) {
      convergido = true;
      z = zNext;
      break;
    }

    zm1 = z;
    z = zNext;
  }

  const t1 = performance.now();
  const ultimaFila = filas[filas.length - 1];

  return {
    metodo: "Secante",
    convergido,
    motivoFallo,
    raiz: ultimaFila.z,
    iteraciones: filas.length - 2,
    residuoFinal: Math.abs(ultimaFila.fz),
    errorFinalX: ultimaFila.delta !== null ? Math.abs(ultimaFila.delta) : 0,
    tiempoMs: t1 - t0,
    filas
  };
}

function ejecutarPuntoFijo(z0, tolX, tolF, maxIter, p = DEFAULT_P, lambda = 4.0) {
  const t0 = performance.now();
  const filas = [];
  let z = z0;
  let convergido = false;
  let motivoFallo = null;

  for (let k = 0; k <= maxIter; k++) {
    const fz = evaluarF(z, p);
    const errExacto = Math.abs(z - Z_STAR_EXACT);

    if (k === 0) {
      filas.push({
        k,
        z,
        fz,
        dfz: 1 - lambda * evaluarDF(z),
        delta: null,
        errExacto,
        nota: "Inicio z₀"
      });
    }

    if (Math.abs(fz) <= tolF && k > 0) {
      convergido = true;
      break;
    }

    if (k === maxIter) {
      motivoFallo = "Límite de iteraciones alcanzado.";
      break;
    }

    const zNext = gPuntoFijo(z, p, lambda);
    const delta = zNext - z;

    if (!Number.isFinite(zNext) || Math.abs(zNext) > 1e12) {
      filas.push({
        k: k + 1,
        z: zNext,
        fz: NaN,
        dfz: NaN,
        delta,
        errExacto: Infinity,
        nota: "💥 Divergencia (|g′| > 1 fuera de cuenca)"
      });
      motivoFallo = "Divergencia por incumplimiento de contracción.";
      break;
    }

    filas.push({
      k: k + 1,
      z: zNext,
      fz: evaluarF(zNext, p),
      dfz: 1 - lambda * evaluarDF(zNext),
      delta,
      errExacto: Math.abs(zNext - Z_STAR_EXACT),
      nota: "Paso g(z)"
    });

    if (Math.abs(delta) <= tolX && Math.abs(evaluarF(zNext, p)) <= tolF) {
      convergido = true;
      z = zNext;
      break;
    }

    z = zNext;
  }

  const t1 = performance.now();
  const ultimaFila = filas[filas.length - 1];

  return {
    metodo: "Punto Fijo",
    convergido,
    motivoFallo,
    raiz: ultimaFila.z,
    iteraciones: filas.length - 1,
    residuoFinal: Math.abs(ultimaFila.fz),
    errorFinalX: ultimaFila.delta !== null ? Math.abs(ultimaFila.delta) : 0,
    tiempoMs: t1 - t0,
    filas
  };
}

function ejecutarNewtonHibrido(z0, tolX, tolF, maxIter, p = DEFAULT_P, aInit = DOMAIN_MIN, bInit = DOMAIN_MAX, maxStep = 3.0) {
  const t0 = performance.now();
  const filas = [];
  let z = z0;
  let a = aInit;
  let b = bInit;
  let convergido = false;
  let motivoFallo = null;

  if (evaluarF(a, p) * evaluarF(b, p) > 0) {
    a = -10;
    b = 10;
  }

  for (let k = 0; k <= maxIter; k++) {
    const fz = evaluarF(z, p);
    const dfz = evaluarDF(z);
    const errExacto = Math.abs(z - Z_STAR_EXACT);

    if (k === 0) {
      filas.push({
        k,
        z,
        fz,
        dfz,
        delta: null,
        errExacto,
        nota: "Inicio z₀ (Híbrido)"
      });
    }

    if (Math.abs(fz) <= tolF && k > 0) {
      convergido = true;
      break;
    }

    if (k === maxIter) {
      motivoFallo = "Límite de iteraciones alcanzado.";
      break;
    }

    const fa = evaluarF(a, p);
    if (fa * fz < 0) {
      b = z;
    } else {
      a = z;
    }

    let zNext;
    let delta;
    let nota = "";

    let usarBiseccion = false;
    if (Math.abs(dfz) < 1e-12) {
      usarBiseccion = true;
      nota = "🛡️ Rescate Bisección: f′ ≈ 0 detectada";
    } else {
      delta = -fz / dfz;

      if (Math.abs(delta) > maxStep) {
        usarBiseccion = true;
        nota = `🛡️ Rescate Bisección: |Δz| = ${Math.abs(delta).toFixed(1)} > ${maxStep} (Catapulta evitada)`;
      } else {
        zNext = z + delta;
        if (zNext < aInit || zNext > bInit) {
          usarBiseccion = true;
          nota = "🛡️ Rescate Bisección: z fuera de dominio admisible";
        }
      }
    }

    if (usarBiseccion) {
      zNext = (a + b) / 2;
      delta = zNext - z;
    } else {
      nota = "⚡ Newton amortiguado";
    }

    filas.push({
      k: k + 1,
      z: zNext,
      fz: evaluarF(zNext, p),
      dfz: evaluarDF(zNext),
      delta,
      errExacto: Math.abs(zNext - Z_STAR_EXACT),
      nota
    });

    if (Math.abs(delta) <= tolX && Math.abs(evaluarF(zNext, p)) <= tolF) {
      convergido = true;
      z = zNext;
      break;
    }

    z = zNext;
  }

  const t1 = performance.now();
  const ultimaFila = filas[filas.length - 1];

  return {
    metodo: "Newton Híbrido Protegido",
    convergido,
    motivoFallo,
    raiz: ultimaFila.z,
    iteraciones: filas.length - 1,
    residuoFinal: Math.abs(ultimaFila.fz),
    errorFinalX: ultimaFila.delta !== null ? Math.abs(ultimaFila.delta) : 0,
    tiempoMs: t1 - t0,
    filas
  };
}

// ========================================
// 6. SIMULADOR Y CALCULADORA COMPARATIVA
// ========================================

let ultimoExperimento = null;

function configurarSimulador() {
  const form = $("formSim");
  const btnReset = $("btnReset");
  const btnCsv = $("btnCsv");
  const btnInforme = $("btnInforme");
  const selectHist = $("historyMethod");

  if (!form) return;

  form.addEventListener("submit", e => {
    e.preventDefault();
    ejecutarSimulacion();
  });

  if (btnReset) {
    btnReset.addEventListener("click", () => {
      $("calcZ0").value = "0";
      $("calcZprev").value = "-0.5";
      $("calcTolX").value = "0.0001";
      $("calcTolF").value = "0.0001";
      $("calcMax").value = "100";
      $("simResultados").hidden = true;
      $("calcError").hidden = true;
      btnCsv.disabled = true;
      btnInforme.disabled = true;
    });
  }

  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $("calcZ0").value = btn.dataset.z;
      if (btn.dataset.zp) $("calcZprev").value = btn.dataset.zp;
      ejecutarSimulacion();
    });
  });

  if (selectHist) {
    selectHist.addEventListener("change", () => {
      pintarHistorial();
    });
  }

  if (btnCsv) {
    btnCsv.addEventListener("click", descargarCsv);
  }

  if (btnInforme) {
    btnInforme.addEventListener("click", descargarInforme);
  }
}

function ejecutarSimulacion() {
  const z0 = Number($("calcZ0").value);
  const zPrev = Number($("calcZprev").value);
  const tolX = Number($("calcTolX").value);
  const tolF = Number($("calcTolF").value);
  const maxIter = parseInt($("calcMax").value, 10);
  const errorBox = $("calcError");

  errorBox.hidden = true;
  errorBox.textContent = "";

  if (!Number.isFinite(z0) || !Number.isFinite(zPrev) || !Number.isFinite(tolX) || !Number.isFinite(tolF) || !Number.isFinite(maxIter)) {
    errorBox.textContent = "Error: Por favor completa todos los parámetros con valores numéricos válidos.";
    errorBox.hidden = false;
    return;
  }

  if (tolX <= 0 || tolF <= 0 || maxIter < 1) {
    errorBox.textContent = "Error: Las tolerancias deben ser estrictamente positivas y las iteraciones al menos 1.";
    errorBox.hidden = false;
    return;
  }

  try {
    const resNewton = ejecutarNewtonRaphson(z0, tolX, tolF, maxIter);
    const resSecante = ejecutarSecante(z0, zPrev, tolX, tolF, maxIter);
    const resPuntoFijo = ejecutarPuntoFijo(z0, tolX, tolF, maxIter);
    const resHibrido = ejecutarNewtonHibrido(z0, tolX, tolF, maxIter);

    ultimoExperimento = {
      z0,
      zPrev,
      tolX,
      tolF,
      maxIter,
      metodos: [resNewton, resSecante, resPuntoFijo, resHibrido],
      newton: resNewton,
      secante: resSecante,
      puntofijo: resPuntoFijo,
      hibrido: resHibrido
    };

    pintarMetricas(ultimoExperimento);
    pintarTabla(ultimoExperimento.metodos);
    pintarDiagnostico(ultimoExperimento);
    pintarRecomendacion(ultimoExperimento);
    pintarHistorial();

    $("simResultados").hidden = false;
    $("btnCsv").disabled = false;
    $("btnInforme").disabled = false;

    generarGrafico();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.hidden = false;
    $("simResultados").hidden = true;
    $("btnCsv").disabled = true;
    $("btnInforme").disabled = true;
  }
}

function pintarMetricas(exp) {
  $("mRaizRef").textContent = Z_STAR_EXACT.toFixed(5);

  const n = exp.newton;
  const s = exp.secante;
  const h = exp.hibrido;

  if (n.convergido) {
    $("mIterNewton").textContent = n.iteraciones;
    $("mEstadoNewton").textContent = "Cuadrática (p = 2)";
    $("mEstadoNewton").className = "metric-unit text-success fw-bold";
  } else {
    $("mIterNewton").textContent = "Fallo";
    $("mEstadoNewton").textContent = "Catapulta / Límite";
    $("mEstadoNewton").className = "metric-unit text-danger fw-bold";
  }

  if (s.convergido) {
    $("mIterSecante").textContent = s.iteraciones;
    $("mEstadoSecante").textContent = "Superlineal (p ≈ 1.62)";
    $("mEstadoSecante").className = "metric-unit text-success fw-bold";
  } else {
    $("mIterSecante").textContent = "Fallo";
    $("mEstadoSecante").textContent = "Pendiente nula";
    $("mEstadoSecante").className = "metric-unit text-danger fw-bold";
  }

  $("mIterHibrido").textContent = `${h.iteraciones} pasos`;
}

function pintarTabla(metodos) {
  const tbody = $("tablaBenchmark");
  tbody.innerHTML = "";

  metodos.forEach(m => {
    const fila = document.createElement("tr");
    let estadoHTML = "";

    if (m.convergido) {
      estadoHTML = '<span class="status status-ok"><i class="bi bi-check-lg" aria-hidden="true"></i>Convergido</span>';
    } else {
      estadoHTML = `<span class="status status-bad" title="${m.motivoFallo || ''}"><i class="bi bi-x-circle" aria-hidden="true"></i>Fallo / Divergencia</span>`;
    }

    fila.innerHTML = `
      <th scope="row">${m.metodo}</th>
      <td class="num">${Number.isFinite(m.raiz) ? m.raiz.toFixed(5) : "—"}</td>
      <td class="num">${m.iteraciones}</td>
      <td class="num">${fmtAuto(m.residuoFinal)}</td>
      <td class="num">${fmtAuto(m.errorFinalX)}</td>
      <td class="num">${m.tiempoMs.toFixed(2)}</td>
      <td>${estadoHTML}</td>
    `;
    tbody.appendChild(fila);
  });
}

function pintarDiagnostico(exp) {
  const lista = $("diagnostico");
  lista.innerHTML = "";
  const items = [];

  const n = exp.newton;
  const s = exp.secante;
  const pf = exp.puntofijo;
  const h = exp.hibrido;

  if (n.convergido) {
    items.push({
      clase: "is-ok",
      html: `<strong>Newton-Raphson veloz:</strong> Desde z₀ = ${exp.z0}, el método convergió en apenas <strong>${n.iteraciones} iteraciones</strong>. Demuestra la duplicación cuadrática de dígitos significativos por estar dentro de la cuenca de atracción.`
    });
  } else {
    items.push({
      clase: "is-bad",
      html: `<strong>Catapulta en Newton-Raphson:</strong> Con z₀ = ${exp.z0}, el algoritmo falló (${n.motivoFallo}). La derivada f′(z₀) se desvaneció, provocando un salto desmedido que catapultó la variable fuera de los límites numéricos de doble precisión.`
    });
  }

  if (s.convergido) {
    items.push({
      clase: "is-ok",
      html: `<strong>Secante exitosa:</strong> Concluyó en <strong>${s.iteraciones} pasos</strong> sin evaluar la derivada analítica. Su tasa de convergencia superlineal (p ≈ 1.618) es casi tan rápida como Newton.`
    });
  } else {
    items.push({
      clase: "is-bad",
      html: `<strong>Inestabilidad en la Secante:</strong> Falló debido a una pendiente incremental casi horizontal entre z₋₁ = ${exp.zPrev} y z₀ = ${exp.z0}.`
    });
  }

  if (pf.convergido) {
    items.push({
      clase: "is-info",
      html: `<strong>Punto Fijo relajado g(z) = z − 4f(z):</strong> Convergió en <strong>${pf.iteraciones} pasos</strong>. Dado que |g′(z*)| ≈ 0.4356 &lt; 1, la contracción está matemáticamente garantizada, aunque a velocidad lineal (p = 1).`
    });
  } else {
    items.push({
      clase: "is-warn",
      html: `<strong>Punto Fijo fuera de contracción:</strong> En z₀ = ${exp.z0}, el valor inicial cayó en la región donde |g′(z)| ≥ 1, impidiendo el atrapamiento hacia la raíz.`
    });
  }

  items.push({
    clase: "is-ok",
    html: `<strong>Garantía Absoluta del Algoritmo Híbrido:</strong> El método protegido combinó la aceleración cuadrática de Newton con el rescate por Bisección, finalizando en <strong>${h.iteraciones} pasos</strong> de forma completamente estable y segura.`
  });

  items.forEach(it => {
    const li = document.createElement("li");
    li.className = it.clase;
    li.innerHTML = it.html;
    lista.appendChild(li);
  });
}

function pintarRecomendacion(exp) {
  const caja = $("cajaRecomendacion");
  const n = exp.newton;

  let alertaNewton = "";
  if (!n.convergido) {
    alertaNewton = `
      <div class="decision-card is-danger mb-2">
        <span class="small fw-bold text-danger text-uppercase">Riesgo en Producción</span>
        <div class="small mt-1">Nunca uses Newton estándar con arranques lejanos (z₀ = ${exp.z0}) en funciones sigmoides sin control de amortiguamiento.</div>
      </div>
    `;
  } else {
    alertaNewton = `
      <div class="decision-card is-safe mb-2">
        <span class="small fw-bold text-success text-uppercase">Arranque Seguro</span>
        <div class="small mt-1">z₀ = ${exp.z0} pertenece a la cuenca de atracción segura. Newton completó en solo ${n.iteraciones} pasos.</div>
      </div>
    `;
  }

  caja.innerHTML = `
    <p class="text-secondary small mb-2">
      Para el modelo sigmoide <code>f(z) = σ(z) − 0.83 = 0</code>, la raíz teórica es <strong>z* ≈ ${Z_STAR_EXACT.toFixed(5)}</strong>.
    </p>
    ${alertaNewton}
    <div class="decision-card is-safe mb-2">
      <span class="small fw-bold text-primary text-uppercase">Protocolo Recomendado</span>
      <div class="small mt-1">
        <strong>1. Cuenca de inicialización recomendada:</strong> z₀ ∈ [−1.5, 3.5] donde f′(z) ≥ 0.05.<br>
        <strong>2. Protección híbrida obligatoria:</strong> Acotar el paso a |Δz| ≤ 3.0. Si el residuo crece, ejecutar un paso dicotómico de Bisección.
      </div>
    </div>
    <p class="small text-muted mb-0">
      <strong>Dictamen:</strong> En librerías de producción (tipo SciPy <code>scipy.optimize.brentq</code>), los algoritmos híbridos son el estándar de la industria.
    </p>
  `;
}

function pintarHistorial() {
  if (!ultimoExperimento) return;
  const metodoKey = $("historyMethod").value;
  const res = ultimoExperimento[metodoKey];
  const tbody = $("historyBody");
  tbody.innerHTML = "";

  res.filas.forEach(row => {
    const tr = document.createElement("tr");

    let dfStr = "—";
    if (row.dfz !== null && Number.isFinite(row.dfz)) {
      dfStr = Math.abs(row.dfz) < 1e-4 ? row.dfz.toExponential(3) : row.dfz.toFixed(4);
    }

    let deltaStr = "—";
    if (row.delta !== null && Number.isFinite(row.delta)) {
      deltaStr = `${row.delta >= 0 ? "+" : ""}${Math.abs(row.delta) > 1e4 ? row.delta.toExponential(3) : row.delta.toFixed(4)}`;
    }

    const errStr = Number.isFinite(row.errExacto) ? fmtAuto(row.errExacto) : "∞";

    tr.innerHTML = `
      <td><strong>${row.k}</strong></td>
      <td class="num">${Number.isFinite(row.z) ? (Math.abs(row.z) > 1e4 ? row.z.toExponential(4) : row.z.toFixed(5)) : "NaN"}</td>
      <td class="num">${Number.isFinite(row.fz) ? fmtAuto(row.fz) : "NaN"}</td>
      <td class="num font-mono small">${dfStr}</td>
      <td class="num font-mono small">${deltaStr}</td>
      <td class="num font-mono small">${errStr}</td>
      <td class="small">${row.nota}</td>
    `;
    tbody.appendChild(tr);
  });
}

function descargarCsv() {
  if (!ultimoExperimento) return;
  const metodoKey = $("historyMethod").value;
  const res = ultimoExperimento[metodoKey];

  let csv = `k,z_k,f(z_k),derivada_o_pendiente,delta_z,error_exacto,nota\n`;
  res.filas.forEach(r => {
    csv += `${r.k},${r.z},${r.fz},${r.dfz || ""},${r.delta || ""},${r.errExacto},"${r.nota}"\n`;
  });

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `MetNum_LAB03_${metodoKey}_traza.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(enlace.href);
}

function descargarInforme() {
  if (!ultimoExperimento) return;
  const exp = ultimoExperimento;

  let texto = `========================================================================\n`;
  texto += `INFORME TÉCNICO DE LABORATORIO 03: MÉTODOS ABIERTOS Y CATAPULTA\n`;
  texto += `Asignatura: Métodos Numéricos para Ingeniería | MetNum\n`;
  texto += `Fecha: ${new Date().toLocaleString("es-PE")}\n`;
  texto += `========================================================================\n\n`;

  texto += `1. PARÁMETROS DEL CASO DE ESTUDIO:\n`;
  texto += `   - Función modelo: f(z) = 1 / (1 + exp(-z)) - 0.83 = 0\n`;
  texto += `   - Raíz analítica exacta: z* = ln(83/17) = ${Z_STAR_EXACT.toFixed(8)}\n`;
  texto += `   - Valor inicial z0: ${exp.z0}\n`;
  texto += `   - Valor auxiliar z-1: ${exp.zPrev}\n`;
  texto += `   - Tolerancia en x (tol_x): ${exp.tolX}\n`;
  texto += `   - Tolerancia en f (tol_f): ${exp.tolF}\n\n`;

  texto += `2. BENCHMARK COMPARATIVO:\n`;
  texto += `   ------------------------------------------------------------------------------------------------\n`;
  texto += `   Método                    | Iteraciones | Raíz Final  | Residuo |f|     | Error |Δz|      | Estado\n`;
  texto += `   ------------------------------------------------------------------------------------------------\n`;
  exp.metodos.forEach(m => {
    const estado = m.convergido ? "CONVERGIDO" : "FALLO";
    const raiz = Number.isFinite(m.raiz) ? m.raiz.toFixed(6) : "NaN";
    texto += `   ${m.metodo.padEnd(25)} | ${String(m.iteraciones).padEnd(11)} | ${raiz.padEnd(11)} | ${fmtAuto(m.residuoFinal).padEnd(15)} | ${fmtAuto(m.errorFinalX).padEnd(15)} | ${estado}\n`;
  });
  texto += `   ------------------------------------------------------------------------------------------------\n\n`;

  texto += `3. CONCLUSIONES Y RECOMENDACIÓN DE INGENIERÍA:\n`;
  texto += `   - Los métodos abiertos (Newton y Secante) poseen un orden de convergencia superior (cuadrático y superlineal),\n`;
  texto += `     pero carecen de garantía incondicional cuando f'(z) tiende a cero en las colas de saturación.\n`;
  texto += `   - Para z0 lejano de la raíz (ej. z0 = -8 u 8), Newton-Raphson sufre el 'efecto catapulta',\n`;
  texto += `     multiplicando el paso por miles y provocando desbordamiento numérico (overflow).\n`;
  texto += `   - Se recomienda inicializar en el intervalo seguro z0 in [-1.5, 3.5] o utilizar la rutina Híbrida\n`;
  texto += `     con amortiguamiento (|Δz| <= 3.0) y conmutación de rescate a Bisección.\n`;

  const blob = new Blob(["\ufeff" + texto], { type: "text/plain;charset=utf-8;" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `MetNum_LAB03_Informe_Tecnico.txt`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(enlace.href);
}

// ========================================
// 7. GRÁFICA INTERACTIVA CON CHART.JS
// ========================================

let chartErrorInstancia = null;

function configurarGraficos() {
  const btn = $("btnGrafico");
  const modo = $("modoGrafico");
  const switchLog = $("logScale");

  if (btn) btn.addEventListener("click", generarGrafico);
  if (modo) {
    modo.addEventListener("change", () => {
      const contenedorLog = $("contenedorLog");
      if (contenedorLog) {
        contenedorLog.style.display = modo.value === "convergencia" ? "inline-block" : "none";
      }
      generarGrafico();
    });
  }
  if (switchLog) switchLog.addEventListener("change", generarGrafico);
}

function generarGrafico() {
  const ctx = $("errorChart");
  if (!ctx || typeof Chart === "undefined") return;

  if (chartErrorInstancia) {
    chartErrorInstancia.destroy();
    chartErrorInstancia = null;
  }

  const vacioMsg = $("chartVacio");
  if (vacioMsg) vacioMsg.style.display = "none";

  const exp = ultimoExperimento;
  const modo = $("modoGrafico").value;

  Chart.defaults.font.family = '"IBM Plex Sans", system-ui, sans-serif';
  Chart.defaults.color = "#3d4c66";

  if (modo === "convergencia") {
    if (!exp) {
      if (vacioMsg) vacioMsg.style.display = "block";
      return;
    }

    const esLog = $("logScale").checked;
    const n = exp.newton;
    const s = exp.secante;
    const pf = exp.puntofijo;
    const h = exp.hibrido;

    const maxK = Math.max(n.filas.length, s.filas.length, pf.filas.length, h.filas.length);
    const labels = Array.from({ length: maxK }, (_, i) => `Paso ${i}`);

    function extraerDatos(filas) {
      return filas.map(r => {
        if (!Number.isFinite(r.errExacto) || r.errExacto <= 0) return esLog ? 1e-16 : 0;
        return esLog ? Math.max(r.errExacto, 1e-16) : r.errExacto;
      });
    }

    chartErrorInstancia = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: `Newton (${n.convergido ? `${n.iteraciones} it` : "Fallo"})`,
            data: extraerDatos(n.filas),
            borderColor: "#4f46e5",
            backgroundColor: "#4f46e5",
            borderWidth: 2,
            pointRadius: 3,
            fill: false,
            tension: 0.15
          },
          {
            label: `Secante (${s.convergido ? `${s.iteraciones} it` : "Fallo"})`,
            data: extraerDatos(s.filas),
            borderColor: "#0ea5e9",
            backgroundColor: "#0ea5e9",
            borderWidth: 2,
            pointRadius: 2.5,
            fill: false,
            tension: 0.15
          },
          {
            label: `Punto Fijo (${pf.convergido ? `${pf.iteraciones} it` : "Fallo"})`,
            data: extraerDatos(pf.filas),
            borderColor: "#f59e0b",
            backgroundColor: "#f59e0b",
            borderWidth: 2,
            pointRadius: 2,
            fill: false,
            tension: 0.15
          },
          {
            label: `Híbrido Protegido (${h.iteraciones} it)`,
            data: extraerDatos(h.filas),
            borderColor: "#10b981",
            backgroundColor: "#10b981",
            borderWidth: 2.5,
            borderDash: [4, 3],
            pointRadius: 2.5,
            fill: false,
            tension: 0.15
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
              label: c => `${c.dataset.label}: ${fmtAuto(c.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: "Número de Iteración (k)" },
            grid: { display: false }
          },
          y: {
            type: esLog ? "logarithmic" : "linear",
            title: { display: true, text: esLog ? "Error absoluto |z_k − z*| (escala log)" : "Error absoluto |z_k − z*|" },
            grid: { color: "#e3e8f0" }
          }
        }
      }
    });

    $("notaGrafico").textContent = "La escala logarítmica evidencia la caída vertical casi instantánea de Newton frente al avance lineal de Punto Fijo y la solidez del rescate híbrido.";
  } else {
    const numPuntos = 120;
    const zVals = [];
    const fVals = [];
    const zeroVals = [];
    const zMin = -8;
    const zMax = 8;

    for (let i = 0; i <= numPuntos; i++) {
      const z = zMin + ((zMax - zMin) * i) / numPuntos;
      zVals.push(z);
      fVals.push(evaluarF(z));
      zeroVals.push(0);
    }

    const z0 = exp ? exp.z0 : 0;
    const f0 = evaluarF(z0);
    const df0 = evaluarDF(z0);

    const tangenteVals = zVals.map(z => {
      const y = f0 + df0 * (z - z0);
      return (y < -2 || y > 2) ? null : y;
    });

    chartErrorInstancia = new Chart(ctx, {
      type: "line",
      data: {
        labels: zVals.map(z => z.toFixed(2)),
        datasets: [
          {
            label: "f(z) = σ(z) − 0.83",
            data: fVals,
            borderColor: "#4f46e5",
            backgroundColor: "rgba(79, 70, 229, 0.08)",
            borderWidth: 2.5,
            pointRadius: 0,
            fill: true,
            tension: 0.15
          },
          {
            label: "Eje f = 0 (Cero de la función)",
            data: zeroVals,
            borderColor: "#94a3b8",
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: 0,
            fill: false
          },
          {
            label: `Recta Tangente en z₀ = ${z0}`,
            data: tangenteVals,
            borderColor: "#dc2626",
            borderWidth: 1.8,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false
          },
          {
            label: `Raíz Exacta z* ≈ ${Z_STAR_EXACT.toFixed(3)}`,
            data: [{ x: Z_STAR_EXACT.toFixed(2), y: 0 }],
            type: "scatter",
            backgroundColor: "#10b981",
            borderColor: "#ffffff",
            borderWidth: 2,
            pointRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, boxWidth: 8 }
          }
        },
        scales: {
          x: {
            title: { display: true, text: "Variable de Activación z" },
            grid: { display: false }
          },
          y: {
            min: -1.0,
            max: 0.4,
            title: { display: true, text: "Residuo f(z)" },
            grid: { color: "#e3e8f0" }
          }
        }
      }
    });

    $("notaGrafico").textContent = `Curva de activación sigmoide con saturación asintótica. La recta tangente en z₀ ilustra la proyección que genera el paso Δz = −f(z₀)/f′(z₀).`;
  }
}

// ========================================
// 8. TEST TEÓRICO PREVIO (RELACIÓN DE CONCEPTOS)
// ========================================

const bancoPreguntasTeoricas = [
  {
    id: "t1",
    titulo: "Métodos Abiertos y Órdenes de Convergencia",
    instruccion: "Asocia cada concepto matemático o algoritmo con su principio técnico o tasa asintótica:",
    pares: [
      {
        id: "p1",
        termino: "Convergencia Cuadrática (p = 2)",
        definicion: "Propiedad del método de Newton cerca de la raíz donde el error satisface e_{k+1} ≈ C·e_k², duplicando los dígitos significativos en cada paso.",
        explicacion: "Cerca de una raíz simple con f'(x*) ≠ 0, la recta tangente modela con alta fidelidad a la curva, logrando duplicar precisión por iteración."
      },
      {
        id: "p2",
        termino: "Método de la Secante",
        definicion: "Aproxima la derivada mediante el cociente incremental entre los dos últimos puntos conocidos, alcanzando orden superlineal áureo (p ≈ 1.618).",
        explicacion: "Evita calcular la derivada analítica f'(x), requiriendo únicamente una nueva evaluación funcional por paso."
      },
      {
        id: "p3",
        termino: "Iteración de Punto Fijo z = g(z)",
        definicion: "Converge linealmente (p = 1) a la raíz si y sólo si la derivada satisface la condición de Lipschitz |g'(z*)| < 1 en el entorno del cero.",
        explicacion: "Si |g'(z*)| ≥ 1, la iteración es una repulsión y diverge alejándose progresivamente de la solución."
      },
      {
        id: "p4",
        termino: "Cuenca de Atracción",
        definicion: "Conjunto de condiciones iniciales z₀ a partir de las cuales la sucesión generada por el método abierto converge efectivamente a la raíz deseada.",
        explicacion: "Fuera de la cuenca de atracción, el método de Newton puede divergir hacia el infinito, quedar atrapado en ciclos límite o colapsar por desborde."
      }
    ]
  },
  {
    id: "t2",
    titulo: "Patologías Numéricas y Algoritmos Híbridos",
    instruccion: "Relaciona cada fenómeno numérico u operativa de rescate con su causa y mitigación en ingeniería:",
    pares: [
      {
        id: "p5",
        termino: "Efecto Catapulta por Desvanecimiento",
        definicion: "Ocurre cuando f'(z_k) ≈ 0 en colas asintóticas; el paso Δz = −f/f' se divide por casi cero, proyectando el punto a distancias colosales.",
        explicacion: "En funciones sigmoides f'(±8) ≈ 0.0003, lo que multiplica el residuo por más de 2900 unidades desbordando la memoria IEEE-754."
      },
      {
        id: "p6",
        termino: "Cancelación Catastrófica en Secante",
        definicion: "Sucede cuando f(z_k) ≈ f(z_{k-1}); la resta en el denominador pierde dígitos significativos provocando una división por cero espuria.",
        explicacion: "Dos evaluaciones sucesivas idénticas destruyen la pendiente de la recta secante transformándola en indeterminación."
      },
      {
        id: "p7",
        termino: "Amortiguamiento de Paso (Damping)",
        definicion: "Técnica que acota el avance máximo permitido (|Δz| ≤ Δ_max) para impedir que Newton salte hacia las zonas de saturación o asíntotas.",
        explicacion: "Controla la longitud del vector de paso, asegurando que la iteración permanezca en regiones numéricamente estables."
      },
      {
        id: "p8",
        termino: "Algoritmo Híbrido Protegido (tipo Brent)",
        definicion: "Estrategia que aprovecha la velocidad cuadrática de Newton mientras sea seguro, y conmuta automáticamente a Bisección si detecta divergencia.",
        explicacion: "Combina lo mejor de dos mundos: la rapidez superlineal de los métodos abiertos con la garantía de convergencia incondicional de los métodos cerrados."
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
          <div class="small text-secondary mt-1">
            <i class="bi bi-lightbulb me-1"></i><strong>Explicación:</strong> ${par.explicacion}
          </div>
        ` : ""}
      </div>
    `;
  }).join("");

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
        ` : (indiceTeoriaActual + 1 < total ? `
          <button type="button" class="btn btn-success" id="btnSiguienteTeoria">
            Siguiente Pregunta <i class="bi bi-arrow-right ms-1"></i>
          </button>
        ` : `
          <button type="button" class="btn btn-outline-primary" id="btnReintentarTeoria">
            <i class="bi bi-arrow-repeat me-1"></i>Reiniciar Cuestionario
          </button>
        `)}
      </div>
    </div>
  `;

  contenedor.innerHTML = html;
  enlazarEventosTeoria();
}

function enlazarEventosTeoria() {
  const q = bancoPreguntasTeoricas[indiceTeoriaActual];
  if (!respuestasTeoria[q.id]) respuestasTeoria[q.id] = {};

  document.querySelectorAll(".select-teoria").forEach(sel => {
    sel.addEventListener("change", e => {
      respuestasTeoria[q.id][e.target.dataset.term] = e.target.value;
    });
  });

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

  const btnSiguiente = $("btnSiguienteTeoria");
  if (btnSiguiente) {
    btnSiguiente.addEventListener("click", () => {
      indiceTeoriaActual++;
      estadoTeoriaRevisado = false;
      renderizarPreguntaTeorica();
    });
  }

  const btnReintentar = $("btnReintentarTeoria");
  if (btnReintentar) {
    btnReintentar.addEventListener("click", () => {
      indiceTeoriaActual = 0;
      respuestasTeoria = {};
      estadoTeoriaRevisado = false;
      bancoPreguntasTeoricas.forEach(p => {
        p.opcionesBarajadas = [...p.pares]
          .map(item => ({ id: item.id, texto: item.definicion }))
          .sort(() => Math.random() - 0.5);
      });
      renderizarPreguntaTeorica();
    });
  }
}

// ========================================
// 9. AUTOEVALUACIÓN Y PROBLEMAS AUTÓNOMOS (SISTEMA DIDÁCTICO LAB01)
// ========================================

let ejercicios = [];
let ejercicioActivo = 0;
let guiaActiva = null;

function configurarEjercicio() {
  const contenedor = $("preguntasContainer");
  const selector = $("selectorEjercicios");
  const btnNuevoCaso = $("btnNuevoCaso");

  if (!contenedor) return;

  // 1. Delegación de eventos para la guía interactiva
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

  // 2. Botón Nuevo Caso con valores aleatorios
  if (btnNuevoCaso) {
    btnNuevoCaso.addEventListener("click", () => {
      cerrarGuiaInteractiva();
      inicializarEjercicios();
      renderizarEjercicioActual();
    });
  }

  // 3. Selector de Ejercicio Independiente
  if (selector) {
    selector.addEventListener("click", evento => {
      const boton = evento.target.closest("[data-ej-i]");
      if (!boton) return;
      cambiarEjercicio(Number(boton.dataset.ejI));
    });
  }

  // 4. Delegación de eventos para las preguntas principales
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
    btn.className = i === idx ? "btn btn-primary" : "btn btn-outline-primary";
  });
  renderizarEjercicioActual();
}

function generarDatosEjercicios() {
  // EJERCICIO 1: Paso de Newton y Catapulta en Saturación
  const z0_1 = elegir([-7.0, -7.5, -8.0, -8.5]);
  const p1 = DEFAULT_P;
  const s0_1 = sigmoide(z0_1);
  const f0_1 = s0_1 - p1;
  const df0_1 = s0_1 * (1 - s0_1);
  const deltaZ_1 = -f0_1 / df0_1;
  const z1_1 = z0_1 + deltaZ_1;

  // EJERCICIO 2: Punto Fijo y Condición de Contracción de Lipschitz
  const p2 = elegir([0.80, 0.82, 0.83, 0.85]);
  const lambda2 = elegir([3.5, 4.0, 4.5]);
  const zStar2 = Math.log(p2 / (1 - p2));
  const dfStar2 = p2 * (1 - p2);
  const gPrimeStar = Math.abs(1 - lambda2 * dfStar2);
  const e0_estimado = 1.0;
  const tol_estimada = 0.001;
  const nPasosPF = Math.ceil(Math.log(tol_estimada / e0_estimado) / Math.log(gPrimeStar));

  const lista = [
    {
      id: "ej1",
      titulo: "Ejercicio 1: Paso de Newton y Riesgo de Catapulta en Saturación",
      icono: "bi-lightning-charge",
      badge: "Problema Oficial de Inestabilidad Numérica",
      contexto: `
        <h3>Dinámica de la Tangente en Regiones Asintóticas</h3>
        <p>Un ingeniero de Machine Learning analiza el entrenamiento de un clasificador logístico con función de activación sigmoide continua <strong>σ(z) = 1 / (1 + exp(−z))</strong>.
        Para fijar el umbral de decisión en el <strong>83% (p = ${p1})</strong>, se plantea resolver <code>f(z) = σ(z) − ${p1} = 0</code>.</p>
        <p class="mb-0 text-secondary small">Al inicializar el algoritmo en la cola izquierda asintótica con <strong>z₀ = ${z0_1.toFixed(1)}</strong>, la pendiente de la recta tangente se aplana drásticamente debido al desvanecimiento del gradiente.</p>
        <dl class="givens mt-3">
          <div><dt>Valor Inicial z₀</dt><dd>${z0_1.toFixed(1)}</dd></div>
          <div><dt>Umbral de Probabilidad p</dt><dd>${p1}</dd></div>
          <div><dt>Ecuación Modelo</dt><dd>f(z) = σ(z) − ${p1}</dd></div>
          <div><dt>Derivada Exacta</dt><dd>f′(z) = σ(z)(1 − σ(z))</dd></div>
        </dl>
      `,
      preguntas: [
        {
          id: "p1_1",
          numero: "Pregunta 1.1 ",
          titulo: "Cálculo del Paso de Newton Δz = −f(z₀) / f′(z₀)",
          enunciado: `
            <p>Con el punto de partida <strong>z₀ = ${z0_1.toFixed(1)}</strong>, calcula el paso de avance de Newton-Raphson <strong>Δz = −f(z₀) / f′(z₀)</strong>.
            ¿Cuál es el valor del paso <strong>Δz</strong>? (Conserva 2 decimales; notarás que es un valor positivo muy grande debido a que f′(z₀) es casi cero).</p>
          `,
          unidad: "unidades",
          esperado: deltaZ_1,
          decimales: 2,
          tipo: "real",
          metodoOpciones: [
            {
              id: "newton_analitico",
              nombre: "A) Derivación analítica de la sigmoide: f′(z) = σ(z)(1 − σ(z))",
              esOptimo: true,
              analisis: "✅ <strong>¡Formulación analítica exacta!</strong> La sigmoide posee la propiedad notable de que su derivada se calcula reutilizando su propio valor sin operaciones trascendentes adicionales.",
              recomendacion: "Permite computar f(z) y f′(z) con máxima precisión de máquina."
            },
            {
              id: "diferencias_finitas",
              nombre: "B) Aproximación de f′ por diferencias finitas (f(z+h) − f(z)) / h",
              esOptimo: false,
              analisis: "⚠️ <strong>Vulnerable a cancelación:</strong> En colas asintóticas (donde f ≈ cte), la resta f(z+h) − f(z) pierde precisión por cancelación de dígitos significativos.",
              recomendacion: "Siempre que se conozca la forma analítica de la función de activación, debe usarse la derivada exacta."
            }
          ],
          pista: `Calcula primero σ(${z0_1.toFixed(1)}) = 1 / (1 + exp(${(-z0_1).toFixed(1)})). Luego f(z₀) = σ(${z0_1.toFixed(1)}) − ${p1} (será negativo, aprox. ${(f0_1).toFixed(4)}). Luego la derivada f′(z₀) = σ(z₀)(1 − σ(z₀)) (aprox. ${df0_1.toExponential(3)}). Finalmente divide Δz = −f / f′ (debe ser un valor positivo cercano a ${deltaZ_1.toFixed(1)}).`,
          guiaInteractiva: {
            final: `El paso de Newton calculado es Δz = +${deltaZ_1.toFixed(2)}. Al ser f′(z₀) ≈ ${df0_1.toExponential(3)} extremadamente pequeña, el cociente amplifica el residuo desmedidamente.`,
            pasos: [
              {
                tipo: "numero",
                etiqueta: "Valor de la sigmoide σ(z₀)",
                unidad: "adimensional",
                enunciado: `Evalúa la sigmoide en z₀ = ${z0_1.toFixed(1)}: σ(${z0_1.toFixed(1)}) = 1 / (1 + exp(${(-z0_1).toFixed(1)})).`,
                correcto: s0_1,
                pista: `Calcula exp(${(-z0_1).toFixed(1)}), suma 1 y toma el recíproco.`,
                explicacion: `σ(${z0_1.toFixed(1)}) ≈ ${s0_1.toExponential(4)}.`
              },
              {
                tipo: "numero",
                etiqueta: "Derivada analítica f′(z₀)",
                unidad: "adimensional",
                enunciado: `Calcula f′(${z0_1.toFixed(1)}) = σ(${z0_1.toFixed(1)}) × (1 − σ(${z0_1.toFixed(1)})).`,
                correcto: df0_1,
                pista: `Multiplica ${s0_1.toExponential(3)} por (1 − ${s0_1.toExponential(3)}).`,
                explicacion: `f′(${z0_1.toFixed(1)}) ≈ ${df0_1.toExponential(4)}.`
              },
              {
                tipo: "numero",
                etiqueta: "Paso de Newton Δz",
                unidad: "unidades",
                enunciado: `Calcula el paso completo: Δz = −[${f0_1.toFixed(4)}] / [${df0_1.toExponential(4)}].`,
                correcto: deltaZ_1,
                pista: `Divide −f(z₀) entre f′(z₀). Recuerda que −(−${Math.abs(f0_1).toFixed(4)}) se vuelve positivo.`,
                explicacion: `Δz = −(${f0_1.toFixed(4)}) / (${df0_1.toExponential(4)}) = +${deltaZ_1.toFixed(2)}.`
              }
            ]
          },
          solucion: [
            { txt: `1. Evaluamos la función sigmoide en z₀ = ${z0_1.toFixed(1)}:` },
            { tex: `\\sigma(${z0_1.toFixed(1)}) = \\frac{1}{1 + e^{-(${z0_1.toFixed(1)})}} = \\frac{1}{1 + e^{${(-z0_1).toFixed(1)}}} \\approx ${texSci(s0_1, 4)}` },
            { txt: `2. Calculamos el residuo respecto a la probabilidad objetivo p = ${p1}:` },
            { tex: `f(${z0_1.toFixed(1)}) = \\sigma(${z0_1.toFixed(1)}) - ${p1} = ${s0_1.toFixed(6)} - ${p1} = ${f0_1.toFixed(4)}` },
            { txt: `3. Evaluamos la derivada exacta analítica de la sigmoide:` },
            { tex: `f'(${z0_1.toFixed(1)}) = \\sigma(${z0_1.toFixed(1)})\\cdot(1 - \\sigma(${z0_1.toFixed(1)})) \\approx ${texSci(df0_1, 4)}` },
            { txt: `4. Computamos el paso de Newton Δz:` },
            { tex: `\\Delta z = -\\frac{f(${z0_1.toFixed(1)})}{f'(${z0_1.toFixed(1)})} = -\\frac{${f0_1.toFixed(4)}}{${texSci(df0_1, 4)}} = +${deltaZ_1.toFixed(2)}` },
            { txt: `Diagnóstico: Como la pendiente f′ es del orden de 10⁻⁴, el paso resulta gigantesco (+${deltaZ_1.toFixed(1)} unidades).` }
          ]
        },
        {
          id: "p1_2",
          numero: "Pregunta 1.2 ",
          titulo: "Evaluación de la Primera Iteración z₁ y Diagnóstico de Catapulta",
          enunciado: `
            <p>Con el paso calculado <strong>Δz = ${deltaZ_1.toFixed(2)}</strong>, determina el siguiente punto de iteración <strong>z₁ = z₀ + Δz</strong>.
            ¿Cuál es el valor resultante de <strong>z₁</strong>? (Conserva 2 decimales).</p>
          `,
          unidad: "unidades",
          esperado: z1_1,
          decimales: 2,
          tipo: "real",
          metodoOpciones: [
            {
              id: "control_amortiguado",
              nombre: "A) Detección de salto excesivo y aplicación de amortiguamiento (|Δz| ≤ 3)",
              esOptimo: true,
              analisis: "✅ <strong>¡Protocolo de salvaguarda industrial!</strong> Detecta que |Δz| = " + deltaZ_1.toFixed(1) + " excede la cota de confianza y previene el desbordamiento proyectándolo dentro del dominio.",
              recomendacion: "Esencial en algoritmos tipo Levenberg-Marquardt o métodos híbridos protegidos."
            },
            {
              id: "newton_puro",
              nombre: "B) Ejecución de Newton estándar sin verificación de rango",
              esOptimo: false,
              analisis: "⚠️ <strong>Fallo catastrófico:</strong> z₁ cae en la asíntota opuesta (z₁ ≈ " + z1_1.toFixed(1) + "), donde e⁻ᶻ¹ es cero en IEEE-754 y la siguiente derivada colapsa a f′(z₁) = 0.",
              recomendacion: "Inadmisible en código productivo de misión crítica."
            }
          ],
          pista: `Suma simplemente z₁ = z₀ + Δz: ${z0_1.toFixed(1)} + ${deltaZ_1.toFixed(2)}. El resultado debe ser aprox. ${z1_1.toFixed(2)}.`,
          guiaInteractiva: {
            final: `El nuevo punto es z₁ = ${z1_1.toFixed(2)}. Se produce el fenómeno de la catapulta: la iteración saltó desde la cola negativa a la cola positiva extrema, provocando desborde numérico en el paso siguiente.`,
            pasos: [
              {
                tipo: "numero",
                etiqueta: "Nueva posición z₁",
                unidad: "unidades",
                enunciado: `Calcula z₁ = ${z0_1.toFixed(1)} + ${deltaZ_1.toFixed(2)}.`,
                correcto: z1_1,
                pista: `Resta directamente ${deltaZ_1.toFixed(2)} − ${Math.abs(z0_1)}.`,
                explicacion: `z₁ = ${z0_1.toFixed(1)} + ${deltaZ_1.toFixed(2)} = ${z1_1.toFixed(2)}.`
              },
              {
                tipo: "seleccion",
                enunciado: "¿Qué ocurre en la siguiente iteración al intentar calcular f′(z₁) con z₁ > 50?",
                opciones: [
                  { valor: "cero", texto: "e⁻ᶻ¹ subdesborda a 0.0, provocando f′(z₁) = 0 y división por cero (NaN)" },
                  { valor: "doble", texto: "La derivada se duplica" },
                  { valor: "ok", texto: "Converge de inmediato" }
                ],
                correcto: ["cero"],
                pista: "En doble precisión IEEE-754, si z > 700, exp(-z) subdesborda a 0, haciendo f'(z) = 0.",
                explicacion: `En z₁ ≈ ${z1_1.toFixed(1)}, la sigmoide satura a 1.000000 exacto, su derivada se hace cero y el algoritmo colapsa por indeterminación.`
              }
            ]
          },
          solucion: [
            { txt: `1. Calculamos la siguiente posición del método de Newton z₁ = z₀ + Δz:` },
            { tex: `z_1 = ${z0_1.toFixed(1)} + (${deltaZ_1.toFixed(2)}) = ${z1_1.toFixed(2)}` },
            { txt: `2. Análisis del fenómeno patológico de la Catapulta:` },
            { tex: `z_0 = ${z0_1.toFixed(1)} \\in [-10, 10] \\implies z_1 = ${z1_1.toFixed(2)} \\gg 10 \\quad (\\text{Salto fuera de dominio})` },
            { txt: `3. En la iteración k = 1, la función y su derivada valen:` },
            { tex: `\\sigma(${z1_1.toFixed(2)}) = 1.000000\\dots \\implies f'(${z1_1.toFixed(2)}) = 0.0 \\implies \\Delta z_1 = -\\frac{0.17}{0.0} = \\text{NaN}` },
            { txt: `Conclusión: Sin amortiguamiento ni rescate por bisección, Newton-Raphson diverge irreversiblemente desde este punto.` }
          ]
        }
      ]
    },
    {
      id: "ej2",
      titulo: "Ejercicio 2: Punto Fijo y Condición de Lipschitz / Contracción",
      icono: "bi-arrow-repeat",
      badge: "Problema Oficial de Análisis Asintótico",
      contexto: `
        <h3>Reforma Funcional y Velocidad de Contracción Lineal</h3>
        <p>Para evitar la división por la derivada de Newton, se propone formular el problema <code>f(z) = σ(z) − ${p2} = 0</code>
        como una iteración de punto fijo relajada: <strong>g(z) = z − λ·f(z)</strong>, empleando un factor de relajación constante <strong>λ = ${lambda2.toFixed(1)}</strong>.</p>
        <p class="mb-0 text-secondary small">De acuerdo con el Teorema del Punto Fijo de Banach, la sucesión <code>zₖ₊₁ = g(zₖ)</code> converge si y sólo si la derivada satisface la condición de contracción estricta <code>|g′(z*)| &lt; 1</code> en la raíz.</p>
        <dl class="givens mt-3">
          <div><dt>Probabilidad Umbral p</dt><dd>${p2}</dd></div>
          <div><dt>Factor de Relajación λ</dt><dd>${lambda2.toFixed(1)}</dd></div>
          <div><dt>Raíz Exacta z*</dt><dd>${zStar2.toFixed(4)}</dd></div>
          <div><dt>Derivada f′(z*)</dt><dd>p·(1 − p) = ${dfStar2.toFixed(4)}</dd></div>
        </dl>
      `,
      preguntas: [
        {
          id: "p2_1",
          numero: "Pregunta 2.1 ",
          titulo: "Evaluación del Factor de Contracción Asintótica |g′(z*)|",
          enunciado: `
            <p>Con <strong>g(z) = z − ${lambda2.toFixed(1)}·f(z)</strong> y sabiendo que en la raíz <code>f′(z*) = p·(1 − p) = ${p2} × ${(1 - p2).toFixed(2)} = ${dfStar2.toFixed(4)}</code>,
            calcula el valor absoluto de la derivada del punto fijo en la raíz: <strong>|g′(z*)| = |1 − λ·f′(z*)|</strong>.
            ¿Cuál es el valor de <strong>|g′(z*)|</strong>? (Conserva 4 decimales).</p>
          `,
          unidad: "adimensional",
          esperado: gPrimeStar,
          decimales: 4,
          tipo: "real",
          metodoOpciones: [
            {
              id: "teorema_banach",
              nombre: "A) Verificación analítica de la condición de contracción: |g′(z*)| < 1",
              esOptimo: true,
              analisis: "✅ <strong>¡Condición necesaria y suficiente!</strong> Si |g′(z*)| < 1, existe un entorno donde la aplicación es contractiva y converge a una tasa lineal proporcional a |g′(z*)|.",
              recomendacion: "Garantiza a priori la convergencia antes de gastar recursos de cómputo."
            },
            {
              id: "prueba_empirica",
              nombre: "B) Ejecución por ensayo y error sin derivar g(z)",
              esOptimo: false,
              analisis: "⚠️ <strong>Riesgo de divergencia silenciosa:</strong> Si se elige un λ inadecuado (ej. λ = 15), |g′| > 1 y la iteración oscilará con amplitud creciente sin que el programador sepa el motivo.",
              recomendacion: "El diseño del factor de relajación λ debe satisfacer siempre |1 − λ·f′(z*)| < 1."
            }
          ],
          pista: `Aplica la fórmula: |g′(z*)| = |1 − ${lambda2.toFixed(1)} × ${dfStar2.toFixed(4)}|. Calcula el producto ${lambda2.toFixed(1)} × ${dfStar2.toFixed(4)} = ${(lambda2 * dfStar2).toFixed(4)}, réstalo de 1 y toma el valor absoluto (aprox. ${gPrimeStar.toFixed(4)}).`,
          guiaInteractiva: {
            final: `El factor de contracción en la raíz es |g′(z*)| = ${gPrimeStar.toFixed(4)} < 1. La iteración de punto fijo es estrictamente contractiva y converge a tasa lineal.`,
            pasos: [
              {
                tipo: "numero",
                etiqueta: "Producto λ · f′(z*)",
                unidad: "adimensional",
                enunciado: `Multiplica el factor de relajación por la derivada: ${lambda2.toFixed(1)} × ${dfStar2.toFixed(4)}.`,
                correcto: lambda2 * dfStar2,
                pista: `Multiplica directamente ${lambda2.toFixed(1)} por ${dfStar2.toFixed(4)}.`,
                explicacion: `${lambda2.toFixed(1)} × ${dfStar2.toFixed(4)} = ${(lambda2 * dfStar2).toFixed(4)}.`
              },
              {
                tipo: "numero",
                etiqueta: "Valor absoluto |g′(z*)|",
                unidad: "adimensional",
                enunciado: `Calcula |1 − ${(lambda2 * dfStar2).toFixed(4)}|.`,
                correcto: gPrimeStar,
                pista: `Resta 1 − ${(lambda2 * dfStar2).toFixed(4)} y conserva el valor positivo.`,
                explicacion: `|1 − ${(lambda2 * dfStar2).toFixed(4)}| = ${gPrimeStar.toFixed(4)}.`
              }
            ]
          },
          solucion: [
            { txt: `1. Planteamos la función de punto fijo relajada y su derivada analítica:` },
            { tex: `g(z) = z - ${lambda2.toFixed(1)}\\cdot f(z) \\implies g'(z) = 1 - ${lambda2.toFixed(1)}\\cdot f'(z)` },
            { txt: `2. En la raíz exacta z*, sabemos que σ(z*) = ${p2}, por lo que la derivada vale:` },
            { tex: `f'(z^*) = \\sigma(z^*)(1 - \\sigma(z^*)) = ${p2}\\cdot(1 - ${p2}) = ${dfStar2.toFixed(4)}` },
            { txt: `3. Sustituimos los valores en la condición de contracción de Lipschitz:` },
            { tex: `g'(z^*) = 1 - ${lambda2.toFixed(1)}\\times ${dfStar2.toFixed(4)} = 1 - ${(lambda2 * dfStar2).toFixed(4)} = ${(1 - lambda2 * dfStar2).toFixed(4)}` },
            { tex: `|g'(z^*)| = |${(1 - lambda2 * dfStar2).toFixed(4)}| = ${gPrimeStar.toFixed(4)} < 1` },
            { txt: `Conclusión: Como |g′(z*)| < 1, la iteración es una contracción estricta en un entorno de la raíz.` }
          ]
        },
        {
          id: "p2_2",
          numero: "Pregunta 2.2 ",
          titulo: "Estimación Teórica de Iteraciones de Punto Fijo para tol = 0.001",
          enunciado: `
            <p>Sabiendo que el error decrece aproximadamente según la relación lineal <code>|eₖ| ≈ |g′(z*)|ᵏ · |e₀|</code>, con un error inicial aproximado <strong>|e₀| = ${e0_estimado}</strong> y la razón de contracción <strong>μ = ${gPrimeStar.toFixed(4)}</strong>,
            ¿cuál es el <strong>número entero mínimo de pasos k</strong> estimado para que el error sea menor o igual a <strong>tol = ${tol_estimada}</strong>? (Aplica la función techo ⌈·⌉).</p>
          `,
          unidad: "iteraciones",
          esperado: nPasosPF,
          decimales: 0,
          tipo: "entero",
          metodoOpciones: [
            {
              id: "tasa_asintotica",
              nombre: "A) Estimación logarítmica de pasos de contracción lineal: k ≥ ⌈ln(tol / e₀) / ln(μ)⌉",
              esOptimo: true,
              analisis: "✅ <strong>¡Cota determinista para métodos lineales!</strong> Permite anticipar exactamente cuántas iteraciones se necesitarán para ganar cada dígito de precisión decimal.",
              recomendacion: "Fundamental para comparar costos de CPU entre Punto Fijo y Newton."
            },
            {
              id: "asumir_cuadratico",
              nombre: "B) Asumir que se resuelve en 3 a 4 pasos como Newton",
              esOptimo: false,
              analisis: "⚠️ <strong>Error conceptual grave:</strong> Punto Fijo tiene orden p = 1 (lineal), por lo que requiere muchas más iteraciones que Newton (que tiene p = 2).",
              recomendacion: "Nunca confundir el comportamiento lineal con la aceleración cuadrática."
            }
          ],
          pista: `Aplica la fórmula: k ≥ ln(tol / e₀) / ln(μ). Con tol = ${tol_estimada}, e₀ = ${e0_estimado} y μ = ${gPrimeStar.toFixed(4)}, calcula ln(${tol_estimada}) / ln(${gPrimeStar.toFixed(4)}) = ${(-6.9078).toFixed(2)} / ${(Math.log(gPrimeStar)).toFixed(4)} ≈ ${(Math.log(tol_estimada / e0_estimado) / Math.log(gPrimeStar)).toFixed(2)}. Redondea con techo al siguiente entero (${nPasosPF}).`,
          guiaInteractiva: {
            final: `Se requieren al menos ${nPasosPF} iteraciones de punto fijo para garantizar un error ≤ ${tol_estimada}. Newton lograría la misma tolerancia en solo 3 o 4 pasos.`,
            pasos: [
              {
                tipo: "numero",
                etiqueta: "Logaritmo natural de la tolerancia",
                unidad: "adimensional",
                enunciado: `Calcula ln(${tol_estimada}).`,
                correcto: Math.log(tol_estimada),
                pista: `Usa la función logaritmo natural ln(0.001) ≈ −6.9078.`,
                explicacion: `ln(${tol_estimada}) ≈ ${Math.log(tol_estimada).toFixed(4)}.`
              },
              {
                tipo: "numero",
                etiqueta: "Logaritmo natural de la razón μ",
                unidad: "adimensional",
                enunciado: `Calcula ln(${gPrimeStar.toFixed(4)}).`,
                correcto: Math.log(gPrimeStar),
                pista: `Calcula ln(${gPrimeStar.toFixed(4)}). Será un número negativo.`,
                explicacion: `ln(${gPrimeStar.toFixed(4)}) ≈ ${Math.log(gPrimeStar).toFixed(4)}.`
              },
              {
                tipo: "numero",
                etiqueta: "Número de iteraciones entero",
                unidad: "iteraciones",
                enunciado: `Divide ln(tol)/ln(μ) y redondea hacia arriba: ⌈${(Math.log(tol_estimada / e0_estimado) / Math.log(gPrimeStar)).toFixed(2)}⌉.`,
                correcto: nPasosPF,
                pista: `Toma el entero superior a ${(Math.log(tol_estimada / e0_estimado) / Math.log(gPrimeStar)).toFixed(2)}.`,
                explicacion: `k = ⌈${(Math.log(tol_estimada / e0_estimado) / Math.log(gPrimeStar)).toFixed(2)}⌉ = ${nPasosPF} iteraciones.`
              }
            ]
          },
          solucion: [
            { txt: `1. Planteamos la ecuación asintótica de propagación del error en métodos de orden lineal p = 1:` },
            { tex: `|e_k| \\approx \\mu^k \\cdot |e_0| \\le \\text{tol}` },
            { txt: `2. Sustituimos los valores numéricos: e₀ = ${e0_estimado}, tol = ${tol_estimada} y μ = ${gPrimeStar.toFixed(4)}:` },
            { tex: `(${gPrimeStar.toFixed(4)})^k \\le \\frac{${tol_estimada}}{${e0_estimado}} = ${tol_estimada}` },
            { txt: `3. Tomamos logaritmos naturales en ambos lados (invirtiendo la desigualdad al ser ln(μ) < 0):` },
            { tex: `k \\ge \\frac{\\ln(${tol_estimada})}{\\ln(${gPrimeStar.toFixed(4)})} = \\frac{${Math.log(tol_estimada).toFixed(4)}}{${Math.log(gPrimeStar).toFixed(4)}} \\approx ${(Math.log(tol_estimada / e0_estimado) / Math.log(gPrimeStar)).toFixed(2)}` },
            { txt: `4. Aplicamos la función techo entero para garantizar la tolerancia:` },
            { tex: `k = \\left\\lceil ${(Math.log(tol_estimada / e0_estimado) / Math.log(gPrimeStar)).toFixed(2)} \\right\\rceil = ${nPasosPF}\\ \\text{iteraciones}` },
            { txt: `Comparativa de eficiencia: Punto Fijo requiere ${nPasosPF} iteraciones lineales, mientras que Newton-Raphson lo logra en solo 3 o 4 pasos cuadráticos.` }
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

  escenario.innerHTML = ej.contexto;
  contenedor.innerHTML = "";

  ej.preguntas.forEach((pregunta, pIdx) => {
    const card = document.createElement("div");
    card.id = `pregunta-card-${pIdx}`;
    card.className = "panel" + (pregunta.estado === "correcta" ? " border-success bg-white" : " bg-white");

    let markerClass = pregunta.estado === "correcta" ? "badge bg-success" : "badge bg-primary";
    let statusText = pregunta.estado === "correcta" ? "Resuelto con éxito ✓" : "";

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
      ? pregunta.esperado.toExponential(4)
      : pregunta.esperado.toLocaleString("es-PE", { maximumSignificantDigits: 6 });
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
        const tolerancia = Math.max(Math.abs(paso.correcto) * (paso.tolerancia ?? 0.01), 1e-6);
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
    ? paso.correcto.toExponential(4)
    : paso.correcto.toLocaleString("es-PE", { maximumSignificantDigits: 6 });
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
    ? Math.abs(valor - pregunta.esperado) < 0.1
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
// 10. INICIALIZACIÓN GLOBAL (DOM READY)
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  renderizarFormulas();
  configurarDemoHero();
  configurarNavegacion();
  configurarSimulador();
  configurarGraficos();
  inicializarTestTeorico();
  configurarEjercicio();
});
