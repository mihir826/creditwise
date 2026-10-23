"""Feature transforms shared by training and inference (must stay importable
at ``ml.features`` so the pickled pipeline can be loaded)."""

import pandas as pd


def square_dti_and_credit(df: pd.DataFrame) -> pd.DataFrame:
    """Notebook feature engineering: replace DTI_Ratio and Credit_Score by their squares."""
    out = df.copy()
    out["DTI_Ratio"] = out["DTI_Ratio"] ** 2
    out["Credit_Score"] = out["Credit_Score"] ** 2
    return out
