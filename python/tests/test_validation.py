from __future__ import annotations

import pytest

from zerolocus62 import Factor, canonicalize, decode_label, encode_label


def test_repeated_summands_remain_explicit() -> None:
    assert encode_label([Factor("A", 1, 1)], [[[1]], [[1]]]) == "1.00"


def test_high_coefficients_choose_larger_bases() -> None:
    label = encode_label([Factor("A", 1, 1)], [[[42]]])
    assert label.startswith("1.")
    result = decode_label(label)
    assert result["factors"] == [Factor("A", 1, 1)]
    assert result["summands"] == [[[42]]]


def test_negative_coefficients_use_signed_rows() -> None:
    label = encode_label([Factor("A", 1, 1)], [[[-1]]])
    assert label == "1.z220"
    result = decode_label(label)
    assert result["factors"] == [Factor("A", 1, 1)]
    assert result["summands"] == [[[-1]]]


def test_multiple_summands_may_use_different_bases() -> None:
    factors = [Factor("A", 1, 1), Factor("A", 1, 1)]
    summands = [[[1], [0]], [[5], [0]], [[12], [0]]]
    label = encode_label(factors, summands)
    result = decode_label(label)
    canon = canonicalize(factors, summands)
    assert result["factors"] == canon[0]
    assert result["summands"] == canon[1]


def test_invalid_dynkin_type_rank_pairs_are_rejected_on_encode() -> None:
    with pytest.raises(ValueError, match="invalid Dynkin type/rank pair"):
        encode_label([Factor("G", 7, 64)], [])


def test_weight_vectors_must_match_dynkin_rank() -> None:
    with pytest.raises(ValueError, match="highest-weight length"):
        encode_label([Factor("A", 2, 1)], [[[1]]])


@pytest.mark.parametrize(
    "label",
    [
        "H0.0",
        "iF",
        "u11",
        "0A1H000",
        "0B1H000",
    ],
)
def test_non_a_and_escape_examples_decode(label: str) -> None:
    result = decode_label(label)
    assert result["factors"]
