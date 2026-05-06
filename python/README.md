# zerolocus62

This directory contains the Python reference implementation of the ZeroLocus62 v3.1 format.

The repository-level overview is in [../README.md](../README.md), and the canonical format specification is in [../specification.md](../specification.md).

## Install

Install the package in editable mode from the repository root:

```text
python -m pip install -e python
```

## Test

Run the Python regression suite:

```text
python -m pytest python/tests
```

## Usage

```python
from zerolocus62 import Factor, decode_label, encode_label

label = encode_label([Factor("A", 1, 1)], [[[1]]])
assert label == "1.0"
assert decode_label(label)["summands"] == [[[1]]]
```

One-bundle labels can be used as canonical descriptions of bundles on partial flag varieties even when the bundle is not globally generated, so negative coefficients such as `encode_label([Factor("A", 1, 1)], [[[-1]]]) == "1.z220"` are valid.
