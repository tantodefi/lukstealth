import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { http, createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import IntegratedStealthExample from './components/integrated-stealth-example';
import StealthActionsExample from './components/stealth-actions-example';

// Add TypeScript declaration for import.meta.env
declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  
  interface ImportMetaEnv {
    readonly VITE_RPC_URL?: string;
    // Add other env variables as needed
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

const App = () => {
  const [showOriginalExample, setShowOriginalExample] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <h1>Stealth Address SDK Examples</h1>
            {/* <button
              onClick={() => setShowOriginalExample(!showOriginalExample)}
              style={{
                padding: '10px 15px',
                margin: '10px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              {showOriginalExample
                ? 'Show Integrated Example'
                : 'Show Original Example'}
            </button> */}
          </div>

          {showOriginalExample ? <StealthActionsExample /> : <IntegratedStealthExample />}
        </div>
      </WagmiProvider>
    </QueryClientProvider>
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
