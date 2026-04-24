-- -*- coding: utf-8 -*-

newPackage(
    "ZeroLocus62",
    Version => "2.2.0",
    Date => "April 24, 2026",
    Authors => {
        {Name => "Pieter Belmans", Email => "pieterbelmans@gmail.com"}},
    Headline => "ZeroLocus62 label codec for flag-variety bundles",
    Keywords => {"Encoding", "Representation Theory"},
    DebuggingMode => false
    )

export {
    "base62", "escapeCharacter", "locusSep", "sep", "signedBaseMarker",
    "standardName", "Factor", "canonicalize", "decodeLabel", "encodeLabel",
    "isCanonical", "markedNodes"
    }

-------------------------------------------------------------------------
-- Public constants and the standard ambient type table.
-------------------------------------------------------------------------

standardNameValue = "ZeroLocus62"
base62Value = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
sepValue = "."
locusSepValue = "-"
escapeValue = base62Value#0
signedBaseMarkerValue = base62Value#1
typeOrder = {"A", "B", "C", "D", "E", "F", "G"}

makeTypeTable = () -> (
    entries := {};

    for rank from 1 to 15 do entries = append(entries, {"A", rank});
    for rank from 2 to 15 do entries = append(entries, {"B", rank});
    for rank from 3 to 15 do entries = append(entries, {"C", rank});
    for rank from 4 to 15 do entries = append(entries, {"D", rank});

    join(entries, {{"E", 6}, {"E", 7}, {"E", 8}, {"F", 4}, {"G", 2}})
    )

