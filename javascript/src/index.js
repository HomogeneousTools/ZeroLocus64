export const STANDARD_NAME = "ZeroLocus62";
export const BASE62 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const SEP = ".";
export const LOCUS_SEP = "-";
export const ESCAPE = BASE62[0];
export const SIGNED_BASE_MARKER = BASE62[1];
export const TYPE_ORDER = "ABCDEFG";

export const TYPE_TABLE = Object.freeze([
  ...Array.from({ length: 15 }, (_, index) => ["A", index + 1]),
  ...Array.from({ length: 14 }, (_, index) => ["B", index + 2]),
  ...Array.from({ length: 13 }, (_, index) => ["C", index + 3]),
  ...Array.from({ length: 12 }, (_, index) => ["D", index + 4]),
  ["E", 6],
  ["E", 7],
  ["E", 8],
  ["F", 4],
  ["G", 2],
]);

export const TYPE_CHARS = BASE62.slice(1, 1 + TYPE_TABLE.length);

export const BASE62_INDEX = Object.freeze(
  Object.fromEntries(
    Array.from(BASE62, (character, value) => [character, value]),
  ),
);

export const TYPE_INDEX = new Map(
  TYPE_TABLE.map(([group, rank], index) => [`${group}${rank}`, index]),
);

export const TYPE_CHAR_INDEX = Object.freeze(
  Object.fromEntries(
    Array.from(TYPE_CHARS, (character, index) => [character, index]),
  ),
);

function toBigInt(value, name) {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`${name} must be a safe integer`);
    }
    return BigInt(value);
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }
  throw new TypeError(`${name} must be an integer`);
}

function toSafeInteger(value, name) {
  const integer = toBigInt(value, name);
  if (integer > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`${name} exceeds supported safe integer range`);
  }
  if (integer < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`${name} exceeds supported safe integer range`);
  }
  return Number(integer);
}

function toNonNegativeSafeInteger(value, name) {
  const integer = toSafeInteger(value, name);
  if (integer < 0) {
    throw new RangeError(`${name} must be non-negative`);
  }
  return integer;
}

function zigZagEncode(value) {
  return value >= 0 ? 2 * value : -2 * value - 1;
}

function zigZagDecode(value) {
  return value % 2 === 0 ? value / 2 : -Math.floor(value / 2) - 1;
}

function coerceFactor(factor) {
  if (factor instanceof Factor) {
    return factor;
  }
  if (factor && typeof factor === "object") {
    return new Factor(factor.group, factor.rank, factor.mask);
  }
  throw new TypeError("factor must be a Factor or factor-like object");
}

function normalizeSummands(summands, factors) {
  if (!Array.isArray(summands)) {
    throw new TypeError("summands must be an array");
  }
  return summands.map((row) => {
    if (!Array.isArray(row) || row.length !== factors.length) {
      throw new RangeError("summand row factor count mismatch");
    }
    return row.map((weights, index) => {
      if (!Array.isArray(weights)) {
        throw new RangeError("highest-weight entry must be an array");
      }
      if (weights.length !== factors[index].rank) {
        throw new RangeError("highest-weight length must match the Dynkin rank");
      }
      return weights.map((coefficient) =>
        toSafeInteger(coefficient, "highest-weight coefficient"),
      );
    });
  });
}

