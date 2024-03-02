import { CHAIN_ID, TOKEN_NAMES } from "../../constants";

export type ISourcingRoutesReqParams = {
  chainId: CHAIN_ID;
  token: TOKEN_NAMES;
  eoaAddress: string;
  amount: number;
  avocadoAddress?: string;
  index?: string;
};
