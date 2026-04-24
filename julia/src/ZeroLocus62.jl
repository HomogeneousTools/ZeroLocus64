"""
    ZeroLocus62

    Reference Julia implementation of the ZeroLocus62 v2.1 label codec.

This module implements the ZeroLocus62 v2.1 specification using the Base62
alphabet `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`.
"""
module ZeroLocus62

using Base62: BASE62_ALPHABET

export Factor,
    LOCUS_SEP, canonicalize, decode_label, encode_label, is_canonical, marked_nodes

const STANDARD_NAME = "ZeroLocus62"
const BASE62_CHARS = Char.(BASE62_ALPHABET)
const BASE62 = String(BASE62_CHARS)
const BASE62_INDEX =
    Dict(character => value - 1 for (value, character) in enumerate(BASE62_CHARS))

const SEP = '.'
const LOCUS_SEP = '-'
const ESCAPE = BASE62_CHARS[1]
const SIGNED_BASE_MARKER = BASE62_CHARS[2]
const TYPE_ORDER = Set(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
const TYPE_TABLE = vcat(
    [('A', rank) for rank = 1:15],
    [('B', rank) for rank = 2:15],
    [('C', rank) for rank = 3:15],
    [('D', rank) for rank = 4:15],
    [('E', 6), ('E', 7), ('E', 8)],
    [('F', 4)],
    [('G', 2)],
)
const TYPE_CHARS = BASE62_CHARS[2:(1+length(TYPE_TABLE))]
const TYPE_INDEX = Dict(entry => index for (index, entry) in enumerate(TYPE_TABLE))
const TYPE_CHAR_INDEX =
    Dict(character => index for (index, character) in enumerate(TYPE_CHARS))

valid_type_rank(group::Char, rank::Int) = (
    (group == 'A' && rank >= 1) ||
    (group == 'B' && rank >= 2) ||
    (group == 'C' && rank >= 3) ||
    (group == 'D' && rank >= 4) ||
    (group == 'E' && rank in (6, 7, 8)) ||
    (group == 'F' && rank == 4) ||
    (group == 'G' && rank == 2)
)

function validate_type_rank(group::Char, rank::Int)
    valid_type_rank(group, rank) ||
        throw(ArgumentError("invalid Dynkin type/rank pair $(group)$(rank)"))
end

"""
    Factor(group, rank, mask)

One irreducible Dynkin factor in the ambient product.

`mask` is stored as a bitset: bit `j` marks Dynkin node `j + 1`.
"""
struct Factor
    group::Char
    rank::Int
    mask::BigInt
    Factor(group::Char, rank::Int, mask::Integer) = new(group, rank, BigInt(mask))
end

Base.:(==)(a::Factor, b::Factor) =
    a.group == b.group && a.rank == b.rank && a.mask == b.mask
Base.hash(a::Factor, h::UInt) = hash(a.mask, hash(a.rank, hash(a.group, h)))

function validate_factor(factor::Factor)
    validate_type_rank(factor.group, factor.rank)
    1 <= big(factor.mask) < (big(1) << factor.rank) ||
        throw(ArgumentError("mask out of range"))
end

"""
    marked_nodes(factor)

Return the marked Dynkin nodes as 1-based indices.
"""
marked_nodes(factor::Factor) =
    [node for node = 1:factor.rank if ((factor.mask >> (node - 1)) & 1) == 1]

function mask_width(rank::Int)
    width = 0
    capacity = big(1)
    while capacity <= (big(1) << rank) - 2
        width += 1
        capacity *= 62
    end
    return width
end

function encode_characters(value::Integer, width::Int)
    width >= 0 || throw(ArgumentError("width must be non-negative"))
    if width == 0
        value == 0 || throw(ArgumentError("non-zero value does not fit in width 0"))
        return ""
    end
    integer_value = BigInt(value)
    0 <= integer_value < big(62)^width ||
        throw(ArgumentError("value does not fit in character width"))
    characters = Vector{Char}(undef, width)
    for i = width:-1:1
        characters[i] = BASE62_CHARS[Int(integer_value%62)+1]
        integer_value ÷= 62
    end
    return String(characters)
end

function decode_characters(text::AbstractString)
    isempty(text) && return big(0)
    value = big(0)
    for ch in text
        value = value * 62 + BASE62_INDEX[ch]
    end
    return value
end

function encode_natural(value::Int)
    value > 0 || throw(ArgumentError("natural must be positive"))
    width = 1
    capacity = big(62)
    while value >= capacity
        width += 1
        capacity *= 62
    end
    return encode_characters(value, width)
end

function encode_factor(factor::Factor)
    validate_factor(factor)
    width = mask_width(factor.rank)
    index = get(TYPE_INDEX, (factor.group, factor.rank), 0)
    index != 0 &&
        return string(TYPE_CHARS[index], encode_characters(factor.mask - 1, width))
    rank_characters = encode_natural(factor.rank)
    return string(
        ESCAPE,
        factor.group,
        encode_characters(length(rank_characters), 1),
        rank_characters,
        encode_characters(factor.mask - 1, width),
    )
end

function decode_factor(text::AbstractString, position::Int)
    position <= lastindex(text) || throw(ArgumentError("unexpected end decoding factor"))
    lead_char = text[position]
    if lead_char == ESCAPE
        position + 2 <= lastindex(text) || throw(ArgumentError("factor escape truncated"))
        group = text[position+1]
        group in TYPE_ORDER || throw(ArgumentError("unknown Dynkin type $(repr(group))"))
        rank_length = Int(decode_characters(string(text[position+2])))
        rank_length > 0 || throw(ArgumentError("escaped rank length must be positive"))
        start = position + 3
        stop = start + rank_length - 1
        stop <= lastindex(text) || throw(ArgumentError("escaped rank truncated"))
        rank = Int(decode_characters(SubString(text, start, stop)))
        position = stop + 1
    else
        index = get(TYPE_CHAR_INDEX, lead_char, 0)
        index != 0 ||
            throw(ArgumentError("unknown standard factor character $(repr(lead_char))"))
        group, rank = TYPE_TABLE[index]
        position += 1
    end
    validate_type_rank(group, rank)
    stop = position + mask_width(rank) - 1
    stop <= lastindex(text) || throw(ArgumentError("mask truncated"))
    mask =
        stop >= position ? decode_characters(SubString(text, position, stop)) + 1 : big(1)
    1 <= mask < (big(1) << rank) || throw(ArgumentError("mask out of range"))
    return Factor(group, rank, mask), stop + 1
end

row_base(row) = max(
    2,
    maximum((coefficient for weights in row for coefficient in weights); init = 1) + 1,
)

zigzag_encode(value::Int) = value >= 0 ? 2 * value : -2 * value - 1
zigzag_decode(value::Int) = iseven(value) ? value ÷ 2 : -(value ÷ 2) - 1

function normalize_summands(summands::Vector{Vector{Vector{Int}}}, factors::Vector{Factor})
    result = Vector{Vector{Vector{Int}}}()
    for row in summands
        length(row) == length(factors) ||
            throw(ArgumentError("summand row factor count mismatch"))
        typed_row = Vector{Vector{Int}}()
        for (weights, factor) in zip(row, factors)
            length(weights) == factor.rank ||
                throw(ArgumentError("highest-weight length must match the Dynkin rank"))
            push!(typed_row, copy(weights))
        end
        push!(result, typed_row)
    end
    return result
end

function row_digits(row)
    digits = Int[]
    signed = false
    for weights in row, coefficient in weights
        coefficient < 0 && (signed = true)
        push!(digits, coefficient)
    end
    signed || return false, digits
    return true, zigzag_encode.(digits)
end

function row_value(digits::Vector{Int}, base::Int)
    value = big(0)
    for digit in digits
        value = value * base + digit
    end
    return value
end

function summand_width(total_dynkin_rank::Int, base::Int)
    base >= 2 || throw(ArgumentError("bundle base must be at least 2"))
    width = 1
    capacity = big(62)
    while capacity < big(base)^total_dynkin_rank
        width += 1
        capacity *= 62
    end
    return width
end

function encode_summand(row, total_dynkin_rank::Int)
    signed, digits = row_digits(row)
    base = max(2, maximum(digits; init = 1) + 1)
    width = summand_width(total_dynkin_rank, base)
    value_chars = encode_characters(row_value(digits, base), width)
    prefix = signed ? string(SIGNED_BASE_MARKER) : ""
    if base < 62
        return string(prefix, encode_characters(base, 1), value_chars)
    end
    base_characters = encode_natural(base)
    return string(
        prefix,
        ESCAPE,
        encode_characters(length(base_characters), 1),
        base_characters,
        value_chars,
    )
end

function encode_bundle_text(summands::Vector{Vector{Vector{Int}}}, total_dynkin_rank::Int)
    return join(encode_summand.(summands, Ref(total_dynkin_rank)))
end

function decode_bundle_base(bundle_text::AbstractString, position::Int)
    position <= lastindex(bundle_text) || throw(ArgumentError("unexpected end decoding bundle base"))
    base_character = bundle_text[position]
    base_value = get(BASE62_INDEX, base_character, -1)
    base_value >= 0 ||
        throw(ArgumentError("invalid bundle base character $(repr(base_character))"))
    if base_value == 0
        position + 1 <= lastindex(bundle_text) ||
            throw(ArgumentError("escaped base truncated"))
        base_len = Int(decode_characters(string(bundle_text[position+1])))
        base_len > 0 || throw(ArgumentError("escaped base length must be positive"))
        base_start = position + 2
        base_stop = base_start + base_len - 1
        base_stop <= lastindex(bundle_text) ||
            throw(ArgumentError("escaped base truncated"))
        base = Int(decode_characters(SubString(bundle_text, base_start, base_stop)))
        base >= 62 || throw(ArgumentError("escaped base must be at least 62"))
        return base, base_stop + 1
    elseif base_value == 1
        throw(ArgumentError("bundle base character 1 is reserved"))
    else
        return base_value, position + 1
    end
end

function decode_bundle_text(
    bundle_text::AbstractString,
    factors::Vector{Factor},
    total_dynkin_rank::Int,
)
    summands = Vector{Vector{Vector{Int}}}()
    position = 1
    while position <= lastindex(bundle_text)
        signed = false
        if get(BASE62_INDEX, bundle_text[position], -1) == 1
            signed = true
            position += 1
        end
        base, position = decode_bundle_base(bundle_text, position)
        width = summand_width(total_dynkin_rank, base)
        start = position
        stop = start + width - 1
        stop <= lastindex(bundle_text) || throw(ArgumentError("summand truncated"))
        value = decode_characters(SubString(bundle_text, start, stop))
        position = stop + 1

        flat_coefficients = Vector{Int}(undef, total_dynkin_rank)
        for index = total_dynkin_rank:-1:1
            flat_coefficients[index] = Int(value % base)
            value ÷= base
        end
        value == 0 || throw(ArgumentError("packed value exceeds range"))
        if signed
            flat_coefficients = zigzag_decode.(flat_coefficients)
        end

        row = Vector{Vector{Int}}()
        offset = 1
        for factor in factors
            push!(row, flat_coefficients[offset:(offset+factor.rank-1)])
            offset += factor.rank
        end
        push!(summands, row)
    end
    return summands
end

function encode_rank_bound(k::Int)
    k >= 0 || throw(ArgumentError("rank bound must be non-negative"))
    k == 0 && return string(BASE62_CHARS[1])
    characters = Char[]
    remaining = k
    while remaining > 0
        push!(characters, BASE62_CHARS[remaining%62+1])
        remaining ÷= 62
    end
    return String(reverse(characters))
end

function decode_rank_bound(text::AbstractString)
    isempty(text) && throw(ArgumentError("rank bound text must be non-empty"))
    if length(text) > 1 && get(BASE62_INDEX, text[1], -1) == 0
        throw(ArgumentError("rank bound has leading zeros"))
    end
    value = big(0)
    for ch in text
        char_value = get(BASE62_INDEX, ch, -1)
        char_value >= 0 ||
            throw(ArgumentError("invalid Base62 character in rank bound $(repr(ch))"))
        value = value * 62 + char_value
    end
    return Int(value)
end

function reorder(
    order::Vector{Int},
    factors::Vector{Factor},
    summands::Vector{Vector{Vector{Int}}},
)
    return [factors[index] for index in order],
    [[row[index] for index in order] for row in summands]
end

function column_profile(
    index::Int,
    summands::Vector{Vector{Vector{Int}}},
    summands_f::Union{Vector{Vector{Vector{Int}}},Nothing},
)
    profile = Any[Tuple(row[index]) for row in summands]
    if summands_f !== nothing
        push!(profile, :split)
        append!(profile, Tuple(row[index]) for row in summands_f)
    end
    return Tuple(profile)
end

function visit_unique_block_orders(
    callback::Function,
    block_positions::Vector{Int},
    summands::Vector{Vector{Vector{Int}}},
    summands_f::Union{Vector{Vector{Vector{Int}}},Nothing},
)
    buckets = Dict{Tuple,Vector{Int}}()
    for index in block_positions
        profile = column_profile(index, summands, summands_f)
        push!(get!(()->Int[], buckets, profile), index)
    end
    if length(buckets) == length(block_positions)
        function explore_permutations(working::Vector{Int}, position::Int)
            if position > length(working)
                callback(copy(working))
                return
            end
            for swap_index = position:length(working)
                working[position], working[swap_index] =
                    working[swap_index], working[position]
                explore_permutations(working, position + 1)
                working[position], working[swap_index] =
                    working[swap_index], working[position]
            end
        end
        explore_permutations(copy(block_positions), 1)
        return
    end

    groups = collect(values(buckets))
    counts = length.(groups)
    expanded = Tuple{Int,Int}[]

    function explore_multiset(position::Int)
        if position > length(block_positions)
            callback([groups[group_index][offset] for (group_index, offset) in expanded])
            return
        end
        for group_index = 1:length(groups)
            counts[group_index] == 0 && continue
            counts[group_index] -= 1
            push!(
                expanded,
                (group_index, length(groups[group_index]) - counts[group_index]),
            )
            explore_multiset(position + 1)
            pop!(expanded)
            counts[group_index] += 1
        end
    end

    explore_multiset(1)
end

"""
    canonicalize(factors, summands[, summands_f, k])

Return the canonical ambient order and canonical summand ordering.

For degeneracy loci, pass `summands_f` and `k`. Returns a 4-tuple
`(factors, summands_e, summands_f, k)` in that case.
"""
function canonicalize(
    factors::Vector{Factor},
    summands::Vector{Vector{Vector{Int}}},
    summands_f::Union{Vector{Vector{Vector{Int}}},Nothing} = nothing,
    k::Union{Int,Nothing} = nothing,
)
    is_degeneracy = summands_f !== nothing
    summands = normalize_summands(summands, factors)
    if is_degeneracy
        summands_f = normalize_summands(summands_f, factors)
        k !== nothing || throw(ArgumentError("rank bound must be non-negative"))
        k >= 0 || throw(ArgumentError("rank bound must be non-negative"))
    end
    initial_order =
        sort(collect(eachindex(factors)); by = index -> encode_factor(factors[index]))
    factors, summands = reorder(initial_order, factors, summands)
    if is_degeneracy
        _, summands_f = reorder(initial_order, factors, summands_f)
    end
    # Short-circuit: with empty summands the initial sort IS canonical — all
    # permutations of equal-factor blocks give the same (empty) signature, so
    # there is no need to enumerate them combinatorially.
    if !is_degeneracy && isempty(summands)
        return factors, summands
    end
    total_dynkin_rank = sum(factor.rank for factor in factors)
    factor_codes = encode_factor.(factors)
    equal_factor_blocks = Vector{Vector{Int}}()
    start = 1
    while start <= length(factors)
        stop = start + 1
        while stop <= length(factors) && factor_codes[stop] == factor_codes[start]
            stop += 1
        end
        push!(equal_factor_blocks, collect(start:(stop-1)))
        start = stop
    end

    function sorted_sig(rows)
        return Tuple(sort(encode_summand.(rows, Ref(total_dynkin_rank))))
    end

    if all(length(block_positions) == 1 for block_positions in equal_factor_blocks)
        sort!(summands; by = row -> encode_summand(row, total_dynkin_rank))
        if is_degeneracy
            sort!(summands_f; by = row -> encode_summand(row, total_dynkin_rank))
            return factors, summands, summands_f, k
        end
        return factors, summands
    end

    best_signature = nothing
    best_order = collect(eachindex(factors))
    current_order = Int[]

    function explore(block_index::Int)
        if block_index > length(equal_factor_blocks)
            _, reordered_e = reorder(current_order, factors, summands)
            signature = (sorted_sig(reordered_e),)
            if is_degeneracy
                _, reordered_f = reorder(current_order, factors, summands_f)
                signature = (sorted_sig(reordered_e), sorted_sig(reordered_f))
            end
            if best_signature === nothing || signature < best_signature
                best_signature = signature
                best_order = copy(current_order)
            end
            return
        end
        block_positions = equal_factor_blocks[block_index]
        if length(block_positions) == 1
            append!(current_order, block_positions)
            explore(block_index + 1)
            for _ = 1:length(block_positions)
                pop!(current_order)
            end
            return
        end
        visit_unique_block_orders(block_positions, summands, summands_f) do choice
            append!(current_order, choice)
            explore(block_index + 1)
            for _ = 1:length(choice)
                pop!(current_order)
            end
        end
    end

    explore(1)
    if is_degeneracy
        _, summands_f = reorder(best_order, factors, summands_f)
    end
    factors, summands = reorder(best_order, factors, summands)
    sort!(summands; by = row -> encode_summand(row, total_dynkin_rank))
    if is_degeneracy
        sort!(summands_f; by = row -> encode_summand(row, total_dynkin_rank))
        return factors, summands, summands_f, k
    end
    return factors, summands
end

"""
    encode_label(factors, summands[, summands_f, k])

Encode an ambient product and bundle as a canonical ZeroLocus62 label.

For degeneracy loci, pass `summands_f` and `k`.
"""
function encode_label(
    factors::Vector{Factor},
    summands::Vector{Vector{Vector{Int}}},
    summands_f::Union{Vector{Vector{Vector{Int}}},Nothing} = nothing,
    k::Union{Int,Nothing} = nothing,
)
    is_degeneracy = summands_f !== nothing
    result = canonicalize(factors, summands, summands_f, k)
    canon_factors = result[1]
    canon_summands = result[2]
    ambient_text = join(encode_factor.(canon_factors))
    if !is_degeneracy && isempty(canon_summands)
        return ambient_text
    end
    total_dynkin_rank = sum(factor.rank for factor in canon_factors)
    if is_degeneracy
        canon_summands_f = result[3]
        return string(
            ambient_text,
            SEP,
            encode_bundle_text(canon_summands, total_dynkin_rank),
            LOCUS_SEP,
            encode_bundle_text(canon_summands_f, total_dynkin_rank),
            LOCUS_SEP,
            encode_rank_bound(k),
        )
    end
    return string(ambient_text, SEP, encode_bundle_text(canon_summands, total_dynkin_rank))
end

"""
    decode_label(label)

Decode a ZeroLocus62 label into a named tuple.

Zero-locus labels return `(type=:zero_locus, factors=..., summands=...)`.
Degeneracy-locus labels return `(type=:degeneracy_locus, factors=...,
summands_e=..., summands_f=..., k=...)`.

Throws `ArgumentError` if the label is not in canonical form.
"""
function decode_label(label::AbstractString)
    result = _decode_label_raw(label)
    if result.type == :degeneracy_locus
        re_encoded =
            encode_label(result.factors, result.summands_e, result.summands_f, result.k)
    else
        re_encoded = encode_label(result.factors, result.summands)
    end
    if re_encoded != label
        throw(ArgumentError("label is not in canonical form"))
    end
    return result
end

function _decode_label_raw(label::AbstractString)
    ambient_text, separator, locus_text = split_label(label)
    isempty(ambient_text) && throw(ArgumentError("ambient part must be non-empty"))
    separator &&
        isempty(locus_text) &&
        throw(ArgumentError("separator requires a non-empty bundle"))

    factors = Factor[]
    position = 1
    while position <= lastindex(ambient_text)
        factor, position = decode_factor(ambient_text, position)
        push!(factors, factor)
    end
    separator || return (
        type = :ambient,
        factors = factors,
        summands = Vector{Vector{Vector{Int}}}(),
    )

    total_dynkin_rank = sum(factor.rank for factor in factors)
    locus_parts = split(locus_text, LOCUS_SEP)

    if length(locus_parts) == 1
        summands = decode_bundle_text(locus_text, factors, total_dynkin_rank)
        return (type = :zero_locus, factors = factors, summands = summands)
    end

    length(locus_parts) == 3 || throw(
        ArgumentError(
            "locus part must contain 0 or 2 dashes, got $(length(locus_parts) - 1)",
        ),
    )

    bundle_text_e, bundle_text_f, rank_bound_text = locus_parts
    isempty(bundle_text_e) && throw(ArgumentError("bundle E must be non-empty"))
    isempty(bundle_text_f) && throw(ArgumentError("bundle F must be non-empty"))
    isempty(rank_bound_text) && throw(ArgumentError("rank bound must be non-empty"))

    summands_e = decode_bundle_text(bundle_text_e, factors, total_dynkin_rank)
    summands_f = decode_bundle_text(bundle_text_f, factors, total_dynkin_rank)
    k = decode_rank_bound(rank_bound_text)

    return (
        type = :degeneracy_locus,
        factors = factors,
        summands_e = summands_e,
        summands_f = summands_f,
        k = k,
    )
end

function split_label(label::AbstractString)
    separator_index = findfirst(==(SEP), label)
    if separator_index === nothing
        return String(label), false, ""
    end
    ambient_text =
        separator_index == firstindex(label) ? "" :
        String(SubString(label, firstindex(label), prevind(label, separator_index)))
    locus_text =
        separator_index == lastindex(label) ? "" :
        String(SubString(label, nextind(label, separator_index), lastindex(label)))
    return ambient_text, true, locus_text
end

"""
    is_canonical(label)

Return `true` if `label` is a valid canonical ZeroLocus62 label.
"""
function is_canonical(label::AbstractString)
    try
        decode_label(label)
        return true
    catch e
        e isa ArgumentError || rethrow()
        return false
    end
end

end
