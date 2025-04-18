import React, { useEffect, useState, useCallback } from 'react';
import { getSignature, generateKeysFromSignature, generateStealthMetaAddressFromSignature, generateStealthAddress, computeStealthKey } from '../utils/crypto';
import { formatEther } from 'ethers';
import {
  VALID_SCHEME_ID,
  createStealthClient,
  ERC5564_CONTRACT_ADDRESS,
  ERC6538_CONTRACT_ADDRESS,
  checkStealthAddress
} from '@scopelift/stealth-address-sdk';
import {
  http,
  type Address,
  createWalletClient,
  custom,
  parseEther,
  type Chain,
  createPublicClient,
  encodeFunctionData
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import 'viem/window';
import { useBalance, useWaitForTransactionReceipt } from 'wagmi';

// Define RPC URL
export const RPC_URL = import.meta.env?.VITE_RPC_URL || 'https://rpc.lukso.network';

// Add LUKSO UP interface to window
declare global {
  interface Window {
    lukso?: any;
  }
}

// Define LUKSO chain for wagmi
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
    public: { http: [RPC_URL] },
    default: { http: [RPC_URL] },
  },
};

// Override for LUKSO contracts
const LUKSO_ERC5564_ADDRESS = '0x014F412De527A9E3708CF861C3Cd975Da53A7900';
const LUKSO_ERC6538_ADDRESS = '0x42a578e3A2a7C8A3C2c24b51C995bEbDd1648C30';

// LUKSO Mainnet Deployed Contracts
const LUKSO_MAINNET_ERC5564_ANNOUNCER = '0x8653F395983827E05A6625eED4D045e696980D16';
const LUKSO_MAINNET_ERC5564_REGISTRY = '0x4E581D6a88bc7D60D092673904d961B6b0961A40';

// Contract ABIs
const ERC5564_ANNOUNCER_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'schemeId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'stealthAddress', type: 'address' },
      { indexed: true, internalType: 'address', name: 'caller', type: 'address' },
      { indexed: false, internalType: 'bytes', name: 'ephemeralPubKey', type: 'bytes' },
      { indexed: false, internalType: 'bytes', name: 'metadata', type: 'bytes' }
    ],
    name: 'Announcement',
    type: 'event'
  },
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

const ERC5564_REGISTRY_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'registrant', type: 'address' },
      { indexed: false, internalType: 'string', name: 'stealthMetaAddress', type: 'string' }
    ],
    name: 'StealthMetaAddressSet',
    type: 'event'
  },
  {
    inputs: [
      { internalType: 'address', name: 'registrant', type: 'address' }
    ],
    name: 'getStealthMetaAddress',
    outputs: [
      { internalType: 'string', name: '', type: 'string' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'string', name: 'stealthMetaAddress', type: 'string' }
    ],
    name: 'setStealthMetaAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'registrant', type: 'address' },
      { internalType: 'string', name: 'stealthMetaAddress', type: 'string' },
      { internalType: 'bytes', name: 'signature', type: 'bytes' }
    ],
    name: 'setStealthMetaAddressFor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

