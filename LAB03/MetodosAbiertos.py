
from __future__ import annotations

import csv
import math
from typing import Optional

# ------------------------------------------------------------------
# 1. Parámetros del problema
# ------------------------------------------------------------------

Z_MIN = -10.0
Z_MAX = 10.0
INICIOS = [-8.0, 0.0, 8.0]
TOL_X = 1e-6
TOL_F = 1e-6
MAX_ITER = 100
ALPHA = 0.5  # factor de amortiguamiento, aplicado en los tres métodos


# ------------------------------------------------------------------
# 2. Función del problema y derivada analítica
# ------------------------------------------------------------------

def f(z: float) -> float:
    
    try:
        if z >= 0:
            e = math.exp(-z)
            return 1.0 / (1.0 + e) - 0.83
        e = math.exp(z)
        return e / (1.0 + e) - 0.83
    except (OverflowError, ValueError):
        return float("nan")


def df(z: float) -> float:
    """f'(z) = sigmoide(z) * (1 - sigmoide(z)), forma analítica exacta."""
    try:
        e = math.exp(-z) if z >= 0 else math.exp(z)
        return e / ((1.0 + e) ** 2)
    except (OverflowError, ValueError):
        return float("nan")

# ------------------------------------------------------------------
# 3. g(z) para punto fijo
# ------------------------------------------------------------------

def g(z: float) -> float:
    derivada = df(z)
    if not math.isfinite(derivada) or abs(derivada) < 1e-14:
        raise ArithmeticError("Derivada demasiado pequeña para evaluar g(z).")
    return z - f(z) / derivada


# ------------------------------------------------------------------
# 4. Validación de dominio y criterio de convergencia
# ------------------------------------------------------------------

def validar_z(z: float) -> bool:
    return math.isfinite(z) and Z_MIN <= z <= Z_MAX


def convergio(z_actual: float, z_anterior: Optional[float] = None) -> bool:
    if abs(f(z_actual)) < TOL_F:
        return True
    if z_anterior is not None and abs(z_actual - z_anterior) < TOL_X:
        return True
    return False


# ------------------------------------------------------------------
# 5. Bisección y rescate
# ------------------------------------------------------------------

def biseccion(a: float, b: float) -> tuple[Optional[float], list[dict], str]:
    historial: list[dict] = []
    fa, fb = f(a), f(b)

    if not math.isfinite(fa) or not math.isfinite(fb):
        return None, historial, "Fallo: valor no finito."
    if fa * fb > 0:
        return None, historial, "Fallo: no existe cambio de signo."

    c = a
    for i in range(1, MAX_ITER + 1):
        c = (a + b) / 2.0
        fc = f(c)
        error = abs(b - a) / 2.0

        historial.append({
            "iteracion": i, "a": a, "b": b, "c": c,
            "f_c": fc, "error": error, "decision": "Bisección",
        })

        if abs(fc) < TOL_F or error < TOL_X:
            return c, historial, "Convergió por bisección."

        if fa * fc < 0:
            b, fb = c, fc
        else:
            a, fa = c, fc

    return c, historial, "Máximo de iteraciones en bisección."


def rescate_biseccion(z: float) -> tuple[Optional[float], list[dict], str]:
    """Escanea [Z_MIN, Z_MAX] buscando un cambio de signo y arranca bisección ahí."""
    pasos = 200
    paso = (Z_MAX - Z_MIN) / pasos
    anterior = Z_MIN
    f_anterior = f(anterior)

    for i in range(1, pasos + 1):
        actual = Z_MIN + i * paso
        f_actual = f(actual)

        if (math.isfinite(f_anterior) and math.isfinite(f_actual)
                and f_anterior * f_actual < 0):
            return biseccion(anterior, actual)

        anterior, f_anterior = actual, f_actual

    return None, [], "No se encontró intervalo para rescate."


# ------------------------------------------------------------------
# 6. Constructores de resultado (evitan repetir el mismo bloque
#    de "arma diccionario + llama rescate" en cada método)
# ------------------------------------------------------------------

def _resultado_exito(metodo: str, inicio, raiz: float, iteracion: int,
                      historial: list[dict]) -> dict:
    return {
        "metodo": metodo, "inicio": inicio, "raiz": raiz,
        "iteraciones": iteracion, "error": abs(f(raiz)),
        "estado": "Convergió", "historial": historial,
    }


