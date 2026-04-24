# ZeroLocus62 format specification v2.2

## Status

This document defines Version 2.2 of the ZeroLocus62 encoding format for zero loci and degeneracy loci of completely reducible vector bundles on partial flag varieties. It is intended to be read as an RFC-like specification for the wire format and canonicalization rules.

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

The result is a single sequence of integers of total length $W = \sum_i r_i$, called the summand row. All arithmetic for encoding that summand — choosing the base, packing the value — operates on this flat sequence. Rows with only non-negative coefficients use the unsigned bundle-row form of §8.1; rows with at least one negative coefficient use the signed bundle-row form of §8.1.

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

The 62 alphanumeric characters are all safe in URLs and filenames without percent-encoding. Future versions of this format MAY assign meaning to additional URL-safe non-alphanumeric characters (such as `_` or `~`) to encode further information; any such extension requires a new format version. This format does not include an in-band version identifier. Forward-compatible evolution therefore requires that any new syntax is reliably rejected by v2.0 decoders.

Because `-` is not a member of the Base62 alphabet, labels containing `-` are reliably rejected by v1.1 decoders.

Version 2.1 additionally assigns meaning to the previously reserved bundle-row lead character `1`: when it appears at the start of one encoded summand row, it marks the signed-row form defined in §8.1. This syntax is reliably rejected by v2.0 decoders because they rejected `1` as a bundle base character.

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
2. The remaining ambiguity among equal encoded ambient factors is resolved by canonically labeling the colored edge-labeled bipartite graph built from the ambient factors and bundle summands as described in §6.2.
3. After the ambient factor order is fixed, each group of summand rows is sorted by its encoded strings in ascending code-unit order.

The v2.2 canonicalization rule is intentionally not the v2.1 lexicographic minimum over all equal-factor permutations. It is a different canonical labeling rule, so some labels that were canonical in v2.1 are not canonical in v2.2.

### 6.2 Canonical graph

After the initial ambient-factor sort of §6.1(1), build a finite bipartite graph as follows.

- Create one **factor vertex** for each ambient factor. Its color is the string `F:<ambient-code>`, where `<ambient-code>` is that factor's encoded ambient substring.
- Create one **row vertex** for each summand row of the locus data. In the zero-locus / bundle case, every such vertex has color `R:E`. In the degeneracy-locus case, the row vertices coming from $E$ have color `R:E` and those coming from $F$ have color `R:F`.
- For every factor vertex $x_i$ and row vertex $r_j$, add one edge labeled by the highest-weight vector contributed by row $r_j$ on factor $x_i$.

No same-side edges are present.

### 6.3 Canonical graph labeling algorithm

The canonical ambient order is the factor-vertex order induced by the lexicographically minimal certificate obtained from the following ordered-partition refinement procedure.

1. Start from the ordered partition whose cells are:
   - one cell for each factor-vertex color, in ascending lexicographic order of those colors;
   - one cell for each row-vertex color, in ascending lexicographic order of those colors.
2. Refine this partition repeatedly until stable. For one vertex $v$, its refinement signature is:
   - its current color; and
   - for each current cell $C$, the sorted multiset of edge labels from $v$ to the vertices of $C$, written in the current cell order.
     Vertices in the same cell whose signatures differ are split into new cells ordered by ascending signature.
3. If the refined partition is discrete, read off the ordered list of singleton vertices and compute its certificate:
   - first the sequence of vertex colors in that order;
   - then the sequence of all upper-triangular edge labels in that order.
     Both sequences are compared lexicographically in ascending code-unit order.
4. If the refined partition is not discrete, choose a target cell by:
   - minimal cell size among non-singleton cells;
   - on ties, prefer a factor-vertex cell over a row-vertex cell;
   - on remaining ties, choose the earliest such cell in the ordered partition.
5. Individualize each vertex of that target cell in turn: replace the cell by a singleton containing that vertex followed by the remainder of the cell, refine again, and recurse.
6. Among all discrete leaves reached in this search tree, choose the lexicographically minimal certificate.
7. The canonical ambient order is the order in which the factor vertices appear in the corresponding ordered singleton list.
8. Finally, sort the summand rows by their encoded strings in that canonical ambient order.

Any implementation is valid if and only if it produces exactly the same canonical ambient order as this graph-certificate procedure.

### 6.4 Complexity

