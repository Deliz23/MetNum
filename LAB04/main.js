"use strict";

// ========================================
// 1. UTILIDADES
// ========================================

const $ = id => document.getElementById(id);

// Número con separador de miles y cifras significativas
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

// Elimina el ruido de redondeo de 1e-9 para mostrar cargas
function limpiar(n) {
  const r = Math.round(n * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
}

function fmtCarga(n) {
  return limpiar(n).toLocaleString("es-PE", { maximumFractionDigits: 3 });
}

// Notación científica con superíndice (HTML)
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

function texNum(v, dec = 4) {
  if (Math.abs(v) < 0.5 * 10 ** -dec) return "0";
  return String(+v.toFixed(dec));
}

function texMat(M, dec = 4) {
  return "\\begin{bmatrix}" +
    M.map(fila => fila.map(v => texNum(v, dec)).join("&")).join("\\\\") +
    "\\end{bmatrix}";
}

function texVec(v, dec = 4) {
  return "\\begin{bmatrix}" + v.map(x => texNum(x, dec)).join("\\\\") + "\\end{bmatrix}";
}

function texInt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\\,");
}

function subIndice(i, j) {
  return `<sub>${i}${j !== undefined ? "," + j : ""}</sub>`;
}

// ========================================
// 2. NÚCLEO NUMÉRICO: ÁLGEBRA LINEAL DIRECTA
// ========================================

function normaInfMat(M) {
  return Math.max(...M.map(fila => fila.reduce((s, v) => s + Math.abs(v), 0)));
}

function normaInfVec(v) {
  return Math.max(...v.map(Math.abs));
}

function matVec(M, x) {
  return M.map(fila => fila.reduce((s, v, j) => s + v * x[j], 0));
}

function matMul(A, B) {
  return A.map(fila => B[0].map((_, j) => fila.reduce((s, v, k) => s + v * B[k][j], 0)));
}

// Eliminación gaussiana con pivoteo parcial: PA = LU (guarda el historial)
function luPivoteo(A) {
  const n = A.length;
  const M = A.map(fila => fila.slice());
  const perm = [...Array(n).keys()];
  const historial = [];
  const escala = normaInfMat(A) || 1;

  for (let k = 0; k < n; k++) {
    let p = k;
    let max = Math.abs(M[k][k]);

    for (let i = k + 1; i < n; i++) {
      if (Math.abs(M[i][k]) > max) {
        max = Math.abs(M[i][k]);
        p = i;
      }
    }

    if (max <= 1e-12 * escala) {
      return { singular: true, pasoSingular: k, historial };
    }

    let intercambio = null;

    if (p !== k) {
      [M[k], M[p]] = [M[p], M[k]];
      [perm[k], perm[p]] = [perm[p], perm[k]];
      intercambio = [k, p];
    }

    const multiplicadores = [];

    for (let i = k + 1; i < n; i++) {
      const m = M[i][k] / M[k][k];

      M[i][k] = m;
      multiplicadores.push({ fila: i, valor: m });

      for (let j = k + 1; j < n; j++) {
        M[i][j] -= m * M[k][j];
      }
    }

    historial.push({ k, intercambio, pivote: M[k][k], multiplicadores });
  }

  const L = M.map((fila, i) => fila.map((v, j) => (i === j ? 1 : i > j ? v : 0)));
  const U = M.map((fila, i) => fila.map((v, j) => (j >= i ? v : 0)));
  const PA = perm.map(i => A[i].slice());

  return { singular: false, n, M, L, U, PA, perm, historial };
}

// Ly = Pb (sustitución hacia adelante, L con diagonal unitaria)
function sustitucionAdelante(F, b) {
  const y = F.perm.map(i => b[i]);

  for (let i = 0; i < F.n; i++) {
    for (let j = 0; j < i; j++) y[i] -= F.M[i][j] * y[j];
  }

  return y;
}

// Ux = y (sustitución hacia atrás)
function sustitucionAtras(F, y) {
  const x = Array(F.n);

  for (let i = F.n - 1; i >= 0; i--) {
    let s = y[i];

    for (let j = i + 1; j < F.n; j++) s -= F.M[i][j] * x[j];

    x[i] = s / F.M[i][i];
  }

  return x;
}

function resolverLU(F, b) {
  return sustitucionAtras(F, sustitucionAdelante(F, b));
}

// A⁻¹ reutilizando la factorización: n sustituciones dobles
function inversaLU(F) {
  const n = F.n;
  const inv = Array.from({ length: n }, () => Array(n));

  for (let j = 0; j < n; j++) {
    const e = Array(n).fill(0);
    e[j] = 1;

    const col = resolverLU(F, e);

    for (let i = 0; i < n; i++) inv[i][j] = col[i];
  }

  return inv;
}

