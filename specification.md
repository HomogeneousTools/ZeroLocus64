# ZeroLocus64 format specification v1

## Status

This document defines Version 1 of the ZeroLocus64 encoding format for zero loci of completely reducible vector bundles on partial flag varieties. It is intended to be read as an RFC-like specification for the wire format and canonicalization rules.

## 1. Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted in their ordinary specification sense.

A sextet means exactly one 6-bit quantity. One ZeroLocus64 digit stores one sextet.

## 2. Scope

ZeroLocus64 encodes two pieces of data:

- an ambient product of irreducible Dynkin factors with chosen parabolic nodes;
- a direct sum of bundle summands, where each summand is given by one highest-weight vector per ambient factor.

These two pieces are written as the ambient part, optionally followed by the separator `.` and then the bundle part.

The format is canonical. Two inputs representing the same ambient product and bundle up to the permitted reorderings MUST encode to the same label after canonicalization.

## 3. Data model

### 3.1 Ambient factors

One ambient factor is a triple `(group, rank, mask)` where:

- `group` is one of `A`, `B`, `C`, `D`, `E`, `F`, `G`;
- `rank` is the Dynkin rank, constrained by the classification $\mathrm{A}_r$ for $r \ge 1$, $\mathrm{B}_r$ for $r \ge 2$, $\mathrm{C}_r$ for $r \ge 3$, $\mathrm{D}_r$ for $r \ge 4$, together with $\mathrm{E}_6$, $\mathrm{E}_7$, $\mathrm{E}_8$, $\mathrm{F}_4$, and $\mathrm{G}_2$;
- `mask` is a positive bitmask whose bit `j` marks Dynkin node `j + 1`.

The marked parabolic nodes of a factor are therefore the 1-based node indices corresponding to the set bits of `mask`.

When exactly one node is marked, the factor is a generalized Grassmannian. Ordinary Grassmannians are the type `A` examples with a single marked node.

### 3.2 Bundle summands

Let the ambient be a product of factors `X_1 x ... x X_m`, where factor `X_i` has Dynkin rank `r_i`. One direct summand contributes one highest-weight coefficient vector

$\lambda^{(i)} \in \mathbf{Z}_{\ge 0}^{r_i}$

for each factor `X_i`. ZeroLocus64 flattens one summand row by concatenating these vectors in ambient order to produce one coefficient vector of length $W = \sum_i r_i$.

## 4. Alphabet and syntax

ZeroLocus64 uses unpadded Base64URL sextet values but displays them with the digit-first alphabet

```text
0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_
```

instead of the RFC 4648 display alphabet

```text
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_
```

This is a presentation-layer permutation of ordinary Base64URL digits. The reference implementations convert between the RFC 4648 alphabet and the ZeroLocus64 alphabet when calling standard library encoders and decoders.

The character `.` is reserved as the ambient-bundle separator and MUST NOT appear as a data digit.

Every label has exactly one of the following schematic forms:

```text
<ambient>
<ambient>.<bundle>
```

The ambient part MUST be non-empty. If `.` is present, the bundle part MUST also be non-empty.

## 5. Fixed-width sextet integers

A width-`w` field is a string of exactly `w` ZeroLocus64 digits and therefore stores an integer in the range

$$
0 \le n < 64^w.
$$

The format uses these fixed-width fields in several places. The helper names `encode_sextets` and `decode_sextets` in the reference implementations refer to this fixed-width conversion.

## 6. Canonicalization

Canonicalization is part of the format definition, not an optional implementation detail.

To canonicalize an input `(factors, summands)`:

1. sort the ambient factors by their encoded ambient factor strings;
2. partition the sorted ambient factors into maximal equal-factor blocks;
3. consider every ambient order obtained by independently permuting each equal-factor block and leaving distinct-factor order fixed;
4. for each such ambient order, reorder every bundle summand accordingly, encode each summand row, sort those summand encodings lexicographically, and compute the resulting tuple of encoded row strings;
5. choose the ambient order whose sorted tuple is lexicographically minimal;
6. apply that ambient order;
7. sort the summand rows by their encoded row strings.

