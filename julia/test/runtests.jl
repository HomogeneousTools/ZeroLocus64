using Test
using JSON
using ZeroLocus64

const REPO_ROOT = normpath(joinpath(@__DIR__, "..", ".."))

function factor_from_payload(payload)
    return Factor(
        only(String(payload["group"])),
        Int(payload["rank"]),
        Int(payload["mask"]),
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
    @test ZeroLocus64.STANDARD_NAME == "ZeroLocus64"
    @test ZeroLocus64.SEP == '.'
    @test ZeroLocus64.ESCAPE == '0'
    @test length(ZeroLocus64.BASE64) == 64
    @test startswith(ZeroLocus64.BASE64, "0123456789")
    @test endswith(ZeroLocus64.BASE64, "-_")
end

@testset "Base64URL Helpers" begin
    payload = UInt8[0xFB, 0xFF]
    @test base64url_encode(payload) == "-_y"
    @test base64url_decode("-_y") == payload
end

@testset "Specification Examples" begin
    examples = [
        ("1", [Factor('A', 1, 1)], Vector{Vector{Vector{Int}}}()),
        ("1.21", [Factor('A', 1, 1)], [[[1]]]),
        ("1.2021", [Factor('A', 1, 1)], [[[0]], [[1]]]),
        ("30", [Factor('A', 3, 1)], Vector{Vector{Vector{Int}}}()),
        ("30.24", [Factor('A', 3, 1)], [[[1, 0, 0]]]),
        ("30.2124", [Factor('A', 3, 1)], [[[1, 0, 0]], [[0, 0, 1]]]),
        ("31", [Factor('A', 3, 2)], Vector{Vector{Vector{Int}}}()),
        ("53", [Factor('A', 5, 4)], Vector{Vector{Vector{Int}}}()),
        ("34", [Factor('A', 3, 5)], Vector{Vector{Vector{Int}}}()),
        ("I0", [Factor('B', 3, 1)], Vector{Vector{Vector{Int}}}()),
        ("I0.24", [Factor('B', 3, 1)], [[[1, 0, 0]]]),
        ("KU", [Factor('B', 5, 31)], Vector{Vector{Vector{Int}}}()),
        ("lF", [Factor('D', 5, 16)], Vector{Vector{Vector{Int}}}()),
        ("y0_", [Factor('E', 7, 64)], Vector{Vector{Vector{Int}}}()),
        ("G000", [Factor('A', 16, 1)], Vector{Vector{Vector{Int}}}()),
        ("0A1H000", [Factor('A', 17, 1)], Vector{Vector{Vector{Int}}}()),
        (
            "11111.2V",
            [
                Factor('A', 1, 1),
                Factor('A', 1, 1),
                Factor('A', 1, 1),
                Factor('A', 1, 1),
                Factor('A', 1, 1),
            ],
            [[[1], [1], [1], [1], [1]]],
        ),
        ("11.23", [Factor('A', 1, 1), Factor('A', 1, 1)], [[[1], [1]]]),
        ("11.2122", [Factor('A', 1, 1), Factor('A', 1, 1)], [[[1], [0]], [[0], [1]]]),
    ]
    for (label, factors, summands) in examples
        @test encode_label(factors, summands) == label
        @test decode_label(label) == canonicalize(factors, summands)
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
        @test decode_label(label) == (factors, summands)
    end

    indexed = Dict(String(case["name"]) => case for case in CURATED_CASES)
    canonical_case = indexed["equal_factor_block_global_choice"]
    factors = factors_from_case(canonical_case)
    summands = summands_from_case(canonical_case)
    @test encode_label(reverse(factors), reverse(summands)) == canonical_case["label"]
end

@testset "Corpus Vectors" begin
    @test length(CORPUS_CASES) == 2088
    for case in CORPUS_CASES
        factors = factors_from_case(case)
        summands = summands_from_case(case)
        label = String(case["label"])
        @test encode_label(factors, summands) == label
        @test decode_label(label) == (factors, summands)
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
    @test round(sum(lengths) / length(lengths); digits = 2) < 16.0
    @test lengths[ceil(Int, 0.5 * length(lengths))] <= 15
    @test lengths[ceil(Int, 0.9 * length(lengths))] <= 20
    @test last(lengths) >= 30
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
    assert_decode_error("11.1", "invalid bundle base digit")
    assert_decode_error("11.2", "summand truncated")
    assert_decode_error("30.21.", "invalid bundle base digit")
end
