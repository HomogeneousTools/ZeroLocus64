# ZeroLocus62 format specification v3.1.1

## Status

This document defines Specification Version 3.1.1 of ZeroLocus62. The wire format and canonicalization rule remain the v3.1 format for zero loci and degeneracy loci of completely reducible vector bundles on partial flag varieties; v3.1.1 clarifies exact implementation requirements for that rule. It is intended to be read as an RFC-like specification for the wire format and canonicalization rules.

## 1. Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted in their ordinary specification sense.

A character means exactly one element of the Base62 alphabet.

## 2. Scope

ZeroLocus62 encodes bundles and geometric loci on products of partial flag varieties. A label always begins with an ambient part describing the factors of the ambient product. There are three kinds of label:

1. **Ambient only.** The label encodes just the ambient product, with no locus data.
2. **Zero locus / bundle label.** The label encodes the ambient product together with a single non-zero completely reducible vector bundle $E$. It may be read either as a canonical descriptor of the bundle $E$ itself, or, when that interpretation is intended, as the zero locus of a general global section of $E$.
3. **Degeneracy locus.** The label encodes the ambient product together with two non-zero completely reducible vector bundles $E$ and $F$, plus a non-negative integer rank bound $k$. The geometric object is the $k$-th degeneracy locus of a general morphism $\varphi \colon E \to F$.

The zero-bundle case for a zero locus is represented by the ambient-only form, not by an empty locus part.

The codec does not encode or validate whether a one-bundle label should be interpreted geometrically as a zero locus. In particular, it does not test global generation or any other hypothesis needed for a section-theoretic interpretation. A one-bundle label therefore remains valid as a bundle descriptor even when no zero locus is intended.

The format is canonical. Two inputs representing the same ambient product and locus data up to the permitted reorderings MUST encode to the same label after canonicalization.

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

$\lambda^{(i)} \in \mathbf{Z}^{r_i}$

for each factor `X_i`.

To represent one summand as a flat array, ZeroLocus62 concatenates these $m$ coefficient vectors in ambient factor order:

$$d = (\lambda^{(1)}_1, \ldots, \lambda^{(1)}_{r_1},\ \lambda^{(2)}_1, \ldots, \lambda^{(2)}_{r_2},\ \ldots,\ \lambda^{(m)}_1, \ldots, \lambda^{(m)}_{r_m}).$$

The result is a single sequence of integers of total length $W = \sum_i r_i$, called the summand row. All bundle-row arithmetic in §8 operates on this flat sequence: support positions are chosen in this order, direct row codes are indexed in this order, and packed payloads use this order.

An encoder MUST reject any summand whose structure does not match the ambient: each summand row MUST contain exactly one weight vector per ambient factor, and each weight vector MUST have length equal to that factor's Dynkin rank.

Example: on $\mathbb{P}^1 \times \mathbb{P}^1$ (two factors of type $\mathrm{A}_1$, each of rank 1, so $W = 2$), the summand $\mathcal{O}(1, 0)$ has coefficient vectors $(1)$ and $(0)$, which flatten to the row $(1, 0)$.

This format treats such rows purely as bundle data. No positivity, dominance on marked nodes, or global-generation condition is required by the codec beyond the structural checks stated here and in §10.

### 3.3 Degeneracy locus data

A degeneracy locus is specified by a triple $(E, F, k)$ where:

- $E$ is a completely reducible vector bundle on the ambient product, represented as a list of summand rows exactly as in §3.2;
- $F$ is a second completely reducible vector bundle on the same ambient product, also represented as a list of summand rows;
- $k$ is a non-negative integer, the rank bound.

The geometric meaning is the $k$-th degeneracy locus

$$D_k(\varphi) = \{ x : \operatorname{rank} \varphi(x) \le k \}$$

of a general morphism $\varphi \colon E \to F$.

The bundles $E$ and $F$ are not interchangeable: the morphism has a definite source and target, so the encoding preserves their order.

The format does not validate whether $k$ is mathematically meaningful for the given bundles $E$ and $F$ (e.g. whether $k < \min(\operatorname{rank} E, \operatorname{rank} F)$), because computing vector bundle ranks from highest weights requires representation-theoretic data beyond the scope of this codec.

## 4. Alphabet and syntax

ZeroLocus62 uses the 62-character lexicographic alphabet:

```text
0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz
```

This is the standard Base62 alphabet, with numerals first, then uppercase letters, then lowercase letters, in ASCII order.

The character `.` is reserved as the ambient-locus separator and MUST NOT appear as a data character.

