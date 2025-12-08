# Arbiter Suite Frontend

A modern React application for participating in prediction market dispute resolution on Sonic Mainnet. Built with React 19, TypeScript, Vite, and Three.js for immersive visual effects.

![Arbiter Suite](https://img.shields.io/badge/Sonic-Mainnet-blue)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Vite](https://img.shields.io/badge/Vite-7.x-purple)

## Features

- 🗳️ **Vote on Disputes** - Participate in prediction market dispute resolution
- 🎨 **Modern UI** - Dark theme with glass-morphism effects
- 🖼️ **NFT Management** - Wrap/unwrap staked ANON NFTs for voting power
- 🎬 **ASCII Visual Effects** - Stunning 3D ASCII art using Three.js
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🔗 **Web3 Integration** - Connect wallet and interact with smart contracts

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 7
- **Styling:** CSS with custom properties
- **3D Effects:** Three.js + React Three Fiber + Postprocessing
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Testing:** Vitest + Testing Library

## Getting Started

### Prerequisites

- Node.js 20.19.0+ or 22.12.0+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/Anon-Arbiter-Suite.git
cd Anon-Arbiter-Suite

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
npm run test       # Run tests in watch mode
npm run test:run   # Run tests once
npm run test:coverage  # Run tests with coverage
```

## Project Structure

```
src/
├── components/          # React components
│   ├── __tests__/       # Component tests
│   ├── AsciiEffect.tsx  # ASCII shader effect
│   ├── AsciiLoader.tsx  # Loading screen with ASCII 3D logo
│   ├── AsciiScene.tsx   # Three.js scene setup
│   ├── DisputeCard.tsx  # Individual dispute display
│   ├── EmptyStateAscii.tsx  # Empty state with icon
│   ├── LoginPage.tsx    # Login/connect wallet page
│   ├── NFTManager.tsx   # NFT wrap/unwrap management
│   ├── OrbitCarousel.tsx    # Animated carousel
│   └── index.ts         # Barrel exports
├── config/              # Configuration
│   ├── __tests__/       # Config tests
│   ├── contracts.ts     # Contract addresses & ABIs
│   └── index.ts         # Barrel exports
├── hooks/               # Custom React hooks
│   ├── __tests__/       # Hook tests
│   ├── useDisputes.ts   # Fetch disputes from indexer/contract
│   ├── useUserNFTs.ts   # Fetch user's NFTs
│   └── index.ts         # Barrel exports
├── test/                # Test utilities
│   └── setup.ts         # Test setup file
├── App.tsx              # Main application component
├── App.css              # Global styles
└── main.tsx             # Application entry point
```

## Smart Contracts

The frontend interacts with the following contracts on Sonic Mainnet (Chain ID: 146):

| Contract | Address |
|----------|---------|
| DisputeResolverHome | `0x8008AaF57ca73475209634b7528e8b5B886Ecf67` |
| AnonStaking | `0xCd7B94Ae42Fbf02E2Abd08db948289d6aB990Ffd` |
| Vault | `0xF06fEeb7070d85cE09f935d7202bd7EC5C1887a4` |

## How It Works

### Dispute Resolution Flow

1. **Connect Wallet** - Users connect their Ethereum wallet
2. **Wrap NFTs** - Stake ANON NFTs to gain voting power
3. **Vote on Disputes** - Vote Yes/No/Unknown on disputed market outcomes
4. **Claim Rewards** - Claim rewards for correct votes

### NFT Management

- **Wrapped NFTs** - NFTs deposited in DisputeResolver (can vote)
- **Unwrapped NFTs** - NFTs in AnonStaking (need to wrap to vote)
- **Voting Power** - Each NFT has power based on staked amount

## Testing

The project uses Vitest for testing with React Testing Library:

```bash
# Run all tests
npm run test:run

# Run tests in watch mode
npm run test

# Generate coverage report
npm run test:coverage
```

Test files are located in `__tests__` directories alongside their components.

## Configuration

### Environment Variables

Create a `.env` file in the root:

```env
# Optional: Custom RPC URL
VITE_RPC_URL=https://rpc.soniclabs.com

# Optional: Custom indexer URL
VITE_INDEXER_URL=https://sonicmarketindexer-production.up.railway.app
```

### Styling Customization

CSS variables are defined in `App.css`:

```css
:root {
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --text-primary: #f0f0f5;
  --accent-primary: #6366f1;
  /* ... more variables */
}
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is part of the Anon ecosystem. See LICENSE for details.

## Links

- [Staking Portal](https://staking.heyanon.ai)
- [Sonic Mainnet](https://sonicscan.org)
- [Heyanon.ai](https://heyanon.ai)

---

**Powered by [Heyanon.ai](https://heyanon.ai)**