There is no exhaustive search across distinct ambient factors. Only equal-factor blocks are permuted.

## 7. Ambient encoding

### 7.1 Standard type table

The standard ambient type table is, in order:

```text
A1..A16, B2..B16, C3..C16, D4..D16, E6, E7, E8, F4, G2
```

The sextet value `0` is reserved as the escape digit. The remaining 63 digits are assigned to the 63 entries of the standard table in order.

### 7.2 Standard factors

For a standard factor, the encoding is

```text
factor = type_digit + mask_digits
```

where `mask_digits` is the fixed-width encoding of `mask - 1`. Its width is

$$
w = \min \{ k \ge 0 : 64^k > 2^r - 2 \},
$$

where `r` is the Dynkin rank.

Rank `1` has width `0`, so `A1 / P1` is encoded as `1`.

### 7.3 Escaped factors

Mathematically valid factors not in the standard table use the escape form

```text
0 <group> <rank_len> <rank> <mask_digits>
```

where:

- `<group>` is the Dynkin type character;
- `<rank>` is encoded as the shortest non-empty sextet string representing the positive rank;
- `<rank_len>` is one sextet giving the number of digits used by `<rank>`;
- `<mask_digits>` is the fixed-width encoding of `mask - 1` using the same width formula as above.

Since the standard table already contains all valid exceptional types, the escape form can occur only for the classical families $\mathrm{A}_r$, $\mathrm{B}_r$, $\mathrm{C}_r$, and $\mathrm{D}_r$ with $r > 16$.

Examples:

```text
A16 / P1  ->  G000
A17 / P1  ->  0A1H000
```

## 8. Bundle encoding

### 8.1 One summand row

Let one summand row flatten to digits

```text
d_0, d_1, ..., d_{W-1}
```

where `W` is the total ambient Dynkin rank.

Define the base

$$
B = \max(2, 1 + \max_j d_j)
$$

and the packed value

$$
v = \sum_{j=0}^{W-1} d_j B^{W-1-j}.
$$

Equivalently, start with `v = 0` and update `v <- v B + d_j` from left to right.

Each summand row chooses its own base `B`.

The summand row encoding is

```text
base_digit + value_digits
```

where `base_digit` is the single ZeroLocus64 digit for `B`, and `value_digits` is the fixed-width encoding of `v` using the smallest `k >= 1` such that

$$
64^k \ge B^W.
$$

The base digit MUST therefore represent an integer in the range `2..63`.

### 8.2 Multiple summands

If the bundle is a direct sum

$$
E_1 \oplus \cdots \oplus E_t,
$$

then each summand row is encoded separately. If the encoded rows are `s_1, ..., s_t`, their lexicographically sorted order `s_(1) <= ... <= s_(t)` is concatenated directly to form the bundle part:

$$
s_{(1)} \cdots s_{(t)}.
$$

The number of summands is not written explicitly. Decoding remains unambiguous because the ambient part determines `W`, and each summand begins with a base digit that determines the width of its remaining value field.

## 9. Decoding

To decode a label:

1. split once at `.` if present;
2. decode ambient factors from left to right until the ambient text is exhausted;
3. compute the total ambient rank `W`;
4. if there is no bundle part, stop;
5. read one base digit;
6. determine the width of the value field from that base and `W`;
7. decode the packed integer;
8. unpack it into `W` digits in that base;
9. split those digits by ambient-factor ranks to recover one bundle summand row;
10. repeat until the bundle text is exhausted.

## 10. Validation requirements

An implementation MUST reject at least the following malformed conditions:

