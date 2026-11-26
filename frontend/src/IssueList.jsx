import { useEffect, useState } from "react";
import { read, STATUS, PRIORITY, readableError } from "./chain";

export default function IssueList() {
  const [issues, setIssues] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true); setErr("");
    try {
      const count = Number(await read("issueCount"));
      const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));
      const list = await Promise.all(ids.map(async (id) => ({ id, ...(await read("getIssue", [id])) })));
      setIssues(list.reverse());
    } catch (e) { setErr(readableError(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function showHistory(id) {
    setSelected(id); setErr("");
    try { setHistory(await read("getHistory", [id])); }
    catch (e) { setErr(readableError(e)); }
  }

  return (
    <section>
      <h2>Issues <button onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button></h2>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr><th>#</th><th>Issue ID</th><th>Type</th><th>Location</th><th>Priority</th><th>Status</th><th>Team</th><th></th></tr></thead>
        <tbody>
          {issues.map((i) => (
            <tr key={String(i.id)}>
              <td>{String(i.id)}</td><td>{i.issueId}</td><td>{i.issueType}</td><td>{i.location}</td>
              <td>{PRIORITY[i.priority]}</td><td><b>{STATUS[i.status]}</b></td><td>{i.assignedTo || "-"}</td>
              <td><button onClick={() => showHistory(i.id)}>History</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {issues.length === 0 && !loading && <p>No issues yet.</p>}

      {selected && (
        <div style={{ marginTop: 20 }}>
          <h3>History of issue #{String(selected)}</h3>
          <ol>
            {history.map((h, k) => (
              <li key={k}>
                {new Date(Number(h.timestamp) * 1000).toLocaleString()} · <b>{STATUS[h.status]}</b>
                {h.team && ` · team ${h.team}`}{h.comment && ` · "${h.comment}"`}
                <br /><small>by {h.actor}</small>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}