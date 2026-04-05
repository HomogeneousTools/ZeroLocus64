from __future__ import annotations

import pytest

from zerolocus64 import (
    BASE64,
    ESCAPE,
    SEP,
    STANDARD_NAME,
    Factor,
    base64url_decode,
    base64url_encode,
    canonicalize,
    decode_label,
    encode_label,
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
    ("Q5", [Factor("B", 3, 1)], [], "I0"),
    ("Q5 with bundle", [Factor("B", 3, 1)], [[[1, 0, 0]]], "I0.24"),
    ("B5/B", [Factor("B", 5, 31)], [], "KU"),
    ("OGr(5,10)", [Factor("D", 5, 16)], [], "lF"),
    ("Freudenthal", [Factor("E", 7, 64)], [], "y0_"),
    ("A16 boundary", [Factor("A", 16, 1)], [], "G000"),
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
    assert STANDARD_NAME == "ZeroLocus64"
    assert SEP == "."
    assert ESCAPE == "0"
    assert len(BASE64) == 64
    assert BASE64.startswith("0123456789")
    assert BASE64.endswith("-_")


def test_base64url_helpers_round_trip_bytes() -> None:
    payload = bytes([0xFB, 0xFF])
    assert base64url_encode(payload) == "-_y"
    assert base64url_decode("-_y") == payload


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
        ("11.1", "invalid bundle base digit"),
        ("11.2", "summand truncated"),
        ("30.21.", "invalid bundle base digit"),
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
