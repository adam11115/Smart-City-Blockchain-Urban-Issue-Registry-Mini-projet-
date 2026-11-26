import { useEffect, useState } from "react";
import { keccak256, toBytes } from "viem";
import { read, wallet, chain, readableError } from "./chain";
import ReportForm from "./ReportForm";
import IssueList from "./IssueList";
import Municipal from "./Municipal";
import ImportExcel from "./ImportExcel";

const MUNICIPAL_ROLE = keccak256(toBytes("MUNICIPAL_ROLE"));
const TABS = ["Report", "Issues", "Municipality", "Excel import"];

export default function App() {
  const [account, setAccount] = useState(null);
  const [isMunicipal, setIsMunicipal] = useState(false);
  const [tab, setTab] = useState("Issues");
  const [warn, setWarn] = useState("");

  async function connect() {
    try {
      const w = wallet();
      const [addr] = await w.requestAddresses();
      setAccount(addr);
      const id = await w.getChainId();
      setWarn(id !== chain.id ? `Wrong network: switch MetaMask to ${chain.name} (chain ${chain.id}).` : "");
    } catch (e) { setWarn(readableError(e)); }
  }

  useEffect(() => {
    if (!account) return;
    read("hasRole", [MUNICIPAL_ROLE, account]).then(setIsMunicipal).catch((e) => setWarn(readableError(e)));
  }, [account]);

  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (a) => { setAccount(a[0] ?? null); setIsMunicipal(false); };
    const onChain = () => window.location.reload();
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged", onChain);
    };
  }, []);

  return (
    <div style={{ maxWidth: 1000, margin: "auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1>Smart City: Urban Issues</h1>
      {account ? (
        <p>{account} · {isMunicipal ? "municipal staff" : "citizen"}</p>
      ) : (
        <button onClick={connect}>Connect wallet</button>
      )}
      {warn && <p style={{ color: "crimson" }}>{warn}</p>}

      <div style={{ margin: "1rem 0" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ marginRight: 8, fontWeight: tab === t ? "bold" : "normal" }}>{t}</button>
        ))}
      </div>

      {tab === "Report" && <ReportForm account={account} />}
      {tab === "Issues" && <IssueList />}
      {tab === "Municipality" && <Municipal account={account} isMunicipal={isMunicipal} />}
      {tab === "Excel import" && <ImportExcel account={account} isMunicipal={isMunicipal} />}
    </div>
  );
}