import {
  ExpressErrorMiddlewareInterface,
  Middleware,
} from "routing-controllers";

@Middleware({ type: "after" })
export class CustomErrorHandler implements ExpressErrorMiddlewareInterface {
  error(error: any, request: any, response: any, next: (err: any) => any) {
    if (error instanceof CustomError) {
      return response.status(400).send({
        status: "failure",
        message: error.message,
      });
    } else {
      if (error?.errors) {
        response.status(400).send({
          status: "failure",
          message: error.message,
          errors: error.errors,
        });
      } else {
        return response.status(500).send({
          status: "failure",
          message: error.message,
        });
      }
    }
  }
}

export class CustomError extends Error {
  constructor(msg?: string) {
    super(msg);
  }
}
