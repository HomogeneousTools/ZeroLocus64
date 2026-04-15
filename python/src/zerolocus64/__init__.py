"""ZeroLocus62 v1.1 canonical label codec for partial-flag zero loci.

This module is the reference Python implementation of the ZeroLocus62 v1.1
specification.

ZeroLocus62 uses the 62-character lexicographic alphabet
``0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz``
for encoding labels. Integer-to-string conversion is done via big-integer
arithmetic (repeated division by 62). ``0`` is the escape character, and
``.`` separates the ambient part from the optional bundle part.
"""

from __future__ import annotations

from dataclasses import dataclass
from itertools import permutations, product

STANDARD_NAME = "ZeroLocus62"
BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
BASE62_INDEX = {char: value for value, char in enumerate(BASE62)}

SEP = "."
ESCAPE = BASE62[0]
TYPE_ORDER = "ABCDEFG"
TYPE_TABLE: list[tuple[str, int]] = (
    [("A", rank) for rank in range(1, 16)]
    + [("B", rank) for rank in range(2, 16)]
    + [("C", rank) for rank in range(3, 16)]
    + [("D", rank) for rank in range(4, 16)]
    + [("E", 6), ("E", 7), ("E", 8)]
    + [("F", 4)]
    + [("G", 2)]
)
TYPE_CHARS = BASE62[1 : 1 + len(TYPE_TABLE)]
TYPE_INDEX = {entry: index for index, entry in enumerate(TYPE_TABLE)}
TYPE_CHAR_INDEX = {char: index for index, char in enumerate(TYPE_CHARS)}


def _is_valid_type_rank(group: str, rank: int) -> bool:
    return (
        (group == "A" and rank >= 1)
        or (group == "B" and rank >= 2)
        or (group == "C" and rank >= 3)
        or (group == "D" and rank >= 4)
        or (group == "E" and rank in {6, 7, 8})
        or (group == "F" and rank == 4)
        or (group == "G" and rank == 2)
    )


def _validate_type_rank(group: str, rank: int) -> None:
    if not _is_valid_type_rank(group, rank):
        raise ValueError(f"invalid Dynkin type/rank pair {group}{rank}")


def _validate_factor(factor: Factor) -> None:
    _validate_type_rank(factor.group, factor.rank)
    if not 1 <= factor.mask < 1 << factor.rank:
        raise ValueError("mask out of range")


@dataclass(frozen=True, slots=True)
class Factor:
    """One irreducible Dynkin factor in the ambient product.

    ``mask`` is stored as a bitset: bit ``j`` marks Dynkin node ``j + 1``.
    """

    group: str
    rank: int
    mask: int

    def marked_nodes(self) -> list[int]:
        """Return the 1-based indices of the marked Dynkin nodes."""

        return [node + 1 for node in range(self.rank) if self.mask >> node & 1]


def _mask_width(rank: int) -> int:
    width = 0
    capacity = 1
    while capacity <= (1 << rank) - 2:
        width += 1
        capacity *= 62
    return width


def _encode_characters(value: int, width: int) -> str:
    """Encode ``value`` as exactly ``width`` base-62 characters."""

    if width < 0:
        raise ValueError("width must be non-negative")
    if width == 0:
        if value:
            raise ValueError("non-zero value does not fit in width 0")
        return ""
    if not 0 <= value < 62**width:
        raise ValueError("value does not fit in character width")
    characters = []
    remaining = value
    for _ in range(width):
        characters.append(BASE62[remaining % 62])
        remaining //= 62
    return "".join(reversed(characters))


def _decode_characters(text: str) -> int:
    """Decode a fixed-width base-62 character string."""

    value = 0
    for char in text:
        char_value = BASE62_INDEX.get(char, -1)
        if char_value < 0:
            raise ValueError(f"invalid base-62 character {char!r}")
        value = value * 62 + char_value
    return value


def _encode_natural(value: int) -> str:
    """Encode a positive integer in the shortest available character width."""

    if value <= 0:
        raise ValueError("natural must be positive")
    width = 1
    capacity = 62
    while value >= capacity:
        width += 1
        capacity *= 62
    return _encode_characters(value, width)


