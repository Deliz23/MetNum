/**
 * MetNum - Módulo 02: Ecuaciones No Lineales (Métodos Cerrados)
 * Bisección y Falsa Posición, Análisis de Estancamiento,
 * Determinación del Umbral de Capacidad bajo SLA y Redondeo Seguro.
 */

"use strict";

// ========================================
// 1. UTILIDADES Y FORMATEO
// ========================================

const $ = id => document.getElementById(id);

// Constantes físicas del problema
const DEFAULT_SLA = 140;
const Q_MIN = 100;
const Q_MAX = 1100;
const ASYMPTOTE = 1200;

function fmtLargo(n, cifras = 12) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-PE", { maximumSignificantDigits: cifras });
}

function fmtAuto(n) {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs < 1e-4 || abs >= 1e7) {
    return n.toExponential(4).replace("e+", "e");
  }
  return n.toLocaleString("es-PE", { maximumSignificantDigits: 7 });
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

function latencia(q) {
  if (q >= ASYMPTOTE) return Infinity;
  return 18 + (0.0025 * q * q) / (1 - q / ASYMPTOTE);
}

function dLatencia(q) {
  const u = 1 - q / ASYMPTOTE;
  if (u <= 0) return Infinity;
  return (0.0025 * q * (2 - q / ASYMPTOTE)) / (u * u);
}

function evaluarF(q, sla = DEFAULT_SLA) {
  return latencia(q) - sla;
}

// ========================================
// 2. FÓRMULAS MATEMÁTICAS (KATEX)
// ========================================