Version 2.2 eliminates v2.1's normative exhaustive search over the Cartesian product of equal-factor permutations. The reference algorithm instead uses ordered-partition refinement with individualization/backtracking on the canonical graph of §6.2.

This change removes the explicit $\prod_i |B_i|!$ permutation enumeration from the format definition. The reference algorithm is still an exact graph-canonization procedure, so highly symmetric inputs may require substantial backtracking and are not known to admit a polynomial-time solution in full generality. In practice, refinement usually splits most cells quickly.

External tools such as `nauty`, `Traces`, or `bliss` are **not required** by this specification. A fully self-contained implementation is conforming. Implementations MAY nevertheless delegate the graph canonization step to an external exact canonization engine if they produce the same certificates and therefore the same canonical factor order.

### 6.5 Ordering convention

All lexicographic comparisons in this specification — including ambient factor sorting, summand-tuple comparison, and summand-row sorting — use ascending code-unit order of the encoded strings.

Code-unit order means: compare two strings position by position from left to right; the first position where they differ determines the order, and the string with the smaller character value at that position is smaller. For strings of unequal length that agree up to the shorter length, the shorter string is smaller.

Because all 62 characters of the ZeroLocus62 alphabet are ASCII, the code-unit value of each character is simply its ASCII byte value. The alphabet order — numerals `0`–`9` (0x30–0x39, values 0–9), uppercase `A`–`Z` (0x41–0x5A, values 10–35), lowercase `a`–`z` (0x61–0x7A, values 36–61) — agrees exactly with ASCII byte order. Consequently, lexicographic comparison of any two encoded strings by Base62 value gives the same result as standard byte-wise string comparison.

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

The character value `0` is reserved as the escape character. The remaining 59 characters are assigned to the 59 entries of the standard table in order. Positions 60 and 61 of the alphabet (`y` and `z`) are currently unused.

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

Version 2.1 has two row forms.

#### 8.1.1 Unsigned row form

If every coefficient satisfies `d_j >= 0`, define

$$
B = \max(2, 1 + \max_j d_j).
$$

The lower bound of 2 ensures that base-$B$ representation remains non-degenerate: in base 1, every integer maps to 0 regardless of its value, making the coefficient vector unrecoverable.

The packed value is

$$
v = \sum_{j=0}^{W-1} d_j B^{W-1-j}.
$$

Equivalently, start with `v = 0` and update `v <- v B + d_j` from left to right.

#### 8.1.2 Signed row form

If at least one coefficient is negative, first transform each coefficient to a non-negative digit by the ZigZag bijection

$$
e_j =
\begin{cases}
2d_j & \text{if } d_j \ge 0, \\
-2d_j - 1 & \text{if } d_j < 0.
\end{cases}
$$

The inverse map is

$$
d_j =
\begin{cases}
e_j / 2 & \text{if } e_j \text{ is even}, \\
-(e_j + 1) / 2 & \text{if } e_j \text{ is odd}.
\end{cases}
$$

Now define

$$
B = \max(2, 1 + \max_j e_j)
$$

and pack the transformed digits:

$$
v = \sum_{j=0}^{W-1} e_j B^{W-1-j}.
$$

#### 8.1.3 Base descriptor and final row encoding

Each summand row chooses its own base `B`. In either row form, `value_characters` is the fixed-width encoding of `v` using the smallest `k >= 1` such that

$$
62^k \ge B^W.
$$

Consequently, every valid summand row satisfies

$$
0 \le v < B^W.
$$

Define the **base descriptor** as follows:

- if `B` is in the range `2..61`, the descriptor is the single ZeroLocus62 character for `B`; character values `0` and `1` MUST NOT appear as a direct base descriptor;
- if `B >= 62`, the descriptor is

  ```text
  0 <base_len> <base_characters>
  ```

  where:
  - `0` is the escape character (Base62 value 0);
  - `<base_characters>` is the shortest non-empty character string representing `B`;
  - `<base_len>` is one character giving the number of characters used by `<base_characters>`.

The final row encoding is then:

- **unsigned row:** `<base_descriptor> <value_characters>`;
- **signed row:** `1 <base_descriptor> <value_characters>`.

The leading `1` in the signed form is the signed-row marker. It is not part of the base descriptor; the descriptor that follows it still obeys the same `2..61` / escaped-`0` rules as above.

