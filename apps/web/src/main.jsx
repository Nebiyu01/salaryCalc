import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "./auth";
import { api } from "./api";
import AccountBar from "./AccountBar.jsx";
import RetirementProjection, { DEFAULTS as RETIREMENT_DEFAULTS } from "./RetirementProjection.jsx";
import CarPayment from "./CarPayment.jsx";
import { useIsMobile } from "./useIsMobile";

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

// 2025 State income tax data (Single filer, approximate)
// sdiRate: state disability/paid-leave employee contribution rate
// sdiCap: wage cap for SDI (default Infinity)
// sdiLabel: label for SDI line item
const STATE_TAX_DATA = {
  AL: { name: "Alabama",        brackets: [{min:0,max:500,rate:.02},{min:500,max:3000,rate:.04},{min:3000,max:Infinity,rate:.05}], stdDeduction: 2500,  sdiRate: 0 },
  AK: { name: "Alaska",         brackets: [], stdDeduction: 0,     sdiRate: 0 },
  AZ: { name: "Arizona",        brackets: [{min:0,max:Infinity,rate:.025}], stdDeduction: 14600, sdiRate: 0 },
  AR: { name: "Arkansas",       brackets: [{min:0,max:4300,rate:.02},{min:4300,max:8500,rate:.04},{min:8500,max:Infinity,rate:.047}], stdDeduction: 2200, sdiRate: 0 },
  CA: { name: "California",     brackets: [{min:0,max:11079,rate:.01},{min:11079,max:26264,rate:.02},{min:26264,max:41449,rate:.04},{min:41449,max:57509,rate:.06},{min:57509,max:72689,rate:.08},{min:72689,max:372984,rate:.093},{min:372984,max:447573,rate:.103},{min:447573,max:698274,rate:.113},{min:698274,max:1000000,rate:.123},{min:1000000,max:Infinity,rate:.133}], stdDeduction: 5706,  sdiRate: 0.012, sdiCap: Infinity, sdiLabel: "CA SDI" },
  CO: { name: "Colorado",       brackets: [{min:0,max:Infinity,rate:.044}], stdDeduction: 14600, sdiRate: 0 },
  CT: { name: "Connecticut",    brackets: [{min:0,max:10000,rate:.03},{min:10000,max:50000,rate:.05},{min:50000,max:100000,rate:.055},{min:100000,max:200000,rate:.06},{min:200000,max:250000,rate:.065},{min:250000,max:500000,rate:.069},{min:500000,max:Infinity,rate:.0699}], stdDeduction: 15000, sdiRate: 0 },
  DC: { name: "Washington DC",  brackets: [{min:0,max:10000,rate:.04},{min:10000,max:40000,rate:.06},{min:40000,max:60000,rate:.065},{min:60000,max:350000,rate:.085},{min:350000,max:1000000,rate:.0925},{min:1000000,max:Infinity,rate:.1075}], stdDeduction: 12950, sdiRate: 0 },
  DE: { name: "Delaware",       brackets: [{min:0,max:2000,rate:0},{min:2000,max:5000,rate:.022},{min:5000,max:10000,rate:.039},{min:10000,max:20000,rate:.048},{min:20000,max:25000,rate:.052},{min:25000,max:60000,rate:.0555},{min:60000,max:Infinity,rate:.066}], stdDeduction: 3250, sdiRate: 0 },
  FL: { name: "Florida",        brackets: [], stdDeduction: 0,     sdiRate: 0 },
  GA: { name: "Georgia",        brackets: [{min:0,max:Infinity,rate:.0549}], stdDeduction: 5400,  sdiRate: 0 },
  HI: { name: "Hawaii",         brackets: [{min:0,max:2400,rate:.014},{min:2400,max:4800,rate:.032},{min:4800,max:9600,rate:.055},{min:9600,max:14400,rate:.064},{min:14400,max:19200,rate:.068},{min:19200,max:24000,rate:.072},{min:24000,max:48000,rate:.076},{min:48000,max:150000,rate:.079},{min:150000,max:175000,rate:.0825},{min:175000,max:200000,rate:.09},{min:200000,max:Infinity,rate:.11}], stdDeduction: 2200, sdiRate: 0.005, sdiCap: 60050, sdiLabel: "HI TDI" },
  ID: { name: "Idaho",          brackets: [{min:0,max:Infinity,rate:.058}], stdDeduction: 14600, sdiRate: 0 },
  IL: { name: "Illinois",       brackets: [{min:0,max:Infinity,rate:.0495}], stdDeduction: 2425,  sdiRate: 0 },
  IN: { name: "Indiana",        brackets: [{min:0,max:Infinity,rate:.0305}], stdDeduction: 1000,  sdiRate: 0 },
  IA: { name: "Iowa",           brackets: [{min:0,max:6210,rate:.044},{min:6210,max:31050,rate:.048},{min:31050,max:Infinity,rate:.057}], stdDeduction: 2210, sdiRate: 0 },
  KS: { name: "Kansas",         brackets: [{min:0,max:15000,rate:.031},{min:15000,max:30000,rate:.0525},{min:30000,max:Infinity,rate:.057}], stdDeduction: 3500, sdiRate: 0 },
  KY: { name: "Kentucky",       brackets: [{min:0,max:Infinity,rate:.04}], stdDeduction: 3160,  sdiRate: 0 },
  LA: { name: "Louisiana",      brackets: [{min:0,max:12500,rate:.0185},{min:12500,max:50000,rate:.035},{min:50000,max:Infinity,rate:.0425}], stdDeduction: 4500, sdiRate: 0 },
  ME: { name: "Maine",          brackets: [{min:0,max:24500,rate:.058},{min:24500,max:58050,rate:.0675},{min:58050,max:Infinity,rate:.0715}], stdDeduction: 14600, sdiRate: 0 },
  MD: { name: "Maryland",       brackets: [{min:0,max:1000,rate:.02},{min:1000,max:2000,rate:.03},{min:2000,max:3000,rate:.04},{min:3000,max:100000,rate:.0475},{min:100000,max:125000,rate:.05},{min:125000,max:150000,rate:.0525},{min:150000,max:250000,rate:.055},{min:250000,max:Infinity,rate:.0575}], stdDeduction: 2400, sdiRate: 0 },
  MA: { name: "Massachusetts",  brackets: [{min:0,max:Infinity,rate:.05}], stdDeduction: 4400,  sdiRate: 0 },
  MI: { name: "Michigan",       brackets: [{min:0,max:Infinity,rate:.0425}], stdDeduction: 5600,  sdiRate: 0 },
  MN: { name: "Minnesota",      brackets: [{min:0,max:30070,rate:.0535},{min:30070,max:98760,rate:.068},{min:98760,max:183340,rate:.0785},{min:183340,max:Infinity,rate:.0985}], stdDeduction: 14575, sdiRate: 0 },
  MS: { name: "Mississippi",    brackets: [{min:0,max:Infinity,rate:.05}], stdDeduction: 2300,  sdiRate: 0 },
  MO: { name: "Missouri",       brackets: [{min:0,max:1207,rate:.015},{min:1207,max:2414,rate:.02},{min:2414,max:3621,rate:.025},{min:3621,max:4828,rate:.03},{min:4828,max:6035,rate:.035},{min:6035,max:7242,rate:.04},{min:7242,max:8348,rate:.045},{min:8348,max:Infinity,rate:.048}], stdDeduction: 14600, sdiRate: 0 },
  MT: { name: "Montana",        brackets: [{min:0,max:20500,rate:.047},{min:20500,max:Infinity,rate:.059}], stdDeduction: 14600, sdiRate: 0 },
  NE: { name: "Nebraska",       brackets: [{min:0,max:3700,rate:.0246},{min:3700,max:22170,rate:.0351},{min:22170,max:35730,rate:.0501},{min:35730,max:Infinity,rate:.0584}], stdDeduction: 7900, sdiRate: 0 },
  NV: { name: "Nevada",         brackets: [], stdDeduction: 0,     sdiRate: 0 },
  NH: { name: "New Hampshire",  brackets: [], stdDeduction: 0,     sdiRate: 0 },
  NJ: { name: "New Jersey",     brackets: [{min:0,max:20000,rate:.014},{min:20000,max:35000,rate:.0175},{min:35000,max:40000,rate:.035},{min:40000,max:75000,rate:.05525},{min:75000,max:500000,rate:.0637},{min:500000,max:1000000,rate:.0897},{min:1000000,max:Infinity,rate:.1075}], stdDeduction: 1000, sdiRate: 0.0026, sdiCap: 161400, sdiLabel: "NJ TDI" },
  NM: { name: "New Mexico",     brackets: [{min:0,max:5500,rate:.017},{min:5500,max:11000,rate:.032},{min:11000,max:16000,rate:.047},{min:16000,max:210000,rate:.049},{min:210000,max:Infinity,rate:.059}], stdDeduction: 14600, sdiRate: 0 },
  NY: { name: "New York",       brackets: [{min:0,max:17150,rate:.04},{min:17150,max:23600,rate:.045},{min:23600,max:27900,rate:.0525},{min:27900,max:161550,rate:.0585},{min:161550,max:323200,rate:.0625},{min:323200,max:2155350,rate:.0685},{min:2155350,max:5000000,rate:.0965},{min:5000000,max:25000000,rate:.103},{min:25000000,max:Infinity,rate:.109}], stdDeduction: 8000, sdiRate: 0 },
  NC: { name: "North Carolina", brackets: [{min:0,max:Infinity,rate:.0475}], stdDeduction: 12750, sdiRate: 0 },
  ND: { name: "North Dakota",   brackets: [{min:0,max:44725,rate:.0195},{min:44725,max:Infinity,rate:.025}], stdDeduction: 14600, sdiRate: 0 },
  OH: { name: "Ohio",           brackets: [{min:0,max:26050,rate:0},{min:26050,max:92150,rate:.02765},{min:92150,max:115300,rate:.03226},{min:115300,max:Infinity,rate:.03688}], stdDeduction: 2400, sdiRate: 0 },
  OK: { name: "Oklahoma",       brackets: [{min:0,max:1000,rate:.0025},{min:1000,max:2500,rate:.0075},{min:2500,max:3750,rate:.0175},{min:3750,max:4900,rate:.0275},{min:4900,max:7200,rate:.0375},{min:7200,max:Infinity,rate:.0475}], stdDeduction: 6350, sdiRate: 0 },
  OR: { name: "Oregon",         brackets: [{min:0,max:4050,rate:.0475},{min:4050,max:10200,rate:.0675},{min:10200,max:125000,rate:.0875},{min:125000,max:Infinity,rate:.099}], stdDeduction: 2745, sdiRate: 0 },
  PA: { name: "Pennsylvania",   brackets: [{min:0,max:Infinity,rate:.0307}], stdDeduction: 0,     sdiRate: 0 },
  RI: { name: "Rhode Island",   brackets: [{min:0,max:77450,rate:.0375},{min:77450,max:176050,rate:.0475},{min:176050,max:Infinity,rate:.0599}], stdDeduction: 10550, sdiRate: 0.011, sdiCap: 84000, sdiLabel: "RI TDI" },
  SC: { name: "South Carolina", brackets: [{min:0,max:Infinity,rate:.064}], stdDeduction: 14600, sdiRate: 0 },
  SD: { name: "South Dakota",   brackets: [], stdDeduction: 0,     sdiRate: 0 },
  TN: { name: "Tennessee",      brackets: [], stdDeduction: 0,     sdiRate: 0 },
  TX: { name: "Texas",          brackets: [], stdDeduction: 0,     sdiRate: 0 },
  UT: { name: "Utah",           brackets: [{min:0,max:Infinity,rate:.0455}], stdDeduction: 14600, sdiRate: 0 },
  VT: { name: "Vermont",        brackets: [{min:0,max:45400,rate:.0335},{min:45400,max:110050,rate:.066},{min:110050,max:229550,rate:.076},{min:229550,max:Infinity,rate:.0875}], stdDeduction: 7000, sdiRate: 0 },
  VA: { name: "Virginia",       brackets: [{min:0,max:3000,rate:.02},{min:3000,max:5000,rate:.03},{min:5000,max:17000,rate:.05},{min:17000,max:Infinity,rate:.0575}], stdDeduction: 8500, sdiRate: 0 },
  WA: { name: "Washington",     brackets: [], stdDeduction: 0,     sdiRate: 0 },
  WV: { name: "West Virginia",  brackets: [{min:0,max:10000,rate:.0236},{min:10000,max:25000,rate:.0315},{min:25000,max:40000,rate:.0354},{min:40000,max:60000,rate:.0472},{min:60000,max:Infinity,rate:.0512}], stdDeduction: 0,     sdiRate: 0 },
  WI: { name: "Wisconsin",      brackets: [{min:0,max:14320,rate:.035},{min:14320,max:28640,rate:.044},{min:28640,max:315310,rate:.053},{min:315310,max:Infinity,rate:.0765}], stdDeduction: 12760, sdiRate: 0 },
  WY: { name: "Wyoming",        brackets: [], stdDeduction: 0,     sdiRate: 0 },
};

