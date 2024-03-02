import {
  IsArray,
  IsEnum,
  IsEthereumAddress,
  IsOptional,
  IsPositive,
  IsString,
} from "class-validator";
import {
  Body,
  Get,
  JsonController,
  Params,
  Post,
  QueryParams,
} from "routing-controllers";
import { CHAIN_ID, TOKEN_NAMES } from "../constants";
import { RouteFinder } from "../core";
import { AvocadoWallet } from "../core/chunks/Avocado";
import { FeeEstimator } from "../core/chunks/FeeEstimator";
import { ISourcingRoutesReqParams, ITransactionAction } from "../interfaces";

class ReqQueryParams {
  @IsEthereumAddress()
  eoaAddress: string;

  @IsPositive()
  amount: number;

  @IsOptional()
  @IsEthereumAddress()
  avocadoAddress: string;

  @IsOptional()
  @IsString()
  index: string;
}

class ReqParams {
  @IsEnum(CHAIN_ID)
  chainId: number;

  @IsEnum(TOKEN_NAMES)
  token: TOKEN_NAMES;
}

class EstimateWithActionsBody {
  @IsArray()
  actions: ITransactionAction[];

  @IsEnum(CHAIN_ID)
  chainId: CHAIN_ID;

  @IsEthereumAddress()
  eoaAddress: string;

  @IsEthereumAddress()
  @IsOptional()
  avocadoAddress: string;

  @IsOptional()
  avocadoWalletIndex: string;
}

@JsonController()
export class RouteFinderController {
  @Get("/estimate-sourcing-routes/:chainId/:token")
  public async estimateSourcingRoutes(
    @Params() reqParams: ReqParams,
    @QueryParams() queryParams: ReqQueryParams
  ) {
    const params: ISourcingRoutesReqParams = {
      ...reqParams,
      ...queryParams,
    };
    const finder = new RouteFinder(params);
    return await finder.findRoutes();
  }
}

@JsonController()
export class EstimationWithActions {
  @Post("/estimate-fees-with-actions")
  public async estimateSourcingRoutes(
    @Body() request: EstimateWithActionsBody
  ) {
    const estimator = new FeeEstimator(
      request.chainId,
      request.avocadoAddress ||
        (await AvocadoWallet.computeAvocadoAddress(
          request.eoaAddress,
          request.avocadoWalletIndex || "0"
        )),
      request.eoaAddress,
      request.avocadoWalletIndex || "0"
    );

    return await estimator.getFeeEstimates(request.actions, false);
  }
}
