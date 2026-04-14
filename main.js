import { useState, useMemo } from "react";

// 2025 Federal tax brackets (Single filer)
const FEDERAL_BRACKETS = [
  { min: 0, max: 11925, rate: 0.10 },
  { min: 11925, max: 48475, rate: 0.12 },
  { min: 48475, max: 103350, rate: 0.22 },
  { min: 103350, max: 197300, rate: 0.24 },
  { min: 197300, max: 250525, rate: 0.32 },
  { min: 250525, max: 626350, rate: 0.35 },
  { min: 626350, max: Infinity, rate: 0.37 },
];

// 2025 California tax brackets (Single filer)
const CA_BRACKETS = [
  { min: 0, max: 11079, rate: 0.01 },
  { min: 11079, max: 26264, rate: 0.02 },
  { min: 26264, max: 41449, rate: 0.04 },
  { min: 41449, max: 57509, rate: 0.06 },
  { min: 57509, max: 72689, rate: 0.08 },
  { min: 72689, max: 372984, rate: 0.093 },
  { min: 372984, max: 447573, rate: 0.103 },
  { min: 447573, max: 698274, rate: 0.113 },
  { min: 698274, max: 1000000, rate: 0.123 },
  { min: 1000000, max: Infinity, rate: 0.133 },
];

const FEDERAL_STD_DEDUCTION = 15000;
const CA_STD_DEDUCTION = 5706;
const FICA_SS_RATE = 0.062;
const FICA_SS_CAP = 176100;
const FICA_MEDICARE_RATE = 0.0145;
const FICA_MEDICARE_SURTAX_RATE = 0.009;
const FICA_MEDICARE_SURTAX_THRESHOLD = 200000;
const CA_SDI_RATE = 0.012;
const MAX_401K = 23500;
const MAX_ROTH = 7000;

function calcBracketTax(income, brackets) {
  let tax = 0;
  for (const b of brackets) {
    if (income <= b.min) break;
    const taxable = Math.min(income, b.max) - b.min;
    tax += taxable * b.rate;
  }
  return tax;
}

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return "$0";
  const abs = Math.abs(Math.round(n));
  const s = "$" + abs.toLocaleString("en-US");
  return n < -0.5 ? "-" + s : s;
}

function fmtPct(n) {
  return (n * 100).toFixed(1) + "%";
}

const mono = "'DM Mono', monospace";
const sans = "'DM Sans', system-ui, sans-serif";

const EXPENSE_CATEGORIES = [
  { key: "retirement", label: "Retirement", icon: "\u{1F4C8}", items: [
    { key: "k401", label: "401(k)", hint: "Annual pre-tax, max $23,500/yr", monthly: false },
    { key: "roth", label: "Roth IRA", hint: "Annual post-tax, max $7,000/yr", monthly: false },
  ]},
  { key: "housing", label: "Housing", icon: "\u{1F3E0}", items: [
    { key: "rent", label: "Rent", hint: "Monthly", monthly: true },
    { key: "utilities", label: "Utilities", hint: "Monthly (electric, water, internet)", monthly: true },
    { key: "renters_ins", label: "Renters Insurance", hint: "Monthly", monthly: true },
  ]},
  { key: "transport", label: "Transportation", icon: "\u{1F697}", items: [
    { key: "car_payment", label: "Car Payment", hint: "Monthly", monthly: true },
    { key: "car_insurance", label: "Car Insurance", hint: "Monthly", monthly: true },
    { key: "gas", label: "Gas / Charging", hint: "Monthly", monthly: true },
    { key: "parking", label: "Parking / Transit", hint: "Monthly", monthly: true },
  ]},
  { key: "living", label: "Living", icon: "\u{1F354}", items: [
    { key: "groceries", label: "Groceries", hint: "Monthly", monthly: true },
    { key: "dining", label: "Dining Out", hint: "Monthly", monthly: true },
  ]},
  { key: "lifestyle", label: "Lifestyle", icon: "\u2728", items: [
    { key: "subscriptions", label: "Subscriptions", hint: "Monthly (streaming, apps, etc.)", monthly: true },
    { key: "gym", label: "Gym / Fitness", hint: "Monthly", monthly: true },
    { key: "personal", label: "Personal Care", hint: "Monthly (skincare, grooming, etc.)", monthly: true },
    { key: "shopping", label: "Shopping / Clothing", hint: "Monthly average", monthly: true },
  ]},
  { key: "other", label: "Other", icon: "\u{1F4CB}", items: [
    { key: "student_loans", label: "Student Loans", hint: "Monthly", monthly: true },
    { key: "phone", label: "Phone Bill", hint: "Monthly", monthly: true },
    { key: "health_ins", label: "Health Insurance", hint: "Monthly (if not employer-paid)", monthly: true },
    { key: "misc", label: "Miscellaneous", hint: "Monthly catch-all", monthly: true },
  ]},
];

