import { ethers } from "ethers";
import {
  CHAIN_ID,
  GAS_PRICE_MULTIPLIER,
  MOCK_SIGNATURE,
  SUPPORTED_CHAINS,
} from "../../constants";
import {
  calculateL1GasFee,
  computeGasMultiplier,
  getArbitrumL1Fees,
  getNativeTokenPrice,
  prepareTxnPayloadWithActions,
  toBN,
} from "../../helpers";
import {
  IAvocadoWalletMetadata,
  IProcessedFeeEstimate,
  IProviderEstimatedFeeData,
  ITransactionAction,
  ITransactionPayload,
} from "../../interfaces";
import { AvocadoWallet } from "./Avocado";

// A wrapper to estimate fee on a given chain
export class FeeEstimator {
  readonly chainId: CHAIN_ID;
  readonly avocadoAddress: string;
  readonly eoaAddress: string;
  private readonly avocadoWalletIndex: string;
  private readonly avocadoWallet: AvocadoWallet;
  private readonly cacheMode: boolean;

  constructor(
    chainId: CHAIN_ID,
    avocadoAddress: string,
    eoaAddress: string,
    avocadoWalletIndex: string,
    cacheMode = true
  ) {
    this.chainId = chainId;
    this.avocadoAddress = avocadoAddress;
    this.avocadoWallet = new AvocadoWallet(chainId, avocadoAddress);
    this.eoaAddress = eoaAddress;
    this.avocadoWalletIndex = avocadoWalletIndex;
    this.cacheMode = cacheMode;
  }

  public async getFeeEstimates(
    actions: ITransactionAction[],
    undefinedIfFails = true
  ): Promise<IProcessedFeeEstimate> {
    try {
      let gasFee = "0";
      const gasPriceMultiplier = GAS_PRICE_MULTIPLIER[this.chainId];
      const walletMetadata = await this.avocadoWallet.getWalletMetadata(
        this.cacheMode
      );
      const payload = prepareTxnPayloadWithActions(
        actions,
        walletMetadata.nextNonce
      );
      const [feeData, gasLimit, nativeTokenPrice, l1GasFee] = await Promise.all(
        [
          this.getLiveFeeData(),
          this.calculateGasLimit(payload, walletMetadata),
          getNativeTokenPrice(this.chainId),
          calculateL1GasFee(
            this.eoaAddress,
            +this.avocadoWalletIndex,
            [this.eoaAddress],
            this.chainId,
            payload
          ),
        ]
      );

      const totalGasPriceMultiplier = feeData.maxFeePerGas
        ? toBN(feeData.maxFeePerGas)
            .div(
              toBN(feeData.lastBaseFeePerGas).plus(
                toBN(feeData.maxPriorityFeePerGas)
              )
            )
            .times(1.1)
            .times(100)
        : gasPriceMultiplier;

      const baseGasPrice = toBN(
        feeData.maxFeePerGas ? feeData.maxFeePerGas : feeData.gasPrice
      )
        .div(totalGasPriceMultiplier)
        .times(100);

      const gasLimitMultiplier = toBN(
        Math.round(computeGasMultiplier(this.chainId, 1) * 100)
      );

      const multiplier = gasLimitMultiplier.times(totalGasPriceMultiplier);
      const baseMultiplier = toBN(multiplier).dividedBy(8000).times(1e4);

      gasFee = toBN(l1GasFee).toFixed();
      gasFee = toBN(gasLimit).times(toBN(baseGasPrice)).plus(gasFee).toString();

      let feeAmount = Math.max(
        1e14,
        toBN(gasFee)
          .times(nativeTokenPrice)
          .times(multiplier)
          .dividedBy(1e4)
          .times(1.2)
          .decimalPlaces(0)
          .toNumber()
      );

      return {
        fee: String(feeAmount),
        multiplier: baseMultiplier.toFixed(0),
        chainId: this.chainId,
        chainName: SUPPORTED_CHAINS[this.chainId].name,
      };
    } catch (e: any) {
      if (undefinedIfFails) return;
      else throw new Error(e);
    }
  }

