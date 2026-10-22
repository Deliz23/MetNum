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

function dec(n, d = 2) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtAuto(n) {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return "0";

  const abs = Math.abs(n);

  if (abs < 1e-3 || abs >= 1e15) {
    return n.toExponential(3).replace("e+", "e");
  }

  return n.toLocaleString("es-PE", { maximumSignificantDigits: 6 });
}

function sciHTML(n, decimales = 1) {
  if (n === 0) return "0";
  if (!Number.isFinite(n)) return String(n);

  const [mantisa, exp] = n.toExponential(decimales).split("e");
  const exponente = String(Number(exp)).replace("-", "−");

  return `${mantisa} × 10<sup>${exponente}</sup>`;
}

// Cero visual para el ruido de redondeo
function limpio(n, umbral = 1e-9) {
  return Math.abs(n) < umbral ? 0 : n;
}

function texNum(v, d = 4) {
  if (Math.abs(v) < 0.5 * 10 ** -d) return "0";
  return String(+v.toFixed(d));
}

function texPar(v, d = 4) {
  const t = texNum(v, d);
  return v < 0 ? `(${t})` : t;
}

// ========================================
// 2. INTERPOLADORES CON INTERFAZ COMÚN
// ========================================
// metodo.construir(t, y) -> { evaluar(x), costo: { construccion, evaluacion } }

function buscarIntervalo(t, x) {
  let lo = 0;
  let hi = t.length - 2;

  while (lo < hi) {
    const medio = (lo + hi + 1) >> 1;

    if (t[medio] <= x) lo = medio;
    else hi = medio - 1;
  }

  return lo;
}

const INTERPOLADORES = {
  lagrange: {
    id: "lagrange",
    nombre: "Lagrange",
    construir(t, y) {
      const n = t.length;

      return {
        grado: n - 1,
        evaluar(x) {
          let suma = 0;

          for (let i = 0; i < n; i++) {
            let termino = y[i];

            for (let j = 0; j < n; j++) {
              if (j !== i) termino *= (x - t[j]) / (t[i] - t[j]);
            }

            suma += termino;
          }

          return suma;
        },
        // por cada i: (n−1) × (2 restas + 1 división + 1 producto) + 1 suma
        costo: { construccion: 0, evaluacion: 4 * n * (n - 1) + n }
      };
    }
  },

  newton: {
    id: "newton",
    nombre: "Newton",
    construir(t, y) {
      const n = t.length;

      // columnas de diferencias divididas: columnas[k][i] = f[x_i, ..., x_{i+k}]
      const columnas = [y.slice()];

      for (let k = 1; k < n; k++) {
        const previa = columnas[k - 1];
        const actual = [];

        for (let i = 0; i < n - k; i++) {
          actual.push((previa[i + 1] - previa[i]) / (t[i + k] - t[i]));
        }

        columnas.push(actual);
      }

      const coef = columnas.map(c => c[0]);

      return {
        grado: n - 1,
        columnas,
        coef,
        evaluar(x) {
          let p = coef[n - 1];

          for (let k = n - 2; k >= 0; k--) p = p * (x - t[k]) + coef[k];

          return p;
        },
        // tabla: 3 operaciones por entrada; Horner: 3 operaciones por paso
        costo: { construccion: (3 * n * (n - 1)) / 2, evaluacion: 3 * (n - 1) }
      };
    }
  },

  spline: {
    id: "spline",
    nombre: "Spline natural",
    construir(t, y) {
      const N = t.length;
      const m = N - 1;

      const h = [];
      const M = new Array(N).fill(0);
      let ops = 0;

      for (let i = 0; i < m; i++) h.push(t[i + 1] - t[i]);
      ops += m;

      // Sistema tridiagonal para las segundas derivadas M_1 ... M_{N-2} (M_0 = M_{N-1} = 0)
      const K = N - 2;

      if (K > 0) {
        const a = [];
        const b = [];
        const c = [];
        const d = [];

        for (let i = 1; i <= K; i++) {
          a.push(h[i - 1]);
          b.push(2 * (h[i - 1] + h[i]));
          c.push(h[i]);
          d.push(6 * ((y[i + 1] - y[i]) / h[i] - (y[i] - y[i - 1]) / h[i - 1]));
        }

        ops += 9 * K;

        // Algoritmo de Thomas
        for (let i = 1; i < K; i++) {
          const w = a[i] / b[i - 1];

          b[i] -= w * c[i - 1];
          d[i] -= w * d[i - 1];
        }

        ops += 5 * (K - 1);

        const x = new Array(K);

        x[K - 1] = d[K - 1] / b[K - 1];

        for (let i = K - 2; i >= 0; i--) x[i] = (d[i] - c[i] * x[i + 1]) / b[i];

        ops += 1 + 3 * (K - 1);

        for (let i = 0; i < K; i++) M[i + 1] = x[i];
      }

      const seg = [];

      for (let i = 0; i < m; i++) {
        seg.push({
          x0: t[i],
          a: y[i],
          b: (y[i + 1] - y[i]) / h[i] - (h[i] * (2 * M[i] + M[i + 1])) / 6,
          c: M[i] / 2,
          d: (M[i + 1] - M[i]) / (6 * h[i])
        });
      }

      ops += 11 * m;

      return {
        grado: 3,
        seg,
        M,
        h,
        // orden: 0 = valor, 1 = primera derivada, 2 = segunda derivada
        evaluar(x, orden = 0) {
          const s = seg[buscarIntervalo(t, x)];
          const dx = x - s.x0;

          if (orden === 0) return s.a + dx * (s.b + dx * (s.c + dx * s.d));
          if (orden === 1) return s.b + dx * (2 * s.c + 3 * s.d * dx);

          return 2 * s.c + 6 * s.d * dx;
        },
        // una resta y un Horner cúbico (3 productos y 3 sumas), sin contar la búsqueda del intervalo
        costo: { construccion: ops, evaluacion: 7 }
      };
    }
  },

  lineal: {
    id: "lineal",
    nombre: "Lineal por tramos (referencia)",
    construir(t, y) {
      return {
        grado: 1,
        evaluar(x) {
          const i = buscarIntervalo(t, x);

          return y[i] + ((y[i + 1] - y[i]) / (t[i + 1] - t[i])) * (x - t[i]);
        },
        costo: { construccion: 0, evaluacion: 6 }
      };
    }
  }
};

// Raíces reales de a·x² + b·x + c = 0
function raicesCuadratica(a, b, c) {
  if (Math.abs(a) < 1e-14) return Math.abs(b) < 1e-14 ? [] : [-c / b];

  const disc = b * b - 4 * a * c;

  if (disc < 0) return [];

  const raiz = Math.sqrt(disc);

  return [(-b - raiz) / (2 * a), (-b + raiz) / (2 * a)];
}

// Máximo continuo del spline: se evalúan extremos de cada tramo y las raíces de S'
function maximoSpline(spline, t) {
  let mejor = { x: t[0], v: spline.evaluar(t[0]) };

  const probar = x => {
    const v = spline.evaluar(x);

    if (v > mejor.v) mejor = { x, v };
  };

  probar(t[t.length - 1]);

  spline.seg.forEach((s, i) => {
    raicesCuadratica(3 * s.d, 2 * s.c, s.b).forEach(r => {
      const x = s.x0 + r;

      if (x >= t[i] && x <= t[i + 1]) probar(x);
    });
  });

  return mejor;
}

// Máximo continuo de una función cualquiera en [a, b]: barrido y refinamiento por sección áurea
function maximoNumerico(f, a, b, puntos = 20000) {
  const paso = (b - a) / puntos;

  let mejor = { x: a, v: f(a) };

  for (let k = 1; k <= puntos; k++) {
    const x = a + k * paso;
    const v = f(x);

    if (v > mejor.v) mejor = { x, v };
  }

  let lo = Math.max(a, mejor.x - paso);
  let hi = Math.min(b, mejor.x + paso);
  const fi = (Math.sqrt(5) - 1) / 2;

  for (let it = 0; it < 80; it++) {
    const x1 = hi - fi * (hi - lo);
    const x2 = lo + fi * (hi - lo);

    if (f(x1) > f(x2)) hi = x2;
    else lo = x1;
  }

  const x = (lo + hi) / 2;
  const v = f(x);

  return v > mejor.v ? { x, v } : mejor;
}

