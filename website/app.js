import {
  anticanonicalDegrees,
  bettiNumbers,
  bundleFromWeight,
  dimension,
  partialFlagVariety,
  rankBundle,
} from "./assets/vendor/lie-js/index.js";
import {
  decodeDetailedLabel,
  renderDynkinDiagramSvg,
} from "./assets/presentation.js";
import {
  escapeHtml,
  renderDisplayMath,
  renderInlineMath,
} from "./typesetting.js";

const EXAMPLES = [
  { label: "1", caption: "P^1 ambient" },
  { label: "30.24", caption: "A3 / P1 with O(1)" },
  { label: "H0.24", caption: "B3 / P1 with weight (1,0,0)" },
  { label: "11.2122", caption: "split bundle on P^1 x P^1" },
  { label: "11111.2V", caption: "(P^1)^5 diagonal" },
  { label: "iF", caption: "D5 / P5" },
  { label: "u11", caption: "E7 / P7" },
  { label: "0A1H000", caption: "A17 / P1" },
  { label: "1120.252A", caption: "equal-factor block" },
  { label: "112020.20M20f", caption: "two equal blocks" },
  { label: "20H0U0.21c", caption: "mixed standard types" },
  { label: "131H0.20K212", caption: "mixed product with zero row" },
  { label: "1.21-21-0", caption: "degeneracy on P^1" },
  { label: "30.2424-3I-1", caption: "degeneracy on P^3" },
];

const DEFAULT_LABEL = "H0.24";

const form = document.querySelector("#decoder-form");
const labelInput = document.querySelector("#label-input");
const statusPanel = document.querySelector("#status-panel");
const resultGrid = document.querySelector("#result-grid");
const ambientSummary = document.querySelector("#ambient-summary");
const factorCards = document.querySelector("#factor-cards");
const bundlePanel = document.querySelector("#bundle-panel");
const bundleSummary = document.querySelector("#bundle-summary");
const canonicalSummary = document.querySelector("#canonical-summary");
const summandCards = document.querySelector("#summand-cards");
const exampleButtons = document.querySelector("#example-buttons");

const SITE_BASE_PATH = (() => {
  const pathname = window.location.pathname;
  const stripped = pathname
    .replace(/\/decode(?:\/[^/]+)?$/, "/")
    .replace(/\/specification\/?$/, "/");
  return stripped.endsWith("/") ? stripped : `${stripped}/`;
})();

function siteRoute(...segments) {
  const cleanedSegments = segments
    .filter(
      (segment) => segment !== undefined && segment !== null && segment !== "",
    )
    .map((segment) => String(segment).replace(/^\/+|\/+$/g, ""));
  const base = SITE_BASE_PATH === "/" ? "" : SITE_BASE_PATH.replace(/\/$/, "");
  const suffix = cleanedSegments.join("/");
  return suffix ? `${base}/${suffix}` : base || "/";
}

function stripBasePath(pathname) {
  const base = SITE_BASE_PATH === "/" ? "" : SITE_BASE_PATH.replace(/\/$/, "");
  if (base && pathname.startsWith(base)) {
    return pathname.slice(base.length) || "/";
  }
  return pathname;
}

function setStatus(message, variant = "default") {
  statusPanel.textContent = message;
  statusPanel.classList.remove("is-error", "is-success");
  if (variant === "error") {
    statusPanel.classList.add("is-error");
  }
  if (variant === "success") {
    statusPanel.classList.add("is-success");
  }
}

function renderMetricCard(label, valueHtml) {
  return `
    <div class="summary-card">
      <span class="summary-label">${escapeHtml(label)}</span>
      <div class="summary-value">${valueHtml}</div>
    </div>
  `;
}

function linkableFactorMath(detail, className = "math-link") {
  const content = renderInlineMath(detail.humanReadableLatex);
  if (!detail.grassmannianUrl) {
    return `<span class="${className}">${content}</span>`;
  }
  return `<a class="${className}" href="${detail.grassmannianUrl}" target="_blank" rel="noreferrer">${content}</a>`;
}

