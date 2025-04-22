import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect, createContext, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { http, createConfig } from 'wagmi';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createClientUPProvider } from '@lukso/up-provider';

// Import route components
import Home from './routes/Home';
import Send from './routes/Send';
import Receive from './routes/Receive';
import Withdraw from './routes/Withdraw';
import Scan from './routes/Scan';
import DeveloperMode from './routes/DeveloperMode';
import Layout from './components/Layout';

// Add TypeScript declaration for import.meta.env
declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  
  interface ImportMetaEnv {
    readonly VITE_RPC_URL?: string;
    // Add other env variables as needed
  }
  
  // Add window.lukso and window.ethereum type declarations
  interface Window {
    lukso?: any;
    ethereum?: any;
    // Add global context variable for DOM-based contextAccount detection
    __LUKSO_CONTEXT?: {
      contextAccounts?: string[];
      gridOwner?: string;
    };
  }
}

// Create UP Provider context to be used across the app
type UPProviderContextType = {
  isLuksoUP: boolean;
  upProvider: any;
  isInitializing: boolean;
  upAccounts: string[];
  upInitialized: boolean;
  connect: () => Promise<string[]>;
  controllers: any[];
  contextAccounts: string[];
  gridOwner: string | null;
};

export const UPProviderContext = createContext<UPProviderContextType>({
  isLuksoUP: false,
  upProvider: null,
  isInitializing: false,
  upAccounts: [],
  upInitialized: false,
  connect: async () => [],
  controllers: [],
  contextAccounts: [],
  gridOwner: null
});

// Initialize UP Provider
const initializeUPProvider = async (): Promise<any> => {
  console.log('LUKSTEALTH: 🔄 Initializing LUKSO UP provider...');
  
  if (typeof window.lukso !== 'undefined') {
    try {
      // Create the client UP provider
      const provider = createClientUPProvider();
      console.log('LUKSTEALTH: ✅ LUKSO UP provider initialized:', provider);
      return provider;
    } catch (error) {
      console.error('LUKSTEALTH: ❌ Error initializing LUKSO UP provider:', error);
      return null;
    }
  } else {
    console.log('LUKSTEALTH: ❌ LUKSO UP provider not available');
    return null;
  }
};

// Global check for LUKSO UP provider
const checkForLuksoProvider = () => {
  console.log('LUKSTEALTH: 🔍 Checking for wallet providers...');
  
  if (typeof window.lukso !== 'undefined') {
    console.log('LUKSTEALTH: ✅ LUKSO UP provider detected:', window.lukso);
    
    // Log LUKSO provider details
    try {
      const luksoVersion = window.lukso.version || 'Unknown';
      console.log(`LUKSTEALTH: LUKSO UP Provider Version: ${luksoVersion}`);
      
      // Check if it has isConnected property
      if ('isConnected' in window.lukso) {
        console.log(`LUKSTEALTH: LUKSO UP Connected: ${window.lukso.isConnected}`);
      }
      
      // Check for chainId
      if ('chainId' in window.lukso) {
        console.log(`LUKSTEALTH: LUKSO Chain ID: ${window.lukso.chainId}`);
      }
    } catch (error) {
      console.error('LUKSTEALTH: Error getting LUKSO UP provider details:', error);
    }
    
    return true;
  } else {
    console.log('LUKSTEALTH: ❌ LUKSO UP provider not detected');
  }
  
  if (typeof window.ethereum !== 'undefined') {
    console.log('LUKSTEALTH: ✅ Standard Ethereum provider detected:', window.ethereum);
    
    // Log standard provider details
    try {
      if (window.ethereum.isMetaMask) {
        console.log('LUKSTEALTH: Provider is MetaMask');
      }
      
      if (window.ethereum.selectedAddress) {
        console.log(`LUKSTEALTH: Selected address: ${window.ethereum.selectedAddress}`);
      }
      
      if (window.ethereum.chainId) {
        console.log(`LUKSTEALTH: Chain ID: ${window.ethereum.chainId}`);
      }
    } catch (error) {
      console.error('LUKSTEALTH: Error getting standard provider details:', error);
    }
  } else {
    console.log('LUKSTEALTH: ❌ Standard Ethereum provider not detected');
  }
  
  return false;
};

// Get accounts from LUKSO UP provider
const getUPAccounts = async (): Promise<string[]> => {
  if (typeof window.lukso !== 'undefined') {
    try {
      const accounts = await window.lukso.request({ method: 'eth_requestAccounts' });
      console.log('LUKSTEALTH: LUKSO UP accounts:', accounts);
      return accounts;
    } catch (error) {
      console.error('LUKSTEALTH: Error getting LUKSO UP accounts:', error);
      return [];
    }
  }
  return [];
};

