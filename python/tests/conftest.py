from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
PYTHON_SRC = REPO_ROOT / "python" / "src"
EXAMPLES_PATH = REPO_ROOT / "examples.json"
if str(PYTHON_SRC) not in sys.path:
    sys.path.insert(0, str(PYTHON_SRC))

from zerolocus64 import Factor


def factor_from_payload(payload: dict) -> Factor:
    return Factor(str(payload["group"]), int(payload["rank"]), int(payload["mask"]))


def factors_from_case(case: dict) -> list[Factor]:
    return [factor_from_payload(payload) for payload in case["factors"]]


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return REPO_ROOT


@pytest.fixture(scope="session")
def examples_data(repo_root: Path) -> dict[str, list[dict]]:
    return json.loads(EXAMPLES_PATH.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def curated_cases(examples_data: dict[str, list[dict]]) -> list[dict]:
    return examples_data["curated_cases"]


@pytest.fixture(scope="session")
def corpus_cases(examples_data: dict[str, list[dict]]) -> list[dict]:
    return examples_data["corpus_cases"]
