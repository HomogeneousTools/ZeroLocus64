"""
    ZeroLocus62

    Reference Julia implementation of the ZeroLocus62 v3.1 label codec.

This module implements the ZeroLocus62 v3.1 specification using the Base62
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
const MAX_SMALL_VALUE = 7
const DIRECT_ROW_CAPACITY = 58
const SMALL_PAIR_MARKER = BASE62_CHARS[59]
const SMALL_POSITIVE_MARKER = BASE62_CHARS[60]
const POSITIVE_SPARSE_MARKER = BASE62_CHARS[61]
const SIGNED_SPARSE_MARKER = BASE62_CHARS[62]

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

zigzag_encode(value::Int) = value >= 0 ? 2 * value : -2 * value - 1
zigzag_decode(value::Int) = iseven(value) ? value ÷ 2 : -(value ÷ 2) - 1

function encode_descriptor(value::Int)
    value > 0 || throw(ArgumentError("descriptor must be positive"))
    value <= 61 && return string(BASE62_CHARS[value+1])
    characters = encode_natural(value)
    length(characters) <= 61 || throw(ArgumentError("descriptor length exceeds hard limit"))
    return string(ESCAPE, encode_characters(length(characters), 1), characters)
end

function decode_descriptor(text::AbstractString, position::Int, name::AbstractString)
    position <= lastindex(text) || throw(ArgumentError("unexpected end decoding $(name)"))
    lead = get(BASE62_INDEX, text[position], -1)
    lead >= 0 ||
        throw(ArgumentError("invalid Base62 character in $(name) $(repr(text[position]))"))
    lead != 0 && return lead, position + 1
    position + 1 <= lastindex(text) || throw(ArgumentError("$(name) truncated"))
    width = Int(decode_characters(string(text[position+1])))
    width > 0 || throw(ArgumentError("$(name) length must be positive"))
    start = position + 2
    stop = start + width - 1
    stop <= lastindex(text) || throw(ArgumentError("$(name) truncated"))
    value = Int(decode_characters(SubString(text, start, stop)))
    value > 61 || throw(ArgumentError("escaped $(name) must be at least 62"))
    return value, stop + 1
end

function states_width(states::Integer)
    width = 0
    capacity = big(1)
    required = BigInt(states)
    while capacity < required
        width += 1
        capacity *= 62
    end
    return width
end

function big_binomial(n::Int, k::Int)
    (0 <= k <= n) || return big(0)
    choose = min(k, n - k)
    value = big(1)
    for index = 1:choose
        value = (value * (n - choose + index)) ÷ index
    end
    return value
end

function rank_support(total_dynkin_rank::Int, positions::Vector{Int})
    rank = big(0)
    previous = -1
    count = length(positions)
    for (index, position) in enumerate(positions)
        for candidate = (previous+1):(position-1)
            rank += big_binomial(total_dynkin_rank - 1 - candidate, count - index)
        end
        previous = position
    end
    return rank
end

function unrank_support(total_dynkin_rank::Int, count::Int, rank::Integer)
    0 <= count <= total_dynkin_rank || throw(ArgumentError("support size out of range"))
    positions = Int[]
    next_min = 0
    remaining_rank = BigInt(rank)
    for index = 1:count
        found = false
        for position = next_min:(total_dynkin_rank-1)
            block = big_binomial(total_dynkin_rank - 1 - position, count - index)
            if remaining_rank < block
                push!(positions, position)
                next_min = position + 1
                found = true
                break
            end
            remaining_rank -= block
        end
        found || throw(ArgumentError("support rank out of range"))
    end
    remaining_rank == 0 || throw(ArgumentError("support rank out of range"))
    return positions
end

function signed_digit(value::Int)
    value != 0 || throw(ArgumentError("signed sparse rows encode only non-zero values"))
    return zigzag_encode(value) - 1
end

decode_signed_digit(value::Int) = zigzag_decode(value + 1)

direct_small_limit(total_dynkin_rank::Int, max_small::Int = MAX_SMALL_VALUE) =
    min(max_small, DIRECT_ROW_CAPACITY ÷ total_dynkin_rank)

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

function row_value(digits::Vector{Int}, base::Int)
    value = big(0)
    for digit in digits
        value = value * base + digit
    end
    return value
end

function unpack_digits(value::Integer, base::Int, count::Int)
    remaining = BigInt(value)
    digits = Vector{Int}(undef, count)
    for index = count:-1:1
        digits[index] = Int(remaining % base)
        remaining ÷= base
    end
    remaining == 0 || throw(ArgumentError("packed value exceeds range"))
    return digits
end

function split_flat_row(flat_coefficients::Vector{Int}, factors::Vector{Factor})
    row = Vector{Vector{Int}}()
    offset = 1
    for factor in factors
        push!(row, flat_coefficients[offset:(offset+factor.rank-1)])
        offset += factor.rank
    end
    return row
end

function encode_summand(row, total_dynkin_rank::Int)
    flat_coefficients = collect(Iterators.flatten(row))
    positions = findall(!iszero, flat_coefficients) .- 1
    values = flat_coefficients[(positions .+ 1)]
    support_size = length(positions)
    small_limit = direct_small_limit(total_dynkin_rank)
    direct_pair_offset = total_dynkin_rank * small_limit
    direct_pair_capacity = direct_pair_offset + Int(big_binomial(total_dynkin_rank, 2))

    if support_size == 1 && !isempty(values) && 1 <= values[1] <= small_limit
        return string(BASE62_CHARS[(values[1]-1)*total_dynkin_rank+positions[1]+1])
    end
    if direct_pair_capacity <= DIRECT_ROW_CAPACITY && support_size == 2 && values == [1, 1]
        return string(
            BASE62_CHARS[direct_pair_offset+Int(
                rank_support(total_dynkin_rank, positions),
            )+1],
        )
    end
    if support_size == 2 && values == [1, 1]
        return string(
            SMALL_PAIR_MARKER,
            encode_characters(
                rank_support(total_dynkin_rank, positions),
                states_width(big_binomial(total_dynkin_rank, 2)),
            ),
        )
    end

    signed = any(value -> value < 0, values)
    if !signed && all(1 <= value <= MAX_SMALL_VALUE for value in values)
        text = string(SMALL_POSITIVE_MARKER, encode_descriptor(support_size + 1))
        support_size == 0 && return text
        text *= encode_characters(
            rank_support(total_dynkin_rank, positions),
            states_width(big_binomial(total_dynkin_rank, support_size)),
        )
        text *= encode_characters(
            row_value([value - 1 for value in values], MAX_SMALL_VALUE),
            states_width(big(MAX_SMALL_VALUE)^support_size),
        )
        return text
    end
    digits = signed ? signed_digit.(values) : [value - 1 for value in values]
    text = string(
        signed ? SIGNED_SPARSE_MARKER : POSITIVE_SPARSE_MARKER,
        encode_descriptor(support_size + 1),
    )
    support_size == 0 && return text
    text *= encode_characters(
        rank_support(total_dynkin_rank, positions),
        states_width(big_binomial(total_dynkin_rank, support_size)),
    )
    base = max(2, maximum(digits; init = 1) + 1)
    text *= encode_descriptor(base)
    text *= encode_characters(row_value(digits, base), states_width(big(base)^support_size))
    return text
end

function encode_bundle_text(summands::Vector{Vector{Vector{Int}}}, total_dynkin_rank::Int)
    return join(encode_summand.(summands, Ref(total_dynkin_rank)))
end

function decode_bundle_text(
    bundle_text::AbstractString,
    factors::Vector{Factor},
    total_dynkin_rank::Int,
)
    summands = Vector{Vector{Vector{Int}}}()
    position = 1
    small_limit = direct_small_limit(total_dynkin_rank)
    direct_pair_offset = total_dynkin_rank * small_limit
    direct_pair_capacity = direct_pair_offset + Int(big_binomial(total_dynkin_rank, 2))
    while position <= lastindex(bundle_text)
        lead = bundle_text[position]
        lead_value = get(BASE62_INDEX, lead, -1)
        lead_value >= 0 ||
            throw(ArgumentError("invalid bundle row lead character $(repr(lead))"))
        if small_limit > 0 && lead_value < direct_pair_offset
            flat_coefficients = zeros(Int, total_dynkin_rank)
            flat_coefficients[(lead_value%total_dynkin_rank)+1] =
                lead_value ÷ total_dynkin_rank + 1
            position += 1
            push!(summands, split_flat_row(flat_coefficients, factors))
            continue
        end
        if direct_pair_capacity <= DIRECT_ROW_CAPACITY &&
           direct_pair_offset <= lead_value < direct_pair_capacity
            flat_coefficients = zeros(Int, total_dynkin_rank)
            for support_position in
                unrank_support(total_dynkin_rank, 2, lead_value - direct_pair_offset)
                flat_coefficients[support_position+1] = 1
            end
            position += 1
            push!(summands, split_flat_row(flat_coefficients, factors))
            continue
        end
        if lead == SMALL_PAIR_MARKER
            position += 1
            support_width = states_width(big_binomial(total_dynkin_rank, 2))
            support_stop = position + support_width - 1
            support_stop <= lastindex(bundle_text) ||
                throw(ArgumentError("pair support rank truncated"))
            support_rank =
                support_width == 0 ? big(0) :
                decode_characters(SubString(bundle_text, position, support_stop))
            flat_coefficients = zeros(Int, total_dynkin_rank)
            for support_position in unrank_support(total_dynkin_rank, 2, support_rank)
                flat_coefficients[support_position+1] = 1
            end
            position = support_stop + 1
            push!(summands, split_flat_row(flat_coefficients, factors))
            continue
        end
        if lead == SMALL_POSITIVE_MARKER
            position += 1
            support_size_plus_one, position =
                decode_descriptor(bundle_text, position, "support size")
            support_size = support_size_plus_one - 1
            0 <= support_size <= total_dynkin_rank ||
                throw(ArgumentError("support size out of range"))
            flat_coefficients = zeros(Int, total_dynkin_rank)
            if support_size == 0
                push!(summands, split_flat_row(flat_coefficients, factors))
                continue
            end
            support_width = states_width(big_binomial(total_dynkin_rank, support_size))
            support_stop = position + support_width - 1
            support_stop <= lastindex(bundle_text) ||
                throw(ArgumentError("support rank truncated"))
            support_rank =
                support_width == 0 ? big(0) :
                decode_characters(SubString(bundle_text, position, support_stop))
            position = support_stop + 1
            support_positions =
                unrank_support(total_dynkin_rank, support_size, support_rank)
            value_width = states_width(big(MAX_SMALL_VALUE)^support_size)
            value_stop = position + value_width - 1
            value_stop <= lastindex(bundle_text) ||
                throw(ArgumentError("value payload truncated"))
            packed_value =
                value_width == 0 ? big(0) :
                decode_characters(SubString(bundle_text, position, value_stop))
            position = value_stop + 1
            values = unpack_digits(packed_value, MAX_SMALL_VALUE, support_size) .+ 1
            for (support_position, value) in zip(support_positions, values)
                flat_coefficients[support_position+1] = value
            end
            push!(summands, split_flat_row(flat_coefficients, factors))
            continue
        end
        (lead == POSITIVE_SPARSE_MARKER || lead == SIGNED_SPARSE_MARKER) ||
            throw(ArgumentError("invalid bundle row lead character $(repr(lead))"))
        signed = lead == SIGNED_SPARSE_MARKER
        position += 1
        support_size_plus_one, position =
            decode_descriptor(bundle_text, position, "support size")
        support_size = support_size_plus_one - 1
        0 <= support_size <= total_dynkin_rank ||
            throw(ArgumentError("support size out of range"))
        flat_coefficients = zeros(Int, total_dynkin_rank)
        if support_size == 0
            push!(summands, split_flat_row(flat_coefficients, factors))
            continue
        end
        support_width = states_width(big_binomial(total_dynkin_rank, support_size))
        support_stop = position + support_width - 1
        support_stop <= lastindex(bundle_text) ||
            throw(ArgumentError("support rank truncated"))
        support_rank =
            support_width == 0 ? big(0) :
            decode_characters(SubString(bundle_text, position, support_stop))
        support_rank < big_binomial(total_dynkin_rank, support_size) ||
            throw(ArgumentError("support rank out of range"))
        position = support_stop + 1
        support_positions = unrank_support(total_dynkin_rank, support_size, support_rank)
        base, position = decode_descriptor(bundle_text, position, "value base")
        base >= 2 || throw(ArgumentError("value base must be at least 2"))
        value_width = states_width(big(base)^support_size)
        value_stop = position + value_width - 1
        value_stop <= lastindex(bundle_text) ||
            throw(ArgumentError("value payload truncated"))
        packed_value =
            value_width == 0 ? big(0) :
            decode_characters(SubString(bundle_text, position, value_stop))
        position = value_stop + 1
        digits = unpack_digits(packed_value, base, support_size)
        values = signed ? decode_signed_digit.(digits) : digits .+ 1
        for (support_position, value) in zip(support_positions, values)
            flat_coefficients[support_position+1] = value
        end
        push!(summands, split_flat_row(flat_coefficients, factors))
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

serialize_weights(weights::Vector{Int}) = "[" * join(string.(weights), ",") * "]"

flat_row(row) = Tuple(Iterators.flatten(row))

function equal_factor_blocks(factors::Vector{Factor})
    return [block for block in factor_blocks(factors) if length(block) > 1]
end

function factor_blocks(factors::Vector{Factor})
    factor_codes = encode_factor.(factors)
    blocks = Vector{Vector{Int}}()
    start = 1
    for stop = 2:(length(factors)+1)
        if stop == length(factors) + 1 || factor_codes[stop] != factor_codes[start]
            push!(blocks, collect(start:(stop-1)))
            start = stop
        end
    end
    return blocks
end

function single_summand_factor_order(factors::Vector{Factor}, summand::Vector{Vector{Int}})
    order = collect(eachindex(factors))
    for block in equal_factor_blocks(factors)
        sorted_block = sort(block; by = index -> (Tuple(summand[index]), index))
        for (position, factor_index) in zip(block, sorted_block)
            order[position] = factor_index
        end
    end
    return order
end

function refine_row_groups(groups, column_values, factor_index::Int)
    refined = Vector{Vector{Int}}()
    for group in groups
        buckets = Dict{Tuple,Vector{Int}}()
        for row_index in group
            key = Tuple(column_values[factor_index][row_index])
            push!(get!(buckets, key, Int[]), row_index)
        end
        for key in sort(collect(keys(buckets)))
            push!(refined, buckets[key])
        end
    end
    return refined
end

function empty_suffix_certificate(groups)
    certificate = Vector{Vector{Int}}()
    for group in groups
        for _ in group
            push!(certificate, Int[])
        end
    end
    return certificate
end

function prepend_suffix_certificate(
    factor_index::Int,
    suffix_certificate,
    groups,
    column_values,
)
    certificate = Vector{Vector{Int}}()
    offset = 1
    for group in groups
        value = column_values[factor_index][first(group)]
        for suffix in @view suffix_certificate[offset:(offset+length(group)-1)]
            push!(certificate, vcat(value, suffix))
        end
        offset += length(group)
    end
    return certificate
end

function column_signature(
    index::Int,
    summands::Vector{Vector{Vector{Int}}},
    summands_f::Union{Vector{Vector{Vector{Int}}},Nothing},
)
    parts = Any[Tuple(Tuple(row[index]) for row in summands)]
    if summands_f !== nothing
        push!(parts, Tuple(Tuple(row[index]) for row in summands_f))
    end
    return Tuple(parts)
end

function canonical_factor_order_dp(
    factors::Vector{Factor},
    summands::Vector{Vector{Vector{Int}}},
    summands_f::Union{Vector{Vector{Vector{Int}}},Nothing},
)
    blocks = factor_blocks(factors)
    position_blocks = Vector{Vector{Int}}(undef, length(factors))
    for block in blocks
        for position in block
            position_blocks[position] = block
        end
    end

    initial_groups = [collect(eachindex(summands))]
    initial_groups_f = summands_f === nothing ? nothing : [collect(eachindex(summands_f))]
    memo = Dict{Any,Tuple{Vector{Int},Any}}()
    column_values = [
        [summands[row_index][index] for row_index in eachindex(summands)] for
        index in eachindex(factors)
    ]
    column_values_f =
        summands_f === nothing ? nothing :
        [
            [summands_f[row_index][index] for row_index in eachindex(summands_f)] for
            index in eachindex(factors)
        ]
    column_signatures =
        [column_signature(index, summands, summands_f) for index in eachindex(factors)]

    function groups_key(groups)
        return Tuple(Tuple(group) for group in groups)
    end

    function best_suffix(groups, groups_f, remaining::Vector{Int})
        if isempty(remaining)
            if summands_f === nothing
                return (Int[], (empty_suffix_certificate(groups),))
            end
            return (
                Int[],
                (empty_suffix_certificate(groups), empty_suffix_certificate(groups_f)),
            )
        end
        key = (
            groups_key(groups),
            groups_f === nothing ? nothing : groups_key(groups_f),
            Tuple(remaining),
        )
        if haskey(memo, key)
            return memo[key]
        end

        depth = length(factors) - length(remaining) + 1
        block = position_blocks[depth]
        candidates = [index for index in remaining if index in block]
        seen_signatures = Set{Any}()
        best_order = nothing
        best_certificate = nothing
        for candidate in candidates
            signature = column_signatures[candidate]
            signature in seen_signatures && continue
            push!(seen_signatures, signature)
            next_remaining = [index for index in remaining if index != candidate]
            next_groups = refine_row_groups(groups, column_values, candidate)
            next_groups_f =
                summands_f === nothing ? nothing :
                refine_row_groups(groups_f, column_values_f, candidate)
            suffix_order, suffix_certificate =
                best_suffix(next_groups, next_groups_f, next_remaining)
            current_certificate = if summands_f === nothing
                (
                    prepend_suffix_certificate(
                        candidate,
                        suffix_certificate[1],
                        next_groups,
                        column_values,
                    ),
                )
            else
                (
                    prepend_suffix_certificate(
                        candidate,
                        suffix_certificate[1],
                        next_groups,
                        column_values,
                    ),
                    prepend_suffix_certificate(
                        candidate,
                        suffix_certificate[2],
                        next_groups_f,
                        column_values_f,
                    ),
                )
            end
            if best_certificate === nothing || current_certificate < best_certificate
                best_certificate = current_certificate
                best_order = vcat([candidate], suffix_order)
            end
        end

        result = (best_order, best_certificate)
        memo[key] = result
        return result
    end

    return best_suffix(initial_groups, initial_groups_f, collect(eachindex(factors)))[1]
end

function canonical_factor_order(
    factors::Vector{Factor},
    summands::Vector{Vector{Vector{Int}}},
    summands_f::Union{Vector{Vector{Vector{Int}}},Nothing},
)
    length(factors) < 2 && return collect(eachindex(factors))
    if summands_f === nothing && length(summands) == 1
        return single_summand_factor_order(factors, summands[1])
    end
    blocks = equal_factor_blocks(factors)
    isempty(blocks) && return collect(eachindex(factors))
    return canonical_factor_order_dp(factors, summands, summands_f)
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
    # Short-circuit: with empty summands the initial ambient sort is already
    # canonical, because the graph-canonization step has no row vertices to
    # distinguish equal factors further.
    if !is_degeneracy && isempty(summands)
        return factors, summands
    end
    best_order = canonical_factor_order(factors, summands, summands_f)
    if is_degeneracy
        _, summands_f = reorder(best_order, factors, summands_f)
    end
    factors, summands = reorder(best_order, factors, summands)
    sort!(summands; by = flat_row)
    if is_degeneracy
        sort!(summands_f; by = flat_row)
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
