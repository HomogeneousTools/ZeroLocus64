import assert from "node:assert/strict";
import test from "node:test";

import {
  BASE64,
  ESCAPE,
  SEP,
  STANDARD_NAME,
  Factor,
  base64urlDecode,
  base64urlEncode,
  canonicalize,
  decodeLabel,
  encodeLabel,
  isCanonical,
} from "../src/index.js";
import {
  factorsFromCase,
  loadExamples,
  normalizeDecoded,
  normalizeExpected,
} from "./helpers.js";

const examplesData = await loadExamples();

const SPEC_EXAMPLES = [
  ["P1", [new Factor("A", 1, 1)], [], "1"],
  ["P1 with O(1)", [new Factor("A", 1, 1)], [[[1]]], "1.21"],
  ["P1 with O + O(1)", [new Factor("A", 1, 1)], [[[0]], [[1]]], "1.2021"],
  ["P3", [new Factor("A", 3, 1)], [], "30"],
  ["P3 with O(1)", [new Factor("A", 3, 1)], [[[1, 0, 0]]], "30.24"],
  [
    "P3 split bundle",
    [new Factor("A", 3, 1)],
    [[[1, 0, 0]], [[0, 0, 1]]],
    "30.2124",
  ],
  ["Gr(2,4)", [new Factor("A", 3, 2)], [], "31"],
  ["Gr(3,6)", [new Factor("A", 5, 4)], [], "53"],
  ["Fl(1,3,4)", [new Factor("A", 3, 5)], [], "34"],
  ["Q5", [new Factor("B", 3, 1)], [], "I0"],
  ["Q5 with bundle", [new Factor("B", 3, 1)], [[[1, 0, 0]]], "I0.24"],
  ["B5/B", [new Factor("B", 5, 31)], [], "KU"],
  ["OGr(5,10)", [new Factor("D", 5, 16)], [], "lF"],
  ["Freudenthal", [new Factor("E", 7, 64)], [], "y0_"],
  ["A16 boundary", [new Factor("A", 16, 1)], [], "G000"],
  ["A17 escape", [new Factor("A", 17, 1)], [], "0A1H000"],
  [
    "(P1)^5 diagonal",
    [
      new Factor("A", 1, 1),
      new Factor("A", 1, 1),
      new Factor("A", 1, 1),
      new Factor("A", 1, 1),
      new Factor("A", 1, 1),
    ],
    [[[1], [1], [1], [1], [1]]],
    "11111.2V",
  ],
  [
    "P1xP1 diagonal",
    [new Factor("A", 1, 1), new Factor("A", 1, 1)],
    [[[1], [1]]],
    "11.23",
  ],
  [
    "P1xP1 split",
    [new Factor("A", 1, 1), new Factor("A", 1, 1)],
    [
      [[1], [0]],
      [[0], [1]],
    ],
    "11.2122",
  ],
];

test("public constants are stable", () => {
  assert.equal(STANDARD_NAME, "ZeroLocus64");
  assert.equal(SEP, ".");
  assert.equal(ESCAPE, "0");
  assert.equal(BASE64.length, 64);
  assert.ok(BASE64.startsWith("0123456789"));
  assert.ok(BASE64.endsWith("-_"));
});

test("base64url helpers round-trip bytes", () => {
  const payload = Uint8Array.from([0xfb, 0xff]);
  assert.equal(base64urlEncode(payload), "-_y");
  assert.deepEqual(Array.from(base64urlDecode("-_y")), Array.from(payload));
});

test("factor marked nodes report one-based positions", () => {
  assert.deepEqual(
    new Factor("A", 5, (1 << 0) | (1 << 2) | (1 << 4)).markedNodes(),
    [1, 3, 5],
  );
});

for (const [name, factors, summands, label] of SPEC_EXAMPLES) {
  test(`spec example: ${name}`, () => {
    assert.equal(encodeLabel(factors, summands), label);
    assert.deepEqual(
      normalizeDecoded(decodeLabel(label)),
      normalizeDecoded(canonicalize(factors, summands)),
    );
  });
}

test("encodeLabel canonicalizes factor order", () => {
  assert.equal(
    encodeLabel(
      [new Factor("A", 2, 1), new Factor("A", 1, 1)],
      [[[0, 1], [1]]],
    ),
    "120.25",
  );
  assert.equal(
    encodeLabel(
      [new Factor("A", 1, 1), new Factor("A", 2, 1)],
      [[[1], [0, 1]]],
    ),
    "120.25",
  );
});

test("curated cases cover a few dozen examples", () => {
  assert.ok(examplesData.curated_cases.length >= 36);
});

test("curated case names are unique", () => {
  const names = examplesData.curated_cases.map(
    (exampleCase) => exampleCase.name,
  );
  assert.equal(names.length, new Set(names).size);
});

for (const [label, message] of [
  ["", "ambient part must be non-empty"],
  [".21", "ambient part must be non-empty"],
  ["30.", "separator requires a non-empty bundle"],
  ["0", "factor escape truncated"],
  ["0Z10", "unknown Dynkin type"],
  ["0G170_", "invalid Dynkin type/rank pair"],
  ["0A0", "escaped rank length must be positive"],
  ["0A2H", "escaped rank truncated"],
  ["0A1H", "mask truncated"],
  ["23", "mask out of range"],
  ["11.1", "invalid bundle base digit"],
  ["11.2", "summand truncated"],
  ["30.21.", "invalid bundle base digit"],
]) {
  test(`invalid label error: ${label || "<empty>"}`, () => {
    assert.throws(
      () => decodeLabel(label),
      (error) => error instanceof Error && error.message.includes(message),
    );
  });
}

test("curated canonicalization case stays stable", () => {
  const exampleCase = examplesData.curated_cases.find(
    (candidate) => candidate.name === "equal_factor_block_global_choice",
  );
  assert.ok(exampleCase);
  const factors = factorsFromCase(exampleCase);
  const summands = exampleCase.summands;
  assert.equal(
    encodeLabel([...factors].reverse(), [...summands].reverse()),
    exampleCase.label,
  );
});

test("decode results can be normalized against explicit factors", () => {
  const exampleCase = examplesData.curated_cases.find(
    (candidate) => candidate.name === "a3_p1_weight_100",
  );
  const factors = factorsFromCase(exampleCase);
  assert.deepEqual(
    normalizeDecoded(decodeLabel(exampleCase.label)),
    normalizeExpected(factors, exampleCase.summands),
  );
});

for (const [label, canonical] of [
  ["201.25", "120.26"],
  ["1.2120", "1.2021"],
  ["11.2221", "11.2122"],
]) {
  test(`non-canonical label rejected: ${label}`, () => {
    assert.throws(
      () => decodeLabel(label),
      (error) =>
        error instanceof Error &&
        error.message.includes("not in canonical form"),
    );
    assert.ok(decodeLabel(canonical));
  });
}

test("isCanonical returns true for valid canonical labels", () => {
  assert.equal(isCanonical("1"), true);
  assert.equal(isCanonical("1.21"), true);
  assert.equal(isCanonical("11.2122"), true);
  assert.equal(isCanonical("30.24"), true);
});

test("isCanonical returns false for non-canonical labels", () => {
  assert.equal(isCanonical("201.25"), false);
  assert.equal(isCanonical("1.2120"), false);
  assert.equal(isCanonical("11.2221"), false);
});

test("isCanonical returns false for invalid labels", () => {
  assert.equal(isCanonical(""), false);
  assert.equal(isCanonical(".21"), false);
  assert.equal(isCanonical("0"), false);
});
