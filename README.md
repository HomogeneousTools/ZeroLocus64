# ZeroLocus64

[![Tests](https://github.com/HomogeneousTools/ZeroLocus64/actions/workflows/CI.yml/badge.svg)](https://github.com/HomogeneousTools/ZeroLocus64/actions/workflows/CI.yml)

ZeroLocus64 is a compact, canonical encoding for zero loci of completely reducible vector bundles on partial flag varieties. This repository contains the v1 format specification together with independent Python, Julia, and JavaScript reference implementations, plus a small browser-based decoder website.

The canonical format definition is [specification.md](specification.md). Treat that document as the source of truth for the v1 wire format, canonicalization rules, and worked examples.

## Repository layout

- [specification.md](specification.md): RFC-like format specification.
- [examples.json](examples.json): tracked regression examples, combining hand-curated cases and corpus-derived cases in one file.
- [python](python): Python package and pytest suite.
- [julia](julia): Julia module and Julia test suite.
- [javascript](javascript): JavaScript package, Node test suite, and website build or preview scripts.
- [website](website): static two-page site for browsing the specification and decoding labels.

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

## JavaScript

Install the local JavaScript package from the repository root:

```text
npm install ./javascript
```

Run the JavaScript tests:

```text
npm --prefix javascript test
```

The public JavaScript API is exposed from `zerolocus64`:

```js
import { Factor, decodeLabel, encodeLabel } from "zerolocus64";

const label = encodeLabel([new Factor("A", 1, 1)], [[[1]]]);
console.assert(label === "1.21");

const [factors, summands] = decodeLabel(label);
console.assert(factors[0].group === "A");
console.assert(summands[0][0][0] === 1);
```

## Design constraints

- The Python, Julia, and JavaScript implementations are independent reference implementations.
- Shared tracked vectors keep both languages aligned.
- The repository never requires local-only artifacts for normal installation or testing.