def _encode_factor(factor: Factor) -> str:
    _validate_factor(factor)
    width = _mask_width(factor.rank)
    index = TYPE_INDEX.get((factor.group, factor.rank))
    if index is not None:
        return TYPE_CHARS[index] + _encode_characters(factor.mask - 1, width)
    rank_characters = _encode_natural(factor.rank)
    return (
        ESCAPE
        + factor.group
        + _encode_characters(len(rank_characters), 1)
        + rank_characters
        + _encode_characters(factor.mask - 1, width)
    )


def _decode_factor(text: str, position: int) -> tuple[Factor, int]:
    if position >= len(text):
        raise ValueError("unexpected end decoding factor")
    lead_char = text[position]
    if lead_char == ESCAPE:
        if position + 3 > len(text):
            raise ValueError("factor escape truncated")
        group = text[position + 1]
        if group not in TYPE_ORDER:
            raise ValueError(f"unknown Dynkin type {group!r}")
        rank_length = _decode_characters(text[position + 2])
        if rank_length <= 0:
            raise ValueError("escaped rank length must be positive")
        start = position + 3
        end = start + rank_length
        if end > len(text):
            raise ValueError("escaped rank truncated")
        rank = _decode_characters(text[start:end])
        position = end
    else:
        index = TYPE_CHAR_INDEX.get(lead_char, -1)
        if index < 0:
            raise ValueError(f"unknown standard factor character {lead_char!r}")
        group, rank = TYPE_TABLE[index]
        position += 1
    _validate_type_rank(group, rank)
    end = position + _mask_width(rank)
    if end > len(text):
        raise ValueError("mask truncated")
    mask = _decode_characters(text[position:end]) + 1 if end > position else 1
    if not 1 <= mask < (1 << rank):
        raise ValueError("mask out of range")
    return Factor(group, rank, mask), end


def _row_base(row: list[list[int]]) -> int:
    return max(2, max((coefficient for weights in row for coefficient in weights), default=1) + 1)


def _row_value(row: list[list[int]], base: int) -> int:
    value = 0
    for weights in row:
        for coefficient in weights:
            value = value * base + coefficient
    return value


def _summand_width(total_dynkin_rank: int, base: int) -> int:
    if base < 2:
        raise ValueError("bundle base must be at least 2")
    width = 1
    capacity = 62
    while capacity < base**total_dynkin_rank:
        width += 1
        capacity *= 62
    return width


def _encode_summand(row: list[list[int]], total_dynkin_rank: int) -> str:
    """Encode one bundle summand row."""

    base = _row_base(row)
    width = _summand_width(total_dynkin_rank, base)
    value_chars = _encode_characters(_row_value(row, base), width)
    if base < 62:
        return _encode_characters(base, 1) + value_chars
    base_characters = _encode_natural(base)
    return (
        ESCAPE
        + _encode_characters(len(base_characters), 1)
        + base_characters
        + value_chars
    )


def _reorder(
    order: list[int], factors: list[Factor], summands: list[list[list[int]]]
) -> tuple[list[Factor], list[list[list[int]]]]:
    return [factors[index] for index in order], [
        [row[index] for index in order] for row in summands
    ]


def canonicalize(
    factors: list[Factor], summands: list[list[list[int]]]
) -> tuple[list[Factor], list[list[list[int]]]]:
    """Return the canonical ambient order and canonical summand ordering.

    Distinct factors are sorted by their ambient codes. Equal-factor blocks are
    then permuted only as far as needed to minimize the sorted encoded summand
    rows.
    """

    factors = list(factors)
    summands = [list(row) for row in summands]
    initial_order = sorted(
        range(len(factors)), key=lambda index: _encode_factor(factors[index])
    )
    factors, summands = _reorder(initial_order, factors, summands)
    total_dynkin_rank = sum(factor.rank for factor in factors)
    factor_codes = [_encode_factor(factor) for factor in factors]
    equal_factor_blocks: list[list[tuple[int, ...]]] = []
    start = 0
    while start < len(factors):
        stop = start + 1
        while stop < len(factors) and factor_codes[stop] == factor_codes[start]:
            stop += 1
        block = tuple(range(start, stop))
        equal_factor_blocks.append(
            [block] if len(block) == 1 else list(permutations(block))
        )
        start = stop
    best_signature: tuple[str, ...] | None = None
    best_order = list(range(len(factors)))
    for choice in product(*equal_factor_blocks):
        trial_order = [index for block in choice for index in block]
        _, reordered_rows = _reorder(trial_order, factors, summands)
        signature = tuple(
            sorted(_encode_summand(row, total_dynkin_rank) for row in reordered_rows)
        )
        if best_signature is None or signature < best_signature:
            best_signature = signature
            best_order = trial_order
    factors, summands = _reorder(best_order, factors, summands)
    summands.sort(key=lambda row: _encode_summand(row, total_dynkin_rank))
    return factors, summands