function compareLexicographic(left, right) {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export class Factor {
  constructor(group, rank, mask) {
    this.group = String(group);
    this.rank = toNonNegativeSafeInteger(rank, "rank");
    this.mask = toBigInt(mask, "mask");
    Object.freeze(this);
  }

  markedNodes() {
    const nodes = [];
    for (let node = 0; node < this.rank; node += 1) {
      if (((this.mask >> BigInt(node)) & 1n) === 1n) {
        nodes.push(node + 1);
      }
    }
    return nodes;
  }

  marked_nodes() {
    return this.markedNodes();
  }
}

export function isValidTypeRank(group, rank) {
  return (
    (group === "A" && rank >= 1) ||
    (group === "B" && rank >= 2) ||
    (group === "C" && rank >= 3) ||
    (group === "D" && rank >= 4) ||
    (group === "E" && (rank === 6 || rank === 7 || rank === 8)) ||
    (group === "F" && rank === 4) ||
    (group === "G" && rank === 2)
  );
}

export function validateTypeRank(group, rank) {
  if (!isValidTypeRank(group, rank)) {
    throw new RangeError(`invalid Dynkin type/rank pair ${group}${rank}`);
  }
}

function validateFactor(factor) {
  validateTypeRank(factor.group, factor.rank);
  if (!(1n <= factor.mask && factor.mask < 1n << BigInt(factor.rank))) {
    throw new RangeError("mask out of range");
  }
}

function maskWidth(rank) {
  let width = 0;
  let capacity = 1n;
  const limit = (1n << BigInt(rank)) - 2n;
  while (capacity <= limit) {
    width += 1;
    capacity *= 62n;
  }
  return width;
}

function encodeCharacters(value, width) {
  const integerValue = toBigInt(value, "value");
  if (width < 0) {
    throw new RangeError("width must be non-negative");
  }
  if (width === 0) {
    if (integerValue !== 0n) {
      throw new RangeError("non-zero value does not fit in width 0");
    }
    return "";
  }
  if (!(0n <= integerValue && integerValue < 62n ** BigInt(width))) {
    throw new RangeError("value does not fit in character width");
  }
  let remaining = integerValue;
  const characters = Array.from({ length: width }, () => "0");
  for (let index = width - 1; index >= 0; index -= 1) {
    characters[index] = BASE62[Number(remaining % 62n)];
    remaining /= 62n;
  }
  return characters.join("");
}

function decodeCharacters(text) {
  let value = 0n;
  for (const character of text) {
    const charValue = BASE62_INDEX[character];
    if (charValue === undefined) {
      throw new RangeError(
        `invalid Base62 character ${JSON.stringify(character)}`,
      );
    }
    value = value * 62n + BigInt(charValue);
  }
  return value;
}

function encodeNatural(value) {
  const integerValue = toBigInt(value, "natural");
  if (integerValue <= 0n) {
    throw new RangeError("natural must be positive");
  }
  let width = 1;
  let capacity = 62n;
  while (integerValue >= capacity) {
    width += 1;
    capacity *= 62n;
  }
  return encodeCharacters(integerValue, width);
}

function encodeFactor(factor) {
  validateFactor(factor);
  const width = maskWidth(factor.rank);
  const index = TYPE_INDEX.get(`${factor.group}${factor.rank}`);
  if (index !== undefined) {
    return TYPE_CHARS[index] + encodeCharacters(factor.mask - 1n, width);
  }
  const rankCharacters = encodeNatural(factor.rank);
  return (
    ESCAPE +
    factor.group +
    encodeCharacters(rankCharacters.length, 1) +
    rankCharacters +
    encodeCharacters(factor.mask - 1n, width)
  );
}

function decodeFactor(text, position) {
  if (position >= text.length) {
    throw new RangeError("unexpected end decoding factor");
  }
  let group;
  let rank;
  let nextPosition = position;
  const leadCharacter = text[position];
  if (leadCharacter === ESCAPE) {
    if (position + 3 > text.length) {
      throw new RangeError("factor escape truncated");
    }
    group = text[position + 1];
    if (!TYPE_ORDER.includes(group)) {
      throw new RangeError(`unknown Dynkin type ${JSON.stringify(group)}`);
    }
    const rankLength = Number(decodeCharacters(text[position + 2]));
    if (rankLength <= 0) {
      throw new RangeError("escaped rank length must be positive");
    }
    const start = position + 3;
    const end = start + rankLength;
    if (end > text.length) {
      throw new RangeError("escaped rank truncated");
    }
    rank = toSafeInteger(decodeCharacters(text.slice(start, end)), "rank");
    nextPosition = end;
  } else {
    const index = TYPE_CHAR_INDEX[leadCharacter];
    if (index === undefined) {
      throw new RangeError(
        `unknown standard factor character ${JSON.stringify(leadCharacter)}`,
      );
    }
    [group, rank] = TYPE_TABLE[index];
    nextPosition = position + 1;
  }
  validateTypeRank(group, rank);
  const end = nextPosition + maskWidth(rank);
  if (end > text.length) {
    throw new RangeError("mask truncated");
  }
  const mask =
    end > nextPosition
      ? decodeCharacters(text.slice(nextPosition, end)) + 1n
      : 1n;
  if (!(1n <= mask && mask < 1n << BigInt(rank))) {
    throw new RangeError("mask out of range");
  }
  return [new Factor(group, rank, mask), end];
}

function rowDigits(row) {
  const digits = [];
  let signed = false;
  for (const weights of row) {
    for (const coefficient of weights) {
      if (coefficient < 0) {
        signed = true;
      }
      digits.push(coefficient);
    }
  }
  if (!signed) {
    return [false, digits];
  }
  return [true, digits.map((coefficient) => zigZagEncode(coefficient))];
}

function rowValue(digits, base) {
  let value = 0n;
  for (const digit of digits) {
    value = value * BigInt(base) + BigInt(digit);
  }
  return value;
}

function summandWidth(totalDynkinRank, base) {
  if (base < 2) {
    throw new RangeError("bundle base must be at least 2");
  }
  let width = 1;
  let capacity = 62n;
  const required = BigInt(base) ** BigInt(totalDynkinRank);
  while (capacity < required) {
    width += 1;
    capacity *= 62n;
  }
  return width;
}

function encodeSummand(row, totalDynkinRank) {
  const [signed, digits] = rowDigits(row);
  const base = Math.max(2, Math.max(1, ...digits) + 1);
  const width = summandWidth(totalDynkinRank, base);
  const valueChars = encodeCharacters(rowValue(digits, base), width);
  const prefix = signed ? SIGNED_BASE_MARKER : "";
  if (base < 62) {
    return prefix + encodeCharacters(base, 1) + valueChars;
  }
  const baseCharacters = encodeNatural(base);
  return (
    prefix +
    ESCAPE +
    encodeCharacters(baseCharacters.length, 1) +
    baseCharacters +
    valueChars
  );
}

function encodeRankBound(k) {
  const value = toBigInt(k, "rank bound");
  if (value < 0n) {
    throw new RangeError("rank bound must be non-negative");
  }
  if (value === 0n) {
    return BASE62[0];
  }
  let remaining = value;
  const characters = [];
  while (remaining > 0n) {
    characters.push(BASE62[Number(remaining % 62n)]);
    remaining /= 62n;
  }
  return characters.reverse().join("");
}

function decodeRankBound(text) {
  if (!text) {
    throw new RangeError("rank bound text must be non-empty");
  }
  if (text.length > 1 && BASE62_INDEX[text[0]] === 0) {
    throw new RangeError("rank bound has leading zeros");
  }
  let value = 0n;
  for (const character of text) {
    const charValue = BASE62_INDEX[character];
    if (charValue === undefined) {
      throw new RangeError(
        `invalid Base62 character in rank bound ${JSON.stringify(character)}`,
      );
    }
    value = value * 62n + BigInt(charValue);
  }
  return toSafeInteger(value, "rank bound");
}

function encodeBundleText(summands, totalDynkinRank) {
  return summands.map((row) => encodeSummand(row, totalDynkinRank)).join("");
}

function decodeBundleBase(bundleText, position) {
  if (position >= bundleText.length) {
    throw new RangeError("unexpected end decoding bundle base");
  }
  const baseCharacter = bundleText[position];
  const baseValue = BASE62_INDEX[baseCharacter];
  if (baseValue === undefined) {
    throw new RangeError(
      `invalid bundle base character ${JSON.stringify(baseCharacter)}`,
    );
  }
  if (baseValue === 0) {
    if (position + 2 > bundleText.length) {
      throw new RangeError("escaped base truncated");
    }
    const baseLen = Number(decodeCharacters(bundleText[position + 1]));
    if (baseLen <= 0) {
      throw new RangeError("escaped base length must be positive");
    }
    const baseStart = position + 2;
    const baseEnd = baseStart + baseLen;
    if (baseEnd > bundleText.length) {
      throw new RangeError("escaped base truncated");
    }
    const base = toSafeInteger(
      decodeCharacters(bundleText.slice(baseStart, baseEnd)),
      "escaped base",
    );
    if (base < 62) {
      throw new RangeError("escaped base must be at least 62");
    }
    return [base, baseEnd];
  }
  if (baseValue === 1) {
    throw new RangeError("bundle base character 1 is reserved");
  }
  return [baseValue, position + 1];
}

function decodeBundleText(bundleText, factors, totalDynkinRank) {
  const summands = [];
  let position = 0;
  while (position < bundleText.length) {
    let signed = false;
    if (BASE62_INDEX[bundleText[position]] === 1) {
      signed = true;
      position += 1;
    }
    let base;
    [base, position] = decodeBundleBase(bundleText, position);
    const width = summandWidth(totalDynkinRank, base);
    const start = position;
    const end = start + width;
    if (end > bundleText.length) {
      throw new RangeError("summand truncated");
    }
    let value = decodeCharacters(bundleText.slice(start, end));
    position = end;

    const flatCoefficients = Array.from({ length: totalDynkinRank }, () => 0);
    for (let index = totalDynkinRank - 1; index >= 0; index -= 1) {
      flatCoefficients[index] = Number(value % BigInt(base));
      value /= BigInt(base);
    }
    if (value !== 0n) {
      throw new RangeError("packed value exceeds range");
    }
    if (signed) {
      for (let index = 0; index < flatCoefficients.length; index += 1) {
        flatCoefficients[index] = zigZagDecode(flatCoefficients[index]);
      }
    }

    const row = [];
    let offset = 0;
    for (const factor of factors) {
      row.push(flatCoefficients.slice(offset, offset + factor.rank));
      offset += factor.rank;
    }
    summands.push(row);
  }
  return summands;
}

function reorder(order, factors, summands) {
  return [
    order.map((index) => factors[index]),
    summands.map((row) => order.map((index) => row[index].slice())),
  ];
}

function serializeWeights(weights) {
  return `[${weights.join(",")}]`;
}

function canonicalFactorOrder(factors, summands, summandsF) {
  if (factors.length < 2) {
    return Array.from({ length: factors.length }, (_, index) => index);
  }
  const rowEntries = summands.map((row, index) => ["E", index, row]);
  if (summandsF !== null) {
    rowEntries.push(...summandsF.map((row, index) => ["F", index, row]));
  }
  if (rowEntries.length === 0) {
    return Array.from({ length: factors.length }, (_, index) => index);
  }

  const rowOffset = factors.length;
  const vertexColors = new Map();
  const edgeLabels = new Map();
  for (let index = 0; index < factors.length; index += 1) {
    vertexColors.set(index, `F:${encodeFactor(factors[index])}`);
  }
  rowEntries.forEach(([bundleTag, _rowIndex, row], offset) => {
    const vertex = rowOffset + offset;
    vertexColors.set(vertex, `R:${bundleTag}`);
    row.forEach((weights, factorIndex) => {
      const label = serializeWeights(weights);
      edgeLabels.set(`${factorIndex}:${vertex}`, label);
      edgeLabels.set(`${vertex}:${factorIndex}`, label);
    });
  });

  function cellKey(vertex, cell) {
    return cell
      .map((other) => edgeLabels.get(`${vertex}:${other}`) ?? "~")
      .sort(compareLexicographic)
      .join(";");
  }

  function refine(partition) {
    let current = partition;
    for (;;) {
      const updated = [];
      let changed = false;
      for (const cell of current) {
        const buckets = new Map();
        for (const vertex of cell) {
          const signatureKey = [
            vertexColors.get(vertex),
            ...current.map((otherCell) => cellKey(vertex, otherCell)),
          ].join("|");
          const bucket = buckets.get(signatureKey);
          if (bucket) {
            bucket.push(vertex);
          } else {
            buckets.set(signatureKey, [vertex]);
          }
        }
        if (buckets.size === 1) {
          updated.push(cell);
          continue;
        }
        changed = true;
        const ordered = [...buckets.entries()].sort((left, right) =>
          compareLexicographic(left[0], right[0]),
        );
        for (const [, bucket] of ordered) {
          updated.push(bucket);
        }
      }
      if (!changed) {
        return current;
      }
      current = updated;
    }
  }

  function targetCell(partition) {
    let bestIndex = null;
    let bestKey = null;
    for (let index = 0; index < partition.length; index += 1) {
      const cell = partition[index];
      if (cell.length <= 1) {
        continue;
      }
      const key = [cell.length, cell[0] < rowOffset ? 0 : 1, index];
      if (
        bestKey === null ||
        key[0] < bestKey[0] ||
        (key[0] === bestKey[0] &&
          (key[1] < bestKey[1] ||
            (key[1] === bestKey[1] && key[2] < bestKey[2])))
      ) {
        bestIndex = index;
        bestKey = key;
      }
    }
    return bestIndex;
  }

  function individualize(partition, cellIndex, chosen) {
    const cell = partition[cellIndex];
    const remainder = cell.filter((vertex) => vertex !== chosen);
    const result = [...partition.slice(0, cellIndex), [chosen]];
    if (remainder.length > 0) {
      result.push(remainder);
    }
    result.push(...partition.slice(cellIndex + 1));
    return result;
  }

  function certificate(partition) {
    const ordered = partition.map((cell) => cell[0]);
    const colors = ordered.map((vertex) => vertexColors.get(vertex));
    const edges = [];
    for (let leftIndex = 0; leftIndex < ordered.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < ordered.length;
        rightIndex += 1
      ) {
        edges.push(
          edgeLabels.get(`${ordered[leftIndex]}:${ordered[rightIndex]}`) ?? "~",
        );
      }
    }
    return `${colors.join("|")}||${edges.join("|")}`;
  }

  const initialPartition = [];
  const factorGroups = new Map();
  for (let index = 0; index < factors.length; index += 1) {
    const color = vertexColors.get(index);
    const group = factorGroups.get(color);
    if (group) {
      group.push(index);
    } else {
      factorGroups.set(color, [index]);
    }
  }
  for (const color of [...factorGroups.keys()].sort(compareLexicographic)) {
    initialPartition.push(factorGroups.get(color));
  }
  const rowGroups = new Map();
  for (let offset = 0; offset < rowEntries.length; offset += 1) {
    const vertex = rowOffset + offset;
    const color = vertexColors.get(vertex);
    const group = rowGroups.get(color);
    if (group) {
      group.push(vertex);
    } else {
      rowGroups.set(color, [vertex]);
    }
  }
  for (const color of [...rowGroups.keys()].sort(compareLexicographic)) {
    initialPartition.push(rowGroups.get(color));
  }

  let bestCertificate = null;
  let bestOrder = Array.from({ length: factors.length }, (_, index) => index);

  function search(partition) {
    const refined = refine(partition);
    const cellIndex = targetCell(refined);
    if (cellIndex === null) {
      const currentCertificate = certificate(refined);
      if (
        bestCertificate === null ||
        compareLexicographic(currentCertificate, bestCertificate) < 0
      ) {
        bestCertificate = currentCertificate;
        bestOrder = refined
          .map((cell) => cell[0])
          .filter((vertex) => vertex < rowOffset);
      }
      return;
    }
    for (const vertex of refined[cellIndex]) {
      search(individualize(refined, cellIndex, vertex));
    }
  }

  search(initialPartition);
  return bestOrder;
}

