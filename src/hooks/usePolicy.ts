import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useContract } from './useContract';
import { Policy, PolicyStatus } from '../types';

export const usePolicy = (provider: any, signer: any, account: string | null) => {
  const { policyContract } = useContract(provider, signer);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // ─── Mint ────────────────────────────────────────────────────────────────
  /**
   * Mint a new policy NFT.
   * Matches PolicyNFT.mintPolicy(policyholder, policyType, coverageAmount,
   *   durationDays, ipfsMetadataHash, tokenURI) payable
   */
  const mintPolicy = useCallback(async (
    policyType:       string,
    coverageAmountEth: string,
    durationDays:     number,
    ipfsMetadataHash: string,
    premiumEth:       string,
  ): Promise<number> => {
    if (!policyContract || !account) {
      throw new Error('Wallet not connected or contract not loaded');
    }

    setLoading(true);
    setError(null);

    try {
      const premiumWei  = ethers.parseEther(premiumEth);
      const coverageWei = ethers.parseEther(coverageAmountEth);

      const tx = await policyContract.mintPolicy(
        account,               // _policyholder
        policyType,            // _policyType
        coverageWei,           // _coverageAmount (wei)
        durationDays,          // _durationDays
        ipfsMetadataHash,      // _ipfsMetadataHash
        ipfsMetadataHash,      // _tokenURI (same as ipfs hash)
        { value: premiumWei }  // msg.value = premium
      );

      const receipt = await tx.wait();

      // Parse PolicyMinted event to get tokenId
      let tokenId = 0;
      if (receipt?.logs) {
        for (const log of receipt.logs) {
          try {
            const parsed = policyContract.interface.parseLog(log);
            if (parsed?.name === 'PolicyMinted') {
              tokenId = Number(parsed.args.tokenId);
              break;
            }
          } catch { /* skip non-matching logs */ }
        }
      }

      setLoading(false);
      return tokenId;
    } catch (err: any) {
      const msg = err.reason || err.shortMessage || err.message || 'Failed to mint policy';
      setLoading(false);
      setError(msg);
      throw err;
    }
  }, [policyContract, account]);

  // ─── File Claim ──────────────────────────────────────────────────────────
  /**
   * File a claim. Matches PolicyNFT.fileClaim(policyTokenId, description,
   *   claimAmount, evidenceHash)
   */
  const fileClaim = useCallback(async (
    policyId:    number,
    description: string  = 'Claim filed via InsureX',
    claimAmount: string  = '0',
    evidenceHash: string = '',
  ) => {
    if (!policyContract) throw new Error('Contract not loaded');

    setLoading(true);
    setError(null);

    try {
      const claimWei = ethers.parseEther(claimAmount);
      const tx = await policyContract.fileClaim(
        policyId,
        description,
        claimWei,
        evidenceHash
      );
      await tx.wait();
      setLoading(false);
    } catch (err: any) {
      const msg = err.reason || err.shortMessage || err.message || 'Failed to file claim';
      setLoading(false);
      setError(msg);
      throw err;
    }
  }, [policyContract]);

  // ─── Get Policies ────────────────────────────────────────────────────────
  /**
   * Fetch all policies for the connected wallet using:
   *   getHolderPolicies(address) → uint256[]
   *   getPolicy(tokenId)         → Policy struct
   */
  const getPolicies = useCallback(async (): Promise<Policy[]> => {
    if (!policyContract || !account) return [];

    try {
      const tokenIds: bigint[] = await policyContract.getHolderPolicies(account);

      const policies = await Promise.all(
        tokenIds.map(async (idBig: bigint) => {
          const id  = Number(idBig);
          const raw = await policyContract.getPolicy(id);

          return {
            tokenId:          id,
            policyholder:     raw.policyholder,
            policyType:       raw.policyType,
            coverageAmount:   ethers.formatEther(raw.coverageAmount),
            premium:          ethers.formatEther(raw.premium),
            startDate:        Number(raw.startDate),
            endDate:          Number(raw.endDate),
            status:           Number(raw.status) as PolicyStatus,
            ipfsMetadataHash: raw.ipfsMetadataHash,
          } satisfies Policy;
        })
      );

      return policies;
    } catch (err: any) {
      console.error('Error fetching policies:', err);
      setError(err.message || 'Failed to fetch policies');
      return [];
    }
  }, [policyContract, account]);

  // ─── Oracle trigger (kept for Claim page) ────────────────────────────────
  const { autoClaimContract } = useContract(provider, signer);

  const executeParametricTrigger = useCallback(async (policyId: number) => {
    if (!autoClaimContract) throw new Error('AutoClaim contract not loaded');

    setLoading(true);
    setError(null);

    try {
      const tx = await autoClaimContract.checkAndExecute(policyId);
      await tx.wait();
      setLoading(false);
    } catch (err: any) {
      const msg = err.reason || err.shortMessage || err.message || 'Failed to execute trigger';
      setLoading(false);
      setError(msg);
      throw err;
    }
  }, [autoClaimContract]);

  // ─── Auto Approve Claim (Simulate Oracle Approve for local testing) ───────
  const autoApproveClaim = useCallback(async (policyId: number) => {
    if (!policyContract) throw new Error('PolicyNFT contract not loaded');

    setLoading(true);
    setError(null);

    try {
      const tx = await policyContract.autoApproveClaim(policyId);
      await tx.wait();
      setLoading(false);
    } catch (err: any) {
      const msg = err.reason || err.shortMessage || err.message || 'Failed to auto-approve claim';
      setLoading(false);
      setError(msg);
      throw err;
    }
  }, [policyContract]);

  // ─── Get Claim Status ────────────────────────────────────────────────────
  const getClaimStatus = useCallback(async (tokenId: number): Promise<number> => {
    if (!policyContract) return 0;
    try {
      const claim = await policyContract.getClaim(tokenId);
      return Number(claim.status);
    } catch (e) {
      console.error('Error fetching claim status:', e);
      return 0;
    }
  }, [policyContract]);

  return {
    loading,
    error,
    mintPolicy,
    fileClaim,
    getPolicies,
    executeParametricTrigger,
    autoApproveClaim,
    getClaimStatus,
  };
};
