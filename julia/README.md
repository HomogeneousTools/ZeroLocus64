# ZeroLocus62.jl

This directory contains the Julia reference implementation of the ZeroLocus62 v2 format.

The repository-level overview is in [../README.md](../README.md), and the canonical format specification is in [../specification.md](../specification.md).

## Install

Develop the local package from the repository root:

```text
julia -e 'using Pkg; Pkg.develop(path="julia")'
```

## Test

Run the Julia regression suite:

```text
julia --project=julia -e 'using Pkg; Pkg.instantiate(); Pkg.test()'
```

## Usage

```julia
using ZeroLocus62

label = encode_label([Factor('A', 1, 1)], [[[1]]])
@assert label == "1.21"
@assert decode_label(label) == ([Factor('A', 1, 1)], [[[1]]])
```
