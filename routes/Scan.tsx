import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUpProvider } from '../upProvider';
import { createPublicClient, http, getContract } from 'viem';
import { lukso } from 'viem/chains';
import { 
  LUKSO_MAINNET_ERC5564_REGISTRY, 
  LUKSO_MAINNET_ERC5564_ANNOUNCER, 
  announcerABI 
} from '../constants/contractData';
import { computeStealthKey, checkIfStealthAddressIsForMe } from '../utils/crypto';
import './Scan.css'; // Import the CSS file we'll create

// Define RPC URL constant
const RPC_URL = 'https://rpc.lukso.network';

// Backup RPC URLs if the primary one fails
const BACKUP_RPC_URLS = [
  'https://rpc.mainnet.lukso.network',
  'https://lukso.drpc.org',
  'https://1rpc.io/lukso',
  'https://mainnet.lukso.gateway.fm'
];

// Define types for stealth transactions
interface StealthTransaction {
  id: string;
  stealthAddress: string;
  ephemeralPublicKey: string;
  amount: string;
  timestamp: number;
  status: 'pending' | 'withdrawn';
  blockNumber?: bigint;
  transactionHash?: string;
}

const Scan = () => {
  // Get UP provider context using the new hook
  const { 
    provider, 
    accounts, 
    contextAccounts,
    walletConnected
  } = useUpProvider();

  // State management
  const [viewingKey, setViewingKey] = useState<string>('');
  const [spendingKey, setSpendingKey] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isWithdrawing, setIsWithdrawing] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<StealthTransaction[]>([]);
  const [connectionMessage, setConnectionMessage] = useState<string>('');
  const [scanComplete, setScanComplete] = useState<boolean>(false);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  const [publicClient, setPublicClient] = useState<any>(null);

  // Helper function to truncate addresses for display
  const truncateAddress = (address: string): string => {
    if (!address) return '';
    return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
  };

  // Initialize public client
  useEffect(() => {
    const initPublicClient = async () => {
      try {
        const client = createPublicClient({
          chain: lukso,
          transport: http(RPC_URL)
        });
        
        // Test connection with a simple eth_blockNumber call
        await client.getBlockNumber();
        console.log(`Successfully connected to primary RPC: ${RPC_URL}`);
        setPublicClient(client);
      } catch (error) {
        console.warn(`Failed to connect to primary RPC ${RPC_URL}:`, error);
        
        // Fall back to backup URLs
        for (const rpcUrl of BACKUP_RPC_URLS) {
          try {
            console.log(`Trying backup RPC URL: ${rpcUrl}`);
            const client = createPublicClient({
              chain: lukso,
              transport: http(rpcUrl)
            });
            
            // Test connection with a simple eth_blockNumber call
            await client.getBlockNumber();
            console.log(`Successfully connected to backup RPC: ${rpcUrl}`);
            setPublicClient(client);
            break;
          } catch (error) {
            console.warn(`Failed to connect to ${rpcUrl}:`, error);
          }
        }
      }
    };
    
    initPublicClient();
  }, []);

  // Effect to show connection status
  useEffect(() => {
    if (!provider) {
      setConnectionMessage('Initializing LUKSO UP provider...');
    } else {
      if (accounts.length > 0) {
        setConnectionMessage(`Connected to LUKSO UP: ${truncateAddress(accounts[0])}`);
      } else if (contextAccounts.length > 0) {
        setConnectionMessage(`Context account detected: ${truncateAddress(contextAccounts[0])}`);
      } else if (walletConnected) {
        setConnectionMessage('Connected to wallet');
      } else {
        setConnectionMessage('Wallet provider ready. Click Connect to connect.');
      }
    }
  }, [provider, accounts, contextAccounts, walletConnected]);

  // Load saved keys from localStorage
  useEffect(() => {
    const savedViewingKey = localStorage.getItem('stealthViewingKey');
    if (savedViewingKey) {
      setViewingKey(savedViewingKey);
      // Automatically scan if viewing key is available
      setTimeout(() => {
        handleScan(savedViewingKey);
      }, 1000);
    }
    
    const savedSpendingKey = localStorage.getItem('stealthSpendingKey');
    if (savedSpendingKey) {
      setSpendingKey(savedSpendingKey);
    }
  }, []);

  // Save keys to localStorage when they change
  useEffect(() => {
    if (viewingKey) {
      localStorage.setItem('stealthViewingKey', viewingKey);
    }
    
    if (spendingKey) {
      localStorage.setItem('stealthSpendingKey', spendingKey);
    }
  }, [viewingKey, spendingKey]);

  // Connect to wallet
  const connectWallet = async () => {
    try {
      setError(null);
      
      if (!provider) {
        throw new Error('No wallet provider detected');
      }
      
      const accounts = await provider.request({
        method: 'eth_requestAccounts'
      });
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No connected wallet accounts found');
      }
      
      return accounts[0];
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      setError(`Failed to connect wallet: ${error.message || 'Unknown error'}`);
      return null;
    }
  };

  // Get the stealth address from ephemeral key and private keys
  const deriveStealthAddress = (ephemeralPublicKey: string, viewingPrivateKey: string, spendingPrivateKey: string) => {
    try {
      // Use the compute stealth key utility from crypto.ts
      const privateKey = computeStealthKey({
        schemeId: 1, // Use standard scheme ID
        ephemeralPublicKey,
        viewingPrivateKey,
        spendingPrivateKey
      });
      
      // In a real implementation, this would derive the address from the private key
      // For now, we'll just return a placeholder
      return {
        address: '0x' + privateKey.substring(2, 42),
        privateKey
      };
    } catch (error) {
      console.error('Error deriving stealth address:', error);
      return null;
    }
  };

  // Get Ether balance for address
  const getEtherBalance = async (address: string): Promise<string> => {
    if (!publicClient) return '0';
    
    try {
      const balance = await publicClient.getBalance({ address: address as `0x${string}` });
      // Convert balance from wei to ether
      return balance ? (Number(balance) / 1e18).toFixed(6) + ' LYX' : '0 LYX';
    } catch (error) {
      console.error('Error getting balance:', error);
      return '0 LYX';
    }
  };

  // Handle scanning for payments
  const handleScan = async (key = viewingKey) => {
    try {
      setIsScanning(true);
      setError(null);
      setScanComplete(false);
      setScanSuccess(null);
      
      if (!key) {
        throw new Error('Viewing key is required');
      }
      
      if (!publicClient) {
        throw new Error('Connection to LUKSO network not available');
      }
      
      // Connect to wallet first
      await connectWallet();
      
      console.log('Scanning for stealth transactions...');
      
      // Get the block number 30 days ago (approximate)
      const currentBlock = await publicClient.getBlockNumber();
      const blocksPerDay = BigInt(7200); // ~7200 blocks per day on LUKSO
      const lookbackBlocks = blocksPerDay * BigInt(30); // 30 days
      const fromBlock = currentBlock > lookbackBlocks ? currentBlock - lookbackBlocks : BigInt(0);
      
      // Check both possible announcer addresses
      const announcerAddresses = [
        LUKSO_MAINNET_ERC5564_ANNOUNCER as `0x${string}`
      ];

      // Define the events array to store announcement events
      type AnnouncementEvent = {
        address: `0x${string}`;
        blockHash: `0x${string}`;
        blockNumber: bigint;
        logIndex: number;
        transactionHash: `0x${string}`;
        transactionIndex: number;
        args: {
          schemeId: bigint;
          stealthAddress: `0x${string}`;
          caller: `0x${string}`;
          ephemeralPubKey: `0x${string}`;
          metadata: `0x${string}`;
        };
      };
      
      let allEvents: AnnouncementEvent[] = [];
      
      // Try each announcer address
      for (const announcer of announcerAddresses) {
        console.log(`Trying announcer address: ${announcer}`);
        try {
          const announcerEvents = await publicClient.getLogs({
            address: announcer,
            event: {
              type: 'event',
              name: 'Announcement',
              inputs: [
                { indexed: true, name: 'schemeId', type: 'uint256' },
                { indexed: true, name: 'stealthAddress', type: 'address' },
                { indexed: true, name: 'caller', type: 'address' },
                { indexed: false, name: 'ephemeralPubKey', type: 'bytes' },
                { indexed: false, name: 'metadata', type: 'bytes' }
              ]
            },
            fromBlock,
            toBlock: 'latest'
          });
          
          console.log(`Found ${announcerEvents.length} announcement events from ${announcer}`);
          allEvents = [...allEvents, ...announcerEvents];
        } catch (e) {
          console.warn(`Error getting logs from ${announcer}:`, e);
        }
      }
      
      console.log(`Found ${allEvents.length} total announcement events`);
      
      // Process the events
      const foundTransactions: StealthTransaction[] = [];
      
      for (const event of allEvents) {
        try {
          // Extract stealth address and ephemeral public key from the event
          const stealthAddress = event.args.stealthAddress as string;
          const ephemeralPublicKey = event.args.ephemeralPubKey as string;
          
          console.log(`Checking announcement for stealth address: ${stealthAddress}`);
          console.log(`With ephemeral key: ${ephemeralPublicKey}`);
          
          // Check if this payment is for me using improved function
          if (!spendingKey) {
            console.log('Spending key not provided, skipping checkIfStealthAddressIsForMe');
            
            // Try to check the balance to see if this might be yours
            const balance = await publicClient.getBalance({ address: stealthAddress as `0x${string}` });
            if (balance > BigInt(0)) {
              console.log(`Found address with balance ${balance}, but can't verify ownership without spending key`);
            }
            continue;
          }
          
          const isForMe = checkIfStealthAddressIsForMe({
            stealthAddress,
            ephemeralPublicKey,
            viewingPrivateKey: key,
            spendingPrivateKey: spendingKey,
            schemeId: 1
          });
          
          if (isForMe) {
            console.log(`Found a stealth address belonging to you: ${stealthAddress}`);
            
            // Check the balance
            const balance = await publicClient.getBalance({ address: stealthAddress as `0x${string}` });
            
            // Add even with zero balance for reference
            const balanceInEth = balance ? (Number(balance) / 1e18).toFixed(6) + ' LYX' : '0 LYX';
            console.log(`Balance: ${balanceInEth} (${balance})`);
            
            // Get timestamp from block
            const blockTime = Number((await publicClient.getBlock({ blockHash: event.blockHash })).timestamp);
            
            foundTransactions.push({
              id: event.transactionHash,
              stealthAddress,
              ephemeralPublicKey,
              amount: balanceInEth,
              timestamp: blockTime,
              status: 'pending',
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash
            });
          } else {
            console.log(`Address ${stealthAddress} does not belong to you`);
          }
        } catch (error) {
          console.error('Error processing announcement:', error);
        }
      }
      
      setTransactions(foundTransactions);
      setIsScanning(false);
      setScanComplete(true);
      setScanSuccess(`Scan complete! Found ${foundTransactions.length} stealth payment(s).`);
    } catch (error: any) {
      console.error('Error scanning for transactions:', error);
      setError(`Error scanning: ${error.message || 'Unknown error'}`);
      setIsScanning(false);
    }
  };

  return (
    <div className="page-container">
      <div className="banner">
        <h1 className="heading">Scan for Stealth Payments</h1>
        <p>Find and withdraw private payments sent to your stealth meta-address</p>
      </div>

      <div className="home-container">
        <div className="main-description">
          <h2>Find Your Private Payments 🥷</h2>
          <p>
            Enter your viewing key to scan for stealth payments. If payments are found, you can use your spending key to withdraw them to your main wallet.
          </p>
        </div>
        
        {/* Connection status */}
        <div className="status-section">
          <h2>Wallet Connection Status</h2>
          <div className="status-card">
            <div className="status-content">
              <div className="status-info">
                <p>Status: <span className={walletConnected ? "status-available" : "status-unavailable"}>
                  {connectionMessage}
                </span></p>
              </div>
              
              {accounts.length === 0 && (
                <button 
                  className="connect-button"
                  onClick={connectWallet}
                  disabled={!provider}
                >
                  {!provider ? "Initializing..." : "Connect Wallet"}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Error display */}
        {error && (
          <div className="error-container">
            <p className="error-message">{error}</p>
          </div>
        )}
        
        {/* Success message */}
        {scanSuccess && (
          <div className="success-container">
            <p className="success-message">✅ {scanSuccess}</p>
          </div>
        )}
        
        {/* Withdraw success message */}
        {withdrawSuccess && (
          <div className="success-container withdraw-success">
            <p className="success-message">💰 {withdrawSuccess}</p>
          </div>
        )}
        
        {/* Scanning form */}
        <div className="scan-form-section">
          <h2>Enter Your Keys</h2>
          <div className="form-card">
            <div className="form-group">
              <label htmlFor="viewingKey" className="form-label">Your Viewing Key</label>
              <input
                id="viewingKey"
                type="text"
                value={viewingKey}
                onChange={(e) => setViewingKey(e.target.value)}
                placeholder="Enter your viewing key"
                className="form-input"
              />
              <p className="form-help">This key allows you to see payments sent to your stealth meta-address.</p>
            </div>
            
            <div className="form-group">
              <label htmlFor="spendingKey" className="form-label">Your Spending Key (required to withdraw)</label>
              <input
                id="spendingKey"
                type="text"
                value={spendingKey}
                onChange={(e) => setSpendingKey(e.target.value)}
                placeholder="Enter your spending key"
                className="form-input"
              />
              <p className="form-help">This key is needed to withdraw funds from stealth addresses.</p>
            </div>
            
            <button 
              onClick={() => handleScan()}
              disabled={isScanning || !viewingKey}
              className={`scan-button ${isScanning || !viewingKey ? 'disabled' : ''}`}
            >
              {isScanning ? 'Scanning...' : 'Scan for Payments'}
            </button>
          </div>
        </div>
        
        <div className="back-link">
          <Link to="/">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default Scan;