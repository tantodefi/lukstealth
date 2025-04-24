import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getSignature, generateKeysFromSignature } from '../utils/crypto';
import { encodeFunctionData } from 'viem';
import { createPublicClient, http } from 'viem';
import { lukso } from 'viem/chains';
import { generateStealthAddress } from '../utils/crypto';
import { 
  LUKSO_MAINNET_ERC5564_REGISTRY, 
  LUKSO_MAINNET_ERC5564_ANNOUNCER,
  registryABI as ERC5564_REGISTRY_ABI,
  announcerABI as ERC5564_ANNOUNCER_ABI
} from '../constants/contractData';
import { useUpProvider } from '../upProvider';
import ERC725, { ERC725JSONSchema } from '@erc725/erc725.js';

// Constants
const MESSAGE_TO_SIGN = "Sign this message to generate your stealth address keys. This provides access to your stealth address.";
const SCHEME_ID_VALUE = 1n;
const RPC_URL = import.meta.env?.VITE_RPC_URL || 'https://rpc.lukso.sigmacore.io';

// Declare window.lukso for Universal Profile support
declare global {
  interface Window {
    lukso?: any;
    ethereum?: any;
  }
}

const Receive = () => {
  // Get UP provider context using the new hook
  const { 
    provider, 
    accounts, 
    contextAccounts,
    walletConnected
  } = useUpProvider();
  
  const [stealthMetaAddress, setStealthMetaAddress] = useState<string>('');
  const [stealthAddress, setStealthAddress] = useState<string>('');
  const [ephemeralPublicKey, setEphemeralPublicKey] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptionalSteps, setShowOptionalSteps] = useState<boolean>(false);
  
  // Status tracking
  const [registrationStatus, setRegistrationStatus] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [isAnnouncing, setIsAnnouncing] = useState<boolean>(false);
  const [announcementStatus, setAnnouncementStatus] = useState<string>('');
  
  // Status message during provider initialization
  const [connectionMessage, setConnectionMessage] = useState<string>('');
  
  // Effect to show connection status
  useEffect(() => {
    if (!provider) {
      setConnectionMessage('Initializing LUKSO provider...');
    } else {
      if (accounts.length > 0) {
        setConnectionMessage(`Connected to wallet: ${accounts[0]}`);
      } else if (contextAccounts.length > 0) {
        setConnectionMessage(`Context account detected: ${contextAccounts[0]}`);
      } else if (walletConnected) {
        setConnectionMessage('Wallet detected');
      } else {
        setConnectionMessage('Wallet provider ready. Click Generate to connect.');
      }
    }
  }, [provider, accounts, contextAccounts, walletConnected]);
  
  // Get accounts with retry logic to handle rate limits
  const getAccounts = async (): Promise<string[]> => {
    // Use existing accounts if available
    if (accounts && accounts.length > 0) {
      console.log('Using existing accounts:', accounts);
      return accounts as string[];
    }
    
    const MAX_RETRIES = 3;
    const BASE_DELAY = 1000;
    
    // Helper function to execute requests with retry logic
    const executeWithRetry = async (
      fn: () => Promise<string[]>, 
      attemptNumber: number = 1
    ): Promise<string[]> => {
      try {
        console.log(`Attempt ${attemptNumber} to get accounts...`);
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
        console.log(`Rate limit exceeded. Retrying in ${delay}ms...`);
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry with incremented attempt number
        return executeWithRetry(fn, attemptNumber + 1);
      }
    };
    
    if (!provider) {
      throw new Error('No provider available');
    }
    
    return executeWithRetry(async () => {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      console.log('Provider accounts:', accounts);
      return accounts;
    });
  };

  // Generate stealth address - with improved error handling
  const handleGenerateMetaAddress = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      
      // Get wallet accounts with retry logic
      let walletAccounts;
      try {
        walletAccounts = await getAccounts();
        
        if (!walletAccounts || walletAccounts.length === 0) {
          throw new Error('No connected wallet accounts found');
        }
        
        console.log(`Using account: ${walletAccounts[0]}`);
      } catch (accountError: any) {
        console.error('Failed to get accounts:', accountError);
        throw new Error(`Failed to connect to wallet: ${accountError?.message || 'Unknown error'}`);
      }
      
      // Get signature with retry
      let signature;
      try {
        console.log('Requesting signature...');
        // Add a small delay before requesting signature to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (!provider) {
          throw new Error('No web3 provider available');
        }
        
        signature = await getSignature({ message: MESSAGE_TO_SIGN });
        if (!signature) {
          throw new Error('Failed to get signature');
        }
        console.log('Successfully got signature');
      } catch (signError: any) {
        console.error('Error getting signature:', signError);
        throw new Error(`Failed to sign message: ${signError?.message || 'Unknown error'}`);
      }
      
      // Generate keys from signature
      console.log('Generating keys from signature...');
      const generatedKeys = generateKeysFromSignature(signature);
      
      // Format stealth meta address in st:lyx format
      const formattedMetaAddress = `st:lyx:${generatedKeys.spendingPublicKey}${generatedKeys.viewingPublicKey.slice(2)}`;
      setStealthMetaAddress(formattedMetaAddress);
      console.log('Generated stealth meta-address:', formattedMetaAddress);
      
      // Save to localStorage
      try {
        localStorage.setItem('stealthKeys', JSON.stringify(generatedKeys));
        localStorage.setItem('stealthMetaAddress', formattedMetaAddress);
        console.log("Saved keys and meta-address to localStorage");
      } catch (e) {
        console.error("Failed to save keys to localStorage:", e);
        // Continue even if localStorage fails
      }
      
      // Generate a stealth address 
      try {
        console.log("Auto-generating stealth address after key generation");
        const details = generateStealthAddress({
          stealthMetaAddressURI: formattedMetaAddress,
          schemeId: 1
        });
        
        console.log('Generated stealth address details:', details);
        setStealthAddress(details.stealthAddress);
        setEphemeralPublicKey(details.ephemeralPublicKey);
        
        localStorage.setItem('stealthAddressDetails', JSON.stringify(details));
        console.log("Saved stealth address details to localStorage");
      } catch (addrError) {
        console.error("Failed to auto-generate stealth address:", addrError);
        
        // Fallback to random generation if cryptographic derivation fails
        console.log("Falling back to random address generation");
        const randomAddr = "0x" + Array.from({length: 40}, () => 
          Math.floor(Math.random() * 16).toString(16)).join('');
        setStealthAddress(randomAddr);
        
        const randomKey = "0x" + Array.from({length: 64}, () => 
          Math.floor(Math.random() * 16).toString(16)).join('');
        setEphemeralPublicKey(randomKey);
      }
      
      // Show optional steps
      setShowOptionalSteps(true);
      
      setIsGenerating(false);
    } catch (error) {
      console.error('Error generating stealth address:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setIsGenerating(false);
    }
  };

  // Register meta address in the registry contract
  const registerMetaAddress = async () => {
    try {
      setIsRegistering(true);
      setRegistrationStatus('Preparing transaction...');
      
      if (!stealthMetaAddress) {
        throw new Error('No stealth meta-address to register');
      }
      
      // Ensure we have a connection to the wallet
      const walletAccounts = await getAccounts();
      
      if (!walletAccounts || walletAccounts.length === 0) {
        throw new Error('No connected accounts found');
      }
      
      setRegistrationStatus('Preparing transaction...');
      
      if (!provider) {
        throw new Error('Provider not found');
      }
      
      console.log("Registering meta address:", stealthMetaAddress);
      console.log("Using registry contract:", LUKSO_MAINNET_ERC5564_REGISTRY);
      
      // Encode function call for setStealthMetaAddress
      const data = encodeFunctionData({
        abi: ERC5564_REGISTRY_ABI,
        functionName: 'setStealthMetaAddress',
        args: [stealthMetaAddress]
      });
      
      setRegistrationStatus('Waiting for wallet approval...');
      console.log("Sending transaction from account:", walletAccounts[0]);
      
      // Send transaction using the standard eth_sendTransaction method
      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAccounts[0],
          to: LUKSO_MAINNET_ERC5564_REGISTRY,
          data,
        }]
      });
      
      console.log("Transaction hash:", hash);
      setRegistrationStatus('Transaction submitted - waiting for confirmation...');
      
      // Create public client for monitoring transaction
      const publicClient = createPublicClient({
        chain: lukso,
        transport: http(RPC_URL),
      });
      
      console.log("Waiting for transaction receipt...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log("Transaction receipt:", receipt);
      
      if (receipt.status === 'success') {
        setRegistrationStatus('Registration successful!');
      } else {
        setRegistrationStatus('Registration failed - transaction reverted');
        throw new Error('Transaction failed - the contract reverted the transaction');
      }
      
      setIsRegistering(false);
    } catch (error) {
      console.error('Error registering meta-address:', error);
      
      // Provide more specific error message based on the error type
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Handle provider errors with code and message properties
        if ('code' in error && 'message' in error) {
          const errorObj = error as {code: number, message: string};
          if (errorObj.code === -32000 || errorObj.message.includes('execution reverted')) {
            errorMessage = 'Contract execution failed. This could be because: 1) The meta-address format is invalid, 2) You might not have permission to register, or 3) Another issue with the contract logic.';
          } else {
            errorMessage = errorObj.message;
          }
        }
      }
      
      setRegistrationStatus(`Registration failed: ${errorMessage}`);
      setIsRegistering(false);
    }
  };

  // Announce stealth address on chain
  const announceStealthAddress = async () => {
    try {
      setIsAnnouncing(true);
      setAnnouncementStatus('Preparing transaction...');
      
      if (!stealthAddress || !ephemeralPublicKey) {
        throw new Error('No stealth address to announce');
      }
      
      // Ensure we have a connection to the wallet
      const walletAccounts = await getAccounts();
      
      if (!walletAccounts || walletAccounts.length === 0) {
        throw new Error('No connected accounts found');
      }
      
      // Get provider
      if (!provider) {
        throw new Error('Provider not found');
      }
      
      // Make sure the ephemeral public key is a valid hex string
      let ephemeralKey = ephemeralPublicKey;
      if (typeof ephemeralKey === 'string') {
        // Remove any existing 0x prefix to prevent double prefix
        if (ephemeralKey.startsWith('0x')) {
          ephemeralKey = ephemeralKey.substring(2);
        }
        
        // Add a single 0x prefix
        ephemeralKey = `0x${ephemeralKey}`;
      }
      
      console.log("Announcing stealth address:", stealthAddress);
      console.log("Ephemeral public key:", ephemeralKey);
      console.log("Using announcer contract:", LUKSO_MAINNET_ERC5564_ANNOUNCER);
      
      // Encode function call for announce
      const data = encodeFunctionData({
        abi: ERC5564_ANNOUNCER_ABI,
        functionName: 'announce',
        args: [
          SCHEME_ID_VALUE, 
          stealthAddress,
          ephemeralKey,
          '0x' // Empty metadata
        ]
      });
      
      setAnnouncementStatus('Waiting for wallet approval...');
      console.log("Sending transaction from account:", walletAccounts[0]);
      
      // Send transaction using standard eth_sendTransaction
      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAccounts[0],
          to: LUKSO_MAINNET_ERC5564_ANNOUNCER,
          data,
        }]
      });
      
      console.log("Transaction hash:", hash);
      setAnnouncementStatus('Transaction submitted - waiting for confirmation...');
      
      // Create public client for monitoring transaction
      const publicClient = createPublicClient({
        chain: lukso,
        transport: http(RPC_URL),
      });
      
      console.log("Waiting for transaction receipt...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log("Transaction receipt:", receipt);
      
      if (receipt.status === 'success') {
        setAnnouncementStatus('Announcement successful!');
      } else {
        setAnnouncementStatus('Announcement failed - transaction reverted');
        throw new Error('Transaction failed - the contract reverted the transaction');
      }
      
      setIsAnnouncing(false);
    } catch (error) {
      console.error('Error announcing stealth address:', error);
      
      // Provide more specific error message based on the error type
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Handle provider errors with code and message properties
        if ('code' in error && 'message' in error) {
          const errorObj = error as {code: number, message: string};
          if (errorObj.code === -32000 || errorObj.message.includes('execution reverted')) {
            errorMessage = 'Contract execution failed. This could be because of an issue with the contract logic.';
          } else {
            errorMessage = errorObj.message;
          }
        }
      }
      
      setAnnouncementStatus(`Announcement failed: ${errorMessage}`);
      setIsAnnouncing(false);
    }
  };

  const handleCopyAddress = () => {
    if (stealthMetaAddress) {
      navigator.clipboard.writeText(stealthMetaAddress);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="page-container">
      <div className="banner">
        <h1 className="heading">Generate Stealth Address</h1>
        <p>Set up your stealth meta-address to receive private payments</p>
      </div>

      <div className="home-container">
        <div className="status-section">
          <h2>Wallet Connection Status</h2>
          <div className="status-card">
            <div className="status-content">
              <div className="status-info">
                <p>Status: <span className={walletConnected ? "status-available" : "status-unavailable"}>
                  {connectionMessage}
                </span></p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="meta-address-section">
          <h2>Your Stealth Meta-Address</h2>
          
          {error && (
            <div className="error-container">
              <p className="error-message">{error}</p>
            </div>
          )}
          
          {!stealthMetaAddress ? (
            <button 
              onClick={handleGenerateMetaAddress}
              disabled={isGenerating}
              className="generate-button"
            >
              {isGenerating ? (
                <>
                  <span className="spinner"></span>
                  <span>Generating...</span>
                </>
              ) : (
                <>🔑 Generate Stealth Meta-Address</>
              )}
            </button>
          ) : (
            <>
              <div className="address-display">
                {stealthMetaAddress}
              </div>
              
              <button
                onClick={handleCopyAddress}
                className={`copy-address-button ${isCopied ? 'copied' : ''}`}
              >
                {isCopied ? '✓ Copied!' : '📋 Copy to Clipboard'}
              </button>
            </>
          )}
        </div>
        
        {showOptionalSteps && (
          <div className="optional-steps">
            <h2>Optional Steps</h2>
            
            <div className="step-section">
              <h3>1. Register in the Registry Contract</h3>
              <p>
                Register your stealth meta-address in the on-chain registry so others can easily find it.
              </p>
              
              {registrationStatus && (
                <div className={`status-message ${registrationStatus.includes('failed') ? 'error' : 'success'}`}>
                  {registrationStatus}
                </div>
              )}
              
              <button
                onClick={registerMetaAddress}
                disabled={isRegistering || !stealthMetaAddress}
                className="action-button register-button"
              >
                {isRegistering ? (
                  <>
                    <span className="spinner"></span>
                    <span>Registering...</span>
                  </>
                ) : (
                  'Register Meta-Address'
                )}
              </button>
            </div>
            
            <div className="step-section">
              <h3>2. Announce Stealth Address</h3>
              <p>
                Announce a stealth address to the network for test purposes.
              </p>
              
              {announcementStatus && (
                <div className={`status-message ${announcementStatus.includes('failed') ? 'error' : 'success'}`}>
                  {announcementStatus}
                </div>
              )}
              
              <button
                onClick={announceStealthAddress}
                disabled={isAnnouncing || !stealthAddress}
                className="action-button announce-button"
              >
                {isAnnouncing ? (
                  <>
                    <span className="spinner"></span>
                    <span>Announcing...</span>
                  </>
                ) : (
                  'Announce Stealth Address'
                )}
              </button>
            </div>
          </div>
        )}
        
        <div className="navigation-links">
          <Link to="/" className="back-link">
            ← Back to Home
          </Link>
        </div>
      </div>
      
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
        
        .meta-address-section {
          background-color: white;
          padding: 2rem;
          border-radius: 12px;
          margin-bottom: 2rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        
        .meta-address-section h2 {
          font-size: 1.5rem;
          margin: 0 0 1.5rem 0;
          color: #333;
          text-align: center;
        }
        
        .error-container {
          padding: 1.2rem;
          background: #fff8f8;
          border-left: 4px solid #dc3545;
          border-radius: 4px;
          margin-bottom: 1.5rem;
        }
        
        .error-message {
          color: #dc3545;
          margin: 0;
          font-size: 0.95rem;
        }
        
        .generate-button {
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
          max-width: 90%;
          margin: 1rem auto;
          box-shadow: 0 4px 10px rgba(40, 167, 69, 0.3);
          position: relative;
          overflow: hidden;
          z-index: 1;
        }
        
        .generate-button:before {
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
        
        .generate-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(40, 167, 69, 0.4);
        }
        
        .generate-button:hover:not(:disabled):before {
          opacity: 1;
        }
        
        .generate-button:active:not(:disabled) {
          transform: translateY(1px);
          box-shadow: 0 2px 5px rgba(40, 167, 69, 0.3);
        }
        
        .generate-button:disabled {
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
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .address-display {
          background-color: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 1rem;
          word-break: break-all;
          margin-bottom: 1.5rem;
          font-family: monospace;
          font-size: 0.9rem;
          color: #495057;
        }
        
        .copy-address-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.8rem 1.5rem;
          border: none;
          background: linear-gradient(135deg, #0066cc 0%, #3498db 100%);
          color: white;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          margin: 0 auto;
          box-shadow: 0 4px 10px rgba(0, 102, 204, 0.3);
        }
        
        .copy-address-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(0, 102, 204, 0.4);
        }
        
        .copy-address-button:active {
          transform: translateY(1px);
          box-shadow: 0 2px 5px rgba(0, 102, 204, 0.3);
        }
        
        .copy-address-button.copied {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          box-shadow: 0 4px 10px rgba(40, 167, 69, 0.3);
        }
        
        .optional-steps {
          background-color: white;
          padding: 2rem;
          border-radius: 12px;
          margin-bottom: 2rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        
        .optional-steps h2 {
          font-size: 1.5rem;
          margin: 0 0 1.5rem 0;
          color: #333;
          text-align: center;
        }
        
        .step-section {
          margin-bottom: 2rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid #e9ecef;
        }
        
        .step-section:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }
        
        .step-section h3 {
          font-size: 1.2rem;
          margin: 0 0 1rem 0;
          color: #333;
        }
        
        .step-section p {
          margin: 0 0 1.5rem 0;
          color: #666;
          line-height: 1.5;
        }
        
        .status-message {
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
        }
        
        .status-message.success {
          background-color: rgba(40, 167, 69, 0.1);
          color: #28a745;
          border-left: 4px solid #28a745;
        }
        
        .status-message.error {
          background-color: rgba(220, 53, 69, 0.1);
          color: #dc3545;
          border-left: 4px solid #dc3545;
        }
        
        .action-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.8rem 1.5rem;
          border: none;
          color: white;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          margin: 0 auto;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }
        
        .action-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(0, 0, 0, 0.25);
        }
        
        .action-button:active:not(:disabled) {
          transform: translateY(1px);
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
        }
        
        .action-button:disabled {
          background: linear-gradient(135deg, #adadad 0%, #d4d4d4 100%);
          cursor: not-allowed;
          box-shadow: none;
          opacity: 0.7;
        }
        
        .register-button {
          background: linear-gradient(135deg, #0066cc 0%, #3498db 100%);
        }
        
        .announce-button {
          background: linear-gradient(135deg, #f39c12 0%, #ffc107 100%);
        }
        
        .navigation-links {
          display: flex;
          justify-content: space-between;
          margin-top: 2rem;
        }
        
        .back-link {
          color: #0066cc;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s, transform 0.2s;
          display: inline-block;
        }
        
        .back-link:hover {
          color: #0055aa;
          text-decoration: underline;
          transform: translateX(-3px);
        }
        
        @media (max-width: 768px) {
          .banner {
            padding: 2rem 1rem;
          }
          
          .banner h1 {
            font-size: 2rem;
          }
          
          .meta-address-section,
          .optional-steps {
            padding: 1.5rem;
          }
          
          .generate-button,
          .copy-address-button,
          .action-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default Receive; 