const FEDERAL_STD_DEDUCTION = 15000;
const FICA_SS_RATE = 0.062;
const FICA_SS_CAP = 176100;
const FICA_MEDICARE_RATE = 0.0145;
const FICA_MEDICARE_SURTAX_RATE = 0.009;
const FICA_MEDICARE_SURTAX_THRESHOLD = 200000;
const MAX_401K = 23500;
const MAX_ROTH = 7500;

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

// Car loan math (shared source of truth for the Car Payment <-> Expenses link).
function carMonthlyPayment(principal, apr, months) {
  if (principal <= 0 || months <= 0) return 0;
  const r = apr / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}
// Inverse: given a monthly payment, back-solve the vehicle price (so editing
// the expense updates the loan scenario).
function carPriceFromPayment(monthly, apr, months, down) {
  if (monthly <= 0 || months <= 0) return 0;
  const r = apr / 100 / 12;
  const principal =
    r === 0 ? monthly * months : (monthly * (1 - Math.pow(1 + r, -months))) / r;
  return Math.round(principal + (down || 0));
}

const mono = "'DM Mono', monospace";
const sans = "'DM Sans', system-ui, sans-serif";

const EXPENSE_CATEGORIES = [
  { key: "retirement", label: "Retirement", icon: "\u{1F4C8}", items: [
    { key: "k401", label: "401(k)", hint: "Annual pre-tax, max $23,500/yr", monthly: false },
    { key: "roth", label: "Roth IRA", hint: "Annual post-tax, max $7,500/yr", monthly: false },
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
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("comp");
  const [stateKey, setStateKey] = useState("CA");
  const [base, setBase] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [signOn, setSignOn] = useState(0);
  const [rsu, setRsu] = useState(0);
  const [relocation, setRelocation] = useState(0);
  const [vestingYears, setVestingYears] = useState(4);

  // Car loan inputs live here (not inside the Car Payment tab) so they persist
  // across tab switches without the user having to save.
  const [carPrice, setCarPrice] = useState(0);
  const [carDown, setCarDown] = useState(0);
  const [carApr, setCarApr] = useState(6.5);
  const [carTerm, setCarTerm] = useState(60);

  // Retirement assumptions also live here so they persist across tab switches.
  const [retire, setRetire] = useState(() => ({ ...RETIREMENT_DEFAULTS }));
  const retireTouched = useRef(false);
  // Marking as "touched" is what stops the Comp/Expenses mirror below and locks
  // in the user's own edits.
  const setRetireAssumptions = (updaterOrValue) => {
    retireTouched.current = true;
    setRetire(updaterOrValue);
  };

  const [expenses, setExpenses] = useState(() => {
    const init = {};
    for (const cat of EXPENSE_CATEGORIES) {
      for (const item of cat.items) init[item.key] = 0;
    }
    return init;
  });

  const setExpense = (key, val) =>
    setExpenses((prev) => (prev[key] === val ? prev : { ...prev, [key]: val }));

  // Pre-fill the retirement salary from Comp until the user overrides it.
  // (401k/Roth contributions are two-way bound to Expenses directly — see below.)
  useEffect(() => {
    if (retireTouched.current) return;
    setRetire((r) => ({ ...r, salary: base }));
  }, [base]);

  // --- Two-way binding: Car Payment calculator <-> Expenses > Car Payment ---
  // The loan inputs are the single source of truth; the expense mirrors the
  // computed monthly, and editing the expense back-solves the vehicle price.
  const carMonthly = carMonthlyPayment(Math.max(0, carPrice - carDown), carApr, carTerm);
  useEffect(() => {
    setExpense("car_payment", Math.round(carMonthly));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carMonthly]);
  const setCarPaymentExpense = (monthly) => {
    // Set the expense immediately (no controlled-input lag) and back-solve the
    // loan; the sync effect above then confirms they match (guard prevents loops).
    setExpense("car_payment", monthly);
    setCarPrice(carPriceFromPayment(monthly, carApr, carTerm, carDown));
  };
  // Editing the Car Payment expense back-solves the loan; everything else is a
  // plain expense. (401k/Roth are already the shared source read by Retirement.)
  const onExpenseFieldChange = (key, v) =>
    key === "car_payment" ? setCarPaymentExpense(v) : setExpense(key, v);

  const stateData = STATE_TAX_DATA[stateKey];
  const stateName = stateData.name;
  const hasStateTax = stateData.brackets.length > 0;
  const hasSdi = stateData.sdiRate > 0;
  const sdiLabel = stateData.sdiLabel || "State Disability";

  const calc = useMemo(() => {
    const sd = STATE_TAX_DATA[stateKey];
    const annualRsu = rsu / vestingYears;
    const preTax401k = expenses.k401 || 0;
    const totalGross = base + bonus + signOn + annualRsu + relocation;
    if (totalGross === 0) return null;

    const adjustedGross = Math.max(0, totalGross - preTax401k);
    const fedTaxableIncome = Math.max(0, adjustedGross - FEDERAL_STD_DEDUCTION);
    const fedIncomeTax = calcBracketTax(fedTaxableIncome, FEDERAL_BRACKETS);

    const stateTaxableIncome = Math.max(0, adjustedGross - sd.stdDeduction);
    const stateIncomeTax = calcBracketTax(stateTaxableIncome, sd.brackets);

    const ssWages = Math.min(totalGross, FICA_SS_CAP);
    const ssTax = ssWages * FICA_SS_RATE;
    const medicareTax = totalGross * FICA_MEDICARE_RATE;
    const medicareSurtax = totalGross > FICA_MEDICARE_SURTAX_THRESHOLD
      ? (totalGross - FICA_MEDICARE_SURTAX_THRESHOLD) * FICA_MEDICARE_SURTAX_RATE : 0;
    const totalFica = ssTax + medicareTax + medicareSurtax;

    const sdiWages = Math.min(totalGross, sd.sdiCap ?? Infinity);
    const sdiTax = sdiWages * sd.sdiRate;

    const totalTax = fedIncomeTax + stateIncomeTax + totalFica + sdiTax;
    const netIncome = totalGross - totalTax - preTax401k;
    const effectiveRate = totalGross > 0 ? totalTax / totalGross : 0;
    const monthlyNet = netIncome / 12;

    return {
      totalGross, annualRsu, fedIncomeTax, stateIncomeTax, ssTax,
      medicareTax: medicareTax + medicareSurtax, sdiTax, totalFica,
      totalTax, netIncome, effectiveRate, monthlyNet, preTax401k,
    };
  }, [base, bonus, signOn, rsu, relocation, vestingYears, expenses.k401, stateKey]);

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

  // ---- Account: save / load / history (backed by the API) ----
  const { user, logout } = useAuth();
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  // The saved calculation the current session is tied to. "Save" updates this
  // in place; "Save to history" always forks a new entry.
  const [activeCalcId, setActiveCalcId] = useState(null);
  // Auto-load the most recent calculation once per session (right after login),
  // so the user lands on their latest work without clicking Load.
  const didAutoLoad = useRef(false);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const all = await api.listCalculations();
      const salary = all
        .filter((c) => c.calculatorSlug === "salary")
        // Most recently saved first, so a fresh "Save" jumps to the top.
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt),
        );
      setHistory(salary);
      if (!didAutoLoad.current && salary.length > 0) {
        didAutoLoad.current = true;
        applyCalculation(salary[0]); // most recent entry
      }
    } catch {
      // leave existing history; the panel shows an empty state
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) loadHistory();
  };

  const buildSnapshot = () => {
    const inputs = {
      base, bonus, signOn, rsu, relocation, vestingYears, stateKey, expenses,
      // Save the whole app state so nothing is lost on reload / re-login.
      car: { price: carPrice, down: carDown, apr: carApr, term: carTerm },
      retirement: retire,
    };
    const results = calc
      ? {
          netIncome: calc.netIncome,
          monthlyNet: calc.monthlyNet,
          effectiveRate: calc.effectiveRate,
          totalGross: calc.totalGross,
          totalTax: calc.totalTax,
          annualSavings: expenseCalc.netAfterExpenses,
        }
      : {};
    return { inputs, results };
  };

  const flashSave = (msg) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(""), 2500);
  };

  // "Save": update the active entry in place; if none, create one and adopt it.
  const saveSession = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const { inputs, results } = buildSnapshot();
      if (activeCalcId) {
        await api.updateCalculation(activeCalcId, { inputs, results });
        flashSave("Session updated ✓");
      } else {
        const title = `${stateData.name} · ${fmt(base)} base`;
        const created = await api.createCalculation({ calculatorSlug: "salary", title, inputs, results });
        setActiveCalcId(created.id);
        flashSave("Saved ✓");
      }
      await loadHistory();
    } catch (e) {
      setSaveMsg(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // "Save to history": always create a new entry (a deliberate fork).
  const saveToHistory = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const { inputs, results } = buildSnapshot();
      const title = `${stateData.name} · ${fmt(base)} base`;
      const created = await api.createCalculation({ calculatorSlug: "salary", title, inputs, results });
      setActiveCalcId(created.id);
      flashSave("Saved to history ✓");
      await loadHistory();
    } catch (e) {
      setSaveMsg(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const applyCalculation = (row) => {
    const i = row.inputs || {};
    setStateKey(i.stateKey && STATE_TAX_DATA[i.stateKey] ? i.stateKey : "CA");
    setBase(i.base || 0);
    setBonus(i.bonus || 0);
    setSignOn(i.signOn || 0);
    setRsu(i.rsu || 0);
    setRelocation(i.relocation || 0);
    setVestingYears(i.vestingYears || 4);
    if (i.expenses && typeof i.expenses === "object") {
      setExpenses((prev) => ({ ...prev, ...i.expenses }));
    }
    // Restore car loan inputs. Older saves lack the loan block but may have a
    // Car Payment expense — back-solve a loan from it so the two stay in sync.
    const savedApr = i.car?.apr ?? 6.5;
    const savedTerm = i.car?.term || 60;
    const savedDown = i.car?.down || 0;
    const savedCarPayment = i.expenses?.car_payment || 0;
    setCarDown(savedDown);
    setCarApr(savedApr);
    setCarTerm(savedTerm);
    if (i.car?.price) {
      setCarPrice(i.car.price);
    } else if (savedCarPayment > 0) {
      setCarPrice(carPriceFromPayment(savedCarPayment, savedApr, savedTerm, savedDown));
    } else {
      setCarPrice(0);
    }
    // Restore retirement assumptions; mark touched so the Comp/Expenses mirror
    // doesn't overwrite the saved values.
    if (i.retirement && typeof i.retirement === "object") {
      retireTouched.current = true;
      setRetire({ ...RETIREMENT_DEFAULTS, ...i.retirement });
    }
    setActiveCalcId(row.id); // subsequent "Save" updates this entry
    setHistoryOpen(false);
    setTab("comp");
  };

  const deleteCalculation = async (id) => {
    try {
      await api.deleteCalculation(id);
      if (id === activeCalcId) setActiveCalcId(null);
      setHistory((h) => h.filter((r) => r.id !== id));
    } catch {
      // ignore; the row stays until the next refresh
    }
  };

  const renameCalculation = async (id, title) => {
    try {
      await api.updateCalculation(id, { title });
      setHistory((h) => h.map((r) => (r.id === id ? { ...r, title } : r)));
    } catch {
      // ignore; keeps the old title on failure
    }
  };

  const expenseColors = ["#4ade80", "#60a5fa", "#fb923c", "#f87171", "#a78bfa", "#2dd4bf"];
  const sortedStates = Object.entries(STATE_TAX_DATA).sort((a, b) => a[1].name.localeCompare(b[1].name));

  return (
    <div style={{
      "--bg": "#0d0f11", "--surface": "#161a1f", "--input-bg": "#1c2127",
      "--border": "#2a3038", "--border-light": "#1e242b",
      "--text": "#e8eaed", "--text-dim": "#7a8494",
      "--accent": "#4ade80", "--accent-dim": "#22543d",
      "--red": "#f87171", "--orange": "#fb923c",
      "--blue": "#60a5fa", "--purple": "#a78bfa", "--teal": "#2dd4bf",
      minHeight: "100vh", background: "var(--bg)", color: "var(--text)",
      fontFamily: sans, padding: isMobile ? "18px 12px" : "32px 20px", boxSizing: "border-box",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <AccountBar
          email={user?.email}
          onSaveSession={saveSession}
          onSaveToHistory={saveToHistory}
          activeTitle={history.find((h) => h.id === activeCalcId)?.title || null}
          saving={saving}
          saveMsg={saveMsg}
          onLogout={logout}
          history={history}
          historyOpen={historyOpen}
          onToggleHistory={toggleHistory}
          loadingHistory={loadingHistory}
          onLoad={applyCalculation}
          onDelete={deleteCalculation}
          onRename={renameCalculation}
        />
        <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, fontFamily: sans, lineHeight: 1.1 }}>Total Comp Calculator</h1>
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "8px 0 0", fontFamily: mono }}>Federal + state + FICA // 2025 brackets, single filer</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-dim)", fontFamily: mono }}>State</label>
            <select
              value={stateKey}
              onChange={(e) => setStateKey(e.target.value)}
              style={{
                background: "var(--input-bg)", border: "1.5px solid var(--border)",
                borderRadius: 10, color: "var(--text)", fontSize: 13, fontFamily: mono,
                fontWeight: 600, padding: "10px 36px 10px 14px", cursor: "pointer",
                outline: "none", appearance: "none", WebkitAppearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237a8494' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
                minWidth: 220,
              }}
            >
              {sortedStates.map(([key, st]) => (
                <option key={key} value={key}>{st.name} ({key})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--surface)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", width: "fit-content", maxWidth: "100%", flexWrap: "wrap" }}>
          {[{ key: "comp", label: "Compensation" }, { key: "expenses", label: "Expenses" }, { key: "summary", label: "Summary" }, { key: "retirement", label: "Retirement" }, { key: "car", label: "Car Payment" }].map((t) => (
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
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 32 }}>
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
                      {hasStateTax && <BarSegment label={stateKey + " State"} amount={calc.stateIncomeTax} total={calc.totalGross} color="#fb923c" />}
                      <BarSegment label="FICA" amount={calc.totalFica} total={calc.totalGross} color="#60a5fa" />
                      {calc.preTax401k > 0 && <BarSegment label="401(k)" amount={calc.preTax401k} total={calc.totalGross} color="#2dd4bf" />}
                      {hasSdi && <BarSegment label={sdiLabel} amount={calc.sdiTax} total={calc.totalGross} color="#a78bfa" />}
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                      {[
                        { label: "Take-Home", color: "#4ade80" },
                        { label: "Federal", color: "#f87171" },
                        ...(hasStateTax ? [{ label: stateKey + " State", color: "#fb923c" }] : []),
                        { label: "FICA", color: "#60a5fa" },
                        ...(calc.preTax401k > 0 ? [{ label: "401(k)", color: "#2dd4bf" }] : []),
                        ...(hasSdi ? [{ label: sdiLabel, color: "#a78bfa" }] : []),
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
                    {hasStateTax && <TaxRow label={stateName + " Income Tax"} amount={calc.stateIncomeTax} pct={calc.stateIncomeTax / calc.totalGross} />}
                    <TaxRow label="Social Security" amount={calc.ssTax} pct={calc.ssTax / calc.totalGross} />
                    <TaxRow label="Medicare" amount={calc.medicareTax} pct={calc.medicareTax / calc.totalGross} />
                    {hasSdi && <TaxRow label={sdiLabel} amount={calc.sdiTax} pct={calc.sdiTax / calc.totalGross} />}
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
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 32 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {EXPENSE_CATEGORIES.filter((_, i) => i % 2 === 0).map((cat) => (
                <Card key={cat.key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 18 }}>{cat.icon}</span>
                    <SectionLabel>{cat.label}</SectionLabel>
                  </div>
                  {cat.items.map((item) => (
                    <InputField key={item.key} compact label={item.label} value={expenses[item.key]}
                      onChange={(v) => onExpenseFieldChange(item.key, v)} hint={item.hint} />
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
                      onChange={(v) => onExpenseFieldChange(item.key, v)} hint={item.hint} />
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
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 32 }}>
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
                    {hasStateTax && <TaxRow label={stateName + " Income Tax"} amount={-calc.stateIncomeTax} />}
                    <TaxRow label="FICA (SS + Medicare)" amount={-calc.totalFica} />
                    {hasSdi && <TaxRow label={sdiLabel} amount={-calc.sdiTax} />}
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

        {/* ====== RETIREMENT TAB ====== */}
        {tab === "retirement" && (
          <RetirementProjection
            assumptions={retire}
            setAssumptions={setRetireAssumptions}
            k401={expenses.k401}
            roth={expenses.roth}
            onK401Change={(v) => setExpense("k401", v)}
            onRothChange={(v) => setExpense("roth", v)}
          />
        )}

        {/* ====== CAR PAYMENT TAB ====== */}
        {tab === "car" && (
          <CarPayment
            price={carPrice}
            setPrice={setCarPrice}
            down={carDown}
            setDown={setCarDown}
            apr={carApr}
            setApr={setCarApr}
            term={carTerm}
            setTerm={setCarTerm}
          />
        )}

        <div style={{ marginTop: 24, fontSize: 11, color: "var(--text-dim)", fontFamily: mono, lineHeight: 1.6, textAlign: "center", opacity: 0.6 }}>
          Estimates only. Uses 2025 federal + {stateName} brackets, single filer, standard deduction. Does not account for HSA, itemized deductions, employer match, AMT, or local income taxes.
        </div>
      </div>
    </div>
  );
}