// Get UP controller information
const getUPControllerInfo = async (upAddress: string): Promise<any[]> => {
  if (typeof window.lukso !== 'undefined' && upAddress) {
    console.log('LUKSTEALTH: Requesting UP controllers for address:', upAddress);
    
    try {
      // Try up_getControllers method
      const controllers = await window.lukso.request({ method: 'up_getControllers' });
      console.log('LUKSTEALTH: UP controllers:', controllers);
      return controllers || [];
    } catch (err1) {
      console.log('LUKSTEALTH: up_getControllers method failed:', err1);
      
      try {
        // Alternative approach using eth_call to the LSP6 Key Manager
        const keyManager = await window.lukso.request({ 
          method: 'eth_call',
          params: [{
            to: upAddress,
            data: '0x9c7a5ec6' // keyManager() function selector
          }, 'latest']
        });
        
        console.log('LUKSTEALTH: LSP6 Key Manager:', keyManager);
        return [keyManager];
      } catch (err2) {
        console.log('LUKSTEALTH: Key Manager retrieval failed:', err2);
        return [];
      }
    }
  }
  return [];
};

// Define LUKSO chain for wagmi
export const lukso = {
  id: 42,
  name: 'LUKSO',
  network: 'lukso',
  nativeCurrency: {
    decimals: 18,
    name: 'LYX',
    symbol: 'LYX'
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.lukso.sigmacore.io']
    }
  },
  blockExplorers: {
    default: {
      name: 'LUKSO Explorer',
      url: 'https://explorer.lukso.network'
    }
  }
} as const;

// Get RPC URL from environment variable or use default mainnet URL
export const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://rpc.lukso.sigmacore.io';
if (!RPC_URL) throw new Error('VITE_RPC_URL is required');

export const config = createConfig({
  chains: [lukso],
  transports: {
    [lukso.id]: http(RPC_URL)
  }
});

const queryClient = new QueryClient();

// Create style for animations
const createGlobalStyles = () => {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleElement);
};

// Initialize global styles when app loads
if (typeof window !== 'undefined') {
  createGlobalStyles();
}

// Add a utility function to extract contextAccounts from DOM - critical for incognito mode
const getContextAccountsFromDOM = (): string[] => {
  try {
    // This technique uses direct DOM inspection to find contextAccounts
    if (typeof window !== 'undefined' && window.document) {
      // Look for script tags with data-context attribute
      const scriptTags = Array.from(document.querySelectorAll('script[data-context]'));
      for (const script of scriptTags) {
        try {
          const contextData = JSON.parse(script.getAttribute('data-context') || '{}');
          if (contextData?.contextAccounts?.length) {
            console.log('LUKSTEALTH: Found contextAccounts in DOM:', contextData.contextAccounts);
            return contextData.contextAccounts;
          }
        } catch (e) {
          console.warn('LUKSTEALTH: Error parsing context data from script:', e);
        }
      }
      
      // Try finding in global namespace
      if (window.__LUKSO_CONTEXT?.contextAccounts?.length) {
        return window.__LUKSO_CONTEXT.contextAccounts;
      }
    }
  } catch (error) {
    console.warn('LUKSTEALTH: Error in DOM contextAccounts lookup:', error);
  }
  return [];
};

