/**
 * @component UpProvider
 * @description Context provider that manages Universal Profile (UP) wallet connections and state
 * for LUKSO blockchain interactions. It handles wallet connection status, account management, and chain
 * information while providing real-time updates through event listeners.
 */

"use client";

import React from 'react';
import {
  createClientUPProvider,
  type UPClientProvider,
} from "@lukso/up-provider";
import { createWalletClient, custom } from "viem";
import { lukso, luksoTestnet } from "viem/chains";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useMemo,
} from "react";

interface UpProviderContext {
  provider: UPClientProvider | null;
  client: ReturnType<typeof createWalletClient> | null;
  chainId: number;
  accounts: Array<`0x${string}`>;
  contextAccounts: Array<`0x${string}`>;
  walletConnected: boolean;
  selectedAddress: `0x${string}` | null;
  setSelectedAddress: (address: `0x${string}` | null) => void;
  isSearching: boolean;
  setIsSearching: (isSearching: boolean) => void;
}

const UpContext = createContext<UpProviderContext | undefined>(undefined);

// Export for backward compatibility with existing components
export const UPProviderContext = UpContext;

// Note: Provider is created at module level, not within a component
const provider =
  typeof window !== "undefined" ? createClientUPProvider() : null;

export function useUpProvider() {
  const context = useContext(UpContext);
  if (!context) {
    throw new Error("useUpProvider must be used within a UpProvider");
  }
  return context;
}

interface UpProviderProps {
  children: ReactNode;
}

/**
 * Gets context accounts from DOM inspection (critical for incognito mode)
 * This follows the same approach used in the LUKSO miniapp-template
 */
const getContextAccountsFromDOM = (): Array<`0x${string}`> => {
  try {
    if (typeof window !== "undefined" && window.document) {
      // Method 1: Check script tags with data-context attribute
      const scriptTags = Array.from(document.querySelectorAll('script[data-context]'));
      for (const script of scriptTags) {
        try {
          const contextData = JSON.parse(script.getAttribute('data-context') || '{}');
          if (contextData?.contextAccounts?.length) {
            console.log('UP Provider: Found contextAccounts in DOM script:', contextData.contextAccounts);
            return contextData.contextAccounts as Array<`0x${string}`>;
          }
        } catch (e) {
          console.warn('UP Provider: Error parsing context data from script:', e);
        }
      }
      
      // Method 2: Check global __LUKSO_CONTEXT
      if (window.__LUKSO_CONTEXT && Array.isArray(window.__LUKSO_CONTEXT.contextAccounts)) {
        console.log('UP Provider: Found contextAccounts in __LUKSO_CONTEXT:', window.__LUKSO_CONTEXT.contextAccounts);
        return window.__LUKSO_CONTEXT.contextAccounts as Array<`0x${string}`>;
      }
      
      // Method 3: Check browser extension state
      const extensionStateKeys = ['__UP_EXTENSION_STATE__', '__UP_STATE__', '__LUKSO_STATE__', 'UP_STATE'];
      for (const key of extensionStateKeys) {
        // Use safe access pattern
        const stateObj = (window as any)[key];
        if (stateObj && stateObj.contextAccounts) {
          console.log(`UP Provider: Found contextAccounts in extension state ${key}:`, stateObj.contextAccounts);
          return stateObj.contextAccounts as Array<`0x${string}`>;
        }
      }
      
      // Method 4: Look for data attributes on HTML elements
      ['data-up-context', 'data-lukso-context', 'data-extension-context'].forEach(attrName => {
        const elements = document.querySelectorAll(`[${attrName}]`);
        for (let i = 0; i < elements.length; i++) {
          try {
            const element = elements[i];
            const contextStr = element.getAttribute(attrName);
            if (contextStr) {
              const contextData = JSON.parse(contextStr);
              if (contextData && contextData.contextAccounts && Array.isArray(contextData.contextAccounts)) {
                console.log(`UP Provider: Found contextAccounts in ${attrName}:`, contextData.contextAccounts);
                return contextData.contextAccounts as Array<`0x${string}`>;
              }
            }
          } catch (e) {
            console.warn(`UP Provider: Error parsing ${attrName}:`, e);
          }
        }
      });
    }
  } catch (error) {
    console.warn('UP Provider: Error in DOM contextAccounts lookup:', error);
  }
  return [];
};

