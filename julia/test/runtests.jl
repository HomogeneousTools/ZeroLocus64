using Test
using JSON
using ZeroLocus62

const REPO_ROOT = normpath(joinpath(@__DIR__, "..", ".."))

function factor_from_payload(payload)
    return Factor(
        only(String(payload["group"])),
        Int(payload["rank"]),
        BigInt(payload["mask"]),
    )
end

function factors_from_case(case)
    return [factor_from_payload(payload) for payload in case["factors"]]
end

function summands_from_case(case)
    result = Vector{Vector{Vector{Int}}}()
    for row in case["summands"]
        typed_row = Vector{Vector{Int}}()
        for weights in row
            push!(typed_row, Int.(weights))
        end
        push!(result, typed_row)
    end
    return result
end

function load_json(relpath)
    return JSON.parsefile(joinpath(REPO_ROOT, relpath))
end

valid_type_rank(group, rank) =
    (group == 'A' && rank >= 1) ||
    (group == 'B' && rank >= 2) ||
    (group == 'C' && rank >= 3) ||
    (group == 'D' && rank >= 4) ||
    (group == 'E' && rank in (6, 7, 8)) ||
    (group == 'F' && rank == 4) ||
    (group == 'G' && rank == 2)

function assert_argument_error(thunk, snippet)
    err = nothing
    try
        thunk()
    catch exc
        err = exc
    end
    @test err isa ArgumentError
    @test occursin(snippet, sprint(showerror, err))
end

function assert_decode_error(label, snippet)
    assert_argument_error(() -> decode_label(label), snippet)
end

const EXAMPLES = load_json("examples.json")
const CURATED_CASES = EXAMPLES["curated_cases"]
const CORPUS_CASES = EXAMPLES["corpus_cases"]

@testset "Constants" begin
    @test ZeroLocus62.STANDARD_NAME == "ZeroLocus62"
    @test ZeroLocus62.SEP == '.'
    @test ZeroLocus62.ESCAPE == '0'
    @test length(ZeroLocus62.BASE62) == 62
    @test startswith(ZeroLocus62.BASE62, "0123456789")
    @test endswith(ZeroLocus62.BASE62, "yz")
end

@testset "Specification Examples" begin
    examples = [
        ("1", [Factor('A', 1, 1)], Vector{Vector{Vector{Int}}}()),
        ("1.0", [Factor('A', 1, 1)], [[[1]]]),
        ("1.0x1", [Factor('A', 1, 1)], [[[0]], [[1]]]),
        ("30", [Factor('A', 3, 1)], Vector{Vector{Vector{Int}}}()),
        ("30.0", [Factor('A', 3, 1)], [[[1, 0, 0]]]),
        ("30.z2020", [Factor('A', 3, 1)], [[[-1, 0, 0]]]),
        ("30.02", [Factor('A', 3, 1)], [[[1, 0, 0]], [[0, 0, 1]]]),
        ("31", [Factor('A', 3, 2)], Vector{Vector{Vector{Int}}}()),
        ("53", [Factor('A', 5, 4)], Vector{Vector{Vector{Int}}}()),
        ("34", [Factor('A', 3, 5)], Vector{Vector{Vector{Int}}}()),
        ("H0", [Factor('B', 3, 1)], Vector{Vector{Vector{Int}}}()),
        ("H0.0", [Factor('B', 3, 1)], [[[1, 0, 0]]]),
        ("JU", [Factor('B', 5, 31)], Vector{Vector{Vector{Int}}}()),
        ("iF", [Factor('D', 5, 16)], Vector{Vector{Vector{Int}}}()),
        ("u11", [Factor('E', 7, 64)], Vector{Vector{Vector{Int}}}()),
        ("F000", [Factor('A', 15, 1)], Vector{Vector{Vector{Int}}}()),
        ("0A1G000", [Factor('A', 16, 1)], Vector{Vector{Vector{Int}}}()),
        ("0A1H000", [Factor('A', 17, 1)], Vector{Vector{Vector{Int}}}()),
        (
            "11111.x6000",
            [
                Factor('A', 1, 1),
                Factor('A', 1, 1),
                Factor('A', 1, 1),
                Factor('A', 1, 1),
                Factor('A', 1, 1),
            ],
            [[[1], [1], [1], [1], [1]]],
        ),
        ("11.E", [Factor('A', 1, 1), Factor('A', 1, 1)], [[[1], [1]]]),
        ("11.01", [Factor('A', 1, 1), Factor('A', 1, 1)], [[[1], [0]], [[0], [1]]]),
        (
            "111.15",
            [Factor('A', 1, 1), Factor('A', 1, 1), Factor('A', 1, 1)],
            [[[0], [0], [1]], [[0], [2], [0]]],
        ),
        (
            "111.z3020z420",
            [Factor('A', 1, 1), Factor('A', 1, 1), Factor('A', 1, 1)],
            [[[-1], [-1], [-1]], [[-1], [-1], [0]]],
        ),
    ]
    for (label, factors, summands) in examples
        @test encode_label(factors, summands) == label
        result = decode_label(label)
        canon = canonicalize(factors, summands)
        @test result.factors == canon[1]
        @test result.summands == canon[2]
    end
