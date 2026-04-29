import assert from "node:assert/strict";
import test from "node:test";

import {
  BASE62,
  ESCAPE,
  LOCUS_SEP,
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
  ["P1 with O(1)", [new Factor("A", 1, 1)], [[[1]]], "1.0"],
  ["P1 with O + O(1)", [new Factor("A", 1, 1)], [[[0]], [[1]]], "1.0x1"],
  ["P3", [new Factor("A", 3, 1)], [], "30"],
  ["P3 with O(1)", [new Factor("A", 3, 1)], [[[1, 0, 0]]], "30.0"],
  ["P3 with O(-1)", [new Factor("A", 3, 1)], [[[-1, 0, 0]]], "30.z2020"],
  [
    "P3 split bundle",
    [new Factor("A", 3, 1)],
    [[[1, 0, 0]], [[0, 0, 1]]],
    "30.02",
  ],
  ["Gr(2,4)", [new Factor("A", 3, 2)], [], "31"],
  ["Gr(3,6)", [new Factor("A", 5, 4)], [], "53"],
  ["Fl(1,3,4)", [new Factor("A", 3, 5)], [], "34"],
  ["Q5", [new Factor("B", 3, 1)], [], "H0"],
  ["Q5 with bundle", [new Factor("B", 3, 1)], [[[1, 0, 0]]], "H0.0"],
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
    "11111.x6000",
  ],
  [
    "P1xP1 diagonal",
    [new Factor("A", 1, 1), new Factor("A", 1, 1)],
    [[[1], [1]]],
    "11.E",
  ],
  [
    "P1xP1 split",
    [new Factor("A", 1, 1), new Factor("A", 1, 1)],
    [
      [[1], [0]],
      [[0], [1]],
    ],
    "11.01",
  ],
  [
    "(P1)^3 v2.2 positive difference",
    [new Factor("A", 1, 1), new Factor("A", 1, 1), new Factor("A", 1, 1)],
    [
      [[0], [0], [1]],
      [[0], [2], [0]],
    ],
    "111.15",
  ],
  [
    "(P1)^3 v2.2 signed difference",
    [new Factor("A", 1, 1), new Factor("A", 1, 1), new Factor("A", 1, 1)],
    [
      [[-1], [-1], [-1]],
      [[-1], [-1], [0]],
    ],
    "111.z3020z420",
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
    "120.M",
  );
  assert.equal(
    encodeLabel(
      [new Factor("A", 1, 1), new Factor("A", 2, 1)],
      [[[1], [0, 1]]],
    ),
    "120.M",
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
  ["30.", "separator requires a non-empty locus"],
  ["0", "factor escape truncated"],
  ["0Z10", "unknown Dynkin type"],
  ["0G170_", "invalid Dynkin type/rank pair"],
  ["0A0", "escaped rank length must be positive"],
  ["0A2H", "escaped rank truncated"],
  ["0A1H", "mask truncated"],
  ["23", "mask out of range"],
  ["11.x", "unexpected end decoding support size"],
  ["11.2", "label is not in canonical form"],
  ["30.21.", "invalid bundle row lead character"],
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
  const summands = exampleCase.summands.map((row) => [...row].reverse());
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
  ["201.25", "120.M"],
  ["1.2120", "1.0x1"],
  ["11.2221", "11.01"],
  ["111.2136", "111.15"],
  ["111.123127", "111.z3020z420"],
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
  assert.equal(isCanonical("1.0"), true);
  assert.equal(isCanonical("11.01"), true);
  assert.equal(isCanonical("30.0"), true);
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
  assert.equal(label, "1.y2zy");
  assert.deepEqual(
    normalizeDecoded(decodeLabel(label)),
    normalizeDecoded(canonicalize(factors, summands)),
  );
});

test("escaped base round-trip: coefficient 100", () => {
  const factors = [new Factor("A", 1, 1)];
  const summands = [[[100]]];
  const label = encodeLabel(factors, summands);
  assert.equal(label, "1.y2021c1b");
  assert.deepEqual(
    normalizeDecoded(decodeLabel(label)),
    normalizeDecoded(canonicalize(factors, summands)),
  );
});

