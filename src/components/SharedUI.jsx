// ── Shared UI primitives ──────────────────────────────────────────────────────

export function Label({ children }) {
  return (
    <div style={{ fontSize: "0.65625rem", color: "var(--text-dim,#64748b)", marginBottom: 3, letterSpacing: 0.8, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

export const btnXs = {
  background: "none", border: "none", cursor: "pointer", fontSize: "0.84375rem",
  padding: "1px 3px", fontFamily: "inherit", color: "#475569"
};

export function StatBox({ icon, label, value, color }) {
  return (
    <div style={{ background: "var(--bg-panel,#060e1d)", borderRadius: 5, padding: "7px 9px", border: "1px solid var(--border,#0f172a)", marginBottom: 5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ fontSize: "0.78125rem" }}>{icon} <span style={{ fontSize: "0.65625rem", color: "#475569" }}>{label}</span></div>
      <div style={{ fontSize: "1.15625rem", color, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export function Modal({ children, wide = false }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{
        background: "var(--modal-bg, #06101e)", border: "1px solid var(--modal-border, #1e293b)", borderRadius: 10, padding: 20,
        width: wide ? 520 : 340, fontFamily: "'IBM Plex Mono','Courier New',monospace", color: "var(--input-color,#e2e8f0)",
        maxHeight: "80vh", overflowY: "auto"
      }}>
        {children}
      </div>
    </div>
  );
}
