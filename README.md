# CreditWise

An intelligent loan analysis and financial planning app: EMI calculator, amortization schedules, loan comparison, PDF/CSV export, saved scenarios, and a loan-approval model retrained (leak-free) from the original `credit_wise.ipynb`.

```
DM_CP/
├── credit_wise.ipynb          original notebook (unchanged)
├── loan_approval_data.csv     original dataset (unchanged, read-only)
├── backend/                   FastAPI + Python
│   ├── app/finance.py         financial engine (Decimal, single source of truth)
│   ├── app/reports.py         PDF (reportlab) and CSV exports
│   ├── app/db.py              SQLite storage for saved calculations
│   ├── app/ml_service.py      model loading, prediction, exact explanations
│   ├── app/main.py            API routes
│   ├── ml/train.py            leak-free retraining of the notebook's models
│   ├── models/                trained pipeline + metadata (committed)
│   └── tests/                 pytest suite
└── frontend/                  Next.js 16 + TypeScript + Tailwind 4 + Recharts
    ├── src/app/               pages: overview, calculator, compare, saved, predict, methodology
    ├── src/lib/               API client, INR formatting, form validation (+ vitest)
    └── e2e/smoke.mjs          browser smoke test (playwright-core + installed Chrome)
```

## Architecture

- **All financial math lives in `backend/app/finance.py`.** It uses `Decimal` and rounds to the paisa. The frontend never re-implements the EMI formula: it calls `POST /api/loans/calculate`, debounced and cancellable, so the UI, CSV and PDF always show identical numbers.
- **The frontend proxies `/api/*` to the backend** (`next.config.ts` rewrites), so the browser talks to one origin and no CORS setup is needed.
- **Charts** use a palette validated for the dark surface: lightness band, chroma, colour-blind separation and contrast. Lavender `#9272E6` is principal, green `#68A04C` is interest and rose `#CC7096` is fees or a third scenario. Every multi-series chart has a legend and a tooltip, and the schedule is also available as a table.

## Setup

Requirements: Python 3.12+ (tested on 3.14.3) and Node 20+ (tested on 22.23).

### Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Optional environment variables (see `backend/.env.example`; they are read from the process environment):

| Variable | Default | Purpose |
|---|---|---|
| `CREDITWISE_DB_PATH` | `backend/data/creditwise.db` | SQLite file for saved calculations |
| `CREDITWISE_CORS_ORIGINS` | `http://localhost:3000` | Only needed if a browser calls the API directly |

To retrain the model (this overwrites `backend/models/`):

```bash
cd backend && .venv/bin/python -m ml.train
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # BACKEND_URL=http://127.0.0.1:8000
npm run dev                  # http://localhost:3000
```

Production: `npm run build && npm start`.

> **iCloud Drive note:** this folder lives in iCloud. On this machine `frontend/node_modules`, `frontend/.next` and the venv (`backend/.venv` → `.venv.nosync`) are excluded from sync, via the `com.apple.fileprovider.ignore#P` xattr and the `.nosync` suffix respectively. If you clone elsewhere, plain `.venv` works.

## Features

| Area | What it does |
|---|---|
| **Overview** | Totals, combined EMI, interest share and a balance/payments chart (1Y/5Y/10Y/All). All of it is aggregated from saved calculations only. New users see an empty state; nothing is invented. |
| **EMI calculator** | Amount (₹1,000 to ₹100 crore, log slider), rate (0 to 50%), tenure in years or months (up to 480), and an optional % or flat processing fee. Inputs and sliders stay synced. Validation covers empty, negative, malformed and out-of-range values. Shows the EMI, the final instalment (rounding-adjusted), total interest, total repayment, fee, total borrowing cost, effective monthly cost and effective annual rate including fees. |
| **Amortization** | Month-by-month table (paged by year) or a yearly view. Balance chart, yearly principal-vs-interest chart and CSV export. |
| **Compare** | 2 or 3 scenarios, editable independently, loadable from saved calculations or via `/compare?ids=1,2`. Shows a metrics table, differences against the cheapest scenario, a cost chart and balance curves. "Lowest cost" means the lowest interest plus fees, and a warning appears when loan amounts differ. |
| **PDF report** | Generated server-side. Includes branding, date, loan details, principal-vs-interest donut, yearly bar chart, methodology, a disclaimer, and the full schedule across as many pages as needed with repeated headers. |
| **Saved** | Save, view, rename, delete (with confirmation), reopen in the calculator, download a PDF, and select 2 or 3 to compare. |
| **Predict** | Approval probability from the retrained model, an exact per-feature explanation, out-of-training-range warnings, and a full model card. |
| **Methodology** | Formulas, rounding, cost definitions, model notes and the storage model. |

