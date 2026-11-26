const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const Status = { Reported: 0, Assigned: 1, InProgress: 2, Resolved: 3, Closed: 4 };

const issue = (n = 1, o = {}) => ({
  issueId: `CITY-2026-${String(n).padStart(3, "0")}`,
  issueType: "StreetLight",
  location: "Avenue Mohammed V",
  description: "Streetlight not working",
  reportDate: "2026-11-19",
  priority: 2,
  reportedBy: "Citizen01",
  ...o,
});

async function deploy() {
  const [admin, staff, citizen] = await ethers.getSigners();
  const reg = await ethers.deployContract("UrbanIssueRegistry", [admin.address]);
  await reg.waitForDeployment();
  return { reg, admin, staff, citizen };
}

describe("UrbanIssueRegistry", () => {
  describe("creation", () => {
    it("lets a citizen report an issue and emits IssueCreated", async () => {
      const { reg, citizen } = await loadFixture(deploy);
      await expect(reg.connect(citizen).createIssue(issue(1)))
        .to.emit(reg, "IssueCreated").withArgs(1, "CITY-2026-001", citizen.address);
      const i = await reg.getIssue(1);
      expect(i.location).to.equal("Avenue Mohammed V");
      expect(i.status).to.equal(Status.Reported);
      expect(i.reporter).to.equal(citizen.address);
      expect(await reg.issueCount()).to.equal(1);
    });

    it("rejects a duplicate issueId", async () => {
      const { reg, citizen } = await loadFixture(deploy);
      await reg.connect(citizen).createIssue(issue(1));
      await expect(reg.connect(citizen).createIssue(issue(1)))
        .to.be.revertedWithCustomError(reg, "DuplicateIssueId");
    });

    it("rejects empty fields", async () => {
      const { reg, citizen } = await loadFixture(deploy);
      await expect(reg.connect(citizen).createIssue(issue(1, { location: "" })))
        .to.be.revertedWithCustomError(reg, "EmptyField");
    });

    it("reverts for an unknown issue", async () => {
      const { reg } = await loadFixture(deploy);
      await expect(reg.getIssue(99)).to.be.revertedWithCustomError(reg, "IssueNotFound");
    });

    it("constructor rejects the zero address", async () => {
      const F = await ethers.getContractFactory("UrbanIssueRegistry");
      await expect(F.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(F, "ZeroAddress");
    });
  });

  describe("workflow", () => {
    it("blocks non-municipal accounts", async () => {
      const { reg, citizen } = await loadFixture(deploy);
      await reg.connect(citizen).createIssue(issue(1));
      await expect(reg.connect(citizen).assignTeam(1, "UrbanTeam01", "x"))
        .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
      await expect(reg.connect(citizen).updateStatus(1, Status.InProgress, "x"))
        .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
    });

    it("assigns a team, sets status and emits events", async () => {
      const { reg, admin, citizen } = await loadFixture(deploy);
      await reg.connect(citizen).createIssue(issue(1));
      await expect(reg.assignTeam(1, "UrbanTeam01", "Team dispatched"))
        .to.emit(reg, "TeamAssigned").withArgs(1, "UrbanTeam01", admin.address, "Team dispatched")
        .and.to.emit(reg, "StatusUpdated");
      const i = await reg.getIssue(1);
      expect(i.assignedTo).to.equal("UrbanTeam01");
      expect(i.status).to.equal(Status.Assigned);
    });

    it("enforces the status order", async () => {
      const { reg, citizen } = await loadFixture(deploy);
      await reg.connect(citizen).createIssue(issue(1));
      await expect(reg.updateStatus(1, Status.InProgress, "x"))   // must assign first
        .to.be.revertedWithCustomError(reg, "InvalidTransition");
      await reg.assignTeam(1, "UrbanTeam01", "dispatch");
      await expect(reg.updateStatus(1, Status.Resolved, "skip"))   // cannot skip InProgress
        .to.be.revertedWithCustomError(reg, "InvalidTransition");
    });

    it("runs the full lifecycle and keeps the history", async () => {
      const { reg, admin, citizen } = await loadFixture(deploy);
      await reg.connect(citizen).createIssue(issue(1));
      await reg.assignTeam(1, "UrbanTeam01", "dispatch");
      await reg.updateStatus(1, Status.InProgress, "on site");
      await reg.updateStatus(1, Status.Resolved, "fixed");
      await reg.updateStatus(1, Status.Closed, "verified");
      const h = await reg.getHistory(1);
      expect(h.length).to.equal(5);
      expect(h[0].actor).to.equal(citizen.address);
      expect(h[4].status).to.equal(Status.Closed);
      expect(h[4].comment).to.equal("verified");
      expect(h[4].actor).to.equal(admin.address);
      await expect(reg.updateStatus(1, Status.Closed, "again"))
        .to.be.revertedWithCustomError(reg, "InvalidTransition");
    });
  });

  describe("roles", () => {
    it("admin grants MUNICIPAL_ROLE and the new staff can work", async () => {
      const { reg, staff, citizen } = await loadFixture(deploy);
      const role = await reg.MUNICIPAL_ROLE();
      await reg.grantRole(role, staff.address);
      await reg.connect(citizen).createIssue(issue(1));
      await reg.connect(staff).assignTeam(1, "UrbanTeam02", "ok");
      expect((await reg.getIssue(1)).assignedTo).to.equal("UrbanTeam02");
    });

    it("non-admin cannot grant roles", async () => {
      const { reg, staff, citizen } = await loadFixture(deploy);
      const role = await reg.MUNICIPAL_ROLE();
      await expect(reg.connect(citizen).grantRole(role, staff.address))
        .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
    });
  });

  describe("batch import", () => {
    it("staff can import several issues", async () => {
      const { reg } = await loadFixture(deploy);
      await reg.createIssues([issue(1), issue(2), issue(3)]);
      expect(await reg.issueCount()).to.equal(3);
    });

    it("citizens cannot batch import", async () => {
      const { reg, citizen } = await loadFixture(deploy);
      await expect(reg.connect(citizen).createIssues([issue(1)]))
        .to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
    });

    it("rejects empty and oversized batches", async () => {
      const { reg } = await loadFixture(deploy);
      await expect(reg.createIssues([])).to.be.revertedWithCustomError(reg, "InvalidBatchSize");
      const big = Array.from({ length: 16 }, (_, i) => issue(i + 1));
      await expect(reg.createIssues(big)).to.be.revertedWithCustomError(reg, "InvalidBatchSize");
    });

    it("is atomic: a duplicate cancels the whole batch", async () => {
      const { reg } = await loadFixture(deploy);
      await expect(reg.createIssues([issue(1), issue(2), issue(1)]))
        .to.be.revertedWithCustomError(reg, "DuplicateIssueId");
      expect(await reg.issueCount()).to.equal(0);
    });
  });
});