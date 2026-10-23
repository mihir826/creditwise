import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// End-to-end smoke test against running servers (frontend :3000, backend :8000).
// Uses an installed Chrome: CHROME_PATH=/path/to/chrome npm run e2e
// It creates one saved calculation named "E2E test loan" and deletes it again.
const B = process.env.FRONTEND_URL ?? "http://localhost:3000";
const API = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const out = fs.mkdtempSync(path.join(os.tmpdir(), "creditwise-e2e-"));
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) process.exitCode = 1; };

// Calculator: live result for defaults (25L, 8.75%, 20y)
await page.goto(`${B}/calculator`, { waitUntil: "networkidle" });
await page.getByText("₹22,092").first().waitFor({ timeout: 8000 });
ok(true, "calculator shows EMI for default inputs");

// Validation: negative and empty amount
const amount = page.getByLabel("Loan amount", { exact: true });
await amount.fill("-5000");
ok(await page.getByText("Minimum loan amount is ₹1,000.").isVisible(), "negative amount rejected with message");
await amount.fill("");
ok(await page.getByText("Enter a loan amount.").isVisible(), "empty amount rejected with message");
ok(await page.getByRole("button", { name: "PDF report" }).isDisabled(), "PDF button disabled while inputs invalid");

// Zero interest + slider sync
await amount.fill("120000");
await page.getByLabel("Interest rate", { exact: true }).fill("0");
await page.getByLabel("Tenure", { exact: true }).fill("1");
await page.getByText("₹10,000.00").first().waitFor({ timeout: 8000 });
ok(true, "zero-interest 1.2L over 12 months -> ₹10,000.00 EMI");
const sliderVal = await page.getByLabel("Interest rate slider").inputValue();
ok(sliderVal === "0", `rate slider synced to input (${sliderVal})`);
await page.getByLabel("Interest rate slider").fill("12");
ok((await page.getByLabel("Interest rate", { exact: true }).inputValue()) === "12", "input synced from slider");
await page.getByText("₹10,661.85").first().waitFor({ timeout: 8000 });
ok(true, "1.2L @12% for 12 months -> ₹10,661.85 (closed-form EMI)");

// PDF download
let [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF report" }).click()]);
const pdfPath = `${out}/e2e-report.pdf`;
await dl.saveAs(pdfPath);
const pdf = fs.readFileSync(pdfPath);
ok(pdf.subarray(0, 4).toString() === "%PDF" && pdf.length > 20000, `PDF downloaded (${dl.suggestedFilename()}, ${pdf.length} bytes)`);

// CSV download
[dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
const csvPath = `${out}/e2e-schedule.csv`;
await dl.saveAs(csvPath);
const csv = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
ok(csv.length === 1 + 12 + 2 && csv[12].endsWith(",0.00"), `CSV downloaded with 12 rows, final balance 0.00`);

// Save
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.getByRole("textbox", { name: "Name" }).fill("E2E test loan");
await page.getByRole("button", { name: "Save", exact: true }).last().click();
await page.getByText("Calculation saved").waitFor({ timeout: 5000 });
const list = await (await fetch(`${API}/api/calculations`)).json();
const rec = list.find((r) => r.name === "E2E test loan");
ok(rec && rec.emi === 10661.85, "saved record persisted in backend with correct EMI");

// Reopen saved in calculator
await page.goto(`${B}/calculator?id=${rec.id}`, { waitUntil: "networkidle" });
await page.getByText("Loaded from").waitFor();
ok((await page.getByLabel("Loan amount", { exact: true }).inputValue()) === "120000", "saved calculation reopens in calculator");

// Saved page: rename + delete
await page.goto(`${B}/saved`, { waitUntil: "networkidle" });
const card = page.locator("li", { hasText: "E2E test loan" });
await card.getByRole("button", { name: "Rename" }).click();
await page.getByRole("textbox", { name: "Name" }).fill("E2E renamed");
await page.getByRole("button", { name: "Rename", exact: true }).last().click();
await page.getByText("E2E renamed").first().waitFor();
ok(true, "rename reflected in list");
await page.locator("li", { hasText: "E2E renamed" }).getByRole("button", { name: "Delete" }).click();
ok(await page.getByText("will be permanently removed").isVisible(), "delete asks for confirmation");
await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
await page.getByText("Calculation deleted").waitFor();
const after = await (await fetch(`${API}/api/calculations`)).json();
ok(!after.some((r) => r.id === rec.id), "record deleted in backend");


// Prediction
await page.goto(`${B}/predict`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Run prediction" }).click();
await page.getByText("Why the model said this").waitFor({ timeout: 8000 });
ok(await page.getByText(/Likely (not )?approved/).isVisible(), "prediction rendered with explanation");

// Age is capped at 85
const age = page.getByLabel("Age", { exact: true });
await age.fill("86");
ok(await page.getByText("Age must be between 18 and 85.").isVisible(), "age 86 rejected with message");
ok(await page.getByRole("button", { name: "Run prediction" }).isDisabled(), "prediction blocked while age invalid");
await age.fill("85");

// PhD is selectable and explained
await page.getByLabel("Education", { exact: true }).selectOption("PhD");
ok(await page.getByText("Treated as Graduate").isVisible(), "PhD option available with honest mapping note");

// Amounts have no upper limit
for (const [label, v] of [["Applicant income", "5000000000"], ["Savings", "900000000"], ["Collateral value", "7500000000"], ["Loan amount", "250000000"]]) {
  await page.getByLabel(label, { exact: true }).fill(v);
}
await page.getByRole("button", { name: "Run prediction" }).click();
await page.getByText("These values are accepted").waitFor({ timeout: 8000 });
ok(await page.getByText(/Education Level 'PhD' is treated as 'Graduate'/).isVisible(), "very large amounts + PhD + age 85 predicted, with notes");

console.log("console/page errors:", errors.length ? errors : "none");
await browser.close();