end

@testset "Curated Vectors" begin
    @test length(CURATED_CASES) >= 36
    seen = Set{String}()
    for case in CURATED_CASES
        factors = factors_from_case(case)
        summands = summands_from_case(case)
        label = String(case["label"])
        @test !(String(case["name"]) in seen)
        push!(seen, String(case["name"]))
        @test encode_label(factors, summands) == label
        result = decode_label(label)
        @test result.factors == factors
        @test result.summands == summands
    end

    indexed = Dict(String(case["name"]) => case for case in CURATED_CASES)
    canonical_case = indexed["equal_factor_block_global_choice"]
    factors = factors_from_case(canonical_case)
    summands = [reverse(row) for row in summands_from_case(canonical_case)]
    @test encode_label(reverse(factors), reverse(summands)) == canonical_case["label"]

end

@testset "Corpus Vectors" begin
    @test length(CORPUS_CASES) == 2088
    for case in CORPUS_CASES
        factors = factors_from_case(case)
        summands = summands_from_case(case)
        label = String(case["label"])
        @test encode_label(factors, summands) == label
        result = decode_label(label)
        @test result.factors == factors
        @test result.summands == summands
    end
end

@testset "Dynkin Classification" begin
    for case in CURATED_CASES
        @test all(
            valid_type_rank(only(String(factor["group"])), Int(factor["rank"])) for
            factor in case["factors"]
        )
    end
    for case in CORPUS_CASES
        @test all(
            valid_type_rank(only(String(factor["group"])), Int(factor["rank"])) for
            factor in case["factors"]
        )
    end
    assert_argument_error(
        () -> encode_label([Factor('G', 7, 64)], Vector{Vector{Vector{Int}}}()),
        "invalid Dynkin type/rank pair",
    )
end

@testset "Corpus Length Fields" begin
    for case in CORPUS_CASES
        @test Int(case["length"]) == length(String(case["label"]))
    end
end

@testset "Length Regression" begin
    lengths = sort([Int(case["length"]) for case in CORPUS_CASES])
    @test length(lengths) == 2088
    @test round(sum(lengths) / length(lengths); digits = 2) < 17.0
    @test lengths[ceil(Int, 0.5 * length(lengths))] <= 16
    @test lengths[ceil(Int, 0.9 * length(lengths))] <= 22
    @test last(lengths) >= 20
end

@testset "Validation Errors" begin
    assert_decode_error("", "ambient part must be non-empty")
    assert_decode_error(".21", "ambient part must be non-empty")
    assert_decode_error("30.", "separator requires a non-empty bundle")
    assert_decode_error("0", "factor escape truncated")
    assert_decode_error("0Z10", "unknown Dynkin type")
    assert_decode_error("0G170_", "invalid Dynkin type/rank pair")
    assert_decode_error("0A0", "escaped rank length must be positive")
    assert_decode_error("0A2H", "escaped rank truncated")
    assert_decode_error("0A1H", "mask truncated")
    assert_decode_error("23", "mask out of range")
    assert_decode_error("11.x", "unexpected end decoding support size")
    assert_decode_error("11.2", "label is not in canonical form")
    assert_decode_error("30.21.", "invalid bundle row lead character")
