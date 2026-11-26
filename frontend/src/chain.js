import { createPublicClient, createWalletClient, custom, http } from "viem";
import { sepolia, hardhat } from "viem/chains";
import abi from "./abi/UrbanIssueRegistry.json";

export const ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
export const chain = import.meta.env.VITE_NETWORK === "sepolia" ? sepolia : hardhat;
export const STATUS = ["Reported", "Assigned", "InProgress", "Resolved", "Closed"];
export const PRIORITY = ["Low", "Medium", "High", "Critical"];

export const publicClient = createPublicClient({
  chain,
  transport: http(import.meta.env.VITE_RPC_URL || undefined),
});
export const wallet = () => createWalletClient({ chain, transport: custom(window.ethereum) });

export const read = (functionName, args = []) =>
  publicClient.readContract({ address: ADDRESS, abi, functionName, args });

// simulate first so custom errors are decoded, then send
export async function send(account, functionName, args) {
  const { request } = await publicClient.simulateContract({ address: ADDRESS, abi, functionName, args, account });
  const hash = await wallet().writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, receipt };
}

const ERRORS = {
  AccessControlUnauthorizedAccount: "Not authorized: the municipal role is required.",
  DuplicateIssueId: "This issue ID already exists.",
  EmptyField: "A required field is empty.",
  IssueNotFound: "Issue not found.",
  InvalidTransition: "Invalid status change. Order: Reported → Assigned → InProgress → Resolved → Closed.",
  InvalidBatchSize: "A batch must contain 1 to 15 issues.",
  ZeroAddress: "Zero address not allowed.",
};

export function readableError(e) {
  const name = e?.walk?.((x) => x?.data?.errorName)?.data?.errorName;
  if (name && ERRORS[name]) return ERRORS[name];
  if (e?.message?.includes("User rejected")) return "Transaction rejected in wallet.";
  return e?.shortMessage || e?.message || "Unknown error";
}