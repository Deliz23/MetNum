/**
 * MetNum - Utilidades Compartidas para Métodos Numéricos
 * Contiene funciones comunes de formateo, álgebra lineal, manejo del DOM y KaTeX.
 */

"use strict";

// ========================================
// 1. SELECTOR DOM (Seguro contra redeclaraciones)
// ========================================
if (typeof window.$ === "undefined") {
  window.$ = id => document.getElementById(id);
}

// ========================================
// 2. FORMATEADORES NUMÉRICOS
// ========================================

/**
 * Formatea un número con separadores de miles según configuración es-PE.
 */
function fmtLargo(n, cifras = 12) {
  if (!Number.isFinite(n)) return String(n);
  return n.toLocaleString("es-PE", { maximumSignificantDigits: cifras });
}

/**
 * Formato corto para etiquetas o métricas resumidas.
 */
function corto(n, cifras = 4) {
  if (!Number.isFinite(n)) return String(n);
  return n.toLocaleString("es-PE", { maximumSignificantDigits: cifras });
}

/**
 * Formatea un número con una cantidad fija de decimales.
 */
function dec(n, d = 2) {
  if (!Number.isFinite(n)) return String(n);
  return n.toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/**
 * Formato porcentual.
 */
function pct(n, d = 2) {
  if (!Number.isFinite(n)) return String(n);
  return `${(n * 100).toFixed(d)}%`;
}

/**
 * Formato adaptativo: decimal estándar para valores moderados o científica para extremos.
 */
function fmtAuto(n, cifras = 6) {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return "0";

  const abs = Math.abs(n);
  if (abs < 1e-3 || abs >= 1e12) {
    return n.toExponential(3).replace("e+", "e");
  }

  return n.toLocaleString("es-PE", { maximumSignificantDigits: cifras });
}

/**
 * Notación científica limpia para inserción HTML (ej. 3.14 &times; 10<sup>&minus;5</sup>).
 */
function sciHTML(n, decimales = 2) {
  if (n === 0) return "0";
  if (!Number.isFinite(n)) return String(n);

  const [mantisa, exp] = n.toExponential(decimales).split("e");
  const exponente = String(Number(exp)).replace("-", "&minus;");

  return `${mantisa} &times; 10<sup>${exponente}</sup>`;
}

/**
 * Elimina ruido de redondeo en flotantes cercanos a cero.
 */
function limpio(n, umbral = 1e-12) {
  return Math.abs(n) < umbral ? 0 : n;
}

// ========================================
// 3. GENERADORES PARA LATEX (KaTeX)
// ========================================

function texNum(v, d = 4) {
  if (!Number.isFinite(v)) return String(v);
  if (Math.abs(v) < 0.5 * 10 ** -d) return "0";
  return String(+v.toFixed(d));
}

function texPar(v, d = 4) {
  const t = texNum(v, d);
  return v < 0 ? `(${t})` : t;
}

function texSci(n, cifras = 4) {
  if (!Number.isFinite(n)) return String(n);
  const [m, e] = n.toExponential(cifras - 1).split("e");
  return `${m}\\times10^{${Number(e)}}`;
}

function texInt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\\,");
}

function texMat(M, d = 4) {
  const filas = M.map(fila => fila.map(v => texNum(v, d)).join(" & "));
  return `\\begin{pmatrix} ${filas.join(" \\\\ ")} \\end{pmatrix}`;
}

function texVec(v, d = 4) {
  return `\\begin{pmatrix} ${v.map(x => texNum(x, d)).join(" \\\\ ")} \\end{pmatrix}`;
}

// ========================================
// 4. INTERACTIVIDAD Y NAVEGACIÓN
// ========================================

/**
 * Configura el botón flotante para volver arriba suavemente al hacer scroll.
 */
function configurarBotonInicio(botonId = "scrollTopBtn") {
  const boton = $(botonId);
  if (!boton) return;

  function actualizarBoton() {
    boton.classList.toggle("active", window.scrollY > 300);
  }

  window.addEventListener("scroll", actualizarBoton, { passive: true });
  actualizarBoton();
}

/**
 * Configura la barra de navegación: cierre en móviles al hacer clic y ScrollSpy con IntersectionObserver.
 */
