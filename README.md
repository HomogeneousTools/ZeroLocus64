# ZeroLocus62

[![Tests](https://github.com/HomogeneousTools/ZeroLocus62/actions/workflows/CI.yml/badge.svg)](https://github.com/HomogeneousTools/ZeroLocus62/actions/workflows/CI.yml)
[![Docs](https://img.shields.io/badge/docs-zl62.homogeneous.tools-blue)](https://zl62.homogeneous.tools)
[![Release](https://img.shields.io/github/v/release/HomogeneousTools/ZeroLocus62?color=green)](https://github.com/HomogeneousTools/ZeroLocus62/releases)

ZeroLocus62 is a compact, canonical encoding for bundles, zero loci, and degeneracy loci of completely reducible vector bundles on partial flag varieties. A label with one bundle part can always be read as a canonical description of the underlying bundle itself, even when no zero-locus interpretation is intended or the bundle is not globally generated. This repository contains the v3.1.1 specification release for the v3.1 format together with independent Python, Julia, JavaScript, and Macaulay2 reference implementations, plus a small browser-based decoder website.

The canonical format definition is [specification.md](specification.md). Treat that document as the source of truth for the v3.1 wire format, canonicalization rules, and worked examples.

## Repository layout

- [specification.md](specification.md): RFC-like format specification.
- [examples.json](examples.json): tracked regression examples, combining hand-curated cases and corpus-derived cases in one file.
- [python](python): Python package and pytest suite.
- [julia](julia): Julia module and Julia test suite.
- [javascript](javascript): JavaScript package, Node test suite, and website build or preview scripts.
- [macaulay2](macaulay2): Macaulay2 package implementation and package self-tests.
- [website](website): static two-page site for browsing the specification and decoding labels.

## Reference API

The reference implementations in the v3.1.1 release of the v3.1 format are:

- [python/src/zerolocus62/](python/src/zerolocus62/)
- [julia/src/](julia/src/)
- [javascript/src/](javascript/src/)
- [macaulay2/ZeroLocus62.m2](macaulay2/ZeroLocus62.m2)

The Python, Julia, and JavaScript implementations expose the same conceptual operations:

- `canonicalize(factors, summands)`
- `encode_label(factors, summands)`
- `decode_label(label)`
- `is_canonical(label)`

The Macaulay2 package exposes the analogous operations as `canonicalize`, `encodeLabel`, `decodeLabel`, `isCanonical`, plus `Factor` and `markedNodes`. Tracked regression examples live in [examples.json](examples.json).

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
assert label == "1.0"
assert decode_label(label)["summands"] == [[[1]]]
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
@assert label == "1.0"
@assert decode_label(label).summands == [[[1]]]
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
console.assert(label === "1.0");

const result = decodeLabel(label);
console.assert(result.factors[0].group === "A");
console.assert(result.summands[0][0][0] === 1);
```

## Macaulay2

Load the local Macaulay2 package from the repository root:

```text
M2 -q -e 'path = prepend("macaulay2", path); loadPackage "ZeroLocus62"; print encodeLabel({Factor("A",1,1)}, {{{1}}}); exit 0'
```

Run the Macaulay2 package checks:

```text
M2 -q -e 'path = prepend("macaulay2", path); loadPackage "ZeroLocus62"; check ZeroLocus62; exit 0'
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

## Version history

- **v1** — Initial encoding for zero loci of completely reducible vector bundles on partial flag varieties.
- **v1.1** — Switched the character alphabet to Base62 (`0–9A–Za–z`), enabling lexicographic ordering by encoded string.
- **v2.0** — Extended the format to encode degeneracy loci: a label may now encode two bundles and a rank bound in addition to a zero locus or ambient-only label.
- **v2.1** — Added signed bundle coefficients and made the bundle-only interpretation explicit: one-bundle labels canonically describe bundles on partial flag varieties even when they are not globally generated.
- **v2.2** — Replaced v2.1's equal-factor permutation minimum with a self-contained graph-certificate canonicalization. No external canonization tool is required, but some canonical labels change.

  Examples of the v2.1 → v2.2 change:
  - `(P^1)^3`, `O(0,0,1) + O(0,2,0)`: `111.2136` → `111.2232`
  - `(P^1)^3`, `O(-1,-1,-1) + O(-1,-1,0)`: `111.123127` → `111.126127`

- **v3** — Replaced the old dense/base-descriptor bundle-row format by a sparse row codec optimized for small positive coefficients. The ambient encoding and graph-certificate canonicalization are unchanged, but many bundle labels become substantially shorter.
- **v3.1** — Replaced graph-certificate canonicalization with a coefficient-row multiset rule. Equal ambient factors are disambiguated by lexicographically minimizing sorted flattened coefficient rows, and summands are emitted in coefficient-vector order.
- **v3.1.1** — Clarified the exact implementation requirements for the existing v3.1 canonicalization rule and updated the reference implementations accordingly. This patch release does not change the v3.1 wire format.