def _resultado_rescate(metodo: str, inicio, z_actual: float,
                        iteracion_actual: int, historial: list[dict],
                        motivo: str) -> dict:
    raiz, hist_rescate, estado = rescate_biseccion(z_actual)
    historial.extend(hist_rescate)
    return {
        "metodo": metodo, "inicio": inicio, "raiz": raiz,
        "iteraciones": iteracion_actual + len(hist_rescate),
        "error": abs(f(raiz)) if raiz is not None else None,
        "estado": f"{motivo}: {estado}", "historial": historial,
    }


def _resultado_fuera_dominio(metodo: str, inicio) -> dict:
    return {
        "metodo": metodo, "inicio": inicio, "raiz": None,
        "iteraciones": 0, "error": None,
        "estado": "Fallo: inicio fuera de dominio.", "historial": [],
    }


# ------------------------------------------------------------------
# 7. Newton-Raphson
# ------------------------------------------------------------------

def newton_raphson(z0: float) -> dict:
    if not validar_z(z0):
        return _resultado_fuera_dominio("Newton-Raphson", z0)

    z = z0
    historial: list[dict] = []

    for i in range(1, MAX_ITER + 1):
        fz, derivada = f(z), df(z)

        if not math.isfinite(fz) or not math.isfinite(derivada):
            return _resultado_rescate("Newton-Raphson", z0, z, i, historial,
                                       "Rescate por valor no finito")

        if abs(derivada) < 1e-14:
            return _resultado_rescate("Newton-Raphson", z0, z, i, historial,
                                       "Rescate por derivada pequeña")

        z_nuevo = z + ALPHA * (-fz / derivada)

        if not validar_z(z_nuevo):
            return _resultado_rescate("Newton-Raphson", z0, z, i, historial,
                                       "Rescate por salida del dominio")

        error = abs(z_nuevo - z)
        historial.append({
            "iteracion": i, "z_anterior": z, "z_actual": z_nuevo,
            "f_z": f(z_nuevo), "error": error, "decision": "Newton amortiguado",
        })

        if convergio(z_nuevo, z):
            return _resultado_exito("Newton-Raphson", z0, z_nuevo, i, historial)

        z = z_nuevo

    resultado = _resultado_rescate("Newton-Raphson", z0, z, MAX_ITER, historial,
                                    "Máximo de iteraciones")
    resultado["estado"] = "Máximo de iteraciones. " + resultado["estado"].split(": ", 1)[1]
    return resultado


# ------------------------------------------------------------------
# 8. Secante
# ------------------------------------------------------------------

def secante(z0: float, z1: float) -> dict:
    inicio = f"{z0}, {z1}"
    if not validar_z(z0) or not validar_z(z1):
        return _resultado_fuera_dominio("Secante", inicio)

    f0, f1 = f(z0), f(z1)
    historial: list[dict] = []

    for i in range(1, MAX_ITER + 1):
        denominador = f1 - f0

        if abs(denominador) < 1e-14:
            return _resultado_rescate("Secante", inicio, z1, i, historial,
                                       "Rescate por denominador pequeño")

        z2 = z1 - f1 * (z1 - z0) / denominador
        z2 = z1 + ALPHA * (z2 - z1)  # amortiguamiento

        if not validar_z(z2):
            return _resultado_rescate("Secante", inicio, z1, i, historial,
                                       "Rescate por salida del dominio")

        f2 = f(z2)
        error = abs(z2 - z1)
        historial.append({
            "iteracion": i, "z_anterior": z1, "z_actual": z2,
            "f_z": f2, "error": error, "decision": "Secante amortiguada",
        })

        if convergio(z2, z1):
            return _resultado_exito("Secante", inicio, z2, i, historial)

        z0, f0 = z1, f1
        z1, f1 = z2, f2

    resultado = _resultado_rescate("Secante", inicio, z1, MAX_ITER, historial,
                                    "Máximo de iteraciones")
    resultado["estado"] = "Máximo de iteraciones. " + resultado["estado"].split(": ", 1)[1]
    return resultado


# ------------------------------------------------------------------
# 9. Punto fijo
# ------------------------------------------------------------------

