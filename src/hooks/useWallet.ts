import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

export interface WalletState {
  account: string | null;
  chainId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export const useWallet = () => {
  const [walletState, setWalletState] = useState<WalletState>({
    account: null,
    chainId: null,
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);

  const getEthereum = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return (window as any).ethereum;
    }
    return null;
  }, []);

  const checkConnection = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    try {
      const accounts = await ethereum.request({ method: 'eth_accounts' });
      const chainIdHex = await ethereum.request({ method: 'eth_chainId' });

      if (accounts.length > 0) {
        const tempProvider = new ethers.BrowserProvider(ethereum);
        const tempSigner = await tempProvider.getSigner();

        setProvider(tempProvider);
        setSigner(tempSigner);
        setWalletState({
          account: accounts[0],
          chainId: parseInt(chainIdHex, 16).toString(),
          isConnected: true,
          isConnecting: false,
          error: null,
        });
      }
    } catch (err: any) {
      console.error("Error checking wallet connection:", err);
    }
  }, [getEthereum]);

  const connectWallet = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setWalletState(prev => ({ ...prev, error: "MetaMask is not installed. Please install MetaMask to use InsureX." }));
      return;
    }

    setWalletState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const chainIdHex = await ethereum.request({ method: 'eth_chainId' });

      const tempProvider = new ethers.BrowserProvider(ethereum);
      const tempSigner = await tempProvider.getSigner();

      setProvider(tempProvider);
      setSigner(tempSigner);
      setWalletState({
        account: accounts[0],
        chainId: parseInt(chainIdHex, 16).toString(),
        isConnected: true,
        isConnecting: false,
        error: null,
      });
    } catch (err: any) {
      console.error("Wallet connection error:", err);
      setWalletState(prev => ({
        ...prev,
        isConnecting: false,
        error: err.message || "Failed to connect wallet",
      }));
    }
  }, [getEthereum]);

  const disconnectWallet = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setWalletState({
      account: null,
      chainId: null,
      isConnected: false,
      isConnecting: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    checkConnection();

    const ethereum = getEthereum();
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        checkConnection();
      } else {
        disconnectWallet();
      }
    };

    const handleChainChanged = () => {
      checkConnection();
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [getEthereum, checkConnection, disconnectWallet]);

  return {
    ...walletState,
    provider,
    signer,
    connectWallet,
    disconnectWallet,
  };
};