  private async calculateGasLimit(
    payload: ITransactionPayload,
    walletMetadata: IAvocadoWalletMetadata
  ) {
    const signatures = Array(walletMetadata.requiredSigners).fill(
      MOCK_SIGNATURE
    );

    const [gasEstimationsViaSimulateV1, populatedTransactionData] =
      await Promise.all([
        this.avocadoWallet.simulateTransaction(
          this.eoaAddress,
          this.avocadoWalletIndex,
          signatures,
          payload
        ),
        this.avocadoWallet.getTransactionRequest(
          this.eoaAddress,
          this.avocadoWalletIndex,
          signatures,
          payload
        ),
      ]);

    const deploymentGasUsed = gasEstimationsViaSimulateV1.deploymentGasUsed_;
    const castGasUsed = gasEstimationsViaSimulateV1.castGasUsed_;
    const sigVerificationGasUsed = this.getSignatureVerificationGas(
      walletMetadata.requiredSigners,
      walletMetadata.nextNonce
    );
    const eventEmissionGasUsed = this.getEventEmissionGas(
      payload,
      walletMetadata.requiredSigners
    );
    const safeBufferGas = this.getSafeBufferGas(walletMetadata.requiredSigners);
    const callDataGasUsed = this.getCallDataGas(populatedTransactionData);
    const intrinsticGasLimit = ethers.BigNumber.from(21_000);
    let gasEstimateForL1 = ethers.BigNumber.from("0");

    if (this.chainId === CHAIN_ID.ARBITRUM) {
      gasEstimateForL1 = await getArbitrumL1Fees(
        populatedTransactionData.to,
        populatedTransactionData.data
      );
    }

    let gasLimit = toBN(sigVerificationGasUsed)
      .plus(toBN(intrinsticGasLimit))
      .plus(eventEmissionGasUsed)
      .plus(safeBufferGas)
      .plus(callDataGasUsed)
      .plus(toBN(deploymentGasUsed))
      .plus(toBN(castGasUsed))
      .plus(toBN(gasEstimateForL1));

    const isFlashloanBased = toBN(payload.params.id).eq("21");

    gasLimit = toBN(
      isFlashloanBased ? gasLimit.multipliedBy(1.175).toFixed(0) : gasLimit
    );

    if (gasLimit.gte(3_000_000) && this.chainId !== CHAIN_ID.ARBITRUM) {
      gasLimit = toBN(
        gasLimit.plus(gasLimit.dividedBy(64).times(2)).toFixed(0)
      );
    }

    return gasLimit;
  }

  private async getLiveFeeData(): Promise<IProviderEstimatedFeeData> {
    console.time(`Fee data ${this.chainId}`);
    const res = await SUPPORTED_CHAINS[this.chainId].rpc.getFeeData();
    console.timeEnd(`Fee data ${this.chainId}`);
    return this.processFeeData(res);
  }

  private processFeeData(feeData: IProviderEstimatedFeeData) {
    const gasPriceMultiplier = GAS_PRICE_MULTIPLIER[this.chainId];
    let gasPrice: ethers.BigNumber | null = null;
    let maxFeePerGas: ethers.BigNumber | null = null;
    let maxPriorityFeePerGas: ethers.BigNumber | null = null;
    let lastBaseFeePerGas: ethers.BigNumber | null = null;

    if (this.chainId === CHAIN_ID.ETHEREUM) {
      // increase priority fees by 10%
      maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
        .mul(gasPriceMultiplier)
        .div(100);

      lastBaseFeePerGas = feeData.lastBaseFeePerGas;
      // Set max fee to max priority fees + base fee (increased by 30%)
      maxFeePerGas = feeData.lastBaseFeePerGas
        .mul(130)
        .div(100)
        .add(maxPriorityFeePerGas); // Increase last base fee by 30%
    } else {
      // If not ethereum gas price is increased by 10%
      gasPrice = feeData.gasPrice.mul(gasPriceMultiplier).div(100);
    }

    return { gasPrice, maxFeePerGas, maxPriorityFeePerGas, lastBaseFeePerGas };
  }

  private getSignatureVerificationGas(signers: number, nonce: string): number {
    const isNonSequentialNonce = nonce === "-1";
    const signatureVerificationGasLimit =
      16500 + // base gas
      signers * 15000 + // verification for each signer
      (!isNonSequentialNonce ? 5000 : 30_000 + 2_500); // nonce based gas
    return signatureVerificationGasLimit;
  }

  private getEventEmissionGas(
    payload: ITransactionPayload,
    signers: number
  ): number {
    const result =
      15_000 + signers * 400 + (payload.params.metadata.length / 2) * 8;
    return result;
  }

  private getSafeBufferGas(signers: number): number {
    const result =
      this.chainId === CHAIN_ID.ARBITRUM ? 100_000 : 12_500 + 5_000 * signers;
    return result;
  }

  private getCallDataGas(
    txnRequest: ethers.providers.TransactionRequest
  ): number {
    let result = 0;
    const rlpEncodedData = ethers.utils.RLP.encode([
      txnRequest.data,
      txnRequest.from,
      txnRequest.to,
    ]);

    for (let i = 2; i < rlpEncodedData.length; i += 2) {
      if (rlpEncodedData[i] === "0" && rlpEncodedData[i + 1] === "0") {
        result += 4;
      } else {
        result += 16;
      }
    }

    result += 100 * 16;
    return result;
  }
}