def encode_label(factors: list[Factor], summands: list[list[list[int]]]) -> str:
    """Encode an ambient product and bundle as a canonical ZeroLocus62 label.

    Inputs may be supplied in noncanonical order; canonicalization is always
    applied before serialization.
    """

    factors, summands = canonicalize(factors, summands)
    ambient_text = "".join(_encode_factor(factor) for factor in factors)
    if not summands:
        return ambient_text
    total_dynkin_rank = sum(factor.rank for factor in factors)
    bundle_text = "".join(_encode_summand(row, total_dynkin_rank) for row in summands)
    return ambient_text + SEP + bundle_text


def _decode_label_raw(label: str) -> tuple[list[Factor], list[list[list[int]]]]:
    """Decode without canonical validation."""

    ambient_text, separator, bundle_text = label.partition(SEP)
    if not ambient_text:
        raise ValueError("ambient part must be non-empty")
    if separator and not bundle_text:
        raise ValueError("separator requires a non-empty bundle")

    factors: list[Factor] = []
    position = 0
    while position < len(ambient_text):
        factor, position = _decode_factor(ambient_text, position)
        factors.append(factor)
    if not separator:
        return factors, []

    total_dynkin_rank = sum(factor.rank for factor in factors)
    summands: list[list[list[int]]] = []
    position = 0
    while position < len(bundle_text):
        base_character = bundle_text[position]
        base_value = BASE62_INDEX.get(base_character, -1)
        if base_value < 0:
            raise ValueError(f"invalid bundle base character {base_character!r}")
        if base_value == 0:
            # Escaped base
            if position + 2 > len(bundle_text):
                raise ValueError("escaped base truncated")
            base_len = _decode_characters(bundle_text[position + 1])
            if base_len <= 0:
                raise ValueError("escaped base length must be positive")
            base_start = position + 2
            base_end = base_start + base_len
            if base_end > len(bundle_text):
                raise ValueError("escaped base truncated")
            base = _decode_characters(bundle_text[base_start:base_end])
            if base < 62:
                raise ValueError("escaped base must be at least 62")
            position = base_end
        elif base_value == 1:
            raise ValueError("bundle base character 1 is reserved")
        else:
            base = base_value
            if not 2 <= base < 62:
                raise ValueError(f"invalid bundle base character {base_character!r}")
            position += 1
        width = _summand_width(total_dynkin_rank, base)
        start = position
        end = start + width
        if end > len(bundle_text):
            raise ValueError("summand truncated")
        value = _decode_characters(bundle_text[start:end])
        position = end

        flat_coefficients = [0] * total_dynkin_rank
        for index in range(total_dynkin_rank - 1, -1, -1):
            flat_coefficients[index] = value % base
            value //= base
        if value:
            raise ValueError("packed value exceeds range")

        row: list[list[int]] = []
        offset = 0
        for factor in factors:
            row.append(flat_coefficients[offset : offset + factor.rank])
            offset += factor.rank
        summands.append(row)
    return factors, summands


def decode_label(label: str) -> tuple[list[Factor], list[list[list[int]]]]:
    """Decode a ZeroLocus62 label into ``(factors, summands)``.

    The returned ``summands`` value is a list of bundle rows, where each row
    stores one weight vector per ambient factor.

    Raises ``ValueError`` if the label is not in canonical form.
    """

    factors, summands = _decode_label_raw(label)
    if encode_label(factors, summands) != label:
        raise ValueError("label is not in canonical form")
    return factors, summands


def is_canonical(label: str) -> bool:
    """Return ``True`` if *label* is a valid canonical ZeroLocus62 label."""

    try:
        factors, summands = _decode_label_raw(label)
        return encode_label(factors, summands) == label
    except ValueError:
        return False


__all__ = [
    "BASE62",
    "BASE62_INDEX",
    "ESCAPE",
    "Factor",
    "SEP",
    "STANDARD_NAME",
    "TYPE_CHARS",
    "TYPE_CHAR_INDEX",
    "TYPE_INDEX",
    "TYPE_ORDER",
    "TYPE_TABLE",
    "canonicalize",
    "decode_label",
    "encode_label",
    "is_canonical",
]