Because `<base_len>` is a single character, the base value can occupy at most 61 characters. Therefore an escaped base is encodable only when the shortest representation of `B` uses at most 61 characters, equivalently when `B \le 62^{61} - 1`. An encoder MUST reject any summand row outside that bound. This is a hard format limit.

### 8.2 Multiple summands

If the bundle is a direct sum

$$
E_1 \oplus \cdots \oplus E_t,
$$

then $t$ MUST be positive and each summand row is encoded separately. Bundles with zero summands are not representable in the wire format. For zero loci, the empty-bundle case is represented by the ambient-only form rather than by an empty bundle encoding. If the encoded rows are `s_1, ..., s_t`, their lexicographically sorted order `s_(1) <= ... <= s_(t)` is concatenated directly to form the locus part:

$$
s_{(1)} \cdots s_{(t)}.
$$

The number of summands is not written explicitly. Decoding remains unambiguous because the ambient part determines `W`, and each summand begins with either an optional signed-row marker followed by a base descriptor, or directly with a base descriptor; that descriptor determines the width of its remaining value field.

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

where `<bundle_E>` and `<bundle_F>` are each the concatenation of their sorted encoded summand rows (§8.2), and `<k>` is the rank bound encoding (§8.3).

If $E$ has no summands, `<bundle_E>` is the empty string, but since an empty segment before `-` is forbidden (§4), a degeneracy locus with an empty source bundle is not representable. The same applies to $F$. As in §8.2, both bundles MUST have at least one summand.

## 9. Decoding

To decode a label:

1. split once at `.` if present;
2. decode ambient factors from left to right until the ambient text is exhausted;
3. compute the total ambient rank `W`;
4. if there is no locus part, stop (ambient-only label);
5. count the number of `-` characters in the locus part:
   - if 0, proceed to step 6 (zero-locus path);
   - if 2, proceed to step 13 (degeneracy-locus path);
   - otherwise, reject the label;
6. **(zero locus)** read one character from the bundle text;
7. if that character has Base62 value `1`, set `signed = true` and read the next character as the start of the base descriptor; otherwise set `signed = false` and treat the character already read as the start of the base descriptor;
8. decode the base descriptor:
   - if its first character has Base62 value `0`, read one character for `base_len`, validate that `base_len` is positive, then read `base_len` characters and decode them as `B`; validate that `B >= 62`;
   - otherwise decode the character directly as `B` and validate `2 <= B <= 61`;
9. determine the width of the value field from `B` and `W`;
10. decode the packed integer `v`;
11. unpack `v` into `W` base-`B` digits; validate that no remainder remains after the `W` digits are extracted, equivalently that `0 <= v < B^W`;
12. if `signed = true`, apply the inverse ZigZag map of §8.1.2 to those digits to recover the original coefficients; then split the resulting coefficient sequence by ambient-factor ranks to recover one bundle summand row; repeat from step 6 until the locus text is exhausted;
13. **(degeneracy locus)** split the locus part at the two `-` characters to obtain `E_text`, `F_text`, and `k_text`;
14. validate that all three segments are non-empty;
15. decode `E_text` as a bundle (steps 6–12 applied to `E_text`), yielding the summands of $E$;
16. decode `F_text` as a bundle (steps 6–12 applied to `F_text`), yielding the summands of $F$;
17. decode `k_text` as a non-negative integer: interpret the string as a big-endian base-62 numeral; validate that there are no leading zeros (unless $k = 0$ and the string is exactly `0`);
18. return the factors, $E$ summands, $F$ summands, and $k$.

## 10. Validation requirements

An implementation MUST reject at least the following malformed conditions:

- any non-Base62 character in a data field (ambient, mask, rank, value, or base);
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
- a direct bundle base descriptor outside the range `2..61`;
- a signed-row marker not followed by a valid base descriptor;
- an escaped bundle base with a non-positive base length;
- an escaped bundle base whose shortest representation would require more than 61 characters;
- truncated escaped base characters;
- an escaped bundle base with decoded value less than 62;
- a truncated summand field;
- a packed summand value `v` with `v >= B^W` (equivalently, a non-zero remainder after extracting `W` base-`B` coefficients);
- a summand row whose decoded coefficient vector does not match the ambient structure (encoder-side obligation);
- an attempt to encode a zero locus with zero summands; the empty-bundle case MUST be represented by the ambient-only form instead;
- a locus part containing any number of `-` characters other than 0 or 2;
- a degeneracy locus with an empty `E`, `F`, or `k` segment;
- a rank bound `k` with leading zeros (a multi-character `k` whose first character has Base62 value 0);
- a label that is not in canonical form: after decoding a label into its structured representation, re-encoding MUST reproduce the original label byte for byte. This check implicitly rejects non-minimal encodings such as standard factors encoded in escape form, overlong rank fields, non-sorted summand order, and ambient-factor orders that do not match the canonical graph certificate of §6.

