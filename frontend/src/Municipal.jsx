import { useState } from "react";
import { send, STATUS, readableError } from "./chain";

export default function Municipal({ account, isMunicipal }) {
  const [id, setId] = useState("");
  const [team, setTeam] = useState("UrbanTeam01");
  const [status, setStatus] = useState(2);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState(null);

  async function run(fn, args, okText) {
    setMsg(null);
    if (!account) return setMsg({ err: "Connect your wallet first." });
    if (!id) return setMsg({ err: "Enter an issue number." });
    try {
      const { hash } = await send(account, fn, args);
      setMsg({ ok: `${okText} (tx ${hash})` });
    } catch (e) { setMsg({ err: readableError(e) }); }
  }

  const box = { display: "block", margin: "6px 0", width: 320 };
  return (
    <section>
      <h2>Municipality</h2>
      {!isMunicipal && <p style={{ color: "crimson" }}>Your account does not have the municipal role: actions are disabled.</p>}
      <input style={box} placeholder="Issue number (#)" value={id} onChange={(e) => setId(e.target.value)} />
      <input style={box} placeholder="Comment" value={comment} onChange={(e) => setComment(e.target.value)} />

      <h3>Assign a team</h3>
      <input style={box} placeholder="Team" value={team} onChange={(e) => setTeam(e.target.value)} />
      <button disabled={!isMunicipal} onClick={() => run("assignTeam", [BigInt(id || 0), team, comment], "Team assigned")}>Assign team</button>

      <h3>Update status</h3>
      <select style={box} value={status} onChange={(e) => setStatus(Number(e.target.value))}>
        {[2, 3, 4].map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
      </select>
      <button disabled={!isMunicipal} onClick={() => run("updateStatus", [BigInt(id || 0), status, comment], `Status set to ${STATUS[status]}`)}>Update status</button>

      {msg?.ok && <p style={{ color: "green" }}>{msg.ok}</p>}
      {msg?.err && <p style={{ color: "crimson" }}>{msg.err}</p>}
    </section>
  );
}