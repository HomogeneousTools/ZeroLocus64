# zerolocus62

This directory contains the JavaScript reference implementation of the ZeroLocus62 v2.1 format.

The repository-level overview is in [../README.md](../README.md), and the canonical format specification is in [../specification.md](../specification.md).

## Install

Install the local package from the repository root:

```text
npm install ./javascript
```

Or develop against the directory directly:

```text
npm --prefix javascript install
```

## Test

Run the JavaScript regression suite:

```text
npm --prefix javascript test
```

## Usage

```js
import { Factor, decodeLabel, encodeLabel } from "zerolocus62";

const label = encodeLabel([new Factor("A", 1, 1)], [[[1]]]);
console.assert(label === "1.21");

const result = decodeLabel(label);
console.assert(result.factors[0].group === "A");
console.assert(result.summands[0][0][0] === 1);
```

As in the specification, a one-bundle label is also a canonical descriptor of the encoded bundle itself, not only of a prospective zero locus, so signed rows such as `encodeLabel([new Factor("A", 1, 1)], [[[-1]]]) === "1.121"` are valid.

## Website

Build the static site artifact used by GitHub Pages:

```text
npm --prefix javascript run build:site
```

Preview the same static artifact locally:

```text
npm --prefix javascript run site
```

Then open `http://localhost:4173`.

The repository publishes this artifact through the GitHub Pages workflow in [../.github/workflows/pages.yml](../.github/workflows/pages.yml).
