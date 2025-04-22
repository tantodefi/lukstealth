// Add type declarations for wallet providers
declare global {
  interface Window {
    lukso?: any;
    ethereum?: any;
  }
}

/**
 * Gets a signature from the user by asking them to sign a message
 */
export const getSignature = async ({ message }: { message: string }) => {
  try {
    if (typeof window === 'undefined') {
      throw new Error('Window is not defined');
    }
    
    // First try LUKSO UP provider
    if (typeof window.lukso !== 'undefined') {
      console.log('Getting signature from LUKSO UP provider');
      
      // Get accounts from LUKSO UP
      const accounts = await window.lukso.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];
      
      if (!account) {
        throw new Error('No LUKSO UP account selected');
      }
      
      // Sign with LUKSO UP
      const signature = await window.lukso.request({
        method: 'personal_sign',
        params: [message, account]
      });
      
      return signature;
    } 
    // Fallback to MetaMask/standard provider
    else if (typeof window.ethereum !== 'undefined') {
      console.log('Getting signature from standard provider (MetaMask)');
      
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];
      
      if (!account) {
        throw new Error('No account selected');
      }
      
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, account]
      });
      
      return signature;
    } else {
      throw new Error('No web3 provider found. Please install LUKSO UP or MetaMask.');
    }
  } catch (error) {
    console.error('Error getting signature:', error);
    throw error;
  }
};

/**
 * Generates spending and viewing public and private keys from a signature
 */
export const generateKeysFromSignature = (signature: string) => {
  // For demonstration purposes - normally this would use cryptographic functions
  // from a library like noble/secp256k1
  const sigBytes = signature.slice(2); // Remove 0x prefix
  const portion1 = sigBytes.slice(0, 64);
  const portion2 = sigBytes.slice(64, 128);
  
  // Here we'd normally hash these portions and derive proper keys
  return {
    spendingPublicKey: `0x04${portion1}`,
    spendingPrivateKey: `0x${portion1}`,
    viewingPublicKey: `0x04${portion2}`,
    viewingPrivateKey: `0x${portion2}`
  };
};

/**
 * Generates a stealth meta-address from a signature
 */
export const generateStealthMetaAddressFromSignature = (signature: string) => {
  const keys = generateKeysFromSignature(signature);
  // In a real implementation, we would create a proper stealth meta-address
  return `st:lyx:${keys.spendingPublicKey}${keys.viewingPublicKey.slice(2)}`;
};

/**
 * Generates a stealth address from a meta-address
 */
export const generateStealthAddress = ({ 
  stealthMetaAddressURI, 
  schemeId 
}: { 
  stealthMetaAddressURI: string, 
  schemeId: number 
}) => {
  // In a real implementation, this would use proper cryptographic operations
  // to generate the stealth address from the meta-address
  
  // This is just a mock implementation for demonstration purposes
  const randomHex = () => Math.floor(Math.random() * 16).toString(16);
  const generateRandomAddress = () => {
    let addr = '0x';
    for (let i = 0; i < 40; i++) {
      addr += randomHex();
    }
    return addr;
  };
  
  const ephemeralPublicKey = `0x${Array(64).fill(0).map(() => randomHex()).join('')}`;
  const stealthAddress = generateRandomAddress();
  const viewTag = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  
  return {
    stealthAddress,
    ephemeralPublicKey,
    viewTag
  };
};

/**
 * Computes a stealth key from inputs
 */
export const computeStealthKey = ({ 
  schemeId, 
  ephemeralPublicKey, 
  spendingPrivateKey, 
  viewingPrivateKey 
}: { 
  schemeId: number, 
  ephemeralPublicKey: string, 
  spendingPrivateKey: string, 
  viewingPrivateKey: string 
}) => {
  // In a real implementation, this would perform proper cryptographic operations
  // This is just a demonstration for the UI

  // Generate a valid private key format (64 hex chars with 0x prefix)
  // Generate mostly deterministic output based on input keys while ensuring it's a valid format
  const base = spendingPrivateKey.slice(2, 34) + viewingPrivateKey.slice(2, 34);
  
  // Ensure we have 64 characters (32 bytes) as required for a private key
  let fullKey = base;
  while (fullKey.length < 64) {
    fullKey += ephemeralPublicKey.slice(2, 2 + (64 - fullKey.length));
  }
  
  // Trim to exactly 64 hex characters and add 0x prefix
  const trimmedKey = fullKey.slice(0, 64);
  
  // Return properly formatted key
  return `0x${trimmedKey}`;
};

// Export VALID_SCHEME_ID for compatibility
export const VALID_SCHEME_ID = {
  SCHEME_ID_1: 1
}; 