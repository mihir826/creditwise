import type {
  Calculation,
  CompareResult,
  Dashboard,
  LoanParams,
  ModelInfo,
  Prediction,
  SavedCalculation,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type PydanticError = { loc?: (string | number)[]; msg?: string };

function describeDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as PydanticError;
    const field = first.loc?.filter((p) => p !== "body").join(" → ");
    const msg = (first.msg ?? "Invalid input").replace(/^Value error, /, "");
    return field ? `${field}: ${msg}` : msg;
  }
  return "Something went wrong.";
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("Cannot reach the CreditWise server. Is the backend running?", 0);
  }
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      message = describeDetail(body.detail);
    } catch {
      if (res.status >= 500) message = "The CreditWise server is unavailable. Is the backend running?";
    }
    throw new ApiError(message, res.status);
  }
  return res;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  return (await request(path, init)).json() as Promise<T>;
}

const post = (body: unknown, signal?: AbortSignal): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
  signal,
});

export const api = {
  calculate: (loan: LoanParams, signal?: AbortSignal) => json<Calculation>("/api/loans/calculate", post(loan, signal)),
  compare: (scenarios: (LoanParams & { label: string })[], signal?: AbortSignal) =>
    json<CompareResult>("/api/loans/compare", post({ scenarios }, signal)),
  scheduleCsv: async (loan: LoanParams) => (await request("/api/loans/schedule.csv", post(loan))).blob(),
  reportPdf: async (loan: LoanParams, title?: string) =>
    (await request("/api/loans/report.pdf", post({ loan, title: title || null }))).blob(),

  listSaved: () => json<SavedCalculation[]>("/api/calculations", { cache: "no-store" }),
  getSaved: (id: number) => json<SavedCalculation>(`/api/calculations/${id}`, { cache: "no-store" }),
  createSaved: (name: string, loan: LoanParams) => json<SavedCalculation>("/api/calculations", post({ name, loan })),
  renameSaved: (id: number, name: string) =>
    json<SavedCalculation>(`/api/calculations/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteSaved: (id: number) => request(`/api/calculations/${id}`, { method: "DELETE" }).then(() => undefined),

  dashboard: () => json<Dashboard>("/api/dashboard", { cache: "no-store" }),
  modelInfo: () => json<ModelInfo>("/api/model"),
  predict: (features: Record<string, number | string>) => json<Prediction>("/api/model/predict", post(features)),
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
