import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { UPProviderContext } from '../index';
import { createPublicClient, http } from 'viem';
import { lukso, RPC_URL } from '../index';

// Define types for stealth transactions
interface StealthTransaction {
  id: string;
  stealthAddress: string;
  ephemeralPublicKey: string;
  amount: string;
  timestamp: number;
  status: 'pending' | 'withdrawn';
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
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<StealthTransaction[]>([]);
  const [connectionMessage, setConnectionMessage] = useState<string>('');

  // Effect to show connection status
  useEffect(() => {
    if (isUPInitializing) {
      setConnectionMessage('Initializing LUKSO UP provider...');
    } else if (isLuksoUP) {
      setConnectionMessage('LUKSO UP provider initialized');
      
      if (upAccounts.length > 0) {
        setConnectionMessage(`Connected to LUKSO UP: ${upAccounts[0]}`);
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
      handleScan(savedViewingKey);
    }
  }, []);

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

  // Handle scanning for payments
  const handleScan = async (key = viewingKey) => {
    try {
      setIsScanning(true);
      setError(null);
      
      if (!key) {
        throw new Error('Viewing key is required');
      }
      
      // Connect to wallet first
      await connectWallet();
      
      // Create a Viem public client for LUKSO
      const client = createPublicClient({
        chain: lukso,
        transport: http(RPC_URL)
      });
      
      console.log('Scanning for stealth transactions...');
      
      // In a real implementation, we would:
      // 1. Get the stealth meta-address derived from the viewing key
      // 2. Query the ERC5564 Announcer contract events
      // 3. Decode announcements and check if they are for our stealth address
      
      // For demo purposes, we're using mock data
      setTimeout(() => {
        // Mock data for UI demonstration
        const mockTransactions: StealthTransaction[] = [
          {
            id: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            stealthAddress: '0x1234567890123456789012345678901234567890',
            ephemeralPublicKey: '0x02abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            amount: '0.5 LYX',
            timestamp: Date.now() - 86400000, // 1 day ago
            status: 'pending'
          },
          {
            id: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            stealthAddress: '0x2345678901234567890123456789012345678901',
            ephemeralPublicKey: '0x03abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            amount: '1.2 LYX',
            timestamp: Date.now() - 172800000, // 2 days ago
            status: 'pending'
          }
        ];
        
        setTransactions(mockTransactions);
        setIsScanning(false);
      }, 2000);
    } catch (error: any) {
      console.error('Error scanning for transactions:', error);
      setError(`Error scanning: ${error.message || 'Unknown error'}`);
      setIsScanning(false);
    }
  };

  // Handle withdrawal of funds
  const handleWithdraw = async (transaction: StealthTransaction) => {
    try {
      setIsWithdrawing(true);
      setError(null);
      
      if (!spendingKey) {
        throw new Error('Spending key is required');
      }
      
      // Connect to wallet first
      const account = await connectWallet();
      if (!account) return;
      
      console.log(`Withdrawing from stealth address ${transaction.stealthAddress}...`);
      
      // In a real implementation, we would:
      // 1. Use the spending key and ephemeral public key to derive the private key for the stealth address
      // 2. Create and sign a transaction to send funds from the stealth address to the user's main address
      // 3. Broadcast the transaction to the network
      
      // For demo purposes, we'll just update the UI
      setTimeout(() => {
        setTransactions(
          transactions.map(tx => 
            tx.id === transaction.id 
              ? { ...tx, status: 'withdrawn' } 
              : tx
          )
        );
        setIsWithdrawing(false);
      }, 2000);
    } catch (error: any) {
      console.error('Error withdrawing funds:', error);
      setError(`Error withdrawing: ${error.message || 'Unknown error'}`);
      setIsWithdrawing(false);
    }
  };

  // Format timestamp to human-readable date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="page-container">
      <div className="scan-container">
        <h1 className="heading">Scan for Stealth Payments</h1>
        
        <p className="description">
          Enter your viewing key to scan for stealth payments sent to your stealth meta-address.
          Once found, you can withdraw the funds using your spending key.
        </p>
        
        {/* Connection status */}
        {connectionMessage && (
          <div className="connection-message">
            {connectionMessage}
          </div>
        )}
        
        {/* Error display */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {/* Scanning form */}
        <div className="form-card">
          <div className="form-group">
            <label htmlFor="viewingKey">Your Viewing Key</label>
            <input
              id="viewingKey"
              type="text"
              value={viewingKey}
              onChange={(e) => setViewingKey(e.target.value)}
              placeholder="Enter your viewing key"
              className="form-input"
            />
          </div>
          
          <button 
            onClick={() => handleScan()}
            disabled={isScanning || !viewingKey.trim()}
            className="primary-button"
          >
            {isScanning ? 'Scanning...' : 'Scan for Payments'}
          </button>
        </div>
        
        {/* Transaction List */}
        {transactions.length > 0 && (
          <div className="transaction-section">
            <h2>Found Transactions</h2>
            
            <div className="form-group">
              <label htmlFor="spendingKey">Your Spending Key (required to withdraw)</label>
              <input
                id="spendingKey"
                type="text"
                value={spendingKey}
                onChange={(e) => setSpendingKey(e.target.value)}
                placeholder="Enter your spending key"
                className="form-input"
              />
            </div>
            
            <div className="transaction-list">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="transaction-card">
                  <div className="transaction-details">
                    <div className="transaction-amount">
                      {transaction.amount}
                    </div>
                    <div className="transaction-date">
                      Received: {formatDate(transaction.timestamp)}
                    </div>
                    <div className="transaction-address">
                      Stealth Address: {transaction.stealthAddress}
                    </div>
                    <div className="transaction-key truncate">
                      Ephemeral Key: {transaction.ephemeralPublicKey}
                    </div>
                  </div>
                  <button
                    onClick={() => handleWithdraw(transaction)}
                    disabled={transaction.status === 'withdrawn' || isWithdrawing || !spendingKey}
                    className={`transaction-button ${transaction.status === 'withdrawn' ? 'withdrawn' : ''}`}
                  >
                    {transaction.status === 'withdrawn' 
                      ? 'Withdrawn' 
                      : isWithdrawing 
                        ? 'Processing...' 
                        : 'Withdraw'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Navigation */}
        <div className="navigation-links">
          <Link to="/" className="back-link">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Scan; 