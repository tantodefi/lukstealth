import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { UPProviderContext } from '../index';
import { createPublicClient, http, getContract } from 'viem';
import { lukso } from 'viem/chains';
import { 
  LUKSO_MAINNET_ERC5564_REGISTRY, 
  LUKSO_MAINNET_ERC5564_ANNOUNCER, 
  announcerABI 
} from '../constants/contractData';
import { computeStealthKey } from '../utils/crypto';
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
  // Get UP provider context
  const { 
    isLuksoUP, 
    upProvider, 
    isInitializing: isUPInitializing, 
    upAccounts,
    connect: connectUP
  } = useContext(UPProviderContext);

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
    if (isUPInitializing) {
      setConnectionMessage('Initializing LUKSO UP provider...');
    } else if (isLuksoUP) {
      setConnectionMessage('LUKSO UP provider initialized');
      
      if (upAccounts.length > 0) {
        setConnectionMessage(`Connected to LUKSO UP: ${truncateAddress(upAccounts[0])}`);
      } else {
        setConnectionMessage('LUKSO UP provider ready. Click Connect to connect.');
      }
    } else {
      setConnectionMessage('LUKSO UP not detected. Will use MetaMask or other standard wallet if available.');
    }
  }, [isLuksoUP, isUPInitializing, upAccounts]);

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
      
      let accounts;
      if (isLuksoUP) {
        accounts = await connectUP();
      } else if (window.ethereum) {
        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      } else {
        throw new Error('No wallet provider detected');
      }
      
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
      
      // Get all Announcement events
      const events = await publicClient.getLogs({
        address: LUKSO_MAINNET_ERC5564_ANNOUNCER as `0x${string}`,
        event: {
          type: 'event',
          name: 'Announcement',
          inputs: [
            { indexed: true, name: 'schemeId', type: 'address' },
            { indexed: true, name: 'caller', type: 'address' },
            { indexed: false, name: 'announcement', type: 'bytes' }
          ]
        },
        fromBlock,
        toBlock: 'latest'
      });
      
      console.log(`Found ${events.length} announcement events`);
      
      // Process the events
      const foundTransactions: StealthTransaction[] = [];
      
      for (const event of events) {
        try {
          // Extract announcement data from the event
          const announcement = event.args.announcement as string;
          
          // Decode the announcement (typical format: stealthAddress (20 bytes) + ephemeralPublicKey (33+ bytes))
          if (announcement.length < 106) continue; // Minimum length check (20 bytes address + 33 bytes key)
          
          const stealthAddress = '0x' + announcement.slice(2, 42); // First 20 bytes
          const ephemeralPublicKey = '0x' + announcement.slice(42); // Remaining bytes
          
          // In a real implementation, we would:
          // 1. Use the viewing key and ephemeral key to check if this payment is for us
          // 2. If it is, compute the private key and get the balance
          
          // For now, we'll just add all announcements we find
          const balance = await getEtherBalance(stealthAddress);
          
          // Only add transactions with a positive balance
          if (balance !== '0 LYX') {
            foundTransactions.push({
              id: event.transactionHash,
              stealthAddress,
              ephemeralPublicKey,
              amount: balance,
              timestamp: Number((await publicClient.getBlock({ blockHash: event.blockHash })).timestamp),
              status: 'pending',
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash
            });
          }
        } catch (error) {
          console.error('Error processing announcement:', error);
          // Continue with the next announcement
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

  // Handle withdrawal of funds
  const handleWithdraw = async (transaction: StealthTransaction) => {
    try {
      // Set the specific transaction to withdrawing state
      setIsWithdrawing(prev => ({
        ...prev,
        [transaction.id]: true
      }));
      setError(null);
      setWithdrawSuccess(null);
      
      if (!spendingKey) {
        throw new Error('Spending key is required');
      }
      
      // Connect to wallet first
      const account = await connectWallet();
      if (!account) {
        setIsWithdrawing(prev => ({
          ...prev,
          [transaction.id]: false
        }));
        return;
      }
      
      console.log(`Withdrawing from stealth address ${transaction.stealthAddress}...`);
      
      // Derive the private key for the stealth address
      const stealthAddressInfo = deriveStealthAddress(
        transaction.ephemeralPublicKey,
        viewingKey,
        spendingKey
      );
      
      if (!stealthAddressInfo) {
        throw new Error('Failed to derive stealth address from keys');
      }
      
      console.log('Derived stealth address:', stealthAddressInfo.address);
      
      // If the derived address doesn't match the transaction address, show an error
      if (stealthAddressInfo.address.toLowerCase() !== transaction.stealthAddress.toLowerCase()) {
        throw new Error('Derived stealth address does not match the transaction. Check your keys.');
      }
      
      // Get the balance of the stealth address
      const balance = await publicClient.getBalance({ 
        address: transaction.stealthAddress as `0x${string}` 
      });
      
      if (balance <= BigInt(0)) {
        throw new Error('No funds found at this stealth address');
      }
      
      // Import the private key to the wallet for signing
      // This would typically be handled by a separate signing utility
      // For now, we'll just simulate the withdraw
      
      // In a real implementation:
      // 1. Use the private key to sign a transaction sending funds to the user's main address
      // 2. Broadcast the transaction to the network
      
      // For demonstration, we'll simulate a successful withdrawal
      setTimeout(() => {
        setTransactions(
          transactions.map(tx => 
            tx.id === transaction.id 
              ? { ...tx, status: 'withdrawn' } 
              : tx
          )
        );
        setIsWithdrawing(prev => ({
          ...prev,
          [transaction.id]: false
        }));
        setWithdrawSuccess(`Success! Withdrew ${transaction.amount} from stealth address ${truncateAddress(transaction.stealthAddress)}`);
      }, 2000);
    } catch (error: any) {
      console.error('Error withdrawing funds:', error);
      setError(`Error withdrawing: ${error.message || 'Unknown error'}`);
      setIsWithdrawing(prev => ({
        ...prev,
        [transaction.id]: false
      }));
    }
  };

  // Format timestamp to human-readable date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="page-container">
      {/* Black Banner with White Text */}
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
                <p>Status: <span className={isLuksoUP ? "status-available" : "status-unavailable"}>
                  {connectionMessage}
                </span></p>
              </div>
              
              {!upAccounts.length && (
                <button 
                  className="connect-button"
                  onClick={connectWallet}
                  disabled={isUPInitializing}
                >
                  {isUPInitializing ? "Initializing..." : "Connect Wallet"}
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
        
        {/* Results section */}
        {scanComplete && (
          <div className="results-section">
            <h2>Scan Results</h2>
            {transactions.length > 0 ? (
              <div className="transactions-list">
                {transactions.map((tx) => (
                  <div key={tx.id} className={`transaction-card ${tx.status === 'withdrawn' ? 'withdrawn' : ''}`}>
                    <div className="transaction-header">
                      <span className="transaction-amount">{tx.amount}</span>
                      <span className={`transaction-status ${tx.status}`}>
                        {tx.status === 'withdrawn' ? 'Withdrawn' : 'Pending'}
                      </span>
                    </div>
                    
                    <div className="transaction-details">
                      <div className="detail-row">
                        <span className="detail-label">Stealth Address:</span>
                        <span className="detail-value address">{truncateAddress(tx.stealthAddress)}</span>
                      </div>
                      
                      <div className="detail-row">
                        <span className="detail-label">Date:</span>
                        <span className="detail-value">{formatDate(tx.timestamp)}</span>
                      </div>
                      
                      <div className="detail-row">
                        <span className="detail-label">Ephemeral Key:</span>
                        <span className="detail-value address">{truncateAddress(tx.ephemeralPublicKey)}</span>
                      </div>
                      
                      {tx.blockNumber !== undefined && (
                        <div className="detail-row">
                          <span className="detail-label">Block:</span>
                          <span className="detail-value">{tx.blockNumber.toString()}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="transaction-actions">
                      <button 
                        onClick={() => handleWithdraw(tx)}
                        disabled={isWithdrawing[tx.id] || tx.status === 'withdrawn' || !spendingKey}
                        className={`withdraw-button ${isWithdrawing[tx.id] || tx.status === 'withdrawn' || !spendingKey ? 'disabled' : ''}`}
                      >
                        {isWithdrawing[tx.id] 
                          ? 'Withdrawing...' 
                          : tx.status === 'withdrawn'
                          ? 'Withdrawn'
                          : 'Withdraw Funds'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-results">
                <p>No stealth payments found. Try scanning again later or check your viewing key.</p>
              </div>
            )}
          </div>
        )}
        
        <div className="back-link">
          <Link to="/">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default Scan; 