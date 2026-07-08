// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract PolicyNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIds;

    // ─── Enums ───────────────────────────────────────────────────────────────

    enum PolicyStatus { Active, Claimed, Expired, Cancelled }
    enum ClaimStatus  { None, Pending, Approved, Rejected, Paid }

    // ─── Structs ─────────────────────────────────────────────────────────────

    struct Policy {
        uint256 tokenId;
        address policyholder;
        string  policyType;         // "health", "travel", "crop", "auto"
        uint256 coverageAmount;     // in wei
        uint256 premium;            // in wei
        uint256 startDate;
        uint256 endDate;
        PolicyStatus status;
        string  ipfsMetadataHash;   // full policy document on IPFS
    }

    struct Claim {
        uint256 policyTokenId;
        address claimant;
        string  description;
        uint256 claimAmount;
        uint256 filedAt;
        ClaimStatus status;
        string  evidenceHash;       // IPFS hash of supporting documents
    }

    // ─── State ───────────────────────────────────────────────────────────────

    mapping(uint256 => Policy) public policies;
    mapping(uint256 => Claim)  public claims;
    mapping(address => uint256[]) public holderPolicies;

    // Oracle address allowed to trigger auto-payouts
    address public trustedOracle;

    uint256 public claimCounter;

    // Treasury and Pool State
    uint256 public totalPremiumsCollected;
    uint256 public totalClaimsPaid;
    uint256 public totalPoliciesActive;
    bool public poolOpen = true;
    uint256 public constant MIN_POOL_RATIO = 20;
    uint256 public totalCoverageExposure;

    // ─── Events ──────────────────────────────────────────────────────────────

    event PolicyMinted(
        uint256 indexed tokenId,
        address indexed policyholder,
        string policyType,
        uint256 coverageAmount,
        uint256 endDate
    );

    event ClaimFiled(
        uint256 indexed claimId,
        uint256 indexed policyTokenId,
        address indexed claimant,
        uint256 claimAmount
    );

    event ClaimAutoApproved(
        uint256 indexed claimId,
        uint256 indexed policyTokenId,
        uint256 paidAmount
    );

    event ClaimRejected(
        uint256 indexed claimId,
        string reason
    );

    event PolicyExpired(uint256 indexed tokenId);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOracle() {
        require(msg.sender == trustedOracle, "PolicyNFT: caller is not oracle");
        _;
    }

    modifier policyExists(uint256 tokenId) {
        require(_ownerOf(tokenId) != address(0), "PolicyNFT: policy does not exist");
        _;
    }

    modifier policyActive(uint256 tokenId) {
        require(policies[tokenId].status == PolicyStatus.Active, "PolicyNFT: policy not active");
        require(block.timestamp <= policies[tokenId].endDate, "PolicyNFT: policy expired");
        _;
    }

    modifier poolIsOpen() {
        require(poolOpen, "PolicyNFT: pool is paused, not accepting new policies");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _oracle) ERC721("InsurancePolicy", "INSP") Ownable(msg.sender) {
        trustedOracle = _oracle;
    }

    // ─── Core Functions ──────────────────────────────────────────────────────

    /**
     * @notice Mint a new insurance policy NFT
     * @dev Premium must be sent as msg.value
     */
    function mintPolicy(
        address    _policyholder,
        string memory _policyType,
        uint256    _coverageAmount,
        uint256    _durationDays,
        string memory _ipfsMetadataHash,
        string memory _tokenURI
    ) external payable poolIsOpen returns (uint256) {
        require(msg.value > 0, "PolicyNFT: premium required");
        require(_coverageAmount > 0, "PolicyNFT: coverage must be > 0");
        require(_durationDays > 0 && _durationDays <= 3650, "PolicyNFT: invalid duration");

        totalPremiumsCollected += msg.value;
        totalCoverageExposure += _coverageAmount;
        totalPoliciesActive++;

        _checkPoolHealth();

        _tokenIds++;
        uint256 newTokenId = _tokenIds;

        _safeMint(_policyholder, newTokenId);
        _setTokenURI(newTokenId, _tokenURI);

        policies[newTokenId] = Policy({
            tokenId:          newTokenId,
            policyholder:     _policyholder,
            policyType:       _policyType,
            coverageAmount:   _coverageAmount,
            premium:          msg.value,
            startDate:        block.timestamp,
            endDate:          block.timestamp + (_durationDays * 1 days),
            status:           PolicyStatus.Active,
            ipfsMetadataHash: _ipfsMetadataHash
        });

        holderPolicies[_policyholder].push(newTokenId);

        emit PolicyMinted(
            newTokenId,
            _policyholder,
            _policyType,
            _coverageAmount,
            policies[newTokenId].endDate
        );

        return newTokenId;
    }

    /**
     * @notice File a claim against an active policy
     */
    function fileClaim(
        uint256 _policyTokenId,
        string memory _description,
        uint256 _claimAmount,
        string memory _evidenceHash
    ) external policyExists(_policyTokenId) policyActive(_policyTokenId) returns (uint256) {
        Policy storage policy = policies[_policyTokenId];

        require(
            ownerOf(_policyTokenId) == msg.sender,
            "PolicyNFT: only policyholder can file claim"
        );
        require(
            _claimAmount <= policy.coverageAmount,
            "PolicyNFT: claim exceeds coverage"
        );
        require(
            claims[_policyTokenId].status == ClaimStatus.None ||
            claims[_policyTokenId].status == ClaimStatus.Rejected,
            "PolicyNFT: claim already pending or paid"
        );

        claimCounter++;

        claims[_policyTokenId] = Claim({
            policyTokenId: _policyTokenId,
            claimant:      msg.sender,
            description:   _description,
            claimAmount:   _claimAmount,
            filedAt:       block.timestamp,
            status:        ClaimStatus.Pending,
            evidenceHash:  _evidenceHash
        });

        emit ClaimFiled(claimCounter, _policyTokenId, msg.sender, _claimAmount);

        return claimCounter;
    }

    /**
     * @notice Oracle-triggered auto payout
     * @dev Called by Chainlink oracle when trigger conditions are verified
     *      e.g. flight delayed, rainfall below threshold, etc.
     */
    function autoApproveClaim(
        uint256 _policyTokenId
    ) external onlyOracle policyExists(_policyTokenId) {
        Claim storage claim   = claims[_policyTokenId];
        Policy storage policy = policies[_policyTokenId];

        require(claim.status == ClaimStatus.Pending, "PolicyNFT: no pending claim");
        require(
            address(this).balance >= claim.claimAmount,
            "PolicyNFT: insufficient contract balance"
        );

        claim.status   = ClaimStatus.Paid;
        policy.status  = PolicyStatus.Claimed;

        totalClaimsPaid += claim.claimAmount;
        totalCoverageExposure -= policy.coverageAmount;
        totalPoliciesActive--;

        (bool sent, ) = payable(claim.claimant).call{value: claim.claimAmount}("");
        require(sent, "PolicyNFT: payout transfer failed");

        emit ClaimAutoApproved(claimCounter, _policyTokenId, claim.claimAmount);
    }

    /**
     * @notice Reject a claim (oracle or owner)
     */
    function rejectClaim(
        uint256 _policyTokenId,
        string memory _reason
    ) external {
        require(
            msg.sender == trustedOracle || msg.sender == owner(),
            "PolicyNFT: not authorized"
        );

        Claim storage claim = claims[_policyTokenId];
        require(claim.status == ClaimStatus.Pending, "PolicyNFT: no pending claim");

        claim.status = ClaimStatus.Rejected;

        emit ClaimRejected(claimCounter, _reason);
    }

    /**
     * @notice Mark expired policies
     */
    function expirePolicy(uint256 tokenId) external policyExists(tokenId) {
        Policy storage policy = policies[tokenId];
        require(block.timestamp > policy.endDate, "PolicyNFT: not yet expired");
        require(policy.status == PolicyStatus.Active, "PolicyNFT: not active");

        policy.status = PolicyStatus.Expired;
        emit PolicyExpired(tokenId);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    function getPolicy(uint256 tokenId) external view returns (Policy memory) {
        return policies[tokenId];
    }

    function getClaim(uint256 tokenId) external view returns (Claim memory) {
        return claims[tokenId];
    }

    function getHolderPolicies(address holder) external view returns (uint256[] memory) {
        return holderPolicies[holder];
    }

    function getTotalPolicies() external view returns (uint256) {
        return _tokenIds;
    }

    // ─── Internal Functions ──────────────────────────────────────────────────

    function _checkPoolHealth() internal {
        uint256 balance = address(this).balance;
        if (totalCoverageExposure > 0) {
            uint256 ratio = (balance * 100) / totalCoverageExposure;
            if (ratio < MIN_POOL_RATIO) {
                poolOpen = false;
            }
        }
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setOracle(address _newOracle) external onlyOwner {
        trustedOracle = _newOracle;
    }

    function withdrawFunds(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "PolicyNFT: insufficient balance");
        (bool sent, ) = payable(owner()).call{value: amount}("");
        require(sent, "PolicyNFT: withdraw failed");
    }

    function pausePool() external onlyOwner {
        poolOpen = false;
    }

    function resumePool() external onlyOwner {
        poolOpen = true;
    }

    // ─── Pool Stats View ─────────────────────────────────────────────────────

    function getPoolStats() external view returns (
        uint256 balance,
        uint256 premiumsCollected,
        uint256 claimsPaid,
        uint256 activePolicies,
        uint256 coverageExposure,
        bool isOpen,
        uint256 poolRatio
    ) {
        balance = address(this).balance;
        premiumsCollected = totalPremiumsCollected;
        claimsPaid = totalClaimsPaid;
        activePolicies = totalPoliciesActive;
        coverageExposure = totalCoverageExposure;
        isOpen = poolOpen;
        poolRatio = coverageExposure > 0 
            ? (balance * 100) / coverageExposure 
            : 100;
    }

    receive() external payable {}

    // ─── Overrides ───────────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