The character `-` is reserved as the intra-locus separator for degeneracy loci and MUST NOT appear as a data character.

The 62 alphanumeric characters are all safe in URLs and filenames without percent-encoding. This format does not include an in-band version identifier. In particular, v3 and v3.1 bundle rows are not designed to be decoded by v2.2 implementations, so version selection is an out-of-band concern.

Every label has exactly one of the following schematic forms:

```text
<ambient>
<ambient>.<bundle>
<ambient>.<bundle_E>-<bundle_F>-<k>
```

The ambient part MUST be non-empty. If `.` is present, the locus part (everything after the `.`) MUST also be non-empty. A label MUST contain at most one `.` separator.

In the zero-locus form, the locus part contains no `-` characters. Every character in both the ambient part and the locus part MUST be a member of the Base62 alphabet.

In the degeneracy-locus form, the locus part contains exactly two `-` characters, which divide it into three segments: `<bundle_E>`, `<bundle_F>`, and `<k>`. All three segments MUST be non-empty. Every character within each segment MUST be a member of the Base62 alphabet.

A locus part containing any number of `-` characters other than 0 or 2 is malformed and MUST be rejected.

A label without the `.` separator encodes only the ambient product; no bundle data is represented. This is distinct from encoding a bundle whose summand rows all have zero coefficients, which requires the `.` separator and an explicit locus part.

## 5. Fixed-width character integers

A width-`w` field is a string of exactly `w` ZeroLocus62 characters and therefore stores an integer in the range

$$
0 \le n < 62^w.
$$

The format uses these fixed-width fields in several places. The helper names `encode_characters` and `decode_characters` in the reference implementations refer to this fixed-width conversion.

Implementations MUST use integer arithmetic of sufficient precision to exactly represent all intermediate values arising from the width and packing computations. In particular, mask values up to $2^r - 1$, packed summand values up to $B^W - 1$, and width expressions involving $62^k$ MUST be computed exactly.

## 6. Canonicalization

Canonicalization is part of the format definition, not an optional implementation detail.

### 6.1 Definition

A label is **canonical** if and only if it is produced by the following ordered criteria:

1. The ambient factors are sorted by their encoded factor strings in ascending code-unit order.
2. The remaining ambiguity among equal encoded ambient factors is resolved by the coefficient-row multiset rule of §6.2.
3. After the ambient factor order is fixed, each group of summand rows is sorted by its flattened coefficient vector in ascending lexicographic order.

The v3.1 canonicalization rule intentionally replaces the v2.2/v3 graph-certificate rule. Some labels that were canonical in v3 are not canonical in v3.1.

### 6.2 Equal-factor coefficient-row certificate

After the initial ambient-factor sort of §6.1(1), only equal encoded ambient factors may still be permuted. Let the initially sorted ambient product be

```text
X_1 x ... x X_m
```

and let `code(i)` be the encoded ambient factor string of `X_i`.

An ambient permutation `pi` is **admissible** if and only if it preserves ambient factor codes:

```text
code(i) = code(pi(i)) for every i.
```

Equivalently, `pi` is a product of permutations inside the maximal contiguous blocks of equal encoded ambient factors.

For a summand row `r`, define `flat_pi(r)` to be the integer tuple obtained by first permuting the factor entries of `r` by `pi`, then concatenating the highest-weight vectors in the resulting ambient factor order.

Tuples of integers are compared lexicographically using the usual total order on integers. Thus negative coefficients sort before zero coefficients, and zero coefficients sort before positive coefficients at the first differing position.

For a bundle `E` with rows `r_1, ..., r_t`, define its row certificate under `pi` to be

```text
C_E(pi) = sort_lex(flat_pi(r_1), ..., flat_pi(r_t)).
```

This sorted list is a multiset written in canonical order. Equal rows remain present with their multiplicity.

For a one-bundle label, the canonical ambient permutation is any admissible `pi` minimizing `C_E(pi)` lexicographically as a finite list of integer tuples.

For a degeneracy-locus label with source bundle `E`, target bundle `F`, and rank bound `k`, the canonical ambient permutation is any admissible `pi` minimizing

```text
(C_E(pi), C_F(pi)).
```

The rank bound `k` is not part of this minimization because it is invariant under ambient factor permutations. The source and target bundles are not interchangeable.

After choosing a minimizing `pi`, each bundle is emitted in the row order given by its corresponding certificate. If several admissible permutations have the same minimum certificate, any of them MAY be chosen: the ambient factor strings are equal within each permuted block, and the sorted row certificates are identical, so the emitted label is identical.