function renderizarFormulas() {
  if (typeof katex === "undefined") {
    console.warn("No se pudo cargar KaTeX.");
    return;
  }

  const formulas = [
    {
      id: "math-bolzano",
      formula: "\\begin{aligned} f(a)\\cdot f(b) < 0 &\\implies \\exists\\, c \\in (a, b) : f(c) = 0 \\\\[3pt] f'(x) > 0 \\; \\forall x &\\implies c \\text{ es único} \\end{aligned}"
    },
    {
      id: "math-biseccion",
      formula: "\\begin{aligned} c_k &= \\frac{a_k + b_k}{2} \\\\[3pt] E_k &= \\frac{b_k - a_k}{2} = \\frac{b_0 - a_0}{2^k} \\end{aligned}"
    },
    {
      id: "math-falsa",
      formula: "\\begin{aligned} c_k &= \\frac{a_k f(b_k) - b_k f(a_k)}{f(b_k) - f(a_k)} \\\\[3pt] &= b_k - \\frac{f(b_k)(b_k - a_k)}{f(b_k) - f(a_k)} \\end{aligned}"
    },
    {
      id: "math-cota",
      formula: "E_n = \\frac{b_0 - a_0}{2^n} \\le \\text{tol}_x \\implies n \\ge \\left\\lceil \\log_2\\left(\\frac{b_0 - a_0}{\\text{tol}_x}\\right) \\right\\rceil"
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
  const inputQ = $("heroQ");
  const inputSLA = $("heroSLA");
  if (!inputQ || !inputSLA) return;

  function actualizar() {
    const q = Number(inputQ.value);
    const sla = Number(inputSLA.value);

    const outL = $("heroL");
    const outRes = $("heroRes");
    const outDeriv = $("heroDeriv");
    const outStatus = $("heroStatus");
    const outMsg = $("heroMsg");

    if (!Number.isFinite(q) || q < 100 || q >= ASYMPTOTE || !Number.isFinite(sla) || sla <= 0) {
      outL.textContent = "—";
      outRes.textContent = "—";
      outDeriv.textContent = "—";
      outStatus.className = "status status-warn";
      outStatus.textContent = "Entrada inválida";
      outMsg.textContent = "Introduce una carga q entre 100 y 1199 sol/s y un SLA mayor a 0 ms.";
      return;
    }

    const L = latencia(q);
    const res = L - sla;
    const der = dLatencia(q);

    outL.textContent = `${L.toFixed(2)} ms`;
    outRes.textContent = `${res >= 0 ? "+" : ""}${res.toFixed(2)} ms`;
    outDeriv.textContent = `+${der.toFixed(2)} ms/(sol/s)`;

    if (L <= sla) {
      outStatus.className = "status status-ok";
      outStatus.textContent = `Cumple SLA (≤ ${sla} ms)`;
      outMsg.textContent = `Para q = ${q} sol/s la latencia es ${L.toFixed(2)} ms, operando ${Math.abs(res).toFixed(2)} ms por debajo del límite de SLA.`;
    } else {
      outStatus.className = "status status-bad";
      outStatus.textContent = `Viola SLA (> ${sla} ms)`;
      outMsg.textContent = `Para q = ${q} sol/s la latencia se dispara a ${L.toFixed(2)} ms, excediendo el límite contractual por ${res.toFixed(2)} ms.`;
    }
  }

  inputQ.addEventListener("input", actualizar);
  inputSLA.addEventListener("input", actualizar);

  document.querySelectorAll(".readout-presets .preset").forEach(btn => {
    btn.addEventListener("click", () => {
      inputQ.value = btn.dataset.q;
      inputSLA.value = btn.dataset.sla;
      actualizar();
    });
  });

  actualizar();
}

// ========================================
// 4. NAVEGACIÓN Y BOTÓN INICIO
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
  const secciones = document.querySelectorAll("main section[id]");
  const enlaces = document.querySelectorAll(".navbar-nav .nav-link");
  const navmenu = $("navmenu");

  function marcarActivo(id) {
    enlaces.forEach(a => {
      const destino = a.getAttribute("href");
      a.classList.toggle("active", destino === `#${id}`);
    });
  }

  function alDesplazar() {
    const y = window.scrollY + 120;
    let actual = "";

    secciones.forEach(sec => {
      const top = sec.offsetTop;
      const alto = sec.offsetHeight;
      if (y >= top && y < top + alto) actual = sec.id;
    });

    if (actual) marcarActivo(actual);
  }

  window.addEventListener("scroll", alDesplazar, { passive: true });

  enlaces.forEach(enlace => {
    enlace.addEventListener("click", () => {
      if (window.innerWidth < 1200 && navmenu && navmenu.classList.contains("show")) {
        const bsCollapse = bootstrap.Collapse.getInstance(navmenu);
        if (bsCollapse) bsCollapse.hide();
      }
    });
  });
}

// ========================================
// 5. NÚCLEO NUMÉRICO: ALGORITMOS CERRADOS
// ========================================

function biseccion(a, b, tolX, tolF, maxIter, sla) {
  const t0 = performance.now();
  let ca = a;
  let cb = b;
  let fa = evaluarF(ca, sla);
  let fb = evaluarF(cb, sla);
  const rows = [];

  for (let k = 1; k <= maxIter; k++) {
    const errorX = (cb - ca) / 2;
    const c = ca + errorX;
    const fc = evaluarF(c, sla);

    const decision = fa * fc < 0 ? "conservar [a, c]" : "conservar [c, b]";
    rows.push({ k, a: ca, b: cb, c, fc, errorX, decision });

    if (Math.abs(fc) <= tolF && errorX <= tolX) {
      return {
        metodo: "Bisección",
        key: "biseccion",
        raiz: c,
        filas: rows,
        iteraciones: k,
        residuoFinal: Math.abs(fc),
        errorFinalX: errorX,
        convergido: true,
        tiempoMs: performance.now() - t0,
        estancado: false
      };
    }

    if (fa * fc < 0) {
      cb = c;
      fb = fc;
    } else {
      ca = c;
      fa = fc;
    }
  }

  const last = rows[rows.length - 1];
  return {
    metodo: "Bisección",
    key: "biseccion",
    raiz: last.c,
    filas: rows,
    iteraciones: maxIter,
    residuoFinal: Math.abs(last.fc),
    errorFinalX: last.errorX,
    convergido: false,
    tiempoMs: performance.now() - t0,
    estancado: false
  };
}

function falsaPosicion(a, b, tolX, tolF, maxIter, sla) {
  const t0 = performance.now();
  let ca = a;
  let cb = b;
  let fa = evaluarF(ca, sla);
  let fb = evaluarF(cb, sla);
  let prevC = null;
  const rows = [];

  let unchangedRight = 0;
  let unchangedLeft = 0;

  for (let k = 1; k <= maxIter; k++) {
    const denom = fb - fa;
    if (Math.abs(denom) < 1e-15) break;

    const c = (ca * fb - cb * fa) / denom;
    const fc = evaluarF(c, sla);
    const errorX = prevC === null ? Math.abs(cb - ca) : Math.abs(c - prevC);
    prevC = c;

    const decision = fa * fc < 0 ? "conservar [a, c]" : "conservar [c, b]";
    rows.push({ k, a: ca, b: cb, c, fc, errorX, decision });

    if (k > 1) {
      if (Math.abs(ca - rows[k - 2].a) < 1e-12) unchangedLeft++;
      if (Math.abs(cb - rows[k - 2].b) < 1e-12) unchangedRight++;
    }

    if (Math.abs(fc) <= tolF && errorX <= tolX) {
      const ladoEstancado = unchangedRight > 0.8 * k ? "b" : (unchangedLeft > 0.8 * k ? "a" : null);
      return {
        metodo: "Falsa Posición (Regula Falsi)",
        key: "falsa",
        raiz: c,
        filas: rows,
        iteraciones: k,
        residuoFinal: Math.abs(fc),
        errorFinalX: errorX,
        convergido: true,
        tiempoMs: performance.now() - t0,
        estancado: !!ladoEstancado,
        ladoEstancado
      };
    }

    if (fa * fc < 0) {
      cb = c;
      fb = fc;
    } else {
      ca = c;
      fa = fc;
    }
  }

  const last = rows[rows.length - 1];
  const ladoEstancado = unchangedRight > 0.8 * rows.length ? "b" : (unchangedLeft > 0.8 * rows.length ? "a" : null);
  return {
    metodo: "Falsa Posición (Regula Falsi)",
    key: "falsa",
    raiz: last.c,
    filas: rows,
    iteraciones: rows.length,
    residuoFinal: Math.abs(last.fc),
    errorFinalX: last.errorX,
    convergido: false,
    tiempoMs: performance.now() - t0,
    estancado: !!ladoEstancado,
    ladoEstancado
  };
}

// ========================================
// 6. SIMULADOR Y CALCULADORA
// ========================================

let ultimoExperimento = null;
let chartErrorInstancia = null;

function configurarSimulador() {
  const form = $("formSim");
  if (!form) return;

  form.addEventListener("submit", evento => {
    evento.preventDefault();
    ejecutarCalculadora();
  });

  $("btnReset").addEventListener("click", () => {
    $("calcA").value = 100;
    $("calcB").value = 1100;
    $("calcTolX").value = 0.01;
    $("calcTolF").value = 0.01;
    $("calcMax").value = 1000;
    $("calcSLA").value = 140;
    ejecutarCalculadora();
  });

  $("historyMethod").addEventListener("change", pintarHistorial);

  $("btnCsvBis").addEventListener("click", () => descargarCsv("biseccion"));
  $("btnCsvFP").addEventListener("click", () => descargarCsv("falsa"));
  $("btnInforme").addEventListener("click", descargarInforme);
}

function leerParametros() {
  const a = Number($("calcA").value);
  const b = Number($("calcB").value);
  const tolX = Number($("calcTolX").value);
  const tolF = Number($("calcTolF").value);
  const maxIter = parseInt($("calcMax").value, 10);
  const sla = Number($("calcSLA").value);

  if (!Number.isFinite(a) || a < Q_MIN || a >= ASYMPTOTE) {
    throw new Error(`El extremo inferior "a" debe ser mayor o igual a ${Q_MIN} y menor a la asíntota de ${ASYMPTOTE} sol/s.`);
  }
  if (!Number.isFinite(b) || b <= a || b > Q_MAX) {
    throw new Error(`El extremo superior "b" (${b}) debe ser mayor que "a" (${a}) y menor o igual a ${Q_MAX} sol/s.`);
  }
  if (!Number.isFinite(tolX) || tolX <= 0 || !Number.isFinite(tolF) || tolF <= 0) {
    throw new Error("Las tolerancias en x y f(x) deben ser números estrictamente positivos.");
  }
  if (!Number.isFinite(maxIter) || maxIter < 1 || maxIter > 5000) {
    throw new Error("El número máximo de iteraciones debe ser un entero entre 1 y 5000.");
  }
  if (!Number.isFinite(sla) || sla <= 0) {
    throw new Error("El SLA límite debe ser un valor positivo en milisegundos.");
  }

  const fa = evaluarF(a, sla);
  const fb = evaluarF(b, sla);
  if (fa * fb > 0) {
    throw new Error(
      `Violación de Bolzano: f(a) = ${fa.toFixed(2)} y f(b) = ${fb.toFixed(2)} tienen el mismo signo. ` +
      `Los métodos cerrados requieren cambio de signo f(a)·f(b) < 0 en los extremos.`
    );
  }

  return { a, b, tolX, tolF, maxIter, sla };
}

function ejecutarCalculadora() {
  const errorBox = $("calcError");
  errorBox.hidden = true;
  errorBox.textContent = "";

  try {
    const p = leerParametros();

    const resBis = biseccion(p.a, p.b, p.tolX, p.tolF, p.maxIter, p.sla);
    const resFP = falsaPosicion(p.a, p.b, p.tolX, p.tolF, p.maxIter, p.sla);

    ultimoExperimento = {
      ...p,
      metodos: [resBis, resFP],
      biseccion: resBis,
      falsa: resFP
    };

    pintarMetricas(ultimoExperimento);
    pintarTabla(ultimoExperimento.metodos);
    pintarDiagnostico(ultimoExperimento);
    pintarRecomendacion(ultimoExperimento);
    pintarHistorial();

    $("simResultados").hidden = false;
    $("btnCsvBis").disabled = false;
    $("btnCsvFP").disabled = false;
    $("btnInforme").disabled = false;

    generarGrafico();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.hidden = false;
    $("simResultados").hidden = true;
    $("btnCsvBis").disabled = true;
    $("btnCsvFP").disabled = true;
    $("btnInforme").disabled = true;
  }
}

function pintarMetricas(exp) {
  const qBis = exp.biseccion.raiz;
  const qFP = exp.falsa.raiz;
  const capSegura = Math.floor(qBis);

  $("mRaizBis").textContent = `${qBis.toFixed(4)}`;
  $("mRaizFP").textContent = `${qFP.toFixed(4)}`;
  $("mCapSegura").textContent = `${capSegura}`;
}

function pintarTabla(metodos) {
  const tbody = $("tablaBenchmark");
  tbody.innerHTML = "";

  metodos.forEach(m => {
    const fila = document.createElement("tr");
    const estadoHTML = m.convergido
      ? '<span class="status status-ok"><i class="bi bi-check-lg" aria-hidden="true"></i>Convergido</span>'
      : '<span class="status status-warn"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i>Límite</span>';

    fila.innerHTML = `
      <th scope="row">${m.metodo}</th>
      <td class="num">${m.raiz.toFixed(5)}</td>
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
  const bis = exp.biseccion;
  const fp = exp.falsa;

  // 1. Cota analítica de Bisección
  const nTeorico = Math.ceil(Math.log2((exp.b - exp.a) / exp.tolX));
  items.push({
    clase: "is-ok",
    html: `<strong>Cota analítica de Bisección:</strong> Para un intervalo de ancho ${exp.b - exp.a} y tol_x = ${exp.tolX}, ` +
      `la fórmula a priori predice exactamente ⌈log₂(${exp.b - exp.a}/${exp.tolX})⌉ = ${nTeorico} iteraciones (el algoritmo finalizó en ${bis.iteraciones} pasos).`
  });

  // 2. Estancamiento en Falsa Posición
  if (fp.estancado) {
    items.push({
      clase: "is-bad",
      html: `<strong>Estancamiento severo de Falsa Posición:</strong> Debido a que la función L(q) es fuertemente convexa (L″ &gt; 0), ` +
        `el extremo <em>${fp.ladoEstancado}</em> permaneció inmóvil durante más del 80% del cálculo. Esto causó que requiriera ${fp.iteraciones} iteraciones, ` +
        `siendo ${(fp.iteraciones / bis.iteraciones).toFixed(1)} veces más lento que la bisección.`
    });
  } else {
    items.push({
      clase: "is-ok",
      html: `<strong>Convergencia de Falsa Posición:</strong> El método resolvió la ecuación en ${fp.iteraciones} iteraciones sin estancamiento apreciable.`
    });
  }

  // 3. Verificación de Residuo vs Desplazamiento
  items.push({
    clase: "is-info",
    html: `<strong>Criterio de Parada Dual:</strong> Ambos métodos certificaron residuo |f(c)| ≤ ${exp.tolF} ms y desplazamiento ≤ ${exp.tolX} sol/s. ` +
      `Esto asegura que la raíz obtenida satisface rigurosamente la ecuación de latencia contractual.`
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
  const qOpt = exp.biseccion.raiz;
  const floorQ = Math.floor(qOpt);
  const ceilQ = Math.ceil(qOpt);
  const latFloor = latencia(floorQ);
  const latCeil = latencia(ceilQ);

  caja.innerHTML = `
    <p class="text-secondary small mb-3">
      La raíz continua de equilibrio es <strong>q* ≈ ${qOpt.toFixed(4)} sol/s</strong>. En producción, un balanceador de carga debe operar con cantidades enteras:
    </p>
    <div class="d-flex flex-column gap-2 mb-3">
      <div class="decision-card is-safe">
        <span class="small fw-bold text-success text-uppercase">Redondeo Seguro ⌊q*⌋</span>
        <div class="d-flex justify-content-between align-items-baseline">
          <strong class="font-mono fs-5">${floorQ} sol/s</strong>
          <span class="badge bg-success">Cumple SLA (${latFloor.toFixed(2)} ms)</span>
        </div>
        <small class="text-secondary mt-1">Garantiza operación contractual con ${(exp.sla - latFloor).toFixed(2)} ms de margen.</small>
      </div>

      <div class="decision-card is-danger">
        <span class="small fw-bold text-danger text-uppercase">Redondeo Aritmético ⌈q*⌉</span>
        <div class="d-flex justify-content-between align-items-baseline">
          <strong class="font-mono fs-5">${ceilQ} sol/s</strong>
          <span class="badge bg-danger">Viola SLA (${latCeil.toFixed(2)} ms)</span>
        </div>
        <small class="text-secondary mt-1">Supera el SLA en +${(latCeil - exp.sla).toFixed(2)} ms provocando penalizaciones.</small>
      </div>
    </div>
    <p class="small text-muted mb-0">
      <strong>Dictamen:</strong> Adopta siempre el truncamiento por defecto <code>⌊q*⌋ = ${floorQ} sol/s</code> en variables monótonas crecientes.
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
    const isStagnant = res.estancado && (
      (res.ladoEstancado === "b" && Math.abs(row.b - ultimoExperimento.b) < 1e-12) ||
      (res.ladoEstancado === "a" && Math.abs(row.a - ultimoExperimento.a) < 1e-12)
    );

    tr.innerHTML = `
      <th scope="row">${row.k}</th>
      <td class="num">${row.a.toFixed(4)}</td>
      <td class="num ${isStagnant && res.ladoEstancado === 'b' ? 'is-stagnant' : ''}">${row.b.toFixed(4)}</td>
      <td class="num fw-bold text-primary">${row.c.toFixed(5)}</td>
      <td class="num">${row.fc.toFixed(4)}</td>
      <td class="num">${fmtAuto(row.errorX)}</td>
      <td><span class="badge bg-light text-dark border">${row.decision}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function descargarCsv(metodoKey) {
  if (!ultimoExperimento) return;
  const res = ultimoExperimento[metodoKey];
  let csv = "k,a,b,c,f(c),error_x,decision\r\n";
  res.filas.forEach(r => {
    csv += `${r.k},${r.a.toFixed(6)},${r.b.toFixed(6)},${r.c.toFixed(6)},${r.fc.toFixed(6)},${r.errorX.toExponential(4)},"${r.decision}"\r\n`;
  });

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `historial_${metodoKey}_metnum.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function descargarInforme() {
  if (!ultimoExperimento) return;
  const { a, b, tolX, tolF, sla, biseccion: bis, falsa: fp } = ultimoExperimento;
  const floorBis = Math.floor(bis.raiz);

  let texto = "========================================================================\r\n";
  texto += "  METNUM · REPORTE TÉCNICO DE RESOLUCIÓN DE ECUACIONES NO LINEALES\r\n";
  texto += "  Módulo 02: Métodos Cerrados (Bisección y Falsa Posición)\r\n";
  texto += "========================================================================\r\n\r\n";
  texto += `1. PARÁMETROS DEL SISTEMA:\r\n`;
  texto += `   - Función de Latencia: L(q) = 18 + 0.0025·q² / (1 - q/1200) [ms]\r\n`;
  texto += `   - Condición de SLA: L(q) <= ${sla} ms\r\n`;
  texto += `   - Intervalo Inicial: [${a}, ${b}] solicitudes/s\r\n`;
  texto += `   - Tolerancia en variable (tol_x): ${tolX}\r\n`;
  texto += `   - Tolerancia en función (tol_f): ${tolF}\r\n\r\n`;

  texto += `2. COMPARATIVA DE MÉTODOS CERRADOS:\r\n`;
  texto += `   BISECCIÓN:\r\n`;
  texto += `     * Raíz Calculada (q*): ${bis.raiz.toFixed(6)} sol/s\r\n`;
  texto += `     * Iteraciones Totales: ${bis.iteraciones}\r\n`;
  texto += `     * Residuo Final |f(c)|: ${bis.residuoFinal.toExponential(4)} ms\r\n`;
  texto += `     * Tiempo de Ejecución: ${bis.tiempoMs.toFixed(2)} ms\r\n`;
  texto += `     * Capacidad Segura ⌊q*⌋: ${floorBis} sol/s (L = ${latencia(floorBis).toFixed(2)} ms)\r\n\r\n`;

  texto += `   FALSA POSICIÓN (REGULA FALSI):\r\n`;
  texto += `     * Raíz Calculada (q*): ${fp.raiz.toFixed(6)} sol/s\r\n`;
  texto += `     * Iteraciones Totales: ${fp.iteraciones}\r\n`;
  texto += `     * Residuo Final |f(c)|: ${fp.residuoFinal.toExponential(4)} ms\r\n`;
  texto += `     * Estancamiento de Extremo: ${fp.estancado ? "SÍ (extremo fijo: " + fp.ladoEstancado + ")" : "NO"}\r\n`;
  texto += `     * Tiempo de Ejecución: ${fp.tiempoMs.toFixed(2)} ms\r\n\r\n`;

  texto += `3. CONCLUSIÓN Y DICTAMEN DE INGENIERÍA:\r\n`;
  texto += `   La función L(q) es monótona creciente (L'(q) > 0) y fuertemente convexa (L''(q) > 0).\r\n`;
  texto += `   El estancamiento en Falsa Posición confirma la necesidad de emplear Bisección\r\n`;
  texto += `   para garantizar un número exacto y predecible de pasos (O(log2(1/tol_x))).\r\n`;
  texto += `   La capacidad operativa máxima recomendada es de ${floorBis} solicitudes/segundo.\r\n`;

  const blob = new Blob(["\ufeff" + texto], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const aElem = document.createElement("a");
  aElem.href = url;
  aElem.download = "informe_lab02_metnum.txt";
  document.body.appendChild(aElem);
  aElem.click();
  document.body.removeChild(aElem);
  URL.revokeObjectURL(url);
}

// ========================================
// 7. GRÁFICAS INTERACTIVAS (CHART.JS)
// ========================================

function configurarGrafico() {
  const btn = $("btnGrafico");
  const selModo = $("modoGrafico");
  const checkLog = $("logScale");

  if (!btn || !selModo) return;

  btn.addEventListener("click", generarGrafico);
  selModo.addEventListener("change", () => {
    $("contenedorLog").hidden = (selModo.value === "latencia");
    generarGrafico();
  });
  if (checkLog) checkLog.addEventListener("change", generarGrafico);
}

function generarGrafico() {
  if (typeof Chart === "undefined" || !ultimoExperimento) return;

  const ctx = $("errorChart").getContext("2d");
  const vacio = $("chartVacio");
  if (vacio) vacio.hidden = true;

  if (chartErrorInstancia) {
    chartErrorInstancia.destroy();
    chartErrorInstancia = null;
  }

  const modo = $("modoGrafico").value;
  const esLog = $("logScale").checked;
  const { a, b, sla, biseccion: bis, falsa: fp } = ultimoExperimento;

  if (modo === "convergencia") {
    // Vista de caída de residuo por iteración
    const maxLen = Math.max(bis.filas.length, fp.filas.length);
    const etiquetas = Array.from({ length: maxLen }, (_, i) => `Paso ${i + 1}`);

    const dataBis = bis.filas.map(r => Math.max(1e-15, Math.abs(r.fc)));
    const dataFP = fp.filas.map(r => Math.max(1e-15, Math.abs(r.fc)));

    chartErrorInstancia = new Chart(ctx, {
      type: "line",
      data: {
        labels: etiquetas,
        datasets: [
          {
            label: `Bisección (${bis.iteraciones} pasos)`,
            data: dataBis,
            borderColor: "#4f46e5",
            backgroundColor: "#4f46e5",
            borderWidth: 2,
            pointRadius: 2.5,
            fill: false,
            tension: 0.1
          },
          {
            label: `Falsa Posición (${fp.iteraciones} pasos - ${fp.estancado ? "Estancado" : ""})`,
            data: dataFP,
            borderColor: "#722f37",
            backgroundColor: "#722f37",
            borderWidth: 2,
            pointRadius: 1.5,
            fill: false,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: "Número de Iteración (k)" },
            grid: { color: "rgba(0,0,0,0.05)" }
          },
          y: {
            type: esLog ? "logarithmic" : "linear",
            title: { display: true, text: esLog ? "Residuo |f(c)| (escala log)" : "Residuo |f(c)| (ms)" },
            grid: { color: "rgba(0,0,0,0.05)" }
          }
        },
        plugins: {
          legend: { position: "top" }
        }
      }
    });

    $("notaGrafico").textContent = "La vista de convergencia ilustra la caída regular de Bisección frente a la lenta meseta provocada por el extremo fijo en Falsa Posición.";
  } else {
    // Vista de Curva de Latencia L(q) vs SLA
    const numPuntos = 100;
    const qVals = [];
    const latVals = [];
    const slaVals = [];

    for (let i = 0; i <= numPuntos; i++) {
      const q = a + ((b - a) * i) / numPuntos;
      qVals.push(q);
      latVals.push(latencia(q));
      slaVals.push(sla);
    }

    chartErrorInstancia = new Chart(ctx, {
      type: "line",
      data: {
        labels: qVals.map(q => q.toFixed(1)),
        datasets: [
          {
            label: "Latencia L(q) [ms]",
            data: latVals,
            borderColor: "#4f46e5",
            backgroundColor: "rgba(79, 70, 229, 0.08)",
            borderWidth: 2.5,
            pointRadius: 0,
            fill: true,
            tension: 0.1
          },
          {
            label: `Límite Contractual SLA = ${sla} ms`,
            data: slaVals,
            borderColor: "#dc2626",
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false
          },
          {
            label: `Raíz q* ≈ ${bis.raiz.toFixed(2)} sol/s`,
            data: [{ x: bis.raiz.toFixed(1), y: latencia(bis.raiz) }],
            type: "scatter",
            backgroundColor: "#722f37",
            borderColor: "#ffffff",
            borderWidth: 2,
            pointRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: "Carga de Tráfico q (solicitudes/s)" },
            grid: { color: "rgba(0,0,0,0.05)" }
          },
          y: {
            title: { display: true, text: "Tiempo de Respuesta L(q) (ms)" },
            grid: { color: "rgba(0,0,0,0.05)" }
          }
        },
        plugins: {
          legend: { position: "top" }
        }
      }
    });

    $("notaGrafico").textContent = `La curva ilustra la saturación asintótica hacia q = ${ASYMPTOTE} sol/s y el cruce exacto con la cota de SLA en q* ≈ ${bis.raiz.toFixed(2)} sol/s.`;
  }
}

// ========================================
// 8. TEST TEÓRICO SECUENCIAL (RELACIÓN DE CONCEPTOS)
// ========================================

const bancoPreguntasTeoricas = [
  {
    id: "t1",
    titulo: "Fundamentos de Bolzano y Métodos Cerrados",
    instruccion: "Asocia cada concepto matemático con su definición o propiedad técnica exacta:",
    pares: [
      {
        id: "p1",
        termino: "Teorema de Bolzano",
        definicion: "Garantiza al menos una raíz en (a, b) si f es continua y f(a)·f(b) < 0; no prueba unicidad por sí solo.",
        explicacion: "Bolzano es un teorema de existencia pura. La unicidad exige adicionalmente monotonía estricta (f' no cambia de signo)."
      },
      {
        id: "p2",
        termino: "Método de Bisección",
        definicion: "Algoritmo dicotómico que divide el intervalo exactamente a la mitad; su error decrece como O(2⁻ⁿ) sin importar la curvatura.",
        explicacion: "Es determinista y robusto: reduce la longitud de incertidumbre un 50% en cada iteración."
      },
      {
        id: "p3",
        termino: "Método de Falsa Posición",
        definicion: "Aproxima la raíz mediante la interpolación lineal secante entre (a, f(a)) y (b, f(b)), ponderando las magnitudes de f.",
        explicacion: "Aprovecha la pendiente secante, pero en funciones con fuerte curvatura puede estancar uno de los extremos."
      },
      {
        id: "p4",
        termino: "Unicidad de la Raíz Admisible",
        definicion: "Condición demostrada por Rolle cuando f'(x) > 0 (o f'(x) < 0) en todo el intervalo, impidiendo la existencia de múltiples ceros.",
        explicacion: "Si la derivada es estrictamente positiva, la función es monótona creciente y solo puede cruzar el eje horizontal una vez."
      }
    ]
  },
  {
    id: "t2",
    titulo: "Convergencia, Estancamiento y Redondeo Seguro",
    instruccion: "Relaciona cada criterio algorítmico u operativo con su impacto numérico en ingeniería:",
    pares: [
      {
        id: "p5",
        termino: "Cota Analítica de Bisección",
        definicion: "n ≥ ⌈log₂((b₀ − a₀) / tol_x)⌉; fija a priori el número exacto de iteraciones necesarias sin evaluar f(x).",
        explicacion: "Permite predecir con exactitud el costo computacional antes de iniciar la ejecución del código."
      },
      {
        id: "p6",
        termino: "Estancamiento en Regula Falsi",
        definicion: "Ocurre cuando f″(x) conserva el signo (función fuertemente convexa), dejando un extremo fijo mientras el otro avanza muy lento.",
        explicacion: "La secante corta sistemáticamente por un mismo lado de la raíz, degradando la velocidad a sublineal."
      },
      {
        id: "p7",
        termino: "Criterio Dual de Parada",
        definicion: "Exigir simultáneamente |b_k − a_k| ≤ tol_x y |f(c_k)| ≤ tol_f para evitar falsas convergencias.",
        explicacion: "Protege el cálculo en zonas muy escarpadas (donde Δx es chico pero el residuo es grande) o en mesetas planas."
      },
      {
        id: "p8",
        termino: "Redondeo Seguro ⌊q*⌋",
        definicion: "Truncar la raíz continua por defecto al entero inferior para garantizar que L(⌊q*⌋) ≤ SLA sin violar el contrato.",
        explicacion: "En variables crecientes, redondear al entero superior excedería la latencia contractual acarreando multas."
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
      renderizarPreguntaTeorica();
    });
  }
}

// ========================================
// 9. PROBLEMAS DE AUTOEVALUACIÓN Y PRÁCTICA GUIADA
// ========================================

const TOLERANCIA_RELATIVA = 0.01;

let ejercicios = [];
let ejercicioActivo = 0; // 0: Cota Analítica y Bolzano, 1: Redondeo Seguro bajo SLA
let guiaActiva = null;

function elegir(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

// Resuelve la ecuación 3q^2 + Sq - 1200S = 0 para obtener la raíz positiva continua exacta
function calcularRaizContinua(sla) {
  const S = sla - 18;
  return (-S + Math.sqrt(S * S + 14400 * S)) / 6;
}

function generarDatosEjercicios() {
  // EJERCICIO 1: Cota analítica de Bisección y Teorema de Bolzano
  const a0 = elegir([100, 150, 200]);
  const b0 = elegir([900, 1000, 1100]);
  const tolX = elegir([0.01, 0.005, 0.002]);
  const sla1 = elegir([120, 140, 160]);

  const ancho0 = b0 - a0;
  const razon0 = ancho0 / tolX;
  const nEsperado = Math.ceil(Math.log2(razon0));

  const latA0 = latencia(a0);
  const fA0 = latA0 - sla1;
  const latB0 = latencia(b0);
  const fB0 = latB0 - sla1;

  // EJERCICIO 2: Redondeo seguro de capacidad y holgura de SLA
  const sla2 = elegir([120, 130, 140, 150, 160]);
  const qStar = calcularRaizContinua(sla2);
  const qFloor = Math.floor(qStar);
  const qCeil = Math.ceil(qStar);

  const latFloor = latencia(qFloor);
  const latCeil = latencia(qCeil);
  const holguraEsperada = sla2 - latFloor;
  const excesoCeil = latCeil - sla2;

  const lista = [
    {
      id: "ej1",
      titulo: "Ejercicio 1: Cota Analítica de Iteraciones y Teorema de Bolzano",
      icono: "bi-speedometer2",
      badge: "Problema Oficial de Dimensionamiento",
      contexto: `
        <h3>Garantía de Convergencia Determinista y Cota a Priori</h3>
        <p>Un microservicio web procesa tráfico con función de retardo no lineal <strong>L(q) = 18 + 0.0025·q² / (1 − q/1200) ms</strong>.
        Para cumplir un SLA contractual de <strong>${sla1} ms</strong>, se plantea la búsqueda del cero de <code>f(q) = L(q) − ${sla1} = 0</code>
        en el intervalo inicial <strong>[${a0}, ${b0}] sol/s</strong> con una tolerancia en abscisas <strong>tol_x = ${tolX} sol/s</strong>.</p>
        <p class="mb-0 text-secondary small">A diferencia de los métodos abiertos o de la Falsa Posición (que puede estancarse), Bisección asegura reducir el ancho del intervalo a la mitad en cada paso, permitiendo estimar el costo computacional antes de correr el código.</p>
        <dl class="givens mt-3">
          <div><dt>Extremo inicial a₀</dt><dd>${a0} sol/s</dd></div>
          <div><dt>Extremo inicial b₀</dt><dd>${b0} sol/s</dd></div>
          <div><dt>Tolerancia tol_x</dt><dd>${tolX} sol/s</dd></div>
          <div><dt>Límite Contractual SLA</dt><dd>${sla1} ms</dd></div>
        </dl>
      `,
      preguntas: [
        {
          id: "p1_1",
          numero: "Pregunta 1.1",
          titulo: "Cota analítica mínima de iteraciones de Bisección",
          enunciado: `
            <p>Con el intervalo inicial <strong>[${a0}, ${b0}]</strong> (longitud inicial <code>b₀ − a₀ = ${ancho0}</code>) y la tolerancia requerida <strong>tol_x = ${tolX}</strong>,
            ¿cuál es el <strong>número mínimo entero de iteraciones n</strong> que asegura a priori la cota determinista de bisección:
            <code>(b₀ − a₀) / 2ⁿ ≤ tol_x</code>?</p>
          `,
          unidad: "iteraciones",
          esperado: nEsperado,
          decimales: 0,
          tipo: "entero",
          metodoOpciones: [
            {
              id: "biseccion_cota",
              nombre: "A) Cota analítica cerrada de Bisección: n ≥ ⌈log₂((b₀ − a₀) / tol_x)⌉",
              esOptimo: true,
              analisis: "✅ <strong>¡Método exacto y determinista!</strong> Al dividir el intervalo estrictamente por la mitad en cada paso, el error de bisección no depende de las derivadas ni de la curvatura de f.",
              recomendacion: "Permite planificar recursos y acotar la latencia de ejecución del algoritmo a priori."
            },
            {
              id: "falsa_estimacion",
              nombre: "B) Estimación heurística de pasos mediante Falsa Posición (Regula Falsi)",
              esOptimo: false,
              analisis: "⚠️ <strong>Inestable por estancamiento:</strong> Como L(q) es fuertemente convexa (L″ > 0), Falsa Posición fija el extremo b y puede requerir cientos de iteraciones (hasta 20 veces más que bisección).",
              recomendacion: "No existe fórmula a priori para Falsa Posición que garantice un número fijo de pasos."
            }
          ],
          pista: `Aplica la fórmula: n ≥ log₂((b₀ − a₀) / tol_x). Con b₀ − a₀ = ${ancho0} y tol_x = ${tolX}, la razón es ${ancho0} / ${tolX} = ${razon0}. Luego log₂(${razon0}) = ${Math.log2(razon0).toFixed(4)}. Redondea hacia arriba con la función techo ⌈·⌉ al entero siguiente.`,
          guiaInteractiva: {
            final: `La cota analítica de Bisección garantiza que tras exactamente ${nEsperado} iteraciones el error absoluto será estrictamente menor o igual a ${tolX} sol/s, sin importar cuán no lineal sea la función.`,
            pasos: [
              {
                tipo: "numero",
                etiqueta: "Longitud inicial del intervalo",
                unidad: "sol/s",
                enunciado: "¿Cuál es la longitud del intervalo inicial L₀ = b₀ − a₀?",
                correcto: ancho0,
                pista: `Resta directamente b₀ − a₀: ${b0} − ${a0}.`,
                explicacion: `L₀ = ${b0} − ${a0} = ${ancho0} sol/s.`
              },
              {
                tipo: "numero",
                etiqueta: "Factor de reducción",
                unidad: "veces",
                enunciado: "¿Cuántas veces debe reducirse el intervalo para alcanzar la tolerancia? (Razón L₀ / tol_x)",
                correcto: razon0,
                pista: `Divide la longitud inicial entre la tolerancia: ${ancho0} / ${tolX}.`,
                explicacion: `Razón = ${ancho0} / ${tolX} = ${razon0}.`
              },
              {
                tipo: "seleccion",
                enunciado: "Para despejar n en 2ⁿ ≥ Razón, ¿qué función matemática inversa se aplica?",
                opciones: [
                  { valor: "log2", texto: "Logaritmo en base 2: n ≥ log₂(Razón)" },
                  { valor: "ln", texto: "Raíz cuadrada de la razón" },
                  { valor: "div", texto: "División simple por 2" }
                ],
                correcto: ["log2"],
                pista: "La inversa de la función exponencial de base 2 es el logaritmo binario log₂(x).",
                explicacion: `Aplicando logaritmo en base 2: n ≥ log₂(${razon0}) ≈ ${Math.log2(razon0).toFixed(4)}.`
              },
              {
                tipo: "numero",
                etiqueta: "Número de iteraciones entero",
                unidad: "iteraciones",
                enunciado: `Aplica la función techo entero ⌈${Math.log2(razon0).toFixed(4)}⌉.`,
                correcto: nEsperado,
                pista: `Como las iteraciones son discretas, cualquier fracción exige una iteración completa adicional: el entero superior inmediato a ${Math.log2(razon0).toFixed(4)}.`,
                explicacion: `n = ⌈${Math.log2(razon0).toFixed(4)}⌉ = ${nEsperado} iteraciones deterministas.`
              }
            ]
          },
          solucion: [
            { txt: "1. Planteamos la desigualdad teórica de reducción del semiancho en el método de bisección:" },
            { tex: `E_n = \\frac{b_0 - a_0}{2^n} \\le \\text{tol}_x` },
            { txt: "2. Sustituimos los valores numéricos del problema y aislamos la potencia de dos:" },
            { tex: `\\frac{${ancho0}}{2^n} \\le ${tolX} \\implies 2^n \\ge \\frac{${ancho0}}{${tolX}} = ${texInt(razon0)}` },
            { txt: "3. Aplicamos logaritmo en base 2 en ambos lados de la desigualdad:" },
            { tex: `n \\ge \\log_2(${texInt(razon0)}) = \\frac{\\ln(${texInt(razon0)})}{\\ln(2)} \\approx ${Math.log2(razon0).toFixed(4)}` },
            { txt: "4. Tomamos la función techo entero para garantizar la cota de parada:" },
            { tex: `n = \\left\\lceil ${Math.log2(razon0).toFixed(4)} \\right\\rceil = ${nEsperado}\\ \\text{iteraciones}` },
            { txt: `Resultado: Bisección alcanzará la solución garantizada en exactamente ${nEsperado} pasos.` }
          ]
        },
        {
          id: "p1_2",
          numero: "Pregunta 1.2",
          titulo: "Evaluación del Residuo de Bolzano en el extremo inferior f(a₀)",
          enunciado: `
            <p>Para comprobar la condición del Teorema de Bolzano (<code>f(a₀)·f(b₀) < 0</code>), evalúa el residuo en el extremo inferior <strong>f(a₀) = L(a₀) − ${sla1}</strong> con <strong>a₀ = ${a0} sol/s</strong>.
            ¿Cuál es el valor de <strong>f(a₀)</strong> en milisegundos (ms)? (Debe ser un valor negativo; conserva 2 decimales).</p>
          `,
          unidad: "ms",
          esperado: fA0,
          decimales: 2,
          tipo: "real",
          metodoOpciones: [
            {
              id: "residuo_sla",
              nombre: "A) Formulación del residuo respecto al SLA: f(q) = L(q) − SLA",
              esOptimo: true,
              analisis: "✅ <strong>¡Formulación estándar de ingeniería!</strong> Transforma la condición de igualdad L(q) = SLA en una búsqueda de raíz f(q) = 0 estándar.",
              recomendacion: "Permite usar cualquier algoritmo numérico de búsqueda de ceros sin modificaciones."
            },
            {
              id: "directo_lat",
              nombre: "B) Búsqueda directa del valor SLA sin restar en el modelo",
              esOptimo: false,
              analisis: "⚠️ <strong>No compatible con algoritmos cerrados:</strong> El criterio de Bolzano se basa en el cambio de signo de la función f(a)·f(b) < 0 respecto a cero, no respecto a un valor arbitrario.",
              recomendacion: "Siempre se debe definir f(x) = L(x) − SLA para que la raíz represente el cero matemático."
            }
          ],
          pista: `Evalúa primero L(${a0}) = 18 + 0.0025·(${a0})² / (1 − ${a0}/1200). Luego resta el SLA: f(${a0}) = L(${a0}) − ${sla1}. El resultado debe ser negativo (aprox. ${(fA0).toFixed(2)} ms).`,
          guiaInteractiva: {
            final: `El residuo en a₀ = ${a0} es f(a₀) = ${fA0.toFixed(2)} ms < 0, mientras que en b₀ = ${b0} es f(b₀) = +${fB0.toFixed(2)} ms > 0. Se cumple estrictamente f(a₀)·f(b₀) < 0, garantizando la existencia de al menos una raíz.`,
            pasos: [
              {
                tipo: "numero",
                etiqueta: "Denominador de saturación",
                unidad: "adimensional",
                enunciado: `Calcula el denominador de cola: 1 − ${a0} / 1200.`,
                correcto: 1 - a0 / 1200,
                pista: `Divide ${a0} entre 1200 y réstalo de 1: 1 − ${(a0 / 1200).toFixed(4)}.`,
                explicacion: `1 − ${a0} / 1200 = ${(1 - a0 / 1200).toFixed(4)}.`
              },
              {
                tipo: "numero",
                etiqueta: "Latencia total L(a₀)",
                unidad: "ms",
                enunciado: `Calcula la latencia del servidor: L(${a0}) = 18 + [0.0025 × (${a0})²] / [1 − ${a0}/1200].`,
                correcto: latA0,
                pista: `0.0025 × (${a0})² = ${0.0025 * a0 * a0}. Divide entre ${(1 - a0 / 1200).toFixed(4)} y súmale 18.`,
                explicacion: `L(${a0}) = 18 + ${(0.0025 * a0 * a0).toFixed(2)} / ${(1 - a0 / 1200).toFixed(4)} = ${latA0.toFixed(2)} ms.`
              },
              {
                tipo: "numero",
                etiqueta: "Residuo f(a₀)",
                unidad: "ms",
                enunciado: `Resta el límite de SLA: f(${a0}) = ${latA0.toFixed(2)} − ${sla1}. Conserva el signo negativo.`,
                correcto: fA0,
                pista: `f(${a0}) = ${latA0.toFixed(2)} − ${sla1} = ${fA0.toFixed(2)} ms.`,
                explicacion: `f(${a0}) = ${latA0.toFixed(2)} − ${sla1} = ${fA0.toFixed(2)} ms. Al ser negativo y f(b₀) positivo, se certifica el cambio de signo de Bolzano.`
              }
            ]
          },
          solucion: [
            { txt: `1. Evaluamos la función de latencia analítica en el extremo inferior q = ${a0} sol/s:` },
            { tex: `L(${a0}) = 18 + \\frac{0.0025 \\times (${a0})^2}{1 - \\frac{${a0}}{1200}} = 18 + \\frac{${0.0025 * a0 * a0}}{${(1 - a0 / 1200).toFixed(4)}} = ${latA0.toFixed(4)}\\ \\text{ms}` },
            { txt: `2. Formulamos la ecuación residual respecto al acuerdo de nivel de servicio (SLA = ${sla1} ms):` },
            { tex: `f(${a0}) = L(${a0}) - \\text{SLA} = ${latA0.toFixed(4)} - ${sla1} = ${fA0.toFixed(2)}\\ \\text{ms}` },
            { txt: `3. Verificación de la condición de signo del Teorema de Bolzano:` },
            { tex: `f(${a0}) = ${fA0.toFixed(2)} < 0 \\quad \\text{y} \\quad f(${b0}) = +${fB0.toFixed(2)} > 0 \\implies f(${a0})\\cdot f(${b0}) < 0` },
            { txt: `Conclusión: La continuidad de L(q) en [${a0}, ${b0}] junto al cambio de signo garantiza la existencia de al menos una raíz real admisible.` }
          ]
        }
      ]
    },
    {
      id: "ej2",
      titulo: "Ejercicio 2: Redondeo Seguro de Capacidad bajo Restricción Contractual de SLA",
      icono: "bi-shield-check",
      badge: "Problema Oficial de Operaciones en Producción",
      contexto: `
        <h3>Traducción de Raíces Numéricas a Decisiones de Ingeniería</h3>
        <p>Mediante un algoritmo cerrado se ha obtenido la raíz continua de saturación exacta <strong>q* ≈ ${qStar.toFixed(4)} sol/s</strong> para un límite de SLA de <strong>${sla2} ms</strong>.
        En sistemas de producción, los proxies y balanceadores de carga solo pueden configurarse con <strong>valores enteros discretos de capacidad</strong>.</p>
        <p class="mb-0 text-secondary small">Dado que la función de latencia es monótona creciente (<code>L′(q) &gt; 0</code>), el redondeo no puede aplicarse de manera convencional: redondear al entero más cercano puede cruzar el umbral crítico y violar el SLA.</p>
        <dl class="givens mt-3">
          <div><dt>Límite Contractual SLA</dt><dd>${sla2} ms</dd></div>
          <div><dt>Raíz Continua q*</dt><dd>${qStar.toFixed(4)} sol/s</dd></div>
          <div><dt>Monotonía</dt><dd>L′(q) > 0 (Creciente)</dd></div>
          <div><dt>Asíntota Crítica</dt><dd>1200 sol/s</dd></div>
        </dl>
      `,
      preguntas: [
        {
          id: "p2_1",
          numero: "Pregunta 2.1",
          titulo: "Determinación de la Capacidad Entera Segura",
          enunciado: `
            <p>Con la raíz continua <strong>q* = ${qStar.toFixed(4)} sol/s</strong> y sabiendo que <code>L(q)</code> es estrictamente creciente,
            ¿cuál es la <strong>capacidad máxima entera segura</strong> (en solicitudes/segundo) que garantiza no superar bajo ninguna circunstancia el límite de <strong>${sla2} ms</strong>?</p>
          `,
          unidad: "sol/s",
          esperado: qFloor,
          decimales: 0,
          tipo: "entero",
          metodoOpciones: [
            {
              id: "redondeo_floor",
              nombre: "A) Truncamiento por defecto hacia abajo: ⌊q*⌋ = Math.floor(q*)",
              esOptimo: true,
              analisis: "✅ <strong>¡Redondeo Seguro en Ingeniería!</strong> Dado que L'(q) > 0, todo q ≤ q* satisface estrictamente L(q) ≤ SLA. Al tomar ⌊q*⌋ se asegura cumplimiento del 100% en producción.",
              recomendacion: "Es la política estándar en infraestructura crítica para evitar multas por SLA."
            },
            {
              id: "redondeo_simetrico",
              nombre: "B) Redondeo aritmético al entero más cercano: round(q*)",
              esOptimo: false,
              analisis: `⚠️ <strong>Peligro de incumplimiento:</strong> Si la parte decimal es ≥ 0.5, redondearía hacia arriba a ${qCeil} sol/s. En ese punto, la latencia es L(${qCeil}) = ${latCeil.toFixed(2)} ms > ${sla2} ms, ¡violando el contrato!`,
              recomendacion: "Nunca se debe aplicar redondeo simétrico cuando se evalúan restricciones de desigualdad operativa."
            }
          ],
          pista: `Aplica la regla de redondeo seguro: para restricciones del tipo L(q) ≤ SLA en funciones crecientes, la capacidad entera máxima admisible es siempre la función piso ⌊q*⌋ = Math.floor(${qStar.toFixed(4)}). Trunca directamente la parte decimal.`,
          guiaInteractiva: {
            final: `La capacidad entera segura es ⌊q*⌋ = ${qFloor} sol/s. Al operar a esta tasa, L(${qFloor}) = ${latFloor.toFixed(2)} ms ≤ ${sla2} ms. Si se hubiera redondeado a ${qCeil}, la latencia habría subido a ${latCeil.toFixed(2)} ms, incumpliendo el SLA.`,
            pasos: [
              {
                tipo: "seleccion",
                enunciado: "Dado que L(q) es estrictamente monótona creciente (L'(q) > 0), ¿qué ocurre si elegimos una carga q > q*?",
                opciones: [
                  { valor: "viola", texto: "La latencia supera el SLA: L(q) > SLA (incumplimiento)" },
                  { valor: "cumple", texto: "La latencia disminuye y mejora el rendimiento" },
                  { valor: "igual", texto: "La latencia se mantiene exactamente igual" }
                ],
                correcto: ["viola"],
                pista: "En una función creciente, a mayor carga q corresponde mayor tiempo de respuesta L(q).",
                explicacion: "Como L'(q) > 0, si q > q* entonces L(q) > L(q*) = SLA. Cualquier valor mayor a q* viola la cota contractual."
              },
              {
                tipo: "seleccion",
                enunciado: "¿Qué función matemática garantiza estrictamente que q ≤ q* para cualquier número positivo?",
                opciones: [
                  { valor: "floor", texto: "Función piso / truncamiento hacia abajo: ⌊q*⌋" },
                  { valor: "ceil", texto: "Función techo hacia arriba: ⌈q*⌉" },
                  { valor: "round", texto: "Redondeo simétrico al más cercano: round(q*)" }
                ],
                correcto: ["floor"],
                pista: "La función piso (floor) toma el entero más grande menor o igual a q*.",
                explicacion: "La función piso ⌊q*⌋ siempre produce un entero menor o igual a q*, garantizando L(⌊q*⌋) ≤ L(q*) = SLA."
              },
              {
                tipo: "numero",
                etiqueta: "Capacidad entera segura",
                unidad: "sol/s",
                enunciado: `Calcula ⌊${qStar.toFixed(4)}⌋.`,
                correcto: qFloor,
                pista: `Descarta los decimales de ${qStar.toFixed(4)}.`,
                explicacion: `⌊${qStar.toFixed(4)}⌋ = ${qFloor} solicitudes por segundo.`
              }
            ]
          },
          solucion: [
            { txt: "1. Analizamos la propiedad de monotonicidad del modelo analítico de latencia:" },
            { tex: `L'(q) = \\frac{0.0025\\,q\\,(2 - q/1200)}{(1 - q/1200)^2} > 0 \\quad \\forall q \\in [100, 1100]` },
            { txt: "2. Como L(q) es estrictamente creciente, la desigualdad contractual equivale a:" },
            { tex: `L(q) \\le \\text{SLA} \\iff q \\le q^* \\approx ${qStar.toFixed(4)}\\ \\text{sol/s}` },
            { txt: "3. Aplicamos la función piso (floor) para obtener la cota entera admisible:" },
            { tex: `q_{\\text{seguro}} = \\lfloor q^* \\rfloor = \\lfloor ${qStar.toFixed(4)} \\rfloor = ${qFloor}\\ \\text{sol/s}` },
            { txt: `4. Verificación de la desigualdad original con ambos enteros contiguos:` },
            { tex: `L(${qFloor}) = ${latFloor.toFixed(2)}\\ \\text{ms} \\le ${sla2}\\ \\text{ms}\\;(\\text{Cumple}) \\quad \\text{vs} \\quad L(${qCeil}) = ${latCeil.toFixed(2)}\\ \\text{ms} > ${sla2}\\ \\text{ms}\\;(\\text{Viola})` },
            { txt: `Conclusión: Adoptar q = ${qFloor} sol/s protege contractualmente al proveedor de servicios.` }
          ]
        },
        {
          id: "p2_2",
          numero: "Pregunta 2.2",
          titulo: "Margen de Holgura de Latencia bajo Capacidad Segura",
          enunciado: `
            <p>Al configurar el sistema con la capacidad segura <strong>q = ${qFloor} sol/s</strong>, la latencia real de respuesta es <strong>L(${qFloor}) = ${latFloor.toFixed(2)} ms</strong>.
            ¿Cuál es el <strong>margen de holgura de latencia</strong> <code>ΔL = SLA − L(⌊q*⌋)</code> en milisegundos (ms) que queda disponible como margen de seguridad antes de infringir el contrato?</p>
          `,
          unidad: "ms",
          esperado: holguraEsperada,
          decimales: 2,
          tipo: "real",
          metodoOpciones: [
            {
              id: "holgura_exacta",
              nombre: "A) Sustitución directa en el modelo: ΔL = SLA − L(⌊q*⌋)",
              esOptimo: true,
              analisis: "✅ <strong>¡Cálculo analítico exacto!</strong> Evalúa la latencia exacta del servidor en el entero seguro y calcula la distancia real al límite de penalización.",
              recomendacion: "Determina con exactitud el colchón de tolerancia para picos esporádicos de carga."
            },
            {
              id: "holgura_lineal",
              nombre: "B) Aproximación diferencial por serie de Taylor: ΔL ≈ L'(q*)·(q* − ⌊q*⌋)",
              esOptimo: false,
              analisis: "⚠️ <strong>Aproximación truncada:</strong> En modelos no lineales con curvatura convexa pronunciada, la aproximación de primer orden introduce un error de aproximación innecesario.",
              recomendacion: "Siempre es preferible evaluar la función no lineal completa L(q) en el punto entero."
            }
          ],
          pista: `Resta directamente la latencia del entero seguro del SLA: ΔL = ${sla2} − ${latFloor.toFixed(2)}. Debe ser un número positivo pequeño (aproximadamente ${holguraEsperada.toFixed(2)} ms).`,
          guiaInteractiva: {
            final: `El margen de seguridad operativa es ΔL = ${holguraEsperada.toFixed(2)} ms. Esto significa que transitorios o pequeñas variaciones de red de hasta ${holguraEsperada.toFixed(2)} ms no causarán violaciones de contrato.`,
            pasos: [
              {
                tipo: "numero",
                etiqueta: "Latencia en capacidad segura",
                unidad: "ms",
                enunciado: `Evalúa L(${qFloor}) = 18 + 0.0025 × (${qFloor})² / [1 − ${qFloor}/1200].`,
                correcto: latFloor,
                pista: `L(${qFloor}) = 18 + ${(0.0025 * qFloor * qFloor).toFixed(2)} / ${(1 - qFloor / 1200).toFixed(4)} = ${latFloor.toFixed(2)} ms.`,
                explicacion: `L(${qFloor}) = ${latFloor.toFixed(2)} ms.`
              },
              {
                tipo: "numero",
                etiqueta: "Margen de holgura ΔL",
                unidad: "ms",
                enunciado: `Resta la latencia segura del SLA contractual: ${sla2} − ${latFloor.toFixed(2)}.`,
                correcto: holguraEsperada,
                pista: `ΔL = ${sla2} − ${latFloor.toFixed(2)} = ${holguraEsperada.toFixed(2)} ms.`,
                explicacion: `ΔL = ${sla2} − ${latFloor.toFixed(2)} = ${holguraEsperada.toFixed(2)} ms de colchón operativo.`
              }
            ]
          },
          solucion: [
            { txt: `1. Evaluamos la latencia exacta producida por la capacidad segura entera q = ${qFloor} sol/s:` },
            { tex: `L(${qFloor}) = 18 + \\frac{0.0025 \\times (${qFloor})^2}{1 - \\frac{${qFloor}}{1200}} = ${latFloor.toFixed(4)}\\ \\text{ms}` },
            { txt: `2. Calculamos el margen de seguridad respecto al límite contractual de SLA = ${sla2} ms:` },
            { tex: `\\Delta L = \\text{SLA} - L(${qFloor}) = ${sla2} - ${latFloor.toFixed(4)} = ${holguraEsperada.toFixed(2)}\\ \\text{ms}` },
            { txt: `Interpretación: El sistema dispone de una holgura de ${holguraEsperada.toFixed(2)} ms por debajo del umbral de penalización económica ante ráfagas transitorias de tráfico.` }
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

    // 2. PISTA PREVIA
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

    // 5. SOLUCIÓN PASO A PASO
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
    <div class="guided-progress mb-4" role="progressbar" aria-label="Progreso del desarrollo guiado" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${paso}"><div class="progress-bar" style="width:${(paso / total) * 100}%"></div></div>
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
      texto: "Ingresa un número válido (por ejemplo: 17 o -94.73)."
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
// 10. INICIALIZACIÓN GENERAL
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  renderizarFormulas();
  configurarDemoHero();
  configurarBotonInicio();
  configurarMenu();
  configurarSimulador();
  configurarGrafico();
  inicializarTestTeorico();
  configurarEjercicio();

  // Ejecución inicial automática de la simulación
  ejecutarCalculadora();
});