function formatSignedTerms(terms) {
  if (terms.length === 0) {
    return "0";
  }
  return terms
    .map(({ coefficient, term }, index) => {
      const sign = coefficient < 0n ? "-" : "+";
      if (index === 0) {
        return coefficient < 0n ? `-${term}` : term;
      }
      return `${sign} ${term}`;
    })
    .join(" ");
}

function weightTermLatex(node, coefficient) {
  const magnitude = coefficient < 0n ? -coefficient : coefficient;
  if (magnitude === 1n) {
    return `\\omega_{${node}}`;
  }
  return `${magnitude}\\omega_{${node}}`;
}

function markedWeightLatex(detail, fullWeight) {
  const terms = detail.markedNodes
    .map((node) => ({
      coefficient: BigInt(fullWeight[node - 1] ?? 0),
      term: weightTermLatex(node, BigInt(fullWeight[node - 1] ?? 0)),
    }))
    .filter(({ coefficient }) => coefficient !== 0n);
  return formatSignedTerms(terms);
}

function bigIntArray(length) {
  return Array.from({ length }, () => 0n);
}

function product(values) {
  return values.reduce((accumulator, value) => accumulator * value, 1n);
}

function convolveBettiNumbers(left, right) {
  const result = new Array(left.length + right.length - 1).fill(0);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      result[leftIndex + rightIndex] += left[leftIndex] * right[rightIndex];
    }
  }
  return result;
}

function factorDescriptionHtml(detail) {
  return linkableFactorMath(detail, "factor-description-link");
}

function globalMarkedWeightLatex(detailList, factorWeights) {
  const terms = [];
  let globalIndex = 1;

  detailList.forEach((detail, factorIndex) => {
    detail.markedNodes.forEach((node) => {
      const coefficient = BigInt(factorWeights[factorIndex][node - 1] ?? 0);
      if (coefficient !== 0n) {
        terms.push({
          coefficient,
          term: weightTermLatex(globalIndex, coefficient),
        });
      }
      globalIndex += 1;
    });
  });

  return formatSignedTerms(terms);
}

function formatSummandTuple(weights) {
  return `(${weights.join(",")})`;
}

function renderBundleDescription(details) {
  const summands = details.summandDetails.map((summand) => {
    const tupleText = summand.factorWeights
      .map((entry) => formatSummandTuple(entry.weights))
      .join("; ");
    return summand.factorWeights.length === 1 ? tupleText : `[${tupleText}]`;
  });
  return summands.join(" &oplus; ");
}

function renderBundleStatRow(label, valueHtml) {
  return `
    <div class="bundle-stat-row">
      <span class="bundle-stat-label">${escapeHtml(label)}</span>
      <span class="bundle-stat-value">${valueHtml}</span>
    </div>
  `;
}

function getInitialLabel() {
  const relativePath = stripBasePath(window.location.pathname);
  const match = relativePath.match(/^\/decode\/([^/]+)$/);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  const params = new URLSearchParams(window.location.search);
  return params.get("label") ?? DEFAULT_LABEL;
}

function updatePermalink(label) {
  const url = new URL(window.location.href);
  url.pathname = siteRoute("decode", encodeURIComponent(label));
  url.search = "";
  url.hash = "";
  window.history.replaceState({}, "", url);
}

function hasExplicitLabelRoute() {
  return (
    /^\/decode\/[^/]+$/.test(stripBasePath(window.location.pathname)) ||
    new URLSearchParams(window.location.search).has("label")
  );
}