### 6.3 Correctness

The admissible permutations form a finite set. The row certificate for each candidate is a finite list of finite integer tuples. Lexicographic order on integers is total; therefore lexicographic order on equal-length tuples is total, and lexicographic order on finite lists of those tuples is total.

Consequently, a minimum certificate exists. If the minimum is achieved by more than one admissible ambient permutation, the emitted ambient text and sorted bundle rows are identical. The rule therefore produces a unique canonical label.

Version 3.1 does not require canonical labels for row vertices. Direct summands form a multiset, so permuting equal rows has no observable effect and MUST NOT force any backtracking over indistinguishable row vertices.

### 6.4 Implementation notes

For a one-bundle label with exactly one summand, the equal-factor rule has a simple exact fast path: after the initial ambient-factor sort, sort the factor slices inside each equal-factor block lexicographically. This produces the same minimum certificate as the full admissible-permutation rule because the row certificate contains only one flattened coefficient tuple.

Implementations MUST NOT generalize that fast path to multiple summands by sorting each equal factor by a local column signature or by pruning solely on sorted row-prefix certificates. Row sorting can make a candidate with a larger one-column prefix produce a smaller full certificate after later coefficients are considered. For example, on `P^1 x P^1` with rows `(0,2)` and `(1,0)`, the true canonical order gives rows `(0,1)` and `(2,0)`, even though the opposite first-column prefix is lexicographically smaller.

The reference implementations avoid eager factorial enumeration for the general case by dynamic programming over ordered row partitions. A partial factor order partitions each bundle's rows by their equal flattened prefix; for a candidate next factor, the implementation refines those row partitions and recursively chooses the best suffix. This is exact because, once a prefix partition is fixed, later lexicographic comparisons are made independently inside those ordered prefix classes before moving to later classes. Implementations MAY use any algorithm that returns the same minimum certificate, but SHOULD avoid enumerating all permutations of large equal-factor blocks.

### 6.5 Ordering conventions

String comparisons in this specification, including ambient factor sorting and row-code tie-breaking inside the row codec, use ascending code-unit order of encoded strings.

Code-unit order means: compare two strings position by position from left to right; the first position where they differ determines the order, and the string with the smaller character value at that position is smaller. For strings of unequal length that agree up to the shorter length, the shorter string is smaller.

Because all 62 characters of the ZeroLocus62 alphabet are ASCII, the code-unit value of each character is simply its ASCII byte value. The alphabet order — numerals `0`–`9` (0x30–0x39, values 0–9), uppercase `A`–`Z` (0x41–0x5A, values 10–35), lowercase `a`–`z` (0x61–0x7A, values 36–61) — agrees exactly with ASCII byte order. Consequently, lexicographic comparison of any two encoded strings by Base62 value gives the same result as standard byte-wise string comparison.

Integer tuple comparisons in §6.2 use the ordinary integer order, not the encoded row-string order.

### 6.6 Canonical validation

A decoded label MUST be in canonical form.

- For an ambient-only label, decode the label into `factors`, re-encode those factors as an ambient-only label, and verify that the result matches the original input byte for byte.
- For a zero-locus label, decode the label into `(factors, summands)`, re-encode that zero-locus data, and verify that the result matches the original input byte for byte.
- For a degeneracy-locus label, decode the label into `(factors, E_summands, F_summands, k)`, re-encode that degeneracy-locus data, and verify that the result matches the original input byte for byte.

If the re-encoded label does not match the original input byte for byte, the implementation MUST reject it.

## 7. Ambient encoding

### 7.1 Standard type table

The standard ambient type table is, in order:

```text
A1..A15, B2..B15, C3..C15, D4..D15, E6, E7, E8, F4, G2
```

The character value `0` is reserved as the escape character. The remaining 59 characters are assigned to the 59 entries of the standard table in order. In the ambient part, all 60 alphanumeric non-zero characters may therefore occur. In the bundle part, the row lead characters `w`, `x`, `y`, and `z` have special meanings defined in §8.

Here w denotes the mask width. The five column groups correspond to Lie types A, B, C, D, and the remaining types E, F, G (all three of which appear in the standard table).