end

@testset "Non-Canonical Labels" begin
    assert_decode_error("201.25", "not in canonical form")
    assert_decode_error("1.2120", "not in canonical form")
    assert_decode_error("11.2221", "not in canonical form")
    assert_decode_error("111.2136", "not in canonical form")
    assert_decode_error("111.123127", "not in canonical form")

    @test decode_label("120.M") isa NamedTuple
    @test decode_label("1.0x1") isa NamedTuple
    @test decode_label("11.01") isa NamedTuple
    @test decode_label("111.15") isa NamedTuple
    @test decode_label("111.z3020z420") isa NamedTuple
end

@testset "is_canonical" begin
    @test is_canonical("1") == true
    @test is_canonical("1.0") == true
    @test is_canonical("11.01") == true
    @test is_canonical("30.0") == true

    @test is_canonical("201.25") == false
    @test is_canonical("1.2120") == false
    @test is_canonical("11.2221") == false

    @test is_canonical("") == false
    @test is_canonical(".21") == false
    @test is_canonical("0") == false
end

@testset "Factor marked_nodes" begin
    @test marked_nodes(Factor('A', 5, (1 << 0) | (1 << 2) | (1 << 4))) == [1, 3, 5]
end

@testset "encode_label canonicalizes factor order" begin
    @test encode_label([Factor('A', 2, 1), Factor('A', 1, 1)], [[[0, 1], [1]]]) == "120.M"
    @test encode_label([Factor('A', 1, 1), Factor('A', 2, 1)], [[[1], [0, 1]]]) == "120.M"
end

@testset "Validation" begin
    @test encode_label([Factor('A', 1, 1)], [[[1]], [[1]]]) == "1.00"

    label = encode_label([Factor('A', 1, 1)], [[[42]]])
    @test startswith(label, "1.")
    result = decode_label(label)
    @test result.factors == [Factor('A', 1, 1)]
    @test result.summands == [[[42]]]

    signed_label = encode_label([Factor('A', 1, 1)], [[[-1]]])
    @test signed_label == "1.z220"
    signed_result = decode_label(signed_label)
    @test signed_result.factors == [Factor('A', 1, 1)]
    @test signed_result.summands == [[[-1]]]

    factors = [Factor('A', 1, 1), Factor('A', 1, 1)]
    summands = [[[1], [0]], [[5], [0]], [[12], [0]]]
    label2 = encode_label(factors, summands)
    result2 = decode_label(label2)
    canon = canonicalize(factors, summands)
    @test result2.factors == canon[1]
    @test result2.summands == canon[2]
    @test encode_label(factors, [[[0], [-1]], [[-1], [0]]]) == "11.z2020z2120"

    for l in ["H0.0", "iF", "u11", "0A1H000", "0B1H000"]
        result = decode_label(l)
        @test length(result.factors) > 0
    end

    assert_argument_error(
        () -> encode_label([Factor('A', 2, 1)], [[[1]]]),
        "highest-weight length must match the Dynkin rank",
    )
end

@testset "Escaped Base Encoding" begin
    factors_61 = [Factor('A', 1, 1)]
    summands_61 = [[[61]]]
    @test encode_label(factors_61, summands_61) == "1.y2zy"
    canon_61 = canonicalize(factors_61, summands_61)
    result_61 = decode_label("1.y2zy")
    @test result_61.factors == canon_61[1]
    @test result_61.summands == canon_61[2]

    factors_100 = [Factor('A', 1, 1)]
    summands_100 = [[[100]]]
    @test encode_label(factors_100, summands_100) == "1.y2021c1b"
    canon_100 = canonicalize(factors_100, summands_100)
    result_100 = decode_label("1.y2021c1b")
    @test result_100.factors == canon_100[1]
    @test result_100.summands == canon_100[2]

    factors_mixed = [Factor('A', 1, 1)]
    summands_mixed = [[[61]], [[1]]]
    @test encode_label(factors_mixed, summands_mixed) == "1.0y2zy"
    canon_mixed = canonicalize(factors_mixed, summands_mixed)
    result_mixed = decode_label("1.0y2zy")
    @test result_mixed.factors == canon_mixed[1]
    @test result_mixed.summands == canon_mixed[2]

    factors_big = [Factor('A', 1, 1)]
    summands_big = [[[1000]]]
    label_big = encode_label(factors_big, summands_big)
    canon_big = canonicalize(factors_big, summands_big)
    result_big = decode_label(label_big)
    @test result_big.factors == canon_big[1]
    @test result_big.summands == canon_big[2]

    @test is_canonical("1.y2zy") == true
    @test is_canonical("1.y2021c1b") == true
    @test is_canonical("1.0y2zy") == true
