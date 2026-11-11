"""
Genera sql/02_inferencia.sql: las 5 hipótesis, las verosimilitudes P(rama | hipótesis)
y las tablas nuevas que necesita el motor de inferencia bayesiano.

Modelo de elicitación (estimación de diseño, NO calibrada con datos reales):

  Cada hipótesis H_L es un nivel de lectoescritura L (1..5). Cada nodo pertenece a un
  módulo con orden m (1..4). La probabilidad de que un usuario de nivel L tome la rama
  "de avance" en ese nodo es:

    L > m   (módulo ya superado)   -> 0.92
    L = m   (módulo en curso)      -> H_L significa "superó los módulos anteriores y todavía NO
                                      domina el módulo L", así que acierta poco: 0.35 en el primer
                                      nodo, bajando hasta 0.10 en el último nodo del módulo
    L < m   (módulo no alcanzado)  -> 0.04

  La masa restante (1 - p_avance) se reparte entre las ramas de falla del nodo. Si el
  módulo no fue alcanzado, la primera falla (la más básica) pesa el triple que las demás;
  en los otros casos el reparto es uniforme.

  Para cada nodo y cada hipótesis las probabilidades de sus ramas suman exactamente 1.

Uso:  PSQL_CMD="psql -d alfabot" python3 gen_verosimilitudes.py > ../sql/02_inferencia.sql
"""
import os
import subprocess
import sys
from collections import defaultdict

PSQL = os.environ.get("PSQL_CMD", "psql -d alfabot").split()

P_SUPERADO = 0.92
P_NO_ALCANZADO = 0.04
P_CURSO_PRIMERO = 0.35
P_CURSO_ULTIMO = 0.10
PESO_FALLA_BASICA = 3.0

HIPOTESIS = [
    (1, "H1", "Reconocimiento de letras",
     "El usuario aún no domina las letras: vocales, consonantes frecuentes o la diferencia entre mayúsculas y minúsculas."),
    (2, "H2", "Conciencia silábica",
     "El usuario reconoce las letras pero todavía no forma sílabas directas, inversas, mixtas o trabadas."),
    (3, "H3", "Lectura de palabras y oraciones",
     "El usuario forma sílabas pero todavía no lee palabras y oraciones con fluidez."),
    (4, "H4", "Comprensión y escritura",
     "El usuario lee con fluidez pero aún no comprende, infiere o escribe oraciones correctamente."),
    (5, "H5", "Alfabetización básica lograda",
     "El usuario supera todos los módulos de diagnóstico."),
]
PRIOR = 0.2


def consulta(sql):
    r = subprocess.run(PSQL + ["-At", "-F", "|", "-c", sql],
                       capture_output=True, text=True, check=True)
    return [fila.split("|") for fila in r.stdout.strip().splitlines()]


nodos = {}
for nid, orden_mod, pos, total in consulta(
        "SELECT n.id, m.orden, n.orden, (SELECT count(*) FROM nodos x WHERE x.modulo_id = n.modulo_id) "
        "FROM nodos n JOIN modulos m ON m.id = n.modulo_id ORDER BY n.id"):
    nodos[int(nid)] = dict(mod=int(orden_mod), pos=int(pos), total=int(total), ramas=[])

for rid, nid, tipo in consulta(
        "SELECT ra.id, ra.nodo_id, r.tipo FROM ramas ra JOIN reglas r ON r.rama_id = ra.id ORDER BY ra.nodo_id, ra.id"):
    nodos[int(nid)]["ramas"].append((int(rid), tipo))


def p_avance(nivel, nodo):
    if nivel > nodo["mod"]:
        return P_SUPERADO
    if nivel < nodo["mod"]:
        return P_NO_ALCANZADO
    if nodo["total"] == 1:
        return (P_CURSO_PRIMERO + P_CURSO_ULTIMO) / 2
    frac = (nodo["pos"] - 1) / (nodo["total"] - 1)
    return P_CURSO_PRIMERO - (P_CURSO_PRIMERO - P_CURSO_ULTIMO) * frac


