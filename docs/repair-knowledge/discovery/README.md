# BibendIA Repair Knowledge Core — Discovery & Technical Architecture

## 1. Contexto y Objetivo
Este directorio contiene la documentación completa de investigación, descubrimiento de fuentes, modelo de conocimiento técnico y pruebas de concepto (PoC) para construir la capa de datos que alimentará el motor de presupuestación técnica de **BibendIA**.

- **Objetivo**: Resolver la asociación `VEHÍCULO CONCRETO + INTERVENCIÓN CONCRETA → COMPONENTES, CONSUMIBLES, TORNILLERÍA Y REGLAS TÉCNICAS NECESARIAS`.
- **Fecha de Discovery**: 29 de septiembre de 2026
- **Estado General**: `CONDITIONAL_GO` (Gate PoC superado para Repair BOMs; mano de obra europea y resolución de matrícula requieren estrategia mixta/API).

---

## 2. Clasificación de Documentos

### Documentos Normativos (Arquitectura y Reglas del Sistema)
- [`04_REPAIR_KNOWLEDGE_MODEL.md`](./04_REPAIR_KNOWLEDGE_MODEL.md): **Normativo**. Define el modelo entidad-relación del grafo de datos, la estructura de provenanza en aristas (`edges`) y los estados de confianza explícitos.
- [`05_REPAIR_JOB_CATALOG.md`](./05_REPAIR_JOB_CATALOG.md): **Normativo**. Define el catálogo normalizado de 60 intervenciones iniciales en taller.
- [`08_LICENSE_AND_REUSE_MATRIX.md`](./08_LICENSE_AND_REUSE_MATRIX.md): **Normativo**. Define el marco legal conservador, restricciones contractuales y reglas de derivada de hechos técnicos sin replicación de bases de datos.
- [`10_RECOMMENDATION.md`](./10_RECOMMENDATION.md): **Normativo**. Define la hoja de ruta de ingesta, reglas de filtrado y decisión estratégica.

### Documentos Exploratorios y Auditorías
- [`01_SOURCE_REGISTRY.md`](./01_SOURCE_REGISTRY.md): **Exploratorio**. Inventario y ficha técnica de fuentes analizadas (SKF, Gates, Continental, Schaeffler, febi, Elring, etc.).
- [`02_SOURCE_REGISTRY.csv`](./02_SOURCE_REGISTRY.csv): **Exploratorio / Importable**. Matriz de fuentes en formato CSV.
- [`03_OPEN_DATA_AND_APIS.md`](./03_OPEN_DATA_AND_APIS.md): **Exploratorio**. Análisis de datasets abiertos, límites de APIs públicas (Open Labor Project) y alcance geográfico (NHTSA).
- [`06_MANUFACTURER_KIT_ANALYSIS.md`](./06_MANUFACTURER_KIT_ANALYSIS.md): **Exploratorio**. Análisis de deconstrucción de kits de reparación comerciales.
- [`07_REAL_VEHICLE_POC.md`](./07_REAL_VEHICLE_POC.md): **Exploratorio / Evidencia**. PoC auditada sobre 3 vehículos reales (VW Golf VII 1.6 TDI CLHA, Seat León 5F 2.0 TDI CRMB, Renault Mégane IV 1.5 dCi K9K 872) con 20 aristas de provenanza.
- [`09_GAPS.md`](./09_GAPS.md): **Exploratorio**. Auditoría de carencias en fuentes gratuitas (tiempos de mano de obra europeos, matrícula a motor, pares de apriete secundarios).

---

## 3. Principales Limitaciones Identificadas
1. **Mano de Obra**: La información gratuita de mano de obra (Open Labor Project) contiene registros generados por IA (`confidence: estimated`). En BibendIA solo se admiten como evidencia directa registros con `confidence = oem_verified` o `high`.
2. **Identificación de Vehículo**: La resolución gratuita de matrícula española no garantiza el código motor exacto (`CLHA` vs `CXXB`). Se contempla la integración de API DGT/proveedor de datos de vehículo.
3. **Propiedad Intelectual**: BibendIA **derives hechos técnicos** y mantiene provenanza por relación; **no realiza extracción masiva/sistemática** para replicar bases de datos de terceros.
