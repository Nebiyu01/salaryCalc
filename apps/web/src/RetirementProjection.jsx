import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { projectRetirement } from "@salary-calc/shared";
import { api } from "./api";
import { useIsMobile } from "./useIsMobile";

const mono = "'DM Mono', monospace";

// ---------- formatting ----------
function fmtFull(n) {
  if (n == null || isNaN(n)) return "$0";
  return "$" + Math.round(n).toLocaleString("en-US");
}
function fmtCompact(n) {
  if (n == null || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1e6) return "$" + (n / 1e6).toFixed(abs >= 1e7 ? 1 : 2) + "M";
  if (abs >= 1e3) return "$" + Math.round(n / 1e3) + "k";
  return "$" + Math.round(n);
}

export const DEFAULTS = {
  currentAge: 30,
  retirementAge: 65,
  current401kBalance: 0,
  currentRothBalance: 0,
  annualReturnPct: 7,
  inflationPct: 2.5,
  salary: 0,
  salaryGrowthPct: 2,
  annual401kContribution: 0,
  annualRothContribution: 0,
  employerMatchRatePct: 100,
  employerMatchLimitPct: 6,
  catchUpEnabled: true,
  escalateContributions: false,
  withdrawalRatePct: 4,
};

// ---------- small controls ----------
function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "var(--text-dim)",
        marginBottom: 14,
        fontFamily: mono,
      }}
    >
      {children}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 14,
        padding: 20,
        border: "1px solid var(--border)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function NumField({ label, value, onChange, prefix, suffix, step = 1, hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: "block",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-dim)",
          marginBottom: 5,
          fontFamily: mono,
        }}
      >
        {label}
      </label>
      <div style={{ position: "relative" }}>
        {prefix && (
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--accent)",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: mono,
              pointerEvents: "none",
            }}
          >
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode="numeric"
          value={value === 0 ? "" : value.toLocaleString("en-US")}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.]/g, "");
            onChange(raw === "" ? 0 : parseFloat(raw));
          }}
          placeholder="0"
          style={{
            width: "100%",
            padding: prefix ? "9px 12px 9px 26px" : "9px 12px",
            fontSize: 15,
            fontWeight: 600,
            fontFamily: mono,
            background: "var(--input-bg)",
            border: "1.5px solid var(--border)",
            borderRadius: 10,
            color: "var(--text)",
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
        />
        {suffix && (
          <span
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-dim)",
              fontSize: 13,
              fontFamily: mono,
              pointerEvents: "none",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: mono }}>
          {hint}
        </span>
      )}
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step, format }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <label
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-dim)",
            fontFamily: mono,
          }}
        >
          {label}
        </label>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontFamily: mono }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }}
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "8px 0",
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: mono,
      }}
    >
      <span
        style={{
          width: 34,
          height: 18,
          borderRadius: 10,
          background: checked ? "var(--accent)" : "var(--border)",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: checked ? "#0d0f11" : "var(--text-dim)",
            transition: "left 0.2s",
          }}
        />
      </span>
      <span style={{ fontSize: 12, color: "var(--text)", fontFamily: mono }}>{label}</span>
    </button>
  );
}