| **A** · Char | Type | Rank | w   |     | **B** · Char | Type | Rank | w   |     | **C** · Char | Type | Rank | w   |     | **D** · Char | Type | Rank | w   |     | **EFG** · Char | Type | Rank | w   |
| ------------ | ---- | ---- | --- | --- | ------------ | ---- | ---- | --- | --- | ------------ | ---- | ---- | --- | --- | ------------ | ---- | ---- | --- | --- | -------------- | ---- | ---- | --- |
| `1`          | A    | 1    | 0   |     |              |      |      |     |     |              |      |      |     |     |              |      |      |     |     | `t`            | E    | 6    | 2   |
| `2`          | A    | 2    | 1   |     | `G`          | B    | 2    | 1   |     |              |      |      |     |     |              |      |      |     |     | `u`            | E    | 7    | 2   |
| `3`          | A    | 3    | 1   |     | `H`          | B    | 3    | 1   |     | `U`          | C    | 3    | 1   |     |              |      |      |     |     | `v`            | E    | 8    | 2   |
| `4`          | A    | 4    | 1   |     | `I`          | B    | 4    | 1   |     | `V`          | C    | 4    | 1   |     | `h`          | D    | 4    | 1   |     | `w`            | F    | 4    | 1   |
| `5`          | A    | 5    | 1   |     | `J`          | B    | 5    | 1   |     | `W`          | C    | 5    | 1   |     | `i`          | D    | 5    | 1   |     | `x`            | G    | 2    | 1   |
| `6`          | A    | 6    | 2   |     | `K`          | B    | 6    | 2   |     | `X`          | C    | 6    | 2   |     | `j`          | D    | 6    | 2   |     |                |      |      |     |
| `7`          | A    | 7    | 2   |     | `L`          | B    | 7    | 2   |     | `Y`          | C    | 7    | 2   |     | `k`          | D    | 7    | 2   |     |                |      |      |     |
| `8`          | A    | 8    | 2   |     | `M`          | B    | 8    | 2   |     | `Z`          | C    | 8    | 2   |     | `l`          | D    | 8    | 2   |     |                |      |      |     |
| `9`          | A    | 9    | 2   |     | `N`          | B    | 9    | 2   |     | `a`          | C    | 9    | 2   |     | `m`          | D    | 9    | 2   |     |                |      |      |     |
| `A`          | A    | 10   | 2   |     | `O`          | B    | 10   | 2   |     | `b`          | C    | 10   | 2   |     | `n`          | D    | 10   | 2   |     |                |      |      |     |
| `B`          | A    | 11   | 2   |     | `P`          | B    | 11   | 2   |     | `c`          | C    | 11   | 2   |     | `o`          | D    | 11   | 2   |     |                |      |      |     |
| `C`          | A    | 12   | 3   |     | `Q`          | B    | 12   | 3   |     | `d`          | C    | 12   | 3   |     | `p`          | D    | 12   | 3   |     |                |      |      |     |
| `D`          | A    | 13   | 3   |     | `R`          | B    | 13   | 3   |     | `e`          | C    | 13   | 3   |     | `q`          | D    | 13   | 3   |     |                |      |      |     |
| `E`          | A    | 14   | 3   |     | `S`          | B    | 14   | 3   |     | `f`          | C    | 14   | 3   |     | `r`          | D    | 14   | 3   |     |                |      |      |     |
| `F`          | A    | 15   | 3   |     | `T`          | B    | 15   | 3   |     | `g`          | C    | 15   | 3   |     | `s`          | D    | 15   | 3   |     |                |      |      |     |

The mask width $w$ is determined by the formula in §7.2: $w = 0$ for rank 1 (the single mask value fits in zero characters), $w = 1$ for ranks 2–5, $w = 2$ for ranks 6–11, and $w = 3$ for ranks 12–15.

### 7.2 Standard factors

For a standard factor, the encoding is

```text
factor = type_character + mask_characters
```

where `mask_characters` is the fixed-width encoding of `mask - 1`. Its width is

$$
w = \min \{ k \ge 0 : 62^k > 2^r - 2 \},
$$

where `r` is the Dynkin rank.

Rank `1` has width `0`, so `A1 / P1` is encoded as `1`.

### 7.3 Escaped factors

Mathematically valid factors not in the standard table use the escape form

```text
0 <group> <rank_len> <rank> <mask_characters>
```

where:

- `<group>` is the Dynkin type character;
- `<rank>` is encoded as the shortest non-empty character string representing the positive rank;
- `<rank_len>` is one character giving the number of characters used by `<rank>`;
- `<mask_characters>` is the fixed-width encoding of `mask - 1` using the same width formula as above.

Since the standard table already contains all valid exceptional types, the escape form can occur only for the classical families $\mathrm{A}_r$, $\mathrm{B}_r$, $\mathrm{C}_r$, and $\mathrm{D}_r$ with $r > 15$.

