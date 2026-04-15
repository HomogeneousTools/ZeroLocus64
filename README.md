# ZeroLocus62

[![Tests](https://github.com/HomogeneousTools/ZeroLocus62/actions/workflows/CI.yml/badge.svg)](https://github.com/HomogeneousTools/ZeroLocus62/actions/workflows/CI.yml)
[![Docs](https://img.shields.io/badge/docs-zl62.homogeneous.tools-blue)](https://zl62.homogeneous.tools)
[![Release](https://img.shields.io/github/v/release/HomogeneousTools/ZeroLocus62?color=green)](https://github.com/HomogeneousTools/ZeroLocus62/releases)

ZeroLocus62 is a compact, canonical encoding for zero loci of completely reducible vector bundles on partial flag varieties. This repository contains the v1.1 format specification together with independent Python, Julia, and JavaScript reference implementations, plus a small browser-based decoder website.

The canonical format definition is [specification.md](specification.md). Treat that document as the source of truth for the v1.1 wire format, canonicalization rules, and worked examples.

## Repository layout

- [specification.md](specification.md): RFC-like format specification.
- [examples.json](examples.json): tracked regression examples, combining hand-curated cases and corpus-derived cases in one file.
- [python](python): Python package and pytest suite.
- [julia](julia): Julia module and Julia test suite.
- [javascript](javascript): JavaScript package, Node test suite, and website build or preview scripts.
- [website](website): static two-page site for browsing the specification and decoding labels.

## Reference API

The reference implementations of the v1.1 format are:

- [python/src/zerolocus62/](python/src/zerolocus62/)
- [julia/src/](julia/src/)
- [javascript/src/](javascript/src/)

All three implementations expose the same conceptual operations:

- `canonicalize(factors, summands)`
- `encode_label(factors, summands)`
- `decode_label(label)`
- `is_canonical(label)`

All three also expose a `Factor` type representing one irreducible Dynkin factor. Tracked regression examples live in [examples.json](examples.json).

## Python

Install the package in editable mode from the repository root:

```text
python -m pip install -e python
```

Run the Python tests:

```text
python -m pytest python/tests
```

The public Python API is exposed from `zerolocus62`:

```python
from zerolocus62 import Factor, decode_label, encode_label

label = encode_label([Factor("A", 1, 1)], [[[1]]])
assert label == "1.21"
assert decode_label(label) == ([Factor("A", 1, 1)], [[[1]]])
```

## Julia

From Julia, develop the local package and run the tests:

```text
julia --project=julia -e 'using Pkg; Pkg.test()'
```

The public Julia API is exposed from `ZeroLocus62`:

```julia
using ZeroLocus62

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

The public JavaScript API is exposed from `zerolocus62`:

```js
import { Factor, decodeLabel, encodeLabel } from "zerolocus62";

const label = encodeLabel([new Factor("A", 1, 1)], [[[1]]]);
console.assert(label === "1.21");

const [factors, summands] = decodeLabel(label);
console.assert(factors[0].group === "A");
console.assert(summands[0][0][0] === 1);
```

## Website

Build the static GitHub Pages artifact:

```text
npm --prefix javascript run build:site
```

Preview the same artifact locally:

```text
npm --prefix javascript run site
```

Then open `http://localhost:4173` for the decoder and `http://localhost:4173/specification` for the rendered specification.

Deployment to GitHub Pages is handled by [.github/workflows/pages.yml](.github/workflows/pages.yml).

## Design constraints

- The Python, Julia, and JavaScript implementations are independent reference implementations.
- Shared tracked vectors keep both languages aligned.
- The repository never requires local-only artifacts for normal installation or testing.