function computeGeometry(details) {
  const factorGeometry = details.factorDetails.map((detail) => {
    const variety = partialFlagVariety(detail.dynkinType, detail.markedNodes);
    const ambientDegrees = bigIntArray(detail.rank);
    const factorAnticanonical = anticanonicalDegrees(variety.mdt);
    detail.markedNodes.forEach((node, index) => {
      ambientDegrees[node - 1] = BigInt(factorAnticanonical[index]);
    });
    return {
      variety,
      bettiNumbers: bettiNumbers(variety),
      dimension: dimension(variety),
      ambientDegrees,
    };
  });

  const determinantDegrees = details.factorDetails.map((detail) =>
    bigIntArray(detail.rank),
  );
  let totalRank = 0n;

  const summandGeometry = details.summands.map((row) => {
    const factorRanks = row.map((weights, factorIndex) =>
      rankBundle(
        bundleFromWeight(
          factorGeometry[factorIndex].variety,
          Int32Array.from(weights),
        ),
      ),
    );
    const summandRank = product(factorRanks);
    totalRank += summandRank;

    row.forEach((weights, factorIndex) => {
      details.factorDetails[factorIndex].markedNodes.forEach((node) => {
        determinantDegrees[factorIndex][node - 1] +=
          summandRank * BigInt(weights[node - 1]);
      });
    });

    return {
      factorRanks,
      rank: summandRank,
    };
  });

  const zeroLocusDegrees = factorGeometry.map(
    ({ ambientDegrees }, factorIndex) =>
      ambientDegrees.map(
        (value, index) => value - determinantDegrees[factorIndex][index],
      ),
  );

  const markedCoefficients = details.factorDetails.flatMap(
    (detail, factorIndex) =>
      detail.markedNodes.map((node) => zeroLocusDegrees[factorIndex][node - 1]),
  );
  const allZero = markedCoefficients.every((value) => value === 0n);
  const allPositive = markedCoefficients.every((value) => value > 0n);

  return {
    ambientBettiNumbers: factorGeometry.reduce(
      (combined, entry) => convolveBettiNumbers(combined, entry.bettiNumbers),
      [1],
    ),
    factorGeometry,
    determinantDegrees,
    zeroLocusDegrees,
    totalRank,
    ambientDimension: factorGeometry.reduce(
      (sum, entry) => sum + entry.dimension,
      0,
    ),
    summandGeometry,
    classification: allZero
      ? {
          kind: "cy",
          label: "Calabi-Yau",
          note: "If the zero locus is smooth of expected dimension, these coefficients vanish, so the canonical bundle is trivial.",
        }
      : allPositive
        ? {
            kind: "fano",
            label: "Fano",
            note: "If the zero locus is smooth of expected dimension, these coefficients are positive on every marked generator, so the anticanonical bundle is ample.",
          }
        : null,
  };
}

function renderFactorCard(detail, geometry, index, markedBasisLabels) {
  return `
    <article class="factor-card">
      <header>
        <p class="eyebrow factor-index">Factor ${index + 1}</p>
        <div class="factor-description">${factorDescriptionHtml(detail)}</div>
      </header>
      <p class="factor-metric-line"><span class="meta-label">Dimension</span><strong>${geometry.dimension}</strong></p>
      <div class="diagram-panel">${renderDynkinDiagramSvg(detail.factor, { labels: markedBasisLabels })}</div>
    </article>
  `;
}

