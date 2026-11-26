const fs = require("fs");
const path = require("path");

const artifact = require("../artifacts/contracts/UrbanIssueRegistry.sol/UrbanIssueRegistry.json");
const outDir = path.join(__dirname, "..", "..", "frontend", "src", "abi");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "UrbanIssueRegistry.json"), JSON.stringify(artifact.abi, null, 2));
console.log("ABI written to", outDir);