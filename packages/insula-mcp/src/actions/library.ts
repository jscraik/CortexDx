export type StoryActionResult = {
  action: string;
  target: string;
  message: string;
  reversible: boolean;
  ok: boolean;
  performedAt: string;
  dryRun: boolean;
};

const buildResult = (
  action: string,
  target: string,
  reversible: boolean,
  message: string,
): StoryActionResult => ({
  action,
  target,
  message,
  reversible,
  ok: true,
  performedAt: new Date().toISOString(),
  dryRun: true,
});

export const storyActions = {
  reprobe: (target: string) =>
    buildResult(
      "story.reprobe",
      target,
      true,
      "Triggered safe reprobe request (dry-run)",
    ),
  authRotate: (target: string) =>
    buildResult(
      "actions.auth-rotate",
      target,
      true,
      "Queued auth token rotation (dry-run)",
    ),
  restartConnector: (target: string) =>
    buildResult(
      "actions.restart-connector",
      target,
      true,
      "Scheduled connector restart (dry-run)",
    ),
  revertConfig: (target: string) =>
    buildResult(
      "actions.revert-config",
      target,
      false,
      "Prepared config rollback (dry-run)",
    ),
};

export type StoryActionName = keyof typeof storyActions;

export const executeStoryAction = (action: StoryActionName, target: string): StoryActionResult => {
  const handler = storyActions[action];
  if (!handler) {
    throw new Error(`Unsupported story action: ${action}`);
  }
  return handler(target);
};
