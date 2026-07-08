const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  // Step 1: Deploy PolicyNFT with deployer as initial oracle
  const PolicyNFT = await ethers.getContractFactory("PolicyNFT");
  const policyNFT = await PolicyNFT.deploy(deployer.address);
  await policyNFT.waitForDeployment();
  const policyNFTAddress = await policyNFT.getAddress();
  console.log("✅ PolicyNFT deployed to:", policyNFTAddress);

  // Step 2: Deploy AutoClaim with PolicyNFT address
  const AutoClaim = await ethers.getContractFactory("AutoClaim");
  const autoClaim = await AutoClaim.deploy(policyNFTAddress);
  await autoClaim.waitForDeployment();
  const autoClaimAddress = await autoClaim.getAddress();
  console.log("✅ AutoClaim deployed to:", autoClaimAddress);

  // Step 3: Set AutoClaim as oracle on PolicyNFT
  const tx = await policyNFT.setOracle(autoClaimAddress);
  await tx.wait();
  console.log("✅ Oracle linked");

  console.log("\nAdd to your .env:");
  console.log("VITE_POLICY_NFT_ADDRESS=" + policyNFTAddress);
  console.log("VITE_AUTO_CLAIM_ADDRESS=" + autoClaimAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
