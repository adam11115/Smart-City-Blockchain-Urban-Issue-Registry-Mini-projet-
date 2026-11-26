import { useState } from "react";
import * as XLSX from "xlsx";
import { send, PRIORITY, STATUS, readableError } from "./chain";

const REQUIRED = ["issueId", "issueType", "location", "description", "reportDate", "priority", "reportedBy"];
const BATCH = 10;

function validate(r, seen) {
  for (const f of REQUIRED) if (!String(r[f] ?? "").trim()) return `Missing ${f}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.reportDate)) return "reportDate must be YYYY-MM-DD";
  if (!PRIORITY.includes(r.priority)) return `priority must be ${PRIORITY.join("/")}`;
  if (r.status && !STATUS.includes(r.status)) return "Unknown status";
  if (seen.has(r.issueId)) return "Duplicate issueId in file";
  return null;
}

const toInput = (r) => ({
  issueId: r.issueId, issueType: r.issueType, location: r.location, description: r.description,
  reportDate: r.reportDate, priority: PRIORITY.indexOf(r.priority), reportedBy: r.reportedBy,
});

export default function ImportExcel({ account, isMunicipal }) {
  const [rows, setRows] = useState([]);
  const [hashes, setHashes] = useState([]);
  const [msg, setMsg] = useState(null);

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setMsg(null); setHashes([]);
    const wb = XLSX.read(await file.arrayBuffer());
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: "" });
    const seen = new Set();
    setRows(data.map((d) => {
      const r = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v).trim()]));
      const error = validate(r, seen);
      if (!error) seen.add(r.issueId);
      return { data: r, error, selected: !error };
    }));
  }

  async function importSelected() {
    setMsg(null); setHashes([]);
    if (!account) return setMsg({ err: "Connect your wallet first." });
    const chosen = rows.filter((r) => r.selected && !r.error).map((r) => toInput(r.data));
    if (chosen.length === 0) return setMsg({ err: "No valid row selected." });
    try {
      const done = [];
      for (let i = 0; i < chosen.length; i += BATCH) {
        const { hash } = await send(account, "createIssues", [chosen.slice(i, i + BATCH)]);
        done.push(hash); setHashes([...done]);
      }
      setMsg({ ok: `${chosen.length} issues recorded on the blockchain.` });
    } catch (e) { setMsg({ err: readableError(e) }); }
  }

  const count = rows.filter((r) => r.selected).length;
  return (
    <section>
      <h2>Excel / CSV import</h2>
      {!isMunicipal && <p style={{ color: "crimson" }}>Only municipal staff can import issues.</p>}
      <input type="file" accept=".xlsx,.csv" onChange={onFile} />
      <p><small>Imported issues start with status "Reported". The assignedTo and status columns are only checked here; assign teams afterwards in the Municipality tab.</small></p>
      {rows.length > 0 && (
        <>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr><th></th><th>issueId</th><th>type</th><th>location</th><th>description</th><th>date</th><th>priority</th><th>by</th><th>check</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ background: r.error ? "#fdd" : undefined }}>
                  <td><input type="checkbox" checked={r.selected} disabled={!!r.error}
                    onChange={() => setRows(rows.map((x, j) => (j === i ? { ...x, selected: !x.selected } : x)))} /></td>
                  <td>{r.data.issueId}</td><td>{r.data.issueType}</td><td>{r.data.location}</td><td>{r.data.description}</td>
                  <td>{r.data.reportDate}</td><td>{r.data.priority}</td><td>{r.data.reportedBy}</td><td>{r.error || "OK"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button disabled={!isMunicipal} onClick={importSelected}>Record selected ({count})</button>
        </>
      )}
      {hashes.map((h) => <p key={h}>Tx: <code>{h}</code></p>)}
      {msg?.ok && <p style={{ color: "green" }}>{msg.ok}</p>}
      {msg?.err && <p style={{ color: "crimson" }}>{msg.err}</p>}
    </section>
  );
}