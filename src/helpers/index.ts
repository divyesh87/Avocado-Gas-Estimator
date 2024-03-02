import axios from "axios";
import { BigNumber } from "bignumber.js";
import { BigNumber as BN, ethers } from "ethers";
import arbNodeInterface from "../abi/arbNodeInterface.json";
import erc20Abi from "../abi/erc20.json";
import optimismPriceOrableAbi from "../abi/optimismPriceOracle.json";
import {
  CHAIN_ID,
  CONTRACT_INSTANCES,
  L1_GAS_FEE_BASED_CHAINS,
  SUPPORTED_CHAINS,
  SUPPORTED_TOKENS,
  TOKEN_NAMES,
} from "../constants";
import { ITransactionAction, ITransactionPayload } from "../interfaces";

export const toBN = (value: BigNumber.Value | BN) =>
  new BigNumber(BN.isBigNumber(value) ? value.toString() : value);

export const getTransferAction = (
  chainId: CHAIN_ID,
  toAddress: string,
  tokenName: TOKEN_NAMES
): ITransactionAction => {
  const token = SUPPORTED_TOKENS[chainId][tokenName];
  if (!token) return null;

  const transferInterface = new ethers.utils.Interface([
    "function transfer(address to, uint amount) returns (bool)",
  ]);

  const data = transferInterface.encodeFunctionData("transfer", [
    toAddress,
    "1",
  ]);

  return {
    data,
    target: token.contractAddress,
    value: "0",
    operation: "0",
  };
};

export const getCustomExecutionAction = (): ITransactionAction => {
  return {
    data: "0x0001",
    target: "0x9800020b610194dBa52CF606E8Aa142F9F256166",
    operation: "0",
    value: "0",
  };
};

export const prepareTxnPayloadWithActions = (
  actions: ITransactionAction[],
  nonce: string
): ITransactionPayload => {
  return {
    params: {
      actions,
      id: "0",
      avoNonce: nonce,
      salt: ethers.utils.defaultAbiCoder.encode(["uint256"], [Date.now()]),
      source: "0x000000000000000000000000000000000000Cad0",
      metadata: "0x",
    },

    forwardParams: {
      gas: "0",
      gasPrice: "0",
      validAfter: "0",
      validUntil: "0",
      value: "0",
    },
  };
};

export const getNativeTokenPrice = async (
  chainId: CHAIN_ID
): Promise<number> => {
  const response = (
    await axios(
      `https://prices.instadapp.io/${chainId}/tokens?addresses=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`
    )
  ).data;

  return +response[0]?.price || null;
};

export const calculateL1GasFee = async (
  owner: string,
  index: number,
  signers: string[],
  targetChainId: CHAIN_ID,
  message: ITransactionPayload
) => {
  if (!L1_GAS_FEE_BASED_CHAINS.includes(targetChainId)) return "0";

  let provider = SUPPORTED_CHAINS[targetChainId].rpc;
  const optimismGasPriceOracle = new ethers.Contract(
    String(targetChainId) == "534352"
      ? "0x5300000000000000000000000000000000000002"
      : "0x420000000000000000000000000000000000000F",
    optimismPriceOrableAbi,
    provider
  );

  const populatedTransaction = await CONTRACT_INSTANCES.AVOCADO_FORWARDER(
    targetChainId
  ).populateTransaction.executeV1(
    owner,
    index,
    message.params,
    message.forwardParams,
    signers.map((s) => ({
      signature: "0x",
      signer: s,
    })),
    { gasPrice: "0", gasLimit: "0" }
  );
  const populatedTransactionData = await ethers.Wallet.createRandom()
    .connect(provider)
    .populateTransaction(populatedTransaction);

  const rlpEncodedData = ethers.utils.RLP.encode([
    populatedTransactionData.data,
    populatedTransactionData.from,
    populatedTransactionData.to,
  ]);
  const [l1BaseFee, l1Scalar, l1GasUsed] = await Promise.all([
    optimismGasPriceOracle.l1BaseFee(),
    optimismGasPriceOracle.scalar(),
    optimismGasPriceOracle.getL1GasUsed(rlpEncodedData),
  ]);

  const signatureSize = 65 * 16;
  const extraParamsSize = 32 * 16;

  const l1GasLimit = toBN(signatureSize)
    .plus(extraParamsSize)
    .plus(toBN(l1GasUsed));
  // L1 gasFee
  return toBN(l1GasLimit)
    .times(toBN(l1Scalar))
    .times(toBN(l1BaseFee))
    .dividedBy(String(targetChainId) == "534352" ? 1e9 : 1e6)
    .toString();
};

export const getArbitrumL1Fees = async (
  to: string,
  data: ethers.utils.BytesLike
): Promise<BN> => {
  const arbNode = new ethers.Contract(
    "0x00000000000000000000000000000000000000C8",
    arbNodeInterface,
    SUPPORTED_CHAINS[CHAIN_ID.ARBITRUM].rpc
  );
  const estimationL1Data = await arbNode.callStatic.gasEstimateL1Component(
    to,
    false,
    data
  );

  return estimationL1Data.gasEstimateForL1;
};

export const computeGasMultiplier = (
  targetChainId: CHAIN_ID,
  version: 1 | 2 | 3 = 2,
  isMultisig: boolean = false
) => {
  if (String(targetChainId) === "1") {
    return 1.1; // 10% increase
  }

  if (String(targetChainId) === "42161") {
    if (isMultisig) {
      // Multisig v3 => 15% increase or default 50% increase
      return version === 1 ? 1.15 : 1.5;
    } else {
      return version === 1 ? 3 : 1.5; // 3x or 50% increase
    }
  }

  if (["10", "8453", "204"].includes(String(targetChainId))) {
    return 1.15; // 15% increase
  }

  return 1.05; // 5% increase
};

export const getBalanceForToken = async (
  chainId: CHAIN_ID,
  token: TOKEN_NAMES,
  address: string,
  undefinedIfFails = true
): Promise<number> => {
  try {
    const provider = SUPPORTED_CHAINS[chainId].rpc;
    const contract = new ethers.Contract(
      SUPPORTED_TOKENS[chainId][token].contractAddress,
      erc20Abi,
      provider
    );
    const response = await contract.balanceOf(address);
    const balance = +ethers.utils.formatUnits(
      response,
      SUPPORTED_TOKENS[chainId][token].decimals
    );
    return balance || null;
  } catch (e: any) {
    console.log(e);
    if (undefinedIfFails) return;
    else throw new Error(e);
  }
};

export const createCombinations = (
  chainIds: CHAIN_ID[],
  data: any[],
  start: number,
  end: number,
  index: number,
  combinationSize: number,
  result: CHAIN_ID[][] = []
) => {
  if (index == combinationSize) {
    let generatedCombination = [];
    for (let j = 0; j < combinationSize; j++) {
      generatedCombination.push(data[j]);
    }

    result.push(generatedCombination.sort((a, b) => a - b));
  }
  for (let i = start; i <= end && end - i + 1 >= combinationSize - index; i++) {
    data[index] = chainIds[i];
    createCombinations(
      chainIds,
      data,
      i + 1,
      end,
      index + 1,
      combinationSize,
      result
    );
  }

  return result;
};
