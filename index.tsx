import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { http, createConfig } from 'wagmi';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Import route components
import Home from './routes/Home';
import Send from './routes/Send';
import Receive from './routes/Receive';
import Scan from './routes/Scan';
import DeveloperMode from './routes/DeveloperMode';
import Layout from './components/Layout';

// Import our new UpProvider
import { UpProvider } from './upProvider';

// Define LUKSO provider type
type LuksoProvider = {
  contextAccounts?: string[];
  isConnected?: boolean;
  connect?: () => Promise<any>;
  request?: (method: string, params?: any[]) => Promise<any>;
  on?: (event: string, callback: (...args: any[]) => void) => void;
  removeListener?: (event: string, callback: (...args: any[]) => void) => void;
};

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
    // Add potential extension state variables that might be injected
    __UP_EXTENSION_STATE__?: { contextAccounts?: string[] };
    __UP_STATE__?: { contextAccounts?: string[] };
    __LUKSO_STATE__?: { contextAccounts?: string[] };
    UP_STATE?: { contextAccounts?: string[] };
  }
}

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
    public: { http: [import.meta.env?.VITE_RPC_URL || 'https://rpc.lukso.sigmacore.io'] },
    default: { http: [import.meta.env?.VITE_RPC_URL || 'https://rpc.lukso.sigmacore.io'] }
  }
};

// Create wagmi config
const config = createConfig({
  chains: [lukso],
  transports: {
    [lukso.id]: http()
  },
  // Disable automatic chain switching to avoid CSP errors
  syncConnectedChain: false
});

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

// Get context accounts from DOM (helper function)
const getContextAccountsFromDOM = (): string[] => {
  try {
    if (typeof window !== 'undefined' && window.document) {
      // Check for script tags with data-context attribute
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
      
      // Check for global __LUKSO_CONTEXT
      if (window.__LUKSO_CONTEXT && Array.isArray(window.__LUKSO_CONTEXT.contextAccounts)) {
        return window.__LUKSO_CONTEXT.contextAccounts;
      }
      
      // Check for extension state
      const extensionStateKeys = ['__UP_EXTENSION_STATE__', '__UP_STATE__', '__LUKSO_STATE__', 'UP_STATE'];
      for (const key of extensionStateKeys) {
        const state = (window as any)[key];
        if (state && state.contextAccounts) {
          console.log(`LUKSTEALTH: Found contextAccounts in ${key}:`, state.contextAccounts);
          return state.contextAccounts;
        }
      }
      
      // Check for elements with data attributes
      ['data-up-context', 'data-lukso-context', 'data-extension-context'].forEach(attrName => {
        const elements = document.querySelectorAll(`[${attrName}]`);
        for (let i = 0; i < elements.length; i++) {
          try {
            const element = elements[i];
            const contextStr = element.getAttribute(attrName);
            if (contextStr) {
              const contextData = JSON.parse(contextStr);
              if (contextData && contextData.contextAccounts && Array.isArray(contextData.contextAccounts)) {
                console.log(`LUKSTEALTH: Found context accounts in [${attrName}]:`, contextData.contextAccounts);
                return contextData.contextAccounts;
              }
            }
          } catch (e) {
            console.warn(`LUKSTEALTH: Error parsing ${attrName}:`, e);
          }
        }
      });
    }
  } catch (error) {
    console.warn('LUKSTEALTH: Error in DOM contextAccounts lookup:', error);
  }
  return [];
};

// Create app root
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <UpProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="send" element={<Send />} />
                <Route path="receive" element={<Receive />} />
                <Route path="scan" element={<Scan />} />
                <Route path="developer" element={<DeveloperMode />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </UpProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
