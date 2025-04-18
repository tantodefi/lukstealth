# All Stealth Address SDK Examples

This is a comprehensive example that integrates all the functionality of the Stealth Address SDK into a single interactive application.

## Features

This example includes:

1. **Wallet Connection** - Connect to a Web3 wallet like MetaMask
2. **Generate Stealth Keys** - Generate spending and viewing keys from a signature
3. **Stealth Meta-Address Management**
   - Generate stealth meta-address
   - Register keys in the ERC6538Registry contract
   - Retrieve stealth meta-address from the registry
4. **Stealth Address Operations**
   - Generate stealth addresses
   - Verify if a stealth address is intended for a specific user
   - Send funds to stealth addresses
   - Announce stealth transactions
5. **Announcements**
   - Fetch stealth address announcements
   - Filter announcements for a specific user
6. **Stealth Transfers**
   - Compute stealth private keys
   - Transfer funds from stealth addresses

## Setup

1. Create a `.env` file with your RPC URL (see `.env.example`)
```
VITE_RPC_URL=https://your-ethereum-rpc-url
```

2. Install dependencies:
```bash
bun install
# or
npm install
```

3. Run the development server:
```bash
bun run dev
# or
npm run dev
```

4. Open http://localhost:5173 in your browser

## Usage

1. Connect your wallet using the "Connect Wallet" button (requires MetaMask or other Web3 wallet)
2. Follow the numbered sections to experiment with different stealth address features
3. The app provides a step-by-step interface to explore all functionality of the Stealth Address SDK

## Notes

- The example uses the Sepolia testnet by default (Chain ID: 11155111)
- Transactions require Sepolia ETH for gas fees
- You can toggle between the original example and the integrated example using the button at the top

## Resources

- [ERC-5564: Stealth Address Standard](https://eips.ethereum.org/EIPS/eip-5564)
- [ERC-6538: Stealth Meta-Address Registry](https://eips.ethereum.org/EIPS/eip-6538)
- [Stealth Address Documentation](https://stealthaddress.dev/)
- [GitHub Repository](https://github.com/ScopeLift/stealth-address-sdk)
