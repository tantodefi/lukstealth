// Registry contract data for stealth address system
export const LUKSO_MAINNET_ERC5564_REGISTRY = "0x4E581D6a88bc7D60D092673904d961B6b0961A40";
export const LUKSO_MAINNET_ERC5564_ANNOUNCER = "0x5Fc97Acd946fFCcB94be78AB53e6a29f2f2D7Dbf";

// Registry ABI
export const registryABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "registrant",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "stealthMetaAddress",
        "type": "string"
      }
    ],
    "name": "StealthMetaAddressSet",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "registrant",
        "type": "address"
      }
    ],
    "name": "getStealthMetaAddress",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "stealthMetaAddress",
        "type": "string"
      }
    ],
    "name": "setStealthMetaAddress",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "registrant",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "stealthMetaAddress",
        "type": "string"
      },
      {
        "internalType": "bytes",
        "name": "signature",
        "type": "bytes"
      }
    ],
    "name": "setStealthMetaAddressFor",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]; 

// Announcer ABI
export const announcerABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "schemeId",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "caller",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "announcement",
        "type": "bytes"
      }
    ],
    "name": "Announcement",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "schemeId",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "announcement",
        "type": "bytes"
      }
    ],
    "name": "announce",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]; 