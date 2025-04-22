// Define LUKSO chain for viem
export const lukso = {
  id: 42,
  name: 'LUKSO',
  network: 'lukso',
  nativeCurrency: {
    decimals: 18,
    name: 'LUKSO',
    symbol: 'LYX',
  },
  rpcUrls: {
    public: { http: [import.meta.env?.VITE_RPC_URL || 'https://rpc.lukso.sigmacore.io'] },
    default: { http: [import.meta.env?.VITE_RPC_URL || 'https://rpc.lukso.sigmacore.io'] },
  },
}; 