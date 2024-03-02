import { ethers } from "ethers";
import { config } from "../../config";
import {
  CACHE_KEYS,
  CHAIN_ID,
  CONTRACT_INSTANCES,
  SUPPORTED_CHAINS,
} from "../../constants";
import {
  IAvocadoWalletMetadata,
  ISignature,
  ISimulateTxnResult,
  ITransactionPayload,
} from "../../interfaces";
import { RedisClient } from "../../redis";

export class AvocadoWallet {
  readonly address: string;
  readonly chainId: CHAIN_ID;
  private readonly avoForwarder: ethers.Contract;
  private readonly avoWallet: ethers.Contract;

  constructor(chainId: CHAIN_ID, address: string) {
    this.address = address;
    this.chainId = chainId;
    this.avoForwarder = CONTRACT_INSTANCES.AVOCADO_FORWARDER(chainId);
    this.avoWallet = CONTRACT_INSTANCES.AVOCADO_WALLET(chainId, address);
  }

  // Function that returns wallet data packed in a single object
  public async getWalletMetadata(
    useCache = true
  ): Promise<IAvocadoWalletMetadata> {
    console.time(`Avocado wallet Metadata : ${this.chainId}`);
    const [requiredSigners, nonce] = await Promise.all([
      this.getRequiredSigners(useCache),
      this.getNonce(useCache),
    ]);
    console.timeEnd(`Avocado wallet Metadata : ${this.chainId}`);

    return {
      requiredSigners: requiredSigners || 1,
      nextNonce: nonce || "0",
    };
  }

  // Will return undefined if wallet is not deployed
  public async getRequiredSigners(
    useCache = true,
    undefinedIfFails = true
  ): Promise<number> {
    try {
      if (useCache) {
        const val = await RedisClient.getDataFromCache(
          CACHE_KEYS.REQUIRED_SIGNERS(this.chainId, this.address)
        );
        if (+val) return +val;
      }

      const signers = await this.avoWallet.requiredSigners();
      RedisClient.saveDataToCache(
        CACHE_KEYS.REQUIRED_SIGNERS(this.chainId, this.address),
        String(signers),
        config.AVOCADO_REQUIRED_SIGNERS_CACHE_EXPIRY
      );
      return +signers;
    } catch (e: any) {
      // Save required signers as 1
      RedisClient.saveDataToCache(
        CACHE_KEYS.REQUIRED_SIGNERS(this.chainId, this.address),
        String(1),
        config.AVOCADO_REQUIRED_SIGNERS_CACHE_EXPIRY
      );

      if (undefinedIfFails) return;
      else throw new Error(e);
    }
  }

  public async isWalletDeployed(): Promise<boolean> {
    const provider = SUPPORTED_CHAINS[this.chainId].rpc;
    const isDeployed = (await provider.getCode(this.address)) !== "0x";
    return isDeployed;
  }

  public async getNonce(
    useCache = true,
    undefinedIfFails = true
  ): Promise<string> {
    try {
      if (useCache) {
        const val = await RedisClient.getDataFromCache(
          CACHE_KEYS.AVOCADO_WALLET_NONCE(this.chainId, this.address)
        );
        if (val) return val;
      }

      const nonce = await this.avoWallet.avoNonce();
      RedisClient.saveDataToCache(
        CACHE_KEYS.AVOCADO_WALLET_NONCE(this.chainId, this.address),
        String(nonce),
        config.AVOCADO_NONCE_CACHE_EXPIRY
      );
      return String(nonce);
    } catch (e: any) {
      // Add zero to cache
      RedisClient.saveDataToCache(
        CACHE_KEYS.AVOCADO_WALLET_NONCE(this.chainId, this.address),
        String(0),
        config.AVOCADO_NONCE_CACHE_EXPIRY
      );

      if (undefinedIfFails) return;
      else throw new Error(e);
    }
  }

  public async simulateTransaction(
    eoaAddress: string,
    walletIndex: string,
    signatures: ISignature[],
    payload: ITransactionPayload
  ): Promise<ISimulateTxnResult> {
    console.time(`Txn simulation : ${this.chainId}`);
    const result: ISimulateTxnResult =
      await this.avoForwarder.callStatic.simulateV1(
        eoaAddress,
        walletIndex,
        payload.params,
        payload.forwardParams,
        signatures,
        {
          from: "0x000000000000000000000000000000000000dead",
        }
      );
    console.timeEnd(`Txn simulation : ${this.chainId}`);
    if (!result.success_) {
      throw new Error(
        result.revertReason_ || "Txn Failed due to unknown reasons!"
      );
    }
    return result;
  }

  public async getTransactionRequest(
    eoaAddress: string,
    walletIndex: string,
    signatures: ISignature[],
    payload: ITransactionPayload
  ): Promise<ethers.providers.TransactionRequest> {
    console.time(`Get transaction request : ${this.chainId}`);
    const res = await this.avoForwarder.populateTransaction.executeV1(
      eoaAddress,
      walletIndex,
      payload.params,
      payload.forwardParams,
      signatures,
      { gasPrice: "0", gasLimit: "0" }
    );

    const wallet = ethers.Wallet.createRandom().connect(
      this.avoForwarder.provider
    );
    const populateTransaction = await wallet.populateTransaction(res);
    console.timeEnd(`Get transaction request : ${this.chainId}`);
    return populateTransaction;
  }

  public static async computeAvocadoAddress(
    eoaAddress: string,
    index: string,
    useCache = true
  ): Promise<string> {
    // Initialize the forwarder on polygon to calculate

    if (useCache) {
      const val = await RedisClient.getDataFromCache(
        CACHE_KEYS.AVOCADO_ADDRESS(eoaAddress, index)
      );
      if (val) return val;
    }

    const avoForwarder = CONTRACT_INSTANCES.AVOCADO_FORWARDER(CHAIN_ID.POLYGON);
    const res = await avoForwarder.computeAvocado(eoaAddress, index);
    RedisClient.saveDataToCache(
      CACHE_KEYS.AVOCADO_ADDRESS(eoaAddress, index),
      res,
      config.AVOCADO_ADDRESS_CACHE_EXPIRY
    );

    return res;
  }
}
