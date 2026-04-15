import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Factor } from "../src/index.js";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(THIS_DIR, "..", "..");

export async function loadExamples() {
  const payload = await readFile(path.join(REPO_ROOT, "examples.json"), "utf8");
  return JSON.parse(payload);
}

export function factorFromPayload(payload) {
  return new Factor(
    String(payload.group),
    Number(payload.rank),
    BigInt(payload.mask),
  );
}

export function factorsFromCase(exampleCase) {
  return exampleCase.factors.map((payload) => factorFromPayload(payload));
}

export function normalizeFactors(factors) {
  return factors.map((factor) => ({
    group: factor.group,
    rank: factor.rank,
    mask: factor.mask.toString(),
    markedNodes: factor.markedNodes(),
  }));
}

export function normalizeSummands(summands) {
  return summands.map((row) => row.map((weights) => weights.slice()));
}

export function normalizeDecoded(result) {
  if (Array.isArray(result)) {
    return {
      factors: normalizeFactors(result[0]),
      summands: normalizeSummands(result[1]),
    };
  }
  if (result.type === "degeneracy_locus") {
    return {
      factors: normalizeFactors(result.factors),
      summandsE: normalizeSummands(result.summandsE),
      summandsF: normalizeSummands(result.summandsF),
      k: result.k,
    };
  }
  return {
    factors: normalizeFactors(result.factors),
    summands: normalizeSummands(result.summands),
  };
}

export function normalizeExpected(factors, summands) {
  return {
    factors: normalizeFactors(factors),
    summands: normalizeSummands(summands),
  };
}