Because `<rank_len>` is a single character, the rank value can occupy at most 61 characters. Therefore an escaped factor is encodable only when the shortest representation of `rank` uses at most 61 characters, equivalently when `rank \le 62^{61} - 1`. An encoder MUST reject any factor outside that bound. This is a hard format limit.

Examples showing the standard-to-escape boundary:

```text
A15 / P1  ->  F000      (last standard A entry; mask width 3)
A16 / P1  ->  0A1G000
A17 / P1  ->  0A1H000
```

## 8. Bundle encoding

This section defines how to encode a single completely reducible vector bundle as a string of Base62 characters. Both zero loci and degeneracy loci use this procedure: a zero locus encodes one bundle, while a degeneracy locus encodes two bundles independently using the same rules.

### 8.1 One summand row

Let one summand row flatten to coefficients

```text
d_0, d_1, ..., d_{W-1}
```

where `W` is the total ambient Dynkin rank.

Write the non-zero support of this row as

```text
(p_0, c_0), ..., (p_{s-1}, c_{s-1})
```

where `0 <= p_0 < ... < p_{s-1} < W`, every `c_i` is non-zero, and `s` is the support size. The zero row has `s = 0`.

Two helper notions are used throughout:

1. `states_width(N)` is the smallest integer `k >= 0` with `62^k >= N`.
2. A positive integer **descriptor** is encoded as:
   - one Base62 character of the same value when the integer lies in `1..61`;
   - otherwise `0 <len> <digits>`, where `<digits>` is the shortest Base62 representation of the integer and `<len>` is its character length encoded in one Base62 character.

The v3.1 bundle-row codec has four row modes. These are the same sparse row modes introduced in v3.

#### 8.1.1 Direct small-single rows

Let

$$
L = \min\!\left(7,\left\lfloor\frac{58}{W}\right\rfloor\right).
$$

If `s = 1` and `1 <= c_0 <= L`, the row is encoded in one character whose Base62 value is

$$
(c_0 - 1)W + p_0.
$$

This dedicates the first `W L` one-character row codes to sparse positive singleton rows with small coefficients.

#### 8.1.2 Two-sparse all-ones rows

If `s = 2` and `(c_0, c_1) = (1, 1)`, let `r` be the rank of the support `{p_0, p_1}` among the 2-element subsets of `{0, ..., W-1}` in lexicographic order.

If

$$
WL + \binom{W}{2} \le 58,
$$

the row is encoded in one character of Base62 value

$$
WL + r.
$$

Otherwise the row is encoded as

```text
w <support_rank_characters>
```

where `<support_rank_characters>` is the fixed-width `states_width(binomial(W,2))` encoding of `r`.

#### 8.1.3 Small positive sparse rows

If every non-zero coefficient is positive and lies in `1..7`, the row is encoded as

```text
x <support_size+1 descriptor> <support_rank_characters> <value_characters>
```

with the following fields:

- `<support_size+1 descriptor>` is the descriptor of `s + 1`; therefore the zero row is encoded canonically as `x1`;
- `<support_rank_characters>` is the fixed-width encoding of the rank of `{p_0, ..., p_{s-1}}` among the `s`-element subsets of `{0, ..., W-1}`;
- `<value_characters>` packs the digits `c_i - 1` in base `7`:

  $$
  v = \sum_{i=0}^{s-1} (c_i - 1) 7^{s-1-i},
  $$

  using fixed width `states_width(7^s)`.

This mode is the main new optimization of v3: it avoids writing an explicit value base for sparse rows with small positive coefficients.

#### 8.1.4 Generic positive and signed sparse rows

All remaining rows use one of the generic sparse forms

```text
y <support_size+1 descriptor> <support_rank_characters> <base descriptor> <value_characters>
z <support_size+1 descriptor> <support_rank_characters> <base descriptor> <value_characters>
```

For the `y` form, all coefficients are non-negative. The packed digits are `c_i - 1`, and the value base is

$$
B = \max(2, 1 + \max_i (c_i - 1)).
$$

For the `z` form, first apply the ZigZag bijection

$$
\operatorname{zigzag}(c) =
\begin{cases}
2c & \text{if } c \ge 0, \\
-2c - 1 & \text{if } c < 0.
\end{cases}
$$

The packed digits are then `zigzag(c_i)`, and

$$
B = \max(2, 1 + \max_i \operatorname{zigzag}(c_i)).
$$

In either form:

