import { useState } from "react";

const providers = ["openrouter", "claude", "ollama"];

export default function AIControl() {
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("openrouter");
  const [model, setModel] = useState("");

  return (
    <main style={{ padding: 24 }}>
      <h2>AI Control Panel</h2>
      <label>API Key</label>
      <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={{ display: "block", width: 360 }} />

      <label>Provider</label>
      <select value={provider} onChange={(e) => setProvider(e.target.value)}>
        {providers.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <label>Model</label>
      <input value={model} onChange={(e) => setModel(e.target.value)} style={{ display: "block", width: 240 }} />
      <p>Failover Priority: OpenRouter → Claude → Ollama</p>
    </main>
  );
}