// Contraste independiente: Gauss–Jordan sobre [A | I] (no usa LU)
function inversaGaussJordan(A) {
  const n = A.length;
  const M = A.map((fila, i) => [...fila, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

  for (let c = 0; c < n; c++) {
    let p = c;

    for (let i = c + 1; i < n; i++) {
      if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
    }

    if (Math.abs(M[p][c]) < 1e-14) return null;

    [M[c], M[p]] = [M[p], M[c]];

    const pivote = M[c][c];

    for (let j = 0; j < 2 * n; j++) M[c][j] /= pivote;

    for (let i = 0; i < n; i++) {
      if (i === c) continue;

      const f = M[i][c];

      for (let j = 0; j < 2 * n; j++) M[i][j] -= f * M[c][j];
    }
  }

  return M.map(fila => fila.slice(n));
}

// Perturba en ±p % los valores no nulos de b (todas las combinaciones de signo)
function sensibilidad(F, b, x, pPorc) {
  const idx = b.map((v, i) => (v !== 0 ? i : -1)).filter(i => i >= 0);
  const p = pPorc / 100;
  const normX = normaInfVec(x);

  let peor = 0;

  for (let mascara = 0; mascara < 2 ** idx.length; mascara++) {
    const bp = b.slice();

    idx.forEach((pos, bit) => {
      const signo = (mascara >> bit) & 1 ? 1 : -1;
      bp[pos] = b[pos] * (1 + signo * p);
    });

    const xp = resolverLU(F, bp);
    const cambio = normaInfVec(xp.map((v, i) => v - x[i])) / normX;

    if (cambio > peor) peor = cambio;
  }

  return peor;
}

// Intervalo de T que mantiene 0 ≤ x_i ≤ capacidad, con x(T) = T·u + v
function rangoFactible(u, v, cap) {
  const tol = 1e-9 * Math.max(1, cap);

  let lo = -Infinity;
  let hi = Infinity;
  let limLo = null;
  let limHi = null;
  let vacio = false;

  u.forEach((ui, i) => {
    if (Math.abs(ui) < 1e-12) {
      if (v[i] < -tol || v[i] > cap + tol) vacio = true;
      return;
    }

    const a = Math.min(-v[i] / ui, (cap - v[i]) / ui);
    const b = Math.max(-v[i] / ui, (cap - v[i]) / ui);

    if (a > lo) { lo = a; limLo = i; }
    if (b < hi) { hi = b; limHi = i; }
  });

  return { lo, hi, limLo, limHi, vacio: vacio || lo > hi };
}

// ========================================
// 3. INICIALIZACIÓN
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
// 4. FÓRMULAS
// ========================================

function renderizarFormulas() {
  if (typeof katex === "undefined") {
    console.warn("No se pudo cargar KaTeX.");
    return;
  }

  const formulas = [
    {
      id: "math-gauss",
      formula: "\\begin{aligned} m_{ik} &= \\frac{a_{ik}^{(k)}}{a_{kk}^{(k)}} \\[4pt] a_{ij}^{(k+1)} &= a_{ij}^{(k)} - m_{ik}\\,a_{kj}^{(k)} \\end{aligned}"
    },
    {
      id: "math-pivot",
      formula: "|a_{pk}^{(k)}| = \\max_{i \\ge k} |a_{ik}^{(k)}| \\quad \\Longrightarrow \\quad |m_{ik}| \\le 1"
    },
    {
      id: "math-lu",
      formula: "\\begin{aligned} PA &= LU \\[4pt] Ly &= Pb, \\quad Ux = y \\end{aligned}"
    },
    {
      id: "math-costo",
      formula: "\\begin{aligned} C_{\\text{repetir}} &= k\\left(\\tfrac23 n^3 + 2n^2\\right) \\[4pt] C_{LU} &= \\tfrac23 n^3 + 2k\\,n^2 \\end{aligned}"
    },
    {
      id: "math-resid",
      formula: "\\begin{aligned} r &= b - A\\hat{x} \\[4pt] \\frac{\\|x - \\hat{x}\\|_\\infty}{\\|x\\|_\\infty} &\\le \\kappa(A)\\,\\frac{\\|r\\|_\\infty}{\\|b\\|_\\infty} \\end{aligned}"
    },
    {
      id: "math-cond",
      formula: "\\begin{aligned} \\kappa(A) &= \\|A\\|_\\infty \\, \\|A^{-1}\\|_\\infty \\[4pt] \\frac{\\|\\delta x\\|_\\infty}{\\|x\\|_\\infty} &\\le \\kappa(A)\\,\\frac{\\|\\delta b\\|_\\infty}{\\|b\\|_\\infty} \\end{aligned}"
    }
  ];

  formulas.forEach(({ id, formula }) => {
    const elemento = $(id);

    if (elemento) {
      katex.render(formula, elemento, { throwOnError: false, displayMode: true });
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
// 5. DEMOSTRACIÓN DE LA PORTADA: PIVOTE PEQUEÑO
// ========================================

function configurarDemoHero() {
  const entrada = $("heroEps");

  if (!entrada) return;

  entrada.addEventListener("input", actualizarDemoHero);

  document.querySelectorAll(".preset").forEach(boton => {
    boton.addEventListener("click", () => {
      entrada.value = boton.dataset.e;
      actualizarDemoHero();
    });
  });

  actualizarDemoHero();
}

function actualizarDemoHero() {
  const eps = Number($("heroEps").value);

  const nop = $("heroNop");
  const piv = $("heroPiv");
  const ref = $("heroRef");
  const mult = $("heroMult");
  const msg = $("heroMsg");

  nop.classList.remove("is-loss");
  msg.classList.remove("is-loss");

  if ($("heroEps").value.trim() === "" || !Number.isFinite(eps) || eps <= 0 || eps >= 1) {
    [nop, piv, ref, mult].forEach(el => (el.textContent = "—"));
    msg.textContent = "Escribe un valor de ε entre 0 y 1, por ejemplo 1e-17.";
    return;
  }

  // Sin pivoteo: [[ε, 1], [1, 1]] x = [1, 2]
  const m = 1 / eps;
  const u22 = 1 - m * 1;
  const y2 = 2 - m * 1;
  const x2n = y2 / u22;
  const x1n = (1 - x2n) / eps;

  // Con pivoteo: se intercambian las filas -> [[1, 1], [ε, 1]] x = [2, 1]
  const u22p = 1 - eps * 1;
  const y2p = 1 - eps * 2;
  const x2p = y2p / u22p;
  const x1p = (2 - x2p) / 1;

  // Solución exacta (despejada a mano)
  const x1r = 1 / (1 - eps);
  const x2r = (1 - 2 * eps) / (1 - eps);

  const par = (a, b) => `x₁ = ${fmtLargo(a, 15)}   x₂ = ${fmtLargo(b, 15)}`;

  nop.textContent = par(x1n, x2n);
  piv.textContent = par(x1p, x2p);
  ref.textContent = par(x1r, x2r);
  mult.textContent = fmtAuto(m);

  const errNop = Math.max(Math.abs(x1n - x1r), Math.abs(x2n - x2r));
  const errPiv = Math.max(Math.abs(x1p - x1r), Math.abs(x2p - x2r));

  if (errNop > 1e-6) {
    nop.classList.add("is-loss");
    msg.classList.add("is-loss");
    msg.textContent =
      `Sin pivoteo el multiplicador 1/ε = ${fmtAuto(m)} aplasta las cifras de la segunda fila y ` +
      `el error llega a ${fmtAuto(errNop)}. Con pivoteo el multiplicador es ε y el error baja a ${fmtAuto(errPiv)}.`;
  } else {
    msg.textContent =
      `Con este ε el pivote aún es lo bastante grande: el error sin pivoteo es ${fmtAuto(errNop)}. ` +
      `Reduce ε para ver cómo se deteriora.`;
  }
}

// ========================================
// 6. BOTÓN VOLVER ARRIBA Y MENÚ
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

      if (
        menu &&
        menu.classList.contains("show") &&
        window.matchMedia("(max-width: 1199.98px)").matches
      ) {
        bootstrap.Collapse.getOrCreateInstance(menu).hide();
      }
    });
  });

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
// 7. SIMULADOR DEL LABORATORIO
// ========================================

const A_DEFECTO = [
  [1, 1, 1, 1],
  [2, -1, 0, 0],
  [0, 1, -2, 0],
  [1, 0, 0, -1]
];

let ultimo = null;

function configurarSimulador() {
  const contenedor = $("matrizA");

  if (!contenedor) return;

  // Cuadrícula editable de 4 × 4
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const campo = document.createElement("input");

      campo.type = "number";
      campo.step = "any";
      campo.id = `mA_${i}_${j}`;
      campo.setAttribute("aria-label", `A fila ${i + 1}, columna ${j + 1}`);

      contenedor.appendChild(campo);
    }
  }

  cargarValoresPorDefecto();

  $("formSim").addEventListener("submit", evento => {
    evento.preventDefault();
    ejecutarSimulador();
  });

  $("btnReset").addEventListener("click", () => {
    cargarValoresPorDefecto();
    ejecutarSimulador();
  });

  $("btnInforme").addEventListener("click", descargarInforme);

  ejecutarSimulador();
}

