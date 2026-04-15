# zerolocus62

This directory contains the JavaScript reference implementation of the ZeroLocus62 v1.1 format.

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

const [factors, summands] = decodeLabel(label);
console.assert(factors[0].group === "A");
console.assert(summands[0][0][0] === 1);
```

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
