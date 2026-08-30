export interface MapNode {
  id: string;
  x: number;
  y: number;
  floor: number;
  roomId?: string;
}

export interface MapEdge {
  from: string;
  to: string;
  floor: number;
}

export interface PathResult {
  nodeIds: string[];
  nodes: MapNode[];
  totalDistance: number;
}

const STAIR_LINK_DISTANCE = 150;
const STAIR_EDGE_WEIGHT = 80;

function distance(a: MapNode, b: MapNode): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isStairNode(node: MapNode): boolean {
  return Boolean(node.roomId?.includes('stairs'));
}

function buildAdjacencyList(
  nodes: MapNode[],
  edges: MapEdge[],
): Map<string, { neighborId: string; weight: number }[]> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, { neighborId: string; weight: number }[]>();

  const addEdge = (fromId: string, toId: string, weight: number) => {
    if (!nodeById.has(fromId) || !nodeById.has(toId) || fromId === toId) return;

    const fromList = adjacency.get(fromId) ?? [];
    if (!fromList.some((entry) => entry.neighborId === toId)) {
      fromList.push({ neighborId: toId, weight });
      adjacency.set(fromId, fromList);
    }
  };

  for (const edge of edges) {
    const fromNode = nodeById.get(edge.from);
    const toNode = nodeById.get(edge.to);
    if (!fromNode || !toNode) continue;

    const weight = distance(fromNode, toNode);
    addEdge(edge.from, edge.to, weight);
    addEdge(edge.to, edge.from, weight);
  }

  for (const node of nodes) {
    if (!isStairNode(node)) continue;

    for (const other of nodes) {
      if (other.floor !== node.floor + 1 && other.floor !== node.floor - 1) continue;

      const gap = distance(node, other);
      if (gap > STAIR_LINK_DISTANCE) continue;

      addEdge(node.id, other.id, STAIR_EDGE_WEIGHT + gap);
    }
  }

  return adjacency;
}

export function findNodeByRoomId(roomId: string, nodes: MapNode[]): MapNode | null {
  return nodes.find((node) => node.roomId === roomId) ?? null;
}

/** Відсіює вузли з некоректними координатами/поверхом — щоб NaN не «отруїв» граф. */
export function sanitizeNodes(nodes: unknown): MapNode[] {
  if (!Array.isArray(nodes)) return [];
  const seen = new Set<string>();
  const result: MapNode[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const { id, x, y, floor, roomId } = node as Partial<MapNode>;
    if (typeof id !== 'string' || !id) continue;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(floor)) continue;
    if (seen.has(id)) continue; // дублікат id зламав би відновлення шляху
    seen.add(id);
    result.push({ id, x: x as number, y: y as number, floor: floor as number, roomId });
  }
  return result;
}

/** Лишає лише ребра, обидва кінці яких існують і не збігаються. */
export function sanitizeEdges(edges: unknown, nodes: MapNode[]): MapEdge[] {
  if (!Array.isArray(edges)) return [];
  const ids = new Set(nodes.map((node) => node.id));
  const result: MapEdge[] = [];
  const seen = new Set<string>();
  for (const edge of edges) {
    if (!edge || typeof edge !== 'object') continue;
    const { from, to, floor } = edge as Partial<MapEdge>;
    if (typeof from !== 'string' || typeof to !== 'string') continue;
    if (from === to || !ids.has(from) || !ids.has(to)) continue;
    const key = from < to ? `${from}|${to}` : `${to}|${from}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ from, to, floor: Number.isFinite(floor) ? (floor as number) : 1 });
  }
  return result;
}

export function dijkstra(
  startNodeId: string,
  endNodeId: string,
  nodes: MapNode[],
  edges: MapEdge[],
): PathResult | null {
  if (!startNodeId || !endNodeId || !Array.isArray(nodes) || nodes.length === 0) {
    return null;
  }

  if (startNodeId === endNodeId) {
    const node = nodes.find((entry) => entry.id === startNodeId);
    return node ? { nodeIds: [startNodeId], nodes: [node], totalDistance: 0 } : null;
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  if (!nodeById.has(startNodeId) || !nodeById.has(endNodeId)) {
    return null;
  }

  const adjacency = buildAdjacencyList(nodes, edges);
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const unvisited = new Set<string>();

  for (const node of nodes) {
    distances.set(node.id, node.id === startNodeId ? 0 : Infinity);
    previous.set(node.id, null);
    unvisited.add(node.id);
  }

  while (unvisited.size > 0) {
    let currentId = '';
    let minDistance = Infinity;

    for (const nodeId of unvisited) {
      const nodeDistance = distances.get(nodeId) ?? Infinity;
      if (nodeDistance < minDistance) {
        minDistance = nodeDistance;
        currentId = nodeId;
      }
    }

    if (!currentId || minDistance === Infinity) break;

    unvisited.delete(currentId);
    if (currentId === endNodeId) break;

    for (const { neighborId, weight } of adjacency.get(currentId) ?? []) {
      if (!unvisited.has(neighborId)) continue;

      const nextDistance = minDistance + weight;
      if (nextDistance < (distances.get(neighborId) ?? Infinity)) {
        distances.set(neighborId, nextDistance);
        previous.set(neighborId, currentId);
      }
    }
  }

  if ((distances.get(endNodeId) ?? Infinity) === Infinity) {
    return null;
  }

  const nodeIds: string[] = [];
  let currentId: string | null = endNodeId;
  // Захист від зациклення, якщо previous колись стане неконсистентним
  const guard = new Set<string>();

  while (currentId && !guard.has(currentId)) {
    guard.add(currentId);
    nodeIds.unshift(currentId);
    currentId = previous.get(currentId) ?? null;
  }

  const pathNodes = nodeIds
    .map((nodeId) => nodeById.get(nodeId))
    .filter((node): node is MapNode => Boolean(node));

  return {
    nodeIds,
    nodes: pathNodes,
    totalDistance: distances.get(endNodeId) ?? 0,
  };
}

export function findPathBetweenRooms(
  fromRoomId: string,
  toRoomId: string,
  nodes: MapNode[],
  edges: MapEdge[],
): PathResult | null {
  const startNode = findNodeByRoomId(fromRoomId, nodes);
  const endNode = findNodeByRoomId(toRoomId, nodes);

  if (!startNode || !endNode) {
    return null;
  }

  return dijkstra(startNode.id, endNode.id, nodes, edges);
}