- `<support_size+1 descriptor>` again stores `s + 1`;
- `<support_rank_characters>` is the fixed-width encoding of the support rank among `s`-element subsets of `{0, ..., W-1}`;
- `<base descriptor>` stores `B`;
- `<value_characters>` packs the chosen digits in base `B`:

  $$
  v = \sum_{i=0}^{s-1} e_i B^{s-1-i},
  $$

  where `e_i = c_i - 1` in the `y` form and `e_i = zigzag(c_i)` in the `z` form, using fixed width `states_width(B^s)`.

### 8.2 Multiple summands

If the bundle is a direct sum

$$
E_1 \oplus \cdots \oplus E_t,
$$

then $t$ MUST be positive and each summand row is encoded separately. Bundles with zero summands are not representable in the wire format. For zero loci, the empty-bundle case is represented by the ambient-only form rather than by an empty bundle encoding.

Rows MUST be emitted in the coefficient-vector order defined in §6.2: after the canonical ambient factor order is fixed, flatten each row by concatenating the highest-weight vectors in ambient factor order, sort those flattened integer tuples lexicographically, and encode rows in that order. If the resulting encoded rows are `s_1, ..., s_t`, the bundle text is their direct concatenation:

$$
s_1 \cdots s_t.
$$

The number of summands is not written explicitly. Decoding remains unambiguous because the ambient part determines `W`, which determines `L`, and each summand begins either with a direct one-character code or with one of the explicit row markers `w`, `x`, `y`, `z`, each of which determines how to decode the remaining fields.

### 8.3 Rank bound encoding

The rank bound $k$ in a degeneracy locus is a non-negative integer encoded as the shortest non-empty Base62 string with the following rules:

- $k = 0$ is encoded as `0`.
- For $k > 0$, the encoding is the shortest string of Base62 characters such that the string, interpreted as a big-endian base-62 numeral, equals $k$. Leading zeros (characters with Base62 value 0) MUST NOT appear.

Examples: $k = 0$ → `0`, $k = 1$ → `1`, $k = 61$ → `z`, $k = 62$ → `10`, $k = 3843$ → `zz`, $k = 3844$ → `100`.

## 8a. Degeneracy locus assembly

For a degeneracy locus with bundles $E$, $F$ and rank bound $k$, the locus part is

```text
<bundle_E> - <bundle_F> - <k>
```

where `<bundle_E>` and `<bundle_F>` are each the concatenation of their coefficient-ordered summand rows (§8.2), and `<k>` is the rank bound encoding (§8.3).

If $E$ has no summands, `<bundle_E>` is the empty string, but since an empty segment before `-` is forbidden (§4), a degeneracy locus with an empty source bundle is not representable. The same applies to $F$. As in §8.2, both bundles MUST have at least one summand.

## 9. Decoding

To decode a bundle row, first compute `W` and `L = min(7, floor(58 / W))`.

1. Read the next character and let `u` be its Base62 value.
2. If `u < WL`, decode a direct small-single row:
   - position `p = u mod W`;
   - coefficient `c = floor(u / W) + 1`.
3. Otherwise, if `WL + binomial(W,2) <= 58` and `WL <= u < WL + binomial(W,2)`, decode a direct two-sparse all-ones row from the support rank `u - WL`.
4. Otherwise inspect the row marker:
   - `w`: decode a two-sparse all-ones row from the following fixed-width support-rank field;
   - `x`: decode `s + 1`, then the support rank, then unpack `s` base-7 digits and add 1 to each;
   - `y`: decode `s + 1`, support rank, base descriptor `B`, then unpack `s` base-`B` digits and add 1 to each;
   - `z`: decode `s + 1`, support rank, base descriptor `B`, then unpack `s` base-`B` digits and apply the inverse ZigZag map;
   - any other marker is invalid.
5. Reinsert the decoded non-zero coefficients into a length-`W` flat row and split it by ambient-factor ranks.

Decoding a full label then proceeds as follows:

1. split once at `.` if present;
2. decode ambient factors from left to right until the ambient text is exhausted;
3. compute the total ambient rank `W`;
4. if there is no locus part, stop (ambient-only label);
5. count the number of `-` characters in the locus part:
   - if 0, repeatedly decode bundle rows until the bundle text is exhausted;
   - if 2, split the locus part into `E_text`, `F_text`, and `k_text`, decode `E_text` and `F_text` as bundles, and decode `k_text` as the non-negative integer rank bound;
   - otherwise, reject the label.

## 10. Validation requirements

An implementation MUST reject at least the following malformed conditions:

