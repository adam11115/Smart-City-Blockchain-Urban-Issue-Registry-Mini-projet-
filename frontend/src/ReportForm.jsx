import { useState } from "react";
import { read, send, PRIORITY, readableError } from "./chain";

const TYPES = ["StreetLight", "Pothole", "Waste", "WaterLeak", "Other"];

export default function ReportForm({ account }) {
  const [f, setF] = useState({ issueType: "StreetLight", location: "", description: "", priority: "Medium", reportedBy: "Citizen01" });
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    setMsg(null);
    if (!account) return setMsg({ err: "Connect your wallet first." });
    if (!f.location.trim() || !f.description.trim()) return setMsg({ err: "Location and description are required." });
    try {
      const count = Number(await read("issueCount"));
      const issueId = `CITY-2026-${String(count + 1).padStart(3, "0")}`;
      const input = {
        issueId,
        issueType: f.issueType,
        location: f.location.trim(),
        description: f.description.trim(),
        reportDate: new Date().toISOString().slice(0, 10),
        priority: PRIORITY.indexOf(f.priority),
        reportedBy: f.reportedBy.trim() || "Citizen",
      };
      const { hash } = await send(account, "createIssue", [input]);
      setMsg({ ok: `Issue ${issueId} reported (tx ${hash})` });
    } catch (e) { setMsg({ err: readableError(e) }); }
  }

  const box = { display: "block", margin: "6px 0", width: 320 };
  return (
    <section>
      <h2>Report an issue</h2>
      <select style={box} value={f.issueType} onChange={set("issueType")}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      <input style={box} placeholder="Location" value={f.location} onChange={set("location")} />
      <input style={box} placeholder="Description" value={f.description} onChange={set("description")} />
      <select style={box} value={f.priority} onChange={set("priority")}>{PRIORITY.map((p) => <option key={p}>{p}</option>)}</select>
      <input style={box} placeholder="Pseudonym (no personal data)" value={f.reportedBy} onChange={set("reportedBy")} />
      <button onClick={submit}>Submit report</button>
      {msg?.ok && <p style={{ color: "green" }}>{msg.ok}</p>}
      {msg?.err && <p style={{ color: "crimson" }}>{msg.err}</p>}
    </section>
  );
}