import type { DevelopmentContext } from "../types.js";

export type ExecutionMode = "diagnostic" | "development";

export function normalizeExecutionMode(mode?: ExecutionMode): ExecutionMode {
    return mode === "development" ? "development" : "diagnostic";
}

export function normalizeExpertiseLevel(
    expertise?: DevelopmentContext["userExpertiseLevel"],
): DevelopmentContext["userExpertiseLevel"] {
    if (expertise === "beginner" || expertise === "expert") {
        return expertise;
    }
    return "intermediate";
}
