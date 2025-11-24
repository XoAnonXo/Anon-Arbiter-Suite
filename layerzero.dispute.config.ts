import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities'
import { TwoWayConfig, generateConnectionsConfig } from '@layerzerolabs/metadata-tools'
import { OAppEnforcedOption, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

// Sonic Mainnet (Home Chain)
const sonicHomeContract: OmniPointHardhat = {
    eid: 30332, // Sonic Mainnet
    contractName: 'DisputeResolverHome',
}

// Base Mainnet (Remote Chain)
const baseRemoteContract: OmniPointHardhat = {
    eid: 30184, // Base Mainnet
    contractName: 'DisputeResolverRemote',
}

// Enforced options for message types
const EVM_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1, // VOTE_REQUEST
        optionType: ExecutorOptionType.LZ_RECEIVE,
        gas: 200000, // Gas for processing vote on remote chain
        value: 0,
    },
    {
        msgType: 2, // CLAIM_REWARDS_REQUEST
        optionType: ExecutorOptionType.LZ_RECEIVE,
        gas: 250000, // Gas for processing claim + token transfer
        value: 0,
    },
]

// Pathways: Sonic (Home) <-> Base (Remote)
const pathways: TwoWayConfig[] = [
    [
        sonicHomeContract,        // Sonic (Home)
        baseRemoteContract,       // Base (Remote)
        [['LayerZero Labs', 'Nethermind'], []], // [ requiredDVN[], [ optionalDVN[], threshold ] ]
        [3, 3],                   // [Sonic to Base confirmations, Base to Sonic confirmations]
        [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS], // Base enforcedOptions, Sonic enforcedOptions
    ],
]

export default async function () {
    // Generate the connections config based on the pathways
    const connections = await generateConnectionsConfig(pathways)
    return {
        contracts: [
            { contract: sonicHomeContract },
            { contract: baseRemoteContract },
        ],
        connections,
    }
}

