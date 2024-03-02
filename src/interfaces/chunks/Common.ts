import { BigNumber, ethers, providers } from "ethers";
import { CHAIN_ID, TOKEN_NAMES } from "../../constants";

export type SupportedChains = { [key in CHAIN_ID]: SupportedChain };

export type SupportedChain = {
  name: string;
  rpc: providers.JsonRpcProvider;
};

export type SupportedTokens = Partial<{
  [key in CHAIN_ID]: Partial<{
    [key in TOKEN_NAMES]: SupportedToken;
  }>;
}>;

export type SupportedToken = {
  contractAddress: string;
  decimals: number;
};

export type IProcessedFeeEstimate = {
  fee: string;
  multiplier: string;
  chainId: CHAIN_ID;
  chainName?: string;
};

export type IProviderEstimatedFeeData = {
  gasPrice: BigNumber;
  maxFeePerGas: BigNumber;
  maxPriorityFeePerGas: BigNumber;
  lastBaseFeePerGas: BigNumber;
};

export type IAvocadoWalletMetadata = {
  isDeployed?: boolean;
  nextNonce: string;
  requiredSigners: number;
};

export type ISimulateTxnResult = {
  castGasUsed_: ethers.BigNumber;
  deploymentGasUsed_: ethers.BigNumber;
  isDeployed_: boolean;
  success_: boolean;
  revertReason_: string;
};

export type ISignature = {
  signature: string;
  signer: string;
};

export type IUserBalance = {
  balance: number;
  chainId: number;
};
