# ZeroLocus62 format specification v2.0

## Status

This document defines Version 2.0 of the ZeroLocus62 encoding format for zero loci and degeneracy loci of completely reducible vector bundles on partial flag varieties. It is intended to be read as an RFC-like specification for the wire format and canonicalization rules.

## 1. Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted in their ordinary specification sense.

A character means exactly one element of the Base62 alphabet.

## 2. Scope

ZeroLocus62 encodes geometric loci on products of partial flag varieties. A label always begins with an ambient part describing the factors of the ambient product. There are three kinds of label:

1. **Ambient only.** The label encodes just the ambient product, with no locus data.
2. **Zero locus.** The label encodes the ambient product together with a single non-zero completely reducible vector bundle $E$. The geometric object is the zero locus of a general global section of $E$.
3. **Degeneracy locus.** The label encodes the ambient product together with two non-zero completely reducible vector bundles $E$ and $F$, plus a non-negative integer rank bound $k$. The geometric object is the $k$-th degeneracy locus of a general morphism $\varphi \colon E \to F$.

The zero-bundle case for a zero locus is represented by the ambient-only form, not by an empty locus part.

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

$\lambda^{(i)} \in \mathbf{Z}_{\ge 0}^{r_i}$

for each factor `X_i`.

To represent one summand as a flat array, ZeroLocus62 concatenates these $m$ coefficient vectors in ambient factor order:

$$d = (\lambda^{(1)}_1, \ldots, \lambda^{(1)}_{r_1},\ \lambda^{(2)}_1, \ldots, \lambda^{(2)}_{r_2},\ \ldots,\ \lambda^{(m)}_1, \ldots, \lambda^{(m)}_{r_m}).$$

The result is a single sequence of non-negative integers of total length $W = \sum_i r_i$, called the summand row. All arithmetic for encoding that summand — choosing the base, packing the value — operates on this flat sequence.

An encoder MUST reject any summand whose structure does not match the ambient: each summand row MUST contain exactly one weight vector per ambient factor, and each weight vector MUST have length equal to that factor's Dynkin rank.

Example: on $\mathbb{P}^1 \times \mathbb{P}^1$ (two factors of type $\mathrm{A}_1$, each of rank 1, so $W = 2$), the summand $\mathcal{O}(1, 0)$ has coefficient vectors $(1)$ and $(0)$, which flatten to the row $(1, 0)$.

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

A label is **canonical** if and only if it uniquely minimizes the following ordered criteria among all labels representing the same mathematical object:

1. The ambient factors are sorted by their encoded factor strings in ascending code-unit order.
2. Among all permutations of factors within each maximal equal-factor block (a maximal run of consecutive factors with identical encoded strings), the chosen permutation minimizes the canonicalization key derived from the encoded locus data (see below).
3. Each group of summand rows is sorted by its encoded strings in ascending code-unit order.

**Zero locus canonicalization key.** The key is the lexicographically sorted tuple of encoded summand row strings for the single bundle.

**Degeneracy locus canonicalization key.** The key is the pair $(T_E, T_F)$ where $T_E$ is the sorted tuple of encoded row strings for bundle $E$ and $T_F$ is the sorted tuple for bundle $F$. Pairs are compared lexicographically: $T_E$ first, then $T_F$ as tiebreaker. The rank bound $k$ is invariant under factor permutation and does not affect the key.

**Uniqueness.** Encoding each factor and each summand row is deterministic once the factor order is fixed. The lexicographic minimum of a finite set of tuples is unique. Sorting the summand rows by their deterministic encodings produces a unique sequence. Since the canonical label is fully determined by the sorted factor strings, the minimal canonicalization key, and the sorted summand rows, the canonical label for a given mathematical object is unique. (The internal permutation of indistinguishable factors within an equal-factor block need not be unique; only the resulting label is.)

### 6.2 Algorithm

To compute the canonical form:

1. sort the ambient factors by their encoded ambient factor strings;
2. partition the sorted ambient factors into maximal equal-factor blocks;
3. for each combination of permutations of the equal-factor blocks, reorder every bundle summand accordingly, encode each row, sort the encoded strings, and record the canonicalization key (single sorted tuple for zero loci; pair of sorted tuples for degeneracy loci);
4. choose the combination whose key is lexicographically minimal;
5. apply that combination to fix the canonical ambient order;
6. sort each group of summand rows by their encoded strings (both $E$ and $F$ summand rows independently for degeneracy loci).

