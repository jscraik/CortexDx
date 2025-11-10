# Agent Toolkit Submodule Integration

## Step 1: Add the submodule

You'll need to provide the correct git URL for the agent-toolkit repository. Replace `<GIT_URL>` with the actual URL:

```bash
# From the CortexDx repo root
git submodule add <GIT_URL> packages/agent-toolkit
git commit -m "chore: add agent-toolkit submodule"
```

Possible URLs (choose the correct one):

- `https://github.com/brainwav/agent-toolkit.git`
- `https://github.com/jscraik/agent-toolkit.git`
- `git@github.com:brainwav/agent-toolkit.git`
- `git@github.com:jscraik/agent-toolkit.git`

## Step 2: Wire it into pnpm

The package.json modification is already prepared below.

## Step 3: Install dependencies

After adding the submodule and updating package.json:

```bash
pnpm install
```

## Step 4: Usage

Import in your code:

```typescript
import { createAgentToolkit } from "agent-toolkit";
```

## Step 5: Future Updates

To update the agent-toolkit:

```bash
cd packages/agent-toolkit
git pull origin main
cd ../..
git add packages/agent-toolkit
git commit -m "chore: update agent-toolkit submodule"
```