- any non-Base62 character in a data field (ambient, mask, rank, descriptor, support rank, packed value, or rank bound);
- more than one `.` separator in a label;
- empty ambient text;
- a trailing separator with no locus text;
- an unknown standard ambient lead character (character values not assigned in the type table and not the escape character `0`);
- an escaped factor with an unknown Dynkin type;
- an escaped factor with a mathematically impossible Dynkin type/rank pair;
- an escaped factor with a non-positive encoded rank length;
- an escaped factor whose shortest rank representation would require more than 61 characters;
- truncated escaped rank characters;
- truncated mask characters;
- a decoded mask outside the valid range `1 <= mask < 2^rank`;
- a truncated row descriptor, support-rank field, base descriptor, or packed value field;
- a support size outside the range `0 .. W`;
- a decoded support rank outside the valid range for `binomial(W, s)`;
- a generic row base smaller than 2;
- a packed row value outside the advertised range (equivalently, a non-zero remainder after extracting the prescribed digits);
- a summand row whose decoded coefficient vector does not match the ambient structure (encoder-side obligation);
- an attempt to encode a zero locus with zero summands; the empty-bundle case MUST be represented by the ambient-only form instead;
- a locus part containing any number of `-` characters other than 0 or 2;
- a degeneracy locus with an empty `E`, `F`, or `k` segment;
- a rank bound `k` with leading zeros (a multi-character `k` whose first character has Base62 value 0);
- a label that is not in canonical form: after decoding a label into its structured representation, re-encoding MUST reproduce the original label byte for byte. This check implicitly rejects non-minimal encodings such as standard factors encoded in escape form, overlong descriptors, non-sorted summand order, and ambient-factor orders that do not match the coefficient-row certificate of §6.

## 11. Worked examples

### 11.1 Zero locus examples

| Object                                                                  | Bundle                                     | Label         |
| ----------------------------------------------------------------------- | ------------------------------------------ | ------------- |
| $\mathbb{P}^1 = \mathrm{A}_1 / \mathrm{P}_1$                            | ambient only                               | `1`           |
| $\mathbb{P}^1$                                                          | $\mathcal{O}(1)$                           | `1.0`         |
| $\mathbb{P}^1$                                                          | $\mathcal{O}(-1)$                          | `1.z220`      |
| $\mathbb{P}^1$                                                          | $\mathcal{O} \oplus \mathcal{O}(1)$        | `1.x10`       |
| $\mathbb{P}^1$                                                          | $\mathcal{O}(1) \oplus \mathcal{O}(1)$     | `1.00`        |
| $\mathbb{P}^3 = \mathrm{A}_3 / \mathrm{P}_1$                            | ambient only                               | `30`          |
| $\mathbb{P}^3$                                                          | $\mathcal{O}(1)$                           | `30.0`        |
| $\mathbb{P}^3$                                                          | $\mathcal{O}(-1)$                          | `30.z2020`    |
| $\mathbb{P}^3$                                                          | $\mathcal{O}(1) \oplus \mathcal{O}(0,0,1)$ | `30.20`       |
| $\mathrm{Gr}(2,4) = \mathrm{A}_3 / \mathrm{P}_2$                        | ambient only                               | `31`          |
| $\mathrm{Gr}(2,4)$                                                      | weight $(1,0,0)$                           | `31.0`        |
| $\mathrm{Gr}(3,6) = \mathrm{A}_5 / \mathrm{P}_3$                        | ambient only                               | `53`          |
| $\mathrm{Fl}(1,3,4) = \mathrm{A}_3 / \mathrm{P}_{\{1,3\}}$              | ambient only                               | `34`          |
| $\mathrm{Q}^5 = \mathrm{B}_3 / \mathrm{P}_1$                            | ambient only                               | `H0`          |
| $\mathrm{Q}^5$                                                          | weight $(1,0,0)$                           | `H0.0`        |
| $\mathrm{B}_5 / \mathrm{B} = \mathrm{B}_5 / \mathrm{P}_{\{1,2,3,4,5\}}$ | ambient only                               | `JU`          |
| $\mathrm{OGr}^{+}(5,10) = \mathrm{D}_5 / \mathrm{P}_5$                  | ambient only                               | `iF`          |
| $\mathrm{Freudenthal\ variety} = \mathrm{E}_7 / \mathrm{P}_7$           | ambient only                               | `u11`         |
| $\mathrm{A}_{15} / \mathrm{P}_1$                                        | ambient only                               | `F000`        |
| $\mathrm{A}_{16} / \mathrm{P}_1$                                        | ambient only                               | `0A1G000`     |
| $\mathrm{A}_{17} / \mathrm{P}_1$                                        | ambient only                               | `0A1H000`     |
| $(\mathbb{P}^1)^5$                                                      | $\mathcal{O}(1,1,1,1,1)$                   | `11111.x6000` |
| $\mathbb{P}^1 \times \mathbb{P}^1$                                      | $\mathcal{O}(1,1)$                         | `11.E`        |
| $\mathbb{P}^1 \times \mathbb{P}^1$                                      | $\mathcal{O}(1,0) \oplus \mathcal{O}(0,1)$ | `11.10`       |

