const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InsureX Parametric Platform", function () {
  let policyNFT, autoClaim, mockOracle;
  let owner, user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // 1. Deploy PolicyNFT with temporary oracle
    const PolicyNFT = await ethers.getContractFactory("PolicyNFT");
    policyNFT = await PolicyNFT.deploy(owner.address);
    await policyNFT.waitForDeployment();
    const policyNFTAddress = await policyNFT.getAddress();

    // 2. Deploy AutoClaim
    const AutoClaim = await ethers.getContractFactory("AutoClaim");
    autoClaim = await AutoClaim.deploy(policyNFTAddress);
    await autoClaim.waitForDeployment();
    const autoClaimAddress = await autoClaim.getAddress();

    // 3. Set actual AutoClaim as trustedOracle
    await policyNFT.setOracle(autoClaimAddress);

    // 4. Deploy MockOracle with initial value of 2 (e.g. 2 hours delay)
    const MockOracle = await ethers.getContractFactory("MockOracle");
    mockOracle = await MockOracle.deploy(2);
    await mockOracle.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should configure addresses and owner correctly", async function () {
      expect(await policyNFT.owner()).to.equal(owner.address);
      expect(await policyNFT.trustedOracle()).to.equal(await autoClaim.getAddress());
      expect(await autoClaim.policyNFT()).to.equal(await policyNFT.getAddress());
    });
  });

  describe("Policy Minting", function () {
    it("Should mint a travel policy NFT successfully", async function () {
      const premium = ethers.parseEther("0.1");
      const coverage = ethers.parseEther("1.0");
      
      const tx = await policyNFT.connect(user).mintPolicy(
        user.address,
        "travel",
        coverage,
        30, // 30 days
        "ipfsHash",
        "tokenURI",
        { value: premium }
      );
      await tx.wait();

      expect(await policyNFT.balanceOf(user.address)).to.equal(1);
      
      const policy = await policyNFT.policies(1); // token ID is 1 (incremented)
      expect(policy.policyholder).to.equal(user.address);
      expect(policy.policyType).to.equal("travel");
      expect(policy.coverageAmount).to.equal(coverage);
      expect(policy.premium).to.equal(premium);
      expect(policy.status).to.equal(0); // PolicyStatus.Active
    });
  });

  describe("Claim Processing & Parametric Triggering", function () {
    const tokenId = 1;
    const premium = ethers.parseEther("0.1");
    const coverage = ethers.parseEther("1.0");

    beforeEach(async function () {
      // Send some ether to the PolicyNFT contract to cover future payouts
      await owner.sendTransaction({
        to: await policyNFT.getAddress(),
        value: ethers.parseEther("5.0")
      });

      // Mint a policy (tokenId = 1)
      await policyNFT.connect(user).mintPolicy(
        user.address,
        "travel",
        coverage,
        30,
        "ipfsHash",
        "tokenURI",
        { value: premium }
      );
    });

    it("Should allow policyholder to register a trigger condition and file a claim", async function () {
      const oracleAddress = await mockOracle.getAddress();

      // Register trigger: wind speed or delay > 3
      // TriggerCondition fields: policyTokenId, triggerType, oracleFeed, threshold, operator
      // TriggerType: FLIGHT_DELAY = 0
      // Operator: GREATER_THAN = 1
      await autoClaim.connect(user).registerTrigger(
        tokenId,
        0, // TriggerType.FLIGHT_DELAY
        oracleAddress,
        3, // threshold
        1  // Operator.GREATER_THAN
      );

      const trigger = await autoClaim.getTrigger(tokenId);
      expect(trigger.oracleFeed).to.equal(oracleAddress);
      expect(trigger.threshold).to.equal(3);
      expect(trigger.operator).to.equal(1);
      expect(trigger.triggered).to.be.false;

      // File the claim
      await expect(policyNFT.connect(user).fileClaim(
        tokenId,
        "Flight delayed",
        coverage,
        "evidence"
      )).to.emit(policyNFT, "ClaimFiled");

      const claim = await policyNFT.claims(tokenId);
      expect(claim.status).to.equal(1); // ClaimStatus.Pending
    });

    it("Should automatically payout when parametric trigger is evaluated positive", async function () {
      const oracleAddress = await mockOracle.getAddress();

      // Register trigger: delay > 3
      await autoClaim.connect(user).registerTrigger(tokenId, 0, oracleAddress, 3, 1);

      // File claim
      await policyNFT.connect(user).fileClaim(tokenId, "Flight delayed", coverage, "evidence");

      // Set MockOracle value to 4 (delay of 4 hours, which is > threshold of 3)
      await mockOracle.setValue(4);

      const initialUserBalance = await ethers.provider.getBalance(user.address);

      // Evaluate and execute trigger
      await expect(autoClaim.checkAndExecute(tokenId))
        .to.emit(autoClaim, "TriggerFired")
        .withArgs(tokenId, 4, 3);

      const policy = await policyNFT.policies(tokenId);
      expect(policy.status).to.equal(1); // PolicyStatus.Claimed (index 1)

      const claim = await policyNFT.claims(tokenId);
      expect(claim.status).to.equal(4); // ClaimStatus.Paid (index 4)

      const finalUserBalance = await ethers.provider.getBalance(user.address);
      
      // User should receive coverage amount (1.0 ether)
      expect(finalUserBalance - initialUserBalance).to.be.closeTo(
        coverage,
        ethers.parseEther("0.01")
      );
    });

    it("Should not payout when parametric trigger is evaluated negative", async function () {
      const oracleAddress = await mockOracle.getAddress();

      // Register trigger: delay > 3
      await autoClaim.connect(user).registerTrigger(tokenId, 0, oracleAddress, 3, 1);

      // File claim
      await policyNFT.connect(user).fileClaim(tokenId, "Flight delayed", coverage, "evidence");

      // Set MockOracle value to 2 (delay of 2 hours, which is <= threshold of 3)
      await mockOracle.setValue(2);

      // Evaluate and execute trigger
      await autoClaim.checkAndExecute(tokenId);

      // Status should remain unchanged (Pending) because condition was not met
      const claim = await policyNFT.claims(tokenId);
      expect(claim.status).to.equal(1); // ClaimStatus.Pending
      
      const trigger = await autoClaim.getTrigger(tokenId);
      expect(trigger.triggered).to.be.false;
    });
  });

  describe("Treasury and Pool Mechanics", function () {
    it("Should initialize with correct default pool parameters", async function () {
      const stats = await policyNFT.getPoolStats();
      expect(stats.balance).to.equal(0);
      expect(stats.premiumsCollected).to.equal(0);
      expect(stats.claimsPaid).to.equal(0);
      expect(stats.activePolicies).to.equal(0);
      expect(stats.coverageExposure).to.equal(0);
      expect(stats.isOpen).to.be.true;
      expect(stats.poolRatio).to.equal(100);
    });

    it("Should auto-pause pool if pool ratio falls below MIN_POOL_RATIO", async function () {
      const premium = ethers.parseEther("0.1");
      const coverage = ethers.parseEther("1.0"); // ratio is 10% which is < 20%
      
      await expect(policyNFT.connect(user).mintPolicy(
        user.address,
        "travel",
        coverage,
        30,
        "ipfsHash",
        "tokenURI",
        { value: premium }
      )).to.emit(policyNFT, "PolicyMinted");

      const stats = await policyNFT.getPoolStats();
      expect(stats.isOpen).to.be.false;
      expect(stats.poolRatio).to.equal(10); // (0.1 / 1) * 100

      // Subsequent mint should fail because pool is paused
      await expect(policyNFT.connect(user).mintPolicy(
        user.address,
        "travel",
        coverage,
        30,
        "ipfsHash",
        "tokenURI",
        { value: premium }
      )).to.be.revertedWith("PolicyNFT: pool is paused, not accepting new policies");
    });

    it("Should allow owner to pause and resume pool manually", async function () {
      await policyNFT.connect(owner).pausePool();
      expect(await policyNFT.poolOpen()).to.be.false;

      const premium = ethers.parseEther("0.1");
      const coverage = ethers.parseEther("0.2"); // ratio is 50% (above 20%)

      await expect(policyNFT.connect(user).mintPolicy(
        user.address,
        "travel",
        coverage,
        30,
        "ipfsHash",
        "tokenURI",
        { value: premium }
      )).to.be.revertedWith("PolicyNFT: pool is paused, not accepting new policies");

      await policyNFT.connect(owner).resumePool();
      expect(await policyNFT.poolOpen()).to.be.true;

      await expect(policyNFT.connect(user).mintPolicy(
        user.address,
        "travel",
        coverage,
        30,
        "ipfsHash",
        "tokenURI",
        { value: premium }
      )).to.emit(policyNFT, "PolicyMinted");
    });
  });
});
