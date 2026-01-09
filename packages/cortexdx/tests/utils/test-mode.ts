import { describe } from "vitest";

export const isIntegrationEnabled = (): boolean =>
  process.env.CORTEXDX_RUN_INTEGRATION === "1";

export function describeIntegration(name: string, factory: () => void): void {
  if (isIntegrationEnabled()) {
    describe(name, factory);
  } else {
    describe.skip(name, factory);
  }
}