export function UpProvider({ children }: UpProviderProps) {
  const [chainId, setChainId] = useState<number>(0);
  const [accounts, setAccounts] = useState<Array<`0x${string}`>>([]);
  const [contextAccounts, setContextAccounts] = useState<Array<`0x${string}`>>(
    []
  );
  const [walletConnected, setWalletConnected] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<`0x${string}` | null>(
    null
  );
  const [isSearching, setIsSearching] = useState(false);

  const [account] = accounts ?? [];
  const [contextAccount] = contextAccounts ?? [];

  const client = useMemo(() => {
    if (provider && chainId) {
      return createWalletClient({
        chain: chainId === 42 ? lukso : luksoTestnet,
        transport: custom(provider),
      });
    }
    return null;
  }, [chainId]);

  // Poll for context accounts in case the provider doesn't emit events
  // This is essential for incognito mode where events may not fire
  useEffect(() => {
    let mounted = true;
    let pollCount = 0;
    const MAX_POLLS = 20;
    
    console.log('UP Provider: Starting context accounts polling');
    
    const pollForContextAccounts = () => {
      if (!mounted || pollCount >= MAX_POLLS) return;
      
      pollCount++;
      console.log(`UP Provider: Context accounts poll attempt ${pollCount}/${MAX_POLLS}`);
      
      // Check DOM for context accounts first (works in incognito)
      const domContextAccounts = getContextAccountsFromDOM();
      if (domContextAccounts && domContextAccounts.length > 0) {
        console.log('UP Provider: Found context accounts via DOM inspection:', domContextAccounts);
        setContextAccounts(domContextAccounts);
        setWalletConnected(account != null || domContextAccounts[0] != null);
        return true;
      }
      
      // Also check provider directly if it exists
      if (provider && provider.contextAccounts && provider.contextAccounts.length > 0) {
        console.log('UP Provider: Found context accounts directly on provider:', provider.contextAccounts);
        setContextAccounts(provider.contextAccounts);
        setWalletConnected(account != null || provider.contextAccounts[0] != null);
        return true;
      }
      
      // Try UP API request method if available
      if (provider) {
        try {
          provider.request('up_contextAccounts', [])
            .then((result: Array<`0x${string}`>) => {
              if (mounted && result && result.length > 0) {
                console.log('UP Provider: Found context accounts via up_contextAccounts:', result);
                setContextAccounts(result);
                setWalletConnected(account != null || result[0] != null);
              }
            })
            .catch(err => console.warn('UP Provider: Error in up_contextAccounts request:', err));
        } catch (e) {
          console.warn('UP Provider: Failed to call up_contextAccounts:', e);
        }
      }
      
      return false;
    };
    
    // Poll immediately
    if (!pollForContextAccounts()) {
      // If not successful, poll every 250ms for up to 5 seconds
      const interval = setInterval(() => {
        if (pollForContextAccounts() || pollCount >= MAX_POLLS) {
          clearInterval(interval);
        }
      }, 250);
      
      return () => {
        mounted = false;
        clearInterval(interval);
      };
    }
    
    return () => {
      mounted = false;
    };
  }, [account]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        if (!provider) return;

        console.log('UP Provider: Initializing provider data');
        
        // Get accounts first
        const _accounts = (await provider.request(
          "eth_accounts",
          []
        )) as Array<`0x${string}`>;
        
        if (!mounted) return;
        setAccounts(_accounts);
        console.log('UP Provider: Accounts loaded:', _accounts);

        // Get chain ID
        const _chainId = (await provider.request("eth_chainId")) as number;
        if (!mounted) return;
        setChainId(_chainId);
        console.log('UP Provider: Chain ID loaded:', _chainId);

        // Get context accounts directly from provider property
        const _contextAccounts = provider.contextAccounts;
        if (!mounted) return;
        
        // If provider.contextAccounts is empty, try DOM-based approach first
        if (!_contextAccounts || _contextAccounts.length === 0) {
          const domContextAccounts = getContextAccountsFromDOM();
          if (domContextAccounts && domContextAccounts.length > 0) {
            console.log('UP Provider: Using DOM-inspected context accounts:', domContextAccounts);
            setContextAccounts(domContextAccounts);
            setWalletConnected(_accounts[0] != null && domContextAccounts[0] != null);
          } else {
            setContextAccounts(_contextAccounts || []);
            setWalletConnected(_accounts[0] != null && (_contextAccounts?.[0] != null));
          }
        } else {
          console.log('UP Provider: Context accounts loaded from provider:', _contextAccounts);
          setContextAccounts(_contextAccounts);
          setWalletConnected(_accounts[0] != null && _contextAccounts[0] != null);
        }
      } catch (error) {
        console.error('UP Provider: Error during initialization:', error);
      }
    }

    init();

    if (provider) {
      console.log('UP Provider: Setting up event listeners');
      
      const accountsChanged = (_accounts: Array<`0x${string}`>) => {
        console.log('UP Provider: Accounts changed:', _accounts);
        setAccounts(_accounts);
        setWalletConnected(_accounts[0] != null && contextAccount != null);
      };

      const contextAccountsChanged = (_accounts: Array<`0x${string}`>) => {
        console.log('UP Provider: Context accounts changed:', _accounts);
        setContextAccounts(_accounts);
        setWalletConnected(account != null && _accounts[0] != null);
      };

      const chainChanged = (_chainId: number) => {
        console.log('UP Provider: Chain changed:', _chainId);
        setChainId(_chainId);
      };

      provider.on("accountsChanged", accountsChanged);
      provider.on("chainChanged", chainChanged);
      provider.on("contextAccountsChanged", contextAccountsChanged);

      return () => {
        console.log('UP Provider: Cleaning up event listeners');
        mounted = false;
        provider.removeListener("accountsChanged", accountsChanged);
        provider.removeListener(
          "contextAccountsChanged",
          contextAccountsChanged
        );
        provider.removeListener("chainChanged", chainChanged);
      };
    }
  }, [client, account, contextAccount]);

  // Make sure the context value doesn't change on every render
  const data = useMemo(() => {
    return {
      provider,
      client,
      chainId,
      accounts,
      contextAccounts,
      walletConnected,
      selectedAddress,
      setSelectedAddress,
      isSearching,
      setIsSearching,
    };
  }, [
    client,
    chainId,
    accounts,
    contextAccounts,
    walletConnected,
    selectedAddress,
    isSearching,
  ]);

  return (
    <UpContext.Provider value={data}>
      {children}
    </UpContext.Provider>
  );
}

export { provider as upProvider }; 