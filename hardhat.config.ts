// Get the environment configuration from .env file
//
// To make use of automatic environment setup:
// - Duplicate .env.example file and name it .env
// - Fill in the environment variables
import 'dotenv/config'

import 'hardhat-deploy'
import 'hardhat-contract-sizer'
import '@nomiclabs/hardhat-ethers'
import '@typechain/hardhat'
import '@layerzerolabs/toolbox-hardhat'
import "solidity-coverage";
import { HardhatUserConfig, HttpNetworkAccountsUserConfig } from 'hardhat/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'


// Set your preferred authentication method
//
// If you prefer using a mnemonic, set a MNEMONIC environment variable
// to a valid mnemonic
const MNEMONIC = process.env.MNEMONIC

// If you prefer to be authenticated using a private key, set a PRIVATE_KEY environment variable
const PRIVATE_KEY = process.env.PRIVATE_KEY

const accounts: HttpNetworkAccountsUserConfig | undefined = MNEMONIC
    ? { mnemonic: MNEMONIC }
    : PRIVATE_KEY
        ? [PRIVATE_KEY]
        : undefined

if (accounts == null) {
    console.warn(
        'Could not find MNEMONIC or PRIVATE_KEY environment variables. It will not be possible to execute transactions in your example.'
    )
}

const config: HardhatUserConfig = {
    paths: {
        cache: 'cache/hardhat',
    },
    //@ts-ignore
    contractSizer: {
        alphaSort: true,
        runOnCompile: true,
        disambiguatePaths: false,
        only: ['DisputeResolverHome', 'DisputeResolverRemote'],
    },
    solidity: {
        compilers: [
            {
                version: '0.8.26',
                settings: {
                    viaIR: true,
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    networks: {
        hardhat: {
            chainId: 146,
            forking: {
                url: "https://rpc.soniclabs.com",
                blockNumber: 55777389,
            },
            allowUnlimitedContractSize: true,
            loggingEnabled: false,
        },
        base: {
            eid: 30184, // Base Mainnet Endpoint ID
            url: "https://mainnet.base.org",
            chainId: 8453,
            accounts: accounts || [],
            gas: 'auto',
            gasMultiplier: 1.1,
            // gasPrice: 5000000000,
        },
        sonic_mainnet: {
            eid: 30332, // Sonic Mainnet Endpoint ID
            url: "https://rpc.soniclabs.com",
            chainId: 146,
            accounts: accounts || []
        },
        'arbitrum-sepolia': {
            eid: EndpointId.ARBSEP_V2_TESTNET,
            url: process.env.RPC_URL_ARB_SEPOLIA || 'https://arbitrum-sepolia.gateway.tenderly.co',
            accounts,
        },
        'base-sepolia': {
            eid: EndpointId.BASESEP_V2_TESTNET,
            url: process.env.RPC_URL_BASE_SEPOLIA || 'https://base-sepolia.gateway.tenderly.co',
            accounts,
        },
    },
    namedAccounts: {
        deployer: {
            default: 0, // wallet address of index[0], of the mnemonic in .env
        },
    },
    typechain: {
        outDir: 'typechain-types',
        target: 'ethers-v5',
    },
    solcover: {
        skipFiles: [
            'mocks/',
            'libraries/Errors.sol',
        ],
    },
}

export default config