function PillGroup({ options, value, onChange }) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 3,
        background: "var(--input-bg)",
        borderRadius: 9,
        padding: 3,
        border: "1px solid var(--border)",
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 700,
            fontFamily: mono,
            background: value === o.value ? "var(--accent)" : "transparent",
            color: value === o.value ? "#0d0f11" : "var(--text-dim)",
            border: "none",
            borderRadius: 7,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MetricCard({ label, value, sub, color = "var(--text)" }) {
  return (
    <Card style={{ padding: 18 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--text-dim)",
          fontFamily: mono,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, fontFamily: mono, color, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: mono, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </Card>
  );
}

// ---------- animated SVG path ----------
function AnimatedPath({ d, stroke, strokeWidth = 2.5, dashed, fill }) {
  const ref = useRef(null);
  useEffect(() => {
    const path = ref.current;
    if (!path || fill) return;
    const len = path.getTotalLength();
    path.style.transition = "none";
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    // force reflow, then animate the draw
    path.getBoundingClientRect();
    path.style.transition = "stroke-dashoffset 0.9s ease-out";
    path.style.strokeDashoffset = "0";
    const t = setTimeout(() => {
      // clear so future d-updates (slider drags) move instantly, no redraw
      path.style.transition = "none";
      path.style.strokeDasharray = dashed ? "6 5" : "none";
      path.style.strokeDashoffset = "0";
    }, 950);
    return () => clearTimeout(t);
    // run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <path
      ref={ref}
      d={d}
      fill={fill || "none"}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      style={dashed ? { strokeDasharray: "6 5" } : undefined}
    />
  );
}

// ---------- growth chart ----------
function GrowthChart({ series, ages, valueKey, formatY }) {
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

  const n = ages.length;
  const allValues = series.flatMap((s) => s.points.map((p) => p[valueKey]));
  const yMax = Math.max(1, ...allValues) * 1.08;

  const xAt = (i) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const yAt = (v) => padT + (1 - v / yMax) * plotH;

  const buildLine = (points) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p[valueKey]).toFixed(1)}`).join(" ");
  const buildArea = (points) =>
    `${buildLine(points)} L ${xAt(n - 1).toFixed(1)} ${yAt(0).toFixed(1)} L ${xAt(0).toFixed(1)} ${yAt(0).toFixed(1)} Z`;

  // y gridlines
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => (yMax / ticks) * i);
  // x labels: a handful of ages
  const xLabelIdx = n <= 8 ? ages.map((_, i) => i) : [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1];

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

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", width: "100%" }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {/* gridlines + y labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={yAt(v)} x2={W - padR} y2={yAt(v)} stroke="var(--border-light)" strokeWidth="1" />
            <text x={padL - 8} y={yAt(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-dim)" fontFamily="monospace">
              {formatY(v)}
            </text>
          </g>
        ))}
        {/* x labels */}
        {xLabelIdx.map((i) => (
          <text key={i} x={xAt(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--text-dim)" fontFamily="monospace">
            {ages[i]}
          </text>
        ))}

        {/* soft area fill under any series flagged for it (e.g. Total) */}
        {series.map((s) =>
          s.area ? <path key={`${s.label}-area`} d={buildArea(s.points)} fill={s.color} opacity="0.08" /> : null,
        )}

        {/* series lines */}
        {series.map((s) => (
          <AnimatedPath
            key={s.label}
            d={buildLine(s.points)}
            stroke={s.color}
            strokeWidth={s.dashed ? 2 : 2.5}
            dashed={s.dashed}
          />
        ))}

        {/* hover guide + dots */}
        {hover != null && (
          <>
            <line x1={xAt(hover)} y1={padT} x2={xAt(hover)} y2={padT + plotH} stroke="var(--text-dim)" strokeWidth="1" strokeDasharray="3 3" />
            {series.map((s) => (
              <circle key={s.label} cx={xAt(hover)} cy={yAt(s.points[hover][valueKey])} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
            ))}
          </>
        )}
      </svg>

      {hover != null && (
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
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Age {ages[hover]}</div>
          {series.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block" }} />
              <span style={{ color: "var(--text-dim)" }}>{s.label}:</span>
              <span style={{ fontWeight: 700, color: "var(--text)" }}>{fmtFull(s.points[hover][valueKey])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The toggleable chart series. Balances are solid lines; the "your money vs.
// the market's money" series (Contributions / Gains) are dashed.
const SERIES_DEFS = [
  { key: "total", label: "Total Balance", color: "var(--accent)", dashed: false, area: true, get: (y) => y.totalBalance },
  { key: "k401", label: "401(k)", color: "var(--blue)", dashed: false, area: false, get: (y) => y.k401Balance },
  { key: "roth", label: "Roth IRA", color: "var(--teal)", dashed: false, area: false, get: (y) => y.rothBalance },
  { key: "contributions", label: "Contributions", color: "var(--purple)", dashed: true, area: false, get: (y) => y.cumulativeContributions },
  { key: "gains", label: "Investment Gains", color: "var(--orange)", dashed: true, area: false, get: (y) => y.cumulativeGains },
];

// A small line sample (solid or dashed) used inside toggles and chips.
function LineSample({ color, dashed }) {
  return (
    <svg width="20" height="6" style={{ flexShrink: 0 }}>
      <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth="2.5" strokeDasharray={dashed ? "4 3" : "none"} strokeLinecap="round" />
    </svg>
  );
}

// Square checkbox toggle to show/hide a series.
function SeriesToggle({ label, color, dashed, checked, onChange }) {
  return (
    <button
      onClick={onChange}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "6px 10px",
        background: checked ? "var(--input-bg)" : "transparent",
        border: "1px solid var(--border)",
        borderRadius: 8,
        cursor: "pointer",
        opacity: checked ? 1 : 0.5,
        transition: "opacity 0.15s",
        fontFamily: mono,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          border: `1.5px solid ${color}`,
          background: checked ? color : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {checked && <span style={{ color: "#0d0f11", fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
      </span>
      <LineSample color={color} dashed={dashed} />
      <span style={{ fontSize: 11, color: "var(--text)" }}>{label}</span>
    </button>
  );
}

function ComparisonChip({ label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "6px 10px",
        border: "1px dashed var(--border)",
        borderRadius: 8,
        fontFamily: mono,
      }}
    >
      <LineSample color="var(--red)" dashed />
      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{label}</span>
    </span>
  );
}

// ---------- main component ----------
export default function RetirementProjection({
  assumptions,
  setAssumptions,
  // 401k/Roth contributions are two-way bound to Expenses (single source of
  // truth), so they come in as props rather than living in the assumptions.
  k401,
  roth,
  onK401Change,
  onRothChange,
}) {
  const isMobile = useIsMobile();
  // Assumptions are owned by the parent so they persist across tab switches.
  const a = assumptions;
  const set = (field, value) => setAssumptions((prev) => ({ ...prev, [field]: value }));

  const [view, setView] = useState("nominal"); // nominal | real
  // Which series are drawn. Defaults show the "your money vs. market" story.
  const [visible, setVisible] = useState({
    total: true,
    k401: false,
    roth: false,
    contributions: true,
    gains: true,
  });
  const toggleSeries = (key) => setVisible((v) => ({ ...v, [key]: !v[key] }));

  // plans (saved retirement scenarios) + comparison
  const [plans, setPlans] = useState([]);
  const [comparePlanId, setComparePlanId] = useState("");
  const [planName, setPlanName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Contributions come from the shared Expenses source, not the assumptions.
  const effectiveAssumptions = {
    ...a,
    annual401kContribution: k401 || 0,
    annualRothContribution: roth || 0,
  };
  const projection = useMemo(
    () => projectRetirement(effectiveAssumptions),
    [a, k401, roth],
  );
  const comparePlan = plans.find((p) => p.id === comparePlanId);
  const compareProjection = useMemo(
    () => (comparePlan?.inputs ? projectRetirement({ ...DEFAULTS, ...comparePlan.inputs }) : null),
    [comparePlan],
  );

  const loadPlans = useCallback(async () => {
    try {
      const all = await api.listCalculations();
      setPlans(all.filter((c) => c.calculatorSlug === "retirement"));
    } catch {
      /* empty state handles it */
    }
  }, []);
  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const savePlan = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const title = planName.trim() || `Plan · retire at ${a.retirementAge}`;
      await api.createCalculation({
        calculatorSlug: "retirement",
        title,
        inputs: effectiveAssumptions, // captures the linked 401k/Roth too
        results: projection.summary,
      });
      setSaveMsg("Saved ✓");
      setPlanName("");
      await loadPlans();
      setTimeout(() => setSaveMsg(""), 2500);
    } catch (e) {
      setSaveMsg(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const loadPlan = (row) => {
    setAssumptions({ ...DEFAULTS, ...row.inputs });
    // Push the plan's contributions back to the shared Expenses source.
    if (row.inputs?.annual401kContribution != null) onK401Change(row.inputs.annual401kContribution);
    if (row.inputs?.annualRothContribution != null) onRothChange(row.inputs.annualRothContribution);
  };
  const deletePlan = async (id) => {
    try {
      await api.deleteCalculation(id);
      if (comparePlanId === id) setComparePlanId("");
      setPlans((p) => p.filter((r) => r.id !== id));
    } catch {
      /* noop */
    }
  };

  const { years, summary } = projection;
  const ages = years.map((y) => y.age);
  const formatY = (v) => fmtCompact(v);

  // Build the chart series from the toggled-on definitions. In "real" mode we
  // deflate each nominal value by the same factor as the total (realTotal/total).
  const displaySeries = useMemo(() => {
    const deflate = (y, v) => (view === "real" && y.totalBalance > 0 ? v * (y.realTotalBalance / y.totalBalance) : v);
    return SERIES_DEFS.filter((d) => visible[d.key]).map((d) => ({
      key: d.key,
      label: d.label,
      color: d.color,
      dashed: d.dashed,
      area: d.area,
      points: years.map((y) => ({ age: y.age, val: deflate(y, d.get(y)) })),
    }));
  }, [years, visible, view]);

  const chartSeries = displaySeries.map((s) => ({ ...s }));
  if (compareProjection) {
    chartSeries.push({
      label: comparePlan.title || "Comparison",
      color: "var(--red)",
      dashed: true,
      points: compareProjection.years.map((y) => ({ age: y.age, val: view === "real" ? y.realTotalBalance : y.totalBalance })),
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* summary metrics */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
        <MetricCard
          label={`Projected at ${a.retirementAge}`}
          value={fmtCompact(view === "real" ? summary.finalRealBalance : summary.finalBalance)}
          sub={view === "real" ? "today's dollars" : "nominal"}
          color="var(--accent)"
        />
        <MetricCard label="Total Contributions" value={fmtCompact(summary.totalContributions)} sub={`+ ${fmtCompact(summary.totalEmployerMatch)} match`} />
        <MetricCard label="Investment Gains" value={fmtCompact(summary.totalGains)} sub="compound growth" color="var(--blue)" />
        <MetricCard
          label="Retirement Income"
          value={fmtCompact((view === "real" ? summary.annualRetirementIncomeReal : summary.annualRetirementIncome))}
          sub={`${a.withdrawalRatePct}% rule · /yr`}
          color="var(--teal)"
        />
      </div>

      {/* chart */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <SectionLabel>Growth to Retirement</SectionLabel>
          <PillGroup
            value={view}
            onChange={setView}
            options={[
              { value: "nominal", label: "Nominal" },
              { value: "real", label: "Today's $" },
            ]}
          />
        </div>

        <GrowthChart series={chartSeries} ages={ages} valueKey="val" formatY={formatY} />

        {/* series toggles double as the legend */}
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SERIES_DEFS.map((d) => (
            <SeriesToggle
              key={d.key}
              label={d.label}
              color={d.color}
              dashed={d.dashed}
              checked={!!visible[d.key]}
              onChange={() => toggleSeries(d.key)}
            />
          ))}
          {compareProjection && <ComparisonChip label={comparePlan.title || "Comparison"} />}
        </div>
      </Card>

      {/* controls + plans */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card>
          <SectionLabel>Assumptions</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <NumField label="Current Age" value={a.currentAge} onChange={(v) => set("currentAge", v)} />
            <div />
          </div>
          <Slider label="Retirement Age" value={a.retirementAge} min={Math.max(a.currentAge + 1, 40)} max={80} step={1} onChange={(v) => set("retirementAge", v)} format={(v) => `${v}`} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <NumField label="Current 401(k)" value={a.current401kBalance} onChange={(v) => set("current401kBalance", v)} prefix="$" />
            <NumField label="Current Roth" value={a.currentRothBalance} onChange={(v) => set("currentRothBalance", v)} prefix="$" />
          </div>
          <Slider label="Annual Return" value={a.annualReturnPct} min={0} max={12} step={0.5} onChange={(v) => set("annualReturnPct", v)} format={(v) => `${v}%`} />
          <Slider label="Inflation" value={a.inflationPct} min={0} max={6} step={0.25} onChange={(v) => set("inflationPct", v)} format={(v) => `${v}%`} />
          <Slider label="Safe Withdrawal Rate" value={a.withdrawalRatePct} min={2} max={6} step={0.25} onChange={(v) => set("withdrawalRatePct", v)} format={(v) => `${v}%`} />
        </Card>

        <Card>
          <SectionLabel>Contributions & Match</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <NumField label="Salary" value={a.salary} onChange={(v) => set("salary", v)} prefix="$" />
            <NumField label="Salary Growth" value={a.salaryGrowthPct} onChange={(v) => set("salaryGrowthPct", v)} suffix="%" />
            <NumField label="401(k) / yr" value={k401 || 0} onChange={onK401Change} prefix="$" hint="max $23,500 · linked to Expenses" />
            <NumField label="Roth / yr" value={roth || 0} onChange={onRothChange} prefix="$" hint="max $7,500 · linked to Expenses" />
            <NumField label="Match Rate" value={a.employerMatchRatePct} onChange={(v) => set("employerMatchRatePct", v)} suffix="%" hint="of your contribution" />
            <NumField label="Match Limit" value={a.employerMatchLimitPct} onChange={(v) => set("employerMatchLimitPct", v)} suffix="%" hint="of salary" />
          </div>
          <div style={{ borderTop: "1px solid var(--border-light)", marginTop: 6, paddingTop: 6 }}>
            <Toggle label="Catch-up contributions (age 50+)" checked={a.catchUpEnabled} onChange={(v) => set("catchUpEnabled", v)} />
            <Toggle label="Escalate contributions with salary" checked={a.escalateContributions} onChange={(v) => set("escalateContributions", v)} />
          </div>
        </Card>
      </div>

      {/* saved plans + comparison */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <SectionLabel>Saved Plans & Comparison</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {saveMsg && <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: mono }}>{saveMsg}</span>}
            <input
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="Plan name…"
              style={{
                padding: "8px 12px",
                fontSize: 12,
                fontFamily: mono,
                background: "var(--input-bg)",
                border: "1.5px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                outline: "none",
                width: 140,
              }}
            />
            <button
              onClick={savePlan}
              disabled={saving}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: mono,
                background: "var(--accent)",
                color: "#0d0f11",
                border: "none",
                borderRadius: 8,
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? "Saving…" : "Save plan"}
            </button>
          </div>
        </div>

        {plans.length === 0 ? (
          <div style={{ padding: "12px 4px", fontSize: 12, color: "var(--text-dim)", fontFamily: mono, textAlign: "center" }}>
            No saved plans yet. Tune your assumptions and hit Save plan.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {plans.map((p) => {
              const comparing = comparePlanId === p.id;
              const finalVal = p.results?.finalBalance;
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "8px 6px",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: mono, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.title || "Untitled plan"}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: mono }}>
                      {finalVal ? `${fmtCompact(finalVal)} projected · ` : ""}
                      {new Date(p.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => setComparePlanId(comparing ? "" : p.id)}
                      style={{
                        padding: "7px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: mono,
                        background: comparing ? "var(--orange)" : "var(--input-bg)",
                        color: comparing ? "#0d0f11" : "var(--text)",
                        border: "1.5px solid var(--border)",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      {comparing ? "Comparing" : "Compare"}
                    </button>
                    <button
                      onClick={() => loadPlan(p)}
                      style={{ padding: "7px 12px", fontSize: 11, fontWeight: 700, fontFamily: mono, background: "var(--input-bg)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 8, cursor: "pointer" }}
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deletePlan(p.id)}
                      title="Delete"
                      style={{ padding: "7px 11px", fontSize: 12, fontFamily: mono, background: "transparent", color: "var(--red)", border: "1.5px solid var(--border)", borderRadius: 8, cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: mono, lineHeight: 1.6, textAlign: "center", opacity: 0.6 }}>
        Estimates only. Assumes constant returns and does not model taxes on withdrawals, RMDs, or market volatility.
      </div>
    </div>
  );
}
