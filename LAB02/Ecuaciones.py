import math
import time
import tracemalloc
import pandas as pd
import matplotlib.pyplot as plt

# 1. DATOS DEL PROBLEMA

SLA = 140.0
Q_MIN = 100.0
Q_MAX = 1100.0
TOL_X = 0.01
TOL_F = 0.01
MAX_ITER = 1000

# 2. FUNCIÓN DEL MODELO

def latencia(q):
    
    if q == 1200:
        raise ValueError(
            "q = 1200 no es válido porque el denominador se hace cero."
        )

    denominador = 1 - q / 1200

    if denominador == 0:
        raise ZeroDivisionError(
            "El denominador de L(q) es cero."
        )

    return 18 + (0.0025 * q**2) / denominador

def f(q):

    return latencia(q) - SLA

# 3. VALIDACIONES

def validar_entrada(a, b):

    if not math.isfinite(a) or not math.isfinite(b):
        raise ValueError("Los extremos deben ser números finitos.")

    if a >= b:
        raise ValueError("Debe cumplirse a < b.")

    if a < Q_MIN or b > Q_MAX:
        raise ValueError(
            f"El intervalo debe estar dentro de [{Q_MIN}, {Q_MAX}]."
        )

    fa = f(a)
    fb = f(b)
    if not math.isfinite(fa) or not math.isfinite(fb):
        raise ValueError(
            "La función no produce valores finitos en el intervalo."
        )

    if fa == 0:
        return "a"

    if fb == 0:
        return "b"

    if fa * fb > 0:
        raise ValueError(
            "El intervalo no presenta cambio de signo."
        )

    return "válido"

# 4. MÉTODO DE BISECCIÓN

def biseccion(a, b, tol_x=TOL_X, tol_f=TOL_F,
              max_iter=MAX_ITER):

    validar_entrada(a, b)
    historial = []
    fa = f(a)
    fb = f(b)
    for i in range(1, max_iter + 1):
        c = (a + b) / 2
        fc = f(c)
        error_x = abs(b - a) / 2

        # Decisión de parada
        if abs(fc) <= tol_f and error_x <= tol_x:
            decision = "PARAR"
        elif abs(fc) <= tol_f:
            decision = "CUMPLE TOL_F"
        elif error_x <= tol_x:
            decision = "CUMPLE TOL_X"
        else:
            decision = "CONTINUAR"
        historial.append({
            "iteracion": i,
            "a": a,
            "b": b,
            "c": c,
            "f(c)": fc,
            "error_x": error_x,
            "decision": decision
        })
        if abs(fc) <= tol_f and error_x <= tol_x:
            return c, historial

        # Actualizar intervalo
        if fa * fc < 0:
            b = c
            fb = fc

        else:
            a = c
            fa = fc

    raise RuntimeError(
        "Bisección alcanzó el máximo de iteraciones."
    )

# 5. MÉTODO DE FALSA POSICIÓN

def falsa_posicion(a, b, tol_x=TOL_X, tol_f=TOL_F,
                   max_iter=MAX_ITER):

    validar_entrada(a, b)
    historial = []
    fa = f(a)
    fb = f(b)
    c_anterior = None

    for i in range(1, max_iter + 1):

        denominador = fb - fa

        if denominador == 0:
            raise ZeroDivisionError(
                "No se puede calcular falsa posición: "
                "f(b) - f(a) = 0."
            )

        c = (a * fb - b * fa) / (fb - fa)

        fc = f(c)

        if c_anterior is None:
            error_x = abs(b - a)
        else:
            error_x = abs(c - c_anterior)
        if abs(fc) <= tol_f and error_x <= tol_x:
            decision = "PARAR"
        elif abs(fc) <= tol_f:
            decision = "CUMPLE TOL_F"
        elif error_x <= tol_x:
            decision = "CUMPLE TOL_X"
        else:
            decision = "CONTINUAR"

        historial.append({
            "iteracion": i,
            "a": a,
            "b": b,
            "c": c,
            "f(c)": fc,
            "error_x": error_x,
            "decision": decision
        })
        if abs(fc) <= tol_f and error_x <= tol_x:
            return c, historial
        if fa * fc < 0:
            b = c
            fb = fc
        else:
            a = c
            fa = fc
        c_anterior = c

    raise RuntimeError(
        "Falsa posición alcanzó el máximo de iteraciones."
    )

# 6. MEDICIÓN DE TIEMPO Y MEMORIA

def medir_metodo(metodo, a, b):

    tracemalloc.start()
    inicio = time.perf_counter()
    raiz, historial = metodo(a, b)
    tiempo = time.perf_counter() - inicio
    memoria_actual, memoria_pico = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    return {
        "raiz": raiz,
        "iteraciones": len(historial),
        "tiempo_segundos": tiempo,
        "memoria_actual_bytes": memoria_actual,
        "memoria_pico_bytes": memoria_pico,
        "historial": historial
    }

# 7. VERIFICACIÓN

def verificar_raiz(raiz):
    valor_L = latencia(raiz)
    residuo = abs(f(raiz))

    return {
        "q": raiz,
        "L(q)": valor_L,
        "SLA": SLA,
        "residuo": residuo,
        "cumple_SLA": valor_L <= SLA,
        "cumple_tol_f": residuo <= TOL_F
    }

# 8. EJECUCIÓN PRINCIPAL

