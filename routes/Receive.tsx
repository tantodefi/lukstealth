import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Link } from 'react-router-dom';
import { getSignature, generateKeysFromSignature } from '../utils/crypto';
import { encodeFunctionData } from 'viem';
import { createPublicClient, http, custom } from 'viem';
import { lukso, RPC_URL, UPProviderContext } from '../index';
import { generateStealthAddress } from '../utils/crypto';

// Registry Contract info
const LUKSO_MAINNET_ERC5564_REGISTRY = '0x4E581D6a88bc7D60D092673904d961B6b0961A40';
const LUKSO_MAINNET_ERC5564_ANNOUNCER = '0x8653F395983827E05A6625eED4D045e696980D16';

// ABIs
const ERC5564_REGISTRY_ABI = [
  {
    inputs: [
      { internalType: 'string', name: 'stealthMetaAddress', type: 'string' }
    ],
    name: 'setStealthMetaAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

const ERC5564_ANNOUNCER_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'schemeId', type: 'uint256' },
      { internalType: 'address', name: 'stealthAddress', type: 'address' },
      { internalType: 'bytes', name: 'ephemeralPubKey', type: 'bytes' },
      { internalType: 'bytes', name: 'metadata', type: 'bytes' }
    ],
    name: 'announce',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

// Constants
const MESSAGE_TO_SIGN = "Sign this message to generate your stealth address keys. This provides access to your stealth address.";
const SCHEME_ID_VALUE = 1n;

// Declare window.lukso for Universal Profile support
declare global {
  interface Window {
    lukso?: any;
    ethereum?: any;
  }
}

