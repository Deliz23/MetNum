# MN-ProyectoFinal

## Métodos Numéricos — Análisis, Implementación y Evaluación de Métodos Numéricos

Este repositorio contiene el desarrollo del proyecto final del curso de **Métodos Numéricos**, en el cual se implementan, analizan y comparan diferentes métodos utilizados para la resolución de problemas numéricos.

El proyecto reúne tres trabajos principales desarrollados durante el curso:

1. **Teoría de Errores**
2. **Ecuaciones no lineales: Bisección y Falsa Posición**
3. **Punto Fijo, Newton-Raphson y Secante**

El propósito del proyecto es mostrar cómo los métodos numéricos permiten resolver problemas matemáticos mediante algoritmos computacionales, considerando aspectos como la **precisión, convergencia, error numérico, estabilidad y rendimiento computacional**.

---

## ¿Qué es este proyecto?

**MN-ProyectoFinal** es una plataforma de apoyo académico y computacional desarrollada para implementar y analizar métodos numéricos mediante programas ejecutables.

A través de los diferentes módulos del proyecto se estudia cómo una expresión matemática puede transformarse en un algoritmo y posteriormente en una implementación computacional.

El proyecto no se limita a obtener una respuesta numérica, sino que también permite analizar:

* El error producido durante los cálculos.
* La precisión de los resultados.
* La velocidad de ejecución.
* El comportamiento de los métodos durante sus iteraciones.
* Las condiciones de convergencia.
* Las situaciones en las que un método puede presentar dificultades.
* El comportamiento de diferentes representaciones numéricas.

De esta manera, el repositorio integra la parte **matemática, algorítmica y computacional** de los métodos estudiados.

---

## ¿A quién está dirigido?

Este proyecto está dirigido principalmente a:

* Estudiantes de **Ingeniería de Sistemas** y carreras relacionadas.
* Estudiantes que cursan **Métodos Numéricos**.
* Personas que desean comprender la implementación computacional de métodos matemáticos.
* Estudiantes interesados en el análisis de errores y precisión numérica.
* Personas que desean utilizar Python para implementar algoritmos numéricos.

El contenido está organizado de manera que se pueda revisar tanto la fundamentación matemática como la implementación y los resultados obtenidos.

---

## Objetivos del proyecto

### Objetivo general

Implementar y analizar diferentes métodos numéricos mediante herramientas computacionales, evaluando su precisión, convergencia, comportamiento y rendimiento al resolver problemas matemáticos.

### Objetivos específicos

* Analizar los diferentes tipos de errores presentes en los cálculos numéricos.
* Implementar métodos para resolver ecuaciones no lineales.
* Comparar el comportamiento de diferentes métodos iterativos.
* Evaluar la convergencia y el número de iteraciones necesarias.
* Analizar el error obtenido en cada método.
* Medir el tiempo de ejecución y el consumo de memoria.
* Generar resultados que permitan comparar objetivamente los métodos.
* Aplicar criterios de tolerancia y condiciones de parada.
* Facilitar la reproducción de los experimentos mediante configuraciones controladas.

---

# Contenido del proyecto

La portada del portal web organiza el sílabo en **seis capítulos y dieciséis temas**. Cada capítulo reúne sus temas y cada tarjeta abre directamente su página.

La estructura del portal se define en `curriculum.js`. Los temas que ya tienen una página enlazan directamente con ella. Para los temas pendientes se crearon archivos HTML vacíos en `TEMAS/`, listos para completar más adelante.

Los informes y módulos implementados en este repositorio incluyen los siguientes contenidos:

---

# 1. Teoría de Errores

Esta sección estudia el comportamiento de los números en punto flotante y los errores producidos durante las operaciones numéricas.

Se implementan y comparan tres estrategias de suma:

* **Suma directa**
* **Suma de Kahan**
* **Suma centrada**

### Suma directa

Realiza la suma de los elementos de manera secuencial, acumulando cada valor en una variable.

### Suma de Kahan