function cargarValoresPorDefecto() {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      $(`mA_${i}_${j}`).value = A_DEFECTO[i][j];
    }
  }

  $("calcT1").value = 850;
  $("calcT2").value = 1000;
  $("calcT3").value = 1200;
  $("calcB4").value = 120;
  $("calcCap").value = 400;
  $("calcPert").value = 0.1;
}

function mostrarError(texto) {
  const caja = $("calcError");

  if (!texto) {
    caja.hidden = true;
    return;
  }

  caja.textContent = texto;
  caja.hidden = false;
}

function leerDatos() {
  const A = [];

  for (let i = 0; i < 4; i++) {
    const fila = [];

    for (let j = 0; j < 4; j++) {
      const v = $(`mA_${i}_${j}`).value;

      fila.push(v.trim() === "" ? NaN : Number(v));
    }

    A.push(fila);
  }

  const totales = [Number($("calcT1").value), Number($("calcT2").value), Number($("calcT3").value)];
  const b4 = Number($("calcB4").value);
  const cap = Number($("calcCap").value);
  const pert = Number($("calcPert").value);

  const problemas = [];

  if (A.some(fila => fila.some(v => !Number.isFinite(v)))) {
    problemas.push("Todos los coeficientes de A deben ser números.");
  }

  if (totales.some(t => !Number.isFinite(t) || t < 0)) {
    problemas.push("Los tres totales deben ser números no negativos.");
  }

  if (!Number.isFinite(b4)) problemas.push("La diferencia b₄ debe ser un número.");
  if (!Number.isFinite(cap) || cap <= 0) problemas.push("La capacidad debe ser positiva.");
  if (!Number.isFinite(pert) || pert < 0) problemas.push("La perturbación no puede ser negativa.");

  if (problemas.length > 0) {
    mostrarError(problemas.join(" "));
    return null;
  }

  return { A, totales, b4, cap, pert };
}

function ejecutarSimulador() {
  const datos = leerDatos();

  if (!datos) return;

  const { A, totales, b4, cap, pert } = datos;

  // PROGRAMADOR: eliminación con pivoteo y factorización
  const F = luPivoteo(A);

  if (F.singular) {
    mostrarError(
      `La matriz es singular: no hay un pivote utilizable en el paso ${F.pasoSingular + 1}. ` +
      `El sistema no tiene solución única; revisa los coeficientes.`
    );
    $("simResultados").hidden = true;
    $("btnInforme").disabled = true;
    ultimo = null;
    return;
  }

  mostrarError("");

  const inv = inversaLU(F);
  const kappa = normaInfMat(A) * normaInfMat(inv);
  const errorLU = normaInfMat(matMul(F.L, F.U).map((fila, i) => fila.map((v, j) => v - F.PA[i][j])));

  // VERIFICADOR: contraste con Gauss–Jordan
  const invGJ = inversaGaussJordan(A);

  const casos = totales.map(T => {
    const b = [T, 0, 0, b4];
    const x = resolverLU(F, b);
    const r = b.map((bi, i) => bi - matVec(A, x)[i]);
    const normaR = normaInfVec(r);
    const normaB = normaInfVec(b);
    const xGJ = invGJ ? matVec(invGJ, b) : x;
    const dif = normaInfVec(x.map((v, i) => v - xGJ[i]));
    const tol = 1e-9 * Math.max(1, cap);

    const estados = x.map(v => {
      if (v < -tol) return { tipo: "neg", margen: -v };
      if (v > cap + tol) return { tipo: "exc", margen: v - cap };
      return { tipo: "ok", margen: Math.min(v, cap - v) };
    });

    return {
      T,
      b,
      x,
      normaR,
      resRel: normaB > 0 ? normaR / normaB : 0,
      dif,
      sens: sensibilidad(F, b, x, pert),
      cota: kappa * pert / 100,
      estados,
      factible: estados.every(e => e.tipo === "ok")
    };
  });

  // x(T) = T·u + v  (para el rango factible y el gráfico)
  const u = resolverLU(F, [1, 0, 0, 0]);
  const v = resolverLU(F, [0, 0, 0, b4]);
  const rango = rangoFactible(u, v, cap);

  ultimo = { A, F, inv, kappa, errorLU, casos, u, v, rango, cap, pert, b4, totales };

  pintarPivotes(F);
  pintarFactorizacion(F, errorLU);
  pintarSoluciones(casos);
  pintarFactibilidad(casos);
  pintarVerificacion(casos, kappa);
  pintarDiagnostico(ultimo);
  pintarEvidencia(ultimo);

  // Selector de caso del gráfico
  const selector = $("casoGrafico");
  const previo = selector.value;

  selector.innerHTML = "";

  totales.forEach((T, i) => {
    const op = document.createElement("option");

    op.value = i;
    op.textContent = `T = ${fmtCarga(T)} sol/s`;
    selector.appendChild(op);
  });

  if (previo !== "" && Number(previo) < totales.length) selector.value = previo;

  $("simResultados").hidden = false;
  $("btnInforme").disabled = false;

  if ($("errorChart") && typeof Chart !== "undefined") generarGrafico();
}

function pintarPivotes(F) {
  const tbody = $("tablaPivotes");
  tbody.innerHTML = "";

  F.historial.forEach(h => {
    const fila = document.createElement("tr");

    const paso = document.createElement("th");
    paso.scope = "row";
    paso.textContent = h.k + 1;

    const cambio = document.createElement("td");
    cambio.textContent = h.intercambio
      ? `fila ${h.intercambio[0] + 1} ↔ fila ${h.intercambio[1] + 1}`
      : "ninguno";

    const pivote = document.createElement("td");
    pivote.className = "num";
    pivote.textContent = limpiar(h.pivote).toLocaleString("es-PE", { maximumFractionDigits: 4 });

    const mult = document.createElement("td");

    if (h.multiplicadores.length === 0) {
      mult.textContent = "—";
    } else {
      mult.innerHTML = h.multiplicadores
        .map(m => `<span class="nowrap"><em>m</em>${subIndice(m.fila + 1, h.k + 1)} = ${limpiar(m.valor).toLocaleString("es-PE", { maximumFractionDigits: 4 })}</span>`)
        .join("; ");
    }

    fila.append(paso, cambio, pivote, mult);
    tbody.appendChild(fila);
  });
}

