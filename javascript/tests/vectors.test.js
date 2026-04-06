import assert from "node:assert/strict";
import test from "node:test";

import { decodeLabel, encodeLabel, isValidTypeRank } from "../src/index.js";
import { factorsFromCase, loadExamples, normalizeDecoded } from "./helpers.js";

const examplesData = await loadExamples();

test("curated vectors round-trip", () => {
  for (const exampleCase of examplesData.curated_cases) {
    const factors = factorsFromCase(exampleCase);
    const summands = exampleCase.summands;
    assert.equal(
      encodeLabel(factors, summands),
      exampleCase.label,
      exampleCase.name,
    );
    assert.deepEqual(
      normalizeDecoded(decodeLabel(exampleCase.label)),
      normalizeDecoded([factors, summands]),
      exampleCase.name,
    );
  }
});

test("corpus vectors are extensive", () => {
  assert.ok(examplesData.corpus_cases.length >= 2000);
});

test("curated vectors respect Dynkin classification", () => {
  for (const exampleCase of examplesData.curated_cases) {
    const factors = factorsFromCase(exampleCase);
    assert.ok(
      factors.every((factor) => isValidTypeRank(factor.group, factor.rank)),
      exampleCase.name,
    );
  }
});

test("corpus vectors respect Dynkin classification", () => {
  for (const exampleCase of examplesData.corpus_cases) {
    const factors = factorsFromCase(exampleCase);
    assert.ok(
      factors.every((factor) => isValidTypeRank(factor.group, factor.rank)),
      String(exampleCase.index),
    );
  }
});

test("full corpus round-trip", () => {
  for (const exampleCase of examplesData.corpus_cases) {
    const factors = factorsFromCase(exampleCase);
    const summands = exampleCase.summands;
    assert.equal(
      encodeLabel(factors, summands),
      exampleCase.label,
      String(exampleCase.index),
    );
    assert.deepEqual(
      normalizeDecoded(decodeLabel(exampleCase.label)),
      normalizeDecoded([factors, summands]),
      String(exampleCase.index),
    );
  }
});

test("corpus length fields match labels", () => {
  for (const exampleCase of examplesData.corpus_cases) {
    assert.equal(exampleCase.length, exampleCase.label.length);
  }
});

test("corpus length statistics stay compact", () => {
  const lengths = examplesData.corpus_cases
    .map((exampleCase) => exampleCase.length)
    .sort((left, right) => left - right);
  const sum = lengths.reduce((total, value) => total + value, 0);
  const mean = sum / lengths.length;
  const median = lengths[Math.floor(lengths.length / 2)];
  const percentile90 = lengths[Math.floor(0.9 * lengths.length) - 1];
  assert.equal(lengths.length, 2088);
  assert.ok(Number(mean.toFixed(2)) < 16);
  assert.ok(median <= 15);
  assert.ok(percentile90 <= 20);
  assert.ok(lengths.at(-1) >= 30);
});
