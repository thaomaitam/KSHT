import { GiabanApplication } from "../application/giaban.ts";
import { invokeEnvelope, type InvokeEnvelope } from "./invoke.ts";

export class GiabanDomain {
  app: GiabanApplication;
  secret: string;

  constructor(app: GiabanApplication, secret: string) {
    this.app = app;
    this.secret = secret;
  }

  async invoke(envelope: InvokeEnvelope) {
    return invokeEnvelope(this.app, envelope, this.secret);
  }
}
