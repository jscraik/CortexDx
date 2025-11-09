export interface SelfHealingCliOptions {
  deterministic: boolean;
  plugins: string[];
  model?: string;
  dryRun: boolean;
  endpoint: string;
}

export function parseCliOptions(argv: string[]): SelfHealingCliOptions {
  const args = argv.filter((arg) => arg !== '--');
  const deterministic = args.includes('--deterministic');
  const dryRun = args.includes('--dry-run') || !args.some((arg) => arg.startsWith('--dry-run='));

  const pluginsArg = getValue(args, '--plugins');
  const modelArg = getValue(args, '--model');
  const endpointArg = getValue(args, '--endpoint');

  const plugins = pluginsArg
    ? pluginsArg
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  return {
    deterministic,
    plugins,
    model: modelArg,
    dryRun,
    endpoint: endpointArg ?? process.env.INSULA_SELF_HEALING_ENDPOINT ?? "http://127.0.0.1:5001",
  };
}

function getValue(args: string[], flag: string): string | undefined {
  const entry = args.find((arg) => arg.startsWith(`${flag}=`));
  if (entry) {
    const [, value] = entry.split('=');
    return value;
  }
  return undefined;
}
