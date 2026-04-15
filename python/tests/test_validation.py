from __future__ import annotations

import pytest

from zerolocus62 import Factor, canonicalize, decode_label, encode_label


def test_repeated_summands_remain_explicit() -> None:
    assert encode_label([Factor("A", 1, 1)], [[[1]], [[1]]]) == "1.2121"


def test_high_coefficients_choose_larger_bases() -> None:
    label = encode_label([Factor("A", 1, 1)], [[[42]]])
    assert label.startswith("1.")
    assert decode_label(label) == ([Factor("A", 1, 1)], [[[42]]])


def test_multiple_summands_may_use_different_bases() -> None:
    factors = [Factor("A", 1, 1), Factor("A", 1, 1)]
    summands = [[[1], [0]], [[5], [0]], [[12], [0]]]
    label = encode_label(factors, summands)
    assert decode_label(label) == canonicalize(factors, summands)


def test_invalid_dynkin_type_rank_pairs_are_rejected_on_encode() -> None:
    with pytest.raises(ValueError, match="invalid Dynkin type/rank pair"):
        encode_label([Factor("G", 7, 64)], [])


@pytest.mark.parametrize(
    "label",
    [
        "H0.24",
        "iF",
        "u11",
        "0A1H000",
        "0B1H000",
    ],
)
def test_non_a_and_escape_examples_decode(label: str) -> None:
    factors, _ = decode_label(label)
    assert factors
