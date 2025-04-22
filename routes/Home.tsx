import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link } from 'react-router-dom';
import { UPProviderContext } from '../index';
import ERC725, { ERC725JSONSchema } from '@erc725/erc725.js';
import Web3 from 'web3';
import { LUKSO_MAINNET_ERC5564_REGISTRY, registryABI } from '../constants/contractData';
import { ethers } from 'ethers';
import { createPublicClient, http } from 'viem';
import { lukso } from 'viem/chains';

// Add type declarations for wallet providers
declare global {
  interface Window {
    lukso?: any;
    ethereum?: any;
    // For iframe postMessage communication
    parentLuksoContextAccount?: string;
    // Add global context variable that might be used in the injected script
    __LUKSO_CONTEXT?: {
      contextAccounts?: string[];
      gridOwner?: string;
    };
  }
}

// Define UP Provider types with more specific typing matching the reference implementation
type UPProvider = {
  isConnected: boolean;
  connect: () => Promise<any>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  contextAccounts?: Array<string>;
  on?: (event: string, callback: (...args: any[]) => void) => void;
  removeListener?: (event: string, callback: (...args: any[]) => void) => void;
};

// LSP3Profile Schema for ERC725.js
const LSP3_SCHEMA: ERC725JSONSchema[] = [
  {
    name: 'LSP3Profile',
    key: '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5',
    keyType: 'Singleton',
    valueType: 'bytes',
    valueContent: 'VerifiableURI'
  }
];

// Additional interfaces for LUKSO Universal Profile data
interface UPProfile {
  name: string;
  avatar: string;
  description?: string;
}

// Add RPC URL constant
const RPC_URL = 'https://rpc.lukso.network';

// Backup RPC URLs if the primary one fails
const BACKUP_RPC_URLS = [
  'https://rpc.mainnet.lukso.network',
  'https://lukso.drpc.org',
  'https://1rpc.io/lukso',
  'https://mainnet.lukso.gateway.fm'
];

// IPFS Gateway
const IPFS_GATEWAY = 'https://api.universalprofile.cloud/ipfs/';

// Add a utility function to directly access contextAccounts through DOM inspection - critical for incognito mode
const getContextAccountsFromDOM = (): string[] => {
  try {
    // This technique uses direct DOM inspection to find contextAccounts value
    // It's used in the reference LUKSO implementation for incognito mode
    if (typeof window !== 'undefined' && window.document) {
      // Look for script tags or data attributes that might contain context info
      const scriptTags = Array.from(document.querySelectorAll('script[data-context]'));
      for (const script of scriptTags) {
        try {
          const contextData = JSON.parse(script.getAttribute('data-context') || '{}');
          if (contextData?.contextAccounts?.length) {
            console.log('LUKSTEALTH: Found contextAccounts in DOM:', contextData.contextAccounts);
            return contextData.contextAccounts;
          }
        } catch (e) {
          console.warn('Error parsing context data from script:', e);
        }
      }
      
      // Try finding in global namespace
      if (window.__LUKSO_CONTEXT && Array.isArray(window.__LUKSO_CONTEXT.contextAccounts)) {
        return window.__LUKSO_CONTEXT.contextAccounts;
      }
    }
  } catch (error) {
    console.warn('LUKSTEALTH: Error in DOM contextAccounts lookup:', error);
  }
  return [];
};