Utiliza una variable de compensación para reducir la pérdida de precisión producida por los errores de redondeo durante la acumulación.

### Suma centrada

Utiliza una escala base para reducir el efecto que puede producir la magnitud de los valores sobre la precisión de la suma.

### Análisis realizado

Las pruebas consideran diferentes:

* Escalas de valores.
* Cantidades de muestras.
* Tipos de datos (`float32` y `float64`).
* Métodos de suma.

Se analizan métricas como:

* Error absoluto.
* Error relativo.
* Tiempo de ejecución.
* Memoria asociada a los datos.
* Cumplimiento del umbral de error.

---

# 2. Ecuaciones no lineales: Bisección y Falsa Posición

Esta sección aborda la resolución de ecuaciones no lineales mediante métodos basados en intervalos.

Los métodos implementados son:

* **Método de Bisección**
* **Método de Falsa Posición**

Estos métodos utilizan un intervalo inicial y aprovechan el cambio de signo de la función para aproximarse progresivamente a una raíz.

### Método de Bisección

Divide el intervalo de búsqueda en dos partes y selecciona el subintervalo que mantiene el cambio de signo.

En cada iteración se calcula un nuevo punto medio y se evalúa el error hasta cumplir las condiciones de tolerancia establecidas.

### Método de Falsa Posición

Utiliza una recta secante entre los extremos del intervalo para obtener una aproximación de la raíz.

Al igual que Bisección, mantiene el intervalo asociado al cambio de signo, pero utiliza una estimación basada en la interpolación lineal.

### Análisis realizado

Para ambos métodos se consideran aspectos como:

* Aproximación de la raíz.
* Número de iteraciones.
* Error en cada iteración.
* Criterios de convergencia.
* Tolerancia en la variable.
* Tolerancia en la función.
* Tiempo de ejecución.
* Comportamiento de cada método.

También se consideran mecanismos de validación para evitar intervalos inválidos o situaciones en las que la función no pueda evaluarse correctamente.

---

# 3. Punto Fijo, Newton-Raphson y Secante

Esta sección estudia métodos iterativos utilizados para encontrar las raíces de una ecuación no lineal.

Los métodos implementados son:

* **Punto Fijo**
* **Newton-Raphson**
* **Secante**

El objetivo es analizar cómo cada método genera aproximaciones sucesivas hasta alcanzar una solución que cumpla con las tolerancias establecidas.

### Punto Fijo

Transforma la ecuación original en una expresión de la forma:

```text
z = g(z)
```

A partir de un valor inicial, se generan nuevas aproximaciones mediante la función de iteración.

### Newton-Raphson

Utiliza la derivada de la función para calcular una nueva aproximación de la raíz.

Su actualización se basa en:

```text
z(nuevo) = z - f(z) / f'(z)
```

El método permite obtener aproximaciones rápidamente cuando las condiciones de convergencia son adecuadas.

### Secante

Utiliza dos aproximaciones iniciales y reemplaza el uso explícito de la derivada mediante una aproximación basada en una secante.

El método genera nuevas aproximaciones utilizando los dos valores anteriores.

### Mecanismos adicionales

La implementación considera mecanismos para controlar situaciones problemáticas, como:

* Valores fuera del dominio.
* Derivadas demasiado pequeñas.
* Denominadores cercanos a cero.
* Valores no finitos.
* Salidas del intervalo permitido.
* Exceso de iteraciones.

También se implementa un mecanismo de **rescate mediante Bisección** cuando alguno de los métodos iterativos presenta dificultades para continuar.

---

# Tecnologías utilizadas

El proyecto utiliza principalmente **Python** debido a su facilidad para implementar algoritmos matemáticos y analizar resultados.

### Lenguaje

* Python 3

### Librerías

* `NumPy` — operaciones numéricas y manejo de arreglos.
* `Matplotlib` — generación de gráficos.
* `Pandas` — procesamiento y análisis de resultados.
* `CSV` — almacenamiento de resultados experimentales.
* `Math` — operaciones matemáticas.
* `Time` — medición del tiempo de ejecución.
* `Tracemalloc` — medición de memoria utilizada durante la ejecución.

