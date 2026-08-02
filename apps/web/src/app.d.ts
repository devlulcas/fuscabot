import type { ApiRuntime } from "@fuscabot/api";

declare global {
  namespace App {
    interface Locals {
      backend: ApiRuntime;
    }
  }
}

export {};