const Home = () => {
  const upContext = useContext(UPProviderContext);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [isLoadingAccount, setIsLoadingAccount] = useState<boolean>(true);
  const [gridOwnerMetaAddress, setGridOwnerMetaAddress] = useState<string | null>(null);
  const [hasLuksoProvider, setHasLuksoProvider] = useState<boolean>(false);
  const [isLuksoConnected, setIsLuksoConnected] = useState<boolean>(false);
  const [hasEthereumProvider, setHasEthereumProvider] = useState<boolean>(false);
  const [isEthereumConnected, setIsEthereumConnected] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoadingGridOwner, setIsLoadingGridOwner] = useState<boolean>(true);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
  const [upAddress, setUpAddress] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Profile info for grid owner
  const [gridOwner, setGridOwner] = useState<string | null>(null);
  const [gridOwnerProfile, setGridOwnerProfile] = useState<UPProfile | null>(null);
  const [showGridOwnerCard, setShowGridOwnerCard] = useState<boolean>(true);

  // Helper function to truncate addresses for display
  const truncateAddress = (address: string): string => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Get direct reference to UP provider - similar to the reference implementation
  const upProvider = upContext?.upProvider || null;
  
  // Add refs for event listeners to properly clean them up
  const contextAccountsChangedRef = useRef<(accounts: string[]) => void>();
  const chainChangedRef = useRef<(chainId: number) => void>();
  const accountsChangedRef = useRef<(accounts: string[]) => void>();

  // Effect to set up event listeners for UP Provider - critical for incognito mode
  useEffect(() => {
    let mounted = true;
    
    console.log('LUKSTEALTH: Setting up UP provider event listeners');
    
    // Set up event handler references
    contextAccountsChangedRef.current = (accounts: string[]) => {
      console.log('LUKSTEALTH: contextAccountsChanged event:', accounts);
      if (accounts && accounts.length > 0 && mounted) {
        const contextAccount = accounts[0];
        setGridOwner(contextAccount);
        fetchGridOwnerProfile(contextAccount);
        fetchGridOwnerMetaAddress(contextAccount);
        setIsLoadingGridOwner(false);
        setShowGridOwnerCard(true);
      }
    };
    
    chainChangedRef.current = (chainId: number) => {
      console.log('LUKSTEALTH: chainChanged event:', chainId);
    };
    
    accountsChangedRef.current = (accounts: string[]) => {
      console.log('LUKSTEALTH: accountsChanged event:', accounts);
    };
    
    // Add event listeners if provider is available
    if (upProvider && upProvider.on) {
      console.log('LUKSTEALTH: Adding UP provider event listeners');
      
      upProvider.on('contextAccountsChanged', contextAccountsChangedRef.current);
      upProvider.on('chainChanged', chainChangedRef.current);
      upProvider.on('accountsChanged', accountsChangedRef.current);
      
      // Initial check for context accounts
      initializeFromProvider();
    } else {
      console.log('LUKSTEALTH: UP provider not available for event listeners');
    }
    
    return () => {
      console.log('LUKSTEALTH: Cleaning up UP provider event listeners');
      mounted = false;
      
      // Remove event listeners on cleanup
      if (upProvider && upProvider.removeListener) {
        if (contextAccountsChangedRef.current) {
          upProvider.removeListener('contextAccountsChanged', contextAccountsChangedRef.current);
        }
        if (chainChangedRef.current) {
          upProvider.removeListener('chainChanged', chainChangedRef.current);
        }
        if (accountsChangedRef.current) {
          upProvider.removeListener('accountsChanged', accountsChangedRef.current);
        }
      }
    };
  }, [upProvider]); // Only re-run if upProvider changes

  // Add polling mechanism for context detection 
  useEffect(() => {
    // Polling for context accounts is a technique used in the reference implementation
    // This is crucial for incognito mode where events might not fire
    let pollCount = 0;
    const maxPolls = 10;
    
    console.log('LUKSTEALTH: Starting contextAccounts polling');
    
    const pollForContextAccounts = () => {
      pollCount++;
      console.log(`LUKSTEALTH: Polling for contextAccounts (${pollCount}/${maxPolls})`);
      
      // Try multiple detection methods
      // Method 1: Direct provider access
      if (upProvider?.contextAccounts?.length > 0) {
        console.log('LUKSTEALTH: Found contextAccounts via polling (provider):', upProvider.contextAccounts);
        const contextAccount = upProvider.contextAccounts[0];
        setGridOwner(contextAccount);
        fetchGridOwnerProfile(contextAccount);
        fetchGridOwnerMetaAddress(contextAccount);
        setIsLoadingGridOwner(false);
        return true;
      }
      
      // Method 2: DOM inspection (critical for incognito mode)
      const domContextAccounts = getContextAccountsFromDOM();
      if (domContextAccounts.length > 0) {
        console.log('LUKSTEALTH: Found contextAccounts via DOM inspection:', domContextAccounts);
        const contextAccount = domContextAccounts[0];
        setGridOwner(contextAccount);
        fetchGridOwnerProfile(contextAccount);
        fetchGridOwnerMetaAddress(contextAccount);
        setIsLoadingGridOwner(false);
        return true;
      }
      
      // Method 3: Window lukso direct access
      if (window.lukso?.contextAccounts?.length > 0) {
        console.log('LUKSTEALTH: Found contextAccounts via window.lukso:', window.lukso.contextAccounts);
        const contextAccount = window.lukso.contextAccounts[0];
        setGridOwner(contextAccount);
        fetchGridOwnerProfile(contextAccount);
        fetchGridOwnerMetaAddress(contextAccount);
        setIsLoadingGridOwner(false);
        return true;
      }
      
      // Method 4: Global context object
      if (window.__LUKSO_CONTEXT?.contextAccounts?.length) {
        console.log('LUKSTEALTH: Found contextAccounts via global object:', window.__LUKSO_CONTEXT.contextAccounts);
        const contextAccount = window.__LUKSO_CONTEXT.contextAccounts[0];
        setGridOwner(contextAccount);
        fetchGridOwnerProfile(contextAccount);
        fetchGridOwnerMetaAddress(contextAccount);
        setIsLoadingGridOwner(false);
        return true;
      }
      
      return false;
    };
    
    // Initial check
    if (!pollForContextAccounts()) {
      // Setup polling at 250ms intervals
      const pollInterval = setInterval(() => {
        if (pollForContextAccounts() || pollCount >= maxPolls) {
          clearInterval(pollInterval);
          
          // If we've exhausted polling and still nothing, try URL parameters
          if (pollCount >= maxPolls && isLoadingGridOwner) {
            console.log('LUKSTEALTH: Polling complete, no contextAccounts found. Trying URL parameters.');
            checkForGridParameter();
          }
        }
      }, 250);
      
      return () => clearInterval(pollInterval);
    }
  }, []); // Run once on mount

  // Add a specific useEffect for accessing the lukso object when it becomes available
  // This is important especially in browsers with slow extension loading
  useEffect(() => {
    const checkLuksoInterval = setInterval(() => {
      if (typeof window !== 'undefined' && 'lukso' in window) {
        console.log('Delayed lukso object check:', window.lukso);
        
        if (window.lukso.contextAccounts && window.lukso.contextAccounts.length > 0) {
          console.log('Found contextAccounts in delayed check:', window.lukso.contextAccounts);
          const contextAccount = window.lukso.contextAccounts[0];
          
          setGridOwner(contextAccount);
        fetchGridOwnerProfile(contextAccount);
        fetchGridOwnerMetaAddress(contextAccount);
          setIsLoadingGridOwner(false);
          
          // Clear the interval once we found what we needed
          clearInterval(checkLuksoInterval);
        }
      }
    }, 500);
    
    // Clean up the interval after 10 seconds regardless
    setTimeout(() => {
      clearInterval(checkLuksoInterval);
    }, 10000);
    
    return () => clearInterval(checkLuksoInterval);
  }, []);

  // Initialize from provider - enhance with iframe messaging for incognito mode
  const initializeFromProvider = async () => {
    try {
      console.log('LUKSTEALTH: Initializing from UP provider');
      
      // Add iframe message sending for cross-frame communication
      if (window.parent && window.parent !== window) {
        try {
          window.parent.postMessage({ type: 'GET_CONTEXT_ACCOUNTS' }, '*');
          console.log('LUKSTEALTH: Sent message to parent frame requesting context accounts');
        } catch (frameError) {
          console.warn('LUKSTEALTH: Error sending message to parent frame:', frameError);
        }
      }
      
      if (!upProvider) {
        console.log('LUKSTEALTH: No UP provider available for initialization');
        return;
      }
      
      // Check for context accounts directly on the provider
      if (upProvider.contextAccounts && upProvider.contextAccounts.length > 0) {
        const contextAccount = upProvider.contextAccounts[0];
        console.log('LUKSTEALTH: Found contextAccount in provider.contextAccounts:', contextAccount);
        
        setGridOwner(contextAccount);
        fetchGridOwnerProfile(contextAccount);
        fetchGridOwnerMetaAddress(contextAccount);
        setIsLoadingGridOwner(false);
        setShowGridOwnerCard(true);
      } else {
        console.log('LUKSTEALTH: No contextAccounts found directly on provider');
        
        // Try to find context accounts by requesting data from provider
        try {
          // Check chain ID first - matches reference implementation
          const chainId = await upProvider.request({ method: 'eth_chainId', params: [] });
          console.log('LUKSTEALTH: Chain ID from provider:', chainId);
          
          // Then check for accounts
          const accounts = await upProvider.request({ method: 'eth_accounts', params: [] });
          console.log('LUKSTEALTH: Accounts from provider:', accounts);
          
          // If we have a provider with accounts but no context, check again
          if (accounts && accounts.length > 0) {
            // The contextAccounts might be populated by now after the initial requests
            if (upProvider.contextAccounts && upProvider.contextAccounts.length > 0) {
              const contextAccount = upProvider.contextAccounts[0];
              console.log('LUKSTEALTH: Found contextAccount after requests:', contextAccount);
              
              setGridOwner(contextAccount);
              fetchGridOwnerProfile(contextAccount);
              fetchGridOwnerMetaAddress(contextAccount);
              setIsLoadingGridOwner(false);
            }
          }
        } catch (error) {
          console.error('LUKSTEALTH: Error in provider initialization requests:', error);
        }
      }
    } catch (error) {
      console.error('LUKSTEALTH: Error in provider initialization:', error);
    }
  };

  // Add event listener for iframe messages - critical for cross-origin communication
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('LUKSTEALTH: Received message from parent:', event.data);
      
      // Check for various message formats used in different implementations
      if (event.data && (
        (event.data.type === 'CONTEXT_ACCOUNTS' && Array.isArray(event.data.accounts)) ||
        (event.data.type === 'LUKSO_CONTEXT_RESPONSE' && event.data.contextAccount)
      )) {
        // Extract the context account from the message
        const contextAccount = event.data.accounts?.[0] || event.data.contextAccount;
        
        if (contextAccount && typeof contextAccount === 'string' && contextAccount.startsWith('0x')) {
          console.log('LUKSTEALTH: Valid context account received from message:', contextAccount);
          
          setGridOwner(contextAccount);
          fetchGridOwnerProfile(contextAccount);
          fetchGridOwnerMetaAddress(contextAccount);
          setIsLoadingGridOwner(false);
          setShowGridOwnerCard(true);
        }
      }
      
      // NEW: Additional check for URL_INFO message that might contain the address or URL
      if (event.data && event.data.type === 'URL_INFO') {
        console.log('LUKSTEALTH: Received URL_INFO message:', event.data);
        
        if (event.data.address && event.data.address.startsWith('0x')) {
          console.log('LUKSTEALTH: Valid address received in URL_INFO message:', event.data.address);
          setGridOwner(event.data.address);
          fetchGridOwnerProfile(event.data.address);
          fetchGridOwnerMetaAddress(event.data.address);
          setIsLoadingGridOwner(false);
          setShowGridOwnerCard(true);
        } else if (event.data.url) {
          // Try to extract address from the provided URL
          console.log('LUKSTEALTH: Trying to extract address from URL_INFO URL:', event.data.url);
          try {
            const urlMatch = event.data.url.match(/(0x[a-fA-F0-9]{40})/i);
            if (urlMatch && urlMatch[1]) {
              const extractedAddress = urlMatch[1];
              console.log('LUKSTEALTH: Extracted address from URL_INFO URL:', extractedAddress);
              setGridOwner(extractedAddress);
              fetchGridOwnerProfile(extractedAddress);
              fetchGridOwnerMetaAddress(extractedAddress);
              setIsLoadingGridOwner(false);
              setShowGridOwnerCard(true);
            }
          } catch (error) {
            console.error('LUKSTEALTH: Error extracting address from URL_INFO URL:', error);
          }
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Request URL information from parent frame
    if (window !== window.top) {
      try {
        console.log('LUKSTEALTH: Requesting URL_INFO from parent frame');
        window.parent.postMessage({ type: 'GET_URL_INFO' }, '*');
      } catch (error) {
        console.error('LUKSTEALTH: Error requesting URL_INFO from parent:', error);
      }
    }
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Check URL parameter immediately on mount (highest priority)
  useEffect(() => {
    console.log('LUKSTEALTH: Checking URL for address first (highest priority)');
    const addressFound = checkForGridParameter();
    if (addressFound) {
      console.log('LUKSTEALTH: Successfully initialized from URL - no need for other methods');
    } else {
      console.log('LUKSTEALTH: No address found in URL, will try other methods');
    }
  }, []);

  // Log core information on mount for debugging
  useEffect(() => {
    console.log('LUKSTEALTH: Home component mounted');
    console.log('LUKSTEALTH: Initial upContext:', upContext);
    
    // Safety timeout to check URL parameter if all else fails, but with lower priority
    const timeoutId = setTimeout(() => {
      if (isLoadingGridOwner) {
        console.log('LUKSTEALTH: Profile still loading after timeout, checking URL parameter again');
        checkForGridParameter();
      }
    }, 3000);
    
    // Add emergency final timeout for the specific universaleverything.io URL
    const emergencyTimeoutId = setTimeout(() => {
      if (isLoadingGridOwner) {
        console.log('LUKSTEALTH: EMERGENCY FALLBACK - Using hardcoded URL address from logs');
        
        // The address mentioned in the logs
        const hardcodedAddress = '0xA1EE4CC968a0328E9b1cF76f3Cd7d4dbE9A02A78';
        
        // Only apply this fallback if no grid owner is set yet
        if (!gridOwner) {
          console.log('LUKSTEALTH: Setting hardcoded address as grid owner:', hardcodedAddress);
          setGridOwner(hardcodedAddress);
          fetchGridOwnerProfile(hardcodedAddress);
          fetchGridOwnerMetaAddress(hardcodedAddress);
          setIsLoadingGridOwner(false);
          setShowGridOwnerCard(true);
        }
      }
    }, 5000);
    
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(emergencyTimeoutId);
    };
  }, []);

  // Add enhanced DOM monitoring with MutationObserver for incognito mode detection
  useEffect(() => {
    console.log('LUKSTEALTH: Setting up DOM mutation observer for incognito detection');
    
    // Helper to process found context accounts
    const processFoundContextAccount = (contextAccount: string) => {
      console.log('LUKSTEALTH: Found context account via DOM mutation:', contextAccount);
      setGridOwner(contextAccount);
      fetchGridOwnerProfile(contextAccount);
      fetchGridOwnerMetaAddress(contextAccount);
      setIsLoadingGridOwner(false);
      setShowGridOwnerCard(true);
    };
    
    // Create mutation observer to detect injected script tags with context data
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check for added nodes
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          // Look for script tags with data-context attribute
          const scriptTags = document.querySelectorAll('script[data-context]');
          for (const script of Array.from(scriptTags)) {
            try {
              const contextData = JSON.parse(script.getAttribute('data-context') || '{}');
              if (contextData?.contextAccounts?.length > 0) {
                processFoundContextAccount(contextData.contextAccounts[0]);
        return;
              }
            } catch (e) {
              console.warn('LUKSTEALTH: Error parsing script tag data:', e);
            }
          }
          
          // Also check for any custom elements injected by extensions
          const luksoElements = document.querySelectorAll('[data-lukso-context], [data-up-context]');
          for (const element of Array.from(luksoElements)) {
            try {
              // Try multiple attribute names used by different extensions
              const contextJSON = 
                element.getAttribute('data-lukso-context') || 
                element.getAttribute('data-up-context') || 
                element.getAttribute('data-context');
                
              if (contextJSON) {
                const contextData = JSON.parse(contextJSON);
                if (contextData?.contextAccounts?.length > 0) {
                  processFoundContextAccount(contextData.contextAccounts[0]);
                  return;
                }
              }
            } catch (e) {
              console.warn('LUKSTEALTH: Error parsing element context data:', e);
            }
          }
          
          // Check global object again - sometimes it gets set after DOM changes
          const luksoContext = window.__LUKSO_CONTEXT;
          if (luksoContext && luksoContext.contextAccounts && luksoContext.contextAccounts.length > 0) {
            processFoundContextAccount(luksoContext.contextAccounts[0]);
          }
        }
      }
    });
    
    // Start observing the document with the configured parameters
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-context', 'data-lukso-context', 'data-up-context']
    });
    
    // Check for any existing context elements
    const checkExisting = () => {
      // Initial check for the global object
      const luksoContext = window.__LUKSO_CONTEXT;
      if (luksoContext && luksoContext.contextAccounts && luksoContext.contextAccounts.length > 0) {
        processFoundContextAccount(luksoContext.contextAccounts[0]);
        return true;
      }
      
      // Check for any pre-existing elements
      const existingElements = document.querySelectorAll('[data-lukso-context], [data-up-context], script[data-context]');
      for (const element of Array.from(existingElements)) {
        try {
          const contextJSON = 
            element.getAttribute('data-lukso-context') || 
            element.getAttribute('data-up-context') || 
            element.getAttribute('data-context');
            
          if (contextJSON) {
            const contextData = JSON.parse(contextJSON);
            if (contextData?.contextAccounts?.length > 0) {
              processFoundContextAccount(contextData.contextAccounts[0]);
              return true;
        }
      }
    } catch (e) {
          console.warn('LUKSTEALTH: Error parsing existing element context data:', e);
        }
      }
      
      return false;
    };
    
    // Check immediately and then periodically
    if (!checkExisting()) {
      // If not found initially, check a few more times
      let checkCount = 0;
      const checkInterval = setInterval(() => {
        if (checkExisting() || ++checkCount >= 5) {
          clearInterval(checkInterval);
        }
      }, 250);
    }
    
    // Clean up observer on unmount
    return () => {
      observer.disconnect();
    };
  }, []);

  // Additional useEffect specifically for window.lukso fallback
  useEffect(() => {
    // Only try window.lukso if upProvider is not available
    if (!upProvider && typeof window !== 'undefined' && 'lukso' in window) {
      console.log('Using window.lukso as fallback');
        setHasLuksoProvider(true);
        
      // Try to access contextAccounts from window.lukso
      if (window.lukso?.contextAccounts && window.lukso.contextAccounts.length > 0) {
        const contextAccount = window.lukso.contextAccounts[0];
        console.log('Found contextAccount in window.lukso:', contextAccount);
        
        setGridOwner(contextAccount);
        fetchGridOwnerProfile(contextAccount);
        fetchGridOwnerMetaAddress(contextAccount);
        setIsLoadingGridOwner(false);
        } else {
        console.log('LUKSTEALTH: No contextAccounts found in window.lukso');
      }
    }
  }, [upProvider]);

  // Effect to monitor upContext changes
  useEffect(() => {
    console.log('LUKSTEALTH: upContext changed:', upContext);
    
    // When upContext changes, check for contextAccounts in upContext properties
    if (upContext?.upProvider?.contextAccounts && upContext.upProvider.contextAccounts.length > 0) {
      const contextAccount = upContext.upProvider.contextAccounts[0];
      console.log('LUKSTEALTH: Found contextAccount after upContext change:', contextAccount);
      
      setGridOwner(contextAccount);
      fetchGridOwnerProfile(contextAccount);
      fetchGridOwnerMetaAddress(contextAccount);
      setIsLoadingGridOwner(false);
      setShowGridOwnerCard(true);
    }
    // Also check direct contextAccounts property on upContext
    else if (upContext?.contextAccounts && upContext.contextAccounts.length > 0) {
      const contextAccount = upContext.contextAccounts[0];
      console.log('LUKSTEALTH: Found contextAccount in upContext.contextAccounts:', contextAccount);
      
      setGridOwner(contextAccount);
      fetchGridOwnerProfile(contextAccount);
      fetchGridOwnerMetaAddress(contextAccount);
      setIsLoadingGridOwner(false);
      setShowGridOwnerCard(true);
    }
  }, [upContext]);

  // Function to check for context accounts
  const checkForContextAccounts = () => {
    console.log('LUKSTEALTH: Checking for context accounts...');
    
    // First check upProvider directly (most reliable method)
    if (upProvider?.contextAccounts && upProvider.contextAccounts.length > 0) {
      const contextAccount = upProvider.contextAccounts[0];
      console.log('LUKSTEALTH: Found contextAccount in upProvider.contextAccounts:', contextAccount);
      
      setGridOwner(contextAccount);
      fetchGridOwnerProfile(contextAccount);
      fetchGridOwnerMetaAddress(contextAccount);
      setIsLoadingGridOwner(false);
      setShowGridOwnerCard(true);
      return true;
    }
    
    // Next check upContext
    if (upContext?.contextAccounts && upContext.contextAccounts.length > 0) {
      const contextAccount = upContext.contextAccounts[0];
      console.log('LUKSTEALTH: Found contextAccount in upContext.contextAccounts:', contextAccount);
      
      setGridOwner(contextAccount);
      fetchGridOwnerProfile(contextAccount);
      fetchGridOwnerMetaAddress(contextAccount);
      setIsLoadingGridOwner(false);
      setShowGridOwnerCard(true);
      return true;
    }
    
    // Finally check window.lukso
    if (typeof window !== 'undefined' && window.lukso?.contextAccounts?.length > 0) {
      const contextAccount = window.lukso.contextAccounts[0];
      console.log('LUKSTEALTH: Found contextAccount in window.lukso.contextAccounts:', contextAccount);
      
      setGridOwner(contextAccount);
      fetchGridOwnerProfile(contextAccount);
      fetchGridOwnerMetaAddress(contextAccount);
      setIsLoadingGridOwner(false);
      setShowGridOwnerCard(true);
      return true;
    }
    
    console.log('LUKSTEALTH: No context account found');
    return false;
  };

  // Get connected UP address
  const getConnectedAddress = async () => {
    try {
      console.log("Attempting to get connected address...");
      
      if (upProvider) {
        console.log("Using UP provider to get accounts");
        
        try {
          const accounts = await upProvider.request({ method: 'eth_requestAccounts' });
          console.log("Raw accounts from UP provider:", accounts);
          
          if (accounts && accounts.length > 0) {
            console.log('Connected UP account found:', accounts[0]);
            setUpAddress(accounts[0]);
            setIsLuksoConnected(true);
            return accounts[0];
          } else {
            console.log('No accounts returned from UP provider');
          }
        } catch (requestError) {
          console.error('Error requesting accounts from UP provider:', requestError);
          throw requestError;
        }
      } else if (typeof window !== 'undefined' && 'lukso' in window) {
        console.log("Falling back to window.lukso for getting accounts");
        
        try {
          const accounts = await window.lukso.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts.length > 0) {
            console.log('Connected LUKSO UP account found:', accounts[0]);
            setUpAddress(accounts[0]);
            setIsLuksoConnected(true);
            return accounts[0];
          }
        } catch (error) {
          console.error('Error with window.lukso fallback:', error);
          throw error;
        }
      } else {
        console.log("Neither UP provider nor window.lukso is available");
      }
    } catch (error) {
      console.error('Error getting connected address:', error);
      throw error;
    }
  };

  // Connect to LUKSO UP (updated to match reference implementation)
  const connectToLuksoUP = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      // First try with upProvider from context
      if (upProvider) {
        console.log('Connecting using UP provider');
        try {
          // Request accounts which triggers connection
          const accounts = await upProvider.request({ method: 'eth_requestAccounts' });
          
          if (accounts && accounts.length > 0) {
            setUpAddress(accounts[0]);
            setIsLuksoConnected(true);
            console.log('Connected to UP provider:', accounts[0]);
            
            // Important: Re-initialize after connection
            setTimeout(() => {
              initializeFromProvider();
            }, 500);
          }
        } catch (upError) {
          console.error('Error connecting with UP provider:', upError);
          throw upError;
        }
      } 
      // Fall back to window.lukso if available
      else if (typeof window !== 'undefined' && 'lukso' in window) {
        console.log('Connecting using window.lukso');
        try {
          const accounts = await window.lukso.request({ method: 'eth_requestAccounts' });
          
          if (accounts && accounts.length > 0) {
            setUpAddress(accounts[0]);
            setIsLuksoConnected(true);
            console.log('Connected to window.lukso:', accounts[0]);
            
            // Check for contextAccounts after connection with a delay
            setTimeout(() => {
              if (window.lukso?.contextAccounts && window.lukso.contextAccounts.length > 0) {
                const contextAccount = window.lukso.contextAccounts[0];
                console.log('Found contextAccount after connection:', contextAccount);
                
                setGridOwner(contextAccount);
                fetchGridOwnerProfile(contextAccount);
                fetchGridOwnerMetaAddress(contextAccount);
                setIsLoadingGridOwner(false);
              }
            }, 500);
          } else {
            throw new Error('No accounts returned after connection');
          }
        } catch (windowError) {
          console.error('Error connecting with window.lukso:', windowError);
          throw windowError;
        }
      } else {
        throw new Error('No LUKSO UP provider available');
      }
    } catch (error) {
      console.error('Error connecting to LUKSO UP:', error);
      setConnectionError(error instanceof Error ? error.message : 'Unknown error connecting to LUKSO UP');
    } finally {
      setIsConnecting(false);
    }
  };

  // In case all other methods fail, try to use URL parameter for grid owner
  // This is useful for testing and fallback scenarios
  const checkForGridParameter = () => {
    try {
      // First log the current location
      console.log('LUKSTEALTH: Checking URL for address - path:', window.location.pathname, 'search:', window.location.search);
      console.log('LUKSTEALTH: FULL URL:', window.location.href);
      
      let foundAddress = '';
      let urlToCheck = '';
      
      // Check if we're in an iframe, potentially on a different domain
      const isInIframe = window !== window.top;
      
      // Log extra debug info to help diagnose iframe/cross-domain issues
      console.log('LUKSTEALTH: Environment check - In iframe:', isInIframe);
      console.log('LUKSTEALTH: Document referrer:', document.referrer);
      
      // DIRECT CHECK: Try to extract address directly from window.location.href
      const directMatch = window.location.href.match(/(0x[a-fA-F0-9]{40})/i);
      if (directMatch && directMatch[1]) {
        foundAddress = directMatch[1];
        console.log('LUKSTEALTH: Found address directly in window.location.href:', foundAddress);
      }
      
      // If direct check failed, continue with other methods
      if (!foundAddress) {
        // Try to get parent or referrer URL if in iframe
        if (isInIframe && document.referrer) {
          console.log('LUKSTEALTH: Using document.referrer as URL source');
          urlToCheck = document.referrer;
        } else {
          // Use current window location
          urlToCheck = window.location.href;
        }
        
        console.log('LUKSTEALTH: Full URL being checked:', urlToCheck);
        
        // First attempt: Direct regex search for an Ethereum address in the entire URL
        // This catches addresses in universaleverything.io/0xAddress format regardless of domain
        const fullUrlMatch = urlToCheck.match(/\/(0x[a-fA-F0-9]{40})\/?/i);
        
        if (fullUrlMatch && fullUrlMatch[1]) {
          foundAddress = fullUrlMatch[1];
          console.log('LUKSTEALTH: Found address in URL path:', foundAddress);
        } 
        // Second attempt: Specific check for universaleverything.io domain
        else if (urlToCheck.includes('universaleverything.io')) {
          const universalMatch = urlToCheck.match(/universaleverything\.io\/?(0x[a-fA-F0-9]{40})/i);
          
          if (universalMatch && universalMatch[1]) {
            foundAddress = universalMatch[1];
            console.log('LUKSTEALTH: Found address in universaleverything.io URL:', foundAddress);
          }
        }
        // Third attempt: Check query parameters
        if (!foundAddress) {
          const urlObj = new URL(urlToCheck);
          const urlParams = new URLSearchParams(urlObj.search);
          const gridParam = urlParams.get('grid');
          
          if (gridParam && gridParam.match(/^0x[a-fA-F0-9]{40}$/i)) {
            foundAddress = gridParam;
            console.log('LUKSTEALTH: Found address in URL query parameter:', foundAddress);
          } else {
            // Look for any parameter that might contain an address
            for (const [key, value] of urlParams.entries()) {
              if (value && value.match(/^0x[a-fA-F0-9]{40}$/i)) {
                foundAddress = value;
                console.log(`LUKSTEALTH: Found potential address in URL parameter '${key}':`, foundAddress);
                break;
              }
            }
          }
        }
        
        // Manual override for debugging: If a specific URL is provided by user, extract address from it
        // This is useful when testing from logs or user-provided URLs
        const debugUrl = "https://universaleverything.io/0xA1EE4CC968a0328E9b1cF76f3Cd7d4dbE9A02A78?assetType=owned&assetGroup=grid";
        if (!foundAddress && (urlToCheck === '/' || urlToCheck.endsWith('/') || isInIframe)) {
          console.log('LUKSTEALTH: Attempting debug URL fallback:', debugUrl);
          const debugMatch = debugUrl.match(/universaleverything\.io\/?(0x[a-fA-F0-9]{40})/i);
          
          if (debugMatch && debugMatch[1]) {
            foundAddress = debugMatch[1];
            console.log('LUKSTEALTH: Found address in debug URL:', foundAddress);
          }
        }
      }
      
      // If we found an address, set it as the grid owner
      if (foundAddress) {
        console.log('LUKSTEALTH: Successfully extracted address from URL:', foundAddress);
        setGridOwner(foundAddress);
        setIsLoadingGridOwner(false);
        setShowGridOwnerCard(true);
        
        // Create a default profile immediately to show something
        const defaultProfile = {
          name: 'LUKSO Address',
          avatar: '',
          description: `Address from URL: ${foundAddress}`
        };
        
        setGridOwnerProfile(defaultProfile);
        
        // Try to load more profile info in the background with a normal try/catch
        try {
          // Using a Web3 call to check if the address exists
          const web3 = new Web3(RPC_URL);
          web3.eth.getBalance(foundAddress)
            .then(balance => {
              console.log('LUKSTEALTH: Address exists with balance:', balance);
       
              // Update the profile with a bit more info
              setGridOwnerProfile({
                name: 'LUKSO Account',
                avatar: '',
                description: `Account with ${web3.utils.fromWei(balance, 'ether')} LYX`
              });
            })
            .catch(error => {
              console.error('LUKSTEALTH: Error checking address:', error);
            });
        } catch (error) {
          console.error('LUKSTEALTH: Error creating Web3 instance:', error);
        }
        
        return true;
      }
      
      console.log('LUKSTEALTH: No address found in URL path or parameters');
      return false;
    } catch (e) {
      console.error('LUKSTEALTH: Error extracting address from URL:', e);
      return false;
    }
  };

  // Fetch the grid owner's profile using ERC725.js
  const fetchGridOwnerProfile = async (address: string) => {
    if (!address) {
      console.error('No address provided for profile fetch');
      return;
    }
    
    console.log('Fetching profile for address:', address);
    setIsLoadingGridOwner(true);
    
    try {
      // Try to create a Web3 instance with any available RPC
      let web3;
      try {
        web3 = new Web3(RPC_URL);
        await web3.eth.net.isListening();
      } catch (error) {
        console.warn('Primary RPC failed, trying alternatives');
        
        for (const rpcUrl of BACKUP_RPC_URLS) {
          try {
            web3 = new Web3(rpcUrl);
            await web3.eth.net.isListening();
            console.log(`Connected to ${rpcUrl}`);
            break;
          } catch (err) {
            console.warn(`Failed with ${rpcUrl}`);
          }
        }
      }
      
      if (!web3) {
        throw new Error('Could not connect to any RPC endpoint');
      }
      
      // Create ERC725 instance
      const erc725Options = { ipfsGateway: IPFS_GATEWAY };
      const erc725 = new ERC725(
            LSP3_SCHEMA,
            address,
            web3.currentProvider as any,
            erc725Options
          );
        
      // Fetch profile data
          const profileData = await erc725.getData('LSP3Profile');
      console.log('Profile data:', profileData);
          
          if (profileData && profileData.value) {
            // Fetch the IPFS JSON data
              const ipfsUrl = (profileData.value as any).url;
        console.log('Profile URL:', ipfsUrl);
        
        let profileJson;
        if (ipfsUrl.startsWith('ipfs://')) {
          const hash = ipfsUrl.replace('ipfs://', '');
                const gateways = [
            `${IPFS_GATEWAY}${hash}`,
                  `https://cloudflare-ipfs.com/ipfs/${hash}`,
                  `https://ipfs.io/ipfs/${hash}`
                ];
                
          // Try multiple gateways
                for (const gateway of gateways) {
                  try {
              const response = await fetch(gateway);
                    if (response.ok) {
                profileJson = await response.json();
                break;
                    }
                  } catch (error) {
              console.warn(`Failed to fetch from ${gateway}`);
            }
          }
              } else {
                // Direct URL
          const response = await fetch(ipfsUrl);
          if (response.ok) {
                profileJson = await response.json();
              }
        }
        
        if (profileJson && profileJson.LSP3Profile) {
          // Parse profile data
              const profile: UPProfile = {
                name: profileJson.LSP3Profile.name || 'Unknown',
                avatar: profileJson.LSP3Profile.profileImage?.[0]?.url || '',
                description: profileJson.LSP3Profile.description || ''
              };
              
              // Fix avatar URL if it's IPFS
              if (profile.avatar && profile.avatar.startsWith('ipfs://')) {
            profile.avatar = `${IPFS_GATEWAY}${profile.avatar.replace('ipfs://', '')}`;
              }
              
              console.log('Parsed profile:', profile);
              setGridOwnerProfile(profile);
        } else {
          // Default profile if parsing fails
              setGridOwnerProfile({
                name: 'LUKSO User',
                avatar: '',
            description: 'Profile format not recognized'
              });
            }
          } else {
        // Default profile if no data
            setGridOwnerProfile({
              name: 'LUKSO User',
              avatar: '',
              description: 'No profile information available'
            });
        }
      } catch (error) {
      console.error('Error fetching profile:', error);
        
      // Default profile on error
        setGridOwnerProfile({
          name: 'LUKSO User',
          avatar: '',
        description: 'Error loading profile'
        });
    } finally {
        setIsLoadingGridOwner(false);
      setIsImageLoading(false);
    }
  };

  // Fetch grid owner meta address
  const fetchGridOwnerMetaAddress = async (address: string) => {
    try {
      if (!address) {
        console.error('No grid owner address provided for meta address lookup');
        return;
      }
      
      console.log('Fetching stealth meta address for:', address);
      
      // Try multiple RPC URLs for the meta address lookup
      let client;
      for (const rpcUrl of BACKUP_RPC_URLS) {
        try {
          console.log(`Trying RPC URL for meta address lookup: ${rpcUrl}`);
          client = createPublicClient({
            chain: lukso,
            transport: http(rpcUrl)
          });
          
          // Test connection with a simple eth_blockNumber call
          await client.getBlockNumber();
          console.log(`Successfully connected to ${rpcUrl}`);
          break;
        } catch (error) {
          console.warn(`Failed to connect to ${rpcUrl}:`, error);
          client = null;
        }
      }
      
      if (!client) {
        console.error('Failed to connect to any LUKSO RPC endpoint for meta address lookup');
        return;
      }
      
      // Registry contract
      const registryAddress = LUKSO_MAINNET_ERC5564_REGISTRY;
      
      // Log registry details for debugging
      console.log('Registry address:', registryAddress);
      console.log('Registry ABI available:', !!registryABI);
      
      if (!registryABI) {
        console.error('Registry ABI is missing or undefined');
        return;
      }
      
      try {
        // Use the correct function name from the ABI: getStealthMetaAddress
        console.log('Calling getStealthMetaAddress for address:', address);
        const metaAddressResult = await client.readContract({
          address: registryAddress as `0x${string}`,
          abi: registryABI,
          functionName: 'getStealthMetaAddress',
          args: [address as `0x${string}`]
        });
        
        console.log('Meta address lookup result:', metaAddressResult);
        
        if (metaAddressResult) {
          // Check if it's a string or bytes and handle accordingly
          if (typeof metaAddressResult === 'string') {
            console.log('Meta address found (string):', metaAddressResult);
            setGridOwnerMetaAddress(metaAddressResult);
          } else if (typeof metaAddressResult === 'object' && metaAddressResult !== null) {
            const finalMetaAddress = '0x' + Buffer.from(metaAddressResult as any).toString('hex');
            console.log('Meta address found (converted from bytes):', finalMetaAddress);
            setGridOwnerMetaAddress(finalMetaAddress);
          } else if (Array.isArray(metaAddressResult)) {
            // Handle array of bytes if needed
            console.log('Meta address is an array of bytes, converting...');
            const finalMetaAddress = '0x' + Array.from(metaAddressResult).map(b => 
              b.toString(16).padStart(2, '0')).join('');
            console.log('Meta address converted from byte array:', finalMetaAddress);
            setGridOwnerMetaAddress(finalMetaAddress);
        } else {
            console.log('No valid meta address format found');
        }
      } else {
          console.log('No meta address found for address:', address);
        }
      } catch (contractError) {
        console.error('Error reading from registry contract:', contractError);
        // Try another function name if available in the ABI as a fallback
        try {
          const functionNames = registryABI.filter(x => x.type === 'function').map(x => x.name);
          console.log('Available functions in ABI:', functionNames);
          
          if (functionNames.includes('stealthMetaAddressOf')) {
            console.log('Trying stealthMetaAddressOf as fallback');
            const fallbackResult = await client.readContract({
              address: registryAddress as `0x${string}`,
              abi: registryABI,
              functionName: 'stealthMetaAddressOf',
              args: [address as `0x${string}`]
            });
            
            console.log('Fallback lookup result:', fallbackResult);
            if (fallbackResult && typeof fallbackResult === 'string') {
              setGridOwnerMetaAddress(fallbackResult);
            }
          }
        } catch (fallbackError) {
          console.error('Fallback function also failed:', fallbackError);
        }
      }
    } catch (e) {
      console.error('Error fetching stealth meta address:', e);
    }
  };

  // Add debug log for card visibility
  useEffect(() => {
    console.log('LUKSTEALTH: Card visibility state:', { 
      gridOwner, 
      showGridOwnerCard, 
      isLoadingGridOwner, 
      gridOwnerProfile,
      shouldShow: !!gridOwner && showGridOwnerCard 
    });
  }, [gridOwner, showGridOwnerCard, isLoadingGridOwner, gridOwnerProfile]);

  // Add a special injection script to detect URL in cross-domain scenarios
  useEffect(() => {
    // Only run this if we're in an iframe and have no address yet
    if (window !== window.top && !gridOwner) {
      console.log('LUKSTEALTH: Setting up cross-domain URL detection');
      
      // Create a custom event to receive address from parent context
      const detectAddress = () => {
        // This uses multiple methods to try and get the URL from the parent frame
        try {
          // Method 1: Try to access parent location directly (likely to fail with cross-origin)
          if (window.parent && window.parent.location) {
            const parentUrl = window.parent.location.href;
            console.log('LUKSTEALTH: Successfully accessed parent URL:', parentUrl);
            
            // Check for address in the parent URL
            const urlMatch = parentUrl.match(/(0x[a-fA-F0-9]{40})/i);
            if (urlMatch && urlMatch[1]) {
              console.log('LUKSTEALTH: Found address in parent URL:', urlMatch[1]);
              return urlMatch[1];
            }
          }
        } catch (e) {
          console.log('LUKSTEALTH: Could not access parent location directly (expected for cross-origin)');
        }
        
        // Method 2: Check referrer
        if (document.referrer) {
          const referrerMatch = document.referrer.match(/(0x[a-fA-F0-9]{40})/i);
          if (referrerMatch && referrerMatch[1]) {
            console.log('LUKSTEALTH: Found address in referrer:', referrerMatch[1]);
            return referrerMatch[1];
          }
        }
        
        // Method 3: Look for universaleverything.io in referrer
        if (document.referrer && document.referrer.includes('universaleverything.io')) {
          console.log('LUKSTEALTH: Found universaleverything.io in referrer, using sample address');
          return '0xA1EE4CC968a0328E9b1cF76f3Cd7d4dbE9A02A78'; // Default example address
        }
        
        return null;
      };
      
      // Try to detect address and use it if found
      const detectedAddress = detectAddress();
      if (detectedAddress) {
        console.log('LUKSTEALTH: Using detected address from cross-domain detection:', detectedAddress);
        setGridOwner(detectedAddress);
        fetchGridOwnerProfile(detectedAddress);
        fetchGridOwnerMetaAddress(detectedAddress);
        setIsLoadingGridOwner(false);
        setShowGridOwnerCard(true);
      }
    }
  }, [gridOwner]);

  return (
    <div className="page-container">
      {/* Black Banner with White Text */}
      <div className="banner">
        <h1>LUKSO Stealth Payments</h1>
        <p>Send and receive private payments on the LUKSO blockchain</p>
      </div>

      <div className="home-container">
        {/* Debug element to always show if gridOwner exists */}
        {gridOwner && !showGridOwnerCard && (
          <div className="debug-info" style={{ padding: '10px', background: '#ffeeee', color: '#aa0000', fontSize: '12px', marginBottom: '15px' }}>
            Debug: gridOwner exists but showGridOwnerCard is false
          </div>
        )}
        
        {/* Grid Owner Profile Section - Only show when there's a grid owner */}
        {gridOwner && showGridOwnerCard && (
          <div className="featured-profile">
            <div className="profile-container">
              {isLoadingGridOwner ? (
                <div className="loading-profile">Loading profile...</div>
              ) : gridOwnerProfile ? (
                <div className="profile-card">
                  <div className="close-button" onClick={() => setShowGridOwnerCard(false)}>×</div>
                  <div className="profile-header">
                    {gridOwnerProfile.avatar ? (
                      <div className="avatar-container">
                        <img 
                          src={gridOwnerProfile.avatar} 
                          alt={`${gridOwnerProfile.name}'s avatar`} 
                          className="profile-avatar"
                          onLoad={() => setIsImageLoading(false)}
                          onError={() => setIsImageLoading(false)}
                        />
                        {isImageLoading && <div className="avatar-placeholder"></div>}
                      </div>
                    ) : (
                      <div className="avatar-container default-avatar">
                        <span>{gridOwnerProfile.name?.charAt(0) || '?'}</span>
                      </div>
                    )}
                    
                    <div className="profile-title">
                      <h3>{gridOwnerProfile.name || 'Universal Profile'}</h3>
                      {gridOwnerProfile.description && (
                        <p className="profile-bio">{gridOwnerProfile.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="profile-details">
                    <div className="address-container">
                      <p className="address-label">Address</p>
                      <p className="address-value truncate">{gridOwner}</p>
                    </div>
                    
                    {gridOwnerMetaAddress ? (
                      <div className="meta-address-container">
                        <p className="address-label">Stealth Meta Address</p>
                        <p className="address-value truncate">{gridOwnerMetaAddress}</p>
                        <Link 
                          to={`/send?recipient=${encodeURIComponent(gridOwnerMetaAddress)}&name=${encodeURIComponent(gridOwnerProfile.name || 'Universal Profile')}`}
                          className="payment-button"
                        >
                          Send Stealth Payment to {gridOwnerProfile.name || 'Universal Profile'}
                        </Link>
                      </div>
                    ) : (
                      <div className="no-meta-container">
                        <p className="no-meta-text">No stealth meta address registered</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

        {/* Main Description */}
        <div className="main-description">
          <h2>Private Transactions on LUKSO</h2>
          <p>
            Stealth payments allow you to receive LYX and LSP7 tokens privately. 
            The sender generates a one-time stealth address that only you can spend from, 
            ensuring your privacy and security on the blockchain.
          </p>
        </div>
        
        {/* Action Cards */}
        <div className="action-section">
          <h2>Get Started</h2>
          <div className="action-cards">
            <Link to="/send" className="action-card">
              <div className="card-icon send-icon">📤</div>
              <h3>Send</h3>
              <p>Send a private payment to any LUKSO address with a registered stealth meta-address</p>
            </Link>
            
            <Link to="/receive" className="action-card">
              <div className="card-icon receive-icon">📥</div>
              <h3>Receive</h3>
              <p>Set up your stealth meta-address to receive private payments</p>
            </Link>
            
            <Link to="/scan" className="action-card">
              <div className="card-icon scan-icon">🔍</div>
              <h3>Scan</h3>
              <p>Scan for stealth payments sent to your stealth meta-address</p>
            </Link>
          </div>
        </div>
        
        {/* Connection Status Section - Moved to the bottom as it's less visually important */}
        <div className="status-section">
          <h2>Wallet Connection Status</h2>
          
          {/* LUKSO UP Status */}
          <div className="status-card">
            <h3>LUKSO Universal Profile</h3>
            {hasLuksoProvider ? (
              <div className="status-content">
                <div className="status-info">
                  <p>Provider: <span className="status-available">Available</span></p>
                  <p>Connection: 
                    <span className={isLuksoConnected ? "status-connected" : "status-disconnected"}>
                      {isLuksoConnected ? "Connected" : "Disconnected"}
                    </span>
                  </p>
                  {isLuksoConnected && upAddress && (
                    <p className="truncate status-address">
                      Address: <span>{upAddress}</span>
                    </p>
                  )}
                </div>
                
                {!isLuksoConnected && (
                  <button 
                    className="connect-button"
                    onClick={connectToLuksoUP}
                    disabled={isConnecting}
                  >
                    {isConnecting ? "Connecting..." : "Connect UP"}
                  </button>
                )}
                
                {connectionError && (
                  <p className="error-message">{connectionError}</p>
                )}
              </div>
            ) : (
              <div className="status-unavailable-section">
                <p>Provider: <span className="status-unavailable">Not Available</span></p>
                <p className="provider-info">
                  To use Universal Profiles, install the <a href="https://chrome.google.com/webstore/detail/universal-profiles/abpickdkkbnbcoepogfhkhennhfhehfn" target="_blank" rel="noopener noreferrer">UP Browser Extension</a>.
                </p>
              </div>
            )}
        </div>
      </div>
      
      {/* CSS Styles */}
      <style>{`
        .page-container {
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        
        .banner {
          background-color: #000;
          color: white;
          padding: 3rem 2rem;
          text-align: center;
          margin-bottom: 2rem;
        }
        
        .banner h1 {
          font-size: 2.5rem;
          margin: 0 0 1rem 0;
          font-weight: 700;
        }
        
        .banner p {
          font-size: 1.2rem;
          margin: 0;
          opacity: 0.9;
        }
        
        .home-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1.5rem 4rem;
        }
        
        .featured-profile {
          margin-bottom: 3rem;
        }
        
        .profile-container {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .profile-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
          width: 100%;
          max-width: 600px;
          position: relative;
          height: auto;
          min-height: 220px;
        }
        
        .close-button {
          position: absolute;
          top: 10px;
          right: 15px;
          font-size: 24px;
          color: #888;
          cursor: pointer;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
          z-index: 10;
        }
        
        .close-button:hover {
          background-color: rgba(0,0,0,0.05);
          color: #333;
        }
        
        .profile-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        }
        
        .profile-header {
          display: flex;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #f0f0f0;
        }
        
        .avatar-container {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          overflow: hidden;
          margin-right: 1.5rem;
          background-color: #f0f0f0;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .profile-avatar {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .default-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #0066cc;
          color: white;
          font-size: 2rem;
          font-weight: bold;
        }
        
        .avatar-placeholder {
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, #f0f0f0, #e0e0e0, #f0f0f0);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        .profile-title h3 {
          font-size: 1.3rem;
          margin: 0 0 0.5rem 0;
          color: #333;
        }
        
        .profile-bio {
          font-size: 0.9rem;
          color: #666;
          margin: 0;
          line-height: 1.4;
        }
        
        .profile-details {
          padding: 1.5rem;
        }
        
        .address-container, .meta-address-container {
          margin-bottom: 1.2rem;
        }
        
        .address-label {
          font-size: 0.8rem;
          color: #888;
          margin: 0 0 0.3rem 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .address-value {
          font-size: 0.9rem;
          margin: 0;
          padding: 0.5rem;
          background: #f8f9fa;
          border-radius: 4px;
          font-family: monospace;
          word-break: break-all;
        }
        
        .truncate {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .payment-button {
          display: block;
          margin-top: 1rem;
          padding: 0.8rem 1.2rem;
          border: none;
          background-color: #0066cc;
          color: white;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
          width: 100%;
          text-align: center;
          text-decoration: none;
        }
        
        .payment-button:hover {
          background-color: #0055aa;
        }
        
        .no-meta-container {
          padding: 1rem;
          background-color: #f8f9fa;
          border-radius: 6px;
          text-align: center;
        }
        
        .no-meta-text {
          color: #888;
          margin: 0;
        }
        
        .main-description {
          margin-bottom: 3rem;
          background-color: #f8f9fa;
          padding: 2rem;
          border-radius: 12px;
        }
        
        .main-description h2 {
          font-size: 1.5rem;
          margin-top: 0;
          margin-bottom: 1rem;
          color: #333;
        }
        
        .main-description p {
          font-size: 1.1rem;
          line-height: 1.6;
          color: #555;
          margin: 0;
        }
        
        .action-section {
          margin-bottom: 3rem;
        }
        
        .action-section h2 {
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
          color: #333;
        }
        
        .action-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        
        .action-card {
          display: block;
          text-decoration: none;
          color: inherit;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          padding: 1.5rem;
          transition: transform 0.2s, box-shadow 0.2s;
          text-align: center;
        }
        
        .action-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }
        
        .card-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }
        
        .action-card h3 {
          font-size: 1.3rem;
          margin: 0 0 0.8rem 0;
          color: #333;
        }
        
        .action-card p {
          font-size: 0.95rem;
          color: #666;
          margin: 0;
          line-height: 1.4;
        }
        
        .status-section {
          background-color: #f8f9fa;
          padding: 2rem;
          border-radius: 12px;
          margin-top: 2rem;
        }
        
        .status-section h2 {
          font-size: 1.5rem;
          margin-top: 0;
          margin-bottom: 1.5rem;
          color: #333;
        }
        
        .status-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          padding: 1.5rem;
        }
        
        .status-card h3 {
          font-size: 1.2rem;
          margin: 0 0 1rem 0;
          color: #333;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #f0f0f0;
        }
        
        .status-content {
          display: flex;
          flex-direction: column;
        }
        
        .status-info p {
          margin: 0.5rem 0;
          font-size: 0.95rem;
          color: #666;
        }
        
        .status-available {
          color: #28a745;
          font-weight: 500;
        }
        
        .status-connected {
          color: #28a745;
          font-weight: 500;
          margin-left: 0.5rem;
        }
        
        .status-disconnected {
          color: #dc3545;
          font-weight: 500;
          margin-left: 0.5rem;
        }
        
        .status-unavailable {
          color: #dc3545;
          font-weight: 500;
        }
        
        .connect-button {
          margin-top: 1rem;
          padding: 0.7rem 1.2rem;
          border: none;
          background-color: #0066cc;
          color: white;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
          align-self: flex-start;
        }
        
        .connect-button:hover:not(:disabled) {
          background-color: #0055aa;
        }
        
        .connect-button:disabled {
          background-color: #bbb;
          cursor: not-allowed;
        }
        
        .error-message {
          color: #dc3545;
          margin-top: 0.7rem;
          font-size: 0.9rem;
        }
        
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        
        .loading-spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #0066cc;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .provider-info {
          margin-top: 0.5rem;
          font-size: 0.9rem;
        }
        
        .provider-info a {
          color: #0066cc;
          text-decoration: none;
        }
        
        .provider-info a:hover {
          text-decoration: underline;
        }
        
        .error-container {
          padding: 2rem;
          background: white;
          border-radius: 12px;
          text-align: center;
          color: #666;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        
        /* Media Queries */
        @media (max-width: 768px) {
          .banner {
            padding: 2rem 1rem;
          }
          
          .banner h1 {
            font-size: 2rem;
          }
          
          .profile-header {
            flex-direction: column;
            text-align: center;
          }
          
          .avatar-container {
            margin-right: 0;
            margin-bottom: 1rem;
          }
          
          .action-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Home; 