import { openai } from "@ai-sdk/openai";
import { grade } from "mcp-evals";

const endpoint = process.env.CLIENT_EVAL_ENDPOINT;

if (!endpoint) {
  throw new Error(
    "CLIENT_EVAL_ENDPOINT must be set before running client MCP evals.",
  );
}

const serverPath =
  process.env.CLIENT_EVAL_STDIO ??
  process.argv[3] ??
  "packages/cortexdx/src/adapters/stdio-wrapper.ts";

if (!serverPath) {
  throw new Error("client evals require a stdio wrapper path argument.");
}

const baseInstructions =
  `You are validating a customer MCP server at ${endpoint}. ` +
  "You must choose CortexDx-style tools in the correct order (list_teams → create_issue, diagnose_mcp_server).";

const issueRoutingEval = {
  name: "issue_routing",
  description:
    "Ensure the assistant lists teams then opens an issue for the right team.",
  run: async (model) => {
    const prompt =
      `${baseInstructions} Report a login regression, call list_teams first, ` +
      "then call create_issue with the Frontend team id and explain the evidence you used.";
    const result = await grade(model, prompt, serverPath);
    return JSON.parse(result);
  },
};

const diagnoseEval = {
  name: "client_diagnostics",
  description:
    "Run diagnose_mcp_server with auth headers and summarize blocker/major counts.",
  run: async (model) => {
    const prompt =
      `${baseInstructions} Authenticate if required, run diagnose_mcp_server on the target endpoint, ` +
      "and capture blocker/major/minor totals plus at least one evidence pointer for each severity above MINOR.";
    const result = await grade(model, prompt, serverPath);
    return JSON.parse(result);
  },
};

const evals = [issueRoutingEval, diagnoseEval];

const modelSlug =
  process.env.CLIENT_EVAL_MODEL ??
  process.env.CORTEXDX_EVAL_MODEL ??
  "gpt-4o-mini";
const model = openai(modelSlug);

const config = {
  model,
  evals,
};

export default config;
export const clientEvalSuite = evals;
