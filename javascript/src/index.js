export const STANDARD_NAME = "ZeroLocus64";
export const RFC4648_BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export const BASE64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
export const SEP = ".";
export const ESCAPE = BASE64[0];
export const TYPE_ORDER = "ABCDEFG";

export const TYPE_TABLE = Object.freeze([
  ...Array.from({ length: 16 }, (_, index) => ["A", index + 1]),
  ...Array.from({ length: 15 }, (_, index) => ["B", index + 2]),
  ...Array.from({ length: 14 }, (_, index) => ["C", index + 3]),
  ...Array.from({ length: 13 }, (_, index) => ["D", index + 4]),
  ["E", 6],
  ["E", 7],
  ["E", 8],
  ["F", 4],
  ["G", 2]
]);

export const TYPE_CHARS = BASE64.slice(1, 1 + TYPE_TABLE.length);

export const BASE64_INDEX = Object.freeze(
  Object.fromEntries(Array.from(BASE64, (character, value) => [character, value]))
);

export const TYPE_INDEX = new Map(
  TYPE_TABLE.map(([group, rank], index) => [`${group}${rank}`, index])
);

export const TYPE_CHAR_INDEX = Object.freeze(
  Object.fromEntries(Array.from(TYPE_CHARS, (character, index) => [character, index]))
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
    return row.map((weights) => {
      if (!Array.isArray(weights)) {
        throw new RangeError("highest-weight entry must be an array");
      }
      return weights.map((digit) => toNonNegativeSafeInteger(digit, "highest-weight digit"));
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

function compareStringTuples(left, right) {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const comparison = compareLexicographic(left[index], right[index]);
    if (comparison !== 0) {
      return comparison;
    }
  }
  return left.length - right.length;
}

function normalizeBytes(data) {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (Array.isArray(data)) {
    return Uint8Array.from(data);
  }
  throw new TypeError("data must be bytes-like");
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
    rank <= 64 &&
    ((group === "A" && rank >= 1) ||
    (group === "B" && rank >= 2) ||
    (group === "C" && rank >= 3) ||
    (group === "D" && rank >= 4) ||
    (group === "E" && (rank === 6 || rank === 7 || rank === 8)) ||
    (group === "F" && rank === 4) ||
    (group === "G" && rank === 2))
  );
}

export function validateTypeRank(group, rank) {
  if (!isValidTypeRank(group, rank)) {
    throw new RangeError(`invalid Dynkin type/rank pair ${group}${rank}`);
  }
}

function validateFactor(factor) {
  validateTypeRank(factor.group, factor.rank);
  if (!(1n <= factor.mask && factor.mask < (1n << BigInt(factor.rank)))) {
    throw new RangeError("mask out of range");
  }
}

export function base64urlEncode(data) {
  const bytes = normalizeBytes(data);
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const remaining = bytes.length - index;
    const chunk =
      (bytes[index] << 16) |
      ((remaining > 1 ? bytes[index + 1] : 0) << 8) |
      (remaining > 2 ? bytes[index + 2] : 0);
    encoded += BASE64[(chunk >> 18) & 63];
    encoded += BASE64[(chunk >> 12) & 63];
    if (remaining > 1) {
      encoded += BASE64[(chunk >> 6) & 63];
    }
    if (remaining > 2) {
      encoded += BASE64[chunk & 63];
    }
  }
  return encoded;
}

export function base64urlDecode(text) {
  if (typeof text !== "string") {
    throw new TypeError("text must be a string");
  }
  if (text.length % 4 === 1) {
    throw new RangeError("invalid Base64URL length (RFC 4648 does not permit length \u2261 1 mod 4)");
  }
  const bytes = [];
  let buffer = 0n;
  let bits = 0;
  for (const character of text) {
    const digit = BASE64_INDEX[character];
    if (digit === undefined) {
      throw new RangeError(`invalid Base64 digit ${JSON.stringify(character)}`);
    }
    buffer = (buffer << 6n) | BigInt(digit);
    bits += 6;
    while (bits >= 8) {
      bits -= 8;
      bytes.push(Number((buffer >> BigInt(bits)) & 255n));
      buffer &= bits === 0 ? 0n : (1n << BigInt(bits)) - 1n;
    }
  }
  if (bits > 0 && buffer !== 0n) {
    throw new RangeError("invalid Base64URL padding");
  }
  return Uint8Array.from(bytes);
}

function maskWidth(rank) {
  let width = 0;
  let capacity = 1n;
  const limit = (1n << BigInt(rank)) - 2n;
  while (capacity <= limit) {
    width += 1;
    capacity *= 64n;
  }
  return width;
}

function encodeSextets(value, width) {
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
  if (!(0n <= integerValue && integerValue < 64n ** BigInt(width))) {
    throw new RangeError("value does not fit in sextet width");
  }
  let remaining = integerValue;
  const digits = Array.from({ length: width }, () => ESCAPE);
  for (let index = width - 1; index >= 0; index -= 1) {
    digits[index] = BASE64[Number(remaining % 64n)];
    remaining /= 64n;
  }
  return digits.join("");
}

