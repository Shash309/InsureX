const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function updateEnv(filePath, updates) {
  let content = "";
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf8");
  }
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }
  fs.writeFileSync(filePath, content);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Deploy PolicyNFT
  const PolicyNFT = await ethers.getContractFactory("PolicyNFT");
  const policyNFT = await PolicyNFT.deploy(deployer.address);
  await policyNFT.waitForDeployment();
  const policyNFTAddress = await policyNFT.getAddress();
  console.log("✅ PolicyNFT:", policyNFTAddress);

  // Deploy AutoClaim
  const AutoClaim = await ethers.getContractFactory("AutoClaim");
  const autoClaim = await AutoClaim.deploy(policyNFTAddress);
  await autoClaim.waitForDeployment();
  const autoClaimAddress = await autoClaim.getAddress();
  console.log("✅ AutoClaim:", autoClaimAddress);

  // Link oracle
  await policyNFT.setOracle(autoClaimAddress);
  console.log("✅ Oracle linked");

  // Fund contract with 10 ETH
  await deployer.sendTransaction({
    to: policyNFTAddress,
    value: ethers.parseEther("10.0")
  });
  console.log("✅ Contract funded with 10 ETH");

  // Auto-update root .env
  const rootEnv = path.join(__dirname, "../.env");
  await updateEnv(rootEnv, {
    VITE_POLICY_NFT_ADDRESS: policyNFTAddress,
    VITE_AUTO_CLAIM_ADDRESS: autoClaimAddress,
  });
  console.log("✅ Root .env updated");

  // Auto-update backend/.env
  const backendEnv = path.join(__dirname, "../backend/.env");
  await updateEnv(backendEnv, {
    POLICY_NFT_ADDRESS: policyNFTAddress,
  });
  console.log("✅ backend/.env updated");

  // Fetch and print pool health summary
  const stats = await policyNFT.getPoolStats();
  console.log("\n📊 Pool Health Summary:");
  console.log("------------------------");
  console.log(`Balance:             ${ethers.formatEther(stats[0])} ETH`);
  console.log(`Premiums Collected:  ${ethers.formatEther(stats[1])} ETH`);
  console.log(`Claims Paid:         ${ethers.formatEther(stats[2])} ETH`);
  console.log(`Active Policies:     ${stats[3].toString()}`);
  console.log(`Coverage Exposure:   ${ethers.formatEther(stats[4])} ETH`);
  console.log(`Is Pool Open:        ${stats[5]}`);
  console.log(`Pool Ratio:          ${stats[6].toString()}%`);
  console.log("------------------------");

  console.log("\n🚀 All done! Restart npm run dev and uvicorn.");
}

main().catch(console.error);