function renderSummandCard(detail, geometry) {
  return `
    <article class="summand-card">
      <header>
        <p class="eyebrow">Summand ${detail.index}</p>
        <span class="pill">rank ${geometry.rank}</span>
      </header>
      <div class="summand-lines">
        ${detail.factorWeights
          .map((entry, factorIndex) => {
            return `
              <div class="summand-line">
                <span class="summand-factor">${factorDescriptionHtml(entry.factor)}</span>
                <span class="summand-factor-rank">rank ${geometry.factorRanks[factorIndex]}</span>
                <span class="summand-assignment">${renderInlineMath(entry.tupleLatex)}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    </article>
  `;
}

function renderCanonicalSummary(details, geometry) {
  const detDualGlobal = geometry.determinantDegrees.map((degrees) =>
    degrees.map((value) => -value),
  );
  const ambientClass = globalMarkedWeightLatex(
    details.factorDetails,
    geometry.factorGeometry.map((entry) => entry.ambientDegrees),
  );
  const detDualClass = globalMarkedWeightLatex(
    details.factorDetails,
    detDualGlobal,
  );
  const zeroLocusClass = globalMarkedWeightLatex(
    details.factorDetails,
    geometry.zeroLocusDegrees,
  );

  canonicalSummary.innerHTML = `
    <article class="formula-card">
      <p class="eyebrow formula-title">Canonical bundle zero locus</p>
      <div class="formula-intro">${renderDisplayMath("-\\mathrm{K}_{\\mathrm{Z}} = \\left((-\\mathrm{K}_{\\mathrm{X}}) \\otimes \\det(\\mathrm{E})^{\\vee}\\right)\\big|_{\\mathrm{Z}}")}</div>
      <div class="formula-grid">
        <div class="formula-line">
          <span class="formula-term">${renderInlineMath("-\\mathrm{K}_{\\mathrm{X}}")}</span>
          <span class="formula-value">${renderInlineMath(ambientClass)}</span>
        </div>
        <div class="formula-line">
          <span class="formula-term">${renderInlineMath("\\det(\\mathrm{E})^{\\vee}")}</span>
          <span class="formula-value">${renderInlineMath(detDualClass)}</span>
        </div>
        <div class="formula-line">
          <span class="formula-term">${renderInlineMath("-\\mathrm{K}_{\\mathrm{X}} + \\det(\\mathrm{E})^{\\vee}")}</span>
          <span class="formula-value">${renderInlineMath(zeroLocusClass)}</span>
        </div>
      </div>
      ${
        geometry.classification
          ? `<p class="formula-note is-${geometry.classification.kind}"><strong>${escapeHtml(geometry.classification.label)}.</strong> ${escapeHtml(geometry.classification.note)}</p>`
          : ""
      }
    </article>
  `;
}

function renderDetails(details) {
  const geometry = computeGeometry(details);
  const hasBundle = details.summands.length > 0;
  let markedBasisCounter = 1;
  const markedBasisLabels = details.factorDetails.map((detail) => {
    const labels = new Array(detail.rank).fill("");
    detail.markedNodes.forEach((node) => {
      labels[node - 1] = String(markedBasisCounter);
      markedBasisCounter += 1;
    });
    return labels;
  });

  ambientSummary.innerHTML = [
    renderMetricCard("Input label", escapeHtml(details.label)),
    renderMetricCard("Ambient factors", String(details.factors.length)),
    renderMetricCard("Ambient dimension", String(geometry.ambientDimension)),
    renderMetricCard(
      "Betti numbers",
      escapeHtml(geometry.ambientBettiNumbers.join(", ")),
    ),
  ].join("");

  factorCards.innerHTML = details.factorDetails
    .map((detail, index) =>
      renderFactorCard(
        detail,
        geometry.factorGeometry[index],
        index,
        markedBasisLabels[index],
      ),
    )
    .join("");

  const isDegeneracy = details.summandsF != null;
  bundlePanel.hidden = !hasBundle;

  const bundleHeading = bundlePanel.querySelector(".panel-heading .eyebrow");
  bundleHeading.textContent = isDegeneracy ? "Degeneracy Locus" : "Bundle Data";

  if (isDegeneracy) {
    const summandGeometryF = details.summandsF.map((row) => {
      const factorRanks = row.map((weights, factorIndex) =>
        rankBundle(
          bundleFromWeight(
            geometry.factorGeometry[factorIndex].variety,
            Int32Array.from(weights),
          ),
        ),
      );
      return { factorRanks, rank: product(factorRanks) };
    });
    const totalRankF = summandGeometryF.reduce(
      (sum, entry) => sum + entry.rank,
      0n,
    );
    const rankE = geometry.totalRank;
    const rankF = totalRankF;
    const k = BigInt(details.k);
    const expectedCodimension = (rankE - k) * (rankF - k);

    const descE = escapeHtml(renderBundleDescription(details)).replaceAll(
      "&amp;oplus;",
      "&oplus;",
    );
    const descF = escapeHtml(
      renderBundleDescription({ summandDetails: details.summandDetailsF }),
    ).replaceAll("&amp;oplus;", "&oplus;");

    bundleSummary.innerHTML = [
      renderBundleStatRow(
        "E",
        `<span class="bundle-description">${descE}</span>`,
      ),
      renderBundleStatRow("rank E", escapeHtml(String(rankE))),
      renderBundleStatRow(
        "F",
        `<span class="bundle-description">${descF}</span>`,
      ),
      renderBundleStatRow("rank F", escapeHtml(String(rankF))),
      renderBundleStatRow("Rank bound k", escapeHtml(String(details.k))),
      renderBundleStatRow(
        "Expected codimension",
        escapeHtml(String(expectedCodimension)),
      ),
    ].join("");

    summandCards.innerHTML =
      `<p class="eyebrow summand-section-label">Source bundle E</p>` +
      details.summandDetails
        .map((detail, index) =>
          renderSummandCard(detail, geometry.summandGeometry[index]),
        )
        .join("") +
      `<p class="eyebrow summand-section-label">Target bundle F</p>` +
      details.summandDetailsF
        .map((detail, index) =>
          renderSummandCard(detail, summandGeometryF[index]),
        )
        .join("");

    canonicalSummary.innerHTML = "";
  } else if (hasBundle) {
    const expectedCodimension = (
      BigInt(geometry.ambientDimension) - geometry.totalRank
    ).toString();
    bundleSummary.innerHTML = [
      renderBundleStatRow(
        "E",
        `<span class="bundle-description">${escapeHtml(renderBundleDescription(details)).replaceAll("&amp;oplus;", "&oplus;")}</span>`,
      ),
      renderBundleStatRow(
        "Summands",
        escapeHtml(String(details.summands.length)),
      ),
      renderBundleStatRow("Total rank", escapeHtml(String(geometry.totalRank))),
      renderBundleStatRow(
        "Expected codimension",
        escapeHtml(expectedCodimension),
      ),
    ].join("");

    renderCanonicalSummary(details, geometry);

    summandCards.innerHTML = details.summandDetails
      .map((detail, index) =>
        renderSummandCard(detail, geometry.summandGeometry[index]),
      )
      .join("");
  } else {
    bundleSummary.innerHTML = "";
    canonicalSummary.innerHTML = "";
    summandCards.innerHTML = "";
  }

  resultGrid.hidden = false;
}

function decodeCurrentLabel({ updateUrl = true, announce = true } = {}) {
  const label = labelInput.value.trim();
  if (!label) {
    setStatus("Enter a non-empty ZeroLocus62 label.", "error");
    resultGrid.hidden = true;
    return;
  }

  try {
    const details = decodeDetailedLabel(label);
    renderDetails(details);
    if (updateUrl) {
      updatePermalink(details.canonicalLabel);
    }
    if (announce) {
      const successMessage =
        details.summandsF != null
          ? "Decoded degeneracy locus."
          : details.summands.length === 0
            ? "Decoded ambient only."
            : "Decoded successfully.";
      setStatus(successMessage, "success");
    }
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Unable to decode label.",
      "error",
    );
    resultGrid.hidden = true;
  }
}

exampleButtons.innerHTML = EXAMPLES.map(
  ({ label, caption }) => `
    <button type="button" data-label="${escapeHtml(label)}">
      <span class="example-label">${escapeHtml(label)}</span>
      <span class="example-caption">${escapeHtml(caption)}</span>
    </button>
  `,
).join("");

exampleButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-label]");
  if (!button) {
    return;
  }
  labelInput.value = button.dataset.label ?? "";
  decodeCurrentLabel();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  decodeCurrentLabel();
});

labelInput.value = getInitialLabel();
if (hasExplicitLabelRoute()) {
  decodeCurrentLabel({ updateUrl: true, announce: true });
} else {
  resultGrid.hidden = true;
}
