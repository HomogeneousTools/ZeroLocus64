# ZeroLocus62.m2

This directory contains a Macaulay2 package version of the ZeroLocus62 codec.

The package file is [ZeroLocus62.m2](./ZeroLocus62.m2). Add this directory to `path` and load it as a regular Macaulay2 package:

```text
M2 -q -e 'path = prepend("macaulay2", path); loadPackage "ZeroLocus62"; print encodeLabel({Factor("A",1,1)}, {{{1}}}); exit 0'
```

Run the package self-tests:

```text
M2 -q -e 'path = prepend("macaulay2", path); loadPackage "ZeroLocus62"; check ZeroLocus62; exit 0'
```

As in the other implementations, a one-bundle label canonically describes the encoded bundle itself, not only a possible zero locus, so signed rows such as `encodeLabel({Factor("A",1,1)}, {{{-1}}}) == "1.z220"` are valid.

The repository-level overview is in [../README.md](../README.md), and the canonical format specification is in [../specification.md](../specification.md).
