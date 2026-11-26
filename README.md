# Smart City & Blockchain: Urban Issue Registry (Mini-projet)

Decentralised platform for urban service management. Citizens report problems (broken streetlight, pothole...), the municipality assigns a team and updates the status, and every action is traced on-chain. Includes Excel/CSV bulk import, a public lookup page, and a full history per issue.

## Structure
```
smartcity/contracts   Hardhat project (UrbanIssueRegistry.sol, tests, scripts)
smartcity/frontend    React + Vite + ethers.js (+ SheetJS for import)
data/urban_issues.xlsx  Fictional test file for the import feature
screenshots/          Captures of the app
```

## Install & test
```bash
cd smartcity/contracts
npm install
cp .env.example .env        # fill in values (never commit .env)
npx hardhat test
npx hardhat coverage
```

## Deploy
Local:
```bash
npx hardhat node                                   # terminal 1
npx hardhat run scripts/deploy.js --network localhost
```
Sepolia:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```
The script deploys the contract, grants the MUNICIPAL role to a given address, creates one example issue, saves `deployments/<network>.json` and verifies on Etherscan (Sepolia).

## Frontend
```bash
cd smartcity/contracts && node scripts/export-abi.js
cd ../frontend && npm install
cp .env.example .env        # VITE_CONTRACT_ADDRESS, VITE_NETWORK
npm run dev
```
Connect with MetaMask (Hardhat local, chain id 31337, or Sepolia). Pages:

| Page | Who | What |
|---|---|---|
| Report an issue | Citizen | Form: type, location, description, priority |
| Issues list / detail | Public | Browse and look up an issue by ID, view its history |
| Municipal dashboard | Municipality (role checked on-chain) | Assign a team, change status, add a comment |
| Import | Municipality | Upload Excel/CSV, preview, validate, select rows, save on-chain |

Transaction errors (rejected signature, missing role, invalid status transition, duplicate ID) are mapped to readable messages.

## Excel / CSV import
1. Upload `urban_issues.xlsx` (or CSV); it is parsed client-side with SheetJS, nothing is sent to a server.
2. A preview table shows every row with a validity badge.
3. Validation, before any transaction:
   - required columns present: `issueId, issueType, location, description, reportDate, priority, reportedBy, assignedTo, status`
   - `issueId` non-empty, unique in the file and not already on-chain
   - `priority` in `Low | Medium | High`, `reportDate` as `YYYY-MM-DD`
   - `status` in `Reported | Assigned | InProgress | Resolved | Closed`
   - no empty fields, length limits respected
4. The user selects the valid rows to save; they are sent in chunks (see batch limit below).

Test file: `data/urban_issues.xlsx` (fictional data only, includes a few deliberately invalid rows to demo validation).

## Deployed contract (Sepolia)
- Address: `<fill in>`
- Deploy tx: `<fill in>`
- Example issue tx: `<fill in>`
- Etherscan: `https://sepolia.etherscan.io/address/<address>`

## Design choices
| Decision | Choice | Why |
|---|---|---|
| Issue identity | Business ID (`CITY-2026-001`) stored as `keccak256(issueId)` -> internal index mapping | Keeps the Excel IDs, cheap on-chain uniqueness check |
| Status flow | `Reported -> Assigned -> InProgress -> Resolved -> Closed`, forward-only, validated in the contract | Prevents inconsistent or skipped states |
| Access control | AccessControl (`MUNICIPAL_ROLE`, `DEFAULT_ADMIN_ROLE`) | Citizens can only create; only municipal staff assign and update |
| History | Append-only array of entries per issue (timestamp, status, team, comment, actor address) | Verifiable trace, readable by anyone |
| Events | `IssueCreated`, `IssueAssigned`, `StatusUpdated` | Cheap traceability and easy off-chain indexing |
| Batch import | Capped (e.g. 20 per tx), chunked from the frontend | Avoids block gas limit issues |
| Errors | Custom errors | Cheaper and easy to map in the UI |
| Privacy | No personal data on-chain, `reportedBy` is a pseudonym or address | Project requirement, blockchain data is permanent |
| Secrets | No private key in the frontend, signing only via MetaMask | Project requirement |

**Note on `reportedBy` / `assignedTo`:** these Excel columns are stored as short free-text labels (fictional names like `Citizen01`, `UrbanTeam01`); the actual actor is always recorded via `msg.sender` in the history.

## Data model
| Field | Example |
|---|---|
| issueId | CITY-2026-001 |
| issueType | StreetLight |
| location | Avenue Mohammed V |
| description | Streetlight not working |
| reportDate | 2026-11-19 |
| priority | High |
| reportedBy | Citizen01 |
| assignedTo | UrbanTeam01 |
| status | Reported |

