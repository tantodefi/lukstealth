/**
 * Gets a signature from the user by asking them to sign a message
 */
export const getSignature = async ({ message }: { message: string }) => {
  try {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No Ethereum provider found');
    }
    
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
  // This is just a demonstration
  return `0x${spendingPrivateKey.slice(2, 10)}${viewingPrivateKey.slice(2, 10)}${ephemeralPublicKey.slice(2, 10)}`;
};

// Export VALID_SCHEME_ID for compatibility
export const VALID_SCHEME_ID = {
  SCHEME_ID_1: 1
}; 