export function canonicalize(factors, summands, summandsF, k) {
  const normalizedFactors = factors.map((factor) => coerceFactor(factor));
  const normalizedSummands = normalizeSummands(summands, normalizedFactors);
  const isDegeneracy = summandsF != null;
  const normalizedSummandsF = isDegeneracy
    ? normalizeSummands(summandsF, normalizedFactors)
    : null;
  if (isDegeneracy) {
    toNonNegativeSafeInteger(k, "rank bound");
  }
  const initialOrder = normalizedFactors
    .map((_, index) => index)
    .sort((left, right) =>
      compareLexicographic(
        encodeFactor(normalizedFactors[left]),
        encodeFactor(normalizedFactors[right]),
      ),
    );
  let [orderedFactors, orderedSummands] = reorder(
    initialOrder,
    normalizedFactors,
    normalizedSummands,
  );
  let orderedSummandsF = isDegeneracy
    ? reorder(initialOrder, normalizedFactors, normalizedSummandsF)[1]
    : null;
  if (!isDegeneracy && orderedSummands.length === 0) {
    return [orderedFactors, orderedSummands];
  }
  const totalDynkinRank = orderedFactors.reduce(
    (sum, factor) => sum + factor.rank,
    0,
  );
  const sortBySummandCode = (left, right) =>
    compareLexicographic(
      encodeSummand(left, totalDynkinRank),
      encodeSummand(right, totalDynkinRank),
    );
  const bestOrder = canonicalFactorOrder(
    orderedFactors,
    orderedSummands,
    orderedSummandsF,
  );
  if (isDegeneracy) {
    orderedSummandsF = reorder(bestOrder, orderedFactors, orderedSummandsF)[1];
  }
  [orderedFactors, orderedSummands] = reorder(
    bestOrder,
    orderedFactors,
    orderedSummands,
  );
  orderedSummands.sort(sortBySummandCode);
  if (isDegeneracy) {
    orderedSummandsF.sort(sortBySummandCode);
    return [orderedFactors, orderedSummands, orderedSummandsF, k];
  }
  return [orderedFactors, orderedSummands];
}