function htmlMatriz(M) {
  const filas = M.map(fila =>
    "<tr>" + fila.map(v => {
      const x = limpiar(v);
      const clase = x === 0 ? ' class="is-zero"' : "";

      return `<td${clase}>${x.toLocaleString("es-PE", { maximumFractionDigits: 4 })}</td>`;
    }).join("") + "</tr>"
  ).join("");

  return `<table class="matrix-view" aria-hidden="false"><tbody>${filas}</tbody></table>`;
}

function pintarFactorizacion(F, errorLU) {
  $("viewP").innerHTML = `<span class="perm-vector">(${F.perm.map(i => i + 1).join(", ")})</span>`;
  $("viewL").innerHTML = htmlMatriz(F.L);
  $("viewU").innerHTML = htmlMatriz(F.U);

  const escala = normaInfMat(F.PA) || 1;
  const buena = errorLU <= 1e-12 * escala;

  const insignia = $("checkLU");

  insignia.className = "status " + (buena ? "status-ok" : "status-warn");
  insignia.innerHTML = buena
    ? '<i class="bi bi-check-lg" aria-hidden="true"></i>PA = LU comprobada'
    : "PA = LU con error apreciable";

  $("textoLU").innerHTML =
    `‖<em>PA</em> − <em>LU</em>‖<sub>∞</sub> = ${fmtAuto(errorLU)}. El vector <em>P</em> indica qué fila de <em>A</em> ocupa cada posición ` +
    `de <em>PA</em>; los multiplicadores se numeran según esas filas ya permutadas.`;
}

function insignia(factible) {
  return factible
    ? '<span class="status status-ok"><i class="bi bi-check-lg" aria-hidden="true"></i>Factible</span>'
    : '<span class="status status-bad"><i class="bi bi-x-lg" aria-hidden="true"></i>No factible</span>';
}

function pintarSoluciones(casos) {
  const tbody = $("tablaSoluciones");
  tbody.innerHTML = "";

  casos.forEach(c => {
    const fila = document.createElement("tr");

    fila.innerHTML =
      `<td class="num">${fmtCarga(c.T)}</td>` +
      c.x.map((v, i) => {
        const e = c.estados[i];
        const clase = e.tipo === "ok" ? "" : ' class="num is-bad"';

        return e.tipo === "ok" ? `<td class="num">${fmtCarga(v)}</td>` : `<td${clase}>${fmtCarga(v)}</td>`;
      }).join("") +
      `<td>${insignia(c.factible)}</td>`;

    tbody.appendChild(fila);
  });
}

function pintarFactibilidad(casos) {
  const cabecera = $("theadFact");

  cabecera.innerHTML =
    "<tr><th scope=\"col\">Servidor</th>" +
    casos.map(c => `<th scope="col" class="num">T = ${fmtCarga(c.T)}</th>`).join("") +
    "</tr>";

  const tbody = $("tablaFactibilidad");
  tbody.innerHTML = "";

  for (let i = 0; i < 4; i++) {
    const fila = document.createElement("tr");

    fila.innerHTML =
      `<th scope="row">Servidor ${i + 1}</th>` +
      casos.map(c => {
        const e = c.estados[i];
        const carga = fmtCarga(c.x[i]);

        if (e.tipo === "ok") {
          return `<td class="num is-ok">${carga}<small>margen ${fmtCarga(e.margen)}</small></td>`;
        }

        const texto = e.tipo === "neg"
          ? `carga negativa (${fmtCarga(-e.margen)})`
          : `excede en ${fmtCarga(e.margen)}`;

        return `<td class="num is-bad">${carga}<small>${texto}</small></td>`;
      }).join("");

    tbody.appendChild(fila);
  }
}

function leerCondicion(kappa) {
  if (kappa < 100) return "bien condicionada";
  if (kappa < 1e6) return "condición moderada";
  return "mal condicionada";
}

function pintarVerificacion(casos, kappa) {
  const tbody = $("tablaVerificacion");
  tbody.innerHTML = "";

  casos.forEach(c => {
    const cumple = c.resRel < 1e-10 && c.dif < 1e-8 && c.sens <= c.cota * (1 + 1e-9) + 1e-12;
    const fila = document.createElement("tr");

    fila.innerHTML =
      `<td class="num">${fmtCarga(c.T)}</td>` +
      `<td class="num">${fmtAuto(c.normaR)}</td>` +
      `<td class="num">${sciHTML(c.resRel)}</td>` +
      `<td class="num">${fmtAuto(c.dif)}</td>` +
      `<td class="num">${(c.sens * 100).toLocaleString("es-PE", { maximumSignificantDigits: 3 })} %</td>` +
      `<td class="num">${(c.cota * 100).toLocaleString("es-PE", { maximumSignificantDigits: 3 })} %</td>` +
      `<td>${cumple
        ? '<span class="status status-ok"><i class="bi bi-check-lg" aria-hidden="true"></i>Verificada</span>'
        : '<span class="status status-warn">Revisar</span>'}</td>`;

    tbody.appendChild(fila);
  });

  $("mCond").textContent = kappa.toLocaleString("es-PE", { maximumSignificantDigits: 4 });
  $("mCondTxt").textContent = leerCondicion(kappa);
  $("mResiduo").textContent = fmtAuto(Math.max(...casos.map(c => c.normaR)));
  $("mDif").textContent = fmtAuto(Math.max(...casos.map(c => c.dif)));
}

function textoRango(r) {
  const f = n => fmtCarga(n);

  if (r.vacio) return null;
  if (!Number.isFinite(r.lo) && !Number.isFinite(r.hi)) return "cualquier valor de T";
  if (!Number.isFinite(r.lo)) return `T ≤ ${f(r.hi)} sol/s`;
  if (!Number.isFinite(r.hi)) return `T ≥ ${f(r.lo)} sol/s`;

  return `T entre ${f(r.lo)} y ${f(r.hi)} sol/s`;
}

function corto(n) {
  return n.toLocaleString("es-PE", { maximumSignificantDigits: 4 });
}

