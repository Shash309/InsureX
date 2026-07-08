import { useMemo } from 'react';
import { Contract, BrowserProvider, Signer } from 'ethers';
import { POLICY_NFT_ADDRESS, POLICY_NFT_ABI, AUTO_CLAIM_ADDRESS, AUTO_CLAIM_ABI } from '../config/contracts';

export const useContract = (provider: BrowserProvider | null, signer: Signer | null) => {
  const policyContract = useMemo(() => {
    if (!POLICY_NFT_ADDRESS) return null;
    
    // If signer exists, return contract connected to signer (write allowed)
    // Otherwise return contract connected to provider (read-only)
    if (signer) {
      return new Contract(POLICY_NFT_ADDRESS, POLICY_NFT_ABI, signer);
    } else if (provider) {
      return new Contract(POLICY_NFT_ADDRESS, POLICY_NFT_ABI, provider);
    }
    return null;
  }, [provider, signer]);

  const autoClaimContract = useMemo(() => {
    if (!AUTO_CLAIM_ADDRESS) return null;
    
    if (signer) {
      return new Contract(AUTO_CLAIM_ADDRESS, AUTO_CLAIM_ABI, signer);
    } else if (provider) {
      return new Contract(AUTO_CLAIM_ADDRESS, AUTO_CLAIM_ABI, provider);
    }
    return null;
  }, [provider, signer]);

  return {
    policyContract,
    autoClaimContract,
  };
};