// Cambios de signo de la pendiente: extremos locales y su posición
function extremosLocales(f, a, b, puntos = 4000) {
  const paso = (b - a) / puntos;
  const posiciones = [];

  let previa = 0;
  let anterior = f(a);

  for (let k = 1; k <= puntos; k++) {
    const x = a + k * paso;
    const actual = f(x);
    const d = actual - anterior;

    if (Math.abs(d) > 1e-11) {
      if (previa !== 0 && Math.sign(d) !== Math.sign(previa)) posiciones.push(x - paso / 2);

      previa = d;
    }

    anterior = actual;
  }

  return posiciones;
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
      id: "math-lagrange",
      formula: "\\begin{aligned} P(x) &= \\sum_{i=0}^{n} y_i \\, L_i(x) \\[4pt] L_i(x) &= \\prod_{j\\ne i} \\frac{x-x_j}{x_i-x_j} \\end{aligned}"
    },
    {
      id: "math-newton",
      formula: "\\begin{aligned} P(x) &= f[x_0] + f[x_0,x_1](x-x_0) + \\cdots \\[4pt] &\\quad + f[x_0,\\dots,x_n] \\prod_{j=0}^{n-1}(x-x_j) \\end{aligned}"
    },
    {
      id: "math-dd",
      formula: "f[x_i,\\dots,x_{i+k}] = \\frac{f[x_{i+1},\\dots,x_{i+k}] - f[x_i,\\dots,x_{i+k-1}]}{x_{i+k} - x_i}"
    },
    {
      id: "math-spline",
      formula: "\\begin{aligned} S_i(x) &= a_i + b_i(x-x_i) + c_i(x-x_i)^2 + d_i(x-x_i)^3 \\[4pt] &\\quad \\text{para } x \\in [x_i, x_{i+1}] \\end{aligned}"
    },
    {
      id: "math-error",
      formula: "f(x) - P(x) = \\frac{f^{(n+1)}(\\xi)}{(n+1)!} \\prod_{i=0}^{n}(x-x_i)"
    },
    {
      id: "math-c2",
      formula: "\\begin{aligned} S_{i-1}^{(k)}(x_i) &= S_i^{(k)}(x_i), \\quad k=0,1,2 \\[4pt] S''(x_0) &= S''(x_n) = 0 \\end{aligned}"
    },
    {
      id: "math-tridiag",
      formula: "\\begin{aligned} &h_{i-1}M_{i-1} + 2(h_{i-1}+h_i)M_i + h_iM_{i+1} = \\[4pt] &\\quad 6\\left(\\frac{y_{i+1}-y_i}{h_i} - \\frac{y_i-y_{i-1}}{h_{i-1}}\\right) \\end{aligned}"
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
// 5. DEMOSTRACIÓN DE LA PORTADA: FENÓMENO DE RUNGE
// ========================================

function configurarDemoHero() {
  const entrada = $("heroN");

  if (!entrada) return;

  entrada.addEventListener("input", actualizarDemoHero);

  document.querySelectorAll(".preset").forEach(boton => {
    boton.addEventListener("click", () => {
      entrada.value = boton.dataset.n;
      actualizarDemoHero();
    });
  });

  actualizarDemoHero();
}

function actualizarDemoHero() {
  const n = Number($("heroN").value);

  const celdas = [$("heroErrP"), $("heroErrS"), $("heroMaxP"), $("heroPos")];
  const msg = $("heroMsg");

  celdas.forEach(c => c.classList.remove("is-loss"));
  msg.classList.remove("is-loss");

  if ($("heroN").value.trim() === "" || !Number.isInteger(n) || n < 3 || n > 25) {
    celdas.forEach(c => (c.textContent = "—"));
    msg.textContent = "Escribe un número entero de nodos entre 3 y 25.";
    return;
  }

  const f = x => 1 / (1 + 25 * x * x);
  const xs = Array.from({ length: n }, (_, i) => -1 + (2 * i) / (n - 1));
  const ys = xs.map(f);

  const poli = INTERPOLADORES.newton.construir(xs, ys);
  const spl = INTERPOLADORES.spline.construir(xs, ys);

  let errP = 0;
  let errS = 0;
  let maxP = -Infinity;
  let posP = 0;

  for (let k = 0; k <= 800; k++) {
    const x = -1 + k / 400;
    const real = f(x);
    const p = poli.evaluar(x);
    const eP = Math.abs(p - real);

    if (eP > errP) {
      errP = eP;
      posP = x;
    }

    errS = Math.max(errS, Math.abs(spl.evaluar(x) - real));
    maxP = Math.max(maxP, p);
  }

  $("heroErrP").textContent = errP.toFixed(4);
  $("heroErrS").textContent = errS.toFixed(4);
  $("heroMaxP").textContent = maxP.toFixed(3);
  $("heroPos").textContent = posP.toFixed(3);

  if (errP > 2 * errS && errP > 0.1) {
    $("heroErrP").classList.add("is-loss");
    $("heroMaxP").classList.add("is-loss");
    msg.classList.add("is-loss");
    msg.textContent =
      `El polinomio de grado ${n - 1} pasa por todos los nodos, pero entre ellos se aleja hasta ${errP.toFixed(2)} ` +
      `cerca del borde (x ≈ ${posP.toFixed(2)}). El spline sigue la curva con error ${errS.toFixed(3)}: más nodos no mejoran al polinomio, lo empeoran.`;
  } else {
    msg.textContent =
      `Con ${n} nodos ambos se parecen (errores ${errP.toFixed(3)} y ${errS.toFixed(3)}). ` +
      `Sube el número de nodos y observa cómo el error del polinomio crece mientras el del spline baja.`;
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

const T_DEFECTO = "0, 4, 8, 12, 16, 20, 24";
const Y_DEFECTO = "22, 21, 24, 31, 34, 28, 23";

let ultimo = null;

function configurarSimulador() {
  if (!$("formSim")) return;

  $("formSim").addEventListener("submit", evento => {
    evento.preventDefault();
    ejecutarSimulador();
  });

  $("btnReset").addEventListener("click", () => {
    $("calcT").value = T_DEFECTO;
    $("calcY").value = Y_DEFECTO;
    $("calcRet").value = 12;
    $("calcPaso").value = 1;
    ejecutarSimulador();
  });

  $("btnInforme").addEventListener("click", descargarInforme);
  $("btnCsv").addEventListener("click", descargarCsv);

  ejecutarSimulador();
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

function parsearLista(texto) {
  return texto
    .split(/[\s,;]+/)
    .filter(token => token !== "")
    .map(token => Number(token.replace(",", ".")));
}

// Paso 1 del laboratorio: ordenar, revisar duplicados y separar el punto retenido
function prepararDatos() {
  const t = parsearLista($("calcT").value);
  const y = parsearLista($("calcY").value);
  const ret = Number($("calcRet").value);
  const paso = Number($("calcPaso").value);

  if (t.length === 0 || y.length === 0) return { error: "Escribe las horas y las temperaturas." };
  if (t.some(v => !Number.isFinite(v)) || y.some(v => !Number.isFinite(v))) return { error: "Las horas y las temperaturas deben ser números." };
  if (t.length !== y.length) return { error: `Hay ${t.length} horas y ${y.length} temperaturas: deben ser la misma cantidad.` };
  if (!Number.isFinite(ret)) return { error: "Escribe la hora retenida." };
  if (!Number.isFinite(paso) || paso < 0.05) return { error: "El paso de evaluación debe ser al menos 0.05 h." };

  const log = [];

  // Orden por hora
  const yaOrdenado = t.every((v, i) => i === 0 || v >= t[i - 1]);
  const pares = t.map((hora, i) => ({ t: hora, y: y[i] })).sort((a, b) => a.t - b.t);

  log.push(yaOrdenado
    ? { clase: "is-ok", html: "<strong>Orden:</strong> las horas ya estaban ordenadas." }
    : { clase: "", html: "<strong>Orden:</strong> las horas estaban desordenadas y se reordenaron de menor a mayor, conservando cada temperatura con su hora." });

  // Duplicados
  const unicos = [];
  const eliminados = [];

  for (const p of pares) {
    const previo = unicos[unicos.length - 1];

    if (previo && Math.abs(p.t - previo.t) < 1e-9) {
      if (Math.abs(p.y - previo.y) > 1e-9) {
        return { error: `La hora ${p.t} aparece con dos temperaturas distintas (${previo.y} y ${p.y}). Una función no puede tomar dos valores en el mismo instante: corrige el dato.` };
      }

      eliminados.push(p.t);
    } else {
      unicos.push(p);
    }
  }

  log.push(eliminados.length
    ? { clase: "is-warn", html: `<strong>Duplicados:</strong> se eliminó ${eliminados.length === 1 ? "una medida repetida" : eliminados.length + " medidas repetidas"} (hora ${eliminados.join(", ")}), idéntica${eliminados.length === 1 ? "" : "s"} a la conservada.` }
    : { clase: "is-ok", html: "<strong>Duplicados:</strong> ninguno. Todas las horas son distintas." });

  if (unicos.length < 4) return { error: "Se necesitan al menos 4 medidas distintas: una se retiene y quedan 3 para construir las curvas." };

  // Punto retenido
  const idx = unicos.findIndex(p => Math.abs(p.t - ret) < 1e-9);

  if (idx === -1) return { error: `La hora retenida (${ret} h) no coincide con ninguna hora medida (${unicos.map(p => p.t).join(", ")}).` };
  if (idx === 0 || idx === unicos.length - 1) return { error: "La hora retenida no puede ser el primer ni el último punto: estimarla sería extrapolar, no interpolar." };

  const retenido = unicos[idx];
  const construccion = unicos.filter((_, i) => i !== idx);

  log.push({
    clase: "",
    html: `<strong>Punto retenido:</strong> (${dec(retenido.t, 0)} h, ${dec(retenido.y, 1)} °C). Se separa de la construcción y solo se usa para medir el error.`
  });

  log.push({
    clase: "",
    html: `<strong>Nodos de construcción:</strong> ${construccion.length}, que dan un polinomio de grado ${construccion.length - 1} y ${construccion.length - 1} tramos de spline.`
  });

  log.push({
    clase: "is-ok",
    html: `<strong>Rango de evaluación:</strong> [${corto(construccion[0].t)}, ${corto(construccion[construccion.length - 1].t)}] h. Todas las estimaciones quedan dentro de él, sin extrapolar.`
  });

  return {
    todos: unicos,
    indiceRetenido: idx,
    retenido,
    construccion,
    paso,
    log,
    tC: construccion.map(p => p.t),
    yC: construccion.map(p => p.y),
    tA: unicos.map(p => p.t),
    yA: unicos.map(p => p.y)
  };
}

function medirTiempo(interp, a, b) {
  const puntos = 1000;
  const repeticiones = 15;
  const xs = Array.from({ length: puntos }, (_, k) => a + ((b - a) * k) / (puntos - 1));

  let acumulado = 0;
  const inicio = performance.now();

  for (let r = 0; r < repeticiones; r++) {
    for (let k = 0; k < puntos; k++) acumulado += interp.evaluar(xs[k]);
  }

  const total = performance.now() - inicio;

  if (acumulado === Infinity) console.log(acumulado);

  return (total * 1000) / (puntos * repeticiones);
}

function calcularMetricas(interp, d, lineal) {
  const a = d.tC[0];
  const b = d.tC[d.tC.length - 1];
  const f = x => interp.evaluar(x);

  const valorRet = f(d.retenido.t);
  const error = Math.abs(valorRet - d.retenido.y);

  // Desviación respecto a la interpolación lineal en el primer y el último tramo
  let desvExt = 0;

  [[d.tC[0], d.tC[1]], [d.tC[d.tC.length - 2], b]].forEach(([x0, x1]) => {
    for (let k = 0; k <= 200; k++) {
      const x = x0 + ((x1 - x0) * k) / 200;

      desvExt = Math.max(desvExt, Math.abs(f(x) - lineal.evaluar(x)));
    }
  });

  // Desborde fuera del rango de las medidas
  const minY = Math.min(...d.yA);
  const maxY = Math.max(...d.yA);

  let maxF = -Infinity;
  let minF = Infinity;

  for (let k = 0; k <= 2000; k++) {
    const v = f(a + ((b - a) * k) / 2000);

    maxF = Math.max(maxF, v);
    minF = Math.min(minF, v);
  }

  const desborde = Math.max(0, maxF - maxY, minY - minF);

  const extremos = extremosLocales(f, a, b);

  return {
    valorRet,
    error,
    errorRel: (error / Math.abs(d.retenido.y)) * 100,
    desvExt,
    desborde,
    extremos,
    tiempo: medirTiempo(interp, a, b)
  };
}

function ejecutarSimulador() {
  const d = prepararDatos();

  if (d.error) {
    mostrarError(d.error);
    $("simResultados").hidden = true;
    $("btnInforme").disabled = true;
    $("btnCsv").disabled = true;
    ultimo = null;
    return;
  }

  mostrarError("");

  const { tC, yC, tA, yA } = d;

  // Construcción con la misma interfaz
  const lagrange = INTERPOLADORES.lagrange.construir(tC, yC);
  const newton = INTERPOLADORES.newton.construir(tC, yC);
  const spline = INTERPOLADORES.spline.construir(tC, yC);
  const lineal = INTERPOLADORES.lineal.construir(tC, yC);

  const a = tC[0];
  const b = tC[tC.length - 1];

  // Malla de evaluación
  const malla = [];

  for (let k = 0; a + k * d.paso <= b + 1e-9; k++) malla.push(Math.round((a + k * d.paso) * 1e9) / 1e9);

  // Número esperado de extremos según las medidas
  const difs = yA.slice(1).map((v, i) => v - yA[i]).filter(v => v !== 0);
  const esperados = difs.filter((v, i) => i > 0 && Math.sign(v) !== Math.sign(difs[i - 1])).length;

  const metricas = {
    lagrange: calcularMetricas(lagrange, d, lineal),
    newton: calcularMetricas(newton, d, lineal),
    spline: calcularMetricas(spline, d, lineal),
    lineal: calcularMetricas(lineal, d, lineal)
  };

  // Validación cruzada: se omite cada nodo interior
  const loo = [];

  for (let k = 1; k < tA.length - 1; k++) {
    const tt = tA.filter((_, i) => i !== k);
    const yy = yA.filter((_, i) => i !== k);

    const p = INTERPOLADORES.newton.construir(tt, yy);
    const s = INTERPOLADORES.spline.construir(tt, yy);
    const l = INTERPOLADORES.lineal.construir(tt, yy);

    loo.push({
      t: tA[k],
      poli: Math.abs(p.evaluar(tA[k]) - yA[k]),
      spline: Math.abs(s.evaluar(tA[k]) - yA[k]),
      lineal: Math.abs(l.evaluar(tA[k]) - yA[k]),
      esRetenido: k === d.indiceRetenido
    });
  }

  const rmse = clave => Math.sqrt(loo.reduce((s, r) => s + r[clave] ** 2, 0) / loo.length);

  // Máximo sin extrapolar (solo dentro de [a, b])
  const maxSpline = maximoSpline(spline, tC);
  const maxPoli = maximoNumerico(x => newton.evaluar(x), a, b);

  let mejorDato = 0;
  yA.forEach((v, i) => { if (v > yA[mejorDato]) mejorDato = i; });

  const horariaP = malla.map(x => newton.evaluar(x));
  const horariaS = malla.map(x => spline.evaluar(x));

  const indMax = arr => arr.reduce((m, v, i) => (v > arr[m] ? i : m), 0);

  const maxHorarioP = { x: malla[indMax(horariaP)], v: horariaP[indMax(horariaP)] };
  const maxHorarioS = { x: malla[indMax(horariaS)], v: horariaS[indMax(horariaS)] };

  ultimo = {
    d, lagrange, newton, spline, lineal, malla, metricas, esperados, loo,
    rmse: { poli: rmse("poli"), spline: rmse("spline"), lineal: rmse("lineal") },
    maxSpline, maxPoli, maxDato: { x: tA[mejorDato], v: yA[mejorDato] },
    maxHorarioP, maxHorarioS, horariaP, horariaS
  };

  pintarNodos(ultimo);
  pintarNewton(ultimo);
  pintarSpline(ultimo);
  pintarComparacion(ultimo);
  pintarLOO(ultimo);
  pintarMaximo(ultimo);
  pintarHoraria(ultimo);
  pintarDiagnostico(ultimo);
  pintarRecomendacion(ultimo);

  $("simResultados").hidden = false;
  $("btnInforme").disabled = false;
  $("btnCsv").disabled = false;

  if ($("errorChart") && typeof Chart !== "undefined") generarGrafico();
}

function lista(id, items) {
  const ul = $(id);

  ul.innerHTML = "";

  items.forEach(item => {
    const li = document.createElement("li");

    li.className = item.clase;
    li.innerHTML = item.html;
    ul.appendChild(li);
  });
}

function pintarNodos(u) {
  const tbody = $("tablaNodos");
  tbody.innerHTML = "";

  u.d.todos.forEach((p, i) => {
    const fila = document.createElement("tr");
    const ret = i === u.d.indiceRetenido;

    if (ret) fila.className = "is-held";

    fila.innerHTML =
      `<td class="num">${dec(p.t, 0)}</td>` +
      `<td class="num">${dec(p.y, 1)}</td>` +
      `<td>${ret ? "Validación (retenido)" : "Construcción"}</td>`;

    tbody.appendChild(fila);
  });

  lista("logDatos", u.d.log);
}

function pintarNewton(u) {
  const { d, newton, lagrange } = u;
  const n = d.tC.length;

  // Cabecera: t_i, f[·], f[·,·], ...
  let cabecera = '<tr><th scope="col" class="num">t<sub>i</sub> (h)</th>';

  for (let k = 0; k < n; k++) {
    cabecera += `<th scope="col" class="num">${k === 0 ? "f[x<sub>i</sub>]" : "orden " + k}</th>`;
  }

  $("theadDD").innerHTML = cabecera + "</tr>";

  const tbody = $("tablaDD");
  tbody.innerHTML = "";

  for (let i = 0; i < n; i++) {
    let fila = `<td class="num">${dec(d.tC[i], 0)}</td>`;

    for (let k = 0; k < n; k++) {
      if (i <= n - 1 - k) {
        const v = newton.columnas[k][i];
        const texto = (limpio(v, 1e-12)).toLocaleString("es-PE", { maximumSignificantDigits: 6 });

        fila += `<td class="num">${i === 0 ? `<strong>${texto}</strong>` : texto}</td>`;
      } else {
        fila += '<td class="num"></td>';
      }
    }

    const tr = document.createElement("tr");

    tr.innerHTML = fila;
    tbody.appendChild(tr);
  }

  // Lagrange y Newton son el mismo polinomio
  let difMax = 0;

  for (let k = 0; k <= 1000; k++) {
    const x = d.tC[0] + ((d.tC[n - 1] - d.tC[0]) * k) / 1000;

    difMax = Math.max(difMax, Math.abs(lagrange.evaluar(x) - newton.evaluar(x)));
  }

  let errNodos = 0;

  d.tC.forEach((x, i) => { errNodos = Math.max(errNodos, Math.abs(newton.evaluar(x) - d.yC[i])); });

  u.difLagNew = difMax;
  u.errNodos = errNodos;

  $("textoPoli").innerHTML =
    `Los coeficientes de Newton son la primera fila (en negrita). El polinomio tiene grado ${n - 1}. ` +
    `Lagrange y Newton difieren como máximo en ${fmtAuto(difMax)} °C sobre todo el intervalo: son el mismo polinomio escrito de dos formas. ` +
    `Reproducen los nodos con error ${fmtAuto(errNodos)} °C.`;
}

function pintarSpline(u) {
  const { d, spline } = u;
  const m = d.tC.length - 1;

  const tbody = $("tablaSegmentos");
  tbody.innerHTML = "";

  spline.seg.forEach((s, i) => {
    const fila = document.createElement("tr");

    fila.innerHTML =
      `<th scope="row">[${dec(d.tC[i], 0)}, ${dec(d.tC[i + 1], 0)}]</th>` +
      [s.a, s.b, s.c, s.d].map(v => `<td class="num">${limpio(v, 1e-12).toLocaleString("es-PE", { maximumSignificantDigits: 5 })}</td>`).join("");

    tbody.appendChild(fila);
  });

  // Continuidad C² en los nodos interiores
  const tc2 = $("tablaC2");
  tc2.innerHTML = "";

  let peor = 0;

  for (let i = 1; i < m; i++) {
    const x = d.tC[i];
    const izq = spline.seg[i - 1];
    const dx = x - izq.x0;

    const saltoS = izq.a + dx * (izq.b + dx * (izq.c + dx * izq.d)) - spline.seg[i].a;
    const saltoD1 = izq.b + dx * (2 * izq.c + 3 * izq.d * dx) - spline.seg[i].b;
    const saltoD2 = 2 * izq.c + 6 * izq.d * dx - 2 * spline.seg[i].c;

    peor = Math.max(peor, Math.abs(saltoS), Math.abs(saltoD1), Math.abs(saltoD2));

    const fila = document.createElement("tr");

    fila.innerHTML =
      `<td class="num">${dec(x, 0)}</td>` +
      [saltoS, saltoD1, saltoD2].map(v => `<td class="num">${sciHTML(Math.abs(v) < 1e-18 ? 0 : v, 1)}</td>`).join("");

    tc2.appendChild(fila);
  }

  const dosIni = spline.evaluar(d.tC[0], 2);
  const dosFin = spline.evaluar(d.tC[m], 2);
  const escala = Math.max(1, ...d.yC.map(Math.abs));
  const bien = peor < 1e-9 * escala && Math.abs(dosIni) < 1e-9 * escala && Math.abs(dosFin) < 1e-9 * escala;

  u.peorSalto = peor;
  u.c2 = bien;

  const insignia = $("badgeC2");

  insignia.className = "status " + (bien ? "status-ok" : "status-warn");
  insignia.innerHTML = bien
    ? '<i class="bi bi-check-lg" aria-hidden="true"></i>C² verificada'
    : "C² con error apreciable";

  $("textoC2").innerHTML =
    `Mayor salto en los nodos interiores: ${fmtAuto(peor)}. En los extremos <em>S″</em>(${dec(d.tC[0], 0)}) = ${fmtAuto(dosIni)} y ` +
    `<em>S″</em>(${dec(d.tC[m], 0)}) = ${fmtAuto(dosFin)}, como exige la frontera natural.`;
}

function notaFila(c) {
  return c.nota ? ` <span class="text-secondary small">${c.nota}</span>` : "";
}

function pintarComparacion(u) {
  const { d, metricas, lagrange, newton, spline, lineal, esperados } = u;

  const tbody = $("tablaComparacion");
  tbody.innerHTML = "";

  const filas = [
    { nombre: "Lagrange", m: metricas.lagrange, interp: lagrange },
    { nombre: "Newton", m: metricas.newton, interp: newton },
    { nombre: "Spline natural", m: metricas.spline, interp: spline },
    { nombre: "Lineal por tramos (referencia)", m: metricas.lineal, interp: lineal, ref: true }
  ];

  filas.forEach(({ nombre, m, interp, ref }) => {
    const fila = document.createElement("tr");

    if (ref) fila.className = "is-reference";

    const claseExt = m.extremos.length > esperados ? ' class="num is-warnc"' : ' class="num"';

    fila.innerHTML =
      `<th scope="row">${nombre}</th>` +
      `<td class="num">${dec(m.valorRet, 3)}</td>` +
      `<td class="num">${dec(m.error, 3)}<small class="d-block text-secondary" style="font-family:var(--font-sans)">${dec(m.errorRel, 2)} %</small></td>` +
      `<td class="num">${dec(m.desvExt, 2)}</td>` +
      `<td class="num">${dec(m.desborde, 2)}</td>` +
      `<td${claseExt}>${m.extremos.length}</td>` +
      `<td class="num">${interp.costo.construccion} / ${interp.costo.evaluacion}</td>` +
      `<td class="num">${m.tiempo.toLocaleString("es-PE", { maximumSignificantDigits: 2 })}</td>`;

    tbody.appendChild(fila);
  });

  $("notaComparacion").innerHTML =
    `Desviación en los extremos: mayor diferencia con la interpolación lineal en el primer y último tramo. ` +
    `Desborde: cuánto se sale la curva del rango de las medidas (${dec(Math.min(...d.yA), 1)} a ${dec(Math.max(...d.yA), 1)} °C). ` +
    `Extremos locales esperados según las medidas: <strong>${esperados}</strong>; si hay más, la curva oscila entre nodos. ` +
    `Las operaciones son aritméticas contadas en el código (sin la búsqueda del intervalo en el spline); el tiempo depende del equipo.`;
}

function pintarLOO(u) {
  const tbody = $("tablaLOO");
  tbody.innerHTML = "";

  u.loo.forEach(r => {
    const fila = document.createElement("tr");

    if (r.esRetenido) fila.className = "is-held";

    fila.innerHTML =
      `<td class="num">${dec(r.t, 0)}${r.esRetenido ? " (retenido)" : ""}</td>` +
      `<td class="num">${dec(r.poli, 3)}</td>` +
      `<td class="num">${dec(r.spline, 3)}</td>` +
      `<td class="num">${dec(r.lineal, 3)}</td>`;

    tbody.appendChild(fila);
  });

  const total = document.createElement("tr");

  total.className = "is-total";
  total.innerHTML =
    `<td class="num">RMSE</td>` +
    `<td class="num">${dec(u.rmse.poli, 3)}</td>` +
    `<td class="num">${dec(u.rmse.spline, 3)}</td>` +
    `<td class="num">${dec(u.rmse.lineal, 3)}</td>`;

  tbody.appendChild(total);
}

function posicionMaximo(x, tC) {
  if (x <= tC[0] + 1e-6 || x >= tC[tC.length - 1] - 1e-6) return "en el borde";

  const i = buscarIntervalo(tC, x);

  return `entre ${dec(tC[i], 0)} h y ${dec(tC[i + 1], 0)} h`;
}

function pintarMaximo(u) {
  const { d, maxSpline, maxPoli, maxDato, maxHorarioP, maxHorarioS } = u;

  const filas = [
    { nombre: "Medida más alta", x: maxDato.x, v: maxDato.v, pos: "medida real", resaltar: false },
    { nombre: "Polinomio (Lagrange = Newton)", x: maxPoli.x, v: maxPoli.v, pos: posicionMaximo(maxPoli.x, d.tC) },
    { nombre: "Spline natural", x: maxSpline.x, v: maxSpline.v, pos: posicionMaximo(maxSpline.x, d.tC), resaltar: true },
    { nombre: "Polinomio, solo horas de la malla", x: maxHorarioP.x, v: maxHorarioP.v, pos: "malla de evaluación" },
    { nombre: "Spline, solo horas de la malla", x: maxHorarioS.x, v: maxHorarioS.v, pos: "malla de evaluación" }
  ];

  const tbody = $("tablaMaximo");
  tbody.innerHTML = "";

  filas.forEach(f => {
    const fila = document.createElement("tr");

    if (f.resaltar) fila.className = "is-peak";

    fila.innerHTML =
      `<th scope="row">${f.nombre}</th>` +
      `<td class="num">${dec(f.x, 2)}</td>` +
      `<td class="num">${dec(f.v, 2)}</td>` +
      `<td>${f.pos}</td>`;

    tbody.appendChild(fila);
  });

  const dh = Math.abs(maxSpline.x - maxPoli.x);
  const dv = Math.abs(maxSpline.v - maxPoli.v);

  $("textoMaximo").innerHTML =
    `Búsqueda solo dentro de [${dec(d.tC[0], 0)}, ${dec(d.tC[d.tC.length - 1], 0)}] h. El spline y el polinomio coinciden en ` +
    `${dec(dh, 2)} h y ${dec(dv, 2)} °C: esa diferencia es una medida honesta de la incertidumbre de la estimación. ` +
    `La malla horaria puede perder el pico real, porque este cae entre horas.`;
}

function pintarHoraria(u) {
  const { d, malla, horariaP, horariaS, newton, lagrange } = u;
  const tbody = $("tablaHoraria");

  tbody.innerHTML = "";

  const indPico = horariaS.reduce((m, v, i) => (v > horariaS[m] ? i : m), 0);

  malla.forEach((x, i) => {
    const fila = document.createElement("tr");
    const nodo = d.tA.findIndex(t => Math.abs(t - x) < 1e-9);
    const esRet = Math.abs(x - d.retenido.t) < 1e-9;

    let nota = "";

    if (esRet) {
      nota = `retenido (medida ${dec(d.retenido.y, 1)})`;
      fila.className = "is-held";
    } else if (nodo >= 0) {
      nota = "nodo medido";
    }

    if (i === indPico) {
      nota += (nota ? "; " : "") + "máximo horario";
      if (!esRet) fila.className = "is-peak";
    }

    fila.innerHTML =
      `<td class="num">${dec(x, 2)}</td>` +
      `<td class="num">${dec(lagrange.evaluar(x), 3)}</td>` +
      `<td class="num">${dec(horariaP[i], 3)}</td>` +
      `<td class="num">${dec(horariaS[i], 3)}</td>` +
      `<td>${nota}</td>`;

    tbody.appendChild(fila);
  });
}

function pintarDiagnostico(u) {
  const { d, metricas, esperados, spline, newton } = u;

  const items = [];

  // Lagrange = Newton
  items.push({
    clase: "is-ok",
    html: `<strong>Lagrange y Newton:</strong> difieren como máximo ${fmtAuto(u.difLagNew)} °C. Son el mismo polinomio; cambia el costo de construirlo y evaluarlo, no el resultado.`
  });

  // C²
  items.push({
    clase: u.c2 ? "is-ok" : "is-warn",
    html: u.c2
      ? `<strong>Spline:</strong> continuidad C² verificada. El mayor salto en <em>S</em>, <em>S′</em> y <em>S″</em> en los nodos interiores es ${fmtAuto(u.peorSalto)} y <em>S″</em> vale 0 en los extremos.`
      : `<strong>Spline:</strong> la continuidad C² no se cumple con la precisión esperada (salto ${fmtAuto(u.peorSalto)}). Revisa los datos.`
  });

  // Error retenido
  const eP = metricas.newton.error;
  const eS = metricas.spline.error;
  const mejor = eS < eP ? "el spline" : "el polinomio";

  items.push({
    clase: "",
    html: `<strong>Punto retenido (${dec(d.retenido.t, 0)} h):</strong> el polinomio da ${dec(metricas.newton.valorRet, 2)} °C (error ${dec(eP, 3)}) y el spline ` +
      `${dec(metricas.spline.valorRet, 2)} °C (error ${dec(eS, 3)}), frente a la medida de ${dec(d.retenido.y, 1)} °C. Aquí acierta mejor ${mejor}, ` +
      `aunque con un solo punto retenido la diferencia puede ser casualidad.`
  });

  // Oscilación
  const extP = metricas.newton.extremos;
  const extS = metricas.spline.extremos;
  const lugar = arr => arr.map(x => dec(x, 1)).join(", ");

  if (extP.length > esperados) {
    items.push({
      clase: "is-warn",
      html: `<strong>Oscilación:</strong> las medidas sugieren ${esperados} extremo${esperados === 1 ? "" : "s"}; el polinomio tiene ${extP.length} (en t ≈ ${lugar(extP)} h), ` +
        `es decir, ${extP.length - esperados} que los datos no respaldan. El spline tiene ${extS.length} (en t ≈ ${lugar(extS)} h).`
    });
  } else {
    items.push({
      clase: "is-ok",
      html: `<strong>Oscilación:</strong> las medidas sugieren ${esperados} extremo${esperados === 1 ? "" : "s"} y el polinomio tiene ${extP.length} (en t ≈ ${lugar(extP)} h); no se detectan oscilaciones espurias.`
    });
  }

  // Extremos
  items.push({
    clase: "",
    html: `<strong>Extremos del intervalo:</strong> en el primer y último tramo el polinomio se aparta hasta ${dec(metricas.newton.desvExt, 2)} °C de la recta entre nodos, ` +
      `y el spline hasta ${dec(metricas.spline.desvExt, 2)} °C. Los bordes son donde menos datos respaldan la curva.`
  });

  // Costo
  items.push({
    clase: "",
    html: `<strong>Costo:</strong> con ${d.tC.length} nodos, Lagrange cuesta ${u.lagrange.costo.evaluacion} operaciones por evaluación, Newton ${u.newton.costo.evaluacion} ` +
      `(tras ${u.newton.costo.construccion} para construir la tabla) y el spline ${u.spline.costo.evaluacion} (tras ${u.spline.costo.construccion}). ` +
      `La diferencia crece con el número de nodos: orden <em>n</em><sup>2</sup>, <em>n</em> y constante.`
  });

  // Aviso de extrapolación
  const fuera = d.tC[d.tC.length - 1] + 2;
  const pf = newton.evaluar(fuera);
  const sf = spline.evaluar(fuera);

  items.push({
    clase: "is-warn",
    html: `<strong>Aviso de extrapolación:</strong> a las ${dec(fuera, 0)} h, fuera de las medidas, el polinomio daría ${dec(pf, 1)} °C y el spline ${dec(sf, 1)} °C. ` +
      `Una diferencia de ${dec(Math.abs(pf - sf), 1)} °C entre dos métodos que coinciden dentro del rango indica que fuera de él ninguno es fiable.`
  });

  lista("diagnostico", items);
}

function pintarRecomendacion(u) {
  const { d, metricas, esperados, rmse } = u;

  const espurios = m => Math.max(0, m.extremos.length - esperados);
  const eP = metricas.newton;
  const eS = metricas.spline;

  const candidatos = [
    { id: "polinomio", nombre: "el polinomio (Newton)", m: eP },
    { id: "spline", nombre: "el spline natural", m: eS }
  ];

  const sinOscilar = candidatos.filter(c => espurios(c.m) === 0);

  let elegido;
  let motivo;

  if (sinOscilar.length === 2) {
    elegido = candidatos.reduce((a, b) => (b.m.error < a.m.error ? b : a));
    motivo = "Ninguno oscila de forma espuria, así que se elige el de menor error en el punto retenido.";
  } else if (sinOscilar.length === 1) {
    elegido = sinOscilar[0];
    motivo = "Es el único que no crea extremos que las medidas no sugieren.";
  } else {
    elegido = candidatos.reduce((a, b) => (b.m.desborde < a.m.desborde ? b : a));
    motivo = "Los dos oscilan; se elige el que menos se sale del rango de las medidas.";
  }

  const partes = [];

  partes.push(
    `<h3>Recomendación</h3>` +
    `<p>Para reconstruir la serie hora a hora usa <strong>${elegido.nombre}</strong>. ${motivo} ` +
    `Su error en ${dec(d.retenido.t, 0)} h es ${dec(elegido.m.error, 3)} °C (${dec(elegido.m.errorRel, 2)} %) y tiene ${elegido.m.extremos.length} extremo${elegido.m.extremos.length === 1 ? "" : "s"} local${elegido.m.extremos.length === 1 ? "" : "es"} ` +
    `frente a los ${esperados} que sugieren las medidas.</p>`
  );

  // Matiz de la validación cruzada
  const peorLOO = rmse.spline > rmse.poli ? "spline" : "polinomio";
  const razon = Math.max(rmse.spline, rmse.poli) / Math.max(1e-12, Math.min(rmse.spline, rmse.poli));

  if (razon > 1.5) {
    partes.push(
      `<p>Aun así, la validación cruzada matiza el resultado: el RMSE al omitir cada nodo es ${dec(rmse.poli, 2)} °C para el polinomio y ${dec(rmse.spline, 2)} °C para el spline. ` +
      `El ${peorLOO} se comporta peor cuando falta un nodo, sobre todo cerca del pico, porque con pocos nodos pierde la información de ese tramo. ` +
      `Un único punto retenido no basta para decidir; conviene repetir la prueba con varios nodos.</p>`
    );
  } else {
    partes.push(
      `<p>La validación cruzada es consistente: el RMSE al omitir cada nodo interior es ${dec(rmse.poli, 2)} °C para el polinomio y ${dec(rmse.spline, 2)} °C para el spline.</p>`
    );
  }

  // Máximo
  const dh = Math.abs(u.maxSpline.x - u.maxPoli.x);
  const dv = Math.abs(u.maxSpline.v - u.maxPoli.v);

  partes.push(
    `<p><strong>Máximo estimado:</strong> hacia las ${dec(u.maxSpline.x, 1)} h con ${dec(u.maxSpline.v, 1)} °C según el spline ` +
    `(${dec(u.maxPoli.x, 1)} h y ${dec(u.maxPoli.v, 1)} °C según el polinomio). La incertidumbre entre métodos es de unas ${dec(dh, 2)} h y ${dec(dv, 2)} °C. ` +
    `La medida más alta es ${dec(u.maxDato.v, 1)} °C a las ${dec(u.maxDato.x, 0)} h; el pico real queda ${posicionMaximo(u.maxSpline.x, d.tC)}, ` +
    `donde no hay medidas, así que conviene muestrear más cerca de ese intervalo para confirmarlo.</p>`
  );

  partes.push(
    `<p>No uses la curva fuera de [${dec(d.tC[0], 0)}, ${dec(d.tC[d.tC.length - 1], 0)}] h: ahí interpolar se convierte en extrapolar y el error crece muy rápido.</p>`
  );

  $("recomendacion").innerHTML = partes.join("");
}

// ========================================
// 8. DESCARGAS
// ========================================

function descargar(nombre, texto, tipo) {
  const blob = new Blob(["\ufeff" + texto], { type: tipo });
  const enlace = document.createElement("a");

  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  URL.revokeObjectURL(enlace.href);
}

function descargarCsv() {
  if (!ultimo) return;

  const { d, malla, horariaP, horariaS, lagrange, lineal } = ultimo;

  const filas = [["Hora (h)", "Lagrange (°C)", "Newton (°C)", "Spline natural (°C)", "Lineal (°C)", "Nota"]];

  malla.forEach((x, i) => {
    const esRet = Math.abs(x - d.retenido.t) < 1e-9;
    const esNodo = d.tA.some(t => Math.abs(t - x) < 1e-9);

    filas.push([x, lagrange.evaluar(x), horariaP[i], horariaS[i], lineal.evaluar(x), esRet ? "retenido" : esNodo ? "nodo medido" : ""]);
  });

  const csv = filas.map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");

  descargar("serie_reconstruida.csv", csv, "text/csv;charset=utf-8");
}

function descargarInforme() {
  if (!ultimo) return;

  const u = ultimo;
  const { d } = u;
  const L = [];

  L.push("INFORME: RECONSTRUCCIÓN DE LA TEMPERATURA DE UN CENTRO DE DATOS");
  L.push("Interpolación de Lagrange, Newton y spline cúbico natural");
  L.push("");
  L.push("1. DATOS");
  L.push(`Horas ordenadas: ${d.tA.join(", ")}`);
  L.push(`Temperaturas:    ${d.yA.join(", ")}`);
  L.push(`Punto retenido (validación): (${d.retenido.t} h, ${d.retenido.y} °C)`);
  L.push(`Nodos de construcción: ${d.tC.length}`);
  L.push("");
  L.push("2. NEWTON: DIFERENCIAS DIVIDIDAS (coeficientes)");
  L.push("  " + u.newton.coef.map((c, k) => `f[x0..x${k}] = ${c.toPrecision(7)}`).join("\n  "));
  L.push(`Diferencia máxima Lagrange - Newton: ${u.difLagNew.toExponential(3)}`);
  L.push("");
  L.push("3. SPLINE NATURAL");

  u.spline.seg.forEach((s, i) => {
    L.push(`  [${d.tC[i]}, ${d.tC[i + 1]}]: a=${s.a}, b=${s.b.toPrecision(7)}, c=${s.c.toPrecision(7)}, d=${s.d.toPrecision(7)}`);
  });

  L.push(`Mayor salto de S, S' y S'' en nodos interiores: ${u.peorSalto.toExponential(3)} (C2 ${u.c2 ? "verificada" : "NO verificada"})`);
  L.push("");
  L.push("4. COMPARACIÓN");

  [["Lagrange", u.metricas.lagrange, u.lagrange], ["Newton", u.metricas.newton, u.newton], ["Spline natural", u.metricas.spline, u.spline], ["Lineal (referencia)", u.metricas.lineal, u.lineal]].forEach(([nombre, m, interp]) => {
    L.push(
      `  ${nombre}: valor en el retenido = ${m.valorRet.toFixed(3)}; error = ${m.error.toFixed(3)} (${m.errorRel.toFixed(2)} %); ` +
      `desviación en extremos = ${m.desvExt.toFixed(2)}; desborde = ${m.desborde.toFixed(2)}; extremos locales = ${m.extremos.length}; ` +
      `operaciones construir/evaluar = ${interp.costo.construccion}/${interp.costo.evaluacion}`
    );
  });

  L.push(`  Extremos locales esperados según las medidas: ${u.esperados}`);
  L.push("");
  L.push("5. VALIDACIÓN CRUZADA (error al omitir cada nodo interior)");
  u.loo.forEach(r => L.push(`  t = ${r.t} h: polinomio ${r.poli.toFixed(3)}; spline ${r.spline.toFixed(3)}; lineal ${r.lineal.toFixed(3)}`));
  L.push(`  RMSE: polinomio ${u.rmse.poli.toFixed(3)}; spline ${u.rmse.spline.toFixed(3)}; lineal ${u.rmse.lineal.toFixed(3)}`);
  L.push("");
  L.push("6. SERIE RECONSTRUIDA");
  L.push("  hora | Lagrange | Newton | Spline");
  u.malla.forEach((x, i) => L.push(`  ${String(x).padStart(5)} | ${u.lagrange.evaluar(x).toFixed(3).padStart(8)} | ${u.horariaP[i].toFixed(3).padStart(8)} | ${u.horariaS[i].toFixed(3).padStart(8)}`));
  L.push("");
  L.push("7. MÁXIMO (sin extrapolar)");
  L.push(`  Medida más alta: ${u.maxDato.v} °C a las ${u.maxDato.x} h`);
  L.push(`  Polinomio: ${u.maxPoli.v.toFixed(3)} °C a las ${u.maxPoli.x.toFixed(3)} h`);
  L.push(`  Spline natural: ${u.maxSpline.v.toFixed(3)} °C a las ${u.maxSpline.x.toFixed(3)} h`);

  descargar("informe_interpolacion.txt", L.join("\r\n"), "text/plain;charset=utf-8");
}

// ========================================
// 9. GRÁFICO
// ========================================

let chartInstance = null;

function configurarGrafico() {
  const boton = $("btnGrafico");

  if (!boton) return;

  boton.addEventListener("click", generarGrafico);
  $("modoGrafico").addEventListener("change", generarGrafico);
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

  if (modo === "derivadas") dibujarDerivadas(contexto);
  else if (modo === "diferencia") dibujarDiferencia(contexto);
  else if (modo === "loo") dibujarLOO(contexto);
  else dibujarCurvas(contexto);

  $("chartVacio").hidden = true;
}

function opcionesBase(tituloX, tituloY) {
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
        title: { display: true, text: tituloY },
        grid: { color: "#e3e8f0" }
      }
    }
  };
}

function curvaFina(f, a, b, puntos = 300) {
  return Array.from({ length: puntos + 1 }, (_, k) => {
    const x = a + ((b - a) * k) / puntos;

    return { x, y: f(x) };
  });
}

function linea(etiqueta, datos, color, extra = {}) {
  return Object.assign({
    label: etiqueta,
    data: datos,
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    pointRadius: 0,
    tension: 0
  }, extra);
}

function dibujarCurvas(contexto) {
  const u = ultimo;
  const { d } = u;
  const a = d.tC[0];
  const b = d.tC[d.tC.length - 1];

  const datasets = [
    linea("Lineal por tramos", curvaFina(x => u.lineal.evaluar(x), a, b, 120), "#9aa6b8", { borderDash: [4, 4], borderWidth: 1.5 }),
    linea("Polinomio (Lagrange = Newton)", curvaFina(x => u.newton.evaluar(x), a, b), "#1d4fd7"),
    linea("Spline natural", curvaFina(x => u.spline.evaluar(x), a, b), "#0e7a55"),
    {
      label: "Medidas usadas para construir",
      data: d.construccion.map(p => ({ x: p.t, y: p.y })),
      showLine: false,
      borderColor: "#0b1830",
      backgroundColor: "#0b1830",
      pointRadius: 5
    },
    {
      label: "Punto retenido (validación)",
      data: [{ x: d.retenido.t, y: d.retenido.y }],
      showLine: false,
      borderColor: "#d88a00",
      backgroundColor: "#ffffff",
      pointStyle: "rectRot",
      pointRadius: 8,
      pointBorderWidth: 3
    }
  ];

  const opciones = opcionesBase("Hora (h)", "Temperatura (°C)");

  opciones.plugins.tooltip = {
    callbacks: {
      label: ctx => `${ctx.dataset.label}: ${dec(ctx.parsed.y, 2)} °C a las ${dec(ctx.parsed.x, 1)} h`
    }
  };

  chartInstance = new Chart(contexto, { type: "line", data: { datasets }, options: opciones });

  $("notaGrafico").textContent =
    "Las dos curvas pasan por los puntos negros. El rombo naranja es la medida retenida: no se usó para construir nada, así que ver qué tan cerca pasa cada curva es la validación. " +
    "Entre nodos, fíjate en dónde el polinomio y el spline se separan.";
}

function dibujarDerivadas(contexto) {
  const u = ultimo;
  const { d } = u;
  const a = d.tC[0];
  const b = d.tC[d.tC.length - 1];

  const datasets = [
    linea("S(t), temperatura (°C)", curvaFina(x => u.spline.evaluar(x, 0), a, b), "#0e7a55", { yAxisID: "y" }),
    linea("S′(t), pendiente (°C/h)", curvaFina(x => u.spline.evaluar(x, 1), a, b), "#1d4fd7", { yAxisID: "y1" }),
    linea("S″(t), curvatura (°C/h²)", curvaFina(x => u.spline.evaluar(x, 2), a, b), "#b8322c", { yAxisID: "y1", borderDash: [6, 4] })
  ];

  const opciones = opcionesBase("Hora (h)", "Temperatura (°C)");

  opciones.scales.y1 = {
    position: "right",
    title: { display: true, text: "S′ (°C/h) y S″ (°C/h²)" },
    grid: { drawOnChartArea: false }
  };

  opciones.plugins.tooltip = {
    callbacks: {
      label: ctx => `${ctx.dataset.label}: ${dec(ctx.parsed.y, 3)} a las ${dec(ctx.parsed.x, 1)} h`
    }
  };

  chartInstance = new Chart(contexto, { type: "line", data: { datasets }, options: opciones });

  $("notaGrafico").textContent =
    "S y S′ son curvas suaves y S″ es una línea quebrada pero sin saltos: eso es la continuidad C². Las rupturas de S″ solo cambian de pendiente en los nodos. " +
    "En los dos extremos S″ llega a 0, que es la condición del spline natural.";
}

function dibujarDiferencia(contexto) {
  const u = ultimo;
  const { d } = u;
  const a = d.tC[0];
  const b = d.tC[d.tC.length - 1];

  const datasets = [
    linea("Polinomio − spline (°C)", curvaFina(x => u.newton.evaluar(x) - u.spline.evaluar(x), a, b), "#7a3fd1"),
    linea("Sin diferencia", [{ x: a, y: 0 }, { x: b, y: 0 }], "#9aa6b8", { borderDash: [4, 4], borderWidth: 1.5 }),
    {
      label: "Nodos",
      data: d.tA.map(t => ({ x: t, y: 0 })),
      showLine: false,
      borderColor: "#0b1830",
      backgroundColor: "#0b1830",
      pointRadius: 4
    }
  ];

  const opciones = opcionesBase("Hora (h)", "Diferencia de temperatura (°C)");

  opciones.plugins.tooltip = {
    callbacks: {
      label: ctx => `${ctx.dataset.label}: ${dec(ctx.parsed.y, 3)} °C a las ${dec(ctx.parsed.x, 1)} h`
    }
  };

  chartInstance = new Chart(contexto, { type: "line", data: { datasets }, options: opciones });

  $("notaGrafico").textContent =
    "En los nodos la diferencia es exactamente cero, porque ambas curvas pasan por ellos. Entre nodos y, sobre todo, cerca de los extremos es donde los dos métodos discrepan y donde no hay medidas que decidan.";
}

function dibujarLOO(contexto) {
  const u = ultimo;

  const datos = {
    labels: u.loo.map(r => `${dec(r.t, 0)} h${r.esRetenido ? " (retenido)" : ""}`),
    datasets: [
      { label: "Polinomio", data: u.loo.map(r => r.poli), backgroundColor: "#1d4fd7" },
      { label: "Spline natural", data: u.loo.map(r => r.spline), backgroundColor: "#0e7a55" },
      { label: "Lineal", data: u.loo.map(r => r.lineal), backgroundColor: "#9aa6b8" }
    ]
  };

  const opciones = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${dec(ctx.parsed.y, 3)} °C` } }
    },
    scales: {
      x: { title: { display: true, text: "Nodo omitido de la construcción" }, grid: { display: false } },
      y: { beginAtZero: true, title: { display: true, text: "Error absoluto (°C)" }, grid: { color: "#e3e8f0" } }
    }
  };

  chartInstance = new Chart(contexto, { type: "bar", data: datos, options: opciones });

  $("notaGrafico").textContent =
    "Cada grupo de barras muestra el error de reconstruir una medida cuando se omite. Un método fiable debe tener barras bajas en todos los nodos, no solo en el retenido. " +
    "Los nodos del pico suelen ser los más difíciles.";
}

// ========================================
// 10. EJERCICIO: CALIBRACIÓN CON CUATRO MEDIDAS
// ========================================

const MAX_INTENTOS = 3;
const TOLERANCIA_RELATIVA = 0.005;

let caso = null;

function aleatorio(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function elegir(listaValores) {
  return listaValores[Math.floor(Math.random() * listaValores.length)];
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

// Cuatro nodos no equiespaciados y un punto de consulta entre x1 y x2
function generarDatos() {
  for (let intento = 0; intento < 20000; intento++) {
    const h = [elegir([1, 2, 3]), elegir([1, 2, 3]), elegir([1, 2, 3])];

    if (h[0] === h[1] && h[1] === h[2]) continue;

    const x = [0, h[0], h[0] + h[1], h[0] + h[1] + h[2]];
    const y = [aleatorio(30, 50)];

    for (let i = 0; i < 3; i++) y.push(y[i] + aleatorio(-8, 12));

    const xs = x[1] + elegir([0.25, 0.5, 0.75]) * h[1];
    const M = elegir([6, 12, 24, 60]);

    const f01 = (y[1] - y[0]) / h[0];
    const f12 = (y[2] - y[1]) / h[1];
    const f23 = (y[3] - y[2]) / h[2];
    const f012 = (f12 - f01) / (x[2] - x[0]);
    const f123 = (f23 - f12) / (x[3] - x[1]);
    const f0123 = (f123 - f012) / (x[3] - x[0]);

    const L1 = ((xs - x[0]) * (xs - x[2]) * (xs - x[3])) / ((x[1] - x[0]) * (x[1] - x[2]) * (x[1] - x[3]));

    const producto = (xs - x[0]) * (xs - x[1]) * (xs - x[2]) * (xs - x[3]);
    const cota = (M / 24) * Math.abs(producto);

    const P = y[0] + f01 * (xs - x[0]) + f012 * (xs - x[0]) * (xs - x[1]) + f0123 * (xs - x[0]) * (xs - x[1]) * (xs - x[2]);

    // Spline natural con 4 nodos: sistema 2×2 para M1 y M2
    const a11 = 2 * (h[0] + h[1]);
    const a12 = h[1];
    const a22 = 2 * (h[1] + h[2]);
    const r1 = 6 * (f12 - f01);
    const r2 = 6 * (f23 - f12);
    const det = a11 * a22 - a12 * a12;
    const M1 = (r1 * a22 - a12 * r2) / det;
    const M2 = (a11 * r2 - a12 * r1) / det;

    if (Math.abs(L1) < 0.1 || Math.abs(f012) < 0.2 || Math.abs(M1) < 0.2 || cota < 0.02 || Math.abs(P) < 5) continue;

    return { x, y, h, xs, M, f01, f12, f23, f012, f123, f0123, L1, producto, cota, P, a11, a12, a22, r1, r2, det, M1, M2 };
  }

  throw new Error("No se pudo generar el caso");
}

function crearCaso() {
  const g = generarDatos();
  const { x, y, h, xs, M, f01, f12, f23, f012, f123, f0123, L1, cota, P, a11, a12, a22, r1, r2, det, M1, M2 } = g;

  const f = (v, d = 3) => texNum(v, d);
  const q = (v, d = 3) => texPar(v, d);

  const partes = [
    {
      titulo: "Polinomio base de Lagrange",
      enunciado:
        `<p>Con los cuatro nodos dados, calcula el polinomio base <em>L</em><sub>1</sub>(<em>x</em>) de Lagrange evaluado en <em>x*</em> = ${xs}. ` +
        `¿Cuánto vale <em>L</em><sub>1</sub>(<em>x*</em>)?</p>`,
      unidad: "adim.",
      esperado: L1,
      decimales: 3,
      tipo: "real",
      pista: "L₁ vale 1 en x₁ y 0 en los demás nodos. Es el producto de (x* − x_j)/(x₁ − x_j) para todos los j distintos de 1.",
      solucion: [
        { tex: `L_1(x^*)=\\frac{(x^*-x_0)(x^*-x_2)(x^*-x_3)}{(x_1-x_0)(x_1-x_2)(x_1-x_3)}=\\frac{${q(xs - x[0])}\\cdot ${q(xs - x[2])}\\cdot ${q(xs - x[3])}}{${q(x[1] - x[0])}\\cdot ${q(x[1] - x[2])}\\cdot ${q(x[1] - x[3])}}=${f(L1)}` }
      ]
    },
    {
      titulo: "Diferencia dividida de segundo orden",
      enunciado:
        `<p>Para la forma de Newton, calcula la diferencia dividida <em>f</em>[<em>x</em><sub>0</sub>, <em>x</em><sub>1</sub>, <em>x</em><sub>2</sub>]. ` +
        `¿Cuánto vale?</p>`,
      unidad: "°C/min²",
      esperado: f012,
      decimales: 3,
      tipo: "real",
      pista: "Primero las de primer orden f[x₀,x₁] y f[x₁,x₂] (pendientes entre nodos consecutivos). Después f[x₀,x₁,x₂] = (f[x₁,x₂] − f[x₀,x₁])/(x₂ − x₀).",
      solucion: [
        { tex: `f[x_0,x_1]=\\frac{${y[1]}-${y[0]}}{${h[0]}}=${f(f01)},\\qquad f[x_1,x_2]=\\frac{${y[2]}-${y[1]}}{${h[1]}}=${f(f12)}` },
        { tex: `f[x_0,x_1,x_2]=\\frac{f[x_1,x_2]-f[x_0,x_1]}{x_2-x_0}=\\frac{${q(f12)}-${q(f01)}}{${x[2] - x[0]}}=${f(f012)}` }
      ]
    },
    {
      titulo: "Evaluar el polinomio de Newton",
      enunciado:
        `<p>Con las cuatro diferencias divididas del polinomio, evalúalo en <em>x*</em> = ${xs} min. ` +
        `¿Qué temperatura estima <em>P</em><sub>3</sub>(<em>x*</em>)?</p>`,
      unidad: "°C",
      esperado: P,
      decimales: 3,
      tipo: "real",
      pista: "P₃(x) = f[x₀] + f[x₀,x₁](x−x₀) + f[x₀,x₁,x₂](x−x₀)(x−x₁) + f[x₀,…,x₃](x−x₀)(x−x₁)(x−x₂). Necesitas calcular también la de tercer orden.",
      solucion: [
        { tex: `f[x_1,x_2,x_3]=\\frac{${f(f23)}-${q(f12)}}{${x[3] - x[1]}}=${f(f123)},\\qquad f[x_0,\\dots,x_3]=\\frac{${q(f123)}-${q(f012)}}{${x[3] - x[0]}}=${f(f0123, 4)}` },
        { tex: `P_3(x^*)=${y[0]}+${q(f01)}(${f(xs - x[0])})+${q(f012)}(${f(xs - x[0])})(${f(xs - x[1])})+${q(f0123, 4)}(${f(xs - x[0])})(${f(xs - x[1])})(${f(xs - x[2])})=${f(P)}` }
      ]
    },
    {
      titulo: "Cota del error de interpolación",
      enunciado:
        `<p>Se sabe que la señal real cumple |<em>f</em><sup>(4)</sup>(<em>x</em>)| ≤ ${M} en todo el intervalo. ` +
        `Usa la fórmula del error para acotar |<em>f</em>(<em>x*</em>) − <em>P</em><sub>3</sub>(<em>x*</em>)| en <em>x*</em> = ${xs}. ¿Cuánto vale la cota?</p>`,
      unidad: "°C",
      esperado: cota,
      decimales: 3,
      tipo: "real",
      pista: "Con 4 nodos el grado es 3, así que interviene f⁽⁴⁾: el error es como máximo (M/4!)·|(x*−x₀)(x*−x₁)(x*−x₂)(x*−x₃)|.",
      solucion: [
        { tex: `|f(x^*)-P_3(x^*)|\\le\\frac{M}{4!}\\left|\\prod_{i=0}^{3}(x^*-x_i)\\right|=\\frac{${M}}{24}\\cdot\\left|${q(xs - x[0])}\\cdot ${q(xs - x[1])}\\cdot ${q(xs - x[2])}\\cdot ${q(xs - x[3])}\\right|=${f(cota)}` },
        { txt: "Es una cota de peor caso: el error real suele ser menor, pero esta no se puede superar si M es correcto." }
      ]
    },
    {
      titulo: "Spline natural: segunda derivada en un nodo",
      enunciado:
        `<p>Construye ahora el <strong>spline cúbico natural</strong> con los cuatro nodos (<em>M</em><sub>0</sub> = <em>M</em><sub>3</sub> = 0). ` +
        `Plantea el sistema para <em>M</em><sub>1</sub> y <em>M</em><sub>2</sub>. ¿Cuánto vale <em>S″</em>(<em>x</em><sub>1</sub>) = <em>M</em><sub>1</sub>?</p>`,
      unidad: "°C/min²",
      esperado: M1,
      decimales: 3,
      tipo: "real",
      pista: "Hay dos ecuaciones, una por cada nodo interior: 2(h₀+h₁)M₁ + h₁M₂ = 6(f[x₁,x₂] − f[x₀,x₁]) y h₁M₁ + 2(h₁+h₂)M₂ = 6(f[x₂,x₃] − f[x₁,x₂]). Resuélvelas juntas.",
      solucion: [
        { tex: `\\begin{cases}${a11}M_1+${a12}M_2=${f(r1)}\\\\ ${a12}M_1+${a22}M_2=${f(r2)}\\end{cases}` },
        { tex: `M_1=\\frac{${f(r1)}\\cdot ${a22}-${a12}\\cdot ${q(r2)}}{${a11}\\cdot ${a22}-${a12}^2}=${f(M1)},\\qquad M_2=${f(M2)}` },
        { txt: "Con solo tres nodos M₁ valdría 3·f[x₀,x₁,x₂]; con cuatro, cada nodo interior influye en el otro y el resultado cambia." }
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

  return { p: { x, y, xs, M }, partes };
}

function iniciarEjercicio() {
  caso = crearCaso();

  renderEscenario();

  const ol = $("partesEjercicio");

  ol.innerHTML = "";

  caso.partes.forEach((_, i) => {
    const li = document.createElement("li");

    li.id = "paso-" + i;
    ol.appendChild(li);
    renderParte(i);
  });

  $("resumenEjercicio").hidden = true;
  renderProgreso();
}

function renderEscenario() {
  const { x, y, xs } = caso.p;

  const filas = x.map((xi, i) => `<tr><td class="num">${xi}</td><td class="num">${y[i]}</td></tr>`).join("");

  $("escenarioEjercicio").innerHTML = `
    <h3>Temperatura de un procesador con cuatro medidas</h3>
    <p>
      Un sensor registra la temperatura de un procesador en cuatro instantes no equiespaciados. Se quiere estimar
      la temperatura en un instante intermedio, <em>x*</em> = <strong>${xs} min</strong>, sin medirla, usando interpolación polinomial
      (Lagrange y Newton) y un spline cúbico natural.
    </p>
    <div class="table-responsive" style="max-width: 320px;">
      <table class="table data-table align-middle mb-0">
        <caption class="visually-hidden">Medidas del sensor</caption>
        <thead>
          <tr><th scope="col" class="num">Tiempo (min)</th><th scope="col" class="num">Temperatura (°C)</th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
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
    comentario = "Dominas el hilo completo: base de Lagrange, diferencias divididas, evaluación, cota de error y spline natural.";
  } else if (correctas >= 3) {
    comentario = "Buen resultado. Repasa los apartados marcados en rojo y pulsa «Nuevo caso» para practicar con otros datos.";
  } else {
    comentario = "Revisa el desarrollo de cada apartado y la teoría de Lagrange, Newton y splines; después prueba con un caso nuevo.";
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
    parte.feedback = { clase: "fb-warn", texto: "Escribe un número válido, por ejemplo 12.5 o -0.375." };
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

  if (Math.abs(valor + parte.esperado) / Math.abs(parte.esperado) <= TOLERANCIA_RELATIVA) {
    ayuda = "Tu cifra es correcta en magnitud, pero con el signo cambiado. Revisa el signo de las restas.";
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