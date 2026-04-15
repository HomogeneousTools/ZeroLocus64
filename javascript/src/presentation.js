import { Factor, decodeLabel, encodeLabel } from "./index.js";

export { Factor };

function asFactor(factor) {
  if (factor instanceof Factor) {
    return factor;
  }
  return new Factor(factor.group, factor.rank, factor.mask);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatParabolic(nodes) {
  return nodes.length === 1 ? `P${nodes[0]}` : `P{${nodes.join(",")}}`;
}

export function formatParabolicLatex(nodes) {
  return nodes.length === 1
    ? `\\mathrm{P}_{${nodes[0]}}`
    : `\\mathrm{P}_{\\{${nodes.join(",")}\\}}`;
}

export function formatDynkinTypeLatex(factor) {
  const entry = asFactor(factor);
  return `\\mathrm{${entry.group}}_{${entry.rank}}`;
}

export function formatHighestWeight(weights) {
  return `(${weights.join(", ")})`;
}

export function formatHighestWeightLatex(weights) {
  return `\\left(${weights.join(", ")}\\right)`;
}

export function formatFundamentalWeightExpression(weights) {
  const terms = [];
  weights.forEach((coefficient, index) => {
    if (coefficient === 0) {
      return;
    }
    terms.push(
      coefficient === 1
        ? `omega${index + 1}`
        : `${coefficient} omega${index + 1}`,
    );
  });
  return terms.length === 0 ? "0" : terms.join(" + ");
}

export function formatFundamentalWeightLatex(weights) {
  const terms = [];
  weights.forEach((coefficient, index) => {
    if (coefficient === 0) {
      return;
    }
    terms.push(
      coefficient === 1
        ? `\\omega_{${index + 1}}`
        : `${coefficient}\\omega_{${index + 1}}`,
    );
  });
  return terms.length === 0 ? "0" : terms.join(" + ");
}

export function factorNotation(factor) {
  const entry = asFactor(factor);
  return `${entry.group}${entry.rank} / ${formatParabolic(entry.markedNodes())}`;
}

export function factorNotationLatex(factor) {
  const entry = asFactor(factor);
  return `${formatDynkinTypeLatex(entry)} / ${formatParabolicLatex(entry.markedNodes())}`;
}

function projectiveLatex(n) {
  return `\\mathbb{P}^{${n}}`;
}

function romanLabelLatex(name, args = [], options = {}) {
  const renderedName = options.superscript
    ? `\\mathrm{${name}}^{${options.superscript}}`
    : `\\mathrm{${name}}`;
  if (args.length === 0) {
    return renderedName;
  }
  return `${renderedName}(${args.join(",")})`;
}

function classicalFactorName(group, rank, nodes) {
  if (nodes.length !== 1) {
    if (group === "A") {
      return {
        label: `Fl(${nodes.join(",")};${rank + 1})`,
        latex: romanLabelLatex("Fl", [`${nodes.join(",")};${rank + 1}`]),
        family: "flag",
      };
    }
    if (group === "B") {
      return {
        label: `OFl(${nodes.join(",")};${2 * rank + 1})`,
        latex: romanLabelLatex("OFl", [`${nodes.join(",")};${2 * rank + 1}`]),
        family: "flag",
      };
    }
    if (group === "C") {
      return {
        label: `SFl(${nodes.join(",")};${2 * rank})`,
        latex: romanLabelLatex("SFl", [`${nodes.join(",")};${2 * rank}`]),
        family: "flag",
      };
    }
    return {
      label: `OFl(${nodes.join(",")};${2 * rank})`,
      latex: romanLabelLatex("OFl", [`${nodes.join(",")};${2 * rank}`]),
      family: "flag",
    };
  }

  const node = nodes[0];
  if (group === "A") {
    const n = rank + 1;
    const canonicalNode = Math.min(node, n - node);
    if (canonicalNode === 1) {
      return {
        label: `P^${n - 1}`,
        latex: projectiveLatex(n - 1),
        family: "grassmannian",
      };
    }
    return {
      label: `Gr(${canonicalNode},${n})`,
      latex: romanLabelLatex("Gr", [canonicalNode, n]),
      family: "grassmannian",
    };
  }
  if (group === "B") {
    if (node === 1) {
      return {
        label: `Q^${2 * rank - 1}`,
        latex: `\\mathrm{Q}^{${2 * rank - 1}}`,
        family: "grassmannian",
      };
    }
    if (rank === 2 && node === 2) {
      return {
        label: "P^3",
        latex: projectiveLatex(3),
        family: "grassmannian",
      };
    }
    return {
      label: `OGr(${node},${2 * rank + 1})`,
      latex: romanLabelLatex("OGr", [node, 2 * rank + 1]),
      family: "grassmannian",
    };
  }
  if (group === "C") {
    if (node === 1) {
      return {
        label: `P^${2 * rank - 1}`,
        latex: projectiveLatex(2 * rank - 1),
        family: "grassmannian",
      };
    }
    if (rank === 2 && node === 2) {
      return {
        label: "Q^3",
        latex: "\\mathrm{Q}^{3}",
        family: "grassmannian",
      };
    }
    if (node === rank) {
      return {
        label: `LGr(${rank},${2 * rank})`,
        latex: romanLabelLatex("LGr", [rank, 2 * rank]),
        family: "grassmannian",
      };
    }
    return {
      label: `SGr(${node},${2 * rank})`,
      latex: romanLabelLatex("SGr", [node, 2 * rank]),
      family: "grassmannian",
    };
  }
  if (node === 1) {
    return {
      label: `Q^${2 * rank - 2}`,
      latex: `\\mathrm{Q}^{${2 * rank - 2}}`,
      family: "grassmannian",
    };
  }
  if (rank === 3 && (node === 2 || node === 3)) {
    return {
      label: "P^3",
      latex: projectiveLatex(3),
      family: "grassmannian",
    };
  }
  if (rank === 4 && (node === 3 || node === 4)) {
    return {
      label: "Q^6",
      latex: "\\mathrm{Q}^{6}",
      family: "grassmannian",
    };
  }
  if (node === rank - 1 || node === rank) {
    return {
      label: `OGr+(${rank},${2 * rank})`,
      latex: romanLabelLatex("OGr", [rank, 2 * rank], { superscript: "+" }),
      family: "grassmannian",
    };
  }
  return {
    label: `OGr(${node},${2 * rank})`,
    latex: romanLabelLatex("OGr", [node, 2 * rank]),
    family: "grassmannian",
  };
}

function exceptionalFactorName(group, rank, nodes) {
  return {
    label: `${group}${rank} / ${formatParabolic(nodes)}`,
    latex: `\\mathrm{${group}}_{${rank}} / ${formatParabolicLatex(nodes)}`,
    family: nodes.length === 1 ? "grassmannian" : "flag",
  };
}

export function describeFactor(factor) {
  const entry = asFactor(factor);
  const markedNodes = entry.markedNodes();
  const canonicalNotation = factorNotation(entry);
  const nameInfo = ["A", "B", "C", "D"].includes(entry.group)
    ? classicalFactorName(entry.group, entry.rank, markedNodes)
    : exceptionalFactorName(entry.group, entry.rank, markedNodes);
  return {
    factor: entry,
    group: entry.group,
    rank: entry.rank,
    mask: entry.mask.toString(),
    dynkinType: `${entry.group}${entry.rank}`,
    dynkinTypeLatex: formatDynkinTypeLatex(entry),
    markedNodes,
    parabolic: formatParabolic(markedNodes),
    parabolicLatex: formatParabolicLatex(markedNodes),
    canonicalNotation,
    canonicalNotationLatex: factorNotationLatex(entry),
    humanReadable: nameInfo.label,
    humanReadableLatex: nameInfo.latex,
    family: nameInfo.family,
    identification: null,
    grassmannianUrl:
      nameInfo.family === "grassmannian"
        ? "https://www.grassmannian.info"
        : null,
  };
}

export function describeAmbient(factors) {
  const factorDetails = factors.map((factor) => describeFactor(factor));
  return {
    factors: factorDetails,
    canonicalNotation: factorDetails
      .map((detail) => detail.canonicalNotation)
      .join(" x "),
    canonicalNotationLatex: factorDetails
      .map((detail) => detail.canonicalNotationLatex)
      .join(" \\times "),
    humanReadable: factorDetails
      .map((detail) => detail.humanReadable)
      .join(" x "),
    humanReadableLatex: factorDetails
      .map((detail) => detail.humanReadableLatex)
      .join(" \\times "),
  };
}

export function describeSummands(factors, summands) {
  const factorDetails = factors.map((factor) => describeFactor(factor));
  return summands.map((row, index) => {
    const factorWeights = row.map((weights, factorIndex) => ({
      factor: factorDetails[factorIndex],
      tuple: formatHighestWeight(weights),
      tupleLatex: formatHighestWeightLatex(weights),
      expression: formatFundamentalWeightExpression(weights),
      expressionLatex: formatFundamentalWeightLatex(weights),
      weights: weights.slice(),
    }));
    return {
      index: index + 1,
      factorWeights,
      flatWeights: row.flat(),
      humanReadable: factorWeights
        .map((entry) => `${entry.factor.humanReadable}: ${entry.tuple}`)
        .join("; "),
    };
  });
}

export function decodeDetailedLabel(label) {
  const result = decodeLabel(label);
  const { factors } = result;
  const summands =
    result.type === "degeneracy_locus" ? result.summandsE : result.summands;
  const ambient = describeAmbient(factors);
  const detail = {
    label,
    canonicalLabel: label,
    factors,
    summands,
    ambient,
    factorDetails: ambient.factors,
    summandDetails: describeSummands(factors, summands),
  };
  if (result.type === "degeneracy_locus") {
    detail.summandsE = result.summandsE;
    detail.summandsF = result.summandsF;
    detail.k = result.k;
    detail.summandDetailsF = describeSummands(factors, result.summandsF);
  }
  return detail;
}

function dynkinViewBox(entry, weights) {
  let width;
  if (entry.group === "D") {
    width = entry.rank * 20 - 20;
  } else if (entry.group === "E") {
    width = entry.rank * 20 - 10;
  } else {
    width = entry.rank * 20;
  }
  return {
    width,
    height: weights === null ? 40 : 56,
  };
}

function dynkinCircle(entry, nodeId, x, y, markedNodes) {
  const active = markedNodes.includes(nodeId) ? ' class="active"' : "";
  return `<circle cx="${x}" cy="${y}" r="5" data-label="${entry.group}${entry.rank}-${nodeId}"${active} />`;
}

function dynkinNodePositions(entry) {
  if (
    entry.group === "A" ||
    entry.group === "B" ||
    entry.group === "C" ||
    entry.group === "F" ||
    entry.group === "G"
  ) {
    return Array.from({ length: entry.rank }, (_, index) => ({
      id: index + 1,
      x: index * 20,
      y: 10,
    }));
  }
  if (entry.group === "D") {
    return [
      ...Array.from({ length: entry.rank - 2 }, (_, index) => ({
        id: index + 1,
        x: index * 20,
        y: 10,
      })),
      { id: entry.rank - 1, x: (entry.rank - 2) * 20, y: 0 },
      { id: entry.rank, x: (entry.rank - 2) * 20, y: 20 },
    ];
  }
  return [
    { id: 1, x: 0, y: 20 },
    ...Array.from({ length: entry.rank - 2 }, (_, index) => ({
      id: index + 3,
      x: (index + 1) * 20,
      y: 20,
    })),
    { id: 2, x: 40, y: 0 },
  ];
}

function dynkinStructure(entry, markedNodes) {
  const nodes = dynkinNodePositions(entry);
  const circles = nodes
    .map((node) => dynkinCircle(entry, node.id, node.x, node.y, markedNodes))
    .join("");

  if (entry.group === "A") {
    return {
      nodes,
      bonds: `<polyline points="0,10 ${(entry.rank - 1) * 20},10" />`,
      circles,
    };
  }

  if (entry.group === "B") {
    return {
      nodes,
      bonds: [
        `<polyline points="${(entry.rank - 2) * 20 + 7},17 ${(entry.rank - 2) * 20 + 13},10 ${(entry.rank - 2) * 20 + 7},3" />`,
        `<polyline points="0,10 ${(entry.rank - 2) * 20},10" />`,
        `<polyline points="${(entry.rank - 2) * 20},8 ${(entry.rank - 1) * 20},8" />`,
        `<polyline points="${(entry.rank - 2) * 20},12 ${(entry.rank - 1) * 20},12" />`,
      ].join(""),
      circles,
    };
  }

  if (entry.group === "C") {
    return {
      nodes,
      bonds: [
        `<polyline points="${(entry.rank - 2) * 20 + 13},17 ${(entry.rank - 2) * 20 + 7},10 ${(entry.rank - 2) * 20 + 13},3" />`,
        `<polyline points="0,10 ${(entry.rank - 2) * 20},10" />`,
        `<polyline points="${(entry.rank - 2) * 20},8 ${(entry.rank - 1) * 20},8" />`,
        `<polyline points="${(entry.rank - 2) * 20},12 ${(entry.rank - 1) * 20},12" />`,
      ].join(""),
      circles,
    };
  }

  if (entry.group === "D") {
    return {
      nodes,
      bonds: [
        entry.rank >= 3
          ? `<polyline points="0,10 ${(entry.rank - 3) * 20},10" />`
          : "",
        entry.rank >= 3
          ? `<polyline points="${(entry.rank - 3) * 20},10 ${(entry.rank - 2) * 20},0" />`
          : "",
        entry.rank >= 3
          ? `<polyline points="${(entry.rank - 3) * 20},10 ${(entry.rank - 2) * 20},20" />`
          : "",
      ].join(""),
      circles,
    };
  }

  if (entry.group === "E") {
    return {
      nodes,
      bonds: [
        `<polyline points="0,20 ${(entry.rank - 2) * 20},20" />`,
        '<polyline points="40,20 40,0" />',
      ].join(""),
      circles,
    };
  }

  if (entry.group === "F") {
    return {
      nodes,
      bonds: [
        '<polyline points="27,17 33,10 27,3" />',
        '<polyline points="0,10 20,10" />',
        '<polyline points="20,8 40,8" />',
        '<polyline points="20,12 40,12" />',
        '<polyline points="40,10 60,10" />',
      ].join(""),
      circles,
    };
  }

  return {
    nodes,
    bonds: [
      '<polyline points="13,17 7,10 13,3" />',
      '<polyline points="0,10 20,10" />',
      '<polyline points="0,7 20,7" />',
      '<polyline points="0,13 20,13" />',
    ].join(""),
    circles,
  };
}

export function renderDynkinDiagramSvg(factor, options = {}) {
  const entry = asFactor(factor);
  const weights = options.weights ?? null;
  const labels = options.labels ?? null;
  if (
    weights !== null &&
    (!Array.isArray(weights) || weights.length !== entry.rank)
  ) {
    throw new RangeError("weights must match the Dynkin rank");
  }
  if (
    labels !== null &&
    (!Array.isArray(labels) || labels.length !== entry.rank)
  ) {
    throw new RangeError("labels must match the Dynkin rank");
  }
  const markedNodes = entry.markedNodes();
  const diagram = dynkinStructure(entry, markedNodes);
  const annotations = labels ?? weights;
  const viewBox = dynkinViewBox(entry, annotations);
  const svgHeight = annotations === null ? 24 : 32;
  const svgWidth = Math.round((viewBox.width / viewBox.height) * svgHeight);
  const annotationMarkup =
    annotations === null
      ? ""
      : diagram.nodes
          .filter(
            (node) =>
              annotations[node.id - 1] !== undefined &&
              annotations[node.id - 1] !== null &&
              annotations[node.id - 1] !== "",
          )
          .map(
            (node) =>
              `<text class="dynkin-weight" x="${node.x}" y="${node.y + 16}" text-anchor="middle">${escapeHtml(annotations[node.id - 1])}</text>`,
          )
          .join("");
  const ariaLabel = `${factorNotation(entry)} Dynkin diagram`;
  return `
    <svg class="dynkin" width="${svgWidth}" height="${svgHeight}" viewBox="-10 -10 ${viewBox.width} ${viewBox.height}" preserveAspectRatio="xMinYMid meet" role="img" aria-label="${escapeHtml(ariaLabel)}" xmlns="http://www.w3.org/2000/svg">
      <g class="dynkin-body">
        ${diagram.bonds}
        ${diagram.circles}
      </g>
      ${annotationMarkup}
    </svg>
  `;
}
