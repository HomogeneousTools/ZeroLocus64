export const STANDARD_NAME = "ZeroLocus62";
export const BASE62 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const SEP = ".";
export const LOCUS_SEP = "-";
export const ESCAPE = BASE62[0];
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
export const MAX_SMALL_VALUE = 7;
export const DIRECT_ROW_CAPACITY = 58;
export const SMALL_PAIR_MARKER = BASE62[58];
export const SMALL_POSITIVE_MARKER = BASE62[59];
export const POSITIVE_SPARSE_MARKER = BASE62[60];
export const SIGNED_SPARSE_MARKER = BASE62[61];

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
        throw new RangeError(
          "highest-weight length must match the Dynkin rank",
        );
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

function encodeDescriptor(value) {
  const integer = toSafeInteger(value, "descriptor");
  if (integer <= 0) {
    throw new RangeError("descriptor must be positive");
  }
  if (integer <= 61) {
    return BASE62[integer];
  }
  const characters = encodeNatural(integer);
  if (characters.length > 61) {
    throw new RangeError("descriptor length exceeds hard limit");
  }
  return ESCAPE + encodeCharacters(characters.length, 1) + characters;
}

function decodeDescriptor(text, position, name) {
  if (position >= text.length) {
    throw new RangeError(`unexpected end decoding ${name}`);
  }
  const lead = BASE62_INDEX[text[position]];
  if (lead === undefined) {
    throw new RangeError(
      `invalid Base62 character in ${name} ${JSON.stringify(text[position])}`,
    );
  }
  if (lead !== 0) {
    return [lead, position + 1];
  }
  if (position + 2 > text.length) {
    throw new RangeError(`${name} truncated`);
  }
  const width = Number(decodeCharacters(text[position + 1]));
  if (width <= 0) {
    throw new RangeError(`${name} length must be positive`);
  }
  const start = position + 2;
  const end = start + width;
  if (end > text.length) {
    throw new RangeError(`${name} truncated`);
  }
  const value = toSafeInteger(decodeCharacters(text.slice(start, end)), name);
  if (value <= 61) {
    throw new RangeError(`escaped ${name} must be at least 62`);
  }
  return [value, end];
}

function statesWidth(states) {
  let width = 0;
  let capacity = 1n;
  const required = toBigInt(states, "states");
  while (capacity < required) {
    width += 1;
    capacity *= 62n;
  }
  return width;
}

function binomial(n, k) {
  if (k < 0 || k > n) {
    return 0n;
  }
  let choose = Math.min(k, n - k);
  let value = 1n;
  for (let index = 1; index <= choose; index += 1) {
    value = (value * BigInt(n - choose + index)) / BigInt(index);
  }
  return value;
}

function rankSupport(totalDynkinRank, positions) {
  let rank = 0n;
  let previous = -1;
  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index];
    for (let candidate = previous + 1; candidate < position; candidate += 1) {
      rank += binomial(
        totalDynkinRank - 1 - candidate,
        positions.length - 1 - index,
      );
    }
    previous = position;
  }
  return rank;
}

function unrankSupport(totalDynkinRank, count, rank) {
  const positions = [];
  let nextMin = 0;
  let remainingRank = toBigInt(rank, "support rank");
  for (let index = 0; index < count; index += 1) {
    let found = false;
    for (let position = nextMin; position < totalDynkinRank; position += 1) {
      const block = binomial(totalDynkinRank - 1 - position, count - 1 - index);
      if (remainingRank < block) {
        positions.push(position);
        nextMin = position + 1;
        found = true;
        break;
      }
      remainingRank -= block;
    }
    if (!found) {
      throw new RangeError("support rank out of range");
    }
  }
  if (remainingRank !== 0n) {
    throw new RangeError("support rank out of range");
  }
  return positions;
}

function signedDigit(value) {
  if (value === 0) {
    throw new RangeError("signed sparse rows encode only non-zero values");
  }
  return zigZagEncode(value) - 1;
}

function decodeSignedDigit(value) {
  return zigZagDecode(value + 1);
}

function directSmallLimit(totalDynkinRank, maxSmallValue = MAX_SMALL_VALUE) {
  return Math.min(
    maxSmallValue,
    Math.floor(DIRECT_ROW_CAPACITY / totalDynkinRank),
  );
}

