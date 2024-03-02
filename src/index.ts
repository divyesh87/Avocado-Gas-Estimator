import chalk from "chalk";
import express from "express";
import morgan from "morgan";
import path from "path";
import "reflect-metadata";
import { useExpressServer } from "routing-controllers";
import { config } from "./config";
import { CustomErrorHandler } from "./middlewares";

async function main() {
  const expressApp = express();
  expressApp.use(morgan("dev"));
  const app = useExpressServer(expressApp, {
    cors: true,
    routePrefix: process.env.PATH_PREFIX,
    defaults: {
      nullResultCode: 404,
      undefinedResultCode: 204,
      paramOptions: {
        required: true,
      },
    },
    validation: {
      whitelist: true,
      forbidNonWhitelisted: false,
      forbidUnknownValues: true,
    },
    defaultErrorHandler: false,
    middlewares: [CustomErrorHandler],
    controllers: [path.join(__dirname, "/controllers/*{.js,.ts}")],
  });

  app.listen(config.SERVER_PORT, () =>
    console.log(chalk.green("Server listening on port " + config.SERVER_PORT))
  );
}

main().catch((err) => {
  console.log(chalk.red("Process exited with code 1 -- " + err));
});