function InputField({ label, value, onChange, hint, compact }) {
  return (
    <div style={{ marginBottom: compact ? 10 : 16 }}>
      <label style={{
        display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 5, fontFamily: mono,
      }}>{label}</label>
      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: "var(--accent)", fontSize: compact ? 14 : 18, fontWeight: 700,
          fontFamily: mono, pointerEvents: "none",
        }}>$</span>
        <input
          type="text" inputMode="numeric"
          value={value === 0 ? "" : value.toLocaleString("en-US")}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, "");
            onChange(raw === "" ? 0 : parseInt(raw, 10));
          }}
          placeholder="0"
          style={{
            width: "100%", padding: compact ? "9px 12px 9px 28px" : "12px 14px 12px 32px",
            fontSize: compact ? 16 : 20, fontWeight: 600, fontFamily: mono,
            background: "var(--input-bg)", border: "1.5px solid var(--border)",
            borderRadius: 10, color: "var(--text)", outline: "none",
            transition: "border-color 0.2s", boxSizing: "border-box",
          }}
          onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
          onBlur={(e) => e.target.style.borderColor = "var(--border)"}
        />
      </div>
      {hint && <span style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 3, display: "block", fontFamily: mono }}>{hint}</span>}
    </div>
  );
}

function TaxRow({ label, amount, pct, bold, accent, sub, warn }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: sub ? "5px 0 5px 16px" : "8px 0",
      borderBottom: bold ? "none" : "1px solid var(--border-light)", fontFamily: mono,
    }}>
      <span style={{
        fontSize: sub ? 12 : (bold ? 14 : 13),
        fontWeight: bold ? 700 : (sub ? 400 : 500),
        color: warn ? "var(--red)" : (sub ? "var(--text-dim)" : (accent ? "var(--accent)" : "var(--text)")),
      }}>{label}</span>
      <div style={{ textAlign: "right", display: "flex", gap: 16, alignItems: "baseline" }}>
        {pct !== undefined && (
          <span style={{ fontSize: 11, color: "var(--text-dim)", minWidth: 48 }}>{fmtPct(pct)}</span>
        )}
        <span style={{
          fontSize: sub ? 13 : (bold ? 18 : 14),
          fontWeight: bold ? 800 : (sub ? 400 : 600),
          color: warn ? "var(--red)" : (accent ? "var(--accent)" : "var(--text)"),
          minWidth: 90, textAlign: "right",
        }}>{fmt(amount)}</span>
      </div>
    </div>
  );
}

function BarSegment({ label, amount, total, color }) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  if (pct < 1.5) return null;
  return (
    <div style={{
      width: pct + "%", background: color, height: 36,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, fontWeight: 700, color: "#fff", fontFamily: mono,
      overflow: "hidden", whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(0,0,0,0.3)",
    }}>
      {pct > 8 ? label : ""}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 600, textTransform: "uppercase",
      letterSpacing: "0.1em", color: "var(--text-dim)", marginBottom: 16, fontFamily: mono,
    }}>{children}</div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 14,
      padding: 20, border: "1px solid var(--border)", ...style,
    }}>{children}</div>
  );
}

