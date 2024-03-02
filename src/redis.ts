import chalk from "chalk";
import { createClient } from "redis";
import { config } from "./config";

class Redis {
  private readonly endpoint: string;
  private redisClient: ReturnType<typeof createClient>;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  public async saveDataToCache(key: string, value: any, expiry: number) {
    try {
      const client = await this.getClient();
      await client.setEx(key, expiry, value);
      console.log(chalk.green(`[Redis] Saved ${key} to cache!`));
    } catch (e) {
      console.log(chalk.red(`[Redis] Error : ${e}`));
    }
  }

  public async getDataFromCache(key: string) {
    try {
      const client = await this.getClient();
      const res = await client.get(key);
      return res;
    } catch (e) {
      console.log(chalk.red(`[Redis] Error : ${e}`));
    }
  }

  public async getClient(): Promise<ReturnType<typeof createClient>> {
    if (this.redisClient) return this.redisClient;
    this.redisClient = await createClient({
      url: this.endpoint,
    })
      .on("error", (err) => {
        console.log("Redis Client Error", err);
        throw new Error(err);
      })
      .connect();

    console.log(chalk.green(`[Redis] Client coonnected!`));
    return this.redisClient;
  }
}

export const RedisClient = new Redis(config.REDIS_URL);