## 11. Worked examples

### 11.1 Zero locus examples

| Object                                                                  | Bundle                                     | Label      |
| ----------------------------------------------------------------------- | ------------------------------------------ | ---------- |
| $\mathbb{P}^1 = \mathrm{A}_1 / \mathrm{P}_1$                            | ambient only                               | `1`        |
| $\mathbb{P}^1$                                                          | $\mathcal{O}(1)$                           | `1.21`     |
| $\mathbb{P}^1$                                                          | $\mathcal{O}(-1)$                          | `1.121`    |
| $\mathbb{P}^1$                                                          | $\mathcal{O} \oplus \mathcal{O}(1)$        | `1.2021`   |
| $\mathbb{P}^1$                                                          | $\mathcal{O}(1) \oplus \mathcal{O}(1)$     | `1.2121`   |
| $\mathbb{P}^3 = \mathrm{A}_3 / \mathrm{P}_1$                            | ambient only                               | `30`       |
| $\mathbb{P}^3$                                                          | $\mathcal{O}(1)$                           | `30.24`    |
| $\mathbb{P}^3$                                                          | $\mathcal{O}(-1)$                          | `30.124`   |
| $\mathbb{P}^3$                                                          | $\mathcal{O}(1) \oplus \mathcal{O}(0,0,1)$ | `30.2124`  |
| $\mathrm{Gr}(2,4) = \mathrm{A}_3 / \mathrm{P}_2$                        | ambient only                               | `31`       |
| $\mathrm{Gr}(2,4)$                                                      | weight $(1,0,0)$                           | `31.24`    |
| $\mathrm{Gr}(3,6) = \mathrm{A}_5 / \mathrm{P}_3$                        | ambient only                               | `53`       |
| $\mathrm{Fl}(1,3,4) = \mathrm{A}_3 / \mathrm{P}_{\{1,3\}}$              | ambient only                               | `34`       |
| $\mathrm{Q}^5 = \mathrm{B}_3 / \mathrm{P}_1$                            | ambient only                               | `H0`       |
| $\mathrm{Q}^5$                                                          | weight $(1,0,0)$                           | `H0.24`    |
| $\mathrm{B}_5 / \mathrm{B} = \mathrm{B}_5 / \mathrm{P}_{\{1,2,3,4,5\}}$ | ambient only                               | `JU`       |
| $\mathrm{OGr}^{+}(5,10) = \mathrm{D}_5 / \mathrm{P}_5$                  | ambient only                               | `iF`       |
| $\mathrm{Freudenthal\ variety} = \mathrm{E}_7 / \mathrm{P}_7$           | ambient only                               | `u11`      |
| $\mathrm{A}_{15} / \mathrm{P}_1$                                        | ambient only                               | `F000`     |
| $\mathrm{A}_{16} / \mathrm{P}_1$                                        | ambient only                               | `0A1G000`  |
| $\mathrm{A}_{17} / \mathrm{P}_1$                                        | ambient only                               | `0A1H000`  |
| $(\mathbb{P}^1)^5$                                                      | $\mathcal{O}(1,1,1,1,1)$                   | `11111.2V` |
| $\mathbb{P}^1 \times \mathbb{P}^1$                                      | $\mathcal{O}(1,1)$                         | `11.23`    |
| $\mathbb{P}^1 \times \mathbb{P}^1$                                      | $\mathcal{O}(1,0) \oplus \mathcal{O}(0,1)$ | `11.2122`  |

Two direct-sum examples deserve special emphasis.

For `P^1`, the bundle `O \oplus O(1)` has row encodings `20` and `21`, so the locus part is `2021` and the full label is `1.2021`.

For `P^1 x P^1`, the bundle `O(1,0) \oplus O(0,1)` has row encodings `22` and `21`, which sort to `21`, `22`, giving the full label `11.2122`.

