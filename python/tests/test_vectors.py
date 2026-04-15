from __future__ import annotations

from statistics import mean, median

from zerolocus64 import Factor, decode_label, encode_label


def factor_is_mathematically_valid(factor: Factor) -> bool:
    return (
        (factor.group == "A" and factor.rank >= 1)
        or (factor.group == "B" and factor.rank >= 2)
        or (factor.group == "C" and factor.rank >= 3)
        or (factor.group == "D" and factor.rank >= 4)
        or (factor.group == "E" and factor.rank in {6, 7, 8})
        or (factor.group == "F" and factor.rank == 4)
        or (factor.group == "G" and factor.rank == 2)
    )


def factors_from_case(case: dict) -> list[Factor]:
    return [
        Factor(str(payload["group"]), int(payload["rank"]), int(payload["mask"]))
        for payload in case["factors"]
    ]


def test_curated_vectors_round_trip(curated_cases: list[dict]) -> None:
    for case in curated_cases:
        factors = factors_from_case(case)
        summands = case["summands"]
        assert encode_label(factors, summands) == case["label"], case["name"]
        assert decode_label(case["label"]) == (factors, summands), case["name"]


def test_corpus_vectors_are_extensive(corpus_cases: list[dict]) -> None:
    assert len(corpus_cases) >= 2000


def test_curated_vectors_respect_dynkin_classification(
    curated_cases: list[dict],
) -> None:
    for case in curated_cases:
        factors = factors_from_case(case)
        assert all(factor_is_mathematically_valid(factor) for factor in factors), case[
            "name"
        ]


def test_corpus_vectors_respect_dynkin_classification(
    corpus_cases: list[dict],
) -> None:
    for case in corpus_cases:
        factors = factors_from_case(case)
        assert all(factor_is_mathematically_valid(factor) for factor in factors), case[
            "index"
        ]


def test_full_corpus_round_trip(corpus_cases: list[dict]) -> None:
    for case in corpus_cases:
        factors = factors_from_case(case)
        summands = case["summands"]
        assert encode_label(factors, summands) == case["label"], case["index"]
        assert decode_label(case["label"]) == (factors, summands), case["index"]


def test_corpus_length_fields_match_labels(corpus_cases: list[dict]) -> None:
    for case in corpus_cases:
        assert case["length"] == len(case["label"])


def test_corpus_length_statistics_stay_compact(corpus_cases: list[dict]) -> None:
    lengths = sorted(case["length"] for case in corpus_cases)
    assert len(lengths) == 2088
    assert round(mean(lengths), 2) < 17.0
    assert median(lengths) <= 16
    assert lengths[int(0.9 * len(lengths)) - 1] <= 22
    assert lengths[-1] >= 30
