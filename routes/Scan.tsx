import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { UPProviderContext } from '../index';
import { createPublicClient, http } from 'viem';
import { lukso } from 'viem/chains';
import Web3 from 'web3';

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

  // Helper function to truncate addresses for display
  const truncateAddress = (address: string): string => {
    if (!address) return '';
    return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
  };

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

  // Handle scanning for payments
  const handleScan = async (key = viewingKey) => {
    try {
      setIsScanning(true);
      setError(null);
      setScanComplete(false);
      
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
        // Generate dynamic mock data
        const mockTransactions: StealthTransaction[] = [
          {
            id: '0x' + Math.random().toString(16).substring(2, 34) + Math.random().toString(16).substring(2, 34),
            stealthAddress: '0x' + Math.random().toString(16).substring(2, 42),
            ephemeralPublicKey: '0x02' + Math.random().toString(16).substring(2, 66),
            amount: (Math.random() * 5).toFixed(3) + ' LYX',
            timestamp: Date.now() - Math.floor(Math.random() * 7 * 86400000), // Random time in the last week
            status: 'pending'
          },
          {
            id: '0x' + Math.random().toString(16).substring(2, 34) + Math.random().toString(16).substring(2, 34),
            stealthAddress: '0x' + Math.random().toString(16).substring(2, 42),
            ephemeralPublicKey: '0x03' + Math.random().toString(16).substring(2, 66),
            amount: (Math.random() * 5).toFixed(3) + ' LYX',
            timestamp: Date.now() - Math.floor(Math.random() * 7 * 86400000), // Random time in the last week
            status: 'pending'
          },
          {
            id: '0x' + Math.random().toString(16).substring(2, 34) + Math.random().toString(16).substring(2, 34),
            stealthAddress: '0x' + Math.random().toString(16).substring(2, 42),
            ephemeralPublicKey: '0x03' + Math.random().toString(16).substring(2, 66),
            amount: (Math.random() * 5).toFixed(3) + ' LYX',
            timestamp: Date.now() - Math.floor(Math.random() * 7 * 86400000), // Random time in the last week
            status: 'withdrawn'
          }
        ];
        
        setTransactions(mockTransactions);
        setIsScanning(false);
        setScanComplete(true);
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
      // Set the specific transaction to withdrawing state
      setIsWithdrawing(prev => ({
        ...prev,
        [transaction.id]: true
      }));
      setError(null);
      
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
        setIsWithdrawing(prev => ({
          ...prev,
          [transaction.id]: false
        }));
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
        <h1>Scan for Stealth Payments</h1>
        <p>Find and withdraw private payments sent to your stealth meta-address</p>
      </div>

      <div className="main-container">
        <div className="main-description">
          <h2>Find Your Private Payments</h2>
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
              disabled={isScanning || !viewingKey.trim()}
              className="primary-button"
            >
              {isScanning ? (
                <>
                  <span className="spinner"></span>
                  <span>Scanning...</span>
                </>
              ) : (
                <>🔍 Scan for Payments</>
              )}
            </button>
          </div>
        </div>
        
        {/* Transaction List */}
        {scanComplete && (
          <div className="transaction-section">
            <h2>{transactions.length > 0 ? "Found Transactions" : "No Transactions Found"}</h2>
            
            {transactions.length > 0 ? (
              <div className="transaction-list">
                {transactions.map(transaction => (
                  <div key={transaction.id} className="transaction-card">
                    <div className="transaction-details">
                      <div className="transaction-amount">
                        {transaction.amount}
                      </div>
                      
                      <div className="transaction-date">
                        Received: {formatDate(transaction.timestamp)}
                      </div>
                      
                      <div className="transaction-address">
                        Stealth Address: <span className="address-text">{truncateAddress(transaction.stealthAddress)}</span>
                      </div>
                      
                      <div className="transaction-key truncate">
                        Ephemeral Key: <span className="key-text">{truncateAddress(transaction.ephemeralPublicKey)}</span>
                      </div>
                      
                      <div className="transaction-status">
                        Status: <span className={`status-badge ${transaction.status}`}>
                          {transaction.status === 'pending' ? 'Available to Withdraw' : 'Withdrawn'}
                        </span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleWithdraw(transaction)}
                      disabled={transaction.status === 'withdrawn' || isWithdrawing[transaction.id] || !spendingKey}
                      className={`transaction-button ${transaction.status === 'withdrawn' ? 'withdrawn' : ''}`}
                    >
                      {isWithdrawing[transaction.id] ? (
                        <>
                          <span className="spinner"></span>
                          <span>Withdrawing...</span>
                        </>
                      ) : transaction.status === 'withdrawn' ? (
                        '✓ Withdrawn'
                      ) : (
                        '💰 Withdraw Funds'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-transactions">
                <p>No stealth payments found for this viewing key.</p>
              </div>
            )}
          </div>
        )}
        
        {/* Navigation Links */}
        <div className="navigation-links">
          <Link to="/" className="back-link">
            ← Back to Home
          </Link>
          <Link to="/receive" className="action-link">
            Create a Stealth Address →
          </Link>
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
        
        .main-container {
          max-width: 900px;
          margin: 0 auto 4rem;
          padding: 0 1.5rem;
        }
        
        .main-description {
          margin-bottom: 2rem;
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
        
        .status-section {
          margin-bottom: 2rem;
        }
        
        .status-section h2 {
          font-size: 1.5rem;
          margin: 0 0 1rem 0;
          color: #333;
        }
        
        .status-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          padding: 1.5rem;
        }
        
        .status-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
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
        
        .status-unavailable {
          color: #dc3545;
          font-weight: 500;
        }
        
        .connect-button {
          padding: 0.7rem 1.2rem;
          border: none;
          background-color: #0066cc;
          color: white;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .connect-button:hover:not(:disabled) {
          background-color: #0055aa;
        }
        
        .connect-button:disabled {
          background-color: #bbb;
          cursor: not-allowed;
        }
        
        .error-container {
          padding: 1.2rem;
          background: #fff8f8;
          border-left: 4px solid #dc3545;
          border-radius: 4px;
          margin-bottom: 2rem;
        }
        
        .error-message {
          color: #dc3545;
          margin: 0;
          font-size: 0.95rem;
        }
        
        .scan-form-section {
          margin-bottom: 2rem;
        }
        
        .scan-form-section h2 {
          font-size: 1.5rem;
          margin: 0 0 1rem 0;
          color: #333;
        }
        
        .form-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          padding: 1.5rem;
          margin-bottom: 2rem;
        }
        
        .form-group {
          margin-bottom: 1.5rem;
        }
        
        .form-label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #333;
        }
        
        .form-input {
          width: 100%;
          padding: 0.8rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 1rem;
          font-family: monospace;
          transition: border-color 0.2s;
        }
        
        .form-input:focus {
          border-color: #0066cc;
          outline: none;
          box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
        }
        
        .form-help {
          font-size: 0.85rem;
          color: #666;
          margin: 0.5rem 0 0 0;
        }
        
        .primary-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.9rem 1.5rem;
          border: none;
          background-color: #0066cc;
          color: white;
          border-radius: 6px;
          font-weight: 500;
          font-size: 1rem;
          cursor: pointer;
          transition: background-color 0.2s;
          width: 100%;
        }
        
        .primary-button:hover:not(:disabled) {
          background-color: #0055aa;
        }
        
        .primary-button:disabled {
          background-color: #bbb;
          cursor: not-allowed;
        }
        
        .spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .transaction-section {
          margin-bottom: 2rem;
        }
        
        .transaction-section h2 {
          font-size: 1.5rem;
          margin: 0 0 1rem 0;
          color: #333;
        }
        
        .transaction-list {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }
        
        .transaction-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          padding: 1.5rem;
          transition: transform 0.2s, box-shadow 0.2s;
          flex-wrap: wrap;
        }
        
        .transaction-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.08);
        }
        
        .transaction-details {
          flex: 1;
          min-width: 250px;
        }
        
        .transaction-amount {
          font-size: 1.5rem;
          font-weight: 600;
          color: #333;
          margin-bottom: 0.5rem;
        }
        
        .transaction-date,
        .transaction-address,
        .transaction-key,
        .transaction-status {
          font-size: 0.9rem;
          color: #666;
          margin-bottom: 0.4rem;
        }
        
        .address-text,
        .key-text {
          font-family: monospace;
          background-color: #f8f9fa;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
        }
        
        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        
        .status-badge.pending {
          background-color: rgba(40, 167, 69, 0.1);
          color: #28a745;
        }
        
        .status-badge.withdrawn {
          background-color: rgba(108, 117, 125, 0.1);
          color: #6c757d;
        }
        
        .transaction-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 1rem;
          padding: 0.7rem 1.2rem;
          border: none;
          background-color: #28a745;
          color: white;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .transaction-button:hover:not(:disabled) {
          background-color: #218838;
        }
        
        .transaction-button:disabled {
          background-color: #bbb;
          cursor: not-allowed;
        }
        
        .transaction-button.withdrawn {
          background-color: #6c757d;
        }
        
        .no-transactions {
          background: #f8f9fa;
          padding: 2rem;
          text-align: center;
          border-radius: 12px;
          color: #666;
        }
        
        .navigation-links {
          display: flex;
          justify-content: space-between;
          margin-top: 2rem;
        }
        
        .back-link,
        .action-link {
          color: #0066cc;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }
        
        .back-link:hover,
        .action-link:hover {
          color: #0055aa;
          text-decoration: underline;
        }
        
        /* Media Queries */
        @media (max-width: 768px) {
          .banner {
            padding: 2rem 1rem;
          }
          
          .banner h1 {
            font-size: 2rem;
          }
          
          .transaction-card {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .transaction-button {
            margin-top: 1rem;
            align-self: flex-end;
          }
          
          .status-content {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .connect-button {
            margin-top: 1rem;
          }
        }
        
        @media (min-width: 768px) {
          .transaction-button {
            margin-top: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default Scan; 