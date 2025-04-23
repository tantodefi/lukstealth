import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UPProviderContext } from '../index';
import ERC725, { ERC725JSONSchema } from '@erc725/erc725.js';
import Web3 from 'web3';
import { LUKSO_MAINNET_ERC5564_REGISTRY, registryABI } from '../constants/contractData';
import { createPublicClient, http, encodeFunctionData, parseEther } from 'viem';
import { lukso } from 'viem/chains';
import { generateStealthAddress } from '../utils/crypto';

// RPC URL constant
const RPC_URL = import.meta.env?.VITE_RPC_URL || 'https://rpc.lukso.sigmacore.io';

// Add type declarations for window objects
declare global {
  interface Window {
    lukso?: any;
    ethereum?: any;
    // For iframe postMessage communication
    parentLuksoContextAccount?: string;
    // Add global context variable that might be used in the injected script
    __LUKSO_CONTEXT?: {
      contextAccounts?: string[];
      gridOwner?: string;
    };
  }
}

// IPFS Gateway
const IPFS_GATEWAY = 'https://api.universalprofile.cloud/ipfs/';

// Backup RPC URLs if the primary one fails
const BACKUP_URLS = [
  'https://rpc.testnet.lukso.network',
  'https://rc-testnet.rpc.lukso.network',
  'https://mainnet.rpc.lukso.network',
  'https://rpc.lukso.network',
];

// LSP3Profile Schema for ERC725.js
const LSP3_SCHEMA: ERC725JSONSchema[] = [
  {
    name: 'LSP3Profile',
    key: '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5',
    keyType: 'Singleton',
    valueType: 'bytes',
    valueContent: 'VerifiableURI'
  }
];

// Stealth Address Constants
const LUKSO_MAINNET_ERC5564_ANNOUNCER = '0x8653F395983827E05A6625eED4D045e696980D16';
const SCHEME_ID_VALUE = 1n;

// Announcer ABI for stealth payments
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

// Additional interfaces for LUKSO Universal Profile data
interface UPProfile {
  name: string;
  avatar: string;
  description?: string;
}

// Add a utility function to directly access contextAccounts through DOM inspection
const getContextAccountsFromDOM = (): string[] => {
  try {
    if (typeof window !== 'undefined' && window.document) {
      // Look for script tags or data attributes that might contain context info
      const scriptTags = Array.from(document.querySelectorAll('script[data-context]'));
      for (const script of scriptTags) {
        try {
          const contextData = JSON.parse(script.getAttribute('data-context') || '{}');
          if (contextData?.contextAccounts?.length) {
            console.log('LUKSTEALTH: Found contextAccounts in DOM:', contextData.contextAccounts);
            return contextData.contextAccounts;
          }
        } catch (e) {
          console.warn('Error parsing context data from script:', e);
        }
      }
      
      // Try finding in global namespace
      if (window.__LUKSO_CONTEXT && Array.isArray(window.__LUKSO_CONTEXT.contextAccounts)) {
        return window.__LUKSO_CONTEXT.contextAccounts;
      }
    }
  } catch (error) {
    console.warn('LUKSTEALTH: Error in DOM contextAccounts lookup:', error);
  }
  return [];
};

