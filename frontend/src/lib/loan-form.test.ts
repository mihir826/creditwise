import { describe, expect, it } from "vitest";
import { DEFAULT_FORM, formFromParams, parseNumber, validateLoanForm } from "./loan-form";
import { amountInWords, formatCompactINR, formatINR, formatTenure, splitINR } from "./format";

describe("parseNumber", () => {
  it("accepts grouped and symbol-prefixed input", () => {
    expect(parseNumber("12,50,000")).toBe(1250000);
    expect(parseNumber("₹ 1,000.50")).toBe(1000.5);
    expect(parseNumber("8.")).toBe(8);
  });
  it("rejects junk", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("1e5")).toBeNull();
    expect(parseNumber("1.2.3")).toBeNull();
  });
});

describe("validateLoanForm", () => {
  it("converts years to months", () => {
    const { params, errors } = validateLoanForm(DEFAULT_FORM);
    expect(errors).toEqual({});
    expect(params).toEqual({ principal: 2500000, annual_rate: 8.75, tenure_months: 240, fee_type: "percent", fee_value: 0 });
  });
  it("accepts half years and rejects fractional months", () => {
    expect(validateLoanForm({ ...DEFAULT_FORM, tenure: "2.5" }).params?.tenure_months).toBe(30);
    expect(validateLoanForm({ ...DEFAULT_FORM, tenure: "2.55" }).errors.tenure).toBeDefined();
    expect(validateLoanForm({ ...DEFAULT_FORM, tenure: "6.5", tenureUnit: "months" }).errors.tenure).toBeDefined();
  });
  it("flags missing, negative and extreme values", () => {
    const r = validateLoanForm({ ...DEFAULT_FORM, principal: "", rate: "-1", tenure: "41" });
    expect(r.params).toBeNull();
    expect(Object.keys(r.errors).sort()).toEqual(["principal", "rate", "tenure"]);
    expect(validateLoanForm({ ...DEFAULT_FORM, principal: "2000000000" }).errors.principal).toMatch(/100 crore/);
    expect(validateLoanForm({ ...DEFAULT_FORM, principal: "100000.123" }).errors.principal).toBeDefined();
  });
  it("validates fees", () => {
    expect(validateLoanForm({ ...DEFAULT_FORM, feeValue: "11" }).errors.feeValue).toBeDefined();
    expect(validateLoanForm({ ...DEFAULT_FORM, feeType: "flat", feeValue: "2500000" }).errors.feeValue).toBeDefined();
    expect(validateLoanForm({ ...DEFAULT_FORM, feeValue: "" }).params?.fee_value).toBe(0);
  });
  it("round-trips saved params", () => {
    const p = { principal: 500000, annual_rate: 10.5, tenure_months: 30, fee_type: "flat" as const, fee_value: 2500 };
    expect(validateLoanForm(formFromParams(p)).params).toEqual(p);
  });
});

describe("format", () => {
  it("uses Indian grouping", () => {
    expect(formatINR(1250000)).toBe("₹12,50,000.00");
    expect(formatINR(123456789.5)).toBe("₹12,34,56,789.50");
    expect(formatINR(999, 0)).toBe("₹999");
    expect(splitINR(43391.16)).toEqual(["₹43,391", ".16"]);
  });
  it("compacts to lakh and crore", () => {
    expect(formatCompactINR(1250000)).toBe("₹12.5L");
    expect(formatCompactINR(12500000)).toBe("₹1.25Cr");
    expect(formatCompactINR(45000)).toBe("₹45K");
    expect(amountInWords(2500000)).toBe("25 lakh");
  });
  it("labels tenure", () => {
    expect(formatTenure(240)).toBe("20 yrs");
    expect(formatTenure(30)).toBe("2 yrs 6 mo");
    expect(formatTenure(1)).toBe("1 mo");
  });
});