### Formulas and rounding

```
EMI = P · r · (1+r)^n / ((1+r)^n − 1),   r = annual% / 12 / 100;   EMI = P / n when r = 0
```

The EMI is rounded to the paisa once. Each month, interest is the balance × r rounded to the paisa, and the remainder of the EMI repays principal. The final instalment pays off whatever balance remains, so the closing balance is exactly ₹0.00. Totals are exact sums of the schedule. The processing fee counts as paid upfront: it is excluded from the EMI and included in the borrowing cost and in the effective annual rate (the IRR on the principal minus the fee).

## Machine learning

The notebook's target is `Loan_Approved` (approved yes/no). The dataset has **no repayment or default outcome**, so the model predicts approval only.

Problems found in the notebook and fixed in `backend/ml/train.py` (the notebook itself is unchanged):

1. **Data leakage.** Imputers, `LabelEncoder` and `OneHotEncoder` were fitted on all 1,000 rows before the train/test split. Now all preprocessing sits in one sklearn `Pipeline` that is fitted on training data only.
2. **Imputed target.** The 50 rows with a missing `Loan_Approved` had a label invented by most-frequent imputation. They are now dropped.
3. **Selection on the test set.** The notebook picked a model by comparing test-set precision. Now models are selected by 5-fold stratified CV on the training set, and the test set is used once.
4. **Protected attribute.** `Gender` is excluded from the deployed model. With it included, CV F1 was 0.785; without it, 0.777. That difference is within fold-to-fold variation (±0.024). Both numbers are recorded in `model_metadata.json`.

The candidates are the notebook's three algorithms (Logistic Regression, KNN k=5, Gaussian NB), each with and without the notebook's squared DTI/credit-score features.

**Selected model:** Logistic Regression with squared features, chosen by highest mean CV F1. Held-out test results on 190 rows (stratified 80/20, seed 42):

| Accuracy | Precision | Recall | F1 | ROC-AUC | Brier |
|---|---|---|---|---|---|
| 0.884 | 0.839 | 0.783 | 0.810 | 0.934 | 0.091 |

Confusion matrix: TN 121, FP 9, FN 13, TP 47.

The explanations are exact for this linear model. Each feature's contribution is `coef · (x − training mean)` in the transformed space, and the contributions sum to the model's log-odds. The service checks this sum on every request. The units of the monetary features are not stated in the dataset, so the UI labels them "dataset units" rather than INR.

## Storage and privacy (single-user)

Saved calculations live in **a SQLite file on the machine running the backend**. **There is no authentication**: anyone who can reach the backend can read, rename or delete every record. Only the inputs are stored; results are recomputed with the finance engine on every read. Don't expose the backend publicly with real personal data until auth is added.

## Tests

Run on 23 Oct 2026 with both servers up:

| Suite | Command | Result |
|---|---|---|
| Backend: finance engine, API, PDF/CSV, persistence, ML | `cd backend && .venv/bin/python -m pytest` | **44 passed** |
| Frontend: formatting and form validation | `cd frontend && npm test` | **10 passed** |
| Frontend: lint and types | `npm run lint && npm run typecheck` | **clean** |
| End-to-end browser smoke test | `cd frontend && npm run e2e` | **16/16 checks passed**, no console errors |

The backend suite covers:

- textbook and independently computed EMIs (₹1L at 12% over 12 months gives ₹8,884.88)
- zero interest, a one-month tenure, a 480-month tenure, decimal rates and ₹100 crore loans
- rejection of negative, missing, NaN/∞, over-limit and over-precise inputs
- schedule invariants (opening = previous closing, Σ principal = P, final balance 0) and fee/IRR checks
- comparison ranking and aggregation
- multi-page PDFs and CSV content
- CRUD persistence across clients
- that the served model reproduces its reported test metrics, that preprocessing was fitted only on training rows, and that explanations sum to the prediction

The e2e test needs an installed Chrome (`CHROME_PATH` overrides the macOS default). It creates and then deletes one saved record.

## Known limitations

- Single-user, no authentication (see above).
- Fixed-rate loans only. GST, insurance, prepayments, floating-rate resets and broken-period interest are not modelled.
- The dashboard assumes every saved loan starts in the same month.
- The approval model is trained on 950 labelled rows of a dataset whose monetary units aren't specified. Its output is illustrative and is not a bank decision.
- The UI is dark-only, matching the reference design. A light theme was left out rather than built half-heartedly.
