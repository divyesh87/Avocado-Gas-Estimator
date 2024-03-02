import axios from "axios";
import { CHAIN_ID, TOKEN_NAMES } from "../constants";
import { AvocadoWallet } from "../core/chunks/Avocado";
import { FeeEstimator } from "../core/chunks/FeeEstimator";
import {
  getCustomExecutionAction,
  getTransferAction,
  prepareTxnPayloadWithActions,
  toBN,
} from "../helpers";

function estimateFees(
  chainId: CHAIN_ID,
  eoaAddress: string,
  token: TOKEN_NAMES
) {
  test("It should correctly estimate fees", async () => {
    const avocadoAddress = await AvocadoWallet.computeAvocadoAddress(
      eoaAddress,
      "0"
    );
    const feeEstimator = new FeeEstimator(
      chainId,
      avocadoAddress,
      eoaAddress,
      "0"
    );

    const { nextNonce } = await new AvocadoWallet(
      chainId,
      avocadoAddress
    ).getWalletMetadata();
    const transferAction = getTransferAction(chainId, eoaAddress, token);
    const executionAction = getCustomExecutionAction();
    const payload = prepareTxnPayloadWithActions(
      [transferAction, executionAction],
      nextNonce
    );

    const [estimate, { data: broadcasterEstimate }] = await Promise.all([
      feeEstimator.getFeeEstimates([transferAction, executionAction],false),
      axios.post("http://localhost:8080/multisig-estimate-without-signature", {
        message: payload,
        owner: eoaAddress,
        safe: avocadoAddress,
        index: "0",
        targetChainId: String(chainId),
      }),
    ]);

    expect(estimate).toBeDefined();
    expect(broadcasterEstimate).toBeDefined();

    const fee = toBN(estimate.fee).div(1e18);
    const broadcasterFee = toBN(broadcasterEstimate.fee).div(1e18);

    const diff = fee.minus(broadcasterFee).absoluteValue();
    const avg = fee.plus(broadcasterFee).dividedBy(2);
    const percentDiff = diff
      .div(avg)
      .multipliedBy(100)
      .absoluteValue()
      .toNumber();

    console.log(percentDiff);
    expect(percentDiff).toBeLessThanOrEqual(1);
  }, 50000);
}

describe("Correctly estimates ethereum fees", () => {
  estimateFees(
    CHAIN_ID.ETHEREUM,
    "0xaEB2584fD2C1d1C27dC72afcb8e858a5fFE4C794",
    TOKEN_NAMES.USDC
  );
});

describe("Correctly estimates polygon fees", () => {
  estimateFees(
    CHAIN_ID.POLYGON,
    "0xaEB2584fD2C1d1C27dC72afcb8e858a5fFE4C794",
    TOKEN_NAMES.USDC
  );
});

describe("Correctly estimates avalanche fees", () => {
  estimateFees(
    CHAIN_ID.AVALANCHE,
    "0x000000C921a0ecd16a178B17Ed00F61E0dA8899B",
    TOKEN_NAMES.USDC
  );
});

describe("Correctly estimates optimism fees", () => {
  estimateFees(
    CHAIN_ID.OPTIMISM,
    "0x000000C921a0ecd16a178B17Ed00F61E0dA8899B",
    TOKEN_NAMES.USDC
  );
});

describe("Correctly estimates arbitrum fees", () => {
  estimateFees(
    CHAIN_ID.ARBITRUM,
    "0x6811E46458c400E3Cfd5f6B8adAb6e4E3dcEDecB",
    TOKEN_NAMES.USDC
  );
});