const App = () => {
  // State for UP provider
  const [isLuksoUP, setIsLuksoUP] = useState<boolean>(false);
  const [upProvider, setUpProvider] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [upAccounts, setUpAccounts] = useState<string[]>([]);
  const [upInitialized, setUpInitialized] = useState<boolean>(false);
  const [controllers, setControllers] = useState<any[]>([]);
  const [contextAccounts, setContextAccounts] = useState<string[]>([]);
  const [gridOwner, setGridOwner] = useState<string | null>(null);
  
  // Connect to the UP provider and get accounts
  const connect = async (): Promise<string[]> => {
    if (!upProvider && !window.lukso) return [];
    
    try {
      const MAX_RETRIES = 3;
      const BASE_DELAY = 1000;
      
      // Helper function to execute requests with retry logic
      const executeWithRetry = async (
        fn: () => Promise<any>, 
        attemptNumber: number = 1
      ): Promise<any> => {
        try {
          console.log(`LUKSTEALTH: Attempt ${attemptNumber} to connect to LUKSO UP...`);
          return await fn();
        } catch (error: any) {
          // Check if this is a rate limit error
          const isRateLimitError = 
            error?.code === -32005 || 
            (typeof error?.message === 'string' && 
            error.message.includes('limit exceeded'));
          
          // If we've hit max retries or it's not a rate limit error, throw
          if (attemptNumber >= MAX_RETRIES || !isRateLimitError) {
            throw error;
          }
          
          // Calculate exponential backoff delay
          const delay = BASE_DELAY * Math.pow(2, attemptNumber - 1);
          console.log(`LUKSTEALTH: Rate limit exceeded. Retrying in ${delay}ms...`);
          
          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry with incremented attempt number
          return executeWithRetry(fn, attemptNumber + 1);
        }
      };
      
      // Check for context accounts first
      try {
        if (window.lukso && window.lukso.contextAccounts) {
          const ctxAccounts = window.lukso.contextAccounts;
          console.log('LUKSTEALTH: Context accounts found:', ctxAccounts);
          setContextAccounts(ctxAccounts);
          
          // If there are context accounts, set the first one as the grid owner
          if (ctxAccounts.length > 0) {
            setGridOwner(ctxAccounts[0]);
          }
          
          // Return context accounts if available
          if (ctxAccounts.length > 0) {
            return ctxAccounts;
          }
        }
      } catch (contextError) {
        console.warn('LUKSTEALTH: Error checking context accounts:', contextError);
        // Continue with regular connection
      }
      
      // Use cached accounts if available
      if (upAccounts.length > 0) {
        console.log('LUKSTEALTH: Using cached accounts:', upAccounts);
        
        // If we already have controllers, just return accounts
        if (controllers.length > 0) {
          return upAccounts;
        }
      }
      
      // Get accounts with retry logic
      const accounts = await executeWithRetry(async () => {
        const accounts = await getUPAccounts();
        if (!accounts || accounts.length === 0) {
          throw new Error('No connected wallet accounts found');
        }
        return accounts;
      });
      
      setUpAccounts(accounts);
      
      if (accounts.length > 0) {
        // Add a small delay before requesting controller info to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Get controller info with retry
        try {
          const controllerInfo = await executeWithRetry(() => 
            getUPControllerInfo(accounts[0])
          );
          setControllers(controllerInfo);
        } catch (controllerError) {
          console.error('LUKSTEALTH: Error getting controller info:', controllerError);
          // We can continue even if controller info fails
        }
      }
      
      return accounts;
    } catch (error) {
      console.error('LUKSTEALTH: Error connecting to LUKSO UP:', error);
      return [];
    }
  };
  
  // Initialize the UP provider on app mount
  useEffect(() => {
    const init = async () => {
      setIsInitializing(true);
      
      // Check if LUKSO UP is available
      const hasLuksoUP = checkForLuksoProvider();
      setIsLuksoUP(hasLuksoUP);
      
      if (hasLuksoUP) {
        // Initialize UP provider
        const provider = await initializeUPProvider();
        setUpProvider(provider);
        
        // Try connecting and getting accounts
        await connect();
        
        // Add polling for contextAccounts - critical for incognito mode
        let pollCount = 0;
        const maxPolls = 10;
        
        const pollForContextAccounts = () => {
          pollCount++;
          console.log(`LUKSTEALTH: Polling for contextAccounts (${pollCount}/${maxPolls})`);
          
          // Method 1: Direct provider access
          if (provider?.contextAccounts?.length > 0) {
            console.log('LUKSTEALTH: Found contextAccounts via provider polling:', provider.contextAccounts);
            setContextAccounts(provider.contextAccounts);
            
            // Update grid owner
            if (provider.contextAccounts.length > 0) {
              setGridOwner(provider.contextAccounts[0]);
            }
            return true;
          }
          
          // Method 2: DOM inspection 
          const domContextAccounts = getContextAccountsFromDOM();
          if (domContextAccounts.length > 0) {
            console.log('LUKSTEALTH: Found contextAccounts via DOM inspection:', domContextAccounts);
            setContextAccounts(domContextAccounts);
            
            // Update grid owner
            if (domContextAccounts.length > 0) {
              setGridOwner(domContextAccounts[0]);
            }
            return true;
          }
          
          // Method 3: Window lukso direct access
          if (window.lukso?.contextAccounts?.length > 0) {
            console.log('LUKSTEALTH: Found contextAccounts via window.lukso:', window.lukso.contextAccounts);
            setContextAccounts(window.lukso.contextAccounts);
            
            // Update grid owner
            if (window.lukso.contextAccounts.length > 0) {
              setGridOwner(window.lukso.contextAccounts[0]);
            }
            return true;
          }
          
          return false;
        };
        
        // Initial check
        if (!pollForContextAccounts() && window.lukso) {
          // Setup polling
          const pollInterval = setInterval(() => {
            if (pollForContextAccounts() || pollCount >= maxPolls) {
              clearInterval(pollInterval);
            }
          }, 250);
          
          // Clean up interval after max time
          setTimeout(() => {
            clearInterval(pollInterval);
          }, 5000);
        }
      }
      
      setIsInitializing(false);
      setUpInitialized(true);
      
      // Setup iframe messaging for incognito mode
      if (window.parent && window.parent !== window) {
        try {
          window.parent.postMessage({ type: 'GET_CONTEXT_ACCOUNTS' }, '*');
          console.log('LUKSTEALTH: Sent message to parent frame requesting context accounts');
        } catch (frameError) {
          console.warn('LUKSTEALTH: Error sending message to parent frame:', frameError);
        }
      }
    };
    
    init();
  }, []);
  
  // Set up event listeners for provider changes
  useEffect(() => {
    if (typeof window.lukso !== 'undefined') {
      // Register LUKSO UP event listeners
      window.lukso.on?.('accountsChanged', async (accounts: string[]) => {
        console.log('LUKSTEALTH: LUKSO UP accounts changed:', accounts);
        setUpAccounts(accounts);
        
        if (accounts.length > 0) {
          const controllerInfo = await getUPControllerInfo(accounts[0]);
          setControllers(controllerInfo);
        }
      });
      
      window.lukso.on?.('chainChanged', (chainId: string) => {
        console.log('LUKSTEALTH: LUKSO UP chain changed:', chainId);
      });
      
      window.lukso.on?.('connect', (info: { chainId: string }) => {
        console.log('LUKSTEALTH: LUKSO UP connected:', info);
      });
      
      window.lukso.on?.('disconnect', (error: { code: number; message: string }) => {
        console.log('LUKSTEALTH: LUKSO UP disconnected:', error);
        setUpAccounts([]);
      });
      
      // Add contextAccountsChanged listener
      window.lukso.on?.('contextAccountsChanged', (accounts: string[]) => {
        console.log('LUKSTEALTH: Context accounts changed:', accounts);
        setContextAccounts(accounts);
        
        // Update grid owner if context accounts change
        if (accounts.length > 0) {
          setGridOwner(accounts[0]);
        } else {
          setGridOwner(null);
        }
      });
    }
    
    // Set up message event listener for iframe communications
    const handleMessage = (event: MessageEvent) => {
      console.log('LUKSTEALTH: Received message:', event.data);
      
      // Check for context accounts in message
      if (event.data && (
        (event.data.type === 'CONTEXT_ACCOUNTS' && Array.isArray(event.data.accounts)) ||
        (event.data.type === 'LUKSO_CONTEXT_RESPONSE' && event.data.contextAccount)
      )) {
        const contextAccount = event.data.accounts?.[0] || event.data.contextAccount;
        
        if (contextAccount && typeof contextAccount === 'string' && contextAccount.startsWith('0x')) {
          console.log('LUKSTEALTH: Valid context account received from message:', contextAccount);
          setContextAccounts([contextAccount]);
          setGridOwner(contextAccount);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    if (typeof window.ethereum !== 'undefined') {
      // Register standard provider event listeners
      window.ethereum.on?.('accountsChanged', (accounts: string[]) => {
        console.log('LUKSTEALTH: Ethereum accounts changed:', accounts);
      });
      
      window.ethereum.on?.('chainChanged', (chainId: string) => {
        console.log('LUKSTEALTH: Ethereum chain changed:', chainId);
      });
    }
    
    // Return cleanup function
    return () => {
      // Clean up message handler
      window.removeEventListener('message', handleMessage);
    };
  }, []);
  
  // Provider value
  const providerValue = {
    isLuksoUP,
    upProvider,
    isInitializing,
    upAccounts,
    upInitialized,
    connect,
    controllers,
    contextAccounts,
    gridOwner
  };
  
  return (
    <UPProviderContext.Provider value={providerValue}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/send" element={<Send />} />
                <Route path="/receive" element={<Receive />} />
                <Route path="/withdraw" element={<Withdraw />} />
                <Route path="/scan" element={<Scan />} />
                <Route path="/developer-mode" element={<DeveloperMode />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </WagmiProvider>
      </QueryClientProvider>
    </UPProviderContext.Provider>
  );
};

// Fix for "container that has already been passed to createRoot()" warning
const rootElement = document.getElementById('root');
// Only create root if it doesn't exist
if (rootElement && !rootElement.hasAttribute('data-react-root')) {
  rootElement.setAttribute('data-react-root', 'true');
  const root = ReactDOM.createRoot(rootElement as HTMLElement);
  root.render(<App />);
}