function pintarDiagnostico(d) {
  const lista = $("diagnostico");
  lista.innerHTML = "";

  const { F, kappa, errorLU, casos, rango, cap, pert } = d;
  const items = [];

  // 1. Pivoteo
  const intercambios = F.historial.filter(h => h.intercambio).length;
  const pivotes = F.historial.map(h => Math.abs(h.pivote));
  const maxMult = Math.max(0, ...F.historial.flatMap(h => h.multiplicadores.map(m => Math.abs(m.valor))));
  const maxU = Math.max(...F.U.flat().map(Math.abs));
  const maxA = Math.max(...d.A.flat().map(Math.abs));

  items.push({
    clase: "",
    html: `<strong>Pivoteo:</strong> ${intercambios} intercambio${intercambios === 1 ? "" : "s"} de fila. El menor pivote es ` +
      `${corto(Math.min(...pivotes))} y el mayor multiplicador en valor absoluto es ${corto(maxMult)} ` +
      `(el pivoteo parcial lo mantiene ≤ 1). El factor de crecimiento máx|U| / máx|A| es ${corto(maxU / maxA)}.`
  });

  // 2. Condición
  const digitos = Math.log10(kappa);

  items.push({
    clase: kappa < 100 ? "is-ok" : "is-warn",
    html: `<strong>Condición:</strong> κ<sub>∞</sub>(<em>A</em>) = ${kappa.toLocaleString("es-PE", { maximumSignificantDigits: 4 })}, ` +
      `${leerCondicion(kappa)}. Se pierden ≈ ${Math.max(0, digitos).toLocaleString("es-PE", { maximumFractionDigits: 1 })} cifras decimales ` +
      `de las ≈ 16 que ofrece float64.`
  });

  // 3. Sensibilidad
  const peor = Math.max(...casos.map(c => c.sens));
  const cota = kappa * pert / 100;

  items.push({
    clase: "",
    html: `<strong>Sensibilidad:</strong> con una perturbación de ±${pert} % en <em>b</em>, la solución cambia como máximo ` +
      `${(peor * 100).toLocaleString("es-PE", { maximumSignificantDigits: 3 })} %. La cota teórica κ·δ es ` +
      `${(cota * 100).toLocaleString("es-PE", { maximumSignificantDigits: 3 })} %, así que la cota se cumple` +
      `${peor > 0 ? ` y es ${(cota / peor).toLocaleString("es-PE", { maximumSignificantDigits: 2 })} veces más pesimista que lo observado` : ""}.`
  });

  // 4. Factibilidad por caso
  casos.forEach(c => {
    const fallos = c.estados
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.tipo !== "ok");

    if (fallos.length === 0) {
      const margen = Math.min(...c.estados.map(e => e.margen));

      items.push({
        clase: "is-ok",
        html: `<strong>T = ${fmtCarga(c.T)} sol/s:</strong> los cuatro servidores quedan dentro de rango; el menor margen es ${fmtCarga(margen)} sol/s.`
      });
    } else {
      const detalle = fallos
        .map(({ e, i }) => e.tipo === "neg"
          ? `el servidor ${i + 1} recibe una carga negativa (${fmtCarga(c.x[i])})`
          : `el servidor ${i + 1} excede la capacidad (${fmtCarga(c.x[i])} > ${fmtCarga(cap)})`)
        .join("; ");

      items.push({
        clase: "is-warn",
        html: `<strong>T = ${fmtCarga(c.T)} sol/s no es factible:</strong> ${detalle}.`
      });
    }
  });

  // 5. Rango factible de T
  const txtRango = textoRango(rango);

  if (txtRango) {
    const nombre = i => (i === null ? null : `servidor ${i + 1}`);
    const limites = [];

    if (rango.limLo !== null && Number.isFinite(rango.lo)) limites.push(`el límite inferior lo fija el ${nombre(rango.limLo)}`);
    if (rango.limHi !== null && Number.isFinite(rango.hi)) limites.push(`el superior, el ${nombre(rango.limHi)}`);

    items.push({
      clase: "",
      html: `<strong>Rango factible:</strong> con capacidad ${fmtCarga(cap)} sol/s el reparto es factible para ${txtRango}` +
        `${limites.length ? "; " + limites.join(" y ") : ""}.`
    });
  } else {
    items.push({
      clase: "is-warn",
      html: `<strong>Rango factible:</strong> con esta capacidad no existe ningún total <em>T</em> para el que los cuatro servidores sean factibles a la vez.`
    });
  }

  // 6. Reutilización
  items.push({
    clase: "",
    html: `<strong>Reutilización:</strong> la matriz se factorizó una sola vez (PA = LU, error ${fmtAuto(errorLU)}) y esa misma factorización ` +
      `resolvió los ${casos.length} vectores <em>b</em>, los vectores usados para el rango factible y las 4 columnas de <em>A</em><sup>−1</sup> de la condición.`
  });

  items.forEach(item => {
    const li = document.createElement("li");

    li.className = item.clase;
    li.innerHTML = item.html;
    lista.appendChild(li);
  });
}

function pintarEvidencia(d) {
  const lista = $("evidencia");
  lista.innerHTML = "";

  const intercambios = d.F.historial.filter(h => h.intercambio).length;
  const fuera = d.casos.reduce((s, c) => s + c.estados.filter(e => e.tipo !== "ok").length, 0);

  const items = [
    `<strong>A y b:</strong> matriz de 4 × 4 y tres vectores b con T = ${d.totales.map(fmtCarga).join(", ")}.`,
    `<strong>Historial de pivoteo:</strong> ${d.F.historial.length} pasos, ${intercambios} intercambio${intercambios === 1 ? "" : "s"}.`,
    `<strong>Factorización comprobada:</strong> ‖PA − LU‖∞ = ${fmtAuto(d.errorLU)}.`,
    `<strong>Tres soluciones:</strong> una por cada total, con la misma factorización.`,
    `<strong>Residuo y condición:</strong> κ∞(A) = ${d.kappa.toLocaleString("es-PE", { maximumSignificantDigits: 4 })}.`,
    `<strong>Factibilidad por servidor:</strong> ${fuera} ${fuera === 1 ? "combinación servidor-caso fuera" : "combinaciones servidor-caso fuera"} de rango.`
  ];

  items.forEach(html => {
    const li = document.createElement("li");

    li.innerHTML = `<i class="bi bi-check-circle-fill" aria-hidden="true"></i><span>${html}</span>`;
    lista.appendChild(li);
  });
}

// ========================================
// 8. INFORME DESCARGABLE
// ========================================

function textoMatriz(M, dec = 4) {
  const celdas = M.map(fila => fila.map(v => (Math.abs(v) < 0.5 * 10 ** -dec ? 0 : v).toFixed(dec)));
  const ancho = Math.max(...celdas.flat().map(c => c.length));

  return celdas.map(fila => "  [ " + fila.map(c => c.padStart(ancho)).join("  ") + " ]").join("\n");
}

