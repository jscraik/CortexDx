export const STORY_FEATURE_FLAG = "INSULA_STORIES_ENABLED";

export const isStoryFeatureEnabled = (
  env: Record<string, string | undefined> = process.env,
): boolean => {
  const value = env[STORY_FEATURE_FLAG];
  if (!value) {
    return false;
  }
  return value.toLowerCase() === "true" || value === "1";
};
