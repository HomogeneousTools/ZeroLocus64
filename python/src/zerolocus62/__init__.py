"""ZeroLocus62 v3 canonical label codec for bundles, zero loci, and degeneracy loci.

This module is the reference Python implementation of the ZeroLocus62 v3
specification.

ZeroLocus62 uses the 62-character lexicographic alphabet
``0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz``
for encoding labels. Integer-to-string conversion is done via big-integer
arithmetic (repeated division by 62). ``0`` is the escape character, ``.``
separates the ambient part from the optional locus part, and ``-`` separates
the two bundle parts of a degeneracy locus.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import comb

STANDARD_NAME = "ZeroLocus62"
BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
BASE62_INDEX = {char: value for value, char in enumerate(BASE62)}

SEP = "."
LOCUS_SEP = "-"
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
MAX_SMALL_VALUE = 7
DIRECT_ROW_CAPACITY = 58
SMALL_PAIR_MARKER = BASE62[58]
SMALL_POSITIVE_MARKER = BASE62[59]
POSITIVE_SPARSE_MARKER = BASE62[60]
SIGNED_SPARSE_MARKER = BASE62[61]


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


def _zigzag_encode(value: int) -> int:
    return 2 * value if value >= 0 else -2 * value - 1


def _zigzag_decode(value: int) -> int:
    return value // 2 if value % 2 == 0 else -(value // 2) - 1


def _encode_descriptor(value: int) -> str:
    if value <= 0:
        raise ValueError("descriptor must be positive")
    if value <= 61:
        return BASE62[value]
    encoded = _encode_natural(value)
    if len(encoded) > 61:
        raise ValueError("descriptor length exceeds hard limit")
    return ESCAPE + _encode_characters(len(encoded), 1) + encoded


def _decode_descriptor(text: str, position: int, name: str) -> tuple[int, int]:
    if position >= len(text):
        raise ValueError(f"unexpected end decoding {name}")
    lead = BASE62_INDEX.get(text[position], -1)
    if lead < 0:
        raise ValueError(f"invalid Base62 character in {name} {text[position]!r}")
    if lead != 0:
        return lead, position + 1
    if position + 2 > len(text):
        raise ValueError(f"{name} truncated")
    width = _decode_characters(text[position + 1])
    if width <= 0:
        raise ValueError(f"{name} length must be positive")
    start = position + 2
    end = start + width
    if end > len(text):
        raise ValueError(f"{name} truncated")
    value = _decode_characters(text[start:end])
    if value <= 61:
        raise ValueError(f"escaped {name} must be at least 62")
    return value, end


def _states_width(states: int) -> int:
    width = 0
    capacity = 1
    while capacity < states:
        width += 1
        capacity *= 62
    return width


def _rank_support(total_dynkin_rank: int, positions: list[int]) -> int:
    rank = 0
    previous = -1
    count = len(positions)
    for index, position in enumerate(positions):
        for candidate in range(previous + 1, position):
            rank += comb(total_dynkin_rank - 1 - candidate, count - 1 - index)
        previous = position
    return rank


def _unrank_support(total_dynkin_rank: int, count: int, rank: int) -> list[int]:
    if not 0 <= count <= total_dynkin_rank:
        raise ValueError("support size out of range")
    positions: list[int] = []
    next_min = 0
    remaining_rank = rank
    for index in range(count):
        for position in range(next_min, total_dynkin_rank):
            block = comb(total_dynkin_rank - 1 - position, count - 1 - index)
            if remaining_rank < block:
                positions.append(position)
                next_min = position + 1
                break
            remaining_rank -= block
        else:
            raise ValueError("support rank out of range")
    if remaining_rank:
        raise ValueError("support rank out of range")
    return positions


def _signed_digit(value: int) -> int:
    if value == 0:
        raise ValueError("signed sparse rows encode only non-zero values")
    return _zigzag_encode(value) - 1


def _decode_signed_digit(value: int) -> int:
    return _zigzag_decode(value + 1)


def _direct_small_limit(
    total_dynkin_rank: int, max_small_value: int = MAX_SMALL_VALUE
) -> int:
    return min(max_small_value, DIRECT_ROW_CAPACITY // total_dynkin_rank)


def _normalize_summands(
    summands: list[list[list[int]]], factors: list[Factor]
) -> list[list[list[int]]]:
    if not isinstance(summands, list):
        raise TypeError("summands must be a list")
    normalized: list[list[list[int]]] = []
    for row in summands:
        if not isinstance(row, list) or len(row) != len(factors):
            raise ValueError("summand row factor count mismatch")
        typed_row: list[list[int]] = []
        for weights, factor in zip(row, factors, strict=True):
            if not isinstance(weights, list):
                raise ValueError("highest-weight entry must be a list")
            if len(weights) != factor.rank:
                raise ValueError("highest-weight length must match the Dynkin rank")
            typed_weights: list[int] = []
            for coefficient in weights:
                if isinstance(coefficient, bool) or not isinstance(coefficient, int):
                    raise TypeError("highest-weight coefficient must be an integer")
                typed_weights.append(coefficient)
            typed_row.append(typed_weights)
        normalized.append(typed_row)
    return normalized


def _row_value(digits: list[int], base: int) -> int:
    value = 0
    for digit in digits:
        value = value * base + digit
    return value


def _unpack_digits(value: int, base: int, count: int) -> list[int]:
    digits = [0] * count
    for index in range(count - 1, -1, -1):
        digits[index] = value % base
        value //= base
    if value:
        raise ValueError("packed value exceeds range")
    return digits


def _split_flat_row(
    flat_coefficients: list[int], factors: list[Factor]
) -> list[list[int]]:
    row: list[list[int]] = []
    offset = 0
    for factor in factors:
        row.append(flat_coefficients[offset : offset + factor.rank])
        offset += factor.rank
    return row


def _encode_summand(row: list[list[int]], total_dynkin_rank: int) -> str:
    """Encode one bundle summand row."""

    flat_coefficients = [coefficient for weights in row for coefficient in weights]
    positions = [index for index, value in enumerate(flat_coefficients) if value != 0]
    values = [flat_coefficients[index] for index in positions]
    support_size = len(positions)
    small_limit = _direct_small_limit(total_dynkin_rank)
    direct_pair_offset = total_dynkin_rank * small_limit
    direct_pair_capacity = direct_pair_offset + comb(total_dynkin_rank, 2)

    if support_size == 1 and 1 <= values[0] <= small_limit:
        return BASE62[(values[0] - 1) * total_dynkin_rank + positions[0]]
    if (
        direct_pair_capacity <= DIRECT_ROW_CAPACITY
        and support_size == 2
        and values == [1, 1]
    ):
        return BASE62[direct_pair_offset + _rank_support(total_dynkin_rank, positions)]
    if support_size == 2 and values == [1, 1]:
        return SMALL_PAIR_MARKER + _encode_characters(
            _rank_support(total_dynkin_rank, positions),
            _states_width(comb(total_dynkin_rank, 2)),
        )

    signed = any(value < 0 for value in values)
    if not signed and all(1 <= value <= MAX_SMALL_VALUE for value in values):
        text = SMALL_POSITIVE_MARKER + _encode_descriptor(support_size + 1)
        if support_size == 0:
            return text
        support_states = comb(total_dynkin_rank, support_size)
        text += _encode_characters(
            _rank_support(total_dynkin_rank, positions),
            _states_width(support_states),
        )
        text += _encode_characters(
            _row_value([value - 1 for value in values], MAX_SMALL_VALUE),
            _states_width(MAX_SMALL_VALUE**support_size),
        )
        return text

    digits = (
        [_signed_digit(value) for value in values]
        if signed
        else [value - 1 for value in values]
    )
    text = (
        SIGNED_SPARSE_MARKER if signed else POSITIVE_SPARSE_MARKER
    ) + _encode_descriptor(support_size + 1)
    if support_size == 0:
        return text
    support_states = comb(total_dynkin_rank, support_size)
    text += _encode_characters(
        _rank_support(total_dynkin_rank, positions),
        _states_width(support_states),
    )
    base = max(2, max(digits, default=1) + 1)
    text += _encode_descriptor(base)
    text += _encode_characters(
        _row_value(digits, base), _states_width(base**support_size)
    )
    return text


def _encode_bundle_text(summands: list[list[list[int]]], total_dynkin_rank: int) -> str:
    return "".join(_encode_summand(row, total_dynkin_rank) for row in summands)


def _decode_bundle_text(
    bundle_text: str,
    factors: list[Factor],
    total_dynkin_rank: int,
) -> list[list[list[int]]]:
    """Decode a bundle text segment into summand rows."""

    summands: list[list[list[int]]] = []
    position = 0
    small_limit = _direct_small_limit(total_dynkin_rank)
    direct_pair_offset = total_dynkin_rank * small_limit
    direct_pair_capacity = direct_pair_offset + comb(total_dynkin_rank, 2)
    while position < len(bundle_text):
        lead = bundle_text[position]
        lead_value = BASE62_INDEX.get(lead, -1)
        if lead_value < 0:
            raise ValueError(f"invalid bundle row lead character {lead!r}")
        if small_limit > 0 and lead_value < direct_pair_offset:
            flat_coefficients = [0] * total_dynkin_rank
            flat_coefficients[lead_value % total_dynkin_rank] = (
                lead_value // total_dynkin_rank + 1
            )
            position += 1
            summands.append(_split_flat_row(flat_coefficients, factors))
            continue
        if (
            direct_pair_capacity <= DIRECT_ROW_CAPACITY
            and direct_pair_offset <= lead_value < direct_pair_capacity
        ):
            flat_coefficients = [0] * total_dynkin_rank
            positions = _unrank_support(
                total_dynkin_rank, 2, lead_value - direct_pair_offset
            )
            for support_position in positions:
                flat_coefficients[support_position] = 1
            position += 1
            summands.append(_split_flat_row(flat_coefficients, factors))
            continue
        if lead == SMALL_PAIR_MARKER:
            position += 1
            support_width = _states_width(comb(total_dynkin_rank, 2))
            support_end = position + support_width
            if support_end > len(bundle_text):
                raise ValueError("pair support rank truncated")
            support_rank = _decode_characters(bundle_text[position:support_end])
            flat_coefficients = [0] * total_dynkin_rank
            for support_position in _unrank_support(total_dynkin_rank, 2, support_rank):
                flat_coefficients[support_position] = 1
            position = support_end
            summands.append(_split_flat_row(flat_coefficients, factors))
            continue
        if lead == SMALL_POSITIVE_MARKER:
            position += 1
            support_size_plus_one, position = _decode_descriptor(
                bundle_text, position, "support size"
            )
            support_size = support_size_plus_one - 1
            if not 0 <= support_size <= total_dynkin_rank:
                raise ValueError("support size out of range")
            flat_coefficients = [0] * total_dynkin_rank
            if support_size == 0:
                summands.append(_split_flat_row(flat_coefficients, factors))
                continue
            support_states = comb(total_dynkin_rank, support_size)
            support_width = _states_width(support_states)
            support_end = position + support_width
            if support_end > len(bundle_text):
                raise ValueError("support rank truncated")
            support_rank = _decode_characters(bundle_text[position:support_end])
            position = support_end
            support_positions = _unrank_support(
                total_dynkin_rank, support_size, support_rank
            )
            value_width = _states_width(MAX_SMALL_VALUE**support_size)
            value_end = position + value_width
            if value_end > len(bundle_text):
                raise ValueError("value payload truncated")
            values = [
                digit + 1
                for digit in _unpack_digits(
                    _decode_characters(bundle_text[position:value_end]),
                    MAX_SMALL_VALUE,
                    support_size,
                )
            ]
            position = value_end
            for support_position, value in zip(support_positions, values, strict=True):
                flat_coefficients[support_position] = value
            summands.append(_split_flat_row(flat_coefficients, factors))
            continue
        if lead not in {POSITIVE_SPARSE_MARKER, SIGNED_SPARSE_MARKER}:
            raise ValueError(f"invalid bundle row lead character {lead!r}")
        signed = lead == SIGNED_SPARSE_MARKER
        position += 1
        support_size_plus_one, position = _decode_descriptor(
            bundle_text, position, "support size"
        )
        support_size = support_size_plus_one - 1
        if not 0 <= support_size <= total_dynkin_rank:
            raise ValueError("support size out of range")
        flat_coefficients = [0] * total_dynkin_rank
        if support_size == 0:
            summands.append(_split_flat_row(flat_coefficients, factors))
            continue
        support_states = comb(total_dynkin_rank, support_size)
        support_width = _states_width(support_states)
        support_end = position + support_width
        if support_end > len(bundle_text):
            raise ValueError("support rank truncated")
        support_rank = _decode_characters(bundle_text[position:support_end])
        if support_rank >= support_states:
            raise ValueError("support rank out of range")
        position = support_end
        support_positions = _unrank_support(
            total_dynkin_rank, support_size, support_rank
        )
        base, position = _decode_descriptor(bundle_text, position, "value base")
        if base < 2:
            raise ValueError("value base must be at least 2")
        value_width = _states_width(base**support_size)
        value_end = position + value_width
        if value_end > len(bundle_text):
            raise ValueError("value payload truncated")
        digits = _unpack_digits(
            _decode_characters(bundle_text[position:value_end]), base, support_size
        )
        position = value_end
        values = (
            [_decode_signed_digit(digit) for digit in digits]
            if signed
            else [digit + 1 for digit in digits]
        )
        for support_position, value in zip(support_positions, values, strict=True):
            flat_coefficients[support_position] = value
        summands.append(_split_flat_row(flat_coefficients, factors))
    return summands


def _encode_rank_bound(k: int) -> str:
    if k < 0:
        raise ValueError("rank bound must be non-negative")
    if k == 0:
        return BASE62[0]
    characters: list[str] = []
    remaining = k
    while remaining > 0:
        characters.append(BASE62[remaining % 62])
        remaining //= 62
    return "".join(reversed(characters))


def _decode_rank_bound(text: str) -> int:
    if not text:
        raise ValueError("rank bound text must be non-empty")
    if len(text) > 1 and BASE62_INDEX.get(text[0], -1) == 0:
        raise ValueError("rank bound has leading zeros")
    value = 0
    for char in text:
        char_value = BASE62_INDEX.get(char, -1)
        if char_value < 0:
            raise ValueError(f"invalid Base62 character in rank bound {char!r}")
        value = value * 62 + char_value
    return value


def _reorder(
    order: list[int], factors: list[Factor], summands: list[list[list[int]]]
) -> tuple[list[Factor], list[list[list[int]]]]:
    return [factors[index] for index in order], [
        [row[index] for index in order] for row in summands
    ]


def _serialize_weights(weights: list[int]) -> str:
    return "[" + ",".join(str(value) for value in weights) + "]"


def _canonical_factor_order(
    factors: list[Factor],
    summands: list[list[list[int]]],
    summands_f: list[list[list[int]]] | None,
) -> list[int]:
    if len(factors) < 2:
        return list(range(len(factors)))

    factor_vertices = list(range(len(factors)))
    row_offset = len(factors)
    row_entries: list[tuple[str, int, list[list[int]]]] = [
        ("E", index, row) for index, row in enumerate(summands)
    ]
    if summands_f is not None:
        row_entries.extend(("F", index, row) for index, row in enumerate(summands_f))
    if not row_entries:
        return list(range(len(factors)))

    vertex_colors: dict[int, str] = {
        index: "F:" + _encode_factor(factor) for index, factor in enumerate(factors)
    }
    edge_labels: dict[tuple[int, int], str] = {}
    row_vertices = list(range(row_offset, row_offset + len(row_entries)))
    for vertex, (bundle_tag, _row_index, row) in zip(
        row_vertices, row_entries, strict=True
    ):
        vertex_colors[vertex] = "R:" + bundle_tag
        for factor_index, weights in enumerate(row):
            label = _serialize_weights(weights)
            edge_labels[(factor_index, vertex)] = label
            edge_labels[(vertex, factor_index)] = label

    def cell_key(vertex: int, cell: tuple[int, ...]) -> str:
        return ";".join(sorted(edge_labels.get((vertex, other), "~") for other in cell))

    def refine(partition: list[tuple[int, ...]]) -> list[tuple[int, ...]]:
        current = partition
        while True:
            updated: list[tuple[int, ...]] = []
            changed = False
            for cell in current:
                buckets: dict[str, list[int]] = {}
                for vertex in cell:
                    signature = "|".join(
                        [vertex_colors[vertex]]
                        + [cell_key(vertex, other_cell) for other_cell in current]
                    )
                    buckets.setdefault(signature, []).append(vertex)
                if len(buckets) == 1:
                    updated.append(cell)
                    continue
                changed = True
                for signature in sorted(buckets):
                    updated.append(tuple(buckets[signature]))
            if not changed:
                return current
            current = updated

    def target_cell(partition: list[tuple[int, ...]]) -> int | None:
        best_index = None
        best_key = None
        for index, cell in enumerate(partition):
            if len(cell) <= 1:
                continue
            key = (len(cell), 0 if cell[0] < row_offset else 1, index)
            if best_key is None or key < best_key:
                best_index = index
                best_key = key
        return best_index

    def individualize(
        partition: list[tuple[int, ...]], cell_index: int, chosen: int
    ) -> list[tuple[int, ...]]:
        cell = partition[cell_index]
        remainder = tuple(vertex for vertex in cell if vertex != chosen)
        result = partition[:cell_index] + [(chosen,)]
        if remainder:
            result.append(remainder)
        result.extend(partition[cell_index + 1 :])
        return result

    def certificate(partition: list[tuple[int, ...]]) -> str:
        ordered = [cell[0] for cell in partition]
        colors = "|".join(vertex_colors[vertex] for vertex in ordered)
        edges = []
        for left_index, left in enumerate(ordered):
            for right in ordered[left_index + 1 :]:
                edges.append(edge_labels.get((left, right), "~"))
        return colors + "||" + "|".join(edges)

    initial_partition: list[tuple[int, ...]] = []
    factor_groups: dict[str, list[int]] = {}
    for index, factor in enumerate(factors):
        factor_groups.setdefault("F:" + _encode_factor(factor), []).append(index)
    for color in sorted(factor_groups):
        initial_partition.append(tuple(factor_groups[color]))
    row_groups: dict[str, list[int]] = {}
    for vertex in row_vertices:
        row_groups.setdefault(vertex_colors[vertex], []).append(vertex)
    for color in sorted(row_groups):
        initial_partition.append(tuple(row_groups[color]))

    best_certificate: str | None = None
    best_order = list(range(len(factors)))

    def search(partition: list[tuple[int, ...]]) -> None:
        nonlocal best_certificate, best_order
        refined = refine(partition)
        cell_index = target_cell(refined)
        if cell_index is None:
            current_certificate = certificate(refined)
            if best_certificate is None or current_certificate < best_certificate:
                best_certificate = current_certificate
                best_order = [cell[0] for cell in refined if cell[0] < row_offset]
            return
        for vertex in refined[cell_index]:
            search(individualize(refined, cell_index, vertex))

    search(initial_partition)
    return best_order


def canonicalize(
    factors: list[Factor],
    summands: list[list[list[int]]],
    summands_f: list[list[list[int]]] | None = None,
    k: int | None = None,
) -> tuple[list[Factor], ...]:
    """Return the canonical ambient order and canonical summand ordering.

    For degeneracy loci, pass *summands_f* and *k*. Returns a 4-tuple
    ``(factors, summands_e, summands_f, k)`` in that case.
    """

    is_degeneracy = summands_f is not None
    factors = list(factors)
    summands = _normalize_summands(summands, factors)
    if is_degeneracy:
        summands_f = _normalize_summands(summands_f, factors)
        if k is None or isinstance(k, bool) or not isinstance(k, int):
            raise TypeError("rank bound must be an integer")
        if k < 0:
            raise ValueError("rank bound must be non-negative")
    initial_order = sorted(
        range(len(factors)), key=lambda index: _encode_factor(factors[index])
    )
    factors, summands = _reorder(initial_order, factors, summands)
    if is_degeneracy:
        _, summands_f = _reorder(initial_order, factors, summands_f)
    if not is_degeneracy and not summands:
        return factors, summands
    total_dynkin_rank = sum(factor.rank for factor in factors)
    best_order = _canonical_factor_order(factors, summands, summands_f)
    if is_degeneracy:
        _, summands_f = _reorder(best_order, factors, summands_f)
    factors, summands = _reorder(best_order, factors, summands)
    summands.sort(key=lambda row: _encode_summand(row, total_dynkin_rank))
    if is_degeneracy:
        summands_f.sort(key=lambda row: _encode_summand(row, total_dynkin_rank))
        return factors, summands, summands_f, k
    return factors, summands


def encode_label(
    factors: list[Factor],
    summands: list[list[list[int]]],
    summands_f: list[list[list[int]]] | None = None,
    k: int | None = None,
) -> str:
    """Encode an ambient product and bundle as a canonical ZeroLocus62 label.

    For degeneracy loci, pass *summands_f* and *k*.
    """

    is_degeneracy = summands_f is not None
    result = canonicalize(factors, summands, summands_f, k)
    canon_factors = result[0]
    canon_summands = result[1]
    ambient_text = "".join(_encode_factor(factor) for factor in canon_factors)
    if not is_degeneracy and not canon_summands:
        return ambient_text
    total_dynkin_rank = sum(factor.rank for factor in canon_factors)
    if is_degeneracy:
        canon_summands_f = result[2]
        return (
            ambient_text
            + SEP
            + _encode_bundle_text(canon_summands, total_dynkin_rank)
            + LOCUS_SEP
            + _encode_bundle_text(canon_summands_f, total_dynkin_rank)
            + LOCUS_SEP
            + _encode_rank_bound(k)
        )
    return ambient_text + SEP + _encode_bundle_text(canon_summands, total_dynkin_rank)


def _decode_label_raw(label: str) -> dict:
    """Decode without canonical validation.  Returns a tagged dict."""

    ambient_text, separator, locus_text = label.partition(SEP)
    if not ambient_text:
        raise ValueError("ambient part must be non-empty")
    if separator and not locus_text:
        raise ValueError("separator requires a non-empty bundle")

    factors: list[Factor] = []
    position = 0
    while position < len(ambient_text):
        factor, position = _decode_factor(ambient_text, position)
        factors.append(factor)
    if not separator:
        return {"type": "ambient", "factors": factors, "summands": []}

    total_dynkin_rank = sum(factor.rank for factor in factors)
    locus_parts = locus_text.split(LOCUS_SEP)

    if len(locus_parts) == 1:
        summands = _decode_bundle_text(locus_text, factors, total_dynkin_rank)
        return {"type": "zero_locus", "factors": factors, "summands": summands}

    if len(locus_parts) != 3:
        raise ValueError(
            f"locus part must contain 0 or 2 dashes, got {len(locus_parts) - 1}"
        )

    bundle_text_e, bundle_text_f, rank_bound_text = locus_parts
    if not bundle_text_e:
        raise ValueError("bundle E must be non-empty")
    if not bundle_text_f:
        raise ValueError("bundle F must be non-empty")
    if not rank_bound_text:
        raise ValueError("rank bound must be non-empty")

    summands_e = _decode_bundle_text(bundle_text_e, factors, total_dynkin_rank)
    summands_f = _decode_bundle_text(bundle_text_f, factors, total_dynkin_rank)
    k = _decode_rank_bound(rank_bound_text)

    return {
        "type": "degeneracy_locus",
        "factors": factors,
        "summands_e": summands_e,
        "summands_f": summands_f,
        "k": k,
    }


def decode_label(label: str) -> dict:
    """Decode a ZeroLocus62 label into a tagged dict.

    Zero-locus labels return ``{"type": "zero_locus", "factors": ..., "summands": ...}``.
    Degeneracy-locus labels return ``{"type": "degeneracy_locus", "factors": ...,
    "summands_e": ..., "summands_f": ..., "k": ...}``.

    Raises ``ValueError`` if the label is not in canonical form.
    """

    result = _decode_label_raw(label)
    if result["type"] == "degeneracy_locus":
        re_encoded = encode_label(
            result["factors"],
            result["summands_e"],
            result["summands_f"],
            result["k"],
        )
    else:
        re_encoded = encode_label(result["factors"], result["summands"])
    if re_encoded != label:
        raise ValueError("label is not in canonical form")
    return result


def is_canonical(label: str) -> bool:
    """Return ``True`` if *label* is a valid canonical ZeroLocus62 label."""

    try:
        decode_label(label)
        return True
    except ValueError:
        return False


__all__ = [
    "BASE62",
    "BASE62_INDEX",
    "ESCAPE",
    "Factor",
    "LOCUS_SEP",
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
