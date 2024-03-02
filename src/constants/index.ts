import { ethers } from "ethers";
import avoForwarderAbi from "../abi/avoForwarder.json";
import avocadoWalletAbi from "../abi/avocado.json";
import { config } from "../config";
import { SupportedChains, SupportedTokens } from "../interfaces";

export enum CHAIN_ID {
  ETHEREUM = 1,
  POLYGON = 137,
  OPTIMISM = 10,
  AVALANCHE = 43114,
  ARBITRUM = 42161,
}

export const L1_GAS_FEE_BASED_CHAINS = [CHAIN_ID.OPTIMISM];

export enum TOKEN_NAMES {
  USDC = "USDC",
  USDT = "USDT",
}

export const MOCK_SIGNATURE = {
  signature:
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  signer: "0xffffffffffffffffffffffffffffffffffffffff",
};

export const CONTRACT_INSTANCES = {
  AVOCADO_WALLET: (chainId: CHAIN_ID, avocadoAddress: string) => {
    return new ethers.Contract(
      avocadoAddress,
      avocadoWalletAbi,
      SUPPORTED_CHAINS[chainId].rpc
    );
  },

  AVOCADO_FORWARDER: (chainId: CHAIN_ID) => {
    return new ethers.Contract(
      config.AVO_FORWARDER_ADDRESS,
      avoForwarderAbi,
      SUPPORTED_CHAINS[chainId].rpc
    );
  },
};

export const GAS_PRICE_MULTIPLIER: { [key in CHAIN_ID]: number } = {
  [CHAIN_ID.ETHEREUM]: 110, // 10% increased
  [CHAIN_ID.ARBITRUM]: 120,
  [CHAIN_ID.AVALANCHE]: 120,
  [CHAIN_ID.OPTIMISM]: 120,
  [CHAIN_ID.POLYGON]: 120,
};

export const SUPPORTED_CHAINS: SupportedChains = {
  [CHAIN_ID.ETHEREUM]: {
    name: "Ethereum Mainnet",
    rpc: new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/eth"),
  },

  [CHAIN_ID.POLYGON]: {
    name: "Polgon POS",
    rpc: new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/polygon"),
  },

  [CHAIN_ID.ARBITRUM]: {
    name: "Arbitrum",
    rpc: new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc"),
  },

  [CHAIN_ID.AVALANCHE]: {
    name: "Avalanche-C",
    rpc: new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/avalanche"),
  },

  [CHAIN_ID.OPTIMISM]: {
    name: "Optimism",
    rpc: new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/optimism"),
  },
};

// A mapping of chains and their supported tokens
export const SUPPORTED_TOKENS: SupportedTokens = {
  [CHAIN_ID.ETHEREUM]: {
    [TOKEN_NAMES.USDC]: {
      decimals: 6,
      contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },

    [TOKEN_NAMES.USDT]: {
      decimals: 6,
      contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    },
  },

  [CHAIN_ID.POLYGON]: {
    [TOKEN_NAMES.USDC]: {
      decimals: 6,
      contractAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    },

    [TOKEN_NAMES.USDT]: {
      decimals: 6,
      contractAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    },
  },

  [CHAIN_ID.AVALANCHE]: {
    [TOKEN_NAMES.USDC]: {
      decimals: 6,
      contractAddress: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    },

    [TOKEN_NAMES.USDT]: {
      decimals: 6,
      contractAddress: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    },
  },

  [CHAIN_ID.ARBITRUM]: {
    [TOKEN_NAMES.USDC]: {
      decimals: 6,
      contractAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    },

    [TOKEN_NAMES.USDT]: {
      decimals: 6,
      contractAddress: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    },
  },

  [CHAIN_ID.OPTIMISM]: {
    [TOKEN_NAMES.USDC]: {
      decimals: 6,
      contractAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    },

    [TOKEN_NAMES.USDT]: {
      decimals: 6,
      contractAddress: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    },
  },
};

export const CACHE_KEYS = {
  AVOCADO_ADDRESS: (address: string, index: string) =>
    `AVOCADO_ADDRESS:${address}:${index}`,

  REQUIRED_SIGNERS: (chainId: CHAIN_ID, avocadoWallet: string) =>
    `REQ_SIGNERS:${chainId}:${avocadoWallet}`,

  AVOCADO_WALLET_NONCE: (chainId: CHAIN_ID, avocadoWallet: string) =>
    `WALLET_NONCE:${chainId}:${avocadoWallet}`,
};