export default function SalaryCalculator() {
  const [tab, setTab] = useState("comp");
  const [base, setBase] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [signOn, setSignOn] = useState(0);
  const [rsu, setRsu] = useState(0);
  const [relocation, setRelocation] = useState(0);
  const [vestingYears, setVestingYears] = useState(4);

  const [expenses, setExpenses] = useState(() => {
    const init = {};
    for (const cat of EXPENSE_CATEGORIES) {
      for (const item of cat.items) init[item.key] = 0;
    }
    return init;
  });

  const setExpense = (key, val) => setExpenses((prev) => ({ ...prev, [key]: val }));

  const calc = useMemo(() => {
    const annualRsu = rsu / vestingYears;
    const preTax401k = expenses.k401 || 0;
    const totalGross = base + bonus + signOn + annualRsu + relocation;
    if (totalGross === 0) return null;

    const adjustedGross = Math.max(0, totalGross - preTax401k);
    const fedTaxableIncome = Math.max(0, adjustedGross - FEDERAL_STD_DEDUCTION);
    const fedIncomeTax = calcBracketTax(fedTaxableIncome, FEDERAL_BRACKETS);
    const caTaxableIncome = Math.max(0, adjustedGross - CA_STD_DEDUCTION);
    const caIncomeTax = calcBracketTax(caTaxableIncome, CA_BRACKETS);

    const ssWages = Math.min(totalGross, FICA_SS_CAP);
    const ssTax = ssWages * FICA_SS_RATE;
    const medicareTax = totalGross * FICA_MEDICARE_RATE;
    const medicareSurtax = totalGross > FICA_MEDICARE_SURTAX_THRESHOLD
      ? (totalGross - FICA_MEDICARE_SURTAX_THRESHOLD) * FICA_MEDICARE_SURTAX_RATE : 0;
    const totalFica = ssTax + medicareTax + medicareSurtax;
    const caSDI = totalGross * CA_SDI_RATE;

    const totalTax = fedIncomeTax + caIncomeTax + totalFica + caSDI;
    const netIncome = totalGross - totalTax - preTax401k;
    const effectiveRate = totalGross > 0 ? totalTax / totalGross : 0;
    const monthlyNet = netIncome / 12;

    return {
      totalGross, annualRsu, fedIncomeTax, caIncomeTax, ssTax,
      medicareTax: medicareTax + medicareSurtax, caSDI, totalFica,
      totalTax, netIncome, effectiveRate, monthlyNet, preTax401k,
    };
  }, [base, bonus, signOn, rsu, relocation, vestingYears, expenses.k401]);

  const expenseCalc = useMemo(() => {
    const byCategory = {};
    let totalAnnual = 0;
    for (const cat of EXPENSE_CATEGORIES) {
      let catTotal = 0;
      for (const item of cat.items) {
        const val = expenses[item.key] || 0;
        catTotal += item.monthly ? val * 12 : val;
      }
      byCategory[cat.key] = catTotal;
      totalAnnual += catTotal;
    }
    const totalPostTaxExpenses = totalAnnual - (expenses.k401 || 0);
    const netAfterExpenses = calc ? calc.netIncome - totalPostTaxExpenses : 0;
    const monthlyRemaining = netAfterExpenses / 12;
    return { byCategory, totalAnnual, totalPostTaxExpenses, netAfterExpenses, monthlyRemaining };
  }, [expenses, calc]);

  const expenseColors = ["#4ade80", "#60a5fa", "#fb923c", "#f87171", "#a78bfa", "#2dd4bf"];

  return (
    <div style={{
      "--bg": "#0d0f11", "--surface": "#161a1f", "--input-bg": "#1c2127",
      "--border": "#2a3038", "--border-light": "#1e242b",
      "--text": "#e8eaed", "--text-dim": "#7a8494",
      "--accent": "#4ade80", "--accent-dim": "#22543d",
      "--red": "#f87171", "--orange": "#fb923c",
      "--blue": "#60a5fa", "--purple": "#a78bfa", "--teal": "#2dd4bf",
      minHeight: "100vh", background: "var(--bg)", color: "var(--text)",
      fontFamily: sans, padding: "32px 20px", boxSizing: "border-box",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--accent)", fontFamily: mono, marginBottom: 8 }}>Santa Clara County, CA</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, fontFamily: sans, lineHeight: 1.1 }}>Total Comp Calculator</h1>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "8px 0 0", fontFamily: mono }}>Federal + CA state + FICA + SDI // 2025 brackets, single filer</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--surface)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", width: "fit-content" }}>
          {[{ key: "comp", label: "Compensation" }, { key: "expenses", label: "Expenses" }, { key: "summary", label: "Summary" }].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "10px 24px", fontSize: 13, fontWeight: 600, fontFamily: mono,
              background: tab === t.key ? "var(--accent)" : "transparent",
              color: tab === t.key ? "#0d0f11" : "var(--text-dim)",
              border: "none", borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ====== COMP TAB ====== */}
        {tab === "comp" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <Card style={{ padding: 24 }}>
              <SectionLabel>Compensation</SectionLabel>
              <InputField label="Base Salary" value={base} onChange={setBase} hint="Annual" />
              <InputField label="Target Bonus" value={bonus} onChange={setBonus} hint="Annual target" />
              <InputField label="Sign-On Bonus" value={signOn} onChange={setSignOn} hint="One-time, year 1" />
              <InputField label="RSU Grant (Total)" value={rsu} onChange={setRsu} hint="Total grant value" />
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 6, fontFamily: mono }}>RSU Vesting Period</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[2, 3, 4, 5].map((y) => (
                    <button key={y} onClick={() => setVestingYears(y)} style={{
                      flex: 1, padding: "10px 0", fontSize: 14, fontWeight: 700, fontFamily: mono,
                      background: vestingYears === y ? "var(--accent)" : "var(--input-bg)",
                      color: vestingYears === y ? "#0d0f11" : "var(--text-dim)",
                      border: vestingYears === y ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
                      borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                    }}>{y}yr</button>
                  ))}
                </div>
              </div>
              <InputField label="Relocation" value={relocation} onChange={setRelocation} hint="One-time, taxable" />
            </Card>
            <div>
              {calc ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Card style={{ textAlign: "center", padding: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-dim)", marginBottom: 4, fontFamily: mono }}>Annual Take-Home</div>
                    <div style={{ fontSize: 42, fontWeight: 800, color: "var(--accent)", fontFamily: mono, lineHeight: 1.1 }}>{fmt(calc.netIncome)}</div>
                    <div style={{ fontSize: 13, color: "var(--text-dim)", fontFamily: mono, marginTop: 6 }}>{fmt(calc.monthlyNet)}/mo &middot; {fmtPct(calc.effectiveRate)} effective rate</div>
                  </Card>
                  <Card>
                    <SectionLabel>Where It Goes</SectionLabel>
                    <div style={{ display: "flex", borderRadius: 8, overflow: "hidden" }}>
                      <BarSegment label="Take-Home" amount={calc.netIncome} total={calc.totalGross} color="#4ade80" />
                      <BarSegment label="Federal" amount={calc.fedIncomeTax} total={calc.totalGross} color="#f87171" />
                      <BarSegment label="CA State" amount={calc.caIncomeTax} total={calc.totalGross} color="#fb923c" />
                      <BarSegment label="FICA" amount={calc.totalFica} total={calc.totalGross} color="#60a5fa" />
                      {calc.preTax401k > 0 && <BarSegment label="401(k)" amount={calc.preTax401k} total={calc.totalGross} color="#2dd4bf" />}
                      <BarSegment label="SDI" amount={calc.caSDI} total={calc.totalGross} color="#a78bfa" />
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                      {[
                        { label: "Take-Home", color: "#4ade80" }, { label: "Federal", color: "#f87171" },
                        { label: "CA State", color: "#fb923c" }, { label: "FICA", color: "#60a5fa" },
                        ...(calc.preTax401k > 0 ? [{ label: "401(k)", color: "#2dd4bf" }] : []),
                        { label: "SDI", color: "#a78bfa" },
                      ].map((l) => (
                        <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                          <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: mono }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card>
                    <SectionLabel>Tax Breakdown</SectionLabel>
                    <TaxRow label="Gross Compensation" amount={calc.totalGross} bold />
                    <div style={{ height: 6 }} />
                    <TaxRow label="Base Salary" amount={base} sub />
                    <TaxRow label="Target Bonus" amount={bonus} sub />
                    <TaxRow label="Sign-On Bonus" amount={signOn} sub />
                    <TaxRow label={`RSUs (${fmt(rsu)} / ${vestingYears}yr)`} amount={calc.annualRsu} sub />
                    <TaxRow label="Relocation" amount={relocation} sub />
                    <div style={{ height: 14 }} />
                    {calc.preTax401k > 0 && <TaxRow label="401(k) Pre-Tax" amount={calc.preTax401k} pct={calc.preTax401k / calc.totalGross} />}
                    <TaxRow label="Federal Income Tax" amount={calc.fedIncomeTax} pct={calc.fedIncomeTax / calc.totalGross} />
                    <TaxRow label="CA State Income Tax" amount={calc.caIncomeTax} pct={calc.caIncomeTax / calc.totalGross} />
                    <TaxRow label="Social Security" amount={calc.ssTax} pct={calc.ssTax / calc.totalGross} />
                    <TaxRow label="Medicare" amount={calc.medicareTax} pct={calc.medicareTax / calc.totalGross} />
                    <TaxRow label="CA SDI" amount={calc.caSDI} pct={calc.caSDI / calc.totalGross} />
                    <div style={{ height: 10 }} />
                    <TaxRow label="Total Deductions" amount={calc.totalTax + calc.preTax401k} pct={(calc.totalTax + calc.preTax401k) / calc.totalGross} bold />
                    <div style={{ height: 4 }} />
                    <TaxRow label="Net Take-Home" amount={calc.netIncome} bold accent />
                  </Card>
                </div>
              ) : (
                <Card style={{ padding: 48, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
                  <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>&#x1F4B0;</div>
                  <div style={{ fontSize: 15, color: "var(--text-dim)", fontFamily: mono, lineHeight: 1.6 }}>Enter your compensation<br />to see the breakdown</div>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ====== EXPENSES TAB ====== */}
        {tab === "expenses" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {EXPENSE_CATEGORIES.filter((_, i) => i % 2 === 0).map((cat) => (
                <Card key={cat.key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 18 }}>{cat.icon}</span>
                    <SectionLabel>{cat.label}</SectionLabel>
                  </div>
                  {cat.items.map((item) => (
                    <InputField key={item.key} compact label={item.label} value={expenses[item.key]}
                      onChange={(v) => setExpense(item.key, v)} hint={item.hint} />
                  ))}
                </Card>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {EXPENSE_CATEGORIES.filter((_, i) => i % 2 === 1).map((cat) => (
                <Card key={cat.key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 18 }}>{cat.icon}</span>
                    <SectionLabel>{cat.label}</SectionLabel>
                  </div>
                  {cat.items.map((item) => (
                    <InputField key={item.key} compact label={item.label} value={expenses[item.key]}
                      onChange={(v) => setExpense(item.key, v)} hint={item.hint} />
                  ))}
                </Card>
              ))}
              {calc && (
                <Card style={{ background: "linear-gradient(135deg, #161a1f 0%, #1a2030 100%)", position: "sticky", top: 20 }}>
                  <SectionLabel>Monthly Snapshot</SectionLabel>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: mono }}>Net monthly pay</span>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: mono }}>{fmt(calc.monthlyNet)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: mono }}>Monthly expenses</span>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: mono, color: "var(--orange)" }}>{fmt(expenseCalc.totalPostTaxExpenses / 12)}</span>
                  </div>
                  <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: mono }}>Remaining</span>
                    <span style={{ fontSize: 18, fontWeight: 800, fontFamily: mono, color: expenseCalc.monthlyRemaining >= 0 ? "var(--accent)" : "var(--red)" }}>{fmt(expenseCalc.monthlyRemaining)}</span>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ====== SUMMARY TAB ====== */}
        {tab === "summary" && (
          <div>
            {calc ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Card style={{ textAlign: "center", padding: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-dim)", marginBottom: 4, fontFamily: mono }}>Monthly Savings</div>
                    <div style={{ fontSize: 48, fontWeight: 800, fontFamily: mono, lineHeight: 1.1, color: expenseCalc.monthlyRemaining >= 0 ? "var(--accent)" : "var(--red)" }}>{fmt(expenseCalc.monthlyRemaining)}</div>
                    <div style={{ fontSize: 13, color: "var(--text-dim)", fontFamily: mono, marginTop: 8 }}>
                      {fmt(expenseCalc.netAfterExpenses)}/yr
                      {calc.netIncome > 0 && <> &middot; {fmtPct(expenseCalc.netAfterExpenses / calc.totalGross)} of gross</>}
                    </div>
                  </Card>
                  <Card>
                    <SectionLabel>Annual Waterfall</SectionLabel>
                    <TaxRow label="Gross Compensation" amount={calc.totalGross} bold />
                    <div style={{ height: 6 }} />
                    {calc.preTax401k > 0 && <TaxRow label="401(k) Pre-Tax" amount={-calc.preTax401k} />}
                    <TaxRow label="Federal Income Tax" amount={-calc.fedIncomeTax} />
                    <TaxRow label="CA State Income Tax" amount={-calc.caIncomeTax} />
                    <TaxRow label="FICA (SS + Medicare)" amount={-calc.totalFica} />
                    <TaxRow label="CA SDI" amount={-calc.caSDI} />
                    <div style={{ height: 6 }} />
                    <TaxRow label="Net Take-Home" amount={calc.netIncome} bold accent />
                    <div style={{ height: 10 }} />
                    {EXPENSE_CATEGORIES.map((cat) => {
                      const catVal = expenseCalc.byCategory[cat.key];
                      const adjusted = cat.key === "retirement" ? catVal - (expenses.k401 || 0) : catVal;
                      if (adjusted === 0) return null;
                      return <TaxRow key={cat.key} label={`${cat.icon} ${cat.label}`} amount={-adjusted} />;
                    })}
                    <div style={{ height: 8 }} />
                    <TaxRow label="Annual Savings" amount={expenseCalc.netAfterExpenses} bold
                      accent={expenseCalc.netAfterExpenses >= 0} warn={expenseCalc.netAfterExpenses < 0} />
                  </Card>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Card>
                    <SectionLabel>Gross Income Allocation</SectionLabel>
                    <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
                      <BarSegment label="Savings" amount={Math.max(0, expenseCalc.netAfterExpenses)} total={calc.totalGross} color="#4ade80" />
                      <BarSegment label="Expenses" amount={expenseCalc.totalPostTaxExpenses} total={calc.totalGross} color="#fb923c" />
                      <BarSegment label="Taxes" amount={calc.totalTax} total={calc.totalGross} color="#f87171" />
                      {calc.preTax401k > 0 && <BarSegment label="401(k)" amount={calc.preTax401k} total={calc.totalGross} color="#2dd4bf" />}
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                      {[
                        { label: "Savings", color: "#4ade80" }, { label: "Expenses", color: "#fb923c" },
                        { label: "Taxes", color: "#f87171" },
                        ...(calc.preTax401k > 0 ? [{ label: "401(k)", color: "#2dd4bf" }] : []),
                      ].map((l) => (
                        <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                          <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: mono }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card>
                    <SectionLabel>Monthly Expense Breakdown</SectionLabel>
                    {EXPENSE_CATEGORIES.map((cat, ci) => {
                      const catVal = expenseCalc.byCategory[cat.key];
                      const adjusted = cat.key === "retirement" ? catVal - (expenses.k401 || 0) : catVal;
                      if (adjusted === 0) return null;
                      return (
                        <div key={cat.key} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "10px 0", borderBottom: "1px solid var(--border-light)", fontFamily: mono,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: expenseColors[ci % expenseColors.length] }} />
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{cat.icon} {cat.label}</span>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{fmt(adjusted / 12)}</span>
                        </div>
                      );
                    })}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 0", fontFamily: mono }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>Total Monthly Expenses</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "var(--orange)" }}>{fmt(expenseCalc.totalPostTaxExpenses / 12)}</span>
                    </div>
                  </Card>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Card style={{ textAlign: "center", padding: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-dim)", fontFamily: mono, marginBottom: 4 }}>Savings Rate</div>
                      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: mono, color: expenseCalc.netAfterExpenses >= 0 ? "var(--accent)" : "var(--red)" }}>
                        {calc.totalGross > 0 ? fmtPct(Math.max(0, expenseCalc.netAfterExpenses) / calc.totalGross) : "0%"}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: mono }}>of gross</div>
                    </Card>
                    <Card style={{ textAlign: "center", padding: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-dim)", fontFamily: mono, marginBottom: 4 }}>Tax Burden</div>
                      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: mono, color: "var(--red)" }}>{fmtPct(calc.effectiveRate)}</div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: mono }}>effective</div>
                    </Card>
                  </div>
                </div>
              </div>
            ) : (
              <Card style={{ padding: 48, textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>&#x1F4CA;</div>
                <div style={{ fontSize: 15, color: "var(--text-dim)", fontFamily: mono, lineHeight: 1.6 }}>Fill in your compensation first,<br />then add expenses to see the full picture</div>
              </Card>
            )}
          </div>
        )}

        <div style={{ marginTop: 24, fontSize: 11, color: "var(--text-dim)", fontFamily: mono, lineHeight: 1.6, textAlign: "center", opacity: 0.6 }}>
          Estimates only. Uses 2025 federal + CA brackets, single filer, standard deduction. Does not account for HSA, itemized deductions, employer match, or AMT.
        </div>
      </div>
    </div>
  );
}