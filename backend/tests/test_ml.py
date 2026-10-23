"""ML integration tests: the served pipeline must match a fresh, leak-free
evaluation and its explanations must reproduce its own outputs."""

import json

import numpy as np
import pandas as pd
import pytest
from sklearn.model_selection import train_test_split

from app import ml_service
from ml import train

APPLICANT = {
    "Applicant_Income": 12000,
    "Coapplicant_Income": 4000,
    "Age": 35,
    "Dependents": 1,
    "Credit_Score": 720,
    "Existing_Loans": 1,
    "DTI_Ratio": 0.25,
    "Savings": 15000,
    "Collateral_Value": 30000,
    "Loan_Amount": 20000,
    "Loan_Term": 60,
    "Employment_Status": "Salaried",
    "Marital_Status": "Married",
    "Loan_Purpose": "Home",
    "Property_Area": "Urban",
    "Education_Level": "Graduate",
    "Employer_Category": "MNC",
}


def test_metadata_reflects_leak_free_training():
    meta = ml_service.public_metadata()
    assert meta["dataset"]["rows_missing_target_dropped"] == 50
    assert meta["split"]["train_rows"] + meta["split"]["test_rows"] == meta["dataset"]["rows_used"]
    assert "Gender" not in [c["name"] for c in meta["schema"]["categorical"]]
    assert "explain" not in meta


def test_served_model_reproduces_reported_test_metrics():
    pipeline, meta = ml_service.load()
    X, y, _ = train.load_dataset()
    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=meta["split"]["random_state"])
    prob = pipeline.predict_proba(X_test[train.FEATURES])[:, 1]
    metrics = train.evaluate(y_test, (prob >= 0.5).astype(int), prob)
    for k in ("accuracy", "precision", "recall", "f1", "roc_auc"):
        assert metrics[k] == pytest.approx(meta["test_metrics"][k])


def test_preprocessing_fitted_on_training_rows_only():
    pipeline, meta = ml_service.load()
    X, y, _ = train.load_dataset()
    X_train, _, _, _ = train_test_split(X, y, test_size=0.2, stratify=y, random_state=meta["split"]["random_state"])
    imputer = pipeline.named_steps["preprocess"].named_transformers_["num"].named_steps["impute"]
    expected = train.square_dti_and_credit(X_train)[train.NUMERIC].mean().to_numpy()
    np.testing.assert_allclose(imputer.statistics_, expected)


def test_prediction_and_exact_explanation():
    out = ml_service.predict(APPLICANT)
    assert 0 <= out["probability"] <= 1
    assert out["approved"] == (out["probability"] >= out["threshold"])
    logit = np.log(out["baseline_probability"] / (1 - out["baseline_probability"])) + sum(c["log_odds"] for c in out["contributions"])
    assert 1 / (1 + np.exp(-logit)) == pytest.approx(out["probability"], abs=1e-9)
    assert {c["feature"] for c in out["contributions"]} == set(APPLICANT)


def test_prediction_is_deterministic_and_matches_pipeline():
    pipeline, _ = ml_service.load()
    direct = pipeline.predict_proba(pd.DataFrame([APPLICANT]))[0, 1]
    assert ml_service.predict(APPLICANT)["probability"] == pytest.approx(direct)


def test_out_of_range_flagged_and_bad_category_rejected():
    out = ml_service.predict({**APPLICANT, "Applicant_Income": 500000})
    assert "Applicant_Income" in out["out_of_range"]
    with pytest.raises(ml_service.PredictionInputError):
        ml_service.predict({**APPLICANT, "Loan_Purpose": "Vacation"})


def test_predict_api(client):
    res = client.post("/api/model/predict", json=APPLICANT)
    assert res.status_code == 200
    assert client.post("/api/model/predict", json={**APPLICANT, "Credit_Score": 50}).status_code == 422
    assert client.post("/api/model/predict", json={**APPLICANT, "Gender": "Male"}).status_code == 422
    assert client.get("/api/model").json()["selected"]["label"]