const Receive = () => {
  // Get UP provider context
  const { 
    isLuksoUP, 
    upProvider, 
    isInitializing: isUPInitializing, 
    upAccounts,
    connect: connectUP,
    controllers
  } = useContext(UPProviderContext);
  
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
  
  // Status message during UP initialization
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
        setConnectionMessage('LUKSO UP provider ready. Click Generate to connect.');
      }
    } else {
      setConnectionMessage('LUKSO UP not detected. Will use MetaMask or other standard wallet if available.');
    }
  }, [isLuksoUP, isUPInitializing, upAccounts]);
  
  // Get accounts with retry logic to handle rate limits
  const getAccounts = async (): Promise<string[]> => {
    // Use cached accounts if available to reduce requests
    if (upAccounts && upAccounts.length > 0) {
      console.log('Using cached accounts:', upAccounts);
      return upAccounts;
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
    
    // Check if LUKSO UP is available
    const checkLuksoUPAvailability = async (): Promise<boolean> => {
      try {
        return !!(window as any).lukso;
      } catch (error) {
        console.error('Error checking LUKSO UP availability:', error);
        return false;
      }
    };
    
    const luksoUpAvailable = await checkLuksoUPAvailability();
    // Use the existing isLuksoUP from context instead of trying to set it
    const useUPProvider = luksoUpAvailable && isLuksoUP;
    
    if (useUPProvider) {
      console.log('LUKSO UP detected, using it for account retrieval');
      return executeWithRetry(async () => {
        const accounts = await (window as any).lukso.request({ method: 'eth_requestAccounts' });
        console.log('LUKSO UP accounts:', accounts);
        return accounts;
      });
    } else {
      console.log('Using standard Ethereum provider');
      return executeWithRetry(async () => {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        console.log('Ethereum accounts:', accounts);
        return accounts;
      });
    }
  };

  // Generate stealth address - with improved error handling
  const handleGenerateMetaAddress = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      
      // Get wallet accounts with retry logic
      let accounts;
      try {
        // Try using the connect function from context first if we're using LUKSO UP
        if (isLuksoUP) {
          console.log('Trying to connect via UPProviderContext...');
          accounts = await connectUP();
        }
        
        // If no accounts from context or not using LUKSO UP, try the local getAccounts method
        if (!accounts || accounts.length === 0) {
          accounts = await getAccounts();
        }
        
        if (!accounts || accounts.length === 0) {
          throw new Error('No connected wallet accounts found');
        }
        
        console.log(`Using ${isLuksoUP ? 'LUKSO UP' : 'standard wallet'} with account: ${accounts[0]}`);
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
        
        const provider = isLuksoUP ? window.lukso : window.ethereum;
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
      let accounts;
      try {
        // Try using the connect function from context first if we're using LUKSO UP
        if (isLuksoUP) {
          console.log('Trying to connect via UPProviderContext...');
          accounts = await connectUP();
        }
        
        // If no accounts from context or not using LUKSO UP, try the local getAccounts method
        if (!accounts || accounts.length === 0) {
          accounts = await getAccounts();
        }
        
        console.log("Connected accounts:", accounts);
        
        if (!accounts || accounts.length === 0) {
          throw new Error('No connected accounts found');
        }
      } catch (connectionError) {
        console.error("Wallet connection error:", connectionError);
        throw new Error(`Failed to connect to wallet: ${connectionError instanceof Error ? connectionError.message : 'Unknown error'}`);
      }
      
      setRegistrationStatus('Preparing transaction...');
      
      // Get provider - approach from developer mode
      const provider = isLuksoUP ? window.lukso : window.ethereum;
      if (!provider) {
        throw new Error(`${isLuksoUP ? 'LUKSO UP' : 'Ethereum'} provider not found`);
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
      console.log("Sending transaction from account:", accounts[0]);
      
      // Send transaction using the standard eth_sendTransaction method
      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
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
      let accounts;
      try {
        // Try using the connect function from context first if we're using LUKSO UP
        if (isLuksoUP) {
          console.log('Trying to connect via UPProviderContext...');
          accounts = await connectUP();
        }
        
        // If no accounts from context or not using LUKSO UP, try the local getAccounts method
        if (!accounts || accounts.length === 0) {
          accounts = await getAccounts();
        }
        
        console.log("Connected accounts:", accounts);
        
        if (!accounts || accounts.length === 0) {
          throw new Error('No connected accounts found');
        }
      } catch (connectionError) {
        console.error("Wallet connection error:", connectionError);
        throw new Error(`Failed to connect to wallet: ${connectionError instanceof Error ? connectionError.message : 'Unknown error'}`);
      }
      
      // Get provider
      const provider = isLuksoUP ? window.lukso : window.ethereum;
      if (!provider) {
        throw new Error(`${isLuksoUP ? 'LUKSO UP' : 'Ethereum'} provider not found`);
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
      console.log("Sending transaction from account:", accounts[0]);
      
      // Send transaction using standard eth_sendTransaction
      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
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
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px', textAlign: 'center' }}>Receive Funds</h1>
      
      <p style={{ marginBottom: '30px', textAlign: 'center' }}>
        Generate and share your stealth meta-address to receive private payments.
      </p>
      
      {/* Show LUKSO UP connection status */}
      <div style={{ 
        backgroundColor: isLuksoUP ? '#e8f5e9' : '#fff3e0', 
        color: isLuksoUP ? '#2e7d32' : '#e65100', 
        padding: '10px', 
        borderRadius: '4px', 
        marginBottom: '20px',
        textAlign: 'center',
        fontSize: '0.9rem'
      }}>
        {connectionMessage}
        
        {isLuksoUP && upAccounts.length > 0 && controllers.length > 0 && (
          <div style={{ 
            marginTop: '8px', 
            fontSize: '0.8rem',
            opacity: 0.8 
          }}>
            Controllers found: {controllers.length}
          </div>
        )}
      </div>
      
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '30px', 
        borderRadius: '8px',
        marginBottom: '30px'
      }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', textAlign: 'center' }}>
          Your Stealth Meta-Address
        </h2>
        
        {error && (
          <div style={{ 
            backgroundColor: '#f8d7da', 
            color: '#721c24', 
            padding: '10px', 
            borderRadius: '4px', 
            marginBottom: '15px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}
        
        {!stealthMetaAddress ? (
          <button 
            onClick={handleGenerateMetaAddress}
            disabled={isGenerating}
            style={{
              backgroundColor: '#2ecc71',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '4px',
              border: 'none',
              cursor: isGenerating ? 'default' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              display: 'block',
              margin: '0 auto',
              opacity: isGenerating ? 0.7 : 1,
            }}
          >
            {isGenerating ? 'Generating...' : 'Generate Stealth Meta-Address'}
          </button>
        ) : (
          <>
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '12px',
              wordBreak: 'break-all',
              marginBottom: '15px',
              fontSize: '0.9rem'
            }}>
              {stealthMetaAddress}
            </div>
            
            <button
              onClick={handleCopyAddress}
              style={{
                backgroundColor: isCopied ? '#2ecc71' : '#3498db',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                display: 'block',
                margin: '0 auto',
                transition: 'background-color 0.3s'
              }}
            >
              {isCopied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </>
        )}
      </div>
      
      {showOptionalSteps && (
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '30px', 
          borderRadius: '8px',
          marginBottom: '30px'
        }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', textAlign: 'center' }}>
            Optional Steps
          </h2>
          
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>1. Register in the Registry Contract</h3>
            <p style={{ marginBottom: '15px', fontSize: '0.9rem' }}>
              Register your stealth meta-address in the on-chain registry so others can easily find it.
            </p>
            
            {registrationStatus && (
              <div style={{ 
                backgroundColor: registrationStatus.includes('failed') ? '#f8d7da' : '#d4edda', 
                color: registrationStatus.includes('failed') ? '#721c24' : '#155724', 
                padding: '10px', 
                borderRadius: '4px', 
                marginBottom: '15px',
                fontSize: '0.9rem'
              }}>
                {registrationStatus}
              </div>
            )}
            
            <button
              onClick={registerMetaAddress}
              disabled={isRegistering || !stealthMetaAddress}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '4px',
                border: 'none',
                cursor: isRegistering || !stealthMetaAddress ? 'default' : 'pointer',
                fontSize: '0.9rem',
                display: 'block',
                margin: '0 auto',
                opacity: isRegistering || !stealthMetaAddress ? 0.7 : 1,
              }}
            >
              {isRegistering ? 'Registering...' : 'Register Meta-Address'}
            </button>
          </div>
          
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>2. Announce Stealth Address</h3>
            <p style={{ marginBottom: '15px', fontSize: '0.9rem' }}>
              Announce a stealth address to the network for test purposes.
            </p>
            
            {announcementStatus && (
              <div style={{ 
                backgroundColor: announcementStatus.includes('failed') ? '#f8d7da' : '#d4edda', 
                color: announcementStatus.includes('failed') ? '#721c24' : '#155724', 
                padding: '10px', 
                borderRadius: '4px', 
                marginBottom: '15px',
                fontSize: '0.9rem'
              }}>
                {announcementStatus}
              </div>
            )}
            
            <button
              onClick={announceStealthAddress}
              disabled={isAnnouncing || !stealthAddress}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '4px',
                border: 'none',
                cursor: isAnnouncing || !stealthAddress ? 'default' : 'pointer',
                fontSize: '0.9rem',
                display: 'block',
                margin: '0 auto',
                opacity: isAnnouncing || !stealthAddress ? 0.7 : 1,
              }}
            >
              {isAnnouncing ? 'Announcing...' : 'Announce Stealth Address'}
            </button>
          </div>
        </div>
      )}
      
      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <Link to="/" style={{ color: '#3498db', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
      </div>
    </div>
  );
};

export default Receive; 