const IntegratedStealthExampleWrapper = () => {
  // State for initialization
  const [hasEthereum, setHasEthereum] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [stealthClient, setStealthClient] = useState<any>(null);
  const [isLuksoUP, setIsLuksoUP] = useState<boolean>(false);

  // Effect to initialize the stealth client
  useEffect(() => {
    const init = async () => {
      try {
        // Check if window.ethereum exists
        if (typeof window !== 'undefined') {
          const hasEth = window.ethereum !== undefined || window.lukso !== undefined;
          setHasEthereum(hasEth);
          
          if (!hasEth) {
            setInitError('No Web3 provider detected');
            setIsLoading(false);
            return;
          }
          
          // Check if it's LUKSO UP or regular wallet
          const isLuksoWallet = typeof window.lukso !== 'undefined';
          setIsLuksoUP(isLuksoWallet);
          
          // Create a transport based on window.ethereum or window.lukso
          const transport = custom(isLuksoWallet ? window.lukso : window.ethereum);
          
          // Create public client
          const publicClient = createPublicClient({
            chain: sepolia, // Using Sepolia by default for compatibility
            transport: http(RPC_URL),
          });
          
          // Initialize stealth client with LUKSO specific contract addresses
          const client = createStealthClient({
            ERC5564Address: LUKSO_ERC5564_ADDRESS,
            ERC6538Address: LUKSO_ERC6538_ADDRESS,
            publicClient,
            chainId: sepolia.id, // Using Sepolia ID for compatibility
          });
          
          setStealthClient(client);
        }
      } catch (error) {
        console.error('Failed to initialize stealth client', error);
        setInitError(`Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    init();
  }, []);

  // Now we can safely render different components based on the state
  if (!hasEthereum) {
    return <div>A Web3 provider like MetaMask is required to use this app.</div>;
  }
  
  if (isLoading) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Loading...</h1>
        <p>Initializing stealth address client...</p>
      </div>
    );
  }
  
  if (initError) {
    return (
      <div className="error" style={{ padding: '20px', color: 'red' }}>
        <h1>Initialization Error</h1>
        <p>{initError}</p>
        <p>Please check the console for more details.</p>
      </div>
    );
  }
  
  if (!stealthClient) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Error</h1>
        <p>Failed to initialize stealth client.</p>
      </div>
    );
  }
  
  // If we've reached this point, we have all the required dependencies
  return (
    <IntegratedStealthExample 
      stealthClient={stealthClient} 
      isLuksoUP={isLuksoUP} 
      hasEthereum={hasEthereum}
    />
  );
};

// The main component that handles stealth address functionality
const IntegratedStealthExample = ({ 
  stealthClient, 
  isLuksoUP,
  hasEthereum
}: { 
  stealthClient: any; 
  isLuksoUP: boolean;
  hasEthereum: boolean;
}) => {
  const [loading, setLoading] = useState({
    generateKeys: false,
    getStealthMetaAddress: false,
    generateStealthAddress: false,
    computeStealthKey: false,
    registerMetaAddress: false,
    announceStealthAddress: false,
    checkRegistration: false
  });
  const [error, setError] = useState(null);
  const [keys, setKeys] = useState([]);
  const [stealthMetaAddress, setStealthMetaAddress] = useState('');
  const [stealthAddressDetails, setStealthAddressDetails] = useState(null);
  const [stealthPrivateKey, setStealthPrivateKey] = useState('');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [stealthAddressBalance, setStealthAddressBalance] = useState(null);
  const [isStealthAddressBalanceLoading, setIsStealthAddressBalanceLoading] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [showPrivateKeyModal, setShowPrivateKeyModal] = useState(false);
  
  // Registry and announcer states
  const [registeredMetaAddress, setRegisteredMetaAddress] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState('');
  const [registrationTxHash, setRegistrationTxHash] = useState('');
  const [announcementTxHash, setAnnouncementTxHash] = useState('');
  const [showRegistrationSection, setShowRegistrationSection] = useState(false);

  // Constants
  const CHAIN = lukso;
  const SCHEME_ID_VALUE = 1; // Same as VALID_SCHEME_ID.SCHEME_ID_1
  const MESSAGE_TO_SIGN = `I authorize the creation of stealth keys and meta-address that will allow others to send me private payments.`;
  const SEND_AMOUNT = '0.01';
  const WITHDRAW_AMOUNT = '0.009';

  // For handling the linter error with SCHEME_ID
  const getSchemeIdValue = () => {
    // The SDK exports VALID_SCHEME_ID.SCHEME_ID_1 as value 1
    return 1;
  };

  // Load stealth address from localStorage on component mount
  useEffect(() => {
    try {
      // Check if localStorage is available
      const isLocalStorageAvailable = typeof window !== 'undefined' && window.localStorage !== undefined;
      console.log("Is localStorage available:", isLocalStorageAvailable);
      
      if (!isLocalStorageAvailable) {
        console.error("localStorage is not available in this browser");
        return;
      }
      
      // Load all data from localStorage
      const savedKeys = localStorage.getItem('stealthKeys');
      const savedMetaAddress = localStorage.getItem('stealthMetaAddress');
      const savedStealthAddress = localStorage.getItem('stealthAddressDetails');
      const savedStealthPrivateKey = localStorage.getItem('stealthPrivateKey');
      
      console.log("Loading from localStorage:", {
        keys: savedKeys ? "Found" : "Not found",
        metaAddress: savedMetaAddress ? "Found" : "Not found",
        stealthAddress: savedStealthAddress ? "Found" : "Not found",
        privateKey: savedStealthPrivateKey ? "Found" : "Not found"
      });
      
      if (savedKeys) {
        try {
          const parsedKeys = JSON.parse(savedKeys);
          console.log("Loaded keys from localStorage:", parsedKeys);
          setKeys(parsedKeys);
        } catch (e) {
          console.error("Failed to parse keys from localStorage:", e);
        }
      }
      
      if (savedMetaAddress) {
        setStealthMetaAddress(savedMetaAddress);
        console.log("Loaded stealth meta-address from localStorage:", savedMetaAddress);
      }
      
      if (savedStealthAddress) {
        try {
          const parsedAddress = JSON.parse(savedStealthAddress);
          console.log("Loaded stealth address details from localStorage:", parsedAddress);
          setStealthAddressDetails(parsedAddress);
        } catch (e) {
          console.error("Failed to parse stealth address from localStorage:", e);
        }
      }
      
      if (savedStealthPrivateKey) {
        setStealthPrivateKey(savedStealthPrivateKey);
        console.log("Loaded stealth private key from localStorage:", savedStealthPrivateKey);
      }
    } catch (err) {
      console.error('Error loading stealth data from localStorage:', err);
    }
  }, []);

  // Generate stealth keys from signature
  const handleGenerateKeys = async () => {
    try {
      setLoading({...loading, generateKeys: true});
      setError(null);
      
      const signature = await getSignature({ message: MESSAGE_TO_SIGN });
      // These are pure cryptographic functions that work regardless of chain
      const newKeys = generateKeysFromSignature(signature);
      setKeys(newKeys);
      
      // Also generate the stealth meta-address - works for both LUKSO and Sepolia
      const newStealthMetaAddress = generateStealthMetaAddressFromSignature(signature);
      setStealthMetaAddress(newStealthMetaAddress);
      
      // Save to localStorage
      try {
        localStorage.setItem('stealthKeys', JSON.stringify(newKeys));
        localStorage.setItem('stealthMetaAddress', newStealthMetaAddress);
        console.log("Saved keys and meta-address to localStorage");
      } catch (e) {
        console.error("Failed to save keys to localStorage:", e);
      }
      
      setLoading({...loading, generateKeys: false});
    } catch (error) {
      handleError('Error generating stealth keys');
      setLoading({...loading, generateKeys: false});
    }
  };

  // Handle click on "View Stealth Meta-Address" button
  const handleViewStealthMetaAddress = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, viewStealthMetaAddress: true }));
      
      if (!keys.spendingPublicKey || !keys.viewingPublicKey) {
        throw new Error('Missing keys. Please generate keys first.');
      }
      
      // Generate meta-address from the public keys
      const generateStealthMetaAddress = (spendingKey: string, viewingKey: string) => {
        return `st:lyx:${spendingKey}${viewingKey.slice(2)}`;
      };
      
      const metaAddress = generateStealthMetaAddress(keys.spendingPublicKey, keys.viewingPublicKey);
      setStealthMetaAddress(metaAddress);
      
      // Save to localStorage
      localStorage.setItem('stealthMetaAddress', metaAddress);
      console.log('Stealth meta-address saved to localStorage:', metaAddress);
      
      setLoading((prev) => ({ ...prev, viewStealthMetaAddress: false }));
    } catch (error) {
      console.error('Error generating stealth meta-address:', error);
      if (error instanceof Error) {
        setError((prev) => ({ ...prev, viewStealthMetaAddress: error.message }));
      }
      setLoading((prev) => ({ ...prev, viewStealthMetaAddress: false }));
    }
  }, [keys]);

  // Handle Generate Stealth Address - this function needs the stealthMetaAddress
  const handleGenerateStealthAddress = useCallback(async () => {
    try {
      console.log('Starting stealth address generation...');
      console.log('Current state:', {
        stealthMetaAddress: !!stealthMetaAddress,
        metaAddressValue: stealthMetaAddress,
        loadingState: loading
      });
      
      if (!stealthMetaAddress) {
        console.error('Stealth meta-address is missing');
        throw new Error('Stealth meta-address not available. Please view stealth meta-address first.');
      }
      
      setLoading((prev) => {
        console.log('Setting loading state to true');
        return { ...prev, generateStealthAddress: true };
      });
      
      console.log('Generating stealth address using meta-address:', stealthMetaAddress);
      
      // This is a pure cryptographic function and works the same on both LUKSO and Sepolia
      const details = generateStealthAddress({
        stealthMetaAddressURI: stealthMetaAddress,
        schemeId: VALID_SCHEME_ID.SCHEME_ID_1
      });
      
      console.log('Generated stealth address details:', details);
      setStealthAddressDetails(details);
      
      // Save to localStorage
      try {
        localStorage.setItem('stealthAddressDetails', JSON.stringify(details));
        console.log("Saved stealth address details to localStorage");
        
        // Clear previous stealth private key if exists
        setStealthPrivateKey('');
        localStorage.removeItem('stealthPrivateKey');
      } catch (e) {
        console.error("Failed to save stealth address details to localStorage:", e);
      }
      
      setLoading((prev) => {
        console.log('Setting loading state to false');
        return { ...prev, generateStealthAddress: false };
      });
    } catch (error) {
      console.error('Error in handleGenerateStealthAddress:', error);
      handleError('Error generating stealth address: ' + (error?.message || 'Unknown error'));
      setLoading((prev) => ({ ...prev, generateStealthAddress: false }));
    }
  }, [stealthMetaAddress]);
  
  const handleConfirmGenerateNew = async () => {
    setShowWarningModal(false);
    setError(null);
    
    try {
      // Clear any existing private key and stealth address info
      setStealthPrivateKey('');
      localStorage.removeItem('stealthPrivateKey');
      
      // Show loading state
      setLoading({...loading, generateKeys: true});
      
      // For LUKSO Universal Profiles, ensure we use the proper signing method
      const message = MESSAGE_TO_SIGN;
      console.log(`Requesting signature for ${isLuksoUP ? 'LUKSO Universal Profile' : 'standard wallet'}`);
      
      // Get signature - this already handles LUKSO UP differences
      const signature = await getSignature({ message });
      
      // Generate keys from signature - this works for both LUKSO and regular wallets
      const newKeys = generateKeysFromSignature(signature);
      setKeys(newKeys);
      
      // Generate the stealth meta-address with st:lyx prefix specifically for LUKSO
      const newStealthMetaAddress = `st:lyx:${newKeys.spendingPublicKey}${newKeys.viewingPublicKey.slice(2)}`;
      setStealthMetaAddress(newStealthMetaAddress);
      
      // Save to localStorage
      try {
        localStorage.setItem('stealthKeys', JSON.stringify(newKeys));
        localStorage.setItem('stealthMetaAddress', newStealthMetaAddress);
        console.log("Saved new LUKSO keys and meta-address to localStorage");
      } catch (e) {
        console.error("Failed to save keys to localStorage:", e);
      }
      
      setLoading({...loading, generateKeys: false});
      
      // Generate new stealth address based on the new meta address
      await handleGenerateStealthAddress();
      
      console.log("Successfully generated new LUKSO stealth keys, meta address, and stealth address");
    } catch (error) {
      console.error("Error generating new stealth information:", error);
      handleError("Failed to generate new stealth keys and address");
      setLoading({...loading, generateKeys: false});
    }
  };

  // Compute stealth key
  const handleComputeStealthKey = () => {
    try {
      setLoading({...loading, computeStealthKey: true});
      setError(null);
      
      if (!keys || !stealthAddressDetails) {
        handleError('Keys and stealth address details are required');
        setLoading({...loading, computeStealthKey: false});
        return;
      }
      
      // Pure cryptographic function that works across all chains
      const stealthKey = computeStealthKey({
        schemeId: SCHEME_ID_VALUE,
        ephemeralPublicKey: stealthAddressDetails.ephemeralPublicKey as `0x${string}`,
        spendingPrivateKey: keys.spendingPrivateKey,
        viewingPrivateKey: keys.viewingPrivateKey
      });
      
      setStealthPrivateKey(stealthKey);
      
      // Save to localStorage
      try {
        localStorage.setItem('stealthPrivateKey', stealthKey);
        console.log("Saved stealth private key to localStorage");
      } catch (e) {
        console.error("Failed to save stealth private key to localStorage:", e);
      }
      
      setLoading({...loading, computeStealthKey: false});
    } catch (error) {
      handleError('Error computing stealth key');
      setLoading({...loading, computeStealthKey: false});
    }
  };

  // Function to add stealth address to MetaMask
  const addToMetaMask = async () => {
    try {
      if (!stealthAddressDetails || !stealthAddressDetails.stealthAddress) {
        handleError('No stealth address to add');
        return;
      }
      
      if (!stealthPrivateKey) {
        // If private key not computed yet, show error message
        handleError('Please compute the private key first');
        return;
      }
      
      // Show the private key modal for manual import
      setShowPrivateKeyModal(true);
      
    } catch (error) {
      console.error('Error adding to wallet:', error);
      handleError('Failed to add to wallet');
    }
  };

  // Get error handling function
  const handleError = (msg: string) => {
    console.error(msg);
    setError(msg);
  };

  // Warning Modal Component
  const WarningModal = () => (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Warning</h3>
        <p>Are you sure you want to generate new viewing/spending keys? They are required to recover your current st:lyx meta-address - we recommend backing up the current public/private keys before continuing and wiping local storage.</p>
        <div className="modal-actions">
          <button onClick={() => setShowWarningModal(false)} type="button">Cancel</button>
          <button onClick={handleConfirmGenerateNew} type="button">Confirm</button>
        </div>
      </div>
    </div>
  );
  
  // Private Key Import Modal
  const PrivateKeyModal = () => (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Import Private Key to MetaMask</h3>
        <p>To add this stealth address to MetaMask, you need to import the private key:</p>
        <div className="private-key-container" style={{ 
          backgroundColor: '#f5f5f5', 
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '15px',
          wordBreak: 'break-all',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          {stealthPrivateKey}
        </div>
        <ol style={{ marginLeft: '20px', fontSize: '14px' }}>
          <li>Open MetaMask</li>
          <li>Click on your account icon in the top-right</li>
          <li>Select "Import Account"</li>
          <li>Paste the private key above</li>
          <li>Click "Import"</li>
        </ol>
        <p style={{ color: 'red', fontSize: '12px', marginTop: '10px' }}>
          Warning: Only import this private key if you trust this application. Keep your private keys secure!
        </p>
        <div className="modal-actions">
          <button onClick={() => setShowPrivateKeyModal(false)} type="button">Close</button>
        </div>
      </div>
    </div>
  );

  // Get accounts from provider
  const getAccounts = async (): Promise<string[]> => {
    try {
      const provider = isLuksoUP ? window.lukso : window.ethereum;
      if (!provider) {
        throw new Error('No provider available');
      }
      
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      return accounts;
    } catch (error) {
      console.error('Error getting accounts:', error);
      throw error;
    }
  };
  
  // Check if meta-address is registered on chain
  const checkRegistration = async () => {
    try {
      setLoading({...loading, checkRegistration: true});
      setError(null);
      
      const accounts = await getAccounts();
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }
      
      const userAddress = accounts[0];
      
      // Create public client for read-only operations
      const publicClient = createPublicClient({
        chain: lukso,
        transport: http(RPC_URL),
      });
      
      // Call the getStealthMetaAddress function on the registry contract
      const result = await publicClient.readContract({
        address: LUKSO_MAINNET_ERC5564_REGISTRY,
        abi: ERC5564_REGISTRY_ABI,
        functionName: 'getStealthMetaAddress',
        args: [userAddress]
      });
      
      if (result && result.length > 0) {
        setRegisteredMetaAddress(result);
        setRegistrationStatus('Registered');
      } else {
        setRegisteredMetaAddress('');
        setRegistrationStatus('Not registered');
      }
      
      setLoading({...loading, checkRegistration: false});
    } catch (error) {
      console.error('Error checking registration:', error);
      handleError('Error checking registration status');
      setLoading({...loading, checkRegistration: false});
    }
  };
  
  // Register meta-address on chain
  const registerMetaAddress = async () => {
    try {
      setLoading({...loading, registerMetaAddress: true});
      setError(null);
      setRegistrationStatus('Preparing transaction...');
      
      if (!stealthMetaAddress) {
        throw new Error('No stealth meta-address to register');
      }
      
      // Ensure we have a connection to the wallet
      let accounts;
      try {
        accounts = await getAccounts();
        console.log("Connected accounts:", accounts);
        
        if (!accounts || accounts.length === 0) {
          throw new Error('No connected accounts found');
        }
      } catch (connectionError) {
        console.error("Wallet connection error:", connectionError);
        throw new Error(`Failed to connect to wallet: ${connectionError instanceof Error ? connectionError.message : 'Unknown error'}`);
      }
      
      // Check if this meta-address is already registered
      try {
        setRegistrationStatus('Checking existing registration...');
        
        // Create public client for read-only operations
        const publicClient = createPublicClient({
          chain: lukso,
          transport: http(RPC_URL),
        });
        
        // Call the getStealthMetaAddress function to check if already registered
        const result = await publicClient.readContract({
          address: LUKSO_MAINNET_ERC5564_REGISTRY,
          abi: ERC5564_REGISTRY_ABI,
          functionName: 'getStealthMetaAddress',
          args: [accounts[0]]
        });
        
        // Convert the result to a readable format
        const existingMetaAddress = result && result.length > 0 ? result : '';
        console.log("Existing registration:", existingMetaAddress);
        
        if (existingMetaAddress && existingMetaAddress.length > 0) {          
          console.log("Existing formatted meta-address:", existingMetaAddress);
          console.log("Attempting to register:", stealthMetaAddress);
          
          if (existingMetaAddress.toLowerCase() === stealthMetaAddress.toLowerCase()) {
            setRegistrationStatus('Meta-address already registered');
            setRegisteredMetaAddress(existingMetaAddress);
            setLoading({...loading, registerMetaAddress: false});
            return;
          } else {
            console.log("Different meta-address already registered. Continuing with registration to update it.");
          }
        }
      } catch (checkError) {
        console.error("Error checking existing registration:", checkError);
        // Continue with registration attempt even if check fails
      }
      
      setRegistrationStatus('Preparing transaction...');
      
      // Create wallet client for transaction
      const provider = isLuksoUP ? window.lukso : window.ethereum;
      if (!provider) {
        throw new Error(`${isLuksoUP ? 'LUKSO UP' : 'Ethereum'} provider not found`);
      }
      
      console.log("Registering meta address:", stealthMetaAddress);
      console.log("Using registry contract:", LUKSO_MAINNET_ERC5564_REGISTRY);
      
      // We don't need to convert to bytes - the contract accepts string directly
      // Use the full meta-address string with the st:lyx: prefix
      const metaAddressString = stealthMetaAddress;
      
      console.log("Meta address string to register:", metaAddressString);
      
      // Encode function call for setStealthMetaAddress
      const data = encodeFunctionData({
        abi: ERC5564_REGISTRY_ABI,
        functionName: 'setStealthMetaAddress',
        args: [metaAddressString]
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
      setRegistrationTxHash(hash);
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
        // Update the registered meta-address
        await checkRegistration();
      } else {
        setRegistrationStatus('Registration failed - transaction reverted');
        throw new Error('Transaction failed - the contract reverted the transaction');
      }
      
      setLoading({...loading, registerMetaAddress: false});
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
      
      handleError(`Error registering meta-address: ${errorMessage}`);
      setRegistrationStatus(`Registration failed: ${errorMessage}`);
      setLoading({...loading, registerMetaAddress: false});
    }
  };
  
  // Announce stealth address on chain
  const announceStealthAddress = async () => {
    try {
      setLoading({...loading, announceStealthAddress: true});
      setError(null);
      
      if (!stealthAddressDetails) {
        throw new Error('No stealth address to announce');
      }
      
      const accounts = await getAccounts();
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }
      
      // Create wallet client for transaction
      const provider = isLuksoUP ? window.lukso : window.ethereum;
      if (!provider) {
        throw new Error(`${isLuksoUP ? 'LUKSO UP' : 'Ethereum'} provider not found`);
      }
      
      // Make sure the ephemeral public key is a valid hex string
      let ephemeralPublicKey = stealthAddressDetails.ephemeralPublicKey;
      if (typeof ephemeralPublicKey === 'string') {
        // Remove any existing 0x prefix to prevent double prefix
        if (ephemeralPublicKey.startsWith('0x')) {
          ephemeralPublicKey = ephemeralPublicKey.substring(2);
        }
        
        // Add a single 0x prefix
        ephemeralPublicKey = `0x${ephemeralPublicKey}`;
      }
      
      console.log("Announcing stealth address:", stealthAddressDetails.stealthAddress);
      console.log("Ephemeral public key:", ephemeralPublicKey);
      
      // The Announcer contract's API does use schemeId
      // Encode function call for announce
      const data = encodeFunctionData({
        abi: ERC5564_ANNOUNCER_ABI,
        functionName: 'announce',
        args: [
          SCHEME_ID_VALUE, 
          stealthAddressDetails.stealthAddress,
          ephemeralPublicKey,
          '0x' // Empty metadata
        ]
      });
      
      // Send transaction using standard eth_sendTransaction
      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
          to: LUKSO_MAINNET_ERC5564_ANNOUNCER,
          data,
        }]
      });
      
      setAnnouncementTxHash(hash);
      
      // Wait for transaction
      const publicClient = createPublicClient({
        chain: lukso,
        transport: http(RPC_URL),
      });
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      setLoading({...loading, announceStealthAddress: false});
    } catch (error) {
      console.error('Error announcing stealth address:', error);
      handleError('Error announcing stealth address');
      setLoading({...loading, announceStealthAddress: false});
    }
  };

  return (
    <div className="stealth-example">
      <h2>Stealth Addresses Workflow</h2>
      
      {/* LUKSO UP Connect Section */}
      {!hasEthereum && (
        <div className="error">
          <p>A Web3 provider like MetaMask or LUKSO UP is required to use this app.</p>
          <a 
            href="https://docs.lukso.tech/guides/browser-extension/install-browser-extension/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: 'blue', textDecoration: 'underline' }}
          >
            Install LUKSO UP Extension
          </a>
        </div>
      )}
      
      {isLuksoUP && (
        <div className="lukso-up-warning">
          <p><strong>LUKSO UP Detected!</strong> Using LUKSO Universal Profile for stealth address operations.</p>
        </div>
      )}
      
      {!stealthMetaAddress && !keys.length && (
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={handleGenerateKeys}
            disabled={loading.generateKeys}
            className="bg-primary text-white p-2 rounded"
          >
            {loading.generateKeys ? 'Connecting...' : 'Connect and Generate Keys'}
          </button>
          <p className="text-sm text-gray-600 mt-2">
            Connect your wallet and generate stealth keys to create secure stealth addresses.
          </p>
        </div>
      )}
      
      {/* Debug info for button state */}
      <div style={{ fontSize: '12px', color: '#888', margin: '10px 0', display: 'none' }}>
        <p>Debug Info:</p>
        <ul>
          <li>Loading state: {JSON.stringify(loading)}</li>
          <li>Stealth Meta Address exists: {Boolean(stealthMetaAddress).toString()}</li>
          <li>Generate button disabled: {(!stealthMetaAddress || loading.generateStealthAddress).toString()}</li>
        </ul>
      </div>

      <div className="button-group">
        <button
          className="bg-primary text-white p-2 rounded w-full disabled:opacity-50 mb-2"
          onClick={handleGenerateStealthAddress}
          disabled={loading.generateStealthAddress}
        >
          {loading.generateStealthAddress ? 'Generating...' : 'Generate Stealth Address'}
        </button>
        <button
          onClick={() => setShowWarningModal(true)}
          disabled={!stealthAddressDetails}
          type="button"
          style={{ marginLeft: '10px', backgroundColor: !stealthAddressDetails ? '#cccccc' : '#e74c3c' }}
        >
          Generate New Meta Address
        </button>
      </div>
      
      {/* Debug info to help troubleshoot */}
      <div className="debug-info" style={{ fontSize: '12px', marginTop: '10px', color: '#666', fontFamily: 'monospace', display: 'none' }}>
        Stealth meta-address: {stealthMetaAddress ? 'Available' : 'Not available'}<br />
        Loading state: {loading.generateStealthAddress ? 'Loading' : 'Not loading'}<br />
        Button should be {!stealthMetaAddress || loading.generateStealthAddress ? 'disabled' : 'enabled'}
      </div>

      {stealthAddressDetails && (
        <div className="info-box">
          <div className="info-row">
            <strong>Stealth Meta Address:</strong>{' '}
            <span style={{ 
              backgroundColor: '#e0e0e0', 
              padding: '2px 4px', 
              borderRadius: '3px',
              fontFamily: 'monospace',
              fontSize: '14px',
              wordBreak: 'break-all'
            }}>
              st:lyx:{stealthMetaAddress ? stealthMetaAddress.substring(7) : ''}
            </span>
          </div>
          <div className="info-row">
            <strong>Stealth Address:</strong> {stealthAddressDetails.stealthAddress}
          </div>
          <div className="info-row">
            <strong>Ephemeral Public Key:</strong>{' '}
            {stealthAddressDetails.ephemeralPublicKey}
          </div>
          <div className="info-row">
            <strong>View Tag:</strong> {stealthAddressDetails.viewTag}
          </div>
          <div className="info-row">
            <strong>Balance:</strong>{' '}
            {isStealthAddressBalanceLoading
              ? 'Loading...'
              : stealthAddressBalance
                ? `${formatEther(stealthAddressBalance.value)} LYX`
                : '0.0 LYX'}
          </div>
          
          {/* Technical Details Collapsible Section */}
          <div className="technical-details" style={{ marginTop: '15px' }}>
            <button 
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              style={{ 
                background: 'none', 
                border: '1px solid #ccc', 
                borderRadius: '4px',
                padding: '8px 12px',
                display: 'flex',
                width: '100%',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
              }}
            >
              <span style={{ 
                fontWeight: 'bold', 
                fontSize: '14px', 
                color: '#333333'
              }}>{showDebugInfo ? 'Hide details' : 'Show details'}</span>
              <span>{showDebugInfo ? '▲' : '▼'}</span>
            </button>
            
            {showDebugInfo && (
              <div style={{ 
                marginTop: '10px', 
                padding: '10px', 
                backgroundColor: '#f5f5f5', 
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '15px' 
                }}>
                  <h3 style={{ margin: 0 }}>Technical Details</h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={handleComputeStealthKey}
                      disabled={!stealthAddressDetails || loading.computeStealthKey}
                      style={{ 
                        backgroundColor: '#3498db', 
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        margin: 0
                      }}
                    >
                      {loading.computeStealthKey ? 'Computing...' : 'Compute Private Key'}
                    </button>
                    <button 
                      onClick={addToMetaMask}
                      disabled={!stealthPrivateKey}
                      style={{ 
                        backgroundColor: '#f6851b', 
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        opacity: !stealthPrivateKey ? '0.5' : '1',
                        margin: 0
                      }}
                    >
                      Add to MetaMask
                    </button>
                  </div>
                </div>
                
                <h4 style={{ margin: '0 0 10px 0' }}>Stealth Keys</h4>
                {keys && keys.spendingPublicKey && (
                  <>
                    <div className="detail-row">
                      <strong>Spending Public Key:</strong> 
                      <div className="code-block">{keys.spendingPublicKey}</div>
                    </div>
                    <div className="detail-row">
                      <strong>Spending Private Key:</strong> 
                      <div className="code-block">{keys.spendingPrivateKey}</div>
                    </div>
                    <div className="detail-row">
                      <strong>Viewing Public Key:</strong> 
                      <div className="code-block">{keys.viewingPublicKey}</div>
                    </div>
                    <div className="detail-row">
                      <strong>Viewing Private Key:</strong> 
                      <div className="code-block">{keys.viewingPrivateKey}</div>
                    </div>
                  </>
                )}
                
                <h4 style={{ margin: '10px 0' }}>Stealth Meta Address</h4>
                <div className="detail-row">
                  <strong>Meta Address:</strong> 
                  <div className="code-block">{stealthMetaAddress || 'Not generated yet'}</div>
                </div>
                
                <h4 style={{ margin: '10px 0' }}>Stealth Address Details</h4>
                {stealthAddressDetails ? (
                  <>
                    <div className="detail-row">
                      <strong>Stealth Address:</strong> 
                      <div className="code-block">{stealthAddressDetails.stealthAddress}</div>
                    </div>
                    <div className="detail-row">
                      <strong>Ephemeral Public Key:</strong> 
                      <div className="code-block">{stealthAddressDetails.ephemeralPublicKey}</div>
                    </div>
                    <div className="detail-row">
                      <strong>View Tag:</strong> 
                      <div className="code-block">{stealthAddressDetails.viewTag}</div>
                    </div>
                  </>
                ) : (
                  <div>No stealth address generated yet</div>
                )}
                
                {stealthPrivateKey && (
                  <>
                    <h4 style={{ margin: '10px 0' }}>Stealth Private Key</h4>
                    <div className="detail-row">
                      <strong>Private Key:</strong> 
                      <div className="code-block">{stealthPrivateKey}</div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Register Keys Section */}
      <div style={{ marginTop: '30px' }}>
        <button
          onClick={() => setShowRegistrationSection(!showRegistrationSection)}
          style={{
            background: 'none',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '8px 12px',
            display: 'flex',
            width: '100%',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            marginBottom: '10px'
          }}
        >
          <span style={{ 
            fontWeight: 'bold', 
            fontSize: '14px', 
            color: '#333333'
          }}>Register meta-address</span>
          <span>{showRegistrationSection ? '▲' : '▼'}</span>
        </button>
        
        {showRegistrationSection && (
          <div className="section" style={{ 
            border: '1px solid #eee', 
            borderRadius: '5px', 
            padding: '15px',
            marginBottom: '20px'
          }}>
            <h3>Register and Announce on LUKSO Mainnet</h3>
            <p style={{ fontSize: '14px', marginBottom: '15px' }}>
              Register your stealth meta-address on-chain and announce stealth addresses using the deployed contracts:
              <br/>
              Announcer: {LUKSO_MAINNET_ERC5564_ANNOUNCER}
              <br/>
              Registry: {LUKSO_MAINNET_ERC5564_REGISTRY}
            </p>
            
            <div className="subsection">
              <h4>Registration Status</h4>
              <button
                onClick={checkRegistration}
                disabled={loading.checkRegistration}
                style={{
                  backgroundColor: '#3498db',
                  marginBottom: '10px'
                }}
              >
                {loading.checkRegistration ? 'Checking...' : 'Check Registration Status'}
              </button>
              
              {registrationStatus && (
                <div className="info-row">
                  <strong>Status:</strong> {registrationStatus}
                </div>
              )}
              
              {registeredMetaAddress && (
                <div className="info-row">
                  <strong>Registered Meta-Address:</strong>
                  <div className="code-block">{registeredMetaAddress}</div>
                </div>
              )}
            </div>
            
            <div className="subsection">
              <h4>Register Meta-Address</h4>
              <p style={{ fontSize: '12px', marginBottom: '10px' }}>
                Register your stealth meta-address on-chain to allow others to find it.
              </p>
              
              {stealthMetaAddress ? (
                <>
                  <div className="info-row">
                    <strong>Meta-Address to Register:</strong>
                    <div className="code-block">{stealthMetaAddress}</div>
                  </div>
                  
                  <button
                    onClick={registerMetaAddress}
                    disabled={loading.registerMetaAddress || !stealthMetaAddress}
                    style={{
                      backgroundColor: '#27ae60',
                      marginTop: '10px'
                    }}
                  >
                    {loading.registerMetaAddress ? 'Registering...' : 'Register Meta-Address'}
                  </button>
                </>
              ) : (
                <p>Generate stealth keys first to get a meta-address</p>
              )}
              
              {registrationTxHash && (
                <div className="info-row" style={{ marginTop: '10px' }}>
                  <strong>Transaction:</strong> 
                  <a 
                    href={`https://explorer.lukso.network/tx/${registrationTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3498db', textDecoration: 'underline' }}
                  >
                    View on Explorer
                  </a>
                </div>
              )}
            </div>
            
            <div className="subsection">
              <h4>Announce Stealth Address</h4>
              <p style={{ fontSize: '12px', marginBottom: '10px' }}>
                Announce a stealth address on-chain to make it discoverable by the recipient.
              </p>
              
              {stealthAddressDetails ? (
                <>
                  <div className="info-row">
                    <strong>Stealth Address to Announce:</strong>
                    <div className="code-block">{stealthAddressDetails.stealthAddress}</div>
                  </div>
                  
                  <div className="info-row">
                    <strong>Ephemeral Public Key:</strong>
                    <div className="code-block">{stealthAddressDetails.ephemeralPublicKey}</div>
                  </div>
                  
                  <button
                    onClick={announceStealthAddress}
                    disabled={loading.announceStealthAddress || !stealthAddressDetails}
                    style={{
                      backgroundColor: '#e67e22',
                      marginTop: '10px'
                    }}
                  >
                    {loading.announceStealthAddress ? 'Announcing...' : 'Announce Stealth Address'}
                  </button>
                </>
              ) : (
                <p>Generate a stealth address first</p>
              )}
              
              {announcementTxHash && (
                <div className="info-row" style={{ marginTop: '10px' }}>
                  <strong>Transaction:</strong> 
                  <a 
                    href={`https://explorer.lukso.network/tx/${announcementTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3498db', textDecoration: 'underline' }}
                  >
                    View on Explorer
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Warning Modal */}
      {showWarningModal && <WarningModal />}
      
      {/* Private Key Modal */}
      {showPrivateKeyModal && <PrivateKeyModal />}

      <style>
        {`
        .stealth-example {
          display: flex;
          flex-direction: column;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: Arial, sans-serif;
        }
        h1, h2, h3 {
          color: #2c3e50;
        }
        .section {
          margin-bottom: 20px;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .subsection {
          margin-bottom: 15px;
          padding: 10px;
          border: 1px solid #eee;
          border-radius: 5px;
        }
        .info-box {
          background-color: #f9f9f9;
          padding: 10px;
          border-radius: 5px;
          margin-top: 10px;
        }
        .info-row {
          margin-bottom: 5px;
        }
        .detail-row {
          margin-bottom: 8px;
        }
        .code-block {
          background-color: #e9e9e9;
          padding: 5px;
          border-radius: 3px;
          word-break: break-all;
          margin-top: 3px;
        }
        .input-row {
          margin-bottom: 10px;
        }
        .input-row label {
          display: block;
          margin-bottom: 5px;
        }
        .input-row input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .success {
          color: #27ae60;
          font-weight: bold;
        }
        .failure {
          color: #e74c3c;
          font-weight: bold;
        }
        .error {
          color: #e74c3c;
          margin-top: 10px;
          padding: 10px;
          background-color: #ffeaea;
          border-radius: 5px;
        }
        .lukso-up-warning {
          background-color: #f0fff4;
          padding: 10px;
          margin-bottom: 15px;
          border-radius: 5px;
          border-left: 4px solid #27ae60;
        }
        .announcement-list {
          margin-top: 10px;
        }
        .announcement-item {
          padding: 8px;
          border: 1px solid #eee;
          margin-bottom: 5px;
          border-radius: 4px;
        }
        button {
          background-color: #3498db;
          color: white;
          border: none;
          padding: 10px 15px;
          border-radius: 5px;
          cursor: pointer;
          margin-right: 10px;
          margin-bottom: 10px;
        }
        button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        .button-group {
          display: flex;
          margin-bottom: 10px;
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .modal-content {
          background-color: white;
          padding: 20px;
          border-radius: 5px;
          max-width: 500px;
          width: 90%;
        }
        
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 20px;
          gap: 10px;
        }
        
        .modal-actions button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .modal-actions button:first-child {
          background-color: #ccc;
        }
        
        .modal-actions button:last-child {
          background-color: #e74c3c;
          color: white;
        }
        `}
      </style>
    </div>
  );
};

export default IntegratedStealthExampleWrapper; 