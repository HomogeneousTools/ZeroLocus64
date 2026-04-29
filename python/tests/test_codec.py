from __future__ import annotations

import pytest

from zerolocus62 import (
    BASE62,
    ESCAPE,
    LOCUS_SEP,
    SEP,
    STANDARD_NAME,
    Factor,
    canonicalize,
    decode_label,
    encode_label,
    is_canonical,
)


def factors_from_case(case: dict) -> list[Factor]:
    return [
        Factor(str(payload["group"]), int(payload["rank"]), int(payload["mask"]))
        for payload in case["factors"]
    ]


SPEC_EXAMPLES = [
    ("P1", [Factor("A", 1, 1)], [], "1"),
    ("P1 with O(1)", [Factor("A", 1, 1)], [[[1]]], "1.0"),
    ("P1 with O + O(1)", [Factor("A", 1, 1)], [[[0]], [[1]]], "1.0x1"),
    ("P3", [Factor("A", 3, 1)], [], "30"),
    ("P3 with O(1)", [Factor("A", 3, 1)], [[[1, 0, 0]]], "30.0"),
    ("P3 with O(-1)", [Factor("A", 3, 1)], [[[-1, 0, 0]]], "30.z2020"),
    ("P3 split bundle", [Factor("A", 3, 1)], [[[1, 0, 0]], [[0, 0, 1]]], "30.02"),
    ("Gr(2,4)", [Factor("A", 3, 2)], [], "31"),
    ("Gr(3,6)", [Factor("A", 5, 4)], [], "53"),
    ("Fl(1,3,4)", [Factor("A", 3, 5)], [], "34"),
    ("Q5", [Factor("B", 3, 1)], [], "H0"),
    ("Q5 with bundle", [Factor("B", 3, 1)], [[[1, 0, 0]]], "H0.0"),
    ("B5/B", [Factor("B", 5, 31)], [], "JU"),
    ("OGr(5,10)", [Factor("D", 5, 16)], [], "iF"),
    ("Freudenthal", [Factor("E", 7, 64)], [], "u11"),
    ("A15 boundary", [Factor("A", 15, 1)], [], "F000"),
    ("A16 escape", [Factor("A", 16, 1)], [], "0A1G000"),
    ("A17 escape", [Factor("A", 17, 1)], [], "0A1H000"),
    (
        "(P1)^5 diagonal",
        [
            Factor("A", 1, 1),
            Factor("A", 1, 1),
            Factor("A", 1, 1),
            Factor("A", 1, 1),
            Factor("A", 1, 1),
        ],
        [[[1], [1], [1], [1], [1]]],
        "11111.x6000",
    ),
    ("P1xP1 diagonal", [Factor("A", 1, 1), Factor("A", 1, 1)], [[[1], [1]]], "11.E"),
    (
        "P1xP1 split",
        [Factor("A", 1, 1), Factor("A", 1, 1)],
        [[[1], [0]], [[0], [1]]],
        "11.01",
    ),
    (
        "(P1)^3 v2.2 positive difference",
        [Factor("A", 1, 1), Factor("A", 1, 1), Factor("A", 1, 1)],
        [[[0], [0], [1]], [[0], [2], [0]]],
        "111.15",
    ),
    (
        "(P1)^3 v2.2 signed difference",
        [Factor("A", 1, 1), Factor("A", 1, 1), Factor("A", 1, 1)],
        [[[-1], [-1], [-1]], [[-1], [-1], [0]]],
        "111.z3020z420",
    ),
]


def test_public_constants_are_stable() -> None:
    assert STANDARD_NAME == "ZeroLocus62"
    assert SEP == "."
    assert ESCAPE == "0"
    assert len(BASE62) == 62
    assert BASE62.startswith("0123456789")
    assert BASE62.endswith("yz")


def test_factor_marked_nodes_reports_one_based_positions() -> None:
    assert Factor("A", 5, (1 << 0) | (1 << 2) | (1 << 4)).marked_nodes() == [1, 3, 5]


@pytest.mark.parametrize(("_name", "factors", "summands", "label"), SPEC_EXAMPLES)
def test_spec_examples_are_stable(
    _name: str,
    factors: list[Factor],
    summands: list[list[list[int]]],
    label: str,
) -> None:
    assert encode_label(factors, summands) == label
    result = decode_label(label)
    canon = canonicalize(factors, summands)
    assert result["factors"] == canon[0]
    assert result.get("summands", result.get("summands_e", [])) == canon[1]


def test_encode_label_canonicalizes_factor_order() -> None:
    assert (
        encode_label([Factor("A", 2, 1), Factor("A", 1, 1)], [[[0, 1], [1]]]) == "120.M"
    )
    assert (
        encode_label([Factor("A", 1, 1), Factor("A", 2, 1)], [[[1], [0, 1]]]) == "120.M"
    )


