import assert from "node:assert/strict";
import test from "node:test";

import {
  BASE62,
  ESCAPE,
  SEP,
  STANDARD_NAME,
  Factor,
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
  ["Q5", [new Factor("B", 3, 1)], [], "H0"],
  ["Q5 with bundle", [new Factor("B", 3, 1)], [[[1, 0, 0]]], "H0.24"],
  ["B5/B", [new Factor("B", 5, 31)], [], "JU"],
  ["OGr(5,10)", [new Factor("D", 5, 16)], [], "iF"],
  ["Freudenthal", [new Factor("E", 7, 64)], [], "u11"],
  ["A15 boundary", [new Factor("A", 15, 1)], [], "F000"],
  ["A16 escape", [new Factor("A", 16, 1)], [], "0A1G000"],
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
  assert.equal(STANDARD_NAME, "ZeroLocus62");
  assert.equal(SEP, ".");
  assert.equal(ESCAPE, "0");
  assert.equal(BASE62.length, 62);
  assert.ok(BASE62.startsWith("0123456789"));
  assert.ok(BASE62.endsWith("yz"));
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
  ["11.1", "bundle base character 1 is reserved"],
  ["11.2", "summand truncated"],
  ["30.21.", "invalid bundle base character"],
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

test("escaped base round-trip: coefficient 61", () => {
  const factors = [new Factor("A", 1, 1)];
  const summands = [[[61]]];
  const label = encodeLabel(factors, summands);
  assert.equal(label, "1.0210z");
  assert.deepEqual(
    normalizeDecoded(decodeLabel(label)),
    normalizeDecoded(canonicalize(factors, summands)),
  );
});

test("escaped base round-trip: coefficient 100", () => {
  const factors = [new Factor("A", 1, 1)];
  const summands = [[[100]]];
  const label = encodeLabel(factors, summands);
  assert.equal(label, "1.021d1c");
  assert.deepEqual(
    normalizeDecoded(decodeLabel(label)),
    normalizeDecoded(canonicalize(factors, summands)),
  );
});

test("escaped base round-trip: mixed standard and escaped", () => {
  const factors = [new Factor("A", 1, 1)];
  const summands = [[[61]], [[1]]];
  const label = encodeLabel(factors, summands);
  assert.equal(label, "1.0210z21");
  assert.deepEqual(
    normalizeDecoded(decodeLabel(label)),
    normalizeDecoded(canonicalize(factors, summands)),
  );
});

test("escaped base round-trip: large coefficient", () => {
  const factors = [new Factor("A", 1, 1)];
  const summands = [[[1000]]];
  const label = encodeLabel(factors, summands);
  assert.deepEqual(
    normalizeDecoded(decodeLabel(label)),
    normalizeDecoded(canonicalize(factors, summands)),
  );
});

test("isCanonical accepts escaped base labels", () => {
  assert.equal(isCanonical("1.0210z"), true);
  assert.equal(isCanonical("1.021d1c"), true);
  assert.equal(isCanonical("1.0210z21"), true);
});