function decodeSextets(text) {
  let value = 0n;
  for (const character of text) {
    const digit = BASE64_INDEX[character];
    if (digit === undefined) {
      throw new RangeError(`invalid Base64 digit ${JSON.stringify(character)}`);
    }
    value = value * 64n + BigInt(digit);
  }
  return value;
}

function encodeNatural(value) {
  const integerValue = toBigInt(value, "natural");
  if (integerValue <= 0n) {
    throw new RangeError("natural must be positive");
  }
  let width = 1;
  let capacity = 64n;
  while (integerValue >= capacity) {
    width += 1;
    capacity *= 64n;
  }
  return encodeSextets(integerValue, width);
}

function encodeFactor(factor) {
  validateFactor(factor);
  const width = maskWidth(factor.rank);
  const index = TYPE_INDEX.get(`${factor.group}${factor.rank}`);
  if (index !== undefined) {
    return TYPE_CHARS[index] + encodeSextets(factor.mask - 1n, width);
  }
  const rankDigits = encodeNatural(factor.rank);
  return (
    ESCAPE +
    factor.group +
    encodeSextets(rankDigits.length, 1) +
    rankDigits +
    encodeSextets(factor.mask - 1n, width)
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
    const rankLength = Number(decodeSextets(text[position + 2]));
    if (rankLength <= 0) {
      throw new RangeError("escaped rank length must be positive");
    }
    const start = position + 3;
    const end = start + rankLength;
    if (end > text.length) {
      throw new RangeError("escaped rank truncated");
    }
    rank = toSafeInteger(decodeSextets(text.slice(start, end)), "rank");
    nextPosition = end;
  } else {
    const index = TYPE_CHAR_INDEX[leadCharacter];
    if (index === undefined) {
      throw new RangeError(`unknown standard factor character ${JSON.stringify(leadCharacter)}`);
    }
    [group, rank] = TYPE_TABLE[index];
    nextPosition = position + 1;
  }
  validateTypeRank(group, rank);
  const end = nextPosition + maskWidth(rank);
  if (end > text.length) {
    throw new RangeError("mask truncated");
  }
  const mask = end > nextPosition ? decodeSextets(text.slice(nextPosition, end)) + 1n : 1n;
  if (!(1n <= mask && mask < (1n << BigInt(rank)))) {
    throw new RangeError("mask out of range");
  }
  return [new Factor(group, rank, mask), end];
}

function rowBase(row) {
  let maxDigit = 1;
  for (const weights of row) {
    for (const digit of weights) {
      if (digit > maxDigit) {
        maxDigit = digit;
      }
    }
  }
  return Math.max(2, maxDigit + 1);
}

function rowValue(row, base) {
  let value = 0n;
  for (const weights of row) {
    for (const digit of weights) {
      value = value * BigInt(base) + BigInt(digit);
    }
  }
  return value;
}

function summandWidth(totalDynkinRank, base) {
  if (!(2 <= base && base < 64)) {
    throw new RangeError("bundle base must lie in 2..63");
  }
  let width = 1;
  let capacity = 64n;
  const required = BigInt(base) ** BigInt(totalDynkinRank);
  while (capacity < required) {
    width += 1;
    capacity *= 64n;
  }
  return width;
}

function encodeSummand(row, totalDynkinRank) {
  const base = rowBase(row);
  const width = summandWidth(totalDynkinRank, base);
  return encodeSextets(base, 1) + encodeSextets(rowValue(row, base), width);
}

function reorder(order, factors, summands) {
  return [
    order.map((index) => factors[index]),
    summands.map((row) => order.map((index) => row[index].slice()))
  ];
}

function permutations(indices) {
  if (indices.length <= 1) {
    return [indices.slice()];
  }
  const result = [];
  const working = indices.slice();
  function visit(position) {
    if (position === working.length) {
      result.push(working.slice());
      return;
    }
    for (let swapIndex = position; swapIndex < working.length; swapIndex += 1) {
      [working[position], working[swapIndex]] = [working[swapIndex], working[position]];
      visit(position + 1);
      [working[position], working[swapIndex]] = [working[swapIndex], working[position]];
    }
  }
  visit(0);
  return result;
}