function unpackDigits(value, base, count) {
  let remaining = toBigInt(value, "packed value");
  const digits = Array.from({ length: count }, () => 0);
  for (let index = count - 1; index >= 0; index -= 1) {
    digits[index] = Number(remaining % BigInt(base));
    remaining /= BigInt(base);
  }
  if (remaining !== 0n) {
    throw new RangeError("packed value exceeds range");
  }
  return digits;
}

function splitFlatRow(flatCoefficients, factors) {
  const row = [];
  let offset = 0;
  for (const factor of factors) {
    row.push(flatCoefficients.slice(offset, offset + factor.rank));
    offset += factor.rank;
  }
  return row;
}

function rowValue(digits, base) {
  let value = 0n;
  for (const digit of digits) {
    value = value * BigInt(base) + BigInt(digit);
  }
  return value;
}

function encodeSummand(row, totalDynkinRank) {
  const flatCoefficients = row.flat();
  const positions = [];
  const values = [];
  for (let index = 0; index < flatCoefficients.length; index += 1) {
    if (flatCoefficients[index] !== 0) {
      positions.push(index);
      values.push(flatCoefficients[index]);
    }
  }
  const supportSize = positions.length;
  const smallLimit = directSmallLimit(totalDynkinRank);
  const directPairOffset = totalDynkinRank * smallLimit;
  const directPairCapacity =
    directPairOffset + Number(binomial(totalDynkinRank, 2));
  if (supportSize === 1 && values[0] >= 1 && values[0] <= smallLimit) {
    return BASE62[(values[0] - 1) * totalDynkinRank + positions[0]];
  }
  if (
    directPairCapacity <= DIRECT_ROW_CAPACITY &&
    supportSize === 2 &&
    values[0] === 1 &&
    values[1] === 1
  ) {
    return BASE62[
      directPairOffset + Number(rankSupport(totalDynkinRank, positions))
    ];
  }
  if (supportSize === 2 && values[0] === 1 && values[1] === 1) {
    return (
      SMALL_PAIR_MARKER +
      encodeCharacters(
        rankSupport(totalDynkinRank, positions),
        statesWidth(binomial(totalDynkinRank, 2)),
      )
    );
  }
  const signed = values.some((value) => value < 0);
  if (
    !signed &&
    values.every((value) => value >= 1 && value <= MAX_SMALL_VALUE)
  ) {
    let text = SMALL_POSITIVE_MARKER + encodeDescriptor(supportSize + 1);
    if (supportSize === 0) {
      return text;
    }
    text += encodeCharacters(
      rankSupport(totalDynkinRank, positions),
      statesWidth(binomial(totalDynkinRank, supportSize)),
    );
    text += encodeCharacters(
      rowValue(
        values.map((value) => value - 1),
        MAX_SMALL_VALUE,
      ),
      statesWidth(BigInt(MAX_SMALL_VALUE) ** BigInt(supportSize)),
    );
    return text;
  }
  const digits = signed
    ? values.map((value) => signedDigit(value))
    : values.map((value) => value - 1);
  let text =
    (signed ? SIGNED_SPARSE_MARKER : POSITIVE_SPARSE_MARKER) +
    encodeDescriptor(supportSize + 1);
  if (supportSize === 0) {
    return text;
  }
  text += encodeCharacters(
    rankSupport(totalDynkinRank, positions),
    statesWidth(binomial(totalDynkinRank, supportSize)),
  );
  const base = Math.max(2, Math.max(1, ...digits) + 1);
  text += encodeDescriptor(base);
  text += encodeCharacters(
    rowValue(digits, base),
    statesWidth(BigInt(base) ** BigInt(supportSize)),
  );
  return text;
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

function decodeBundleText(bundleText, factors, totalDynkinRank) {
  const summands = [];
  let position = 0;
  const smallLimit = directSmallLimit(totalDynkinRank);
  const directPairOffset = totalDynkinRank * smallLimit;
  const directPairCapacity =
    directPairOffset + Number(binomial(totalDynkinRank, 2));
  while (position < bundleText.length) {
    const lead = bundleText[position];
    const leadValue = BASE62_INDEX[lead];
    if (leadValue === undefined) {
      throw new RangeError(
        `invalid bundle row lead character ${JSON.stringify(lead)}`,
      );
    }
    if (smallLimit > 0 && leadValue < directPairOffset) {
      const flatCoefficients = Array.from({ length: totalDynkinRank }, () => 0);
      flatCoefficients[leadValue % totalDynkinRank] =
        Math.floor(leadValue / totalDynkinRank) + 1;
      position += 1;
      summands.push(splitFlatRow(flatCoefficients, factors));
      continue;
    }
    if (
      directPairCapacity <= DIRECT_ROW_CAPACITY &&
      leadValue >= directPairOffset &&
      leadValue < directPairCapacity
    ) {
      const flatCoefficients = Array.from({ length: totalDynkinRank }, () => 0);
      for (const supportPosition of unrankSupport(
        totalDynkinRank,
        2,
        BigInt(leadValue - directPairOffset),
      )) {
        flatCoefficients[supportPosition] = 1;
      }
      position += 1;
      summands.push(splitFlatRow(flatCoefficients, factors));
      continue;
    }
    if (lead === SMALL_PAIR_MARKER) {
      position += 1;
      const supportEnd = position + statesWidth(binomial(totalDynkinRank, 2));
      if (supportEnd > bundleText.length) {
        throw new RangeError("pair support rank truncated");
      }
      const flatCoefficients = Array.from({ length: totalDynkinRank }, () => 0);
      for (const supportPosition of unrankSupport(
        totalDynkinRank,
        2,
        decodeCharacters(bundleText.slice(position, supportEnd)),
      )) {
        flatCoefficients[supportPosition] = 1;
      }
      position = supportEnd;
      summands.push(splitFlatRow(flatCoefficients, factors));
      continue;
    }
    if (lead === SMALL_POSITIVE_MARKER) {
      position += 1;
      let supportSizePlusOne;
      [supportSizePlusOne, position] = decodeDescriptor(
        bundleText,
        position,
        "support size",
      );
      const supportSize = supportSizePlusOne - 1;
      if (supportSize < 0 || supportSize > totalDynkinRank) {
        throw new RangeError("support size out of range");
      }
      const flatCoefficients = Array.from({ length: totalDynkinRank }, () => 0);
      if (supportSize === 0) {
        summands.push(splitFlatRow(flatCoefficients, factors));
        continue;
      }
      const supportEnd =
        position + statesWidth(binomial(totalDynkinRank, supportSize));
      if (supportEnd > bundleText.length) {
        throw new RangeError("support rank truncated");
      }
      const supportPositions = unrankSupport(
        totalDynkinRank,
        supportSize,
        decodeCharacters(bundleText.slice(position, supportEnd)),
      );
      position = supportEnd;
      const valueEnd =
        position + statesWidth(BigInt(MAX_SMALL_VALUE) ** BigInt(supportSize));
      if (valueEnd > bundleText.length) {
        throw new RangeError("value payload truncated");
      }
      const values = unpackDigits(
        decodeCharacters(bundleText.slice(position, valueEnd)),
        MAX_SMALL_VALUE,
        supportSize,
      ).map((digit) => digit + 1);
      position = valueEnd;
      for (let index = 0; index < supportPositions.length; index += 1) {
        flatCoefficients[supportPositions[index]] = values[index];
      }
      summands.push(splitFlatRow(flatCoefficients, factors));
      continue;
    }
    if (lead !== POSITIVE_SPARSE_MARKER && lead !== SIGNED_SPARSE_MARKER) {
      throw new RangeError(
        `invalid bundle row lead character ${JSON.stringify(lead)}`,
      );
    }
    const signed = lead === SIGNED_SPARSE_MARKER;
    position += 1;
    let supportSizePlusOne;
    [supportSizePlusOne, position] = decodeDescriptor(
      bundleText,
      position,
      "support size",
    );
    const supportSize = supportSizePlusOne - 1;
    if (supportSize < 0 || supportSize > totalDynkinRank) {
      throw new RangeError("support size out of range");
    }
    const flatCoefficients = Array.from({ length: totalDynkinRank }, () => 0);
    if (supportSize === 0) {
      summands.push(splitFlatRow(flatCoefficients, factors));
      continue;
    }
    const supportWidth = statesWidth(binomial(totalDynkinRank, supportSize));
    const supportEnd = position + supportWidth;
    if (supportEnd > bundleText.length) {
      throw new RangeError("support rank truncated");
    }
    const supportRank = decodeCharacters(
      bundleText.slice(position, supportEnd),
    );
    if (supportRank >= binomial(totalDynkinRank, supportSize)) {
      throw new RangeError("support rank out of range");
    }
    position = supportEnd;
    const supportPositions = unrankSupport(
      totalDynkinRank,
      supportSize,
      supportRank,
    );
    let base;
    [base, position] = decodeDescriptor(bundleText, position, "value base");
    if (base < 2) {
      throw new RangeError("value base must be at least 2");
    }
    const valueWidth = statesWidth(BigInt(base) ** BigInt(supportSize));
    const valueEnd = position + valueWidth;
    if (valueEnd > bundleText.length) {
      throw new RangeError("value payload truncated");
    }
    const digits = unpackDigits(
      decodeCharacters(bundleText.slice(position, valueEnd)),
      base,
      supportSize,
    );
    position = valueEnd;
    const values = signed
      ? digits.map((digit) => decodeSignedDigit(digit))
      : digits.map((digit) => digit + 1);
    for (let index = 0; index < supportPositions.length; index += 1) {
      flatCoefficients[supportPositions[index]] = values[index];
    }
    summands.push(splitFlatRow(flatCoefficients, factors));
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

function flatRow(row) {
  return row.flat();
}

function compareIntegerArrays(left, right) {
  const sharedLength = Math.min(left.length, right.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (left[index] < right[index]) {
      return -1;
    }
    if (left[index] > right[index]) {
      return 1;
    }
  }
  return left.length - right.length;
}

function compareRowCertificates(left, right) {
  const sharedLength = Math.min(left.length, right.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const comparison = compareIntegerArrays(left[index], right[index]);
    if (comparison !== 0) {
      return comparison;
    }
  }
  return left.length - right.length;
}

function compareCertificates(left, right) {
  const sharedLength = Math.min(left.length, right.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const comparison = compareRowCertificates(left[index], right[index]);
    if (comparison !== 0) {
      return comparison;
    }
  }
  return left.length - right.length;
}

function equalFactorBlocks(factors) {
  const factorCodes = factors.map((factor) => encodeFactor(factor));
  const blocks = [];
  let start = 0;
  for (let stop = 1; stop <= factors.length; stop += 1) {
    if (stop === factors.length || factorCodes[stop] !== factorCodes[start]) {
      if (stop - start > 1) {
        blocks.push(
          Array.from({ length: stop - start }, (_, index) => start + index),
        );
      }
      start = stop;
    }
  }
  return blocks;
}

function singleSummandFactorOrder(factors, summand) {
  const order = Array.from({ length: factors.length }, (_, index) => index);
  for (const block of equalFactorBlocks(factors)) {
    const sortedBlock = block.slice().sort((left, right) => {
      const comparison = compareIntegerArrays(summand[left], summand[right]);
      return comparison === 0 ? left - right : comparison;
    });
    for (let index = 0; index < block.length; index += 1) {
      order[block[index]] = sortedBlock[index];
    }
  }
  return order;
}

function factorBlocks(factors) {
  const factorCodes = factors.map((factor) => encodeFactor(factor));
  const blocks = [];
  let start = 0;
  for (let stop = 1; stop <= factors.length; stop += 1) {
    if (stop === factors.length || factorCodes[stop] !== factorCodes[start]) {
      blocks.push(
        Array.from({ length: stop - start }, (_, index) => start + index),
      );
      start = stop;
    }
  }
  return blocks;
}

function refineRowGroups(groups, rows, factorIndex) {
  const refined = [];
  for (const group of groups) {
    const buckets = new Map();
    for (const rowIndex of group) {
      const value = rows[rowIndex][factorIndex];
      const key = JSON.stringify(value);
      if (!buckets.has(key)) {
        buckets.set(key, { value, rowIndices: [] });
      }
      buckets.get(key).rowIndices.push(rowIndex);
    }
    for (const { rowIndices } of [...buckets.values()].sort((left, right) =>
      compareIntegerArrays(left.value, right.value),
    )) {
      refined.push(rowIndices);
    }
  }
  return refined;
}

function emptySuffixCertificate(groups) {
  return groups.flatMap((group) => group.map(() => []));
}

function prependSuffixCertificate(
  factorIndex,
  suffixCertificate,
  groups,
  rows,
) {
  const certificate = [];
  let offset = 0;
  for (const group of groups) {
    const value = rows[group[0]][factorIndex];
    for (const suffix of suffixCertificate.slice(
      offset,
      offset + group.length,
    )) {
      certificate.push(value.concat(suffix));
    }
    offset += group.length;
  }
  return certificate;
}

function columnSignature(index, summands, summandsF) {
  const parts = [summands.map((row) => row[index])];
  if (summandsF !== null) {
    parts.push(summandsF.map((row) => row[index]));
  }
  return JSON.stringify(parts);
}

function canonicalFactorOrderDp(factors, summands, summandsF) {
  const blocks = factorBlocks(factors);
  const positionBlocks = Array.from({ length: factors.length });
  for (const block of blocks) {
    for (const position of block) {
      positionBlocks[position] = block;
    }
  }

  const initialGroups = [
    Array.from({ length: summands.length }, (_, index) => index),
  ];
  const initialGroupsF =
    summandsF === null
      ? null
      : [Array.from({ length: summandsF.length }, (_, index) => index)];
  const memo = new Map();
  const columnSignatures = Array.from({ length: factors.length }, (_, index) =>
    columnSignature(index, summands, summandsF),
  );

  function bestSuffix(groups, groupsF, remaining) {
    if (remaining.length === 0) {
      const parts = [emptySuffixCertificate(groups)];
      if (summandsF !== null) {
        parts.push(emptySuffixCertificate(groupsF));
      }
      return [[], parts];
    }
    const key = JSON.stringify([groups, groupsF, remaining]);
    const cached = memo.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const depth = factors.length - remaining.length;
    const block = positionBlocks[depth];
    const candidates = remaining.filter((index) => block.includes(index));
    const seenSignatures = new Set();
    let bestOrder = null;
    let bestCertificate = null;
    for (const candidate of candidates) {
      const signature = columnSignatures[candidate];
      if (seenSignatures.has(signature)) {
        continue;
      }
      seenSignatures.add(signature);
      const nextRemaining = remaining.filter((index) => index !== candidate);
      const nextGroups = refineRowGroups(groups, summands, candidate);
      const nextGroupsF =
        summandsF === null
          ? null
          : refineRowGroups(groupsF, summandsF, candidate);
      const [suffixOrder, suffixCertificate] = bestSuffix(
        nextGroups,
        nextGroupsF,
        nextRemaining,
      );
      const currentCertificate = [
        prependSuffixCertificate(
          candidate,
          suffixCertificate[0],
          nextGroups,
          summands,
        ),
      ];
      if (summandsF !== null) {
        currentCertificate.push(
          prependSuffixCertificate(
            candidate,
            suffixCertificate[1],
            nextGroupsF,
            summandsF,
          ),
        );
      }
      if (
        bestCertificate === null ||
        compareCertificates(currentCertificate, bestCertificate) < 0
      ) {
        bestCertificate = currentCertificate;
        bestOrder = [candidate, ...suffixOrder];
      }
    }

    const result = [bestOrder, bestCertificate];
    memo.set(key, result);
    return result;
  }

  return bestSuffix(
    initialGroups,
    initialGroupsF,
    Array.from({ length: factors.length }, (_, index) => index),
  )[0];
}

function canonicalFactorOrder(factors, summands, summandsF) {
  if (factors.length < 2) {
    return Array.from({ length: factors.length }, (_, index) => index);
  }
  if (summandsF === null && summands.length === 1) {
    return singleSummandFactorOrder(factors, summands[0]);
  }
  const blocks = equalFactorBlocks(factors);
  if (blocks.length === 0) {
    return Array.from({ length: factors.length }, (_, index) => index);
  }
  return canonicalFactorOrderDp(factors, summands, summandsF);
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
  orderedSummands.sort((left, right) =>
    compareIntegerArrays(flatRow(left), flatRow(right)),
  );
  if (isDegeneracy) {
    orderedSummandsF.sort((left, right) =>
      compareIntegerArrays(flatRow(left), flatRow(right)),
    );
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