---

# Requisitos

Para ejecutar los programas se necesita tener instalado:

* Python 3
* NumPy
* Matplotlib
* Pandas

Las dependencias pueden instalarse mediante:

```bash
pip install numpy matplotlib pandas
```

---

# Ejecución

Cada tema cuenta con su propio programa o conjunto de archivos.

De manera general, los programas pueden ejecutarse desde una terminal utilizando:

```bash
python nombre_del_archivo.py
```

También pueden ejecutarse utilizando entornos de desarrollo como:

* Visual Studio Code
* Jupyter Notebook
* PyCharm
* IDLE

---

# Resultados

Los programas generan información que permite analizar el comportamiento de los métodos implementados.

Dependiendo del tema, se generan:

* Archivos CSV.
* Tablas de resultados.
* Historial de iteraciones.
* Gráficos.
* Comparaciones de errores.
* Mediciones de tiempo.
* Mediciones de memoria.

Estos resultados permiten complementar el análisis matemático con una evaluación computacional de los algoritmos.

---

# Métricas de evaluación

Para analizar el comportamiento de los métodos se consideran diferentes métricas.

### Error

Permite conocer la diferencia entre una aproximación obtenida y el valor esperado o de referencia.

### Error relativo

Permite analizar el error considerando la magnitud del valor de referencia.

### Número de iteraciones

Indica cuántas iteraciones necesita cada método para alcanzar las condiciones de convergencia establecidas.

### Tiempo de ejecución

Permite conocer el tiempo transcurrido durante la ejecución de cada método.

### Memoria

Se analiza la memoria trazada durante la ejecución del programa, permitiendo comparar el costo computacional asociado a cada método.

### Convergencia

Se verifica si el método alcanza una solución dentro de las tolerancias definidas.

---

# Estructura del proyecto

La estructura general del repositorio se organiza de la siguiente manera:

```text
MN-ProyectoFinal/
│
├── Teoria de Errores/
│   ├── código
│   ├── resultados
│   └── gráficos
│
├── Bisección y Falsa Posición/
│   ├── código
│   ├── resultados
│   └── gráficos
│
├── Punto Fijo, Newton-Raphson y Secante/
│   ├── código
│   ├── resultados
│   └── gráficos
│
├── README.md
└── ...
```

> La estructura exacta puede variar de acuerdo con la organización final de los archivos del repositorio.

---

# Reproducibilidad

Los experimentos utilizan configuraciones y valores iniciales definidos previamente para facilitar la reproducción de los resultados.

En el caso de los experimentos que utilizan datos pseudoaleatorios, se establece una semilla fija. Por ejemplo:

```python
semilla = 12345
```

Esto permite generar nuevamente los mismos datos de entrada y realizar comparaciones bajo las mismas condiciones.

Asimismo, los métodos utilizan valores de tolerancia y límites máximos de iteraciones previamente establecidos.

---

# Conclusiones generales

El proyecto permite aplicar de manera práctica diferentes conceptos estudiados en el curso de Métodos Numéricos.

A través de la **Teoría de Errores** se analiza cómo la representación numérica y las operaciones de punto flotante pueden afectar la precisión de los resultados.

Mediante **Bisección y Falsa Posición** se estudian métodos basados en intervalos para encontrar raíces de ecuaciones no lineales.

Finalmente, con **Punto Fijo, Newton-Raphson y Secante** se analizan métodos iterativos que generan aproximaciones sucesivas y cuya eficiencia depende de las condiciones iniciales y del comportamiento de la función.

En conjunto, el proyecto permite relacionar la **formulación matemática, el diseño de algoritmos, la implementación en Python y la evaluación computacional**, proporcionando una visión práctica de la aplicación de los métodos numéricos.

---

## Autores

Proyecto desarrollado como parte del curso de **Métodos Numéricos**.

**MN-ProyectoFinal**

Universidad Nacional de San Agustín de Arequipa — UNSA
