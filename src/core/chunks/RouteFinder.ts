import BigNumber from "bignumber.js";
import { CHAIN_ID, SUPPORTED_CHAINS, TOKEN_NAMES } from "../../constants";
import {
  createCombinations,
  getBalanceForToken,
  getCustomExecutionAction,
  getTransferAction,
  toBN,
} from "../../helpers";
import {
  IProcessedFeeEstimate,
  IProcessedSourcingEstimateRes,
  ISourcingRoutesReqParams,
  IUserBalance,
} from "../../interfaces";
import { CustomError } from "../../middlewares";
import { AvocadoWallet } from "./Avocado";
import { FeeEstimator } from "./FeeEstimator";

export class RouteFinder {
  private readonly reqParams: ISourcingRoutesReqParams;
  private readonly cacheMode: boolean;

  constructor(reqParams: ISourcingRoutesReqParams, cacheMode = true) {
    this.reqParams = reqParams;
    this.cacheMode = cacheMode;
  }

  public async findRoutes() {
    console.time("Avocado address");
    const avocadoAddress =
      this.reqParams.avocadoAddress ||
      (await AvocadoWallet.computeAvocadoAddress(
        this.reqParams.eoaAddress,
        this.reqParams.index || "0",
        this.cacheMode
      ));
    console.timeEnd("Avocado address");

    const [estimates, balances] = await Promise.all([
      this.getEstimatesForSupportedChains(avocadoAddress),
      this.getBalancesOnSupportedChains(avocadoAddress),
    ]);

    return RouteFinder.findOptimalSources(
      estimates,
      balances,
      this.reqParams.amount
    );
  }

  // Tries out every combination of available options to find the most optimal sources by fees
  public static findOptimalSources(
    estimates: IProcessedFeeEstimate[],
    balances: IUserBalance[],
    amountToBeSourced: number
  ): IProcessedSourcingEstimateRes {
    const netAmountAvailable = balances.reduce(
      (accumulator, curr) => curr.balance + accumulator,
      0
    );
    if (netAmountAvailable < amountToBeSourced) {
      throw new CustomError("You dont have enough balance to source");
    }

    const combinationFeeMap = new Map<string, BigNumber>();
    const chainIds = balances.map((balance) => balance.chainId);

    for (let i = 1; i <= balances.length; i++) {
      const combinations = createCombinations(
        chainIds,
        new Array(chainIds.length),
        0,
        chainIds.length - 1,
        0,
        i
      );

      for (const combination of combinations) {
        let sum = toBN("0");
        for (const chainId of combination) {
          const balance = balances.find((bal) => bal.chainId === chainId);
          if (!balance) continue;
          sum = sum.plus(toBN(balance.balance));
        }
        if (sum.gte(toBN(amountToBeSourced))) {
          let fees = toBN("0");
          for (const chainId of combination) {
            const estimate = estimates.find((fee) => fee.chainId === chainId);
            fees = fees.plus(toBN(estimate.fee));
          }
          combinationFeeMap.set(combination.toString(), fees);
        }
      }
    }

    const lowestFees = Array.from(combinationFeeMap.entries()).sort((a, b) =>
      a[1].minus(b[1]).toNumber()
    )[0];
    if (!lowestFees) throw new Error("Something went wrong!");
    const selectedChains = lowestFees[0].split(",").map(Number);

    const result: IProcessedSourcingEstimateRes = [];
    let amountSourced = toBN("0");

    for (const selectedChain of selectedChains) {
      const fee = estimates.find((est) => est.chainId === selectedChain);
      const bal = balances.find((bal) => bal.chainId === selectedChain);

      if (toBN(bal.balance).plus(amountSourced).gt(toBN(amountToBeSourced))) {
        result.push({
          amountSourced: toBN(amountToBeSourced)
            .minus(amountSourced)
            .toString(),
          fees: toBN(fee.fee).div(1e18).toString(),
          chainId: selectedChain,
          chainName: SUPPORTED_CHAINS[selectedChain as CHAIN_ID].name,
        });
        break;
      }
      amountSourced = amountSourced.plus(toBN(bal.balance));
      result.push({
        amountSourced: toBN(bal.balance).toString(),
        fees: toBN(fee.fee).div(1e18).toString(),
        chainId: selectedChain,
        chainName: SUPPORTED_CHAINS[selectedChain as CHAIN_ID].name,
      });
    }
    return result.sort((a, b) => toBN(a.fees).minus(toBN(b.fees)).toNumber());
  }

  private async getBalancesOnSupportedChains(
    avocadoAddress: string
  ): Promise<IUserBalance[]> {
    const balances = await Promise.all(
      Object.keys(SUPPORTED_CHAINS).map((chainId) =>
        this.getBalanceOnChain(avocadoAddress, +chainId)
      )
    );

    return balances.filter(Boolean);
  }

  private async getBalanceOnChain(
    avocadoAddress: string,
    chainId: CHAIN_ID
  ): Promise<IUserBalance> {
    // Cannot source from the same chain
    if (chainId === this.reqParams.chainId) return null;

    const balance = await getBalanceForToken(
      chainId,
      this.reqParams.token,
      avocadoAddress
    );

    if (!balance) return null;

    return {
      balance,
      chainId,
    };
  }

  private async getEstimatesForSupportedChains(avocadoAddress: string) {
    const res = await Promise.all(
      Object.keys(SUPPORTED_CHAINS).map((chainId) =>
        this.getEstimateForChain(+chainId, avocadoAddress)
      )
    );

    // Filter failed estimates
    return res.filter(Boolean);
  }

  private async getEstimateForChain(chainId: CHAIN_ID, avocadoAddress: string) {
    // Initialize the estimator
    const estimator = new FeeEstimator(
      +chainId,
      avocadoAddress,
      this.reqParams.eoaAddress,
      this.reqParams.index || "0",
      this.cacheMode
    );

    // Prepare the actions
    const transferAction = getTransferAction(
      chainId,
      this.reqParams.eoaAddress,
      this.reqParams.token as TOKEN_NAMES
    );
    const executionAction = getCustomExecutionAction();

    // Returns undefined if fails
    const res = await estimator.getFeeEstimates(
      [transferAction, executionAction],
      true
    );
    return res;
  }
}
