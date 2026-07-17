// Account toolbar shown above the calculator when signed in. Presentational:
// all data + handlers come from main.jsx, which owns the calculator state.
// Rendered inside the themed container, so it can use the --* CSS variables.

import { useState } from "react";

const mono = "'DM Mono', monospace";

function BarButton({ onClick, disabled, primary, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 16px",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: mono,
        background: primary ? "var(--accent)" : "var(--input-bg)",
        color: primary ? "#0d0f11" : "var(--text)",
        border: primary ? "none" : "1.5px solid var(--border)",
        borderRadius: 8,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function fmtMoney(n) {
  if (typeof n !== "number" || isNaN(n)) return null;
  return "$" + Math.round(n).toLocaleString("en-US");
}

export default function AccountBar({
  email,
  onSaveSession,
  onSaveToHistory,
  activeTitle,
  saving,
  saveMsg,
  onLogout,
  history,
  historyOpen,
  onToggleHistory,
  loadingHistory,
  onLoad,
  onDelete,
  onRename,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const startRename = (row) => {
    setEditingId(row.id);
    setDraft(row.title || "");
  };
  const commitRename = () => {
    if (editingId) onRename(editingId, draft.trim() || "Untitled");
    setEditingId(null);
  };
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "10px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--accent-dim)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: mono,
            }}
          >
            {email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: mono }}>
              {email}
            </span>
            {activeTitle && (
              <span style={{ fontSize: 10, color: "var(--accent)", fontFamily: mono }}>
                editing: {activeTitle}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {saveMsg && (
            <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: mono }}>
              {saveMsg}
            </span>
          )}
          <BarButton onClick={onSaveSession} disabled={saving} primary>
            {saving ? "Saving…" : "Save"}
          </BarButton>
          <BarButton onClick={onSaveToHistory} disabled={saving}>
            Save to history
          </BarButton>
          <BarButton onClick={onToggleHistory}>
            History{history?.length ? ` (${history.length})` : ""}
          </BarButton>
          <BarButton onClick={onLogout}>Log out</BarButton>
        </div>
      </div>

      {historyOpen && (
        <div
          style={{
            marginTop: 8,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {loadingHistory ? (
            <Empty text="Loading…" />
          ) : !history?.length ? (
            <Empty text="No saved calculations yet. Enter your numbers and hit Save." />
          ) : (
            history.map((row) => {
              const net = fmtMoney(row.results?.netIncome);
              const date = new Date(row.updatedAt || row.createdAt).toLocaleString();
              return (
                <div
                  key={row.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 8px",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  {editingId === row.id ? (
                    <>
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: "8px 12px",
                          fontSize: 13,
                          fontFamily: mono,
                          background: "var(--input-bg)",
                          border: "1.5px solid var(--accent)",
                          borderRadius: 8,
                          color: "var(--text)",
                          outline: "none",
                        }}
                      />
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <BarButton onClick={commitRename} primary>Save</BarButton>
                        <BarButton onClick={() => setEditingId(null)}>Cancel</BarButton>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            fontFamily: mono,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {row.title || "Untitled"}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: mono }}>
                          {net ? `${net} take-home · ` : ""}
                          {date}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <BarButton onClick={() => onLoad(row)}>Load</BarButton>
                        <BarButton onClick={() => startRename(row)}>Rename</BarButton>
                        <button
                          onClick={() => onDelete(row.id)}
                          title="Delete"
                          style={{
                            padding: "8px 12px",
                            fontSize: 12,
                            fontFamily: mono,
                            background: "transparent",
                            color: "var(--red)",
                            border: "1.5px solid var(--border)",
                            borderRadius: 8,
                            cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div
      style={{
        padding: "16px 8px",
        fontSize: 12,
        color: "var(--text-dim)",
        fontFamily: mono,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}
