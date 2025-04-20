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
import Withdraw from './routes/Withdraw';
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
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/send" element={<Send />} />
              <Route path="/receive" element={<Receive />} />
              <Route path="/withdraw" element={<Withdraw />} />
              <Route path="/developer-mode" element={<DeveloperMode />} />
            </Route>
          </Routes>
        </BrowserRouter>
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