function configurarMenu(menuId = "navmenu") {
  const menu = $(menuId);
  const enlaces = document.querySelectorAll(`#${menuId} .nav-link[href^="#"]`);
  if (!enlaces.length) return;

  function marcarActivo(id) {
    enlaces.forEach(enlace => {
      enlace.classList.toggle("active", enlace.getAttribute("href") === "#" + id);
    });
  }

  enlaces.forEach(enlace => {
    enlace.addEventListener("click", () => {
      marcarActivo(enlace.getAttribute("href").slice(1));

      if (menu && menu.classList.contains("show") && window.matchMedia("(max-width: 1199.98px)").matches) {
        if (typeof bootstrap !== "undefined" && bootstrap.Collapse) {
          bootstrap.Collapse.getOrCreateInstance(menu).hide();
        }
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
      const href = enlace.getAttribute("href");
      if (href && href.length > 1) {
        const seccion = document.querySelector(href);
        if (seccion) observador.observe(seccion);
      }
    });
  }
}

/**
 * Renderizado en lote de fórmulas KaTeX.
 */
function renderizarKaTeX(formulas) {
  if (typeof katex === "undefined") {
    console.warn("KaTeX no está disponible.");
    return;
  }

  formulas.forEach(({ id, formula, display = true }) => {
    const el = $(id);
    if (el) {
      try {
        katex.render(formula, el, {
          throwOnError: false,
          displayMode: display
        });
      } catch (err) {
        console.error("Error al renderizar fórmula KaTeX en #" + id, err);
      }
    }
  });
}

/**
 * Medición de tiempo de ejecución de algoritmos numéricos.
 */
function medir(funcion) {
  const inicio = performance.now();
  const valor = funcion();
  return { valor, ms: performance.now() - inicio };
}

/**
 * Configuración del formulario de contacto / feedback.
 */
function configurarFormulario(formId = "contactForm", feedbackId = "contactFeedback") {
  const formulario = $(formId);
  if (!formulario) return;

  formulario.addEventListener("submit", evento => {
    evento.preventDefault();
    const fb = $(feedbackId);
    if (fb) {
      fb.className = "text-success small mt-2 d-block";
      fb.textContent = "¡Gracias por tus comentarios! Se ha procesado tu solicitud.";
    }
  });
}

// ========================================
// 5. ÁLGEBRA LINEAL BÁSICA
// ========================================

function normaInfVec(v) {
  let m = 0;
  for (let i = 0; i < v.length; i++) {
    const a = Math.abs(v[i]);
    if (a > m) m = a;
  }
  return m;
}

function normaInfMat(M) {
  let m = 0;
  for (let i = 0; i < M.length; i++) {
    let s = 0;
    for (let j = 0; j < M[i].length; j++) s += Math.abs(M[i][j]);
    if (s > m) m = s;
  }
  return m;
}

function matVec(M, x) {
  const n = M.length;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += M[i][j] * x[j];
    y[i] = s;
  }
  return y;
}

function matMul(A, B) {
  const n = A.length;
  const C = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const t = A[i][k];
      for (let j = 0; j < n; j++) C[i][j] += t * B[k][j];
    }
  }
  return C;
}

function inversaGaussJordan(A) {
  const n = A.length;
  const M = Array.from({ length: n }, (_, i) => {
    const fila = new Float64Array(2 * n);
    for (let j = 0; j < n; j++) fila[j] = A[i][j];
    fila[n + i] = 1;
    return fila;
  });

  for (let col = 0; col < n; col++) {
    let maxFila = col;
    let maxVal = Math.abs(M[col][col]);
    for (let i = col + 1; i < n; i++) {
      const val = Math.abs(M[i][col]);
      if (val > maxVal) { maxVal = val; maxFila = i; }
    }
    if (maxVal < 1e-14) return null; // Matriz singular

    if (maxFila !== col) {
      const temp = M[col];
      M[col] = M[maxFila];
      M[maxFila] = temp;
    }

    const piv = M[col][col];
    for (let j = 0; j < 2 * n; j++) M[col][j] /= piv;

    for (let i = 0; i < n; i++) {
      if (i === col) continue;
      const factor = M[i][col];
      for (let j = 0; j < 2 * n; j++) M[i][j] -= factor * M[col][j];
    }
  }

  return Array.from({ length: n }, (_, i) => Array.from(M[i].slice(n)));
}
