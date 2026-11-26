// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract UrbanIssueRegistry is AccessControl {
    bytes32 public constant MUNICIPAL_ROLE = keccak256("MUNICIPAL_ROLE");
    uint256 public constant MAX_BATCH = 15;

    enum Status { Reported, Assigned, InProgress, Resolved, Closed }
    enum Priority { Low, Medium, High, Critical }

    struct IssueInput {
        string issueId;      // e.g. CITY-2026-001 (unique)
        string issueType;
        string location;
        string description;
        string reportDate;   // YYYY-MM-DD
        Priority priority;
        string reportedBy;   // pseudonym only, no personal data
    }

    struct Issue {
        string issueId;
        string issueType;
        string location;
        string description;
        string reportDate;
        Priority priority;
        string reportedBy;
        string assignedTo;
        Status status;
        address reporter;
        uint64 createdAt;
    }

    struct HistoryEntry {
        uint64 timestamp;
        Status status;
        string team;
        string comment;
        address actor;
    }

    uint256 public issueCount;
    mapping(uint256 => Issue) private issues;
    mapping(uint256 => HistoryEntry[]) private histories;
    mapping(bytes32 => bool) private issueIdUsed;

    event IssueCreated(uint256 indexed id, string issueId, address indexed reporter);
    event TeamAssigned(uint256 indexed id, string team, address indexed actor, string comment);
    event StatusUpdated(uint256 indexed id, Status oldStatus, Status newStatus, address indexed actor, string comment);

    error ZeroAddress();
    error EmptyField();
    error DuplicateIssueId();
    error IssueNotFound();
    error InvalidTransition(Status current, Status requested);
    error InvalidBatchSize();

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MUNICIPAL_ROLE, admin);
    }

    modifier exists(uint256 id) {
        if (id == 0 || id > issueCount) revert IssueNotFound();
        _;
    }

    function _create(IssueInput calldata i, address reporter) internal returns (uint256 id) {
        if (
            bytes(i.issueId).length == 0 || bytes(i.issueType).length == 0 ||
            bytes(i.location).length == 0 || bytes(i.description).length == 0 ||
            bytes(i.reportDate).length == 0
        ) revert EmptyField();

        bytes32 key = keccak256(bytes(i.issueId));
        if (issueIdUsed[key]) revert DuplicateIssueId();
        issueIdUsed[key] = true;

        id = ++issueCount;
        Issue storage s = issues[id];
        s.issueId = i.issueId;
        s.issueType = i.issueType;
        s.location = i.location;
        s.description = i.description;
        s.reportDate = i.reportDate;
        s.priority = i.priority;
        s.reportedBy = i.reportedBy;
        s.status = Status.Reported;
        s.reporter = reporter;
        s.createdAt = uint64(block.timestamp);

        histories[id].push(HistoryEntry(uint64(block.timestamp), Status.Reported, "", "Issue reported", reporter));
        emit IssueCreated(id, i.issueId, reporter);
    }

    // Anyone (citizens) can report
    function createIssue(IssueInput calldata input) external returns (uint256) {
        return _create(input, msg.sender);
    }

    // Municipality only: Excel import
    function createIssues(IssueInput[] calldata inputs) external onlyRole(MUNICIPAL_ROLE) {
        if (inputs.length == 0 || inputs.length > MAX_BATCH) revert InvalidBatchSize();
        for (uint256 k = 0; k < inputs.length; k++) _create(inputs[k], msg.sender);
    }

    function assignTeam(uint256 id, string calldata team, string calldata comment)
        external onlyRole(MUNICIPAL_ROLE) exists(id)
    {
        if (bytes(team).length == 0) revert EmptyField();
        Issue storage s = issues[id];
        if (s.status != Status.Reported && s.status != Status.Assigned)
            revert InvalidTransition(s.status, Status.Assigned);

        Status old = s.status;
        s.assignedTo = team;
        s.status = Status.Assigned;
        histories[id].push(HistoryEntry(uint64(block.timestamp), Status.Assigned, team, comment, msg.sender));
        emit TeamAssigned(id, team, msg.sender, comment);
        emit StatusUpdated(id, old, Status.Assigned, msg.sender, comment);
    }

    function updateStatus(uint256 id, Status newStatus, string calldata comment)
        external onlyRole(MUNICIPAL_ROLE) exists(id)
    {
        Issue storage s = issues[id];
        Status current = s.status;
        // Reported must go through assignTeam; then strictly one step forward
        if (current == Status.Reported || uint8(newStatus) != uint8(current) + 1)
            revert InvalidTransition(current, newStatus);

        s.status = newStatus;
        histories[id].push(HistoryEntry(uint64(block.timestamp), newStatus, s.assignedTo, comment, msg.sender));
        emit StatusUpdated(id, current, newStatus, msg.sender, comment);
    }

    function getIssue(uint256 id) external view exists(id) returns (Issue memory) {
        return issues[id];
    }

    function getHistory(uint256 id) external view exists(id) returns (HistoryEntry[] memory) {
        return histories[id];
    }
}