"""Loads the retrained loan-approval pipeline and serves predictions.

The explanation is only produced for linear models (logistic regression),
where ``coef * (x - training_mean)`` in the transformed feature space is an
exact additive decomposition of the log-odds relative to the mean training
applicant. No explanation is fabricated for other model types.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

MODEL_DIR = Path(__file__).resolve().parents[1] / "models"
PIPELINE_PATH = MODEL_DIR / "loan_approval_pipeline.joblib"
METADATA_PATH = MODEL_DIR / "model_metadata.json"


class ModelUnavailable(RuntimeError):
    pass


class PredictionInputError(ValueError):
    pass


@lru_cache(maxsize=1)
def load() -> tuple[Any, dict]:
    if not PIPELINE_PATH.exists() or not METADATA_PATH.exists():
        raise ModelUnavailable("Model artefacts not found. Run `python -m ml.train` in backend/.")
    pipeline = joblib.load(PIPELINE_PATH)
    metadata = json.loads(METADATA_PATH.read_text())
    return pipeline, metadata


def public_metadata() -> dict:
    _, meta = load()
    return {k: v for k, v in meta.items() if k != "explain"}


def _sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z))


def _original_feature(transformed_name: str, categorical: list[str]) -> str:
    # ColumnTransformer names look like "num__Credit_Score" or "cat__Loan_Purpose_Home".
    _, _, rest = transformed_name.partition("__")
    for c in categorical:
        if rest == c or rest.startswith(c + "_"):
            return c
    return rest


def predict(features: dict[str, Any]) -> dict:
    pipeline, meta = load()
    schema = meta["schema"]
    categorical = [c["name"] for c in schema["categorical"]]
    numeric = [n["name"] for n in schema["numeric"]]

    for c in schema["categorical"]:
        if features[c["name"]] not in c["options"]:
            raise PredictionInputError(
                f"{c['name']} must be one of: {', '.join(c['options'])}."
            )

    row = pd.DataFrame([{k: features[k] for k in numeric + categorical}])
    probability = float(pipeline.predict_proba(row)[0, 1])
    threshold = float(meta["threshold"])

    out_of_range = [
        n["name"] for n in schema["numeric"] if not n["min"] <= float(features[n["name"]]) <= n["max"]
    ]

    contributions: list[dict] = []
    baseline_probability = float("nan")
    model = pipeline[-1]
    if hasattr(model, "coef_") and "explain" in meta:
        coef = model.coef_[0]
        means = np.asarray(meta["explain"]["transformed_means"])
        names = meta["explain"]["feature_names"]
        x = pipeline[:-1].transform(row)[0]
        per_column = coef * (x - means)
        grouped: dict[str, float] = {}
        for name, value in zip(names, per_column):
            key = _original_feature(name, categorical)
            grouped[key] = grouped.get(key, 0.0) + float(value)
        baseline_logit = float(model.intercept_[0] + coef @ means)
        baseline_probability = _sigmoid(baseline_logit)
        # Sanity check: the decomposition must reproduce the model's output.
        if abs(_sigmoid(baseline_logit + sum(grouped.values())) - probability) > 1e-9:
            raise RuntimeError("Explanation does not reproduce the model output.")
        contributions = sorted(
            (
                {"feature": k, "value": features[k], "log_odds": v}
                for k, v in grouped.items()
            ),
            key=lambda c: abs(c["log_odds"]),
            reverse=True,
        )

    return {
        "approved": probability >= threshold,
        "probability": probability,
        "threshold": threshold,
        "baseline_probability": baseline_probability,
        "contributions": contributions,
        "out_of_range": out_of_range,
        "model_label": meta["selected"]["label"],
    }