function descargarInforme() {
  if (!ultimo) return;

  const { A, F, kappa, errorLU, casos, rango, cap, pert, b4 } = ultimo;
  const L = [];

  L.push("INFORME: REPARTO DE SOLICITUDES ENTRE CUATRO SERVIDORES");
  L.push("Eliminación gaussiana con pivoteo parcial y factorización PA = LU");
  L.push("");
  L.push("1. DATOS");
  L.push("Matriz A:");
  L.push(textoMatriz(A, 2));
  L.push(`Vectores b = [T, 0, 0, ${b4}] con T = ${casos.map(c => c.T).join(", ")} (sol/s)`);
  L.push(`Capacidad por servidor: ${cap} sol/s. Perturbación de b: ±${pert} %.`);
  L.push("");
  L.push("2. HISTORIAL DE PIVOTEO");

  F.historial.forEach(h => {
    const cambio = h.intercambio ? `intercambio fila ${h.intercambio[0] + 1} <-> fila ${h.intercambio[1] + 1}` : "sin intercambio";
    const mult = h.multiplicadores.map(m => `m${m.fila + 1}${h.k + 1} = ${limpiar(m.valor).toFixed(4)}`).join(", ") || "—";

    L.push(`  Paso ${h.k + 1}: ${cambio}; pivote = ${limpiar(h.pivote).toFixed(4)}; ${mult}`);
  });

  L.push("");
  L.push("3. FACTORIZACIÓN PA = LU");
  L.push(`P (orden de filas de A): (${F.perm.map(i => i + 1).join(", ")})`);
  L.push("L:");
  L.push(textoMatriz(F.L));
  L.push("U:");
  L.push(textoMatriz(F.U));
  L.push(`||PA - LU||inf = ${errorLU.toExponential(3)}`);
  L.push("");
  L.push("4. SOLUCIONES (sol/s)");

  casos.forEach(c => {
    L.push(`  T = ${c.T}: x = (${c.x.map(v => limpiar(v)).join(", ")})  ->  ${c.factible ? "FACTIBLE" : "NO FACTIBLE"}`);
  });

  L.push("");
  L.push("5. RESIDUO, CONDICIÓN Y SENSIBILIDAD");
  L.push(`Condición kappa_inf(A) = ${kappa.toPrecision(5)}`);

  casos.forEach(c => {
    L.push(
      `  T = ${c.T}: ||r||inf = ${c.normaR.toExponential(3)}; residuo relativo = ${c.resRel.toExponential(3)}; ` +
      `dif. con Gauss-Jordan = ${c.dif.toExponential(3)}; sensibilidad = ${(c.sens * 100).toPrecision(3)} % (cota ${(c.cota * 100).toPrecision(3)} %)`
    );
  });

  L.push("");
  L.push("6. FACTIBILIDAD POR SERVIDOR");

  for (let i = 0; i < 4; i++) {
    const partes = casos.map(c => {
      const e = c.estados[i];
      const estado = e.tipo === "ok" ? "OK" : e.tipo === "neg" ? "NEGATIVA" : "EXCEDE";

      return `T=${c.T}: ${limpiar(c.x[i])} (${estado})`;
    });

    L.push(`  Servidor ${i + 1}: ${partes.join(" | ")}`);
  }

  const txt = textoRango(rango);

  L.push("");
  L.push(`Rango factible de T: ${txt ? txt : "ninguno con esta capacidad"}`);

  const blob = new Blob(["\ufeff" + L.join("\r\n")], { type: "text/plain;charset=utf-8" });
  const enlace = document.createElement("a");

  enlace.href = URL.createObjectURL(blob);
  enlace.download = "informe_sistemas_lineales.txt";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  URL.revokeObjectURL(enlace.href);
}

// ========================================
// 9. GRÁFICO
// ========================================

let chartInstance = null;

function configurarGrafico() {
  const boton = $("btnGrafico");
  const modo = $("modoGrafico");
  const caso = $("casoGrafico");

  if (!boton) return;

  boton.addEventListener("click", generarGrafico);

  modo.addEventListener("change", () => {
    caso.disabled = modo.value !== "sens";
    generarGrafico();
  });

  caso.addEventListener("change", generarGrafico);
}

function generarGrafico() {
  if (!ultimo) return;

  if (typeof Chart === "undefined") {
    $("chartVacio").textContent = "No se pudo cargar la biblioteca del gráfico.";
    $("chartVacio").hidden = false;
    return;
  }

  Chart.defaults.font.family = '"IBM Plex Sans", system-ui, sans-serif';
  Chart.defaults.color = "#3d4c66";

  if (chartInstance) chartInstance.destroy();

  const contexto = $("errorChart").getContext("2d");

  if ($("modoGrafico").value === "sens") dibujarSensibilidad(contexto);
  else dibujarCargas(contexto);

  $("chartVacio").hidden = true;
}

function opcionesBase(tituloX, tituloY, tipoX, tipoY) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "nearest" },

    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } }
    },

    scales: {
      x: {
        type: tipoX,
        title: { display: true, text: tituloX },
        grid: { color: "#e3e8f0" }
      },
      y: {
        type: tipoY,
        title: { display: true, text: tituloY },
        grid: { color: "#e3e8f0" }
      }
    }
  };
}

function dibujarCargas(contexto) {
  const { u, v, cap, casos, totales } = ultimo;

  const lo = Math.max(0, Math.min(...totales) * 0.55);
  const hi = Math.max(...totales) * 1.15 || 1;
  const puntos = 40;

  const colores = ["#1d4fd7", "#0e7a55", "#d88a00", "#7a3fd1"];

  const datasets = u.map((ui, i) => ({
    label: `Servidor ${i + 1}`,
    data: Array.from({ length: puntos + 1 }, (_, k) => {
      const T = lo + ((hi - lo) * k) / puntos;
      return { x: T, y: T * ui + v[i] };
    }),
    borderColor: colores[i],
    backgroundColor: colores[i],
    borderWidth: 2,
    pointRadius: 0,
    tension: 0
  }));

  datasets.push({
    label: "Capacidad máxima",
    data: [{ x: lo, y: cap }, { x: hi, y: cap }],
    borderColor: "#b8322c",
    backgroundColor: "#b8322c",
    borderDash: [6, 4],
    borderWidth: 2,
    pointRadius: 0
  });

  datasets.push({
    label: "Casos evaluados",
    data: casos.flatMap(c => c.x.map(val => ({ x: c.T, y: val }))),
    showLine: false,
    borderColor: "#0b1830",
    backgroundColor: "#ffffff",
    pointStyle: "rectRot",
    pointRadius: 6,
    pointBorderWidth: 2
  });

  const opciones = opcionesBase("Total entrante T (sol/s)", "Carga del servidor (sol/s)", "linear", "linear");

  opciones.plugins.tooltip = {
    callbacks: {
      label: ctx => `${ctx.dataset.label}: ${fmtCarga(ctx.parsed.y)} sol/s en T = ${fmtCarga(ctx.parsed.x)}`
    }
  };

  chartInstance = new Chart(contexto, { type: "line", data: { datasets }, options: opciones });

  $("notaGrafico").textContent =
    "Cada recta es la carga de un servidor al variar el total. Donde una recta cruza la línea de capacidad, ese servidor se satura; " +
    "los rombos marcan los casos evaluados.";
}

