export type FeeType = "percent" | "flat";

export interface LoanParams {
  principal: number;
  annual_rate: number;
  tenure_months: number;
  fee_type: FeeType;
  fee_value: number;
}

export interface LoanSummary {
  emi: number;
  final_payment: number;
  principal: number;
  total_interest: number;
  total_payment: number;
  fee_amount: number;
  total_borrowing_cost: number;
  total_outflow: number;
  effective_monthly_cost: number;
  interest_share_pct: number;
  effective_annual_rate: number;
}

export interface ScheduleRow {
  month: number;
  opening_balance: number;
  payment: number;
  principal: number;
  interest: number;
  closing_balance: number;
}

export interface YearRow {
  year: number;
  principal: number;
  interest: number;
  payment: number;
  closing_balance: number;
}

export interface Calculation {
  input: LoanParams;
  summary: LoanSummary;
  schedule: ScheduleRow[];
  yearly: YearRow[];
}

export interface ScenarioResult {
  label: string;
  input: LoanParams;
  summary: LoanSummary;
  yearly: YearRow[];
}

export interface CompareResult {
  scenarios: ScenarioResult[];
  cheapest_index: number;
  differences: number[];
  same_principal: boolean;
}

export interface SavedCalculation {
  id: number;
  name: string;
  loan: LoanParams;
  emi: number;
  total_interest: number;
  total_payment: number;
  fee_amount: number;
  total_borrowing_cost: number;
  interest_share_pct: number;
  created_at: string;
  updated_at: string;
}

export interface SeriesPoint {
  month: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface Dashboard {
  count: number;
  total_principal: number;
  total_monthly_emi: number;
  total_interest: number;
  total_fees: number;
  total_payment: number;
  interest_share_pct: number;
  longest_tenure_months: number;
  highest_interest_share: SavedCalculation | null;
  series: SeriesPoint[];
  recent: SavedCalculation[];
}

export interface Metrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number;
  brier?: number;
}

export interface CvRow extends Metrics {
  key: string;
  label: string;
  engineered_features: boolean;
  accuracy_std: number;
  f1_std: number;
  roc_auc_std: number;
}

export interface NumericFeature {
  name: string;
  min: number;
  max: number;
  median: number;
  integer: boolean;
}

export interface ModelInfo {
  trained_at: string;
  sklearn_version: string;
  dataset: {
    rows_total: number;
    rows_missing_target_dropped: number;
    rows_used: number;
    approved: number;
    not_approved: number;
  };
  split: { test_size: number; stratified: boolean; random_state: number; train_rows: number; test_rows: number };
  selection_rule: string;
  selected: { key: string; label: string; engineered_features: boolean };
  cv_results: CvRow[];
  excluded_features: string[];
  excluded_feature_sensitivity: Metrics & { included_features: string[] };
  test_metrics: Metrics & { brier: number; confusion_matrix: { tn: number; fp: number; fn: number; tp: number } };
  threshold: number;
  schema: {
    numeric: NumericFeature[];
    categorical: { name: string; options: string[] }[];
  };
}

export interface Prediction {
  approved: boolean;
  probability: number;
  threshold: number;
  baseline_probability: number;
  contributions: { feature: string; value: number | string; log_odds: number }[];
  out_of_range: string[];
  model_label: string;
}
