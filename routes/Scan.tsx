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
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

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
      setScanSuccess(null);
      
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
        setScanSuccess(`Scan complete! Found ${mockTransactions.length} stealth payment(s).`);
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
              disabled={isScanning || !viewingKey.trim()}
              className="scan-button"
            >
              {isScanning ? (
                <>
                  <span className="spinner"></span>
                  <span>Scanning...</span>
                </>
              ) : (
                <>🥷 Scan for Stealth Payments</>
              )}
            </button>
          </div>
        </div>
        
        {/* Transaction List */}
        {scanComplete && (
          <div className="transaction-section">
            <h2>{transactions.length > 0 ? "Found Stealth Payments" : "No Transactions Found"}</h2>
            
            {transactions.length > 0 ? (
              <div className="transaction-list">
                {transactions.map(transaction => (
                  <div key={transaction.id} className="transaction-card">
                    <div className="transaction-details">
                      <div className="transaction-amount">
                        {transaction.amount}
                      </div>
                      
                      <div className="transaction-date">
                        <strong>Received:</strong> {formatDate(transaction.timestamp)}
                      </div>
                      
                      <div className="transaction-address">
                        <strong>Stealth Address:</strong> <span className="address-text">{truncateAddress(transaction.stealthAddress)}</span>
                      </div>
                      
                      <div className="transaction-key truncate">
                        <strong>Ephemeral Key:</strong> <span className="key-text">{truncateAddress(transaction.ephemeralPublicKey)}</span>
                      </div>
                      
                      <div className="transaction-status">
                        <strong>Status:</strong> <span className={`status-badge ${transaction.status}`}>
                          {transaction.status === 'pending' ? '🔓 Available to Withdraw' : '✅ Withdrawn'}
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
                        '🥷 Withdraw Funds'
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
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
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
          max-width: 900px;
          margin: 0 auto 4rem;
          padding: 0 1.5rem;
        }
        
        .main-description {
          margin-bottom: 2rem;
          background-color: #f8f9fa;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .main-description h2 {
          font-size: 1.5rem;
          margin-top: 0;
          margin-bottom: 1rem;
          color: #333;
          display: flex;
          align-items: center;
          gap: 0.5rem;
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
        
        .success-container {
          padding: 1.2rem;
          background: #f1fffa;
          border-left: 4px solid #28a745;
          border-radius: 4px;
          margin-bottom: 2rem;
        }
        
        .success-container.withdraw-success {
          background: #f0f9ff;
          border-left-color: #0066cc;
        }
        
        .success-message {
          color: #28a745;
          margin: 0;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .withdraw-success .success-message {
          color: #0066cc;
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
          border: 1px solid #eaeaea;
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
          background-color: #f8f9fa;
        }
        
        .form-input:focus {
          border-color: #0066cc;
          outline: none;
          box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
          background-color: #fff;
        }
        
        .form-help {
          font-size: 0.85rem;
          color: #666;
          margin: 0.5rem 0 0 0;
        }
        
        .scan-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem 1.5rem;
          border: none;
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border-radius: 8px;
          font-weight: 600;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          width: 100%;
          max-width: 350px;
          margin: 1.5rem auto 0;
          box-shadow: 0 4px 10px rgba(40, 167, 69, 0.3);
          position: relative;
          overflow: hidden;
        }
        
        .scan-button:before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #20c997 0%, #28a745 100%);
          opacity: 0;
          z-index: -1;
          transition: opacity 0.3s ease;
        }
        
        .scan-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(40, 167, 69, 0.4);
        }
        
        .scan-button:hover:not(:disabled):before {
          opacity: 1;
        }
        
        .scan-button:active:not(:disabled) {
          transform: translateY(1px);
          box-shadow: 0 2px 5px rgba(40, 167, 69, 0.3);
        }
        
        .scan-button:disabled {
          background: linear-gradient(135deg, #adadad 0%, #d4d4d4 100%);
          cursor: not-allowed;
          box-shadow: none;
          opacity: 0.7;
        }
        
        .spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
          margin-right: 0.5rem;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .transaction-section {
          margin-bottom: 2rem;
          background-color: #f8f9fa;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .transaction-section h2 {
          font-size: 1.5rem;
          margin: 0 0 1.5rem 0;
          color: #333;
          border-bottom: 1px solid #e9ecef;
          padding-bottom: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .transaction-section h2:before {
          content: '🥷';
          display: inline-block;
        }
        
        .transaction-list {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.2rem;
        }
        
        .transaction-card {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          padding: 1.5rem;
          transition: transform 0.2s, box-shadow 0.2s;
          flex-wrap: wrap;
          border-left: 4px solid #28a745;
          position: relative;
          overflow: hidden;
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
          margin-bottom: 0.7rem;
          display: flex;
          align-items: center;
        }
        
        .transaction-amount:before {
          content: '🥷';
          display: inline-block;
          margin-right: 0.4rem;
          font-size: 1.4rem;
        }
        
        .transaction-date,
        .transaction-address,
        .transaction-key,
        .transaction-status {
          font-size: 0.95rem;
          color: #555;
          margin-bottom: 0.6rem;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.4rem;
        }
        
        .transaction-date strong,
        .transaction-address strong,
        .transaction-key strong,
        .transaction-status strong {
          color: #333;
          min-width: 110px;
        }
        
        .address-text,
        .key-text {
          font-family: monospace;
          background-color: #f8f9fa;
          padding: 0.3rem 0.5rem;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        
        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.7rem;
          border-radius: 4px;
          font-size: 0.85rem;
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
          padding: 0.8rem 1.4rem;
          border: none;
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border-radius: 8px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 10px rgba(40, 167, 69, 0.3);
          position: relative;
          overflow: hidden;
          margin-top: 1rem;
        }
        
        .transaction-button:before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #20c997 0%, #28a745 100%);
          opacity: 0;
          z-index: -1;
          transition: opacity 0.3s ease;
        }
        
        .transaction-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(40, 167, 69, 0.4);
        }
        
        .transaction-button:hover:not(:disabled):before {
          opacity: 1;
        }
        
        .transaction-button:active:not(:disabled) {
          transform: translateY(1px);
          box-shadow: 0 2px 5px rgba(40, 167, 69, 0.3);
        }
        
        .transaction-button:disabled {
          background: linear-gradient(135deg, #adadad 0%, #d4d4d4 100%);
          cursor: not-allowed;
          box-shadow: none;
          opacity: 0.7;
        }
        
        .transaction-button.withdrawn {
          background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
          box-shadow: 0 4px 10px rgba(108, 117, 125, 0.3);
        }
        
        .no-transactions {
          background: #f9f9f9;
          padding: 2rem;
          text-align: center;
          border-radius: 12px;
          color: #666;
          border: 1px dashed #ccc;
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
          transition: color 0.2s, transform 0.2s;
          display: inline-block;
        }
        
        .back-link:hover,
        .action-link:hover {
          color: #0055aa;
          text-decoration: underline;
        }
        
        .back-link:hover {
          transform: translateX(-3px);
        }
        
        .action-link:hover {
          transform: translateX(3px);
        }
        
        .truncate {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
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
            width: 100%;
          }
          
          .status-content {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .connect-button {
            margin-top: 1rem;
            width: 100%;
          }
        }
        
        @media (min-width: 769px) {
          .transaction-button {
            align-self: center;
          }
        }
      `}</style>
    </div>
  );
};

export default Scan; 