end

# --- Degeneracy locus tests ---

@testset "Degeneracy Locus" begin
    @test LOCUS_SEP == '-'

    # Spec examples
    spec_cases = [
        ("P1 id", [Factor('A', 1, 1)], [[[1]]], [[[1]]], 0, "1.0-0-0"),
        ("P1 signed source", [Factor('A', 1, 1)], [[[-1]]], [[[1]]], 0, "1.z220-0-0"),
        (
            "P1xP1",
            [Factor('A', 1, 1), Factor('A', 1, 1)],
            [[[1], [0]]],
            [[[0], [1]]],
            0,
            "11.1-0-0",
        ),
        (
            "P3 two-to-one",
            [Factor('A', 3, 1)],
            [[[1, 0, 0]], [[1, 0, 0]]],
            [[[2, 0, 0]]],
            1,
            "30.00-3-1",
        ),
    ]

    @testset "spec: $(name)" for (name, factors, sE, sF, k, label) in spec_cases
        @test encode_label(factors, sE, sF, k) == label
        result = decode_label(label)
        @test result.type == :degeneracy_locus
        @test result.k == k
        @test length(result.summands_e) == length(sE)
        @test length(result.summands_f) == length(sF)
    end

    @testset "decode returns tagged result" begin
        result = decode_label("1.0-0-0")
        @test result.type == :degeneracy_locus
        @test length(result.factors) == 1
        @test result.summands_e == [[[1]]]
        @test result.summands_f == [[[1]]]
        @test result.k == 0
    end

    @testset "round-trip" begin
        factors = [Factor('A', 2, 1)]
        sE = [[[1, 0]]]
        sF = [[[0, 1]]]
        k = 0
        label = encode_label(factors, sE, sF, k)
        result = decode_label(label)
        @test result.type == :degeneracy_locus
        @test encode_label(
            result.factors,
            result.summands_e,
            result.summands_f,
            result.k,
        ) == label
    end

    @testset "canonicalize minimizes E then F" begin
        factors = [Factor('A', 1, 1), Factor('A', 1, 1)]
        label1 = encode_label(factors, [[[1], [0]]], [[[0], [1]]], 0)
        label2 = encode_label(factors, [[[0], [1]]], [[[1], [0]]], 0)
        @test label1 == label2 == "11.1-0-0"
    end

    @testset "rank bound k > 0" begin
        factors = [Factor('A', 3, 1)]
        label = encode_label(factors, [[[1, 0, 0]]], [[[1, 0, 0]]], 5)
        @test endswith(label, "-5")
        result = decode_label(label)
        @test result.k == 5
    end

    @testset "rank bound k=62 uses two chars" begin
        factors = [Factor('A', 1, 1)]
        label = encode_label(factors, [[[1]]], [[[1]]], 62)
        @test endswith(label, "-10")
        result = decode_label(label)
        @test result.k == 62
    end

    @testset "is_canonical degeneracy" begin
        @test is_canonical("1.0-0-0") == true
        @test is_canonical("11.1-0-0") == true
        @test is_canonical("30.00-3-1") == true
    end

    @testset "invalid degeneracy labels" begin
        @test_throws ArgumentError decode_label("1.0-0-")
        @test_throws ArgumentError decode_label("1.-0-0")
        @test_throws ArgumentError decode_label("1.0--0")
        @test_throws ArgumentError decode_label("1.0-0-0-0")
    end

    @testset "zero_locus decode tagged" begin
        result = decode_label("1.0")
        @test result.type == :zero_locus
        @test result.summands == [[[1]]]
    end

    @testset "ambient decode tagged" begin
        result = decode_label("1")
        @test result.type == :ambient
        @test result.summands == []
    end
end
