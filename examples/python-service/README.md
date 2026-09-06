# Python Service Example

This fixture shows CellFence as repository evidence governance for a Python service, not as a TypeScript-only import checker.

## Service boundary

The manifest divides the example into three cells:

```text
src/
├── api/
│   ├── public.py       # api public entry: create_app
│   └── routes.py       # consumes domain and infra
├── domain/
│   └── public.py       # domain public entry: calculate_total
└── infra/
    └── public.py       # infra public entry: Database
```

[`cellfence.manifest.json`](cellfence.manifest.json) assigns each directory to
its matching cell. The `api` cell declares that it consumes `domain` and
`infra`, and [`src/api/routes.py`](src/api/routes.py) imports both cells through
their declared public entries. The default example is therefore valid.

## Run the valid example

Use Node.js 20 or later and a Python 3 interpreter available as `python3` or
`python`. From the repository root:

```bash
npm ci
npm run build
node packages/cli/dist/index.js check \
  --root examples/python-service \
  --format markdown
```

The command exits successfully with `Result: passed` and no findings.

## Reproduce a private-import violation

The following Python script copies the example to a temporary directory,
creates a private domain module, changes the API import to target it, and runs
CellFence. The temporary copy is removed automatically; the checked-in example
is never modified.

```bash
python3 - <<'PY'
from pathlib import Path
import shutil
import subprocess
import tempfile

source = Path("examples/python-service")
with tempfile.TemporaryDirectory(prefix="cellfence-python-service-") as temp:
    target = Path(temp) / "example"
    shutil.copytree(source, target)
    (target / "src/domain/internal.py").write_text(
        "def calculate_total(items):\n    return sum(items)\n",
        encoding="utf-8",
    )
    routes = target / "src/api/routes.py"
    routes.write_text(
        routes.read_text(encoding="utf-8").replace(
            "from src.domain.public import",
            "from src.domain.internal import",
        ),
        encoding="utf-8",
    )
    result = subprocess.run([
        "node", "packages/cli/dist/index.js", "check",
        "--root", str(target), "--format", "markdown",
    ])
    assert result.returncode == 1
PY
```

The check reports `CELLFENCE_PRIVATE_IMPORT` at `src/api/routes.py:1`. Although
`api` may consume `domain`, that declaration exposes only the producer's public
entry; it does not authorize imports from `src/domain/internal.py`.

CellFence intentionally does not claim full dynamic-language soundness. It
enforces the Python ownership, import, and public-surface evidence that can be
made deterministic in CI. See [Current Limitations](../../docs/limitations.md)
for the supported Python analysis boundary.
