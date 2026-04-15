"""
    ZeroLocus64

Reference Julia implementation of the ZeroLocus62 v1.1 label codec.

This module implements the ZeroLocus62 v1.1 specification using the Base62
alphabet `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`.
"""
module ZeroLocus64

using Base62: BASE62_ALPHABET

export Factor, canonicalize, decode_label, encode_label, is_canonical, marked_nodes

const STANDARD_NAME = "ZeroLocus62"
const BASE62_CHARS = Char.(BASE62_ALPHABET)
const BASE62 = String(BASE62_CHARS)
const BASE62_INDEX =
    Dict(character => value - 1 for (value, character) in enumerate(BASE62_CHARS))

const SEP = '.'
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

function row_value(row, base::Int)
    value = big(0)
    for weights in row, coefficient in weights
        value = value * base + coefficient
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
    base = row_base(row)
    width = summand_width(total_dynkin_rank, base)
    value_chars = encode_characters(row_value(row, base), width)
    if base < 62
        return string(encode_characters(base, 1), value_chars)
    end
    base_characters = encode_natural(base)
    return string(
        ESCAPE,
        encode_characters(length(base_characters), 1),
        base_characters,
        value_chars,
    )
end

function reorder(
    order::Vector{Int},
    factors::Vector{Factor},
    summands::Vector{Vector{Vector{Int}}},
)
    return [factors[index] for index in order],
    [[row[index] for index in order] for row in summands]
end

"""
    canonicalize(factors, summands)

Return the canonical ambient order and canonical summand ordering.

Distinct factors are sorted by their ambient codes. Equal-factor blocks are then
permuted only as far as needed to minimize the lexicographically sorted list of
encoded summand rows.
"""
function canonicalize(factors::Vector{Factor}, summands::Vector{Vector{Vector{Int}}})
    initial_order =
        sort(collect(eachindex(factors)); by = index -> encode_factor(factors[index]))
    factors, summands = reorder(initial_order, factors, summands)
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

    best_signature = nothing
    best_order = collect(eachindex(factors))
    current_order = Int[]

    function explore_block_permutations(
        block_positions::Vector{Int},
        position::Int,
        next_block::Int,
    )
        if position > length(block_positions)
            append!(current_order, block_positions)
            explore(next_block)
            for _ = 1:length(block_positions)
                pop!(current_order)
            end
            return
        end
        for swap_index = position:length(block_positions)
            block_positions[position], block_positions[swap_index] =
                block_positions[swap_index], block_positions[position]
            explore_block_permutations(block_positions, position + 1, next_block)
            block_positions[position], block_positions[swap_index] =
                block_positions[swap_index], block_positions[position]
        end
    end

    function explore(block_index::Int)
        if block_index > length(equal_factor_blocks)
            _, reordered_rows = reorder(current_order, factors, summands)
            signature = Tuple(sort(encode_summand.(reordered_rows, Ref(total_dynkin_rank))))
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
        explore_block_permutations(copy(block_positions), 1, block_index + 1)
    end

    explore(1)
    factors, summands = reorder(best_order, factors, summands)
    sort!(summands; by = row -> encode_summand(row, total_dynkin_rank))
    return factors, summands
end

"""
    encode_label(factors, summands)

Encode an ambient product and bundle as a canonical ZeroLocus62 label.

Inputs may be provided in noncanonical order; canonicalization is always applied
before serialization.
"""
function encode_label(factors::Vector{Factor}, summands::Vector{Vector{Vector{Int}}})
    factors, summands = canonicalize(factors, summands)
    ambient_text = join(encode_factor.(factors))
    isempty(summands) && return ambient_text
    total_dynkin_rank = sum(factor.rank for factor in factors)
    bundle_text = join(encode_summand.(summands, Ref(total_dynkin_rank)))
    return string(ambient_text, SEP, bundle_text)
end

"""
    decode_label(label)

Decode a ZeroLocus62 label into `(factors, summands)`.

The returned `summands` value is a vector of bundle rows, where each row stores
one weight vector per ambient factor.

Throws `ArgumentError` if the label is not in canonical form.
"""
function decode_label(label::AbstractString)
    factors, summands = _decode_label_raw(label)
    if encode_label(factors, summands) != label
        throw(ArgumentError("label is not in canonical form"))
    end
    return factors, summands
end

function _decode_label_raw(label::AbstractString)
    ambient_text, separator, bundle_text = split_label(label)
    isempty(ambient_text) && throw(ArgumentError("ambient part must be non-empty"))
    separator &&
        isempty(bundle_text) &&
        throw(ArgumentError("separator requires a non-empty bundle"))

    factors = Factor[]
    position = 1
    while position <= lastindex(ambient_text)
        factor, position = decode_factor(ambient_text, position)
        push!(factors, factor)
    end
    separator || return factors, Vector{Vector{Vector{Int}}}()

    total_dynkin_rank = sum(factor.rank for factor in factors)
    summands = Vector{Vector{Vector{Int}}}()
    position = 1
    while position <= lastindex(bundle_text)
        base_character = bundle_text[position]
        base_value = get(BASE62_INDEX, base_character, -1)
        base_value >= 0 ||
            throw(ArgumentError("invalid bundle base character $(repr(base_character))"))
        local base::Int
        if base_value == 0
            # Escaped base
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
            position = base_stop + 1
        elseif base_value == 1
            throw(ArgumentError("bundle base character 1 is reserved"))
        else
            base = base_value
            2 <= base < 62 || throw(
                ArgumentError("invalid bundle base character $(repr(base_character))"),
            )
            position += 1
        end
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

        row = Vector{Vector{Int}}()
        offset = 1
        for factor in factors
            push!(row, flat_coefficients[offset:(offset+factor.rank-1)])
            offset += factor.rank
        end
        push!(summands, row)
    end
    return factors, summands
end

function split_label(label::AbstractString)
    separator_index = findfirst(==(SEP), label)
    if separator_index === nothing
        return String(label), false, ""
    end
    ambient_text =
        separator_index == firstindex(label) ? "" :
        String(SubString(label, firstindex(label), prevind(label, separator_index)))
    bundle_text =
        separator_index == lastindex(label) ? "" :
        String(SubString(label, nextind(label, separator_index), lastindex(label)))
    return ambient_text, true, bundle_text
end

"""
    is_canonical(label)

Return `true` if `label` is a valid canonical ZeroLocus62 label.
"""
function is_canonical(label::AbstractString)
    local factors, summands
    try
        factors, summands = _decode_label_raw(label)
    catch e
        e isa ArgumentError || rethrow()
        return false
    end
    return encode_label(factors, summands) == label
end

end
