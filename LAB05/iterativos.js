"use strict";

// ========================================
// 1. UTILIDADES
// ========================================

const $ = id => document.getElementById(id);

function fmtLargo(n, cifras = 12) {
  return n.toLocaleString("es-PE", { maximumSignificantDigits: cifras });
}

function corto(n) {
  return n.toLocaleString("es-PE", { maximumSignificantDigits: 4 });
}

function fmtAuto(n) {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return "0";

  const abs = Math.abs(n);

  if (abs < 1e-3 || abs >= 1e15) {
    return n.toExponential(3).replace("e+", "e");
  }

  return n.toLocaleString("es-PE", { maximumSignificantDigits: 10 });
}

function sciHTML(n, decimales = 2) {
  if (n === 0) return "0";
  if (!Number.isFinite(n)) return String(n);

  const [mantisa, exp] = n.toExponential(decimales).split("e");
  const exponente = String(Number(exp)).replace("-", "−");

  return `${mantisa} × 10<sup>${exponente}</sup>`;
}

function texNum(v, dec = 4) {
  if (Math.abs(v) < 0.5 * 10 ** -dec) return "0";
  return String(+v.toFixed(dec));
}

// Número entre paréntesis si es negativo (para sustituir en fórmulas)
function texPar(v, dec = 4) {
  const t = texNum(v, dec);
  return v < 0 ? `(${t})` : t;
}

function texMat(M, dec = 4) {
  return "\\begin{bmatrix}" +
    M.map(fila => fila.map(v => texNum(v, dec)).join("&")).join("\\\\") +
    "\\end{bmatrix}";
}

function texVec(v, dec = 4) {
  return "\\begin{bmatrix}" + v.map(x => texNum(x, dec)).join("\\\\") + "\\end{bmatrix}";
}

function fmtVec(v, dec = 4) {
  return "(" + v.map(x => x.toLocaleString("es-PE", { maximumFractionDigits: dec })).join(", ") + ")";
}

function pct(n) {
  return (n * 100).toLocaleString("es-PE", { maximumSignificantDigits: 3 }) + " %";
}

// ========================================
// 2. ÁLGEBRA LINEAL Y RADIO ESPECTRAL
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

function inversaTriangularInferior(M) {
  const n = M.length;
  const R = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

  for (let c = 0; c < n; c++) {
    for (let i = 0; i < n; i++) {
      let s = R[i][c];

      for (let j = 0; j < i; j++) s -= M[i][j] * R[j][c];

      R[i][c] = s / M[i][i];
    }
  }

  return R;
}

// Matriz de iteración: Jacobi, Gauss–Seidel (ω = 1) o SOR (ω)
function matrizIteracion(A, tipo, omega = 1) {
  if (tipo === "jacobi") {
    return A.map((fila, i) => fila.map((v, j) => (i === j ? 0 : -v / fila[i])));
  }

  const w = tipo === "gs" ? 1 : omega;

  // T = (D + ωL)^-1 [ (1 − ω)D − ωU ]
  const M = A.map((fila, i) => fila.map((v, j) => (i === j ? v : j < i ? w * v : 0)));
  const N = A.map((fila, i) => fila.map((v, j) => (i === j ? (1 - w) * v : j > i ? -w * v : 0)));

  return matMul(inversaTriangularInferior(M), N);
}

// Polinomio característico por Faddeev–LeVerrier: coeficientes de λ^n ... λ^0
function polinomioCaracteristico(T) {
  const n = T.length;
  let Mk = Array.from({ length: n }, () => Array(n).fill(0));
  const c = [1];

  for (let k = 1; k <= n; k++) {
    Mk = matMul(T, Mk).map((fila, i) => fila.map((v, j) => v + (i === j ? c[k - 1] : 0)));

    const traza = matMul(T, Mk).reduce((s, fila, i) => s + fila[i], 0);

    c.push(-traza / k);
  }

  return c;
}

// Raíces complejas por Durand–Kerner
function raicesPolinomio(c) {
  const n = c.length - 1;
  const a = c.map(v => v / c[0]);
  const R = 1 + Math.max(...a.slice(1).map(Math.abs));

  const mul = (p, q) => ({ re: p.re * q.re - p.im * q.im, im: p.re * q.im + p.im * q.re });
  const sub = (p, q) => ({ re: p.re - q.re, im: p.im - q.im });
  const div = (p, q) => {
    const d = q.re * q.re + q.im * q.im;
    return { re: (p.re * q.re + p.im * q.im) / d, im: (p.im * q.re - p.re * q.im) / d };
  };

  const evaluar = z => {
    let r = { re: 1, im: 0 };

    for (let i = 1; i <= n; i++) {
      r = mul(r, z);
      r = { re: r.re + a[i], im: r.im };
    }

    return r;
  };

  const z = Array.from({ length: n }, (_, k) => ({
    re: 0.5 * R * Math.cos((2 * Math.PI * k) / n + 0.4),
    im: 0.5 * R * Math.sin((2 * Math.PI * k) / n + 0.4)
  }));

  for (let it = 0; it < 5000; it++) {
    let maxPaso = 0;

    for (let i = 0; i < n; i++) {
      let den = { re: 1, im: 0 };

      for (let j = 0; j < n; j++) {
        if (j !== i) den = mul(den, sub(z[i], z[j]));
      }

      const paso = div(evaluar(z[i]), den);

      z[i] = sub(z[i], paso);
      maxPaso = Math.max(maxPaso, Math.hypot(paso.re, paso.im));
    }

    if (maxPaso < 1e-15) break;
  }

  return z;
}

function radioEspectral(T) {
  const raices = raicesPolinomio(polinomioCaracteristico(T));
  const rho = Math.max(...raices.map(z => Math.hypot(z.re, z.im)));

  return Number.isFinite(rho) ? rho : NaN;
}

// ω que minimiza ρ(T_ω): barrido grueso y refinamiento local
function buscarOmegaOptimo(A) {
  const curva = [];

  for (let w = 0.05; w < 1.999; w += 0.05) {
    const omega = Math.round(w * 100) / 100;

    curva.push({ w: omega, rho: radioEspectral(matrizIteracion(A, "sor", omega)) });
  }

  let mejor = curva.reduce((a, b) => (b.rho < a.rho ? b : a));

  for (let w = Math.max(0.01, mejor.w - 0.05); w <= Math.min(1.99, mejor.w + 0.05); w += 0.005) {
    const omega = Math.round(w * 1000) / 1000;
    const rho = radioEspectral(matrizIteracion(A, "sor", omega));

    if (rho < mejor.rho) mejor = { w: omega, rho };
  }

  return { omega: mejor.w, rho: mejor.rho, curva };
}

// Solución de referencia (método directo, independiente de las iteraciones)
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

// ========================================
// 3. MÉTODOS ITERATIVOS CON INTERFAZ COMÚN
// ========================================

// Cada método implementa paso(A, b, x, omega) -> x_nuevo
const METODOS = {
  jacobi: {
    id: "jacobi",
    nombre: "Jacobi",
    paso(A, b, x) {
      return x.map((_, i) => {
        let s = b[i];

        for (let j = 0; j < b.length; j++) {
          if (j !== i) s -= A[i][j] * x[j];
        }

        return s / A[i][i];
      });
    }
  },

  gs: {
    id: "gs",
    nombre: "Gauss–Seidel",
    paso(A, b, x) {
      const y = x.slice();

      for (let i = 0; i < b.length; i++) {
        let s = b[i];

        for (let j = 0; j < b.length; j++) {
          if (j !== i) s -= A[i][j] * y[j];
        }

        y[i] = s / A[i][i];
      }

      return y;
    }
  },

  sor: {
    id: "sor",
    nombre: "SOR",
    paso(A, b, x, omega) {
      const y = x.slice();

      for (let i = 0; i < b.length; i++) {
        let s = b[i];

        for (let j = 0; j < b.length; j++) {
          if (j !== i) s -= A[i][j] * y[j];
        }

        y[i] = (1 - omega) * x[i] + omega * (s / A[i][i]);
      }

      return y;
    }
  }
};