export function encodeLabel(factors, summands, summandsF, k) {
  const isDegeneracy = summandsF != null;
  const result = canonicalize(factors, summands, summandsF, k);
  const canonicalFactors = result[0];
  const canonicalSummands = result[1];
  const ambientText = canonicalFactors
    .map((factor) => encodeFactor(factor))
    .join("");
  if (!isDegeneracy && canonicalSummands.length === 0) {
    return ambientText;
  }
  const totalDynkinRank = canonicalFactors.reduce(
    (sum, factor) => sum + factor.rank,
    0,
  );
  if (isDegeneracy) {
    const canonicalSummandsF = result[2];
    return (
      ambientText +
      SEP +
      encodeBundleText(canonicalSummands, totalDynkinRank) +
      LOCUS_SEP +
      encodeBundleText(canonicalSummandsF, totalDynkinRank) +
      LOCUS_SEP +
      encodeRankBound(k)
    );
  }
  return (
    ambientText + SEP + encodeBundleText(canonicalSummands, totalDynkinRank)
  );
}

function decodeLabelRaw(label) {
  if (typeof label !== "string") {
    throw new TypeError("label must be a string");
  }
  const separatorIndex = label.indexOf(SEP);
  const ambientText =
    separatorIndex < 0 ? label : label.slice(0, separatorIndex);
  const locusText = separatorIndex < 0 ? "" : label.slice(separatorIndex + 1);
  if (!ambientText) {
    throw new RangeError("ambient part must be non-empty");
  }
  if (separatorIndex >= 0 && !locusText) {
    throw new RangeError("separator requires a non-empty locus");
  }

  const factors = [];
  let position = 0;
  while (position < ambientText.length) {
    const [factor, nextPosition] = decodeFactor(ambientText, position);
    factors.push(factor);
    position = nextPosition;
  }
  if (separatorIndex < 0) {
    return { type: "ambient", factors, summands: [] };
  }

  const totalDynkinRank = factors.reduce((sum, factor) => sum + factor.rank, 0);
  const locusParts = locusText.split(LOCUS_SEP);

  if (locusParts.length === 1) {
    const summands = decodeBundleText(locusText, factors, totalDynkinRank);
    return { type: "zero_locus", factors, summands };
  }

  if (locusParts.length !== 3) {
    throw new RangeError(
      `locus part must contain 0 or 2 dashes, got ${locusParts.length - 1}`,
    );
  }

  const [bundleTextE, bundleTextF, rankBoundText] = locusParts;

  if (!bundleTextE) {
    throw new RangeError("bundle E must be non-empty");
  }
  if (!bundleTextF) {
    throw new RangeError("bundle F must be non-empty");
  }
  if (!rankBoundText) {
    throw new RangeError("rank bound must be non-empty");
  }

  const summandsE = decodeBundleText(bundleTextE, factors, totalDynkinRank);
  const summandsF = decodeBundleText(bundleTextF, factors, totalDynkinRank);
  const k = decodeRankBound(rankBoundText);

  return { type: "degeneracy_locus", factors, summandsE, summandsF, k };
}

export function decodeLabel(label) {
  const result = decodeLabelRaw(label);
  let reEncoded;
  if (result.type === "degeneracy_locus") {
    reEncoded = encodeLabel(
      result.factors,
      result.summandsE,
      result.summandsF,
      result.k,
    );
  } else {
    reEncoded = encodeLabel(result.factors, result.summands);
  }
  if (reEncoded !== label) {
    throw new RangeError("label is not in canonical form");
  }
  return result;
}

export function isCanonical(label) {
  try {
    decodeLabel(label);
    return true;
  } catch {
    return false;
  }
}

export const encode_label = encodeLabel;
export const decode_label = decodeLabel;
export const is_canonical = isCanonical;
