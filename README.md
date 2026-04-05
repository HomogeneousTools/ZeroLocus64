# ZeroLocus64

ZeroLocus64 is a compact, canonical encoding for zero loci of completely reducible vector bundles on partial flag varieties. This repository contains the v1 format specification together with independent Python and Julia reference implementations.

The canonical format definition is [specification.md](specification.md). Treat that document as the source of truth for the v1 wire format, canonicalization rules, and worked examples.

## Repository layout

- [specification.md](specification.md): RFC-like format specification.
- [examples.json](examples.json): tracked regression examples, combining hand-curated cases and corpus-derived cases in one file.
- [python](python): Python package and pytest suite.
- [julia](julia): Julia module and Julia test suite.

## Python

Install the package in editable mode from the repository root:

```text
python -m pip install -e python
```

Run the Python tests:

```text
python -m pytest python/tests
```

The public Python API is exposed from `zerolocus64`:

```python
from zerolocus64 import Factor, decode_label, encode_label

label = encode_label([Factor("A", 1, 1)], [[[1]]])
assert label == "1.21"
assert decode_label(label) == ([Factor("A", 1, 1)], [[[1]]])
```

## Julia

From Julia, develop the local package and run the tests:

```text
julia --project=julia -e 'using Pkg; Pkg.test()'
```

The public Julia API is exposed from `ZeroLocus64`:

```julia
using ZeroLocus64

label = encode_label([Factor('A', 1, 1)], [[[1]]])
@assert label == "1.21"
@assert decode_label(label) == ([Factor('A', 1, 1)], [[[1]]])
```

## Design constraints

- The Python and Julia implementations are independent reference implementations.
- Shared tracked vectors keep both languages aligned.
- The repository never requires local-only artifacts for normal installation or testing.