function dibujarSensibilidad(contexto) {
  const { F, kappa, casos } = ultimo;

  const caso = casos[Number($("casoGrafico").value) || 0];
  const niveles = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5];

  const observado = niveles.map(p => ({ x: p, y: sensibilidad(F, caso.b, caso.x, p) * 100 }))
    .filter(pt => pt.y > 0);

  const cota = niveles.map(p => ({ x: p, y: kappa * p }));

  const datasets = [
    {
      label: "Cambio máximo observado en x",
      data: observado,
      borderColor: "#1d4fd7",
      backgroundColor: "#1d4fd7",
      borderWidth: 2,
      pointRadius: 3
    },
    {
      label: "Cota teórica κ·δ",
      data: cota,
      borderColor: "#b8322c",
      backgroundColor: "#b8322c",
      borderDash: [6, 4],
      borderWidth: 2,
      pointRadius: 3
    }
  ];

  const opciones = opcionesBase("Perturbación relativa de b, δ (%)", "Cambio relativo de x (%)", "logarithmic", "logarithmic");

  opciones.plugins.tooltip = {
    callbacks: {
      label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString("es-PE", { maximumSignificantDigits: 3 })} % para δ = ${ctx.parsed.x} %`
    }
  };

  chartInstance = new Chart(contexto, { type: "line", data: { datasets }, options: opciones });

  $("notaGrafico").textContent =
    `Para T = ${fmtCarga(caso.T)} sol/s, κ∞(A) = ${kappa.toLocaleString("es-PE", { maximumSignificantDigits: 4 })}. ` +
    "La cota κ·δ siempre queda por encima de lo observado; cuanto mayor es κ, más se separa la cota de la realidad y más puede crecer el error.";
}

// ========================================
// 10. EJERCICIO: RED DE TRES NODOS CON LU REUTILIZABLE
// ========================================

const MAX_INTENTOS = 3;
const TOLERANCIA_RELATIVA = 0.005;

let caso = null;

function aleatorio(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

// Genera una matriz 3×3 que obligue a pivotar y con buena condición
function generarSistema() {
  for (let intento = 0; intento < 20000; intento++) {
    const A = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => aleatorio(-9, 9)));

    const col = A.map(fila => Math.abs(fila[0]));
    const maxCol = Math.max(...col);

    // El mayor de la primera columna debe ser único y no estar en la fila 1
    if (col[0] === maxCol || col.filter(c => c === maxCol).length !== 1 || maxCol < 3) continue;

    const F = luPivoteo(A);

    if (F.singular) continue;
    if (F.historial.some(h => Math.abs(h.pivote) < 1.5)) continue;

    const kappa = normaInfMat(A) * normaInfMat(inversaLU(F));

    if (kappa < 3 || kappa > 150) continue;

    const b = [aleatorio(-20, 40), aleatorio(-20, 40), aleatorio(-20, 40)];
    const x = resolverLU(F, b);

    if (Math.abs(x[2]) < 0.5 || normaInfVec(x) > 60) continue;

    return { A, F, kappa, b, x };
  }

  throw new Error("No se pudo generar el sistema");
}

function crearCaso() {
  const { A, F, kappa, b, x } = generarSistema();

  const delta = elegir([0.1, 0.5, 1, 2]);
  const kappaRed = Number(kappa.toFixed(2));
  const cotaPorc = kappaRed * delta;

  const n = elegir([200, 300, 500, 800]);
  const k = elegir([10, 20, 40, 100]);
  const costoLU = (2 / 3) * n ** 3;
  const costoSust = 2 * n ** 2;
  const repetir = k * (costoLU + costoSust);
  const reutilizar = costoLU + k * costoSust;
  const razon = repetir / reutilizar;

  const colA = A.map(fila => fila[0]);
  const piv1 = Math.max(...colA.map(Math.abs));
  const filaPiv = colA.findIndex(v => Math.abs(v) === piv1);

  const intercambios = F.historial.filter(h => h.intercambio).length;
  const signo = intercambios % 2 === 0 ? 1 : -1;
  const u33 = F.U[2][2];
  const det = signo * F.U[0][0] * F.U[1][1] * F.U[2][2];

  const Pb = F.perm.map(i => b[i]);
  const y = sustitucionAdelante(F, b);

  const p = { A, b, kappaRed, delta, n, k, x };

  const partes = [
    {
      titulo: "Primer pivote con pivoteo parcial",
      enunciado:
        `<p>Aplica pivoteo parcial a la primera columna de <em>A</em>. ¿Qué valor absoluto tiene el primer pivote?</p>`,
      unidad: "adim.",
      esperado: piv1,
      decimales: 0,
      tipo: "real",
      pista: "El pivoteo parcial elige, entre las filas de la columna actual, la de mayor valor absoluto. Ese elemento pasa a ser el pivote.",
      solucion: [
        { tex: `\\text{Columna 1}=${texVec(colA, 0)}\\;\\Rightarrow\\;\\max|a_{i1}|=${piv1}\\ \\text{(fila ${filaPiv + 1})}` },
        { txt: `Se intercambian las filas 1 y ${filaPiv + 1}; con ello todos los multiplicadores de la primera columna cumplen |m| ≤ 1.` }
      ]
    },
    {
      titulo: "Último pivote de la factorización",
      enunciado:
        `<p>Completa la eliminación con pivoteo parcial (también en la segunda columna, si hace falta). ` +
        `¿Cuánto vale el último pivote <em>u</em><sub>33</sub> de <em>U</em>, con su signo?</p>`,
      unidad: "adim.",
      esperado: u33,
      decimales: 3,
      tipo: "real",
      pista: "Tras el primer paso, mira la segunda columna de la submatriz 2×2: si el elemento de la fila 3 es mayor en valor absoluto, vuelve a intercambiar. Después elimina una vez más.",
      solucion: [
        { tex: `PA=${texMat(F.PA, 0)}` },
        { tex: `L=${texMat(F.L)},\\qquad U=${texMat(F.U)}` },
        { tex: `u_{33}=${texNum(u33, 4)}\\qquad\\det A=${signo < 0 ? "-" : ""}u_{11}u_{22}u_{33}=${texNum(det, 3)}` },
        { txt: `Hubo ${intercambios} intercambio${intercambios === 1 ? "" : "s"} de fila, así que el signo de la permutación es ${signo > 0 ? "+" : "−"}.` }
      ]
    },
    {
      titulo: "Resolver con la factorización",
      enunciado:
        `<p>Con la factorización <em>PA</em> = <em>LU</em> del apartado anterior, resuelve <em>Ax</em> = <em>b</em> ` +
        `mediante <em>Ly</em> = <em>Pb</em> y <em>Ux</em> = <em>y</em>. ¿Cuánto vale la carga <em>x</em><sub>3</sub>?</p>`,
      unidad: "sol/s",
      esperado: x[2],
      decimales: 3,
      tipo: "real",
      pista: "Primero permuta b según P y resuelve hacia adelante (L tiene unos en la diagonal). Después resuelve hacia atrás desde la última ecuación: x₃ sale de una sola división.",
      solucion: [
        { tex: `Pb=${texVec(Pb, 0)},\\qquad Ly=Pb\\;\\Rightarrow\\;y=${texVec(y)}` },
        { tex: `Ux=y\\;\\Rightarrow\\;x=${texVec(x)}` },
        { tex: `x_3=\\frac{y_3}{u_{33}}=\\frac{${texNum(y[2], 4)}}{${texNum(u33, 4)}}=${texNum(x[2], 3)}\\ \\text{sol/s}` }
      ]
    },
    {
      titulo: "Sensibilidad a errores en b",
      enunciado:
        `<p>Las cargas medidas llevan una incertidumbre relativa de <strong>±${delta} %</strong> en <em>b</em>. ` +
        `Sabiendo que <strong>κ<sub>∞</sub>(<em>A</em>) = ${kappaRed}</strong>, ¿cuál es la cota superior del error relativo de <em>x</em>, en %?</p>`,
      unidad: "%",
      esperado: cotaPorc,
      decimales: 2,
      tipo: "real",
      pista: "Usa ‖δx‖/‖x‖ ≤ κ(A)·‖δb‖/‖b‖ y expresa el resultado en porcentaje: la cota es el producto de la condición por la perturbación relativa.",
      solucion: [
        { tex: `\\frac{\\|\\delta x\\|}{\\|x\\|}\\le\\kappa_\\infty(A)\\,\\frac{\\|\\delta b\\|}{\\|b\\|}=${kappaRed}\\cdot ${delta}\\,\\%=${cotaPorc.toFixed(2)}\\,\\%` },
        { txt: `Con κ ≈ ${kappaRed} se pierden unas ${Math.log10(kappaRed).toFixed(1)} cifras decimales. Es una cota de peor caso: el error real suele ser menor.` }
      ]
    },
    {
      titulo: "Costo de reutilizar la factorización",
      enunciado:
        `<p>En una simulación real hay <strong>n = ${n}</strong> incógnitas y hay que resolver <strong>k = ${k}</strong> vectores <em>b</em> distintos. ` +
        `Usa 2<em>n</em><sup>3</sup>/3 operaciones para eliminar o factorizar y 2<em>n</em><sup>2</sup> por cada par de sustituciones. ` +
        `¿Cuántas veces más operaciones cuesta repetir la eliminación para cada <em>b</em> que factorizar una vez y reutilizar?</p>`,
      unidad: "veces",
      esperado: razon,
      decimales: 1,
      tipo: "real",
      pista: "Repetir cuesta k·(2n³/3 + 2n²). Reutilizar cuesta 2n³/3 + k·2n². La respuesta es el cociente de ambos.",
      solucion: [
        { tex: `C_{\\text{repetir}}=k\\left(\\tfrac23 n^3+2n^2\\right)=${k}\\cdot\\left(${texSci(costoLU)}+${texSci(costoSust)}\\right)=${texSci(repetir)}` },
        { tex: `C_{LU}=\\tfrac23 n^3+2k\\,n^2=${texSci(costoLU)}+${k}\\cdot ${texSci(costoSust)}=${texSci(reutilizar)}` },
        { tex: `\\frac{C_{\\text{repetir}}}{C_{LU}}=${razon.toFixed(1)}` },
        { txt: "Cuanto mayor es k, más se acerca el cociente a k: el trabajo caro se hace una sola vez." }
      ]
    }
  ];

  partes.forEach(parte => {
    parte.estado = "bloqueada";
    parte.intentos = 0;
    parte.entrada = "";
    parte.feedback = null;
    parte.pistaVisible = false;
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
  const { A, b } = caso.p;

  $("escenarioEjercicio").innerHTML = `
    <h3>Balance de tráfico en un clúster de tres nodos</h3>
    <p>
      Tres nodos de un clúster se reparten tráfico. Las ecuaciones de balance de flujo, en solicitudes por segundo (sol/s),
      forman el sistema <em>Ax</em> = <em>b</em>, donde <em>x</em> son las cargas de los nodos. Lo resuelves con eliminación
      gaussiana con <strong>pivoteo parcial</strong> y factorización <em>PA</em> = <em>LU</em>, y reutilizas la factorización
      para otros vectores <em>b</em>.
    </p>
    <div class="math-box" id="escMatriz" aria-label="Matriz A y vector b del sistema"></div>`;

  const caja = $("escMatriz");
  const tex = `A=${texMat(A, 0)},\\qquad b=${texVec(b, 0)}`;

  if (typeof katex !== "undefined") {
    katex.render(tex, caja, { throwOnError: false, displayMode: true });
  } else {
    caja.textContent = tex;
  }
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
    comentario = "Dominas el flujo completo: pivoteo, factorización, sustitución, sensibilidad y costo de reutilizar.";
  } else if (correctas >= 3) {
    comentario = "Buen resultado. Repasa los apartados marcados en rojo y pulsa «Nuevo caso» para practicar con otra matriz.";
  } else {
    comentario = "Revisa el desarrollo de cada apartado y la teoría de pivoteo y factorización LU; después prueba con un caso nuevo.";
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
  }

  html += `</div>`;

  li.innerHTML = html;

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

function detectarOtraUnidad(valor, esperado) {
  const factores = [100, 0.01, 1e3, 1e-3];

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
    parte.feedback = { clase: "fb-warn", texto: "Escribe un número válido, por ejemplo 12.5 o -3.2." };
    renderParte(i);
    $("resp-" + i).focus();
    return;
  }

  parte.intentos++;

  const acierto = Math.abs(valor - parte.esperado) / Math.abs(parte.esperado) <= TOLERANCIA_RELATIVA;

  const respuestaTexto =
    parte.esperado.toLocaleString("es-PE", { minimumFractionDigits: parte.decimales, maximumFractionDigits: parte.decimales }) +
    " " + parte.unidad;

  if (acierto) {
    parte.estado = "correcta";
    parte.feedback = {
      clase: "fb-ok",
      texto: parte.intentos === 1 ? "Correcto, a la primera." : `Correcto, en ${parte.intentos} intentos.`
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

  let ayuda = "No coincide.";

  if (Math.abs(valor + parte.esperado) / Math.abs(parte.esperado) <= TOLERANCIA_RELATIVA && parte.esperado !== 0) {
    ayuda = "Tu cifra es correcta en magnitud, pero con el signo cambiado. Revisa el signo de las operaciones.";
  } else if (detectarOtraUnidad(valor, parte.esperado)) {
    ayuda = `Tu cifra parece correcta pero en otra escala. Responde en ${parte.unidad}.`;
  } else if (Math.abs(valor - parte.esperado) / Math.abs(parte.esperado) < 0.05) {
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

    window.location.href =
      "mailto:ingenieria@metodosnumericos.edu" +
      "?subject=" + encodeURIComponent("[Métodos Numéricos] " + asunto) +
      "&body=" + encodeURIComponent(cuerpo);

    feedback.textContent = "Se abrió tu aplicación de correo con el mensaje listo para enviar.";
    feedback.className = "is-ok";
  });
}