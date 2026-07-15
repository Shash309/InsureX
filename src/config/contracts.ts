import PolicyNFTArtifact from '../../artifacts/contracts/PolicyNFT.sol/PolicyNFT.json';
import AutoClaimArtifact from '../../artifacts/contracts/AutoClaim.sol/AutoClaim.json';

import { POLICY_NFT_ADDRESS as ENV_POLICY_NFT_ADDRESS, AUTO_CLAIM_ADDRESS as ENV_AUTO_CLAIM_ADDRESS } from './env';

export const POLICY_NFT_ADDRESS = ENV_POLICY_NFT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const AUTO_CLAIM_ADDRESS = ENV_AUTO_CLAIM_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

export const POLICY_NFT_ABI = PolicyNFTArtifact.abi;
export const AUTO_CLAIM_ABI = AutoClaimArtifact.abi;
