import assert from "node:assert/strict";
import test from "node:test";

import {
  Factor,
  canonicalize,
  decodeLabel,
  encodeLabel,
} from "../src/index.js";
import { normalizeDecoded } from "./helpers.js";

test("repeated summands remain explicit", () => {
  assert.equal(encodeLabel([new Factor("A", 1, 1)], [[[1]], [[1]]]), "1.2121");
});

test("high coefficients choose larger bases", () => {
  const label = encodeLabel([new Factor("A", 1, 1)], [[[42]]]);
  assert.ok(label.startsWith("1."));
  assert.deepEqual(
    normalizeDecoded(decodeLabel(label)),
    normalizeDecoded([[new Factor("A", 1, 1)], [[[42]]]]),
  );
});

test("multiple summands may use different bases", () => {
  const factors = [new Factor("A", 1, 1), new Factor("A", 1, 1)];
  const summands = [
    [[1], [0]],
    [[5], [0]],
    [[12], [0]],
  ];
  const label = encodeLabel(factors, summands);
  assert.deepEqual(
    normalizeDecoded(decodeLabel(label)),
    normalizeDecoded(canonicalize(factors, summands)),
  );
});

test("invalid Dynkin type rank pairs are rejected on encode", () => {
  assert.throws(
    () => encodeLabel([new Factor("G", 7, 64)], []),
    (error) =>
      error instanceof Error &&
      error.message.includes("invalid Dynkin type/rank pair"),
  );
});

for (const label of ["H0.24", "iF", "u11", "0A1H000", "0B1H000"]) {
  test(`non-A and escape example decodes: ${label}`, () => {
    const [factors] = decodeLabel(label);
    assert.ok(factors.length > 0);
  });
}
