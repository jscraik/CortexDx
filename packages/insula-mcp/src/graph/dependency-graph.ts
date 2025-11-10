export type NodeType = "server" | "tool" | "connector" | "service";

export type Node = {
  id: string;
  type: NodeType;
  metadata?: Record<string, unknown>;
};

export type EdgeRelation = "depends_on" | "calls" | "streams";

export type Edge = {
  from: string;
  to: string;
  relation: EdgeRelation;
};

export type DepGraph = {
  nodes: Node[];
  edges: Edge[];
};

export type ManifestLike = {
  name?: string;
  server?: { name?: string };
  tools?: Array<{ name: string; depends_on?: string[]; metadata?: Record<string, unknown> }>;
  connectors?: Array<{ id: string; target?: string; depends_on?: string[] }>;
  resources?: Array<{ name: string; depends_on?: string[] }>;
};

export type ProbeInventory = {
  targets?: Array<{ id: string; type?: NodeType; depends_on?: string[] }>;
  dependencies?: Array<{ from: string; to: string; relation?: EdgeRelation }>;
};

type NodeMap = Map<string, Node>;

type EdgeList = Edge[];

const DEFAULT_SERVER_ID = "cortexdx";

export function buildDependencyGraph(
  manifest: ManifestLike = {},
  probes: ProbeInventory = {},
): DepGraph {
  const nodes: NodeMap = new Map();
  const edges: EdgeList = [];

  const addNode = (node: Node) => {
    if (!nodes.has(node.id)) {
      nodes.set(node.id, node);
    }
  };

  const addEdge = (edge: Edge) => {
    const exists = edges.some(
      (item) => item.from === edge.from && item.to === edge.to && item.relation === edge.relation,
    );
    if (!exists) {
      edges.push(edge);
    }
  };

  const serverId = manifest.server?.name ?? manifest.name ?? DEFAULT_SERVER_ID;
  addNode({ id: serverId, type: "server" });
  registerManifest(manifest, addNode, addEdge);
  registerProbeInventory(probes, addNode, addEdge);
  ensureServerNode(serverId, addNode);

  return {
    nodes: [...nodes.values()],
    edges,
  };
}

const registerManifest = (
  manifest: ManifestLike,
  addNode: (node: Node) => void,
  addEdge: (edge: Edge) => void,
) => {
  for (const tool of manifest.tools ?? []) {
    addNode({ id: tool.name, type: "tool", metadata: tool.metadata });
    for (const target of tool.depends_on ?? []) {
      addEdge({ from: tool.name, to: target, relation: "depends_on" });
    }
  }

  for (const connector of manifest.connectors ?? []) {
    addNode({ id: connector.id, type: "connector" });
    for (const target of connector.depends_on ?? []) {
      addEdge({ from: connector.id, to: target, relation: "calls" });
    }
    if (connector.target) {
      addEdge({ from: connector.id, to: connector.target, relation: "streams" });
    }
  }

  for (const resource of manifest.resources ?? []) {
    addNode({ id: resource.name, type: "service" });
    for (const target of resource.depends_on ?? []) {
      addEdge({ from: resource.name, to: target, relation: "depends_on" });
    }
  }
};

const registerProbeInventory = (
  probes: ProbeInventory,
  addNode: (node: Node) => void,
  addEdge: (edge: Edge) => void,
) => {
  for (const target of probes.targets ?? []) {
    addNode({ id: target.id, type: target.type ?? "service" });
    for (const dependency of target.depends_on ?? []) {
      addEdge({ from: target.id, to: dependency, relation: "depends_on" });
    }
  }

  for (const dependency of probes.dependencies ?? []) {
    addEdge({
      from: dependency.from,
      to: dependency.to,
      relation: dependency.relation ?? "depends_on",
    });
  }
};

const ensureServerNode = (id: string, addNode: (node: Node) => void) => {
  addNode({ id, type: "server" });
};

export function longestPath(graph: DepGraph, start: string): string[] {
  const adjacency = graph.edges.reduce<Map<string, string[]>>((map, edge) => {
    const list = map.get(edge.from) ?? [];
    list.push(edge.to);
    map.set(edge.from, list);
    return map;
  }, new Map());

  const visit = (current: string, path: string[]): string[] => {
    const nextNodes = adjacency.get(current) ?? [];
    if (nextNodes.length === 0) {
      return [...path, current];
    }

    return nextNodes.reduce<string[]>((best, next) => {
      if (path.includes(next)) {
        return best;
      }

      const candidate = visit(next, [...path, current]);
      return candidate.length > best.length ? candidate : best;
    }, [...path, current]);
  };

  if (!graph.nodes.some((node) => node.id === start)) {
    return [start];
  }

  return visit(start, []);
}