if __name__ == "__main__":
    a = 100.0
    b = 1100.0
    print("=" * 60)
    print("AUDITORÍA DE ECUACIONES NO LINEALES")
    print("=" * 60)

    print(f"SLA: {SLA} ms")
    print(f"Dominio: [{Q_MIN}, {Q_MAX}]")
    print(f"Intervalo utilizado: [{a}, {b}]")
    print(f"Tolerancia en x: {TOL_X}")
    print(f"Tolerancia en f: {TOL_F}")

    print("\nValores del intervalo:")
    print(f"f({a}) = {f(a):.6f}")
    print(f"f({b}) = {f(b):.6f}")

    print("\nCambio de signo:")
    print(f"f(a) * f(b) = {f(a) * f(b):.6f}")

    # BISECCIÓN
    resultado_biseccion = medir_metodo(
        biseccion,
        a,
        b
    )

    # FALSA POSICIÓN
    resultado_falsa = medir_metodo(
        falsa_posicion,
        a,
        b
    )

    # RESULTADOS

    print("\n" + "=" * 60)
    print("RESULTADOS")
    print("=" * 60)

    print("\nBisección")
    print(f"Raíz: {resultado_biseccion['raiz']:.6f}")
    print(f"Iteraciones: {resultado_biseccion['iteraciones']}")
    print(
        f"Tiempo: "
        f"{resultado_biseccion['tiempo_segundos']:.8f} s"
    )
    print(
        f"Memoria pico: "
        f"{resultado_biseccion['memoria_pico_bytes']} bytes"
    )

    print("\nFalsa posición")
    print(f"Raíz: {resultado_falsa['raiz']:.6f}")
    print(f"Iteraciones: {resultado_falsa['iteraciones']}")
    print(
        f"Tiempo: "
        f"{resultado_falsa['tiempo_segundos']:.8f} s"
    )
    print(
        f"Memoria pico: "
        f"{resultado_falsa['memoria_pico_bytes']} bytes"
    )

    # VERIFICACIÓN
    verificacion_b = verificar_raiz(
        resultado_biseccion["raiz"]
    )

    verificacion_f = verificar_raiz(
        resultado_falsa["raiz"]
    )

    print("\n" + "=" * 60)
    print("VERIFICACIÓN")
    print("=" * 60)

    print("\nBisección:")
    print(verificacion_b)

    print("\nFalsa posición:")
    print(verificacion_f)

    # EXPORTAR HISTORIALES
    df_biseccion = pd.DataFrame(
        resultado_biseccion["historial"]
    )

    df_falsa = pd.DataFrame(
        resultado_falsa["historial"]
    )
    df_biseccion.to_csv(
        "historial_biseccion.csv",
        index=False
    )
    df_falsa.to_csv(
        "historial_falsa_posicion.csv",
        index=False
    )
    # TABLA RESUMEN

    resumen = pd.DataFrame([
        {
            "metodo": "Bisección",
            "raiz": resultado_biseccion["raiz"],
            "iteraciones": resultado_biseccion["iteraciones"],
            "tiempo_s": resultado_biseccion["tiempo_segundos"],
            "memoria_pico_bytes":
                resultado_biseccion["memoria_pico_bytes"]
        },
        {
            "metodo": "Falsa posición",
            "raiz": resultado_falsa["raiz"],
            "iteraciones": resultado_falsa["iteraciones"],
            "tiempo_s": resultado_falsa["tiempo_segundos"],
            "memoria_pico_bytes":
                resultado_falsa["memoria_pico_bytes"]
        }
    ])

    resumen.to_csv(
        "resumen_metricas.csv",
        index=False
    )

    print("\nArchivos generados:")
    print("- historial_biseccion.csv")
    print("- historial_falsa_posicion.csv")
    print("- resumen_metricas.csv")

    # 9. GRÁFICA DE LA FUNCIÓN

    q_values = [
        Q_MIN + i * (Q_MAX - Q_MIN) / 500
        for i in range(501)
    ]

    f_values = [f(q) for q in q_values]

    plt.figure(figsize=(10, 6))

    plt.plot(
        q_values,
        f_values,
        label="f(q) = L(q) - SLA"
    )
    plt.axhline(
        0,
        linestyle="--",
        label="f(q) = 0"
    )
    plt.scatter(
        resultado_biseccion["raiz"],
        f(resultado_biseccion["raiz"]),
        label="Bisección"
    )
    plt.scatter(
        resultado_falsa["raiz"],
        f(resultado_falsa["raiz"]),
        label="Falsa posición"
    )
    plt.xlabel("Capacidad q")
    plt.ylabel("f(q)")
    plt.title("Función y raíz del problema")
    plt.grid(True)
    plt.legend()

    plt.savefig(
        "grafica_funcion.png",
        dpi=300,
        bbox_inches="tight"
    )

    plt.close()

    # 10. GRÁFICA DE CONVERGENCIA

    iter_b = [
        fila["iteracion"]
        for fila in resultado_biseccion["historial"]
    ]
    error_b = [
        abs(fila["f(c)"])
        for fila in resultado_biseccion["historial"]
    ]
    iter_f = [
        fila["iteracion"]
        for fila in resultado_falsa["historial"]
    ]
    error_f = [
        abs(fila["f(c)"])
        for fila in resultado_falsa["historial"]
    ]
    plt.figure(figsize=(10, 6))

    plt.semilogy(
        iter_b,
        error_b,
        marker="o",
        label="Bisección"
    )
    plt.semilogy(
        iter_f,
        error_f,
        marker="s",
        label="Falsa posición"
    )
    plt.xlabel("Iteración")
    plt.ylabel("|f(c)|")
    plt.title("Convergencia de los métodos")
    plt.grid(True)
    plt.legend()

    plt.savefig(
        "grafica_convergencia.png",
        dpi=300,
        bbox_inches="tight"
    )
    plt.close()