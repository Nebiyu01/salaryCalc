import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { api } from "./api";

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
  const selectedTerm = TERMS.includes(term) ? term : 60;
  return { principal, perTerm, selectedTerm, selectedMonthly: perTerm[selectedTerm].monthly };
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

function NumField({ label, value, onChange, prefix, suffix, step = 1, hint }) {
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
          inputMode="decimal"
          value={value === 0 ? "" : value.toLocaleString("en-US")}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.]/g, "");
            onChange(raw === "" ? 0 : parseFloat(raw));
          }}
          placeholder="0"
          style={{ width: "100%", padding: prefix ? "9px 12px 9px 26px" : "9px 12px", fontSize: 15, fontWeight: 600, fontFamily: mono, background: "var(--input-bg)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", outline: "none", boxSizing: "border-box" }}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
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
  onSelectPayment,
}) {
  // Loan inputs are owned by the parent so they survive tab switches. We still
  // guard the first budget sync so merely opening the tab doesn't overwrite a
  // manually-entered car expense; a non-zero price counts as already touched.
  const touched = useRef((price || 0) > 0);
  const touch = (setter) => (v) => {
    touched.current = true;
    setter(v);
  };

  const [scenarios, setScenarios] = useState([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const results = useMemo(() => computeResults({ price, down, apr, term }), [price, down, apr, term]);

  // Sync the selected term's payment into the Expenses "Car Payment" field.
  // Use a ref for the callback and track the last value so this fires only on
  // a real change (never on every parent re-render -> no update loop).
  const onSelectRef = useRef(onSelectPayment);
  onSelectRef.current = onSelectPayment;
  const lastSynced = useRef(null);
  useEffect(() => {
    if (!touched.current) return;
    const v = Math.round(results.selectedMonthly);
    if (lastSynced.current === v) return;
    lastSynced.current = v;
    onSelectRef.current(v);
  }, [results.selectedMonthly]);

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
    touched.current = true;
    setPrice(i.price || 0);
    setDown(i.down || 0);
    setApr(i.apr || 0);
    setTerm(TERMS.includes(i.term) ? i.term : 60);
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
      setScenarios((s) => s.filter((r) => r.id !== id));
    } catch {
      /* noop */
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* loan inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <Card style={{ padding: 24 }}>
          <SectionLabel>Loan Details</SectionLabel>
          <NumField label="Vehicle Purchase Price" value={price} onChange={touch(setPrice)} prefix="$" />
          <NumField label="Down Payment" value={down} onChange={touch(setDown)} prefix="$" hint={`Financing ${fmt(results.principal)}`} />
          <NumField label="Interest Rate (APR)" value={apr} onChange={touch(setApr)} suffix="%" hint="Adjust to see payments update" />
          <div style={{ marginTop: 4 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", marginBottom: 6, fontFamily: mono }}>
              Loan Term (your selection)
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {TERMS.map((t) => (
                <button
                  key={t}
                  onClick={() => touch(setTerm)(t)}
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
