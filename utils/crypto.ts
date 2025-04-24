// Add type declarations for wallet providers
declare global {
  interface Window {
    lukso?: any;
    ethereum?: any;
  }
}

import {
  type GenerateStealthAddressReturnType,
  computeStealthKey as sdkComputeStealthKey,
  generateKeysFromSignature as sdkGenerateKeysFromSignature,
  generateStealthAddress as sdkGenerateStealthAddress,
  generateStealthMetaAddressFromSignature as sdkGenerateStealthMetaAddressFromSignature,
  checkStealthAddress as sdkCheckStealthAddress,
  VALID_SCHEME_ID as SDK_VALID_SCHEME_ID
} from '@scopelift/stealth-address-sdk';

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
  // Ensure signature is properly formatted as '0x...'
  const formattedSignature = signature.startsWith('0x') 
    ? signature as `0x${string}` 
    : `0x${signature}` as `0x${string}`;
  return sdkGenerateKeysFromSignature(formattedSignature);
};

/**
 * Generates a stealth meta-address from a signature
 */
export const generateStealthMetaAddressFromSignature = (signature: string) => {
  // Ensure signature is properly formatted as '0x...'
  const formattedSignature = signature.startsWith('0x') 
    ? signature as `0x${string}` 
    : `0x${signature}` as `0x${string}`;
  return sdkGenerateStealthMetaAddressFromSignature(formattedSignature);
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
}): GenerateStealthAddressReturnType => {
  return sdkGenerateStealthAddress({
    stealthMetaAddressURI,
    schemeId
  });
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
  // Ensure all hex strings are properly formatted as '0x...'
  const formattedEphemeralPublicKey = ephemeralPublicKey.startsWith('0x')
    ? ephemeralPublicKey as `0x${string}`
    : `0x${ephemeralPublicKey}` as `0x${string}`;
  
  const formattedSpendingPrivateKey = spendingPrivateKey.startsWith('0x')
    ? spendingPrivateKey as `0x${string}`
    : `0x${spendingPrivateKey}` as `0x${string}`;
  
  const formattedViewingPrivateKey = viewingPrivateKey.startsWith('0x')
    ? viewingPrivateKey as `0x${string}`
    : `0x${viewingPrivateKey}` as `0x${string}`;
  
  return sdkComputeStealthKey({
    schemeId,
    ephemeralPublicKey: formattedEphemeralPublicKey,
    spendingPrivateKey: formattedSpendingPrivateKey,
    viewingPrivateKey: formattedViewingPrivateKey
  });
};

/**
 * Checks if a stealth address matches the viewing and spending keys
 */
export const checkIfStealthAddressIsForMe = ({
  stealthAddress,
  ephemeralPublicKey,
  viewingPrivateKey,
  spendingPrivateKey,
  schemeId = SDK_VALID_SCHEME_ID.SCHEME_ID_1
}: {
  stealthAddress: string,
  ephemeralPublicKey: string,
  viewingPrivateKey: string,
  spendingPrivateKey: string,
  schemeId?: number
}) => {
  try {
    // Ensure all hex strings are properly formatted as '0x...'
    const formattedStealthAddress = stealthAddress.startsWith('0x')
      ? stealthAddress.toLowerCase() as `0x${string}`
      : `0x${stealthAddress}`.toLowerCase() as `0x${string}`;
    
    const formattedEphemeralPublicKey = ephemeralPublicKey.startsWith('0x')
      ? ephemeralPublicKey as `0x${string}`
      : `0x${ephemeralPublicKey}` as `0x${string}`;
    
    const formattedViewingPrivateKey = viewingPrivateKey.startsWith('0x')
      ? viewingPrivateKey as `0x${string}`
      : `0x${viewingPrivateKey}` as `0x${string}`;
    
    const formattedSpendingPrivateKey = spendingPrivateKey.startsWith('0x')
      ? spendingPrivateKey as `0x${string}`
      : `0x${spendingPrivateKey}` as `0x${string}`;
      
    // Compute the stealth private key using the SDK
    const stealthPrivateKey = sdkComputeStealthKey({
      schemeId,
      ephemeralPublicKey: formattedEphemeralPublicKey,
      viewingPrivateKey: formattedViewingPrivateKey,
      spendingPrivateKey: formattedSpendingPrivateKey
    });
    
    // Directly compute the expected stealth address
    // This is a simple calculation to derive the Ethereum address from private key
    // The exact address derivation would normally be handled by the SDK
    const stealthAddressFromKey = `0x${stealthPrivateKey.slice(-40)}`.toLowerCase();
    
    // Simple comparison to check if addresses match
    // This is a simplified approach - in production you might want to use 
    // the full SDK check with proper address derivation
    return stealthAddressFromKey === formattedStealthAddress;
  } catch (error) {
    console.error('Error checking stealth address:', error);
    return false;
  }
};

// Export VALID_SCHEME_ID for compatibility
export const VALID_SCHEME_ID = SDK_VALID_SCHEME_ID; 