const Send = () => {
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<string>('0.01');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  
  // Get the recipient address from URL parameters if provided
  const location = useLocation();
  const upContext = useContext(UPProviderContext);
  
  // Grid owner state
  const [isLoadingGridOwner, setIsLoadingGridOwner] = useState<boolean>(true);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
  const [gridOwner, setGridOwner] = useState<string | null>(null);
  const [gridOwnerProfile, setGridOwnerProfile] = useState<UPProfile | null>(null);
  const [gridOwnerMetaAddress, setGridOwnerMetaAddress] = useState<string | null>(null);
  const [showGridOwnerPopup, setShowGridOwnerPopup] = useState<boolean>(false);
  
  // Get direct reference to UP provider
  const upProvider = upContext?.upProvider || null;
  
  useEffect(() => {
    // Parse the query parameters
    const params = new URLSearchParams(location.search);
    const recipientParam = params.get('recipient');
    
    if (recipientParam) {
      setRecipient(recipientParam);
      console.log(`Recipient set from URL parameter: ${recipientParam}`);
    }
    
    // Check for gridowner
    checkForGridOwner();
  }, [location, upContext]);
  
  // Function to check for gridowner
  const checkForGridOwner = () => {
    console.log('LUKSTEALTH: Checking for grid owner...');
    
    // Method 1: Direct provider access
    if (upProvider?.contextAccounts?.length > 0) {
      console.log('LUKSTEALTH: Found contextAccounts via provider:', upProvider.contextAccounts);
      const contextAccount = upProvider.contextAccounts[0];
      setGridOwner(contextAccount);
      fetchGridOwnerProfile(contextAccount);
      fetchGridOwnerMetaAddress(contextAccount);
      setIsLoadingGridOwner(false);
      return true;
    }
    
    // Method 2: DOM inspection (critical for incognito mode)
    const domContextAccounts = getContextAccountsFromDOM();
    if (domContextAccounts.length > 0) {
      console.log('LUKSTEALTH: Found contextAccounts via DOM inspection:', domContextAccounts);
      const contextAccount = domContextAccounts[0];
      setGridOwner(contextAccount);
      fetchGridOwnerProfile(contextAccount);
      fetchGridOwnerMetaAddress(contextAccount);
      setIsLoadingGridOwner(false);
      return true;
    }
    
    // Method 3: Window lukso direct access
    if (window.lukso?.contextAccounts?.length > 0) {
      console.log('LUKSTEALTH: Found contextAccounts via window.lukso:', window.lukso.contextAccounts);
      const contextAccount = window.lukso.contextAccounts[0];
      setGridOwner(contextAccount);
      fetchGridOwnerProfile(contextAccount);
      fetchGridOwnerMetaAddress(contextAccount);
      setIsLoadingGridOwner(false);
      return true;
    }
    
    // No gridowner found
    setIsLoadingGridOwner(false);
    return false;
  };
  
  // Fetch the grid owner's profile using ERC725.js
  const fetchGridOwnerProfile = async (address: string) => {
    if (!address) {
      console.error('No address provided for profile fetch');
      return;
    }
    
    console.log('Fetching profile for address:', address);
    setIsLoadingGridOwner(true);
    
    try {
      // Try to create a Web3 instance with any available RPC
      let web3;
      try {
        web3 = new Web3(RPC_URL);
        await web3.eth.net.isListening();
      } catch (error) {
        console.warn('Primary RPC failed, trying alternatives');
        
        for (const rpcUrl of BACKUP_URLS) {
          try {
            web3 = new Web3(rpcUrl);
            await web3.eth.net.isListening();
            console.log(`Connected to ${rpcUrl}`);
            break;
          } catch (err) {
            console.warn(`Failed with ${rpcUrl}`);
          }
        }
      }
      
      if (!web3) {
        throw new Error('Could not connect to any RPC endpoint');
      }
      
      // Create ERC725 instance
      const erc725Options = { ipfsGateway: IPFS_GATEWAY };
      const erc725 = new ERC725(
            LSP3_SCHEMA,
            address,
            web3.currentProvider as any,
            erc725Options
          );
        
      // Fetch profile data
      const profileData = await erc725.getData('LSP3Profile');
      console.log('Profile data:', profileData);
      
      if (profileData && profileData.value) {
        // Try to parse IPFS URL
        const urlValue = typeof profileData.value === 'object' && 'url' in profileData.value
          ? profileData.value.url
          : '';
        console.log('Profile URL:', urlValue);
        
        // Fetch profile JSON
        const ipfsHash = urlValue.toString().replace('ipfs://', '');
        const ipfsUrl = `${IPFS_GATEWAY}${ipfsHash}`;
        console.log('IPFS URL:', ipfsUrl);
        
        const response = await fetch(ipfsUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const profileJson = await response.json();
        console.log('Profile JSON:', profileJson);
        
        if (profileJson && profileJson.LSP3Profile) {
          // Parse profile data
          const profile: UPProfile = {
            name: profileJson.LSP3Profile.name || 'Unknown',
            avatar: profileJson.LSP3Profile.profileImage?.[0]?.url || '',
            description: profileJson.LSP3Profile.description || ''
          };
          
          // Fix avatar URL if it's IPFS
          if (profile.avatar && profile.avatar.startsWith('ipfs://')) {
            profile.avatar = `${IPFS_GATEWAY}${profile.avatar.replace('ipfs://', '')}`;
          }
          
          console.log('Parsed profile:', profile);
          setGridOwnerProfile(profile);
        } else {
          // Default profile if parsing fails
          setGridOwnerProfile({
            name: 'LUKSO User',
            avatar: '',
            description: 'Profile format not recognized'
          });
        }
      } else {
        // Default profile if no data
        setGridOwnerProfile({
          name: 'LUKSO User',
          avatar: '',
          description: 'No profile information available'
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      
      // Default profile on error
      setGridOwnerProfile({
        name: 'LUKSO User',
        avatar: '',
        description: 'Error loading profile'
      });
    } finally {
      setIsLoadingGridOwner(false);
      setIsImageLoading(false);
    }
  };
  
  // Fetch grid owner meta address
  const fetchGridOwnerMetaAddress = async (address: string) => {
    try {
      if (!address) {
        console.error('No grid owner address provided for meta address lookup');
        return;
      }
      
      console.log('Fetching stealth meta address for:', address);
      
      // Try primary RPC URL first, then fall back to backup URLs
      let client;
      try {
        console.log(`Trying primary RPC URL for meta address lookup: ${RPC_URL}`);
        client = createPublicClient({
          chain: lukso,
          transport: http(RPC_URL)
        });
        
        // Test connection with a simple eth_blockNumber call
        await client.getBlockNumber();
        console.log(`Successfully connected to primary RPC: ${RPC_URL}`);
      } catch (error) {
        console.warn(`Failed to connect to primary RPC ${RPC_URL}:`, error);
        client = null;
        
        // Fall back to backup URLs
        for (const rpcUrl of BACKUP_URLS) {
          try {
            console.log(`Trying backup RPC URL: ${rpcUrl}`);
            client = createPublicClient({
              chain: lukso,
              transport: http(rpcUrl)
            });
            
            // Test connection with a simple eth_blockNumber call
            await client.getBlockNumber();
            console.log(`Successfully connected to backup RPC: ${rpcUrl}`);
            break;
          } catch (error) {
            console.warn(`Failed to connect to ${rpcUrl}:`, error);
            client = null;
          }
        }
      }
      
      if (!client) {
        console.error('Failed to connect to any LUKSO RPC endpoint for meta address lookup');
        return;
      }
      
      // Registry contract
      const registryAddress = LUKSO_MAINNET_ERC5564_REGISTRY;
      
      // Log registry details for debugging
      console.log('Registry address:', registryAddress);
      console.log('Registry ABI available:', !!registryABI);
      
      if (!registryABI) {
        console.error('Registry ABI is missing or undefined');
        return;
      }
      
      try {
        // Use the correct function name from the ABI: getStealthMetaAddress
        console.log('Calling getStealthMetaAddress for address:', address);
        const metaAddressResult = await client.readContract({
          address: registryAddress as `0x${string}`,
          abi: registryABI,
          functionName: 'getStealthMetaAddress',
          args: [address as `0x${string}`]
        });
        
        console.log('Meta address lookup result:', metaAddressResult);
        
        if (metaAddressResult) {
          // Handle string format (most common return type from this registry)
          if (typeof metaAddressResult === 'string') {
            const cleanedMetaAddress = metaAddressResult.trim();
            console.log('Meta address found (string):', cleanedMetaAddress);
            
            // Verify it looks like a valid stealth meta address
            if (cleanedMetaAddress && cleanedMetaAddress.length > 0) {
              console.log('Setting valid meta address:', cleanedMetaAddress);
              setGridOwnerMetaAddress(cleanedMetaAddress);
              // Show the popup when meta address is found
              setShowGridOwnerPopup(true);
            } else {
              console.log('Empty or invalid meta address string returned');
            }
          }
          // Handle byte-like objects (alternative format)
          else if (typeof metaAddressResult === 'object' && metaAddressResult !== null) {
            console.log('Meta address found (object type):', typeof metaAddressResult);
            
            try {
              const finalMetaAddress = '0x' + Buffer.from(metaAddressResult as any).toString('hex');
              console.log('Meta address converted from bytes:', finalMetaAddress);
              setGridOwnerMetaAddress(finalMetaAddress);
              // Show the popup when meta address is found
              setShowGridOwnerPopup(true);
            } catch (conversionError) {
              console.error('Error converting meta address from bytes:', conversionError);
            }
          } 
          // Handle array format
          else if (Array.isArray(metaAddressResult)) {
            console.log('Meta address is an array with length:', metaAddressResult.length);
            
            try {
              // If it's a bytes array, convert to hex
              const finalMetaAddress = '0x' + Array.from(metaAddressResult).map(b => 
                (typeof b === 'number' ? b.toString(16) : b).padStart(2, '0')).join('');
              console.log('Meta address converted from array:', finalMetaAddress);
              setGridOwnerMetaAddress(finalMetaAddress);
              // Show the popup when meta address is found
              setShowGridOwnerPopup(true);
            } catch (arrayError) {
              console.error('Error converting meta address from array:', arrayError);
            }
          } else {
            console.log('Unrecognized meta address format:', typeof metaAddressResult);
          }
        } else {
          console.log('No meta address found for address:', address);
        }
      } catch (contractError) {
        console.error('Error reading from registry contract:', contractError);
        // Try another function name if available in the ABI as a fallback
        try {
          const functionNames = registryABI.filter(x => x.type === 'function').map(x => x.name);
          console.log('Available functions in ABI:', functionNames);
          
          if (functionNames.includes('stealthMetaAddressOf')) {
            console.log('Trying stealthMetaAddressOf as fallback');
            const fallbackResult = await client.readContract({
              address: registryAddress as `0x${string}`,
              abi: registryABI,
              functionName: 'stealthMetaAddressOf',
              args: [address as `0x${string}`]
            });
            
            console.log('Fallback lookup result:', fallbackResult);
            if (fallbackResult && typeof fallbackResult === 'string') {
              setGridOwnerMetaAddress(fallbackResult);
              // Show the popup when meta address is found
              setShowGridOwnerPopup(true);
            }
          }
        } catch (fallbackError) {
          console.error('Fallback function also failed:', fallbackError);
        }
      }
    } catch (e) {
      console.error('Error fetching stealth meta address:', e);
    }
  };
  
  // Function to send funds privately
  const sendPrivately = async (recipientMetaAddress: string, sendAmount: string) => {
    try {
      console.log("Starting stealth payment process...");
      setSendStatus("Preparing transaction...");
      setIsSending(true);
      
      // Get wallet provider
      const provider = window.lukso || window.ethereum;
      if (!provider) {
        setSendStatus("No wallet provider found. Please install a Web3 wallet.");
        setIsSending(false);
        return;
      }
      
      // Get user accounts
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        setSendStatus("No accounts found. Please connect your wallet first.");
        setIsSending(false);
        return;
      }
      
      // Generate one-time stealth address from meta-address
      const generatedStealthAddress = generateStealthAddress({
        stealthMetaAddressURI: recipientMetaAddress,
        schemeId: Number(SCHEME_ID_VALUE)
      });
      
      console.log("Generated stealth address:", generatedStealthAddress);
      setSendStatus("Generating stealth address...");
      
      // Convert amount to wei
      const amountWei = parseEther(sendAmount);
      const amountHex = '0x' + amountWei.toString(16);
      
      // Send transaction to the stealth address
      setSendStatus("Sending transaction to stealth address. Please confirm in your wallet...");
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
          to: generatedStealthAddress.stealthAddress,
          value: amountHex
        }]
      });
      
      console.log("Transaction sent:", txHash);
      setSendStatus("Transaction sent. Now announcing to stealth registry...");
      
      // Announce the stealth transaction
      const announceTxHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
          to: LUKSO_MAINNET_ERC5564_ANNOUNCER,
          data: encodeFunctionData({
            abi: ERC5564_ANNOUNCER_ABI,
            functionName: 'announce',
            args: [
              SCHEME_ID_VALUE,
              generatedStealthAddress.stealthAddress,
              generatedStealthAddress.ephemeralPublicKey,
              '0x' // No metadata
            ]
          })
        }]
      });
      
      console.log("Announcement transaction sent:", announceTxHash);
      setSendStatus("Payment sent successfully!");
      
      // Reset after 3 seconds
      setTimeout(() => {
        setIsSending(false);
        setSendStatus("Payment completed successfully!");
      }, 3000);
      
    } catch (error: any) {
      console.error("Error sending stealth payment:", error);
      setSendStatus(`Error: ${error?.message || "Unknown error occurred"}`);
      setIsSending(false);
    }
  };
  
  const handleSend = () => {
    if (!recipient) {
      setSendStatus('Please enter a recipient address');
      return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      setSendStatus('Please enter a valid amount');
      return;
    }
    
    sendPrivately(recipient, amount);
  };
  
  // Set gridowner meta address as recipient
  const selectGridOwner = () => {
    if (gridOwnerMetaAddress) {
      setRecipient(gridOwnerMetaAddress);
      setShowGridOwnerPopup(false);
    }
  };
  
  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ 
        marginBottom: '20px', 
        textAlign: 'center',
        backgroundColor: '#000000',
        color: '#ffffff',
        padding: '15px',
        borderRadius: '8px'
      }}>Send Funds</h1>
      
      <p style={{ marginBottom: '30px', textAlign: 'center' }}>
        Send funds privately to any stealth meta-address.
      </p>
      
      {/* GridOwner Popup */}
      {showGridOwnerPopup && gridOwner && gridOwnerProfile && gridOwnerMetaAddress && (
        <div style={{
          position: 'relative',
          backgroundColor: '#1c2531',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* Avatar */}
            {gridOwnerProfile.avatar ? (
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', marginRight: '12px' }}>
                <img 
                  src={gridOwnerProfile.avatar} 
                  alt={`${gridOwnerProfile.name}'s avatar`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                backgroundColor: '#3498db', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
                fontWeight: 'bold',
                marginRight: '12px'
              }}>
                {gridOwnerProfile.name?.charAt(0) || '?'}
              </div>
            )}
            
            {/* Text */}
            <div>
              <p style={{ margin: '0 0 4px 0', color: '#ffffff', fontWeight: 'bold' }}>Send to {gridOwnerProfile.name}?</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>Grid owner has a registered stealth address</p>
            </div>
          </div>
          
          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setShowGridOwnerPopup(false)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              onClick={selectGridOwner}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: '#0984e3',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Select
            </button>
          </div>
        </div>
      )}
      
      <div style={{ 
        backgroundColor: '#1c2531',
        borderRadius: '12px',
        padding: '30px',
        marginBottom: '30px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '25px' }}>
          <label htmlFor="recipient" style={{ 
            display: 'block', 
            marginBottom: '10px', 
            fontWeight: 'bold',
            color: '#ffffff'
          }}>
            Recipient's Stealth Meta-Address
          </label>
          <input
            id="recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="st:lyx:xxxxxx..."
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '1rem',
              color: '#ffffff',
              fontFamily: 'monospace'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '25px' }}>
          <label htmlFor="amount" style={{ 
            display: 'block', 
            marginBottom: '10px', 
            fontWeight: 'bold',
            color: '#ffffff'
          }}>
            Amount (LYX)
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center'
          }}>
            <input
              id="amount"
              type="number"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              style={{
                flex: 1,
                padding: '15px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '1rem',
                color: '#ffffff'
              }}
            />
            <div style={{
              marginLeft: '10px',
              backgroundColor: 'rgba(9,132,227,0.2)',
              padding: '15px',
              borderRadius: '8px',
              color: '#0984e3',
              fontWeight: 'bold'
            }}>
              LYX
            </div>
          </div>
        </div>
        
        {sendStatus && (
          <div style={{ 
            backgroundColor: sendStatus.includes('Error') || sendStatus.includes('Please') 
              ? 'rgba(255,107,107,0.1)' 
              : 'rgba(46,213,115,0.1)', 
            color: sendStatus.includes('Error') || sendStatus.includes('Please')
              ? '#ff7675' 
              : '#00b894', 
            padding: '15px', 
            borderRadius: '8px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {sendStatus}
          </div>
        )}
        
        <button 
          onClick={handleSend}
          disabled={isSending || !recipient}
          style={{
            backgroundColor: '#0984e3',
            color: 'white',
            padding: '15px 24px',
            borderRadius: '30px',
            border: 'none',
            cursor: isSending || !recipient ? 'default' : 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            width: '100%',
            marginTop: '10px',
            opacity: isSending || !recipient ? 0.7 : 1,
            boxShadow: '0 4px 10px rgba(9,132,227,0.3)',
            transition: 'all 0.2s ease'
          }}
        >
          {isSending ? 'Sending...' : 'Send Privately'}
        </button>
      </div>
      
      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <Link to="/" style={{ color: '#3498db', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
      </div>
    </div>
  );
};

export default Send; 