### 11.2 Examples where v2.2 differs from v2.1

Because v2.2 changes only the canonicalization rule and not the wire syntax, the easiest way to see the difference is to compare labels for the same bundle.

| Object             | Bundle                                              | v2.1 label   | v2.2 label   |
| ------------------ | --------------------------------------------------- | ------------ | ------------ |
| $(\mathbb{P}^1)^3$ | $\mathcal{O}(0,0,1) \oplus \mathcal{O}(0,2,0)$      | `111.2136`   | `111.2232`   |
| $(\mathbb{P}^1)^3$ | $\mathcal{O}(-1,-1,-1) \oplus \mathcal{O}(-1,-1,0)$ | `111.123127` | `111.126127` |

Under v2.1 these labels were obtained by minimizing the sorted tuple of encoded summand rows over all equal-factor permutations. Under v2.2 they are obtained from the canonical graph certificate of §6.3, and the resulting canonical ambient order can differ.

### 11.3 Degeneracy locus examples

| Object                             | $E$                                    | $F$                | $k$ | Label          |
| ---------------------------------- | -------------------------------------- | ------------------ | --- | -------------- |
| $\mathbb{P}^1$                     | $\mathcal{O}(1)$                       | $\mathcal{O}(1)$   | 0   | `1.21-21-0`    |
| $\mathbb{P}^1$                     | $\mathcal{O}(-1)$                      | $\mathcal{O}(1)$   | 0   | `1.121-21-0`   |
| $\mathbb{P}^1 \times \mathbb{P}^1$ | $\mathcal{O}(1,0)$                     | $\mathcal{O}(0,1)$ | 0   | `11.21-22-0`   |
| $\mathbb{P}^3$                     | $\mathcal{O}(1) \oplus \mathcal{O}(1)$ | $\mathcal{O}(2)$   | 1   | `30.2424-3I-1` |

**Derivation of the third example.** On $\mathbb{P}^3 = \mathrm{A}_3 / \mathrm{P}_1$ (ambient `30`):

- $E = \mathcal{O}(1) \oplus \mathcal{O}(1)$: two summands, each with coefficients $(1, 0, 0)$. Base $B = 2$, $W = 3$, packed value $v = 1 \cdot 4 + 0 \cdot 2 + 0 = 4$. Width: smallest $k \ge 1$ with $62^k \ge 2^3 = 8$, so $k = 1$. Value character: `4`. Each summand row encodes as `24`. Sorted: `24`, `24`. Concatenated: `2424`.
- $F = \mathcal{O}(2)$: one summand with coefficients $(2, 0, 0)$. Base $B = 3$, packed value $v = 2 \cdot 9 + 0 \cdot 3 + 0 = 18$. Width: $62^1 \ge 3^3 = 27$, so $k = 1$. Value character: encode $18$ in 1 character = `I`. Summand encodes as `3I`.
- $k = 1$ encodes as `1`.
- Label: `30.2424-3I-1`.

## 12. Version history

- **v1** — Initial encoding for zero loci of completely reducible vector bundles on partial flag varieties.
- **v1.1** — Switched the character alphabet to Base62 (`0–9A–Za–z`), giving a fixed 62-character encoding with lexicographic ordering by encoded string. Because `-` is not a Base62 character, v1.1 labels are reliably rejected by hypothetical v1 decoders and vice versa.
- **v2.0** — Extended the format to encode degeneracy loci. A label may now specify two bundles $E$ and $F$ and a non-negative integer rank bound $k$, using `-` as an intra-locus separator (`<ambient>.<bundle_E>-<bundle_F>-<k>`). Labels containing `-` are reliably rejected by v1.1 decoders. The ambient-only and zero-locus forms are unchanged from v1.1.
- **v2.1** — Added signed bundle coefficients. A summand row with at least one negative coefficient is encoded with the signed-row marker `1` followed by the usual base descriptor and packed ZigZag-transformed digits. Because v2.0 decoders rejected `1` as a bundle base character, signed-row labels are reliably rejected by v2.0 decoders.
- **v2.2** — Replaced the v2.1 equal-factor permutation minimum by the graph-certificate canonicalization rule of §6. This change requires no new syntax and no external canonization tool, but it does change some canonical labels relative to v2.1.