typeTable = makeTypeTable()
typeChars = apply(#typeTable, index -> base62Value#(index + 1))
typeIndex = hashTable apply(
    #typeTable,
    index -> ((typeTable#index#0 | toString(typeTable#index#1)) => index))
typeCharIndex = hashTable apply(#typeChars, index -> (typeChars#index => index))
base62Index = hashTable apply(#base62Value, index -> (base62Value#index => index))

-------------------------------------------------------------------------
-- Small helpers for the ambient factors.
-------------------------------------------------------------------------

factorGroup = ambientFactor -> ambientFactor#"group"
factorRank = ambientFactor -> ambientFactor#"rank"
factorMask = ambientFactor -> ambientFactor#"mask"
typeKey = (group, rank) -> (toString group | toString rank)

validTypeRank = (group, rank) -> (
    g := toString group;

    (g == "A" and rank >= 1) or
    (g == "B" and rank >= 2) or
    (g == "C" and rank >= 3) or
    (g == "D" and rank >= 4) or
    (g == "E" and member(rank, {6, 7, 8})) or
    (g == "F" and rank == 4) or
    (g == "G" and rank == 2)
    )

validateTypeRank = (group, rank) -> (
    if not validTypeRank(group, rank) then
        error("invalid Dynkin type/rank pair " | toString group | toString rank);
    )

validateFactor = ambientFactor -> (
    validateTypeRank(factorGroup ambientFactor, factorRank ambientFactor);

    if not (
        1 <= factorMask ambientFactor and
        factorMask ambientFactor < 2^(factorRank ambientFactor)
        ) then error "mask out of range";
    )

Factor = (group, rank, mask) -> hashTable {
    "group" => toString group,
    "rank" => rank,
    "mask" => mask
    }

markedNodesInternal = ambientFactor -> (
    nodes := {};

    for node from 0 to factorRank(ambientFactor) - 1 do (
        if ((factorMask ambientFactor) // (2^node)) % 2 == 1 then
            nodes = append(nodes, node + 1);
        );

    nodes
    )

-------------------------------------------------------------------------
-- Fixed-width Base62 helpers.
-------------------------------------------------------------------------

maskWidth = rank -> (
    width := 0;
    capacity := 1;

    while capacity <= 2^rank - 2 do (
        width = width + 1;
        capacity = capacity * 62;
        );

    width
    )

encodeCharacters = (value, width) -> (
    if width < 0 then error "width must be non-negative";

    if width == 0 then (
        if value =!= 0 then error "non-zero value does not fit in width 0";
        return "";
        );

    if not (0 <= value and value < 62^width) then
        error "value does not fit in character width";

    chars := {};
    remaining := value;

    for i from 0 to width - 1 do (
        chars = prepend(base62Value#(remaining % 62), chars);
        remaining = remaining // 62;
        );

    result := "";
    for ch in chars do result = result | toString ch;

    result
    )

decodeCharacters = text -> (
    value := 0;

    for i from 0 to #text - 1 do (
        ch := text#i;

        if not (base62Index#?ch) then
            error("invalid base-62 character " | toString ch);

        value = value * 62 + base62Index#ch;
        );

    value
    )

encodeNatural = value -> (
    if value <= 0 then error "natural must be positive";

    width := 1;
    capacity := 62;

    while value >= capacity do (
        width = width + 1;
        capacity = capacity * 62;
        );

    encodeCharacters(value, width)
    )

findFirstCharacter = (text, character, start) -> (
    for i from start to #text - 1 do (
        if text#i == character then return i;
        );

    null
    )

-------------------------------------------------------------------------
-- Ambient factor encoding and decoding.
-------------------------------------------------------------------------

encodeFactor = ambientFactor -> (
    validateFactor ambientFactor;

    width := maskWidth(factorRank ambientFactor);
    key := typeKey(factorGroup ambientFactor, factorRank ambientFactor);

    if typeIndex#?key then (
        return toString(typeChars#(typeIndex#key)) |
            encodeCharacters((factorMask ambientFactor) - 1, width);
        );

    rankCharacters := encodeNatural(factorRank ambientFactor);

    toString escapeValue |
    factorGroup ambientFactor |
    encodeCharacters(#rankCharacters, 1) |
    rankCharacters |
    encodeCharacters((factorMask ambientFactor) - 1, width)
    )

decodeFactor = (text, position) -> (
    if position >= #text then error "unexpected end decoding factor";

    lead := text#position;

    if lead == escapeValue then (
        if position + 3 > #text then error "factor escape truncated";

        escapedGroup := toString(text#(position + 1));
        if not member(escapedGroup, typeOrder) then
            error("unknown Dynkin type " | escapedGroup);

        rankLength := decodeCharacters(toString(text#(position + 2)));
        if rankLength <= 0 then error "escaped rank length must be positive";

        rankStart := position + 3;
        if rankStart + rankLength > #text then error "escaped rank truncated";

        escapedRank := decodeCharacters(substring(text, rankStart, rankLength));
        nextMaskPosition := rankStart + rankLength;

        validateTypeRank(escapedGroup, escapedRank);

        maskStop := nextMaskPosition + maskWidth escapedRank;
        if maskStop > #text then error "mask truncated";

        escapedMask :=
            if maskStop > nextMaskPosition
            then decodeCharacters(substring(text, nextMaskPosition, maskStop - nextMaskPosition)) + 1
            else 1;

        if not (1 <= escapedMask and escapedMask < 2^escapedRank) then
            error "mask out of range";

        return {Factor(escapedGroup, escapedRank, escapedMask), maskStop};
        );

    if not (typeCharIndex#?lead) then
        error("unknown standard factor character " | toString lead);

    standardIndex := typeCharIndex#lead;
    standardGroup := typeTable#standardIndex#0;
    standardRank := typeTable#standardIndex#1;
    standardMaskPosition := position + 1;
    standardMaskStop := standardMaskPosition + maskWidth standardRank;

    if standardMaskStop > #text then error "mask truncated";

    standardMask :=
        if standardMaskStop > standardMaskPosition
        then decodeCharacters(substring(text, standardMaskPosition, standardMaskStop - standardMaskPosition)) + 1
        else 1;

    if not (1 <= standardMask and standardMask < 2^standardRank) then
        error "mask out of range";

    {Factor(standardGroup, standardRank, standardMask), standardMaskStop}
    )

-------------------------------------------------------------------------
-- Bundle-row packing, including signed rows in v2.2.
-------------------------------------------------------------------------

normalizeSummands = (summands, ambientFactors) -> (
    if class summands =!= List then error "summands must be a list";

    result := {};

    for row in summands do (
        if class row =!= List or #row =!= #ambientFactors then
            error "summand row factor count mismatch";

        typedRow := {};

        for i from 0 to #ambientFactors - 1 do (
            weights := row#i;

            if class weights =!= List then
                error "highest-weight entry must be a list";

            if #weights =!= factorRank(ambientFactors#i) then
                error "highest-weight length must match the Dynkin rank";

            typedRow = append(typedRow, apply(weights, coefficient -> coefficient));
            );

        result = append(result, typedRow);
        );

    result
    )

zigZagEncode = value -> if value >= 0 then 2 * value else -2 * value - 1
zigZagDecode = value -> if value % 2 == 0 then value // 2 else -(value // 2) - 1

rowDigits = row -> (
    digits := {};
    signed := false;

    for weights in row do for coefficient in weights do (
        if coefficient < 0 then signed = true;
        digits = append(digits, coefficient);
        );

    if signed
    then {true, apply(digits, zigZagEncode)}
    else {false, digits}
    )

rowValue = (digits, base) -> (
    value := 0;

    for digit in digits do value = value * base + digit;

    value
    )

summandWidth = (totalDynkinRank, base) -> (
    if base < 2 then error "bundle base must be at least 2";

    width := 1;
    capacity := 62;

    while capacity < base^totalDynkinRank do (
        width = width + 1;
        capacity = capacity * 62;
        );

    width
    )

encodeSummand = (row, totalDynkinRank) -> (
    info := rowDigits row;
    signed := info#0;
    digits := info#1;

    maxDigit := 1;
    for digit in digits do if digit > maxDigit then maxDigit = digit;

    base := max(2, maxDigit + 1);
    width := summandWidth(totalDynkinRank, base);
    valueChars := encodeCharacters(rowValue(digits, base), width);
    prefix := if signed then toString signedBaseMarkerValue else "";

    if base < 62 then return prefix | encodeCharacters(base, 1) | valueChars;

    baseCharacters := encodeNatural base;

    prefix |
    toString escapeValue |
    encodeCharacters(#baseCharacters, 1) |
    baseCharacters |
    valueChars
    )

encodeBundleText = (summands, totalDynkinRank) -> (
    result := "";

    for row in summands do result = result | encodeSummand(row, totalDynkinRank);

    result
    )

decodeBundleBase = (bundleText, position) -> (
    if position >= #bundleText then error "unexpected end decoding bundle base";

    baseCharacter := bundleText#position;
    if not (base62Index#?baseCharacter) then
        error("invalid bundle base character " | toString baseCharacter);

    baseValue := base62Index#baseCharacter;

    if baseValue == 0 then (
        if position + 2 > #bundleText then error "escaped base truncated";

        baseLen := decodeCharacters(toString(bundleText#(position + 1)));
        if baseLen <= 0 then error "escaped base length must be positive";

        baseStart := position + 2;
        if baseStart + baseLen > #bundleText then error "escaped base truncated";

        base := decodeCharacters(substring(bundleText, baseStart, baseLen));
        if base < 62 then error "escaped base must be at least 62";

        return {base, baseStart + baseLen};
        );

    if baseValue == 1 then error "bundle base character 1 is reserved";

    {baseValue, position + 1}
    )

decodeBundleText = (bundleText, ambientFactors, totalDynkinRank) -> (
    summands := {};
    position := 0;

    while position < #bundleText do (
        signed := false;

        if bundleText#position == signedBaseMarkerValue then (
            signed = true;
            position = position + 1;
            );

        baseInfo := decodeBundleBase(bundleText, position);
        base := baseInfo#0;
        position = baseInfo#1;

        width := summandWidth(totalDynkinRank, base);
        if position + width > #bundleText then error "summand truncated";

        value := decodeCharacters(substring(bundleText, position, width));
        position = position + width;

        flatDigits := {};
        for i from 0 to totalDynkinRank - 1 do (
            flatDigits = prepend(value % base, flatDigits);
            value = value // base;
            );

        if value =!= 0 then error "packed value exceeds range";
        if signed then flatDigits = apply(flatDigits, zigZagDecode);

        row := {};
        offset := 0;

        for ambientFactor in ambientFactors do (
            weights := {};

            for j from 0 to factorRank(ambientFactor) - 1 do
                weights = append(weights, flatDigits#(offset + j));

            row = append(row, weights);
            offset = offset + factorRank ambientFactor;
            );

        summands = append(summands, row);
        );

    summands
    )

-------------------------------------------------------------------------
-- Canonicalization and final label assembly.
-------------------------------------------------------------------------

encodeRankBound = k -> (
    if k < 0 then error "rank bound must be non-negative";
    if k == 0 then return "0";

    chars := {};
    remaining := k;

    while remaining > 0 do (
        chars = prepend(base62Value#(remaining % 62), chars);
        remaining = remaining // 62;
        );

    result := "";
    for ch in chars do result = result | toString ch;

    result
    )

decodeRankBound = text -> (
    if #text == 0 then error "rank bound must be non-empty";
    if #text > 1 and base62Index#(text#0) == 0 then
        error "rank bound has leading zeros";

    value := 0;

    for i from 0 to #text - 1 do (
        ch := text#i;
        if not (base62Index#?ch) then
            error("invalid Base62 character in rank bound " | toString ch);
        value = value * 62 + base62Index#ch;
        );

    value
    )

reorder = (order, ambientFactors, summands) -> {
    apply(order, index -> ambientFactors#index),
    apply(summands, row -> apply(order, index -> row#index))
    }

sortRows = (rows, totalDynkinRank) -> (
    apply(
        sort(apply(rows, row -> {encodeSummand(row, totalDynkinRank), row})),
        pair -> pair#1)
    )

-------------------------------------------------------------------------
-- Graph-style canonicalization (v2.2).
-------------------------------------------------------------------------

serializeWeights = weights -> (
    inner := "";

    for i from 0 to #weights - 1 do (
        if i > 0 then inner = inner | ",";
        inner = inner | toString(weights#i);
        );

    "[" | inner | "]"
    )

joinStrings = (sep, lst) -> (
    if #lst == 0 then return "";

    result := lst#0;
    for i from 1 to #lst - 1 do result = result | sep | lst#i;

    result
    )

canonicalFactorOrder = (ambientFactors, summands, summandsF) -> (
    if #ambientFactors < 2 then return apply(#ambientFactors, index -> index);

    rowEntries := {};
    for i from 0 to #summands - 1 do
        rowEntries = append(rowEntries, ("E", i, summands#i));
    if summandsF =!= null then
        for i from 0 to #summandsF - 1 do
            rowEntries = append(rowEntries, ("F", i, summandsF#i));

    if #rowEntries == 0 then return apply(#ambientFactors, index -> index);

    rowOffset := #ambientFactors;
    vertexColors := new MutableHashTable;
    edgeLabels := new MutableHashTable;

    for index from 0 to #ambientFactors - 1 do
        vertexColors#index = "F:" | encodeFactor(ambientFactors#index);

    for offset from 0 to #rowEntries - 1 do (
        entry := rowEntries#offset;
        bundleTag := entry#0;
        row := entry#2;
        vertex := rowOffset + offset;
        vertexColors#vertex = "R:" | bundleTag;

        for factorIndex from 0 to #row - 1 do (
            label := serializeWeights(row#factorIndex);
            edgeLabels#(factorIndex, vertex) = label;
            edgeLabels#(vertex, factorIndex) = label;
            );
        );

    cellKey := (vertex, cell) -> (
        labels := apply(cell, other ->
            if edgeLabels#?(vertex, other) then edgeLabels#(vertex, other) else "~");
        joinStrings(";", sort labels)
        );

    refine := partition -> (
        current := partition;
        changed := true;

        while changed do (
            changed = false;
            updated := {};

            for cell in current do (
                buckets := new MutableHashTable;

                for vertex in cell do (
                    sig := joinStrings("|",
                        join({vertexColors#vertex},
                            apply(current, otherCell -> cellKey(vertex, otherCell))));
                    if not buckets#?sig then buckets#sig = {};
                    buckets#sig = append(buckets#sig, vertex);
                    );

                if #(keys buckets) == 1 then
                    updated = append(updated, cell)
                else (
                    changed = true;
                    for s in sort keys buckets do
                        updated = append(updated, buckets#s);
                    );
                );

            current = updated;
            );

        current
        );

    targetCell := partition -> (
        bestIndex := null;
        bestKey := null;

        for index from 0 to #partition - 1 do (
            cell := partition#index;
            if #cell <= 1 then continue;
            isRowCell := if cell#0 < rowOffset then 0 else 1;
            key := (#cell, isRowCell, index);

            if bestKey === null or key < bestKey then (
                bestKey = key;
                bestIndex = index;
                );
            );

        bestIndex
        );

    individualize := (partition, cellIndex, chosen) -> (
        cell := partition#cellIndex;
        remainder := select(cell, v -> v != chosen);
        result := {};

        for i from 0 to cellIndex - 1 do result = append(result, partition#i);
        result = append(result, {chosen});
        if #remainder > 0 then result = append(result, remainder);
        for i from cellIndex + 1 to #partition - 1 do result = append(result, partition#i);

        result
        );

    certFn := partition -> (
        ordered := apply(partition, cell -> cell#0);
        colors := joinStrings("|", apply(ordered, v -> vertexColors#v));
        edges := {};

        for li from 0 to #ordered - 1 do
            for ri from li + 1 to #ordered - 1 do (
                key := (ordered#li, ordered#ri);
                edges = append(edges,
                    if edgeLabels#?key then edgeLabels#key else "~");
                );

        colors | "||" | joinStrings("|", edges)
        );

    initialPartition := {};
    factorGroupsHT := new MutableHashTable;

    for index from 0 to #ambientFactors - 1 do (
        color := vertexColors#index;
        if not factorGroupsHT#?color then factorGroupsHT#color = {};
        factorGroupsHT#color = append(factorGroupsHT#color, index);
        );

    for color in sort keys factorGroupsHT do
        initialPartition = append(initialPartition, factorGroupsHT#color);

    rowGroupsHT := new MutableHashTable;

    for offset from 0 to #rowEntries - 1 do (
        vertex := rowOffset + offset;
        color := vertexColors#vertex;
        if not rowGroupsHT#?color then rowGroupsHT#color = {};
        rowGroupsHT#color = append(rowGroupsHT#color, vertex);
        );

    for color in sort keys rowGroupsHT do
        initialPartition = append(initialPartition, rowGroupsHT#color);

    bestCertificate := null;
    bestOrder := apply(#ambientFactors, index -> index);

    search := null;
    search = currPartition -> (
        refined := refine currPartition;
        ci := targetCell refined;

        if ci === null then (
            cert := certFn refined;
            if bestCertificate === null or cert < bestCertificate then (
                bestCertificate = cert;
                bestOrder = select(apply(refined, cell -> cell#0), v -> v < rowOffset);
                );
            )
        else (
            for vertex in (refined#ci) do
                search(individualize(refined, ci, vertex));
            );
        );

    search initialPartition;
    bestOrder
    )

canonicalizeCore = (ambientFactors, summands, summandsF, k) -> (
    isDegeneracy := summandsF =!= null;

    ambientFactors = apply(ambientFactors, ambientFactor -> ambientFactor);
    summands = normalizeSummands(summands, ambientFactors);

    if isDegeneracy then (
        summandsF = normalizeSummands(summandsF, ambientFactors);
        if k === null or k < 0 then error "rank bound must be non-negative";
        );

    originalCodes := apply(ambientFactors, ambientFactor -> encodeFactor ambientFactor);
    initialOrder := apply(
        sort(apply(#ambientFactors, index -> {originalCodes#index, index})),
        pair -> pair#1);

    reordered := reorder(initialOrder, ambientFactors, summands);
    ambientFactors = reordered#0;
    summands = reordered#1;

    if isDegeneracy then
        summandsF = (reorder(initialOrder, ambientFactors, summandsF))#1;

    if (not isDegeneracy) and #summands == 0 then return {ambientFactors, summands};

    totalDynkinRank := sum apply(ambientFactors, ambientFactor -> factorRank ambientFactor);

    bestOrder := canonicalFactorOrder(
        ambientFactors,
        summands,
        if isDegeneracy then summandsF else null);

    reordered = reorder(bestOrder, ambientFactors, summands);
    ambientFactors = reordered#0;
    summands = reordered#1;

    if isDegeneracy then
        summandsF = (reorder(bestOrder, ambientFactors, summandsF))#1;

    summands = sortRows(summands, totalDynkinRank);

    if isDegeneracy then
        return {ambientFactors, summands, sortRows(summandsF, totalDynkinRank), k};

    {ambientFactors, summands}
    )

canonicalize = args -> (
    if #args == 2 then return canonicalizeCore(args#0, args#1, null, null);
    if #args == 4 then return canonicalizeCore(args#0, args#1, args#2, args#3);

    error "canonicalize expects 2 or 4 arguments"
    )

encodeLabelInternal = args -> (
    if #args =!= 2 and #args =!= 4 then
        error "encodeLabel expects 2 or 4 arguments";

    result :=
        if #args == 2
        then canonicalizeCore(args#0, args#1, null, null)
        else canonicalizeCore(args#0, args#1, args#2, args#3);

    canonFactors := result#0;
    canonSummands := result#1;
    ambientText := "";

    for ambientFactor in canonFactors do ambientText = ambientText | encodeFactor ambientFactor;

    if #args == 2 and #canonSummands == 0 then return ambientText;

    totalDynkinRank := sum apply(canonFactors, ambientFactor -> factorRank ambientFactor);

    if #args == 4 then (
        ambientText |
        sepValue |
        encodeBundleText(canonSummands, totalDynkinRank) |
        locusSepValue |
        encodeBundleText(result#2, totalDynkinRank) |
        locusSepValue |
        encodeRankBound(args#3)
        )
    else ambientText | sepValue | encodeBundleText(canonSummands, totalDynkinRank)
    )

decodeLabelRaw = label -> (
    if class label =!= String then error "label must be a string";

    separatorIndex := findFirstCharacter(label, sepValue#0, 0);
    ambientText := if separatorIndex === null then label else substring(label, 0, separatorIndex);
    locusText := if separatorIndex === null then "" else substring(label, separatorIndex + 1, #label - separatorIndex - 1);

    if #ambientText == 0 then error "ambient part must be non-empty";
    if separatorIndex =!= null and #locusText == 0 then error "separator requires a non-empty locus";

    ambientFactors := {};
    positionIndex := 0;

    while positionIndex < #ambientText do (
        info := decodeFactor(ambientText, positionIndex);
        ambientFactors = append(ambientFactors, info#0);
        positionIndex = info#1;
        );

    if separatorIndex === null then
        return hashTable {"type" => "ambient", "factors" => ambientFactors, "summands" => {}};

    totalDynkinRank := sum apply(ambientFactors, ambientFactor -> factorRank ambientFactor);
    dashCount := 0;

    for i from 0 to #locusText - 1 do
        if locusText#i == locusSepValue#0 then dashCount = dashCount + 1;

    if dashCount == 0 then
        return hashTable {
            "type" => "zero_locus",
            "factors" => ambientFactors,
            "summands" => decodeBundleText(locusText, ambientFactors, totalDynkinRank)};

    if dashCount =!= 2 then
        error("locus part must contain 0 or 2 dashes, got " | toString dashCount);

    firstDash := findFirstCharacter(locusText, locusSepValue#0, 0);
    secondDash := findFirstCharacter(locusText, locusSepValue#0, firstDash + 1);

    bundleTextE := substring(locusText, 0, firstDash);
    bundleTextF := substring(locusText, firstDash + 1, secondDash - firstDash - 1);
    rankBoundText := substring(locusText, secondDash + 1, #locusText - secondDash - 1);

    if #bundleTextE == 0 then error "bundle E must be non-empty";
    if #bundleTextF == 0 then error "bundle F must be non-empty";
    if #rankBoundText == 0 then error "rank bound must be non-empty";

    hashTable {
        "type" => "degeneracy_locus",
        "factors" => ambientFactors,
        "summands_e" => decodeBundleText(bundleTextE, ambientFactors, totalDynkinRank),
        "summands_f" => decodeBundleText(bundleTextF, ambientFactors, totalDynkinRank),
        "k" => decodeRankBound rankBoundText
        }
    )

decodeLabelInternal = label -> (
    result := decodeLabelRaw label;

    reEncoded :=
        if result#"type" == "degeneracy_locus"
        then encodeLabelInternal(result#"factors", result#"summands_e", result#"summands_f", result#"k")
        else encodeLabelInternal(result#"factors", result#"summands");

    if reEncoded =!= label then error "label is not in canonical form";

    result
    )

isCanonicalInternal = label -> try (decodeLabelInternal label; true) else false

-------------------------------------------------------------------------
-- Public aliases.
-------------------------------------------------------------------------

base62 = base62Value
escapeCharacter = escapeValue
locusSep = locusSepValue
sep = sepValue
signedBaseMarker = signedBaseMarkerValue
standardName = standardNameValue
decodeLabel = decodeLabelInternal
encodeLabel = encodeLabelInternal
isCanonical = isCanonicalInternal
markedNodes = markedNodesInternal

-------------------------------------------------------------------------
-- Documentation and package self-tests.
-------------------------------------------------------------------------

beginDocumentation()

doc ///
Node
  Key
   ZeroLocus62
  Headline
   ZeroLocus62 label codec for flag-variety bundles
  Description
   Text
    The package implements the ZeroLocus62 v2.2 wire format, including signed
    bundle coefficients, canonicalization, and degeneracy loci.
///

TEST ///
    demoFactor = Factor("A", 1, 1);

    assert( markedNodes demoFactor == {1} );
    assert( encodeLabel({demoFactor}, {{{1}}}) == "1.21" );
///

TEST ///
    demoFactor = Factor("A", 1, 1);
    decodedNegative = decodeLabel "1.121";

    assert( encodeLabel({demoFactor}, {{{-1}}}) == "1.121" );
    assert( decodedNegative#"summands" == {{{-1}}} );
///

TEST ///
    demoFactors = {Factor("A", 1, 1), Factor("A", 1, 1)};

    assert( encodeLabel(demoFactors, {{{0}, {-1}}, {{-1}, {0}}}) == "11.121122" );
///

TEST ///
    demoFactor = Factor("A", 1, 1);
    decodedDegeneracy = decodeLabel "1.121-21-0";

    assert( encodeLabel({demoFactor}, {{{-1}}}, {{{1}}}, 0) == "1.121-21-0" );
    assert( decodedDegeneracy#"k" == 0 );
    assert( decodedDegeneracy#"summands_e" == {{{-1}}} );
///

TEST ///
    assert( isCanonical "1.121" );
    assert( not isCanonical "11.122121" );
///

end--
