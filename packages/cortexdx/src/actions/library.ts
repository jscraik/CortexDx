import { isStoryFeatureEnabled } from "../story/feature-flag.js";

export type StoryAction = "reprobe";

export interface StoryActionResult {
  dryRun: boolean;
  target: string;
}

export function executeStoryAction(
  action: StoryAction,
  target: string,
): StoryActionResult {
  if (!isStoryFeatureEnabled()) {
    throw new Error("Story feature flag is disabled");
  }

  if (action !== "reprobe") {
    throw new Error(`Unsupported story action: ${action}`);
  }

  return {
    dryRun: true,
    target,
  };
}

