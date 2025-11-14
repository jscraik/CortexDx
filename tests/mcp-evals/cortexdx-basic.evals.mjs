import { openai } from "@ai-sdk/openai";
import { grade } from "mcp-evals";

const defaultEndpoint = process.env.CORTEXDX_EVAL_ENDPOINT ?? "http://127.0.0.1:5001/mcp";
const baseInstructions = `You are testing the CortexDx MCP server at ${defaultEndpoint}. ` +
  "Use CortexDx tools directly (diagnose_mcp_server, deepcontext, orchestration) and summarize findings.";

const serverPath =
  process.env.CORTEXDX_EVAL_STDIO ?? process.argv[3] ?? "packages/cortexdx/src/adapters/stdio-wrapper.ts";

if (!serverPath) {
  throw new Error("CortexDx evals require a server path argument.");
}

const diagnoseEval = {
  name: "diagnostics_baseline",
  description: "Ensures diagnose_mcp_server reports blocker/major/minor counts with evidence.",
  run: async (model) => {
    const prompt = `${baseInstructions} Call diagnose_mcp_server on ${defaultEndpoint} and summarize severities ` +
      "with at least one evidence pointer and remediation suggestion.";
    const result = await grade(model, prompt, serverPath);
    return JSON.parse(result);
  },
};

const deepcontextEval = {
  name: "deepcontext_status",
  description: "Validates DeepContext CLI tooling returns index stats and determinism info.",
  run: async (model) => {
    const prompt = `${baseInstructions} Verify deepcontext tools (status + search) respond without errors ` +
      "and describe index freshness plus deterministic flag handling.";
    const result = await grade(model, prompt, serverPath);
    return JSON.parse(result);
  },
};

const orchestrationEval = {
  name: "orchestration_workflow",
  description: "Checks LangGraph orchestration tooling executes a workflow and reports spans.",
  run: async (model) => {
    const prompt = `${baseInstructions} Run the orchestrate workflow agent.langgraph.baseline and summarize ` +
      "phase transitions plus any span or evidence outputs.";
    const result = await grade(model, prompt, serverPath);
    return JSON.parse(result);
  },
};

const evals = [diagnoseEval, deepcontextEval, orchestrationEval];

const modelName = process.env.CORTEXDX_EVAL_MODEL ?? "gpt-4o-mini";
const model = openai(modelName);

const config = {
  model,
  evals,
};

export default config;
export const cortexDxEvals = evals;