filas = []
for nid, nodo in nodos.items():
    avance = [r for r, t in nodo["ramas"] if t != "remedial"]
    fallas = [r for r, t in nodo["ramas"] if t == "remedial"]
    assert len(avance) == 1, f"el nodo {nid} debe tener exactamente una rama de avance/fin"
    for nivel, *_ in HIPOTESIS:
        pa = round(p_avance(nivel, nodo), 4)
        resto = 1.0 - pa
        if nivel < nodo["mod"] and len(fallas) > 1:
            pesos = [PESO_FALLA_BASICA] + [1.0] * (len(fallas) - 1)
        else:
            pesos = [1.0] * len(fallas)
        total_w = sum(pesos)
        valores = {avance[0]: pa}
        for rid, w in zip(fallas, pesos):
            valores[rid] = round(resto * w / total_w, 4)
        # corregir el residuo de redondeo en la rama más probable para que sume 1.0000
        residuo = round(1.0 - sum(valores.values()), 4)
        mayor = max(valores, key=valores.get)
        valores[mayor] = round(valores[mayor] + residuo, 4)
        assert abs(sum(valores.values()) - 1.0) < 1e-9
        for rid, v in valores.items():
            filas.append((rid, nivel, v))

filas.sort()

print("""-- ============================================================
-- AlfaBot — Sistema de inferencia bayesiano
-- Tablas nuevas, las 5 hipótesis y las verosimilitudes P(rama | hipótesis)
-- (generado por tools/gen_verosimilitudes.py)
-- ============================================================

-- Base de conocimiento -----------------------------------------
CREATE TABLE hipotesis (
    id           SERIAL PRIMARY KEY,
    codigo       VARCHAR(3)   NOT NULL UNIQUE,
    nombre       VARCHAR(80)  NOT NULL,
    descripcion  TEXT         NOT NULL,
    nivel        INTEGER      NOT NULL UNIQUE,   -- se compara contra modulos.orden
    prior        NUMERIC(5,4) NOT NULL CHECK (prior > 0 AND prior < 1)
);

CREATE TABLE verosimilitudes (
    rama_id       INTEGER      NOT NULL REFERENCES ramas(id),
    hipotesis_id  INTEGER      NOT NULL REFERENCES hipotesis(id),
    probabilidad  NUMERIC(5,4) NOT NULL CHECK (probabilidad > 0 AND probabilidad <= 1),
    PRIMARY KEY (rama_id, hipotesis_id)
);
CREATE INDEX idx_verosimilitudes_hipotesis ON verosimilitudes(hipotesis_id);

-- Sistema transaccional ----------------------------------------
CREATE TABLE inferencias (
    id             SERIAL PRIMARY KEY,
    evaluacion_id  INTEGER       NOT NULL REFERENCES evaluaciones(id),
    paso           INTEGER       NOT NULL,           -- 0 = probabilidades a priori
    hipotesis_id   INTEGER       NOT NULL REFERENCES hipotesis(id),
    rama_id        INTEGER       REFERENCES ramas(id), -- respuesta que originó el paso
    probabilidad   NUMERIC(7,6)  NOT NULL,
    UNIQUE (evaluacion_id, paso, hipotesis_id)
);
CREATE INDEX idx_inferencias_evaluacion ON inferencias(evaluacion_id);
""")

print("INSERT INTO hipotesis (id, codigo, nombre, descripcion, nivel, prior) VALUES")
print(",\n".join(
    f"    ({i}, '{c}', '{n}', '{d}', {i}, {PRIOR})" for i, c, n, d in HIPOTESIS) + ";\n")

print("-- Verosimilitudes: %d filas (40 ramas x 5 hipótesis)" % len(filas))
print("INSERT INTO verosimilitudes (rama_id, hipotesis_id, probabilidad) VALUES")
print(",\n".join(f"    ({r}, {h}, {v:.4f})" for r, h, v in filas) + ";\n")

print("""-- Verificación: para cada nodo e hipótesis, las probabilidades de sus ramas deben sumar 1
-- (esta consulta debe devolver 0 filas)
-- SELECT ra.nodo_id, v.hipotesis_id, SUM(v.probabilidad)
-- FROM verosimilitudes v JOIN ramas ra ON ra.id = v.rama_id
-- GROUP BY ra.nodo_id, v.hipotesis_id
-- HAVING ABS(SUM(v.probabilidad) - 1) > 0.0001;
""")
