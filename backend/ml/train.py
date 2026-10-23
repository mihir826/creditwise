"""Retrain the loan-approval model from credit_wise.ipynb without data leakage.

What changed versus the original notebook (the notebook itself is untouched):

* Rows whose target ``Loan_Approved`` is missing are dropped. The notebook
  imputed the target with the most frequent class, inventing labels.
* The train/test split happens *before* any preprocessing. Imputers, the
  scaler and the one-hot encoder are fitted inside an sklearn ``Pipeline`` on
  training folds only (the notebook fitted imputers/encoders on all rows).
* The split is stratified on the target, and model selection uses 5-fold
  cross-validation on the training set. The held-out test set is used once,
  for the final selected model only.
* The same three algorithms are compared (Logistic Regression, KNN k=5,
  Gaussian Naive Bayes), with and without the notebook's engineered features
  (squared DTI ratio and credit score replacing the originals).
* ``Gender`` is excluded from the deployed model (see ``EXCLUDED``).

Usage:  python -m ml.train   (from the backend/ directory)
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler

from ml.features import square_dti_and_credit

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "loan_approval_data.csv"
MODEL_DIR = Path(__file__).resolve().parents[1] / "models"
RANDOM_STATE = 42
TARGET = "Loan_Approved"

NUMERIC = [
    "Applicant_Income",
    "Coapplicant_Income",
    "Age",
    "Dependents",
    "Credit_Score",
    "Existing_Loans",
    "DTI_Ratio",
    "Savings",
    "Collateral_Value",
    "Loan_Amount",
    "Loan_Term",
]
CATEGORICAL = [
    "Employment_Status",
    "Marital_Status",
    "Loan_Purpose",
    "Property_Area",
    "Education_Level",
    "Employer_Category",
]
# Gender is a protected attribute. Excluding it changed mean CV F1 by less than
# one fold standard deviation, so the deployed model does not use it. The
# sensitivity check below re-runs CV with it included and records the result.
EXCLUDED = ["Gender"]
FEATURES = NUMERIC + CATEGORICAL
INTEGER_FEATURES = {"Age", "Dependents", "Credit_Score", "Existing_Loans", "Loan_Term"}


def build_pipeline(estimator, engineered: bool, categorical: list[str] | None = None) -> Pipeline:
    categorical_cols = CATEGORICAL if categorical is None else categorical
    numeric = Pipeline([("impute", SimpleImputer(strategy="mean")), ("scale", StandardScaler())])
    categorical = Pipeline(
        [
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )
    pre = ColumnTransformer([("num", numeric, NUMERIC), ("cat", categorical, categorical_cols)])
    steps = []
    if engineered:
        steps.append(("engineer", FunctionTransformer(square_dti_and_credit, feature_names_out="one-to-one")))
    steps += [("preprocess", pre), ("model", estimator)]
    return Pipeline(steps)


CANDIDATES = {
    "logistic_regression": ("Logistic Regression", lambda: LogisticRegression(max_iter=1000)),
    "knn": ("K-Nearest Neighbours (k=5)", lambda: KNeighborsClassifier(n_neighbors=5)),
    "naive_bayes": ("Gaussian Naive Bayes", lambda: GaussianNB()),
}
SCORING = ["accuracy", "precision", "recall", "f1", "roc_auc"]


def evaluate(y_true, y_pred, y_prob) -> dict:
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "f1": f1_score(y_true, y_pred, zero_division=0),
        "roc_auc": roc_auc_score(y_true, y_prob),
        "brier": brier_score_loss(y_true, y_prob),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def load_dataset() -> tuple[pd.DataFrame, pd.Series, dict]:
    raw = pd.read_csv(DATA_PATH)
    labelled = raw.dropna(subset=[TARGET])
    X = labelled[NUMERIC + CATEGORICAL + EXCLUDED]
    y = (labelled[TARGET] == "Yes").astype(int)
    info = {
        "rows_total": int(len(raw)),
        "rows_missing_target_dropped": int(raw[TARGET].isna().sum()),
        "rows_used": int(len(labelled)),
        "approved": int(y.sum()),
        "not_approved": int((1 - y).sum()),
    }
    return X, y, info


def main() -> None:
    X, y, info = load_dataset()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)

    cv_rows = []
    for key, (label, make) in CANDIDATES.items():
        for engineered in (False, True):
            scores = cross_validate(build_pipeline(make(), engineered), X_train, y_train, cv=cv, scoring=SCORING)
            row = {
                "key": key,
                "label": label,
                "engineered_features": engineered,
                **{m: float(np.mean(scores[f"test_{m}"])) for m in SCORING},
                **{f"{m}_std": float(np.std(scores[f"test_{m}"])) for m in SCORING},
            }
            cv_rows.append(row)
            print(
                f"{label:32s} eng={engineered!s:5s} "
                + " ".join(f"{m}={row[m]:.3f}±{row[m + '_std']:.3f}" for m in SCORING)
            )

    # Selection: highest mean CV F1 (balances precision and recall on an
    # imbalanced target); ties broken by ROC-AUC, then by the simpler variant.
    best = max(cv_rows, key=lambda r: (round(r["f1"], 3), round(r["roc_auc"], 3), not r["engineered_features"]))
    print(f"\nSelected: {best['label']} (engineered={best['engineered_features']})")

    # Sensitivity check: same configuration with the excluded attribute(s) included.
    with_excluded = cross_validate(
        build_pipeline(CANDIDATES[best["key"]][1](), best["engineered_features"], CATEGORICAL + EXCLUDED),
        X_train, y_train, cv=cv, scoring=SCORING,
    )
    sensitivity = {
        "included_features": EXCLUDED,
        **{m: float(np.mean(with_excluded[f"test_{m}"])) for m in SCORING},
    }
    print("With excluded features:", sensitivity)

    final = build_pipeline(CANDIDATES[best["key"]][1](), best["engineered_features"])
    final.fit(X_train[FEATURES], y_train)
    prob = final.predict_proba(X_test[FEATURES])[:, 1]
    test_metrics = evaluate(y_test, (prob >= 0.5).astype(int), prob)
    print("Held-out test:", json.dumps(test_metrics, indent=2))

    # Baseline for explanations: mean of the *transformed* training matrix.
    # For a linear model, coef * (x - mean) decomposes the log-odds exactly.
    transformer = final[:-1]
    transformed_train = transformer.transform(X_train[FEATURES])
    explain = {
        "feature_names": [str(n) for n in transformer.get_feature_names_out()],
        "transformed_means": transformed_train.mean(axis=0).tolist(),
    }

    train_df = X_train
    schema = {
        "numeric": [
            {
                "name": c,
                "min": float(train_df[c].min()),
                "max": float(train_df[c].max()),
                "median": float(train_df[c].median()),
                "integer": c in INTEGER_FEATURES,
            }
            for c in NUMERIC
        ],
        "categorical": [
            {"name": c, "options": sorted(train_df[c].dropna().unique().tolist())} for c in CATEGORICAL
        ],
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(final, MODEL_DIR / "loan_approval_pipeline.joblib")
    metadata = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sklearn_version": sklearn.__version__,
        "dataset": info,
        "split": {
            "test_size": 0.2,
            "stratified": True,
            "random_state": RANDOM_STATE,
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
        },
        "selection_rule": "Highest mean 5-fold CV F1 on the training set (ties: ROC-AUC, then simpler variant).",
        "selected": {
            "key": best["key"],
            "label": best["label"],
            "engineered_features": best["engineered_features"],
        },
        "cv_results": cv_rows,
        "excluded_features": EXCLUDED,
        "excluded_feature_sensitivity": sensitivity,
        "test_metrics": test_metrics,
        "threshold": 0.5,
        "explain": explain,
        "schema": schema,
    }
    (MODEL_DIR / "model_metadata.json").write_text(json.dumps(metadata, indent=2))
    print(f"\nSaved pipeline and metadata to {MODEL_DIR}")


if __name__ == "__main__":
    main()
