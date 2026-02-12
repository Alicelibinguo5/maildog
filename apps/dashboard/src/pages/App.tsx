import React, { useEffect, useMemo, useState } from "react";

const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL ?? "http://localhost:3000";

type Summary = {
  since: string;
  messagesByStatus: Record<string, number>;
  eventsByType: Record<string, number>;
};

export function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem("md_api_key") ?? "");
  const [summary, setSummary] = useState<Summary | null>(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${apiKey}` }), [apiKey]);

  useEffect(() => {
    localStorage.setItem("md_api_key", apiKey);
  }, [apiKey]);

  async function load() {
    const res = await fetch(`${API_BASE_URL}/v1/analytics/summary`, { headers });
    if (!res.ok) {
      setSummary(null);
      return;
    }
    setSummary(await res.json());
  }

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1>MailDog</h1>
      <p style={{ color: "#555" }}>Minimal dashboard (MVP). Paste an API key (Bearer) to view analytics.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          style={{ flex: 1, padding: 10 }}
          placeholder="md_..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <button style={{ padding: "10px 14px" }} onClick={load}>
          Refresh
        </button>
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Summary</h2>
        {!summary ? (
          <p style={{ color: "#b00" }}>No data (or invalid API key). Try /v1/public/dev/seed.</p>
        ) : (
          <>
            <div style={{ color: "#666", marginBottom: 8 }}>Since: {new Date(summary.since).toLocaleString()}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <h3>Messages by status</h3>
                <pre>{JSON.stringify(summary.messagesByStatus, null, 2)}</pre>
              </div>
              <div>
                <h3>Events by type</h3>
                <pre>{JSON.stringify(summary.eventsByType, null, 2)}</pre>
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 24, color: "#666" }}>
        <p>
          Docs: <a href="http://localhost:3000/docs" target="_blank" rel="noreferrer">http://localhost:3000/docs</a>
          {" · "}
          MailHog: <a href="http://localhost:8025" target="_blank" rel="noreferrer">http://localhost:8025</a>
        </p>
      </div>
    </div>
  );
}
