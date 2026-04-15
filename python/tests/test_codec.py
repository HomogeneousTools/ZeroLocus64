from __future__ import annotations

import pytest

from zerolocus64 import (
    BASE62,
    ESCAPE,
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
    ("P1 with O(1)", [Factor("A", 1, 1)], [[[1]]], "1.21"),
    ("P1 with O + O(1)", [Factor("A", 1, 1)], [[[0]], [[1]]], "1.2021"),
    ("P3", [Factor("A", 3, 1)], [], "30"),
    ("P3 with O(1)", [Factor("A", 3, 1)], [[[1, 0, 0]]], "30.24"),
    ("P3 split bundle", [Factor("A", 3, 1)], [[[1, 0, 0]], [[0, 0, 1]]], "30.2124"),
    ("Gr(2,4)", [Factor("A", 3, 2)], [], "31"),
    ("Gr(3,6)", [Factor("A", 5, 4)], [], "53"),
    ("Fl(1,3,4)", [Factor("A", 3, 5)], [], "34"),
    ("Q5", [Factor("B", 3, 1)], [], "H0"),
    ("Q5 with bundle", [Factor("B", 3, 1)], [[[1, 0, 0]]], "H0.24"),
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
        "11111.2V",
    ),
    ("P1xP1 diagonal", [Factor("A", 1, 1), Factor("A", 1, 1)], [[[1], [1]]], "11.23"),
    (
        "P1xP1 split",
        [Factor("A", 1, 1), Factor("A", 1, 1)],
        [[[1], [0]], [[0], [1]]],
        "11.2122",
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
    assert decode_label(label) == canonicalize(factors, summands)


def test_encode_label_canonicalizes_factor_order() -> None:
    assert (
        encode_label([Factor("A", 2, 1), Factor("A", 1, 1)], [[[0, 1], [1]]])
        == "120.25"
    )
    assert (
        encode_label([Factor("A", 1, 1), Factor("A", 2, 1)], [[[1], [0, 1]]])
        == "120.25"
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
        ("11.1", "bundle base character 1 is reserved"),
        ("11.2", "summand truncated"),
        ("30.21.", "invalid bundle base character"),
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
    summands = case["summands"]
    assert (
        encode_label(list(reversed(factors)), list(reversed(summands))) == case["label"]
    )


@pytest.mark.parametrize(
    ("label", "canonical"),
    [
        ("201.25", "120.26"),
        ("1.2120", "1.2021"),
        ("11.2221", "11.2122"),
    ],
)
def test_noncanonical_labels_are_rejected(label: str, canonical: str) -> None:
    with pytest.raises(ValueError, match="not in canonical form"):
        decode_label(label)
    assert decode_label(canonical) is not None


def test_is_canonical_on_valid_labels() -> None:
    assert is_canonical("1") is True
    assert is_canonical("1.21") is True
    assert is_canonical("11.2122") is True
    assert is_canonical("30.24") is True


def test_is_canonical_on_noncanonical_labels() -> None:
    assert is_canonical("201.25") is False
    assert is_canonical("1.2120") is False
    assert is_canonical("11.2221") is False


def test_is_canonical_on_invalid_labels() -> None:
    assert is_canonical("") is False
    assert is_canonical(".21") is False
    assert is_canonical("0") is False