- empty ambient text;
- a trailing separator with no bundle text;
- an escaped factor with an unknown Dynkin type;
- an escaped factor with a mathematically impossible Dynkin type/rank pair;
- an escaped factor with a non-positive encoded rank length;
- truncated escaped rank digits;
- truncated mask digits;
- a decoded mask outside the valid range `1 <= mask < 2^rank`;
- a bundle base digit outside the range `2..63`;
- a truncated summand field;
- a packed summand value that exceeds the valid range for its width.

## 11. Worked examples

| Object | Bundle | Label |
| --- | --- | --- |
| $\mathbb{P}^1 = \mathrm{A}_1 / \mathrm{P}_1$ | ambient only | `1` |
| $\mathbb{P}^1$ | $\mathcal{O}(1)$ | `1.21` |
| $\mathbb{P}^1$ | $\mathcal{O} \oplus \mathcal{O}(1)$ | `1.2021` |
| $\mathbb{P}^1$ | $\mathcal{O}(1) \oplus \mathcal{O}(1)$ | `1.2121` |
| $\mathbb{P}^3 = \mathrm{A}_3 / \mathrm{P}_1$ | ambient only | `30` |
| $\mathbb{P}^3$ | $\mathcal{O}(1)$ | `30.24` |
| $\mathbb{P}^3$ | $\mathcal{O}(1) \oplus \mathcal{O}(0,0,1)$ | `30.2124` |
| $\mathrm{Gr}(2,4) = \mathrm{A}_3 / \mathrm{P}_2$ | ambient only | `31` |
| $\mathrm{Gr}(2,4)$ | weight $(1,0,0)$ | `31.24` |
| $\mathrm{Gr}(3,6) = \mathrm{A}_5 / \mathrm{P}_3$ | ambient only | `53` |
| $\mathrm{Fl}(1,3,4) = \mathrm{A}_3 / \mathrm{P}_{\{1,3\}}$ | ambient only | `34` |
| $\mathrm{Q}^5 = \mathrm{B}_3 / \mathrm{P}_1$ | ambient only | `I0` |
| $\mathrm{Q}^5$ | weight $(1,0,0)$ | `I0.24` |
| $\mathrm{B}_5 / \mathrm{B} = \mathrm{B}_5 / \mathrm{P}_{\{1,2,3,4,5\}}$ | ambient only | `KU` |
| $\mathrm{OGr}^{+}(5,10) = \mathrm{D}_5 / \mathrm{P}_5$ | ambient only | `lF` |
| $\mathrm{Freudenthal\ variety} = \mathrm{E}_7 / \mathrm{P}_7$ | ambient only | `y0_` |
| $\mathrm{A}_{16} / \mathrm{P}_1$ | ambient only | `G000` |
| $\mathrm{A}_{17} / \mathrm{P}_1$ | ambient only | `0A1H000` |
| $(\mathbb{P}^1)^5$ | $\mathcal{O}(1,1,1,1,1)$ | `11111.2V` |
| $\mathbb{P}^1 \times \mathbb{P}^1$ | $\mathcal{O}(1,1)$ | `11.23` |
| $\mathbb{P}^1 \times \mathbb{P}^1$ | $\mathcal{O}(1,0) \oplus \mathcal{O}(0,1)$ | `11.2122` |

Two direct-sum examples deserve special emphasis.

For `P^1`, the bundle `O \oplus O(1)` has row encodings `20` and `21`, so the bundle part is `2021` and the full label is `1.2021`.

For `P^1 x P^1`, the bundle `O(1,0) \oplus O(0,1)` has row encodings `22` and `21`, which sort to `21`, `22`, giving the full label `11.2122`.

## 12. Public reference API

The reference implementations of the v1 format are:

- [python/src/zerolocus64/](python/)
- [julia/src/](julia/)
- [javascript/src/](javascript/)

Tracked regression examples live in [examples.json](examples.json).

All three reference implementations expose the same conceptual operations:

- `base64url_encode(data)`
- `base64url_decode(text)`
- `canonicalize(factors, summands)`
- `encode_label(factors, summands)`
- `decode_label(label)`

All three also expose a `Factor` type representing one irreducible Dynkin factor.
