// Registry contract data for stealth address system
export const LUKSO_MAINNET_ERC5564_REGISTRY = "0x4E581D6a88bc7D60D092673904d961B6b0961A40";
export const LUKSO_MAINNET_ERC5564_ANNOUNCER = "0x8653F395983827E05A6625eED4D045e696980D16";

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

// Announcer ABI from GitHub
export const announcerABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "schemeId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "stealthAddress",
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
        "name": "ephemeralPubKey",
        "type": "bytes"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "metadata",
        "type": "bytes"
      }
    ],
    "name": "Announcement",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "schemeId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "stealthAddress",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "ephemeralPubKey",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "metadata",
        "type": "bytes"
      }
    ],
    "name": "announce",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]; 