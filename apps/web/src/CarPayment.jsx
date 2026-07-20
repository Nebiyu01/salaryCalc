import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { api } from "./api";
import { useIsMobile } from "./useIsMobile";

const mono = "'DM Mono', monospace";
const TERMS = [48, 60, 72];

// ---------- formatting ----------
function fmt(n) {
  if (n == null || isNaN(n)) return "$0";
  return "$" + Math.round(n).toLocaleString("en-US");
}

// Standard amortized loan payment. principal financed over `months` at `apr`.
function monthlyPayment(principal, apr, months) {
  if (principal <= 0 || months <= 0) return 0;
  const r = apr / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

function computeResults({ price, down, apr, term }) {
  const principal = Math.max(0, (price || 0) - (down || 0));
  const perTerm = {};
  for (const t of TERMS) {
    const monthly = monthlyPayment(principal, apr || 0, t);
    perTerm[t] = {
      monthly,
      totalPaid: monthly * t,
      totalInterest: monthly * t - principal,
    };
  }
  // The selection can be one of the presets or any custom term the user types.
  const selectedTerm = term > 0 ? term : 60;
  return { principal, perTerm, selectedTerm, selectedMonthly: monthlyPayment(principal, apr || 0, selectedTerm) };
}

function fmtK(n) {
  if (n == null || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1000) return "$" + Math.round(n / 1000) + "K";
  return "$" + Math.round(n);
}

// Month-by-month amortization for the chart: remaining balance and the
// running totals of principal and interest paid.
function amortizationSchedule({ price, down, apr, term }) {
  const principal = Math.max(0, (price || 0) - (down || 0));
  const n = term > 0 ? term : 60;
  const r = (apr || 0) / 100 / 12;
  const payment = monthlyPayment(principal, apr || 0, n);
  const points = [{ month: 0, balance: principal, principalPaid: 0, interestPaid: 0, totalPaid: 0 }];
  let bal = principal;
  let cumP = 0;
  let cumI = 0;
  for (let m = 1; m <= n; m++) {
    const interest = bal * r;
    let princ = payment - interest;
    if (princ > bal) princ = bal; // final payment trims to the remaining balance
    bal = Math.max(0, bal - princ);
    cumP += princ;
    cumI += interest;
    points.push({ month: m, balance: bal, principalPaid: cumP, interestPaid: cumI, totalPaid: cumP + cumI });
  }
  return points;
}

// The three amortization lines. Matches the Retirement chart's palette/style.
const AMORT_SERIES = [
  { key: "balance", label: "Remaining Balance", color: "var(--accent)", area: true },
  { key: "principalPaid", label: "Principal Paid", color: "var(--blue)", area: false },
  { key: "interestPaid", label: "Interest Paid", color: "var(--orange)", area: false },
];

// ---------- animated SVG path (same as the Retirement chart) ----------
function AnimatedPath({ d, stroke, strokeWidth = 2.5, fill }) {
  const ref = useRef(null);
  useEffect(() => {
    const path = ref.current;
    if (!path || fill) return;
    const len = path.getTotalLength();
    path.style.transition = "none";
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    path.getBoundingClientRect(); // force reflow, then animate the draw
    path.style.transition = "stroke-dashoffset 0.9s ease-out";
    path.style.strokeDashoffset = "0";
    const t = setTimeout(() => {
      path.style.transition = "none";
      path.style.strokeDasharray = "none";
      path.style.strokeDashoffset = "0";
    }, 950);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <path ref={ref} d={d} fill={fill || "none"} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
  );
}

function LineSample({ color }) {
  return (
    <svg width="20" height="6" style={{ flexShrink: 0 }}>
      <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ---------- amortization chart ----------
function AmortizationChart({ points }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);

  const W = 900;
  const H = 320;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const n = points.length;
  const allValues = AMORT_SERIES.flatMap((s) => points.map((p) => p[s.key]));
  const yMax = Math.max(1, ...allValues) * 1.08;

  const xAt = (i) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const yAt = (v) => padT + (1 - v / yMax) * plotH;

  const buildLine = (key) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p[key]).toFixed(1)}`).join(" ");
  const buildArea = (key) =>
    `${buildLine(key)} L ${xAt(n - 1).toFixed(1)} ${yAt(0).toFixed(1)} L ${xAt(0).toFixed(1)} ${yAt(0).toFixed(1)} Z`;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => (yMax / ticks) * i);
  const xLabelIdx = n <= 8 ? points.map((_, i) => i) : [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1];

  const onMove = useCallback(
    (e) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const relX = ((e.clientX - rect.left) / rect.width) * W;
      const i = Math.round(((relX - padL) / plotW) * (n - 1));
      if (i >= 0 && i < n) setHover(i);
      else setHover(null);
    },
    [n, plotW],
  );

  const hp = hover != null ? points[hover] : null;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={yAt(v)} x2={W - padR} y2={yAt(v)} stroke="var(--border-light)" strokeWidth="1" />
            <text x={padL - 8} y={yAt(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-dim)" fontFamily="monospace">
              {fmtK(v)}
            </text>
          </g>
        ))}
        {xLabelIdx.map((i) => (
          <text key={i} x={xAt(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--text-dim)" fontFamily="monospace">
            {points[i].month}
          </text>
        ))}

        {AMORT_SERIES.map((s) =>
          s.area ? <path key={`${s.key}-area`} d={buildArea(s.key)} fill={s.color} opacity="0.08" /> : null,
        )}

        {AMORT_SERIES.map((s) => (
          <AnimatedPath key={s.key} d={buildLine(s.key)} stroke={s.color} strokeWidth={2.5} />
        ))}

        {hover != null && (
          <>
            <line x1={xAt(hover)} y1={padT} x2={xAt(hover)} y2={padT + plotH} stroke="var(--text-dim)" strokeWidth="1" strokeDasharray="3 3" />
            {AMORT_SERIES.map((s) => (
              <circle key={s.key} cx={xAt(hover)} cy={yAt(points[hover][s.key])} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
            ))}
          </>
        )}
      </svg>

      {hp && (
        <div
          style={{
            position: "absolute",
            left: `calc(${(xAt(hover) / W) * 100}% + ${xAt(hover) < W / 2 ? 12 : -12}px)`,
            transform: xAt(hover) < W / 2 ? "translateX(0)" : "translateX(-100%)",
            top: 8,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "8px 12px",
            pointerEvents: "none",
            fontFamily: mono,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Month {hp.month}</div>
          {AMORT_SERIES.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block" }} />
              <span style={{ color: "var(--text-dim)" }}>{s.label}:</span>
              <span style={{ fontWeight: 700, color: "var(--text)" }}>{fmt(s.key === "balance" ? hp.balance : hp[s.key])}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 3, paddingTop: 3, borderTop: "1px solid var(--border-light)" }}>
            <span style={{ width: 8, height: 8, display: "inline-block" }} />
            <span style={{ color: "var(--text-dim)" }}>Total Paid:</span>
            <span style={{ fontWeight: 700, color: "var(--text)" }}>{fmt(hp.totalPaid)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- shared bits ----------
function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-dim)", marginBottom: 14, fontFamily: mono }}>
      {children}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 14, padding: 20, border: "1px solid var(--border)", ...style }}>
      {children}
    </div>
  );
}

// `decimal` fields (e.g. APR) accept fractional input like "6.75". They keep a
// local string so an in-progress "6." isn't reformatted away before you can
// type the rest. Currency fields keep thousands separators.
function NumField({ label, value, onChange, prefix, suffix, decimal, hint }) {
  const fmtVal = (v) => {
    if (!v || isNaN(v)) return "";
    return decimal ? String(v) : v.toLocaleString("en-US");
  };
  const [raw, setRaw] = useState(() => fmtVal(value));
  const [focused, setFocused] = useState(false);

  // Reflect external value changes (scenario load, etc.) while not typing.
  useEffect(() => {
    if (!focused) setRaw(fmtVal(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused, decimal]);

  const handleChange = (e) => {
    if (decimal) {
      let s = e.target.value.replace(/[^0-9.]/g, "");
      const dot = s.indexOf(".");
      if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
      setRaw(s);
      const n = s === "" || s === "." ? 0 : parseFloat(s);
      onChange(isNaN(n) ? 0 : n);
    } else {
      const digits = e.target.value.replace(/[^0-9]/g, "");
      const n = digits === "" ? 0 : parseInt(digits, 10);
      setRaw(n === 0 ? "" : n.toLocaleString("en-US"));
      onChange(n);
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 5, fontFamily: mono }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        {prefix && (
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--accent)", fontSize: 14, fontWeight: 700, fontFamily: mono, pointerEvents: "none" }}>
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode={decimal ? "decimal" : "numeric"}
          value={raw}
          onChange={handleChange}
          placeholder="0"
          style={{ width: "100%", padding: prefix ? "9px 12px 9px 26px" : "9px 12px", fontSize: 15, fontWeight: 600, fontFamily: mono, background: "var(--input-bg)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", outline: "none", boxSizing: "border-box" }}
          onFocus={(e) => {
            setFocused(true);
            e.target.style.borderColor = "var(--accent)";
          }}
          onBlur={(e) => {
            setFocused(false);
            setRaw(fmtVal(value));
            e.target.style.borderColor = "var(--border)";
          }}
        />
        {suffix && (
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", fontSize: 13, fontFamily: mono, pointerEvents: "none" }}>
            {suffix}
          </span>
        )}
      </div>
      {hint && <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: mono }}>{hint}</span>}
    </div>
  );
}

// Manual loan-term entry. Keeps a local string so an in-progress/cleared value
// isn't reformatted away while typing; commits an integer month count upward.
function TermInput({ term, setTerm }) {
  const [raw, setRaw] = useState(() => (term > 0 ? String(term) : ""));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setRaw(term > 0 ? String(term) : "");
  }, [term, focused]);

  const handleChange = (e) => {
    const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
    setRaw(digits);
    setTerm(digits === "" ? 0 : parseInt(digits, 10));
  };

  const isCustom = term > 0 && !TERMS.includes(term);

  return (
    <div style={{ position: "relative", marginTop: 8 }}>
      <input
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={handleChange}
        placeholder="Custom term"
        style={{
          width: "100%",
          padding: "9px 52px 9px 12px",
          fontSize: 14,
          fontWeight: 700,
          fontFamily: mono,
          background: "var(--input-bg)",
          border: isCustom ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
          borderRadius: 8,
          color: "var(--text)",
          outline: "none",
          boxSizing: "border-box",
        }}
        onFocus={(e) => {
          setFocused(true);
          e.target.style.borderColor = "var(--accent)";
        }}
        onBlur={(e) => {
          setFocused(false);
          setRaw(term > 0 ? String(term) : "");
          e.target.style.borderColor = isCustom ? "var(--accent)" : "var(--border)";
        }}
      />
      <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", fontSize: 13, fontFamily: mono, pointerEvents: "none" }}>
        months
      </span>
    </div>
  );
}

function SmallBtn({ onClick, children, active, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 12px",
        fontSize: 11,
        fontWeight: 700,
        fontFamily: mono,
        background: active ? "var(--accent)" : danger ? "transparent" : "var(--input-bg)",
        color: active ? "#0d0f11" : danger ? "var(--red)" : "var(--text)",
        border: "1.5px solid var(--border)",
        borderRadius: 8,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ---------- main component ----------
export default function CarPayment({
  price,
  setPrice,
  down,
  setDown,
  apr,
  setApr,
  term,
  setTerm,
}) {
  const isMobile = useIsMobile();
  // Loan inputs are owned by the parent, which also keeps the Expenses > Car
  // Payment field in sync (two-way), so this component just reads/writes them.

  const [scenarios, setScenarios] = useState([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  // Which loan the amortization chart shows: the current inputs, or a saved
  // scenario by id.
  const [chartSource, setChartSource] = useState("current");

  const results = useMemo(() => computeResults({ price, down, apr, term }), [price, down, apr, term]);

  // Inputs driving the chart, and its month-by-month schedule.
  const chartScenario = chartSource === "current" ? null : scenarios.find((s) => s.id === chartSource);
  const chartInputs = chartScenario?.inputs || { price, down, apr, term };
  const schedule = useMemo(
    () => amortizationSchedule(chartInputs),
    [chartInputs.price, chartInputs.down, chartInputs.apr, chartInputs.term],
  );

  const loadScenarios = useCallback(async () => {
    try {
      const all = await api.listCalculations();
      setScenarios(all.filter((c) => c.calculatorSlug === "car"));
    } catch {
      /* empty state handles it */
    }
  }, []);
  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  const resetEdit = () => {
    setEditingId(null);
    setName("");
  };

  const currentPayload = (overrideName) => ({
    calculatorSlug: "car",
    title: (overrideName ?? name).trim() || `${fmt(price)} @ ${apr}% · ${term}mo`,
    inputs: { price, down, apr, term },
    results: {
      selectedTerm: results.selectedTerm,
      selectedMonthly: results.selectedMonthly,
      m48: results.perTerm[48].monthly,
      m60: results.perTerm[60].monthly,
      m72: results.perTerm[72].monthly,
    },
  });

  const saveScenario = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      if (editingId) {
        await api.updateCalculation(editingId, currentPayload());
        setSaveMsg("Updated ✓");
      } else {
        await api.createCalculation(currentPayload());
        setSaveMsg("Saved ✓");
      }
      resetEdit();
      await loadScenarios();
      setTimeout(() => setSaveMsg(""), 2500);
    } catch (e) {
      setSaveMsg(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const applyInputs = (row) => {
    const i = row.inputs || {};
    setPrice(i.price || 0);
    setDown(i.down || 0);
    setApr(i.apr || 0);
    setTerm(i.term > 0 ? i.term : 60);
  };

  const loadScenario = (row) => {
    applyInputs(row);
    resetEdit();
  };
  const editScenario = (row) => {
    applyInputs(row);
    setEditingId(row.id);
    setName(row.title || "");
  };
  const duplicateScenario = async (row) => {
    try {
      await api.createCalculation({
        calculatorSlug: "car",
        title: `${row.title || "Scenario"} (copy)`,
        inputs: row.inputs,
        results: computeResultsFlat(row.inputs),
      });
      await loadScenarios();
    } catch {
      /* noop */
    }
  };
  const removeScenario = async (id) => {
    try {
      await api.deleteCalculation(id);
      if (editingId === id) resetEdit();
      if (chartSource === id) setChartSource("current");
      setScenarios((s) => s.filter((r) => r.id !== id));
    } catch {
      /* noop */
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* loan inputs */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 32 }}>
        <Card style={{ padding: 24 }}>
          <SectionLabel>Loan Details</SectionLabel>
          <NumField label="Vehicle Purchase Price" value={price} onChange={setPrice} prefix="$" />
          <NumField label="Down Payment" value={down} onChange={setDown} prefix="$" hint={`Financing ${fmt(results.principal)}`} />
          <NumField label="Interest Rate (APR)" value={apr} onChange={setApr} suffix="%" decimal hint="Adjust to see payments update" />
          <div style={{ marginTop: 4 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 6, fontFamily: mono }}>
              Loan Term (your selection)
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {TERMS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTerm(t)}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: mono,
                    background: term === t ? "var(--accent)" : "var(--input-bg)",
                    color: term === t ? "#0d0f11" : "var(--text-dim)",
                    border: term === t ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  {t}mo
                </button>
              ))}
            </div>
            <TermInput term={term} setTerm={setTerm} />
            <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: mono }}>
              Pick a preset or type any number of months
            </span>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {TERMS.map((t) => {
            const r = results.perTerm[t];
            const selected = t === term;
            return (
              <Card
                key={t}
                style={{
                  padding: 18,
                  border: selected ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                  background: selected ? "linear-gradient(135deg, var(--surface) 0%, rgba(74,222,128,0.06) 100%)" : "var(--surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: selected ? "var(--accent)" : "var(--text-dim)", fontFamily: mono }}>
                      {t} months{selected ? " · selected" : ""}
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 800, fontFamily: mono, color: selected ? "var(--accent)" : "var(--text)", lineHeight: 1.2 }}>
                      {fmt(r.monthly)}<span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 500 }}>/mo</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontFamily: mono }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Total interest</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--orange)" }}>{fmt(r.totalInterest)}</div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>{fmt(r.totalPaid)} total</div>
                  </div>
                </div>
              </Card>
            );
          })}

          {/* Custom term: mirrors the preset cards but for whatever month count
              the user typed. Only shows when the selection isn't a preset. */}
          {term > 0 && !TERMS.includes(term) && (
            <Card
              style={{
                padding: 18,
                border: "1.5px solid var(--accent)",
                background: "linear-gradient(135deg, var(--surface) 0%, rgba(74,222,128,0.06) 100%)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", fontFamily: mono }}>
                    {term} months · custom
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 800, fontFamily: mono, color: "var(--accent)", lineHeight: 1.2 }}>
                    {fmt(results.selectedMonthly)}<span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 500 }}>/mo</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", fontFamily: mono }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Total interest</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--orange)" }}>
                    {fmt(results.selectedMonthly * term - results.principal)}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>{fmt(results.selectedMonthly * term)} total</div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* budget integration note */}
      <Card style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "var(--accent)", fontSize: 16 }}>✓</span>
        <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: mono }}>
          Your selected {term}-month payment of{" "}
          <span style={{ color: "var(--text)", fontWeight: 700 }}>{fmt(results.selectedMonthly)}/mo</span>{" "}
          is added to <span style={{ color: "var(--text)" }}>Expenses → Car Payment</span> and your monthly budget.
        </span>
      </Card>

      {/* amortization chart */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <SectionLabel>Amortization Schedule</SectionLabel>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <SmallBtn onClick={() => setChartSource("current")} active={chartSource === "current"}>Current loan</SmallBtn>
            {scenarios.map((s) => (
              <SmallBtn key={s.id} onClick={() => setChartSource(s.id)} active={chartSource === s.id}>
                {s.title || "Scenario"}
              </SmallBtn>
            ))}
          </div>
        </div>

        <AmortizationChart points={schedule} />

        <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
          {AMORT_SERIES.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <LineSample color={s.color} />
              <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: mono }}>{s.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* scenarios */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <SectionLabel>{editingId ? "Editing Scenario" : "Comparison Scenarios"}</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {saveMsg && <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: mono }}>{saveMsg}</span>}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Scenario name…"
              style={{ padding: "8px 12px", fontSize: 12, fontFamily: mono, background: "var(--input-bg)", border: "1.5px solid var(--border)", borderRadius: 8, color: "var(--text)", outline: "none", width: 150 }}
            />
            <SmallBtn onClick={saveScenario} active>
              {saving ? "Saving…" : editingId ? "Update" : "Save scenario"}
            </SmallBtn>
            {editingId && <SmallBtn onClick={resetEdit}>Cancel</SmallBtn>}
          </div>
        </div>

        {scenarios.length === 0 ? (
          <div style={{ padding: "12px 4px", fontSize: 12, color: "var(--text-dim)", fontFamily: mono, textAlign: "center" }}>
            No scenarios yet. Enter a loan and hit Save scenario to compare options.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {scenarios.map((s) => {
              const editing = editingId === s.id;
              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "8px 6px",
                    borderBottom: "1px solid var(--border-light)",
                    background: editing ? "rgba(74,222,128,0.05)" : "transparent",
                    borderRadius: 6,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: mono, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.title || "Untitled"}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: mono }}>
                      {fmt(s.inputs?.price)} · {s.inputs?.apr}% ·{" "}
                      {s.results?.selectedMonthly ? `${fmt(s.results.selectedMonthly)}/mo @ ${s.results.selectedTerm}mo` : `${s.inputs?.term}mo`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <SmallBtn onClick={() => loadScenario(s)}>Load</SmallBtn>
                    <SmallBtn onClick={() => editScenario(s)} active={editing}>Edit</SmallBtn>
                    <SmallBtn onClick={() => duplicateScenario(s)}>Duplicate</SmallBtn>
                    <SmallBtn onClick={() => removeScenario(s.id)} danger>✕</SmallBtn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: mono, lineHeight: 1.6, textAlign: "center", opacity: 0.6 }}>
        Estimates only. Assumes a fixed APR and standard amortization; excludes taxes, fees, and insurance.
      </div>
    </div>
  );
}

// Flat results shape for saved rows (used by Duplicate).
function computeResultsFlat(inputs) {
  const r = computeResults(inputs || {});
  return {
    selectedTerm: r.selectedTerm,
    selectedMonthly: r.selectedMonthly,
    m48: r.perTerm[48].monthly,
    m60: r.perTerm[60].monthly,
    m72: r.perTerm[72].monthly,
  };
}