def punto_fijo(z0: float) -> dict:
    if not validar_z(z0):
        return _resultado_fuera_dominio("Punto fijo", z0)

    z = z0
    historial: list[dict] = []

    for i in range(1, MAX_ITER + 1):
        try:
            z_g = g(z)
        except (ArithmeticError, ValueError, OverflowError):
            return _resultado_rescate("Punto fijo", z0, z, i, historial,
                                       "Rescate por fallo en g(z)")

        z_nuevo = z + ALPHA * (z_g - z)

        if not validar_z(z_nuevo):
            return _resultado_rescate("Punto fijo", z0, z, i, historial,
                                       "Rescate por salida del dominio")

        error = abs(z_nuevo - z)
        historial.append({
            "iteracion": i, "z_anterior": z, "z_actual": z_nuevo,
            "f_z": f(z_nuevo), "error": error, "decision": "Punto fijo amortiguado",
        })

        if convergio(z_nuevo, z):
            return _resultado_exito("Punto fijo", z0, z_nuevo, i, historial)

        z = z_nuevo

    resultado = _resultado_rescate("Punto fijo", z0, z, MAX_ITER, historial,
                                    "Máximo de iteraciones")
    resultado["estado"] = "Máximo de iteraciones. " + resultado["estado"].split(": ", 1)[1]
    return resultado


# ------------------------------------------------------------------
# 10. Ejecutar todas las pruebas
# ------------------------------------------------------------------

def ejecutar_pruebas() -> tuple[list[dict], list[dict]]:
    resultados: list[dict] = []
    historiales: list[dict] = []

    def _registrar(resultado: dict, metodo: str, inicio) -> None:
        resultados.append(resultado)
        for h in resultado["historial"]:
            h["metodo"] = metodo
            h["inicio"] = inicio
            historiales.append(h)

    for z0 in INICIOS:
        _registrar(newton_raphson(z0), "Newton-Raphson", z0)

    for z0 in INICIOS:
        _registrar(punto_fijo(z0), "Punto fijo", z0)

    pares_secante = [(-8.0, -7.0), (0.0, 1.0), (8.0, 7.0)]
    for z0, z1 in pares_secante:
        _registrar(secante(z0, z1), "Secante", f"{z0}, {z1}")

    return resultados, historiales


# ------------------------------------------------------------------
# 11. Guardar y mostrar resultados
# ------------------------------------------------------------------

def guardar_resultados(resultados: list[dict], historiales: list[dict]) -> None:
    archivo_resumen = "resultados_metodos.csv"
    archivo_historial = "historial_iteraciones.csv"

    with open(archivo_resumen, "w", newline="", encoding="utf-8") as archivo:
        campos = ["metodo", "inicio", "raiz", "iteraciones", "error", "estado"]
        writer = csv.DictWriter(archivo, fieldnames=campos)
        writer.writeheader()
        for r in resultados:
            writer.writerow({campo: r[campo] for campo in campos})

    with open(archivo_historial, "w", newline="", encoding="utf-8") as archivo:
        campos = ["metodo", "inicio", "iteracion", "z_anterior", "z_actual",
                  "a", "b", "c", "f_z", "f_c", "error", "decision"]
        writer = csv.DictWriter(archivo, fieldnames=campos)
        writer.writeheader()
        for h in historiales:
            writer.writerow({campo: h.get(campo) for campo in campos})

    print("\nArchivos generados correctamente:")
    print(f"  -> {archivo_resumen}")
    print(f"  -> {archivo_historial}")


def mostrar_resultados(resultados: list[dict]) -> None:
    print("\n" + "=" * 90)
    print("RESULTADOS DE LOS MÉTODOS")
    print("=" * 90)

    for r in resultados:
        print("\n----------------------------------------")
        print(f"Método      : {r['metodo']}")
        print(f"Inicio      : {r['inicio']}")
        print(f"Raíz        : {r['raiz']}")
        print(f"Iteraciones : {r['iteraciones']}")
        print(f"Error       : {r['error']}")
        print(f"Estado      : {r['estado']}")


# ------------------------------------------------------------------
# 12. Programa principal
# ------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 90)
    print("CALIBRACIÓN DE UN UMBRAL PROBABILÍSTICO")
    print("=" * 90)
    print("\nFunción:\n f(z) = 1/(1 + exp(-z)) - 0.83")
    print(f"\nDominio:\n z ∈ [{Z_MIN}, {Z_MAX}]")
    print(f"\nInicios:\n {INICIOS}")
    print(f"\nTolerancia en z:\n {TOL_X}")
    print(f"\nTolerancia en f(z):\n {TOL_F}")
    print(f"\nAmortiguamiento:\n {ALPHA}")

    resultados, historiales = ejecutar_pruebas()
    mostrar_resultados(resultados)
    guardar_resultados(resultados, historiales)

    print("\n" + "=" * 90)
    print("PROCESO FINALIZADO")
    print("=" * 90)