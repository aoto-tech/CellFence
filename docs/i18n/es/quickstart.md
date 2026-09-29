# Inicio rápido de CellFence

> Traducción de la comunidad. La fuente en inglés es el [README de CellFence](../../../README.md).

CellFence es una herramienta determinista de control arquitectónico para repositorios modificados tanto por personas como por agentes de programación con IA. Inspecciona el estado final del repositorio e identifica desvíos arquitectónicos que las pruebas y comprobaciones de tipos habituales suelen pasar por alto:

- importaciones privadas a través de los límites entre celdas (*cells*)
- dependencias entre celdas no declaradas
- desvíos en la API pública declarada
- accesos a recursos no declarados
- modificaciones del manifiesto que autoaprueban el crecimiento arquitectónico

Por ejemplo, CellFence puede rechazar una importación procedente de la implementación privada de otra celda, incluso si el código compila y las pruebas pasan con éxito:

```ts
// src/reporting/summary.ts
import { tokenizeInternal } from "../parser/internal/tokenizer";
```

```text
CellFence check failed.
[error] CELLFENCE_PRIVATE_IMPORT src/reporting/summary.ts: reporting imports private implementation from parser
```

El contrato arquitectónico establece que los consumidores deben utilizar en su lugar la entrada pública declarada (`publicEntry`) de la celda productora, por ejemplo:

```ts
import { parseDocument } from "../parser/public";
```

## Pruébalo en sesenta segundos

En un directorio vacío:

```bash
npm install --save-dev cellfence
npx cellfence init                              # writes cellfence.manifest.json
mkdir -p src/example
echo 'export const example = 1;' > src/example/public.ts
npx cellfence check
```

La salida esperada es:

```text
CellFence check passed.
```

El comando `init` genera un manifiesto inicial con una celda `example` que posee `src/example/**`. Cámbiale el nombre, añade las celdas reales de tu proyecto y vuelve a ejecutar `check` hasta que el límite arquitectónico describa tu diseño correctamente.

Para automatizaciones no destructivas, `init --no-scaffold` rechaza este ejemplo vacío como alternativa de respaldo (*fallback*), en lugar de generar un manifiesto que apunte a archivos inexistentes.

## Pruébalo en un repositorio existente

En un repositorio que ya contiene archivos de código fuente:

```bash
npm install --save-dev cellfence
npx cellfence init --no-scaffold
npx cellfence check --format markdown
```

El parámetro `init --no-scaffold` intenta inferir la estructura real del repositorio sin crear archivos de marcador de posición (*placeholders*). Si no puede inferir una estructura confiable, finaliza en lugar de presentar un manifiesto inicial como si fuera una configuración completa.

Revisa el archivo `cellfence.manifest.json` generado **antes** de confirmarlo (*commit*). Los manifiestos inferidos son un punto de partida, no una garantía de que se hayan capturado todos los límites arquitectónicos deseados.

Cuando la comprobación local coincida con la arquitectura que deseas aplicar, decide si el primer paso de CI debe ejecutar `check` estándar, `check --changed --base origin/main` o `baseline check` con un archivo `cellfence.baseline.json` revisado. Para más detalles, consulta la [guía de CI](../../ci.md).

## Límites y próximos pasos

CellFence se encuentra actualmente en fase **previa al lanzamiento v0.x** (*pre-release*), por lo que los esquemas y las opciones de línea de comandos (CLI) pueden cambiar entre versiones secundarias. Requiere **Node.js ≥ 20**.

La herramienta ofrece un análisis estático más exhaustivo para TypeScript/JavaScript, junto con un soporte específico y limitado para Python y patrones seleccionados de recursos. No puede demostrar todo comportamiento dinámico ni resolver cualquier importación calculada en tiempo de ejecución.

CellFence **no es un entorno de aislamiento en tiempo de ejecución (*runtime sandbox*) ni un sistema de permisos para llamadas a herramientas (*tool calls*)**. Tampoco garantiza que el código generado sea funcionalmente correcto. Complementa —no reemplaza— las pruebas, el análisis estático (*linting*), la verificación de tipos (*type checking*), las ramas protegidas y la revisión de código por pares (*code review*).

Consulta la lista completa de [limitaciones actuales](../../limitations.md) y la [guía de CI](../../ci.md) antes de utilizarlo como una verificación requerida en un proyecto real.