export function canonicalize(factors, summands) {
  const normalizedFactors = factors.map((factor) => coerceFactor(factor));
  const normalizedSummands = normalizeSummands(summands, normalizedFactors);
  const initialOrder = normalizedFactors
    .map((_, index) => index)
    .sort((left, right) =>
      compareLexicographic(encodeFactor(normalizedFactors[left]), encodeFactor(normalizedFactors[right]))
    );
  let [orderedFactors, orderedSummands] = reorder(initialOrder, normalizedFactors, normalizedSummands);
  const totalDynkinRank = orderedFactors.reduce((sum, factor) => sum + factor.rank, 0);
  const factorCodes = orderedFactors.map((factor) => encodeFactor(factor));
  const equalFactorBlocks = [];
  for (let start = 0; start < orderedFactors.length; ) {
    let stop = start + 1;
    while (stop < orderedFactors.length && factorCodes[stop] === factorCodes[start]) {
      stop += 1;
    }
    const block = Array.from({ length: stop - start }, (_, offset) => start + offset);
    equalFactorBlocks.push(block.length === 1 ? [block] : permutations(block));
    start = stop;
  }

  let bestSignature = null;
  let bestOrder = Array.from({ length: orderedFactors.length }, (_, index) => index);
  const currentOrder = [];

  function explore(blockIndex) {
    if (blockIndex === equalFactorBlocks.length) {
      const [, trialSummands] = reorder(currentOrder, orderedFactors, orderedSummands);
      const signature = trialSummands
        .map((row) => encodeSummand(row, totalDynkinRank))
        .sort(compareLexicographic);
      if (bestSignature === null || compareStringTuples(signature, bestSignature) < 0) {
        bestSignature = signature;
        bestOrder = currentOrder.slice();
      }
      return;
    }
    for (const choice of equalFactorBlocks[blockIndex]) {
      currentOrder.push(...choice);
      explore(blockIndex + 1);
      currentOrder.length -= choice.length;
    }
  }

  explore(0);
  [orderedFactors, orderedSummands] = reorder(bestOrder, orderedFactors, orderedSummands);
  orderedSummands.sort((left, right) =>
    compareLexicographic(encodeSummand(left, totalDynkinRank), encodeSummand(right, totalDynkinRank))
  );
  return [orderedFactors, orderedSummands];
}

export function encodeLabel(factors, summands) {
  const [canonicalFactors, canonicalSummands] = canonicalize(factors, summands);
  const ambientText = canonicalFactors.map((factor) => encodeFactor(factor)).join("");
  if (canonicalSummands.length === 0) {
    return ambientText;
  }
  const totalDynkinRank = canonicalFactors.reduce((sum, factor) => sum + factor.rank, 0);
  const bundleText = canonicalSummands
    .map((row) => encodeSummand(row, totalDynkinRank))
    .join("");
  return ambientText + SEP + bundleText;
}

function decodeLabelRaw(label) {
  if (typeof label !== "string") {
    throw new TypeError("label must be a string");
  }
  const separatorIndex = label.indexOf(SEP);
  const ambientText = separatorIndex < 0 ? label : label.slice(0, separatorIndex);
  const bundleText = separatorIndex < 0 ? "" : label.slice(separatorIndex + 1);
  if (!ambientText) {
    throw new RangeError("ambient part must be non-empty");
  }
  if (separatorIndex >= 0 && !bundleText) {
    throw new RangeError("separator requires a non-empty bundle");
  }

  const factors = [];
  let position = 0;
  while (position < ambientText.length) {
    const [factor, nextPosition] = decodeFactor(ambientText, position);
    factors.push(factor);
    position = nextPosition;
  }
  if (separatorIndex < 0) {
    return [factors, []];
  }

  const totalDynkinRank = factors.reduce((sum, factor) => sum + factor.rank, 0);
  const summands = [];
  position = 0;
  while (position < bundleText.length) {
    const baseDigit = bundleText[position];
    const base = BASE64_INDEX[baseDigit];
    if (!(2 <= base && base < 64)) {
      throw new RangeError(`invalid bundle base digit ${JSON.stringify(baseDigit)}`);
    }
    const width = summandWidth(totalDynkinRank, base);
    const start = position + 1;
    const end = start + width;
    if (end > bundleText.length) {
      throw new RangeError("summand truncated");
    }
    let value = decodeSextets(bundleText.slice(start, end));
    position = end;

    const flatDigits = Array.from({ length: totalDynkinRank }, () => 0);
    for (let index = totalDynkinRank - 1; index >= 0; index -= 1) {
      flatDigits[index] = Number(value % BigInt(base));
      value /= BigInt(base);
    }
    if (value !== 0n) {
      throw new RangeError("packed value exceeds range");
    }

    const row = [];
    let offset = 0;
    for (const factor of factors) {
      row.push(flatDigits.slice(offset, offset + factor.rank));
      offset += factor.rank;
    }
    summands.push(row);
  }
  return [factors, summands];
}

export function decodeLabel(label) {
  const [factors, summands] = decodeLabelRaw(label);
  if (encodeLabel(factors, summands) !== label) {
    throw new RangeError("label is not in canonical form");
  }
  return [factors, summands];
}

export function isCanonical(label) {
  try {
    const [factors, summands] = decodeLabelRaw(label);
    return encodeLabel(factors, summands) === label;
  } catch {
    return false;
  }
}

export const base64url_encode = base64urlEncode;
export const base64url_decode = base64urlDecode;
export const encode_label = encodeLabel;
export const decode_label = decodeLabel;
export const is_canonical = isCanonical;