There is no exhaustive search across distinct ambient factors. Only equal-factor blocks are permuted. Implementations MAY use any algorithm that produces the same result as this procedure.

### 6.3 Complexity

The brute-force enumeration considers $\prod_i |B_i|!$ permutation combinations, where $B_i$ ranges over the equal-factor blocks. For a single block of $k$ identical factors, the cost is $k!$. Implementations MAY use any strategy to manage this cost, such as early termination or heuristic pruning, provided the result agrees with the brute-force procedure.

### 6.4 Ordering convention

All lexicographic comparisons in this specification — including ambient factor sorting, summand-tuple comparison, and summand-row sorting — use ascending code-unit order of the encoded strings.

Code-unit order means: compare two strings position by position from left to right; the first position where they differ determines the order, and the string with the smaller character value at that position is smaller. For strings of unequal length that agree up to the shorter length, the shorter string is smaller.

Because all 62 characters of the ZeroLocus62 alphabet are ASCII, the code-unit value of each character is simply its ASCII byte value. The alphabet order — numerals `0`–`9` (0x30–0x39, values 0–9), uppercase `A`–`Z` (0x41–0x5A, values 10–35), lowercase `a`–`z` (0x61–0x7A, values 36–61) — agrees exactly with ASCII byte order. Consequently, lexicographic comparison of any two encoded strings by Base62 value gives the same result as standard byte-wise string comparison.

### 6.5 Canonical validation

A decoded label MUST be in canonical form. After decoding a label into `(factors, summands)`, an implementation MUST re-encode the result and verify that the re-encoded label matches the original input byte for byte. If the label is not canonical, the implementation MUST reject it.

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

Because `<rank_len>` is a single character, the rank value can occupy at most 61 characters, limiting the maximum encodable escaped rank to $62^{61} - 1$. This bound is astronomical and does not constrain practical use.

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

Define the base

$$
B = \max(2, 1 + \max_j d_j)
$$

The lower bound of 2 ensures that base-$B$ representation remains non-degenerate: in base 1, every integer maps to 0 regardless of its value, making the coefficient vector unrecoverable.

The packed value is

$$
v = \sum_{j=0}^{W-1} d_j B^{W-1-j}.
$$

Equivalently, start with `v = 0` and update `v <- v B + d_j` from left to right.

Each summand row chooses its own base `B`.

The summand row encoding is

```text
base_character + value_characters
```

where `base_character` is the single ZeroLocus62 character for `B`, and `value_characters` is the fixed-width encoding of `v` using the smallest `k >= 1` such that

$$
62^k \ge B^W.
$$

When `B` is in the range `2..61`, the base character encodes `B` directly as a single character. Character values `0` and `1` (representing integers 0 and 1) MUST NOT appear as a standard base character.

When `B >= 62`, the summand row uses an escaped base encoding:

```text
0 <base_len> <base_characters> <value_characters>
```

where:

- `0` is the escape character (Base62 value 0);
- `<base_characters>` is the shortest non-empty character string representing `B`;
- `<base_len>` is one character giving the number of characters used by `<base_characters>`;
- `<value_characters>` has the same width as above.

Because `<base_len>` is a single character, the maximum encodable base is $62^{61} - 1$.

### 8.2 Multiple summands

If the bundle is a direct sum

$$
E_1 \oplus \cdots \oplus E_t,
$$

then each summand row is encoded separately. If the encoded rows are `s_1, ..., s_t`, their lexicographically sorted order `s_(1) <= ... <= s_(t)` is concatenated directly to form the locus part:

$$
s_{(1)} \cdots s_{(t)}.
$$

The number of summands is not written explicitly. Decoding remains unambiguous because the ambient part determines `W`, and each summand begins with a base character (or escape sequence) that determines the width of its remaining value field.

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

If $E$ has no summands, `<bundle_E>` is the empty string, but since an empty segment before `-` is forbidden (§4), a degeneracy locus with an empty source bundle is not representable. The same applies to $F$. Both bundles MUST have at least one summand.

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
6. **(zero locus)** read one base character;
7. if the character has Base62 value 0, decode the escaped base:
   - read one character for `base_len`;
   - validate that `base_len` is positive;
   - read `base_len` characters and decode as `B`;
   - validate that `B >= 62`;
8. otherwise, decode the character as `B` and validate `2 <= B <= 61`;
9. determine the width of the value field from `B` and `W`;
10. decode the packed integer;
11. unpack it into `W` coefficients in base `B`;
12. split those coefficients by ambient-factor ranks to recover one bundle summand row; repeat from step 6 until the locus text is exhausted;
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
- truncated escaped rank characters;
- truncated mask characters;
- a decoded mask outside the valid range `1 <= mask < 2^rank`;
- a standard (non-escaped) bundle base character outside the range `2..61`;
- a bundle base character with Base62 value 1 (reserved);
- an escaped bundle base with a non-positive base length;
- truncated escaped base characters;
- an escaped bundle base with decoded value less than 62;
- a truncated summand field;
- a packed summand value that exceeds the valid range for its width;
- a summand row whose decoded coefficient vector does not match the ambient structure (encoder-side obligation);
- a locus part containing any number of `-` characters other than 0 or 2;
- a degeneracy locus with an empty `E`, `F`, or `k` segment;
- a rank bound `k` with leading zeros (a multi-character `k` whose first character has Base62 value 0);
- a label that is not in canonical form: after decoding a label into its structured representation, re-encoding MUST reproduce the original label byte for byte. This check implicitly rejects non-minimal encodings such as standard factors encoded in escape form, overlong rank fields, non-sorted factor or summand order, and non-minimal permutation choices.

## 11. Worked examples

### 11.1 Zero locus examples

| Object                                                                  | Bundle                                     | Label      |
| ----------------------------------------------------------------------- | ------------------------------------------ | ---------- |
| $\mathbb{P}^1 = \mathrm{A}_1 / \mathrm{P}_1$                            | ambient only                               | `1`        |
| $\mathbb{P}^1$                                                          | $\mathcal{O}(1)$                           | `1.21`     |
| $\mathbb{P}^1$                                                          | $\mathcal{O} \oplus \mathcal{O}(1)$        | `1.2021`   |
| $\mathbb{P}^1$                                                          | $\mathcal{O}(1) \oplus \mathcal{O}(1)$     | `1.2121`   |
| $\mathbb{P}^3 = \mathrm{A}_3 / \mathrm{P}_1$                            | ambient only                               | `30`       |
| $\mathbb{P}^3$                                                          | $\mathcal{O}(1)$                           | `30.24`    |
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

### 11.2 Degeneracy locus examples

| Object                             | $E$                                    | $F$                | $k$ | Label          |
| ---------------------------------- | -------------------------------------- | ------------------ | --- | -------------- |
| $\mathbb{P}^1$                     | $\mathcal{O}(1)$                       | $\mathcal{O}(1)$   | 0   | `1.21-21-0`    |
| $\mathbb{P}^1 \times \mathbb{P}^1$ | $\mathcal{O}(1,0)$                     | $\mathcal{O}(0,1)$ | 0   | `11.21-22-0`   |
| $\mathbb{P}^3$                     | $\mathcal{O}(1) \oplus \mathcal{O}(1)$ | $\mathcal{O}(2)$   | 1   | `30.2424-3I-1` |

**Derivation of the third example.** On $\mathbb{P}^3 = \mathrm{A}_3 / \mathrm{P}_1$ (ambient `30`):

- $E = \mathcal{O}(1) \oplus \mathcal{O}(1)$: two summands, each with coefficients $(1, 0, 0)$. Base $B = 2$, $W = 3$, packed value $v = 1 \cdot 4 + 0 \cdot 2 + 0 = 4$. Width: smallest $k \ge 1$ with $62^k \ge 2^3 = 8$, so $k = 1$. Value character: `4`. Each summand row encodes as `24`. Sorted: `24`, `24`. Concatenated: `2424`.
- $F = \mathcal{O}(2)$: one summand with coefficients $(2, 0, 0)$. Base $B = 3$, packed value $v = 2 \cdot 9 + 0 \cdot 3 + 0 = 18$. Width: $62^1 \ge 3^3 = 27$, so $k = 1$. Value character: encode $18$ in 1 character = `I`. Summand encodes as `3I`.
- $k = 1$ encodes as `1`.
- Label: `30.2424-3I-1`.
