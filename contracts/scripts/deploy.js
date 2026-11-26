const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Network :", network.name);
  console.log("Deployer:", deployer.address);

  const reg = await ethers.deployContract("UrbanIssueRegistry", [deployer.address]);
  await reg.waitForDeployment();
  const address = await reg.getAddress();
  const deployTx = reg.deploymentTransaction().hash;
  console.log("UrbanIssueRegistry deployed at:", address);
  console.log("Deploy tx:", deployTx);

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${network.name}.json`),
    JSON.stringify({ network: network.name, address, deployTx, admin: deployer.address }, null, 2)
  );
}

main().catch((e) => { console.error(e); process.exitCode = 1; });