test("escaped base round-trip: mixed standard and escaped", () => {
  const factors = [new Factor("A", 1, 1)];
  const summands = [[[61]], [[1]]];
  const label = encodeLabel(factors, summands);
  assert.equal(label, "1.0y2zy");
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

test("signed weight round-trip", () => {
  const factors = [new Factor("A", 1, 1)];
  const summands = [[[-1]]];
  const label = encodeLabel(factors, summands);
  assert.equal(label, "1.z220");
  assert.deepEqual(
    normalizeDecoded(decodeLabel(label)),
    normalizeDecoded(canonicalize(factors, summands)),
  );
});

test("signed weights sort canonically across equal factors", () => {
  const factors = [new Factor("A", 1, 1), new Factor("A", 1, 1)];
  const summands = [
    [[0], [-1]],
    [[-1], [0]],
  ];
  assert.equal(encodeLabel(factors, summands), "11.z2020z2120");
});

test("isCanonical accepts escaped base labels", () => {
  assert.equal(isCanonical("1.y2zy"), true);
  assert.equal(isCanonical("1.y2021c1b"), true);
  assert.equal(isCanonical("1.0y2zy"), true);
});

// --- Degeneracy locus tests ---

test("LOCUS_SEP constant is dash", () => {
  assert.equal(LOCUS_SEP, "-");
});

const DEGENERACY_EXAMPLES = [
  ["P1 id", [new Factor("A", 1, 1)], [[[1]]], [[[1]]], 0, "1.0-0-0"],
  [
    "P1 signed source",
    [new Factor("A", 1, 1)],
    [[[-1]]],
    [[[1]]],
    0,
    "1.z220-0-0",
  ],
  [
    "P1xP1",
    [new Factor("A", 1, 1), new Factor("A", 1, 1)],
    [[[1], [0]]],
    [[[0], [1]]],
    0,
    "11.1-0-0",
  ],
  [
    "P3 two-to-one",
    [new Factor("A", 3, 1)],
    [[[1, 0, 0]], [[1, 0, 0]]],
    [[[2, 0, 0]]],
    1,
    "30.00-3-1",
  ],
];

for (const [
  name,
  factors,
  summandsE,
  summandsF,
  k,
  label,
] of DEGENERACY_EXAMPLES) {
  test(`degeneracy spec: ${name}`, () => {
    assert.equal(encodeLabel(factors, summandsE, summandsF, k), label);
    const result = decodeLabel(label);
    assert.equal(result.type, "degeneracy_locus");
    assert.equal(result.k, k);
    assert.equal(result.summandsE.length, summandsE.length);
    assert.equal(result.summandsF.length, summandsF.length);
  });
}

test("degeneracy decode returns tagged result", () => {
  const result = decodeLabel("1.0-0-0");
  assert.equal(result.type, "degeneracy_locus");
  assert.equal(result.factors.length, 1);
  assert.deepEqual(result.summandsE, [[[1]]]);
  assert.deepEqual(result.summandsF, [[[1]]]);
  assert.equal(result.k, 0);
});

test("degeneracy round-trip preserves data", () => {
  const factors = [new Factor("A", 2, 1)];
  const summandsE = [[[1, 0]]];
  const summandsF = [[[0, 1]]];
  const k = 0;
  const label = encodeLabel(factors, summandsE, summandsF, k);
  const result = decodeLabel(label);
  assert.equal(result.type, "degeneracy_locus");
  assert.equal(
    encodeLabel(result.factors, result.summandsE, result.summandsF, result.k),
    label,
  );
});

test("degeneracy canonicalize minimizes E then F", () => {
  const factors = [new Factor("A", 1, 1), new Factor("A", 1, 1)];
  // Same data, both orderings yield same label
  const label1 = encodeLabel(factors, [[[1], [0]]], [[[0], [1]]], 0);
  const label2 = encodeLabel(factors, [[[0], [1]]], [[[1], [0]]], 0);
  assert.equal(label1, label2);
  assert.equal(label1, "11.1-0-0");
});

test("degeneracy rank bound k > 0", () => {
  const factors = [new Factor("A", 3, 1)];
  const label = encodeLabel(factors, [[[1, 0, 0]]], [[[1, 0, 0]]], 5);
  assert.ok(label.endsWith("-5"));
  const result = decodeLabel(label);
  assert.equal(result.k, 5);
});

test("degeneracy rank bound k=62 uses two characters", () => {
  const factors = [new Factor("A", 1, 1)];
  const label = encodeLabel(factors, [[[1]]], [[[1]]], 62);
  assert.ok(label.endsWith("-10"));
  const result = decodeLabel(label);
  assert.equal(result.k, 62);
});

test("isCanonical works for degeneracy labels", () => {
  assert.equal(isCanonical("1.0-0-0"), true);
  assert.equal(isCanonical("11.1-0-0"), true);
  assert.equal(isCanonical("30.00-3-1"), true);
});

for (const [label, message] of [
  ["1.21-21-", "rank bound must be non-empty"],
  ["1.-21-0", "bundle E must be non-empty"],
  ["1.21--0", "bundle F must be non-empty"],
  ["1.21-21-21-0", "locus part must contain 0 or 2 dashes"],
]) {
  test(`invalid degeneracy: ${label}`, () => {
    assert.throws(
      () => decodeLabel(label),
      (error) => error instanceof Error && error.message.includes(message),
    );
  });
}

test("zero-locus decode returns tagged result", () => {
  const result = decodeLabel("1.0");
  assert.equal(result.type, "zero_locus");
  assert.deepEqual(result.summands, [[[1]]]);
});

test("ambient-only decode returns tagged result", () => {
  const result = decodeLabel("1");
  assert.equal(result.type, "ambient");
  assert.deepEqual(result.summands, []);
});
