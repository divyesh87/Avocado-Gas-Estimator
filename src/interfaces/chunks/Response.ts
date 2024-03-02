import { CHAIN_ID } from "../../constants";

export type IProcessedSourcingEstimateRes = {
  amountSourced: string;
  fees: string;
  chainId: CHAIN_ID;
  chainName: string;
}[];