function residuoRelativo(A, b, x) {
  const r = matVec(A, x).map((v, i) => b[i] - v);
  const nb = normaInfVec(b);

  return normaInfVec(r) / (nb > 0 ? nb : 1);
}

function iterar(metodo, A, b, x0, { omega = 1, tol = 1e-8, maxIter = 500 } = {}) {
  let x = x0.slice();

  const historial = [{ k: 0, residuo: residuoRelativo(A, b, x), cambio: null }];

  let converge = false;
  let diverge = false;

  for (let k = 1; k <= maxIter; k++) {
    const nuevo = metodo.paso(A, b, x, omega);

    const normaNuevo = normaInfVec(nuevo);
    const dif = normaInfVec(nuevo.map((v, i) => v - x[i]));
    const cambio = dif / (normaNuevo > 0 ? normaNuevo : 1);
    const residuo = residuoRelativo(A, b, nuevo);

    x = nuevo;
    historial.push({ k, residuo, cambio });

    if (!Number.isFinite(residuo) || residuo > 1e12) {
      diverge = true;
      break;
    }

    if (residuo < tol && cambio < tol) {
      converge = true;
      break;
    }
  }

  const K = historial.length - 1;
  let tasa = NaN;

  if (K >= 3 && historial[1].residuo > 0 && historial[K].residuo > 0 && Number.isFinite(historial[K].residuo)) {
    tasa = Math.pow(historial[K].residuo / historial[1].residuo, 1 / (K - 1));
  }

  return { x, iteraciones: K, historial, converge, diverge, tasa };
}

// ========================================
// 4. INICIALIZACIÓN
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
// 5. FÓRMULAS
// ========================================

