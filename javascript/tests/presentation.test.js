import assert from "node:assert/strict";
import test from "node:test";

import {
  Factor,
  decodeDetailedLabel,
  describeFactor,
  formatDynkinTypeLatex,
  formatFundamentalWeightExpression,
  formatParabolicLatex,
  renderDynkinDiagramSvg,
} from "../src/presentation.js";

test("type A descriptions use projective and Grassmannian notation", () => {
  assert.equal(describeFactor(new Factor("A", 3, 1)).humanReadable, "P^3");
  assert.equal(describeFactor(new Factor("A", 5, 4)).humanReadable, "Gr(3,6)");
  assert.equal(
    describeFactor(new Factor("A", 3, 5)).humanReadable,
    "Fl(1,3;4)",
  );
});

test("classical non-A descriptions use orthogonal and symplectic notation", () => {
  assert.equal(describeFactor(new Factor("B", 3, 1)).humanReadable, "Q^5");
  assert.equal(describeFactor(new Factor("C", 3, 4)).humanReadable, "LGr(3,6)");
  assert.equal(
    describeFactor(new Factor("D", 5, 16)).humanReadable,
    "OGr+(5,10)",
  );
  assert.equal(describeFactor(new Factor("D", 5, 16)).identification, null);
});

test("Dynkin and parabolic latex use roman font", () => {
  assert.equal(formatDynkinTypeLatex(new Factor("B", 3, 1)), "\\mathrm{B}_{3}");
  assert.equal(formatParabolicLatex([1, 3]), "\\mathrm{P}_{\\{1,3\\}}");
});

test("exceptional factors avoid informal names", () => {
  assert.equal(describeFactor(new Factor("E", 7, 64)).humanReadable, "E7 / P7");
});

test("fundamental weight expressions stay readable", () => {
  assert.equal(formatFundamentalWeightExpression([0, 0, 0]), "0");
  assert.equal(
    formatFundamentalWeightExpression([1, 0, 2]),
    "omega1 + 2 omega3",
  );
});

test("detailed decode provides ambient summaries", () => {
  const details = decodeDetailedLabel("11.2122");
  assert.equal(details.ambient.humanReadable, "P^1 x P^1");
  assert.equal(details.summandDetails.length, 2);
  assert.equal(details.summandDetails[0].factorWeights[0].tuple, "(0)");
});

test("dynkin diagram SVG uses the marked grassmannian-info style", () => {
  const svg = renderDynkinDiagramSvg(new Factor("B", 3, 1), {
    weights: [1, 0, 0],
  });
  assert.match(svg, /<svg class="dynkin"/);
  assert.match(svg, /data-label="B3-1" class="active"/);
  assert.match(svg, /class="dynkin-weight"/);
});