### 11.2 Representative row modes

| Row type                    | Example bundle row                                       | Full label    |
| --------------------------- | -------------------------------------------------------- | ------------- |
| direct small-single         | $\mathcal{O}(1)$ on $\mathbb{P}^1$                       | `1.0`         |
| direct pair                 | $\mathcal{O}(1,1)$ on $\mathbb{P}^1 \times \mathbb{P}^1$ | `11.E`        |
| small positive sparse (`x`) | $\mathcal{O}(1,1,1,1,1)$ on $(\mathbb{P}^1)^5$           | `11111.x6000` |
| generic signed sparse (`z`) | $\mathcal{O}(-1)$ on $\mathbb{P}^1$                      | `1.z220`      |

The examples

- `1.0` and `30.0` show that a small positive singleton can collapse to one character independent of ambient type;
- `11.E` shows the dedicated two-sparse all-ones direct table;
- `11111.x6000` shows the `x` mode, where the support and the base-7 packed values are written explicitly but no separate base descriptor is needed;
- `1.z220` shows the generic signed sparse mode.

### 11.3 Degeneracy locus examples

| Object                             | $E$                                    | $F$                | $k$ | Label        |
| ---------------------------------- | -------------------------------------- | ------------------ | --- | ------------ |
| $\mathbb{P}^1$                     | $\mathcal{O}(1)$                       | $\mathcal{O}(1)$   | 0   | `1.0-0-0`    |
| $\mathbb{P}^1$                     | $\mathcal{O}(-1)$                      | $\mathcal{O}(1)$   | 0   | `1.z220-0-0` |
| $\mathbb{P}^1 \times \mathbb{P}^1$ | $\mathcal{O}(1,0)$                     | $\mathcal{O}(0,1)$ | 0   | `11.1-0-0`   |
| $\mathbb{P}^3$                     | $\mathcal{O}(1) \oplus \mathcal{O}(1)$ | $\mathcal{O}(2)$   | 1   | `30.00-3-1`  |

## 12. Version history

- **v1** — Initial encoding for zero loci of completely reducible vector bundles on partial flag varieties.
- **v1.1** — Switched the character alphabet to Base62 (`0–9A–Za–z`), giving a fixed 62-character encoding with lexicographic ordering by encoded string. Because `-` is not a Base62 character, v1.1 labels are reliably rejected by hypothetical v1 decoders and vice versa.
- **v2.0** — Extended the format to encode degeneracy loci. A label may now specify two bundles $E$ and $F$ and a non-negative integer rank bound $k$, using `-` as an intra-locus separator (`<ambient>.<bundle_E>-<bundle_F>-<k>`). Labels containing `-` are reliably rejected by v1.1 decoders. The ambient-only and zero-locus forms are unchanged from v1.1.
- **v2.1** — Added signed bundle coefficients. A summand row with at least one negative coefficient is encoded with the signed-row marker `1` followed by the usual base descriptor and packed ZigZag-transformed digits. Because v2.0 decoders rejected `1` as a bundle base character, signed-row labels are reliably rejected by v2.0 decoders.
- **v2.2** — Replaced the v2.1 equal-factor permutation minimum by the graph-certificate canonicalization rule of §6. This change requires no new syntax and no external canonization tool, but it does change some canonical labels relative to v2.1.
- **v3** — Replaced the old dense/base-descriptor bundle-row encoding by the sparse row codec of §8. The ambient encoding, label syntax, and graph-certificate canonicalization are unchanged, but bundle rows now optimize for sparse supports with small positive values.
- **v3.1** — Replaced the graph-certificate canonicalization by the coefficient-row multiset rule of §6. Equal ambient factors are disambiguated by lexicographically minimizing sorted flattened coefficient rows, and summands are emitted in coefficient-vector order rather than encoded-row-string order.
- **v3.1.1** — Clarified exact implementation requirements for the v3.1 canonicalization rule. In particular, the specification now records the exact one-summand fast path, forbids unsafe prefix-only pruning for multiple summands, and documents the dynamic-programming strategy used by the reference implementations. The wire format and normative v3.1 canonical rule are unchanged.