function renderizarFormulas() {
  if (typeof katex === "undefined") {
    console.warn("No se pudo cargar KaTeX.");
    return;
  }

  const formulas = [
    {
      id: "math-jacobi",
      formula: "x_i^{(k+1)}=\\frac{1}{a_{ii}}\\Bigl(b_i-\\sum_{j\\ne i}a_{ij}\\,x_j^{(k)}\\Bigr)"
    },
    {
      id: "math-gs",
      formula: "x_i^{(k+1)}=\\frac{1}{a_{ii}}\\Bigl(b_i-\\sum_{j<i}a_{ij}\\,x_j^{(k+1)}-\\sum_{j>i}a_{ij}\\,x_j^{(k)}\\Bigr)"
    },
    {
      id: "math-sor",
      formula: "x_i^{(k+1)}=(1-\\omega)\\,x_i^{(k)}+\\omega\\,\\tilde{x}_i^{(k+1)}"
    },
    {
      id: "math-matriz",
      formula: "T_J=-D^{-1}(L+U),\\quad T_{GS}=-(D+L)^{-1}U,\\quad T_\\omega=(D+\\omega L)^{-1}\\bigl[(1-\\omega)D-\\omega U\\bigr]"
    },
    {
      id: "math-conv",
      formula: "e^{(k)}=T^{k}e^{(0)},\\qquad e^{(k)}\\to 0\\;\\;\\forall x^{(0)}\\iff\\rho(T)<1"
    },
    {
      id: "math-nit",
      formula: "\\|e^{(k)}\\|\\approx\\rho(T)^{k}\\|e^{(0)}\\|\\;\\Rightarrow\\;k\\ge\\frac{\\ln(\\text{tol})}{\\ln\\rho(T)}"
    },
    {
      id: "math-paro",
      formula: "r^{(k)}=b-Ax^{(k)},\\qquad \\delta_k=\\frac{\\|x^{(k)}-x^{(k-1)}\\|}{\\|x^{(k)}\\|}"
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
// 6. DEMOSTRACIÓN DE LA PORTADA
// ========================================

function configurarDemoHero() {
  const entrada = $("heroA");

  if (!entrada) return;

  entrada.addEventListener("input", actualizarDemoHero);

  document.querySelectorAll(".preset").forEach(boton => {
    boton.addEventListener("click", () => {
      entrada.value = boton.dataset.a;
      actualizarDemoHero();
    });
  });

  actualizarDemoHero();
}

function actualizarDemoHero() {
  const a = Number($("heroA").value);

  const celdas = [$("heroRhoJ"), $("heroRhoGS"), $("heroItJ"), $("heroItGS")];
  const msg = $("heroMsg");

  celdas.forEach(c => c.classList.remove("is-loss"));
  msg.classList.remove("is-loss");

  if ($("heroA").value.trim() === "" || !Number.isFinite(a)) {
    celdas.forEach(c => (c.textContent = "—"));
    msg.textContent = "Escribe un valor numérico para a, por ejemplo 0.8.";
    return;
  }

  const A = [[1, -a], [-a, 1]];
  const b = [1, 1];
  const opciones = { tol: 1e-6, maxIter: 1000 };

  const rhoJ = radioEspectral(matrizIteracion(A, "jacobi"));
  const rhoGS = radioEspectral(matrizIteracion(A, "gs"));

  const rJ = iterar(METODOS.jacobi, A, b, [0, 0], opciones);
  const rG = iterar(METODOS.gs, A, b, [0, 0], opciones);

  const texto = r => (r.converge ? String(r.iteraciones) : r.diverge ? "diverge" : "más de 1,000");

  $("heroRhoJ").textContent = rhoJ.toFixed(3);
  $("heroRhoGS").textContent = rhoGS.toFixed(3);
  $("heroItJ").textContent = texto(rJ);
  $("heroItGS").textContent = texto(rG);

  if (Math.abs(1 - a) < 1e-9) {
    msg.classList.add("is-loss");
    msg.textContent = "Con a = 1 la matriz es singular: el sistema no tiene solución única.";
    return;
  }

  if (rhoJ >= 1) {
    celdas.forEach(c => c.classList.add("is-loss"));
    msg.classList.add("is-loss");
    msg.textContent =
      `Como ρ ≥ 1 las iteraciones se alejan de la solución, aunque existe (x₁ = x₂ = ${fmtLargo(1 / (1 - a), 6)}). ` +
      `Convergencia y existencia de solución son cosas distintas.`;
    return;
  }

  if (rJ.converge && rG.converge) {
    const razon = rJ.iteraciones / Math.max(1, rG.iteraciones);

    msg.textContent =
      `ρ < 1, así que ambos convergen. Gauss–Seidel necesita ${fmtLargo(razon, 2)} veces menos iteraciones: ` +
      `aquí ρ(GS) = ρ(Jacobi)² y el error se reduce al cuadrado por iteración.`;
  } else {
    msg.textContent = "ρ < 1 pero muy cercano a 1: converge, aunque necesita muchas iteraciones.";
  }
}

// ========================================
// 7. BOTÓN VOLVER ARRIBA Y MENÚ
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
// 8. SIMULADOR DEL LABORATORIO
// ========================================

const A_DEFECTO = [
  [1, -0.2, -0.1, 0],
  [-0.1, 1, -0.2, -0.1],
  [0, -0.2, 1, -0.2],
  [-0.2, 0, -0.1, 1]
];

const B_DEFECTO = [1, 1, 1, 1];
const INICIO_A = [0, 0, 0, 0];
const INICIO_B = [1, 1, 1, 1];

let ultimo = null;

function crearCuadricula(idContenedor, filas, columnas, prefijo, etiqueta) {
  const contenedor = $(idContenedor);

  for (let i = 0; i < filas; i++) {
    for (let j = 0; j < columnas; j++) {
      const campo = document.createElement("input");

      campo.type = "number";
      campo.step = "any";
      campo.id = filas === 1 ? `${prefijo}_${j}` : `${prefijo}_${i}_${j}`;
      campo.setAttribute("aria-label", filas === 1 ? `${etiqueta} ${j + 1}` : `${etiqueta} fila ${i + 1}, columna ${j + 1}`);

      contenedor.appendChild(campo);
    }
  }
}

function configurarSimulador() {
  if (!$("matrizA")) return;

  crearCuadricula("matrizA", 4, 4, "mA", "A");
  crearCuadricula("vectorB", 1, 4, "vB", "b");
  crearCuadricula("inicioA", 1, 4, "xa", "Inicio A");
  crearCuadricula("inicioB", 1, 4, "xb", "Inicio B");

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

  $("criterioReco").addEventListener("change", () => {
    if (ultimo) pintarRecomendacion(ultimo);
  });

  ejecutarSimulador();
}

function cargarValoresPorDefecto() {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) $(`mA_${i}_${j}`).value = A_DEFECTO[i][j];

    $(`vB_${i}`).value = B_DEFECTO[i];
    $(`xa_${i}`).value = INICIO_A[i];
    $(`xb_${i}`).value = INICIO_B[i];
  }

  $("calcOmegas").value = "0.8, 1.0, 1.2, 1.5, 1.8";
  $("calcTol").value = 1e-8;
  $("calcMax").value = 500;
  $("calcDeltaB").value = 5;
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

function leerVector(prefijo) {
  return [0, 1, 2, 3].map(j => {
    const v = $(`${prefijo}_${j}`).value;

    return v.trim() === "" ? NaN : Number(v);
  });
}

function leerDatos() {
  const A = [0, 1, 2, 3].map(i => [0, 1, 2, 3].map(j => {
    const v = $(`mA_${i}_${j}`).value;

    return v.trim() === "" ? NaN : Number(v);
  }));

  const b = leerVector("vB");
  const inicios = [leerVector("xa"), leerVector("xb")];

  const omegas = $("calcOmegas").value
    .split(/[\s,;]+/)
    .filter(t => t !== "")
    .map(Number);

  const tol = Number($("calcTol").value);
  const maxIter = Number($("calcMax").value);
  const deltaB = Number($("calcDeltaB").value);

  const problemas = [];

  if (A.some(f => f.some(v => !Number.isFinite(v)))) problemas.push("Todos los coeficientes de A deben ser números.");
  if (b.some(v => !Number.isFinite(v))) problemas.push("Todas las componentes de b deben ser números.");
  if (inicios.some(x => x.some(v => !Number.isFinite(v)))) problemas.push("Los dos vectores de inicio deben estar completos.");

  if (omegas.length === 0 || omegas.length > 8 || omegas.some(w => !Number.isFinite(w) || w <= 0 || w >= 2)) {
    problemas.push("Escribe de 1 a 8 valores de ω, cada uno estrictamente entre 0 y 2.");
  }

  if (!Number.isFinite(tol) || tol <= 0 || tol >= 1) problemas.push("La tolerancia debe estar entre 0 y 1.");
  if (!Number.isInteger(maxIter) || maxIter < 1 || maxIter > 5000) problemas.push("El máximo de iteraciones debe ser un entero entre 1 y 5000.");
  if (!Number.isFinite(deltaB) || deltaB < 0) problemas.push("El cambio de b no puede ser negativo.");

  if (problemas.length === 0 && A.some((f, i) => f[i] === 0)) {
    problemas.push("Hay un cero en la diagonal de A: Jacobi, Gauss–Seidel y SOR dividen entre a_ii.");
  }

  if (problemas.length > 0) {
    mostrarError(problemas.join(" "));
    return null;
  }

  return { A, b, inicios, omegas, tol, maxIter, deltaB };
}

function etiquetaOmega(w) {
  return Number.isInteger(w) ? w.toFixed(1) : String(w);
}

function construirConfiguraciones(omegas, omegaOpt, n) {
  const lista = [
    { id: "jacobi", metodo: METODOS.jacobi, omega: 1, etiqueta: "Jacobi", tipo: "jacobi", rondas: 1 },
    { id: "gs", metodo: METODOS.gs, omega: 1, etiqueta: "Gauss–Seidel", tipo: "gs", rondas: n }
  ];

  omegas.forEach(w => {
    lista.push({
      id: "sor-" + w,
      metodo: METODOS.sor,
      omega: w,
      etiqueta: w === 1 ? "SOR ω = 1.0 (= Gauss–Seidel)" : `SOR ω = ${etiquetaOmega(w)}`,
      tipo: "sor",
      rondas: n,
      duplicado: w === 1
    });
  });

  const yaProbado = omegas.some(w => Math.abs(w - omegaOpt) < 0.0025);

  if (!yaProbado && omegaOpt > 0 && omegaOpt < 2) {
    lista.push({
      id: "sor-opt",
      metodo: METODOS.sor,
      omega: omegaOpt,
      etiqueta: `SOR ω* = ${omegaOpt.toLocaleString("es-PE", { maximumFractionDigits: 3 })} (óptimo numérico)`,
      tipo: "sor",
      rondas: n,
      extra: true
    });
  }

  return lista;
}

function ejecutarSimulador() {
  const datos = leerDatos();

  if (!datos) return;

  const { A, b, inicios, omegas, tol, maxIter, deltaB } = datos;
  const n = A.length;

  const invA = inversaGaussJordan(A);

  if (!invA) {
    mostrarError("La matriz A es singular: el sistema no tiene solución única, así que no hay nada que converger.");
    $("simResultados").hidden = true;
    $("btnInforme").disabled = true;
    ultimo = null;
    return;
  }

  mostrarError("");

  const xRef = matVec(invA, b);

  // Análisis previo: dominancia y radios espectrales
  const dominancia = A.map((fila, i) => {
    const fuera = fila.reduce((s, v, j) => (j === i ? s : s + Math.abs(v)), 0);
    const col = A.reduce((s, f, k) => (k === i ? s : s + Math.abs(f[i])), 0);

    return {
      diag: Math.abs(fila[i]),
      fuera,
      razonFila: fuera / Math.abs(fila[i]),
      razonCol: col / Math.abs(fila[i])
    };
  });

  const normaJ = normaInfMat(matrizIteracion(A, "jacobi"));
  const optimo = buscarOmegaOptimo(A);
  const configs = construirConfiguraciones(omegas, optimo.omega, n);

  configs.forEach(c => {
    c.matriz = matrizIteracion(A, c.tipo, c.omega);
    c.rho = radioEspectral(c.matriz);
    c.norma = normaInfMat(c.matriz);
  });

  // Ejecución de todas las configuraciones con los dos inicios
  const corridas = {};

  configs.forEach(c => {
    corridas[c.id] = inicios.map(x0 => iterar(c.metodo, A, b, x0, { omega: c.omega, tol, maxIter }));
  });

  ultimo = { A, b, inicios, omegas, tol, maxIter, deltaB, n, xRef, invA, dominancia, normaJ, optimo, configs, corridas };

  pintarEcuaciones(A);
  pintarDominancia(ultimo);
  pintarRadios(ultimo);
  pintarIteraciones(ultimo);
  pintarDiagnostico(ultimo);
  pintarRecomendacion(ultimo);
  prepararSelectoresGrafico(ultimo);

  $("simResultados").hidden = false;
  $("btnInforme").disabled = false;

  if ($("errorChart") && typeof Chart !== "undefined") generarGrafico();
}

function pintarEcuaciones(A) {
  const lista = $("ecuaciones");
  lista.innerHTML = "";

  A.forEach((fila, i) => {
    const terminos = fila
      .map((v, j) => ({ v, j }))
      .filter(({ v, j }) => j !== i && v !== 0)
      .map(({ v, j }) => `${-v < 0 ? "− " : "+ "}${corto(Math.abs(v))} <em>x</em><sub>${j + 1}</sub>`)
      .join(" ");

    const div = document.createElement("div");

    div.innerHTML =
      `<dt>Nodo ${i + 1}: <em>x</em><sub>${i + 1}</sub> = ${$("vB_" + i).value || 0} ${terminos}</dt>` +
      `<dd>El puntaje del nodo ${i + 1} es su base más la influencia ponderada de los nodos que lo refuerzan.</dd>`;

    lista.appendChild(div);
  });
}

function pintarDominancia(d) {
  const tbody = $("tablaDominancia");
  tbody.innerHTML = "";

  d.dominancia.forEach((f, i) => {
    const fila = document.createElement("tr");

    fila.innerHTML =
      `<th scope="row">${i + 1}</th>` +
      `<td class="num">${corto(f.diag)}</td>` +
      `<td class="num">${corto(f.fuera)}</td>` +
      `<td class="num ${f.razonFila < 1 ? "is-ok" : "is-bad"}">${corto(f.razonFila)}</td>` +
      `<td class="num ${f.razonCol < 1 ? "is-ok" : "is-bad"}">${corto(f.razonCol)}</td>`;

    tbody.appendChild(fila);
  });

  const filasOk = d.dominancia.every(f => f.razonFila < 1);
  const colsOk = d.dominancia.every(f => f.razonCol < 1);

  $("notaDominancia").innerHTML =
    `Dominancia estricta por filas: <strong>${filasOk ? "sí" : "no"}</strong>; por columnas: <strong>${colsOk ? "sí" : "no"}</strong>. ` +
    `Una razón menor que 1 en todas las filas garantiza que Jacobi y Gauss–Seidel convergen; ` +
    `además ‖<em>T</em><sub>J</sub>‖<sub>∞</sub> = ${corto(d.normaJ)} es la mayor razón por filas.`;
}

function iteracionesPrevistas(rho, tol) {
  if (!Number.isFinite(rho) || rho >= 1) return null;
  if (rho <= 1e-12) return 1;

  return Math.ceil(Math.log(tol) / Math.log(rho));
}

function pintarRadios(d) {
  const tbody = $("tablaRadios");
  tbody.innerHTML = "";

  d.configs.filter(c => !c.extra).forEach(c => {
    const previstas = iteracionesPrevistas(c.rho, d.tol);
    const converge = c.rho < 1;
    const fila = document.createElement("tr");

    const nombre = c.tipo === "jacobi" ? "T<sub>J</sub> (Jacobi)"
      : c.tipo === "gs" ? "T<sub>GS</sub> (Gauss–Seidel)"
      : `T<sub>ω</sub>, ω = ${etiquetaOmega(c.omega)}${c.duplicado ? " (= GS)" : ""}`;

    fila.innerHTML =
      `<th scope="row">${nombre}</th>` +
      `<td class="num">${Number.isFinite(c.rho) ? c.rho.toFixed(4) : "—"}</td>` +
      `<td class="num">${previstas === null ? "—" : previstas}</td>` +
      `<td>${converge
        ? '<span class="status status-ok"><i class="bi bi-check-lg" aria-hidden="true"></i>Converge</span>'
        : '<span class="status status-bad"><i class="bi bi-x-lg" aria-hidden="true"></i>No converge</span>'}</td>`;

    tbody.appendChild(fila);
  });

  const cJ = d.configs.find(c => c.id === "jacobi");
  const cG = d.configs.find(c => c.id === "gs");

  $("mRhoJ").textContent = cJ.rho.toFixed(4);
  $("mRhoJTxt").textContent = `≤ ‖T‖∞ = ${corto(cJ.norma)}`;
  $("mRhoGS").textContent = cG.rho.toFixed(4);
  $("mRhoGSTxt").textContent = cG.rho < cJ.rho ? "menor que Jacobi" : "no mejora a Jacobi";
  $("mOmega").textContent = d.optimo.omega.toLocaleString("es-PE", { maximumFractionDigits: 3 });
  $("mOmegaTxt").textContent = `ρ(T_ω*) = ${d.optimo.rho.toFixed(4)}`;
}

function textoEstado(r) {
  if (r.converge) return '<span class="status status-ok"><i class="bi bi-check-lg" aria-hidden="true"></i>Converge</span>';
  if (r.diverge) return '<span class="status status-bad"><i class="bi bi-x-lg" aria-hidden="true"></i>Diverge</span>';

  return '<span class="status status-warn">No converge en el máximo</span>';
}

function pintarIteraciones(d) {
  const tbody = $("tablaIter");
  tbody.innerHTML = "";

  d.configs.forEach(c => {
    d.corridas[c.id].forEach((r, s) => {
      const final = r.historial[r.historial.length - 1];
      const fila = document.createElement("tr");

      fila.innerHTML =
        `<th scope="row">${s === 0 ? c.etiqueta : ""}</th>` +
        `<td>${s === 0 ? "A" : "B"}</td>` +
        `<td class="num">${r.iteraciones}</td>` +
        `<td class="num">${sciHTML(final.residuo)}</td>` +
        `<td class="num">${sciHTML(final.cambio)}</td>` +
        `<td class="num">${Number.isFinite(r.tasa) ? r.tasa.toFixed(4) : "—"}</td>` +
        `<td class="num">${Number.isFinite(c.rho) ? c.rho.toFixed(4) : "—"}</td>` +
        `<td>${textoEstado(r)}</td>`;

      tbody.appendChild(fila);
    });
  });

  const convergidas = d.configs.flatMap(c => d.corridas[c.id]).filter(r => r.converge);
  const difMax = convergidas.length
    ? Math.max(...convergidas.map(r => normaInfVec(r.x.map((v, i) => v - d.xRef[i]))))
    : NaN;

  $("solucionRef").innerHTML =
    `Solución de referencia (método directo): <strong>x = ${fmtVec(d.xRef, 6)}</strong>. ` +
    (Number.isFinite(difMax)
      ? `Las iteraciones que convergen terminan a ${fmtAuto(difMax)} como máximo de ella.`
      : "Ninguna configuración llegó a converger.");
}

function pintarDiagnostico(d) {
  const lista = $("diagnostico");
  lista.innerHTML = "";

  const items = [];
  const cJ = d.configs.find(c => c.id === "jacobi");
  const cG = d.configs.find(c => c.id === "gs");

  // 1. Dominancia
  const maxRazon = Math.max(...d.dominancia.map(f => f.razonFila));

  items.push(maxRazon < 1
    ? { clase: "is-ok", html: `<strong>Dominancia:</strong> la razón máxima por filas es ${corto(maxRazon)} &lt; 1, así que Jacobi y Gauss–Seidel convergen para cualquier inicio.` }
    : { clase: "is-warn", html: `<strong>Dominancia:</strong> la razón máxima por filas es ${corto(maxRazon)} ≥ 1. No hay garantía por dominancia; hay que mirar el radio espectral.` });

  // 2. Jacobi frente a Gauss–Seidel
  if (cJ.rho < 1 && cG.rho < 1 && cG.rho > 0) {
    const veces = Math.log(cG.rho) / Math.log(cJ.rho);

    items.push({
      clase: "",
      html: `<strong>Jacobi frente a Gauss–Seidel:</strong> ρ pasa de ${cJ.rho.toFixed(3)} a ${cG.rho.toFixed(3)}, ` +
        `así que Gauss–Seidel reduce el error ${corto(veces)} veces más rápido por iteración.`
    });
  } else if (cJ.rho >= 1 || cG.rho >= 1) {
    items.push({
      clase: "is-warn",
      html: `<strong>Convergencia:</strong> ρ(Jacobi) = ${cJ.rho.toFixed(3)} y ρ(Gauss–Seidel) = ${cG.rho.toFixed(3)}; si alguno es ≥ 1 ese método no converge para todo inicio.`
    });
  }

  // 3. Efecto de ω
  const sors = d.configs.filter(c => c.tipo === "sor" && !c.extra);
  const noConvergen = sors.filter(c => !(c.rho < 1));
  const peoresQueGS = cG.rho < 1
    ? sors.filter(c => !c.duplicado && c.rho > cG.rho).map(c => etiquetaOmega(c.omega))
    : [];

  if (d.optimo.rho >= 1) {
    items.push({
      clase: "is-warn",
      html: `<strong>Efecto de ω:</strong> ningún ω entre 0 y 2 consigue ρ &lt; 1 (el mínimo es ${d.optimo.rho.toFixed(3)}). ` +
        `Cambiar el factor de relajación no arregla un sistema donde la iteración base no converge.`
    });
  } else {
    items.push({
      clase: noConvergen.length ? "is-warn" : "",
      html: `<strong>Efecto de ω:</strong> el mejor ω es ≈ ${d.optimo.omega.toLocaleString("es-PE", { maximumFractionDigits: 3 })} (ρ = ${d.optimo.rho.toFixed(3)}). ` +
        (peoresQueGS.length
          ? `Con ω = ${peoresQueGS.join(", ")} SOR es más lento que Gauss–Seidel: sobrerrelajar no siempre ayuda. `
          : "") +
        (noConvergen.length ? `No convergen: ω = ${noConvergen.map(c => etiquetaOmega(c.omega)).join(", ")}.` : "Todos los ω probados convergen, como exige 0 < ω < 2.")
    });
  }

  // 4. Tasa observada frente a la teórica
  const pares = d.configs.flatMap(c => d.corridas[c.id].map(r => ({ c, r })))
    .filter(({ c, r }) => r.converge && Number.isFinite(r.tasa) && Number.isFinite(c.rho) && c.rho > 0.05);

  if (pares.length) {
    const difMax = Math.max(...pares.map(({ c, r }) => Math.abs(r.tasa - c.rho)));

    items.push({
      clase: "",
      html: `<strong>Teoría y práctica:</strong> la tasa observada difiere del radio espectral en ${corto(difMax)} como máximo, ` +
        `así que ρ(<em>T</em>) predice bien la velocidad real.`
    });
  }

  // 5. Efecto del inicio
  const dif = d.configs.map(c => {
    const [a, bb] = d.corridas[c.id];

    return a.converge && bb.converge ? a.iteraciones - bb.iteraciones : null;
  }).filter(v => v !== null);

  if (dif.length) {
    const media = dif.reduce((s, v) => s + v, 0) / dif.length;

    items.push({
      clase: "",
      html: `<strong>Efecto del inicio:</strong> el inicio B necesita en promedio ${corto(Math.abs(media))} iteraciones ` +
        `${media >= 0 ? "menos" : "más"} que el inicio A. El inicio solo cambia el tramo inicial: la velocidad la fija ρ(<em>T</em>).`
    });
  }

  items.forEach(item => {
    const li = document.createElement("li");

    li.className = item.clase;
    li.innerHTML = item.html;
    lista.appendChild(li);
  });
}

// Iteraciones medias de una configuración (Infinity si algún inicio no converge)
function iteracionesMedias(d, c) {
  const rs = d.corridas[c.id];

  return rs.every(r => r.converge) ? rs.reduce((s, r) => s + r.iteraciones, 0) / rs.length : Infinity;
}

function clasificar(d, criterio) {
  const lista = d.configs.filter(c => !c.duplicado);

  const puntuar = c => {
    const it = iteracionesMedias(d, c);

    return criterio === "rondas" ? it * c.rondas : it;
  };

  return lista.slice().sort((a, b) => puntuar(a) - puntuar(b));
}

function pintarRecomendacion(d) {
  const criterio = $("criterioReco").value;
  const orden = clasificar(d, criterio);
  const mejor = orden[0];

  const tbody = $("tablaRanking");
  tbody.innerHTML = "";

  orden.forEach((c, i) => {
    const [ra, rb] = d.corridas[c.id];
    const media = iteracionesMedias(d, c);
    const fila = document.createElement("tr");

    if (i === 0 && Number.isFinite(media)) fila.className = "is-best";

    const iter = r => (r.converge ? r.iteraciones : r.diverge ? "diverge" : "no converge");

    fila.innerHTML =
      `<th scope="row">${i + 1}</th>` +
      `<td>${c.etiqueta}</td>` +
      `<td class="num">${iter(ra)}</td>` +
      `<td class="num">${iter(rb)}</td>` +
      `<td class="num">${Number.isFinite(media) ? corto(media * c.rondas) : "—"}</td>`;

    tbody.appendChild(fila);
  });

  // Inicio frío frente a caliente: b cambia un pequeño porcentaje respecto al periodo anterior
  const nuevoB = d.b.map((v, i) => v * (1 + (d.deltaB / 100) * (i % 2 === 0 ? 1 : -1)));
  const frio = new Array(d.n).fill(0);
  const caliente = d.xRef;

  const candidatos = [d.configs.find(c => c.id === "jacobi"), d.configs.find(c => c.id === "gs")];

  if (mejor && !candidatos.includes(mejor)) candidatos.push(mejor);

  const filasCaliente = candidatos.map(c => {
    const opc = { omega: c.omega, tol: d.tol, maxIter: d.maxIter };
    const rf = iterar(c.metodo, d.A, nuevoB, frio, opc);
    const rc = iterar(c.metodo, d.A, nuevoB, caliente, opc);

    return { c, rf, rc };
  });

  const tcal = $("tablaCaliente");
  tcal.innerHTML = "";

  filasCaliente.forEach(({ c, rf, rc }) => {
    const fila = document.createElement("tr");
    const ok = rf.converge && rc.converge;
    const ahorro = ok && rf.iteraciones > 0 ? 1 - rc.iteraciones / rf.iteraciones : NaN;

    fila.innerHTML =
      `<th scope="row">${c.etiqueta}</th>` +
      `<td class="num">${rf.converge ? rf.iteraciones : "—"}</td>` +
      `<td class="num">${rc.converge ? rc.iteraciones : "—"}</td>` +
      `<td class="num">${Number.isFinite(ahorro) ? Math.round(ahorro * 100) + " %" : "—"}</td>`;

    tcal.appendChild(fila);
  });

  $("notaCaliente").innerHTML =
    `Se cambia <em>b</em> en ±${d.deltaB} % (signos alternados) como en una actualización periódica. ` +
    `Frío: empieza en ceros; caliente: empieza en el ranking anterior.`;

  d.recomendacion = { mejor, orden, filasCaliente, criterio };

  // Texto de la recomendación
  const caja = $("recomendacion");

  if (!mejor || !Number.isFinite(iteracionesMedias(d, mejor))) {
    caja.innerHTML =
      `<h3>Recomendación</h3><p>Ninguna configuración converge dentro del máximo de iteraciones con estos datos. ` +
      `Revisa la dominancia de <em>A</em> o aumenta el máximo de iteraciones.</p>`;
    return;
  }

  const cJ = d.configs.find(c => c.id === "jacobi");
  const cG = d.configs.find(c => c.id === "gs");

  const porRondas = criterio === "rondas";
  const unidad = porRondas ? "rondas" : "iteraciones";
  const medida = c => iteracionesMedias(d, c) * (porRondas ? c.rondas : 1);

  const valorMejor = medida(mejor);
  const valorJ = medida(cJ);
  const valorG = medida(cG);

  const otroCriterio = clasificar(d, porRondas ? "iter" : "rondas")[0];
  const filaMejor = filasCaliente.find(f => f.c === mejor);
  const tolHTML = sciHTML(d.tol, 0);

  const partes = [];

  partes.push(
    `<h3>Recomendación</h3>` +
    `<p>Usa <strong>${mejor.etiqueta}</strong> con tolerancia ${tolHTML} y arranca desde el ranking del periodo anterior. ` +
    `${porRondas ? "Es la que menos rondas de comunicación necesita" : "Es la que menos iteraciones necesita"} ` +
    `(${corto(iteracionesMedias(d, mejor))} iteraciones de media, ${corto(iteracionesMedias(d, mejor) * mejor.rondas)} rondas).</p>`
  );

  const comparaciones = [];

  if (Number.isFinite(valorJ) && mejor !== cJ) comparaciones.push(`${corto(valorJ)} de Jacobi`);
  if (Number.isFinite(valorG) && mejor !== cG) comparaciones.push(`${corto(valorG)} de Gauss–Seidel`);

  if (comparaciones.length) {
    partes.push(`<p>Frente a ${comparaciones.join(" y ")} (${unidad}, media de los dos inicios).</p>`);
  }

  // Si el mejor es un ω fuera de la lista pedida, se indica también el mejor de los ω del laboratorio
  if (mejor.extra) {
    const delLab = clasificar(d, criterio).filter(c => !c.extra && Number.isFinite(iteracionesMedias(d, c)))[0];

    if (delLab) {
      partes.push(
        `<p>Entre las configuraciones pedidas en el laboratorio, la mejor es <strong>${delLab.etiqueta}</strong> ` +
        `(${corto(medida(delLab))} ${unidad}). El ω* de la búsqueda numérica apenas la mejora, porque aquí el óptimo está muy cerca de 1.</p>`
      );
    }
  }

  if (filaMejor && filaMejor.rf.converge && filaMejor.rc.converge) {
    partes.push(
      `<p>En la actualización periódica simulada (<em>b</em> cambia ±${d.deltaB} %), el inicio caliente reduce las iteraciones ` +
      `de ${filaMejor.rf.iteraciones} a ${filaMejor.rc.iteraciones}: no se recalcula desde cero.</p>`
    );
  }

  if (otroCriterio && otroCriterio !== mejor) {
    partes.push(
      `<p>Si en lugar de eso se prioriza ${porRondas ? "reducir las iteraciones totales" : "reducir las rondas de comunicación entre nodos"}, ` +
      `la mejor opción pasa a ser <strong>${otroCriterio.etiqueta}</strong>. ` +
      `Cambia el criterio arriba para compararlo.</p>`
    );
  }

  const noRecomendados = d.configs.filter(c => c.tipo === "sor" && !c.extra && !(c.rho < 1)).map(c => etiquetaOmega(c.omega));
  const lentos = d.configs.filter(c => c.tipo === "sor" && !c.extra && c.rho < 1 && c.omega > 1.5).map(c => etiquetaOmega(c.omega));

  if (noRecomendados.length || lentos.length) {
    partes.push(
      `<p>Evita ω cercano a 2${lentos.length ? ` (ω = ${lentos.join(", ")} converge muy despacio)` : ""}` +
      `${noRecomendados.length ? `; ω = ${noRecomendados.join(", ")} no converge` : ""}: ` +
      `en cuanto ω se aleja del óptimo (≈ ${d.optimo.omega.toLocaleString("es-PE", { maximumFractionDigits: 2 })}), SOR pierde la ventaja.</p>`
    );
  }

  partes.push(
    `<p>Criterio de paro sugerido: residuo relativo y cambio relativo menores que ${tolHTML} a la vez, ` +
    `con un máximo de iteraciones como protección si la matriz deja de ser dominante.</p>`
  );

  caja.innerHTML = partes.join("");
}

// ========================================
// 9. INFORME DESCARGABLE
// ========================================

function descargarInforme() {
  if (!ultimo) return;

  const d = ultimo;
  const L = [];

  L.push("INFORME: CÁLCULO DISTRIBUIDO DE UN RANKING DE CUATRO NODOS");
  L.push("Métodos iterativos: Jacobi, Gauss-Seidel y SOR");
  L.push("");
  L.push("1. DATOS");
  L.push("A:");
  d.A.forEach(f => L.push("  [ " + f.map(v => String(v).padStart(6)).join(" ") + " ]"));
  L.push(`b = ${fmtVec(d.b, 6)}`);
  L.push(`Inicio A = ${fmtVec(d.inicios[0], 6)}; Inicio B = ${fmtVec(d.inicios[1], 6)}`);
  L.push(`Tolerancia = ${d.tol}; máximo de iteraciones = ${d.maxIter}; omegas = ${d.omegas.join(", ")}`);
  L.push("");
  L.push("2. DOMINANCIA Y RADIO ESPECTRAL");

  d.dominancia.forEach((f, i) => {
    L.push(`  Fila ${i + 1}: |aii| = ${f.diag.toFixed(3)}; suma fuera = ${f.fuera.toFixed(3)}; razón fila = ${f.razonFila.toFixed(3)}; razón columna = ${f.razonCol.toFixed(3)}`);
  });

  d.configs.filter(c => !c.extra).forEach(c => {
    L.push(`  rho(${c.etiqueta}) = ${c.rho.toFixed(5)}`);
  });

  L.push(`  omega óptimo numérico = ${d.optimo.omega.toFixed(3)} (rho = ${d.optimo.rho.toFixed(5)})`);
  L.push("");
  L.push("3. ITERACIONES");

  d.configs.forEach(c => {
    d.corridas[c.id].forEach((r, s) => {
      const f = r.historial[r.historial.length - 1];

      L.push(
        `  ${c.etiqueta} | inicio ${s === 0 ? "A" : "B"} | ${r.iteraciones} iter | ` +
        `residuo ${f.residuo.toExponential(2)} | cambio ${f.cambio === null ? "-" : f.cambio.toExponential(2)} | ` +
        `${r.converge ? "converge" : r.diverge ? "diverge" : "no converge"}`
      );
    });
  });

  L.push("");
  L.push(`Solución de referencia (directa): ${fmtVec(d.xRef, 8)}`);
  L.push("");
  L.push("4. RECOMENDACIÓN");

  if (d.recomendacion && d.recomendacion.mejor) {
    L.push(`  Configuración recomendada: ${d.recomendacion.mejor.etiqueta}`);
    L.push(`  Criterio: ${d.recomendacion.criterio === "iter" ? "menos iteraciones" : "menos rondas de comunicación"}`);

    d.recomendacion.filasCaliente.forEach(({ c, rf, rc }) => {
      L.push(`  Actualización periódica (${c.etiqueta}): frío ${rf.iteraciones} iter; caliente ${rc.iteraciones} iter`);
    });
  }

  const blob = new Blob(["\ufeff" + L.join("\r\n")], { type: "text/plain;charset=utf-8" });
  const enlace = document.createElement("a");

  enlace.href = URL.createObjectURL(blob);
  enlace.download = "informe_sistemas_iterativos.txt";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  URL.revokeObjectURL(enlace.href);
}

// ========================================
// 10. GRÁFICO
// ========================================

let chartInstance = null;

const PALETA = ["#5c6b82", "#1d4fd7", "#0e7a55", "#d88a00", "#7a3fd1", "#b8322c", "#0b8fa6", "#8a5a00", "#c2185b"];

function configurarGrafico() {
  const boton = $("btnGrafico");

  if (!boton) return;

  boton.addEventListener("click", generarGrafico);

  $("modoGrafico").addEventListener("change", () => {
    $("metodoGrafico").disabled = $("modoGrafico").value !== "ambos";
    $("inicioGrafico").disabled = $("modoGrafico").value === "rho";
    generarGrafico();
  });

  $("inicioGrafico").addEventListener("change", generarGrafico);
  $("metodoGrafico").addEventListener("change", generarGrafico);
}

function configuracionesGrafico(d) {
  return d.configs.filter(c => !c.duplicado);
}

function prepararSelectoresGrafico(d) {
  const sel = $("metodoGrafico");
  const previo = sel.value;

  sel.innerHTML = "";

  configuracionesGrafico(d).forEach((c, i) => {
    const op = document.createElement("option");

    op.value = i;
    op.textContent = c.etiqueta;
    sel.appendChild(op);
  });

  if (previo !== "" && Number(previo) < sel.options.length) sel.value = previo;
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
  const modo = $("modoGrafico").value;

  if (modo === "rho") dibujarRadio(contexto);
  else dibujarConvergencia(contexto, modo);

  $("chartVacio").hidden = true;
}

function opcionesBase(tituloX, tituloY, tipoY) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "nearest" },

    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } }
    },

    scales: {
      x: {
        type: "linear",
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

function serie(hist, campo) {
  return hist
    .map(h => ({ x: h.k, y: h[campo] }))
    .filter(p => p.y !== null && Number.isFinite(p.y) && p.y > 0);
}

function dibujarConvergencia(contexto, modo) {
  const d = ultimo;
  const inicio = Number($("inicioGrafico").value) || 0;
  const configs = configuracionesGrafico(d);

  let datasets;
  let titulo;

  if (modo === "ambos") {
    const c = configs[Number($("metodoGrafico").value) || 0];
    const hist = d.corridas[c.id][inicio].historial;

    datasets = [
      { label: "Residuo relativo ‖b − Ax‖/‖b‖", data: serie(hist, "residuo"), borderColor: "#1d4fd7", backgroundColor: "#1d4fd7" },
      { label: "Cambio relativo ‖xₖ − xₖ₋₁‖/‖xₖ‖", data: serie(hist, "cambio"), borderColor: "#d88a00", backgroundColor: "#d88a00", borderDash: [6, 4] }
    ];

    titulo = `${c.etiqueta}, inicio ${inicio === 0 ? "A" : "B"}`;
  } else {
    const campo = modo === "res" ? "residuo" : "cambio";

    datasets = configs.map((c, i) => ({
      label: c.etiqueta,
      data: serie(d.corridas[c.id][inicio].historial, campo),
      borderColor: PALETA[i % PALETA.length],
      backgroundColor: PALETA[i % PALETA.length]
    }));

    titulo = modo === "res" ? "Residuo relativo" : "Cambio relativo";
  }

  datasets.forEach(ds => {
    ds.borderWidth = ds.borderWidth || 2;
    ds.pointRadius = 2;
    ds.tension = 0;
  });

  const opciones = opcionesBase("Iteración k", modo === "ambos" ? "Valor relativo" : titulo, "logarithmic");

  opciones.plugins.tooltip = {
    callbacks: {
      label: ctx => `${ctx.dataset.label}: ${fmtAuto(ctx.parsed.y)} en k = ${ctx.parsed.x}`
    }
  };

  chartInstance = new Chart(contexto, { type: "line", data: { datasets }, options: opciones });

  $("notaGrafico").textContent =
    "En escala logarítmica, una recta indica convergencia con tasa constante: cuanto más empinada, menor es ρ. " +
    "SOR con ω = 1 coincide con Gauss–Seidel y no se dibuja aparte. Las curvas terminan al alcanzar la tolerancia o el máximo de iteraciones.";
}

function dibujarRadio(contexto) {
  const d = ultimo;
  const curva = d.optimo.curva.map(p => ({ x: p.w, y: p.rho })).filter(p => Number.isFinite(p.y));

  const datasets = [
    {
      label: "ρ(T_ω) de SOR",
      data: curva,
      borderColor: "#1d4fd7",
      backgroundColor: "#1d4fd7",
      borderWidth: 2,
      pointRadius: 0
    },
    {
      label: "Límite de convergencia ρ = 1",
      data: [{ x: 0, y: 1 }, { x: 2, y: 1 }],
      borderColor: "#b8322c",
      backgroundColor: "#b8322c",
      borderDash: [6, 4],
      borderWidth: 2,
      pointRadius: 0
    },
    {
      label: "Cota de Kahan |ω − 1|",
      data: [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 1 }],
      borderColor: "#5c6b82",
      backgroundColor: "#5c6b82",
      borderDash: [2, 4],
      borderWidth: 2,
      pointRadius: 0
    },
    {
      label: "ω probados",
      data: d.configs.filter(c => c.tipo === "sor" && !c.extra).map(c => ({ x: c.omega, y: c.rho })).filter(p => Number.isFinite(p.y)),
      showLine: false,
      borderColor: "#0b1830",
      backgroundColor: "#ffffff",
      pointStyle: "rectRot",
      pointRadius: 6,
      pointBorderWidth: 2
    },
    {
      label: "ω óptimo",
      data: [{ x: d.optimo.omega, y: d.optimo.rho }],
      showLine: false,
      borderColor: "#0e7a55",
      backgroundColor: "#0e7a55",
      pointRadius: 6
    }
  ];

  const opciones = opcionesBase("Factor de relajación ω", "Radio espectral ρ(T_ω)", "linear");

  opciones.scales.x.min = 0;
  opciones.scales.x.max = 2;
  opciones.scales.y.min = 0;
  opciones.scales.y.max = 1.3;

  opciones.plugins.tooltip = {
    callbacks: {
      label: ctx => `${ctx.dataset.label}: ρ = ${ctx.parsed.y.toFixed(4)} en ω = ${ctx.parsed.x}`
    }
  };

  chartInstance = new Chart(contexto, { type: "line", data: { datasets }, options: opciones });

  $("notaGrafico").textContent =
    `El mínimo de la curva (ρ = ${d.optimo.rho.toFixed(3)} en ω ≈ ${d.optimo.omega.toLocaleString("es-PE", { maximumFractionDigits: 3 })}) marca el ω óptimo. ` +
    "Por encima de ρ = 1 SOR diverge, y ninguna curva puede quedar por debajo de la cota |ω − 1| (Kahan).";
}

// ========================================
// 11. EJERCICIO: MALLA TÉRMICA DE TRES NODOS
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

// Matriz 3×3 dominante, con ρ(T_J) moderado para que el apartado 5 tenga sentido
function generarSistema() {
  for (let intento = 0; intento < 20000; intento++) {
    const A = Array.from({ length: 3 }, (_, i) =>
      Array.from({ length: 3 }, (_, j) => (i === j ? aleatorio(6, 12) : -aleatorio(0, 4)))
    );

    if (A.some((f, i) => f.every((v, j) => i === j || v === 0))) continue;

    const razones = A.map((f, i) => f.reduce((s, v, j) => (j === i ? s : s + Math.abs(v)), 0) / f[i]);
    const razonMax = Math.max(...razones);

    if (razonMax < 0.35 || razonMax > 0.8) continue;

    const rho = radioEspectral(matrizIteracion(A, "jacobi"));

    if (!(rho >= 0.25 && rho <= 0.75)) continue;

    return {
      A,
      razonMax,
      rho,
      b: [aleatorio(10, 40), aleatorio(10, 40), aleatorio(10, 40)],
      x0: [aleatorio(1, 8), aleatorio(1, 8), aleatorio(1, 8)]
    };
  }

  throw new Error("No se pudo generar el sistema");
}

function crearCaso() {
  const { A, razonMax, rho, b, x0 } = generarSistema();

  const omega = elegir([1.1, 1.2, 1.3]);
  const p = elegir([4, 6, 8]);
  const rhoRed = Number(rho.toFixed(3));
  const k = Math.ceil((p * Math.LN10) / -Math.log(rhoRed));

  const [a11, a12, a13] = A[0];
  const [a21, a22, a23] = A[1];
  const [a31, a32, a33] = A[2];
  const [b1, b2, b3] = b;
  const [x1, x2, x3] = x0;

  // Jacobi: componente 2
  const j2 = (b2 - a21 * x1 - a23 * x3) / a22;

  // Gauss–Seidel: componente 3 (usa x1⁽¹⁾ y x2⁽¹⁾ ya actualizados)
  const g1 = (b1 - a12 * x2 - a13 * x3) / a11;
  const g2 = (b2 - a21 * g1 - a23 * x3) / a22;
  const g3 = (b3 - a31 * g1 - a32 * g2) / a33;

  // SOR: componente 2
  const s1 = (1 - omega) * x1 + omega * g1;
  const gt2 = (b2 - a21 * s1 - a23 * x3) / a22;
  const s2 = (1 - omega) * x2 + omega * gt2;

  const f = (v, d = 3) => texNum(v, d);
  const q = (v, d = 3) => texPar(v, d);

  const partes = [
    {
      titulo: "Dominancia diagonal",
      enunciado:
        `<p>Calcula la razón de dominancia por filas, máx<sub><em>i</em></sub> Σ<sub><em>j</em>≠<em>i</em></sub> |<em>a<sub>ij</sub></em>| / |<em>a<sub>ii</sub></em>|. ` +
        `Si es menor que 1, Jacobi y Gauss–Seidel convergen. ¿Cuánto vale?</p>`,
      unidad: "adim.",
      esperado: razonMax,
      decimales: 3,
      tipo: "real",
      pista: "Para cada fila suma los valores absolutos de los elementos fuera de la diagonal y divide entre el valor absoluto del elemento diagonal. Quédate con la mayor razón.",
      solucion: [
        { tex: `\\text{razones por fila}=\\left(${A.map((fila, i) => f(fila.reduce((s, v, j) => (j === i ? s : s + Math.abs(v)), 0) / fila[i])).join(",\\;")}\\right)` },
        { tex: `\\max_i\\frac{\\sum_{j\\ne i}|a_{ij}|}{|a_{ii}|}=${f(razonMax)}<1\\;\\Rightarrow\\;\\text{Jacobi y Gauss–Seidel convergen}` },
        { txt: "Esta razón es también ‖T_J‖∞, la norma de la matriz de iteración de Jacobi." }
      ]
    },
    {
      titulo: "Una iteración de Jacobi",
      enunciado:
        `<p>Con el inicio <em>x</em><sup>(0)</sup> dado, aplica una iteración de <strong>Jacobi</strong>. ` +
        `¿Cuánto vale <em>x</em><sub>2</sub><sup>(1)</sup>?</p>`,
      unidad: "°C",
      esperado: j2,
      decimales: 3,
      tipo: "real",
      pista: "En Jacobi todas las componentes se calculan solo con los valores de x⁽⁰⁾: x₂⁽¹⁾ = (b₂ − a₂₁x₁⁽⁰⁾ − a₂₃x₃⁽⁰⁾)/a₂₂.",
      solucion: [
        { tex: `x_2^{(1)}=\\frac{b_2-a_{21}x_1^{(0)}-a_{23}x_3^{(0)}}{a_{22}}=\\frac{${f(b2, 0)}-${q(a21, 0)}\\cdot ${f(x1, 0)}-${q(a23, 0)}\\cdot ${f(x3, 0)}}{${f(a22, 0)}}=${f(j2)}` }
      ]
    },
    {
      titulo: "Una iteración de Gauss–Seidel",
      enunciado:
        `<p>Aplica ahora una iteración de <strong>Gauss–Seidel</strong> desde el mismo inicio, usando cada valor nuevo en cuanto lo calculas. ` +
        `¿Cuánto vale <em>x</em><sub>3</sub><sup>(1)</sup>?</p>`,
      unidad: "°C",
      esperado: g3,
      decimales: 3,
      tipo: "real",
      pista: "Calcula en orden x₁⁽¹⁾, x₂⁽¹⁾ y x₃⁽¹⁾. Para x₂⁽¹⁾ usa x₁⁽¹⁾ ya actualizado, y para x₃⁽¹⁾ usa x₁⁽¹⁾ y x₂⁽¹⁾ nuevos.",
      solucion: [
        { tex: `x_1^{(1)}=\\frac{${f(b1, 0)}-${q(a12, 0)}\\cdot ${f(x2, 0)}-${q(a13, 0)}\\cdot ${f(x3, 0)}}{${f(a11, 0)}}=${f(g1)}` },
        { tex: `x_2^{(1)}=\\frac{${f(b2, 0)}-${q(a21, 0)}\\cdot ${q(g1)}-${q(a23, 0)}\\cdot ${f(x3, 0)}}{${f(a22, 0)}}=${f(g2)}` },
        { tex: `x_3^{(1)}=\\frac{${f(b3, 0)}-${q(a31, 0)}\\cdot ${q(g1)}-${q(a32, 0)}\\cdot ${q(g2)}}{${f(a33, 0)}}=${f(g3)}` }
      ]
    },
    {
      titulo: "Una iteración de SOR",
      enunciado:
        `<p>Aplica una iteración de <strong>SOR con ω = ${omega}</strong> desde el mismo inicio. ` +
        `¿Cuánto vale <em>x</em><sub>2</sub><sup>(1)</sup>?</p>`,
      unidad: "°C",
      esperado: s2,
      decimales: 3,
      tipo: "real",
      pista: "En SOR cada componente es (1 − ω)·valor anterior + ω·(valor de Gauss–Seidel). Para x₂ necesitas antes la x₁⁽¹⁾ de SOR, no la de Gauss–Seidel.",
      solucion: [
        { tex: `\\tilde{x}_1=${f(g1)},\\qquad x_1^{(1)}=(1-${omega})\\cdot ${f(x1, 0)}+${omega}\\cdot ${f(g1)}=${f(s1)}` },
        { tex: `\\tilde{x}_2=\\frac{${f(b2, 0)}-${q(a21, 0)}\\cdot ${q(s1)}-${q(a23, 0)}\\cdot ${f(x3, 0)}}{${f(a22, 0)}}=${f(gt2)}` },
        { tex: `x_2^{(1)}=(1-${omega})\\cdot ${f(x2, 0)}+${omega}\\cdot ${f(gt2)}=${f(s2)}` }
      ]
    },
    {
      titulo: "Iteraciones necesarias",
      enunciado:
        `<p>El radio espectral de la matriz de iteración de Jacobi es <strong>ρ(<em>T</em><sub>J</sub>) = ${rhoRed}</strong>. ` +
        `¿Cuántas iteraciones de Jacobi, como mínimo, hacen falta para reducir el error inicial en un factor de 10<sup>−${p}</sup>? ` +
        `Usa el criterio ρ<sup>k</sup> ≤ 10<sup>−${p}</sup>.</p>`,
      unidad: "iter.",
      esperado: k,
      decimales: 0,
      tipo: "entero",
      pista: "Despeja k de ρ^k ≤ 10^−p tomando logaritmos: k ≥ p·ln(10)/(−ln ρ). Como k es un número de iteraciones, redondea hacia arriba.",
      solucion: [
        { tex: `\\rho^{k}\\le 10^{-${p}}\\;\\Rightarrow\\;k\\ge\\frac{${p}\\ln 10}{-\\ln ${rhoRed}}=\\frac{${f(p * Math.LN10, 4)}}{${f(-Math.log(rhoRed), 4)}}=${f((p * Math.LN10) / -Math.log(rhoRed), 2)}` },
        { tex: `k_{\\min}=${k}` },
        { txt: "Cuanto más cerca de 1 está ρ, más crece k: con ρ = 0.99 harían falta cientos de iteraciones para la misma reducción." }
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

  return { p: { A, b, x0, omega }, partes };
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
  const { A, b, x0 } = caso.p;

  $("escenarioEjercicio").innerHTML = `
    <h3>Malla térmica de tres nodos</h3>
    <p>
      En una placa disipadora, tres nodos intercambian calor por conducción. El balance de energía de cada nodo
      da el sistema <em>Ax</em> = <em>b</em>, donde <em>x</em> son las temperaturas en °C. La matriz es grande y dispersa en la práctica,
      así que se resuelve con métodos <strong>iterativos</strong>, partiendo de la estimación inicial <em>x</em><sup>(0)</sup>.
    </p>
    <div class="math-box" id="escMatriz" aria-label="Matriz A, vector b e inicio del sistema"></div>`;

  const caja = $("escMatriz");
  const tex = `A=${texMat(A, 0)},\\quad b=${texVec(b, 0)},\\quad x^{(0)}=${texVec(x0, 0)}`;

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
    comentario = "Dominas el hilo completo: dominancia, las tres iteraciones y la estimación del número de iteraciones.";
  } else if (correctas >= 3) {
    comentario = "Buen resultado. Repasa los apartados marcados en rojo y pulsa «Nuevo caso» para practicar con otra matriz.";
  } else {
    comentario = "Revisa el desarrollo de cada apartado y la teoría de Jacobi, Gauss–Seidel y SOR; después prueba con un caso nuevo.";
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
    parte.feedback = { clase: "fb-warn", texto: "Escribe un número válido, por ejemplo 12.5 o 0.667." };
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

  if (parte.tipo === "entero" && !Number.isInteger(valor)) {
    ayuda = "No coincide: el número de iteraciones debe ser entero (redondea hacia arriba).";
  } else if (parte.tipo === "entero" && Math.abs(valor - parte.esperado) === 1) {
    ayuda = "Casi. Recuerda redondear hacia arriba: con menos iteraciones no se alcanza la reducción pedida.";
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

// ========================================
// 12. FORMULARIO DE CONTACTO
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