def test_curated_cases_cover_a_few_dozen_examples(curated_cases: list[dict]) -> None:
    assert len(curated_cases) >= 36


def test_curated_case_names_are_unique(curated_cases: list[dict]) -> None:
    names = [case["name"] for case in curated_cases]
    assert len(names) == len(set(names))


@pytest.mark.parametrize(
    ("label", "message"),
    [
        ("", "ambient part must be non-empty"),
        (".21", "ambient part must be non-empty"),
        ("30.", "separator requires a non-empty bundle"),
        ("0", "factor escape truncated"),
        ("0Z10", "unknown Dynkin type"),
        ("0G170_", "invalid Dynkin type/rank pair"),
        ("0A0", "escaped rank length must be positive"),
        ("0A2H", "escaped rank truncated"),
        ("0A1H", "mask truncated"),
        ("23", "mask out of range"),
        ("11.x", "unexpected end decoding support size"),
        ("11.2", "label is not in canonical form"),
        ("30.21.", "invalid bundle row lead character"),
    ],
)
def test_invalid_labels_raise_descriptive_errors(label: str, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        decode_label(label)


def test_curated_canonicalization_cases_match_their_expected_labels(
    curated_cases: list[dict],
) -> None:
    indexed = {case["name"]: case for case in curated_cases}
    case = indexed["equal_factor_block_global_choice"]
    factors = factors_from_case(case)
    summands = [list(reversed(row)) for row in case["summands"]]
    assert (
        encode_label(list(reversed(factors)), list(reversed(summands))) == case["label"]
    )


@pytest.mark.parametrize(
    ("label", "canonical"),
    [
        ("201.25", "120.M"),
        ("1.2120", "1.0x1"),
        ("11.2221", "11.01"),
        ("111.2136", "111.15"),
        ("111.123127", "111.z3020z420"),
    ],
)
def test_noncanonical_labels_are_rejected(label: str, canonical: str) -> None:
    with pytest.raises(ValueError, match="not in canonical form"):
        decode_label(label)
    assert decode_label(canonical) is not None


def test_is_canonical_on_valid_labels() -> None:
    assert is_canonical("1") is True
    assert is_canonical("1.0") is True
    assert is_canonical("11.01") is True
    assert is_canonical("30.0") is True


def test_is_canonical_on_noncanonical_labels() -> None:
    assert is_canonical("201.25") is False
    assert is_canonical("1.2120") is False
    assert is_canonical("11.2221") is False


def test_is_canonical_on_invalid_labels() -> None:
    assert is_canonical("") is False
    assert is_canonical(".21") is False
    assert is_canonical("0") is False


def test_escaped_base_round_trip_coeff_61() -> None:
    factors = [Factor("A", 1, 1)]
    summands = [[[61]]]
    label = encode_label(factors, summands)
    assert label == "1.y2zy"
    result = decode_label(label)
    canon = canonicalize(factors, summands)
    assert result["factors"] == canon[0]
    assert result["summands"] == canon[1]


def test_escaped_base_round_trip_coeff_100() -> None:
    factors = [Factor("A", 1, 1)]
    summands = [[[100]]]
    label = encode_label(factors, summands)
    assert label == "1.y2021c1b"
    result = decode_label(label)
    canon = canonicalize(factors, summands)
    assert result["factors"] == canon[0]
    assert result["summands"] == canon[1]


def test_escaped_base_mixed_standard_and_escaped() -> None:
    factors = [Factor("A", 1, 1)]
    summands = [[[61]], [[1]]]
    label = encode_label(factors, summands)
    assert label == "1.0y2zy"
    result = decode_label(label)
    canon = canonicalize(factors, summands)
    assert result["factors"] == canon[0]
    assert result["summands"] == canon[1]


def test_escaped_base_large_coefficient() -> None:
    factors = [Factor("A", 1, 1)]
    summands = [[[1000]]]
    label = encode_label(factors, summands)
    result = decode_label(label)
    canon = canonicalize(factors, summands)
    assert result["factors"] == canon[0]
    assert result["summands"] == canon[1]


def test_signed_weight_round_trip() -> None:
    factors = [Factor("A", 1, 1)]
    summands = [[[-1]]]
    label = encode_label(factors, summands)
    assert label == "1.z220"
    result = decode_label(label)
    canon = canonicalize(factors, summands)
    assert result["factors"] == canon[0]
    assert result["summands"] == canon[1]


def test_signed_weights_sort_canonically_across_equal_factors() -> None:
    factors = [Factor("A", 1, 1), Factor("A", 1, 1)]
    summands = [[[0], [-1]], [[-1], [0]]]
    assert encode_label(factors, summands) == "11.z2020z2120"


# --- Degeneracy locus tests ---


def test_locus_sep_constant() -> None:
    assert LOCUS_SEP == "-"


DEGENERACY_SPEC_EXAMPLES = [
    (
        "P1 id",
        [Factor("A", 1, 1)],
        [[[1]]],
        [[[1]]],
        0,
        "1.0-0-0",
    ),
    (
        "P1 signed source",
        [Factor("A", 1, 1)],
        [[[-1]]],
        [[[1]]],
        0,
        "1.z220-0-0",
    ),
    (
        "P1xP1",
        [Factor("A", 1, 1), Factor("A", 1, 1)],
        [[[1], [0]]],
        [[[0], [1]]],
        0,
        "11.1-0-0",
    ),
    (
        "P3 two-to-one",
        [Factor("A", 3, 1)],
        [[[1, 0, 0]], [[1, 0, 0]]],
        [[[2, 0, 0]]],
        1,
        "30.00-3-1",
    ),
]


@pytest.mark.parametrize(
    ("name", "factors", "summands_e", "summands_f", "k", "label"),
    DEGENERACY_SPEC_EXAMPLES,
)
def test_degeneracy_spec_examples(
    name: str,
    factors: list[Factor],
    summands_e: list[list[list[int]]],
    summands_f: list[list[list[int]]],
    k: int,
    label: str,
) -> None:
    assert encode_label(factors, summands_e, summands_f, k) == label
    result = decode_label(label)
    assert result["type"] == "degeneracy_locus"
    assert result["k"] == k
    assert len(result["summands_e"]) == len(summands_e)
    assert len(result["summands_f"]) == len(summands_f)


def test_degeneracy_decode_returns_tagged_result() -> None:
    result = decode_label("1.0-0-0")
    assert result["type"] == "degeneracy_locus"
    assert len(result["factors"]) == 1
    assert result["summands_e"] == [[[1]]]
    assert result["summands_f"] == [[[1]]]
    assert result["k"] == 0


def test_degeneracy_round_trip() -> None:
    factors = [Factor("A", 2, 1)]
    summands_e = [[[1, 0]]]
    summands_f = [[[0, 1]]]
    k = 0
    label = encode_label(factors, summands_e, summands_f, k)
    result = decode_label(label)
    assert result["type"] == "degeneracy_locus"
    assert (
        encode_label(
            result["factors"], result["summands_e"], result["summands_f"], result["k"]
        )
        == label
    )


def test_degeneracy_canonicalize_minimizes_e_then_f() -> None:
    factors = [Factor("A", 1, 1), Factor("A", 1, 1)]
    label1 = encode_label(factors, [[[1], [0]]], [[[0], [1]]], 0)
    label2 = encode_label(factors, [[[0], [1]]], [[[1], [0]]], 0)
    assert label1 == label2 == "11.1-0-0"


def test_degeneracy_rank_bound_gt_zero() -> None:
    factors = [Factor("A", 3, 1)]
    label = encode_label(factors, [[[1, 0, 0]]], [[[1, 0, 0]]], 5)
    assert label.endswith("-5")
    result = decode_label(label)
    assert result["k"] == 5


def test_degeneracy_rank_bound_62_uses_two_chars() -> None:
    factors = [Factor("A", 1, 1)]
    label = encode_label(factors, [[[1]]], [[[1]]], 62)
    assert label.endswith("-10")
    result = decode_label(label)
    assert result["k"] == 62


def test_is_canonical_degeneracy() -> None:
    assert is_canonical("1.0-0-0") is True
    assert is_canonical("11.1-0-0") is True
    assert is_canonical("30.00-3-1") is True


@pytest.mark.parametrize(
    ("label", "message"),
    [
        ("1.21-21-", "rank bound must be non-empty"),
        ("1.-21-0", "bundle E must be non-empty"),
        ("1.21--0", "bundle F must be non-empty"),
        ("1.21-21-21-0", "locus part must contain 0 or 2 dashes"),
    ],
)
def test_invalid_degeneracy_labels(label: str, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        decode_label(label)


def test_zero_locus_decode_tagged() -> None:
    result = decode_label("1.0")
    assert result["type"] == "zero_locus"
    assert result["summands"] == [[[1]]]


def test_ambient_decode_tagged() -> None:
    result = decode_label("1")
    assert result["type"] == "ambient"
    assert result["summands"] == []


def test_is_canonical_on_escaped_base_labels() -> None:
    assert is_canonical("1.y2zy") is True
    assert is_canonical("1.y2021c1b") is True
    assert is_canonical("1.0y2zy") is True
