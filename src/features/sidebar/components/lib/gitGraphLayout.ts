export type LaneColor = string;

export const LANE_COLORS: LaneColor[] = [
  "#8b96f6",
  "#bba5f9",
  "#5fcfa5",
  "#edbf72",
  "#ed7f8b",
  "#7adbe7",
  "#e8b87d",
  "#a78bfa",
];

export function laneColor(index: number): LaneColor {
  return LANE_COLORS[index % LANE_COLORS.length];
}

export type GraphEdge =
  | { kind: "straight"; lane: number; color: LaneColor }
  | { kind: "merge"; fromLane: number; toLane: number; color: LaneColor }
  | { kind: "branch"; fromLane: number; toLane: number; color: LaneColor };

export type GraphRow = {
  sha: string;
  lane: number;
  nodeColor: LaneColor;
  laneCount: number;
  topEdges: GraphEdge[];
  bottomEdges: GraphEdge[];
};

export type GraphState = {
  lanes: (string | null)[];
};

export const EMPTY_GRAPH_STATE: GraphState = { lanes: [] };

function trimTrailing(lanes: (string | null)[]): (string | null)[] {
  let end = lanes.length;
  while (end > 0 && lanes[end - 1] === null) end--;
  return end === lanes.length ? lanes : lanes.slice(0, end);
}

function firstFreeSlot(lanes: (string | null)[]): number {
  for (let i = 0; i < lanes.length; i++) {
    if (lanes[i] === null) return i;
  }
  return lanes.length;
}

export function layoutGraph(
  commits: { sha: string; parents: string[] }[],
  previous: GraphState = EMPTY_GRAPH_STATE,
): { rows: GraphRow[]; state: GraphState } {
  const lanes: (string | null)[] = previous.lanes.slice();
  const rows: GraphRow[] = [];

  for (const commit of commits) {
    const claiming: number[] = [];
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] === commit.sha) claiming.push(i);
    }

    let lane: number;
    if (claiming.length > 0) {
      lane = claiming[0];
    } else {
      lane = firstFreeSlot(lanes);
      if (lane === lanes.length) lanes.push(null);
    }

    const lanesBefore = lanes.slice();
    const topEdges: GraphEdge[] = [];

    for (let i = 0; i < lanesBefore.length; i++) {
      const v = lanesBefore[i];
      if (v === null) continue;
      if (v === commit.sha && i !== lane) {
        topEdges.push({
          kind: "merge",
          fromLane: i,
          toLane: lane,
          color: laneColor(i),
        });
      } else if (i === lane && v === commit.sha) {
        topEdges.push({ kind: "straight", lane: i, color: laneColor(i) });
      } else {
        topEdges.push({ kind: "straight", lane: i, color: laneColor(i) });
      }
    }

    for (const idx of claiming) lanes[idx] = null;
    if (claiming.length === 0) {
      lanes[lane] = null;
    }

    const parents = commit.parents;
    const bottomEdges: GraphEdge[] = [];
    if (parents.length > 0) {
      lanes[lane] = parents[0];

      for (let p = 1; p < parents.length; p++) {
        const parentSha = parents[p];
        let parentLane = lanes.indexOf(parentSha);
        if (parentLane === -1) {
          parentLane = firstFreeSlot(lanes);
          if (parentLane === lanes.length) lanes.push(null);
          lanes[parentLane] = parentSha;
        }
        if (parentLane !== lane) {
          bottomEdges.push({
            kind: "branch",
            fromLane: lane,
            toLane: parentLane,
            color: laneColor(parentLane),
          });
        }
      }
    }

    const branchTargets = new Set(
      bottomEdges
        .filter((e): e is Extract<GraphEdge, { kind: "branch" }> => e.kind === "branch")
        .map((e) => e.toLane),
    );
    for (let i = 0; i < lanes.length; i++) {
      const v = lanes[i];
      if (v === null) continue;
      if (branchTargets.has(i)) continue;
      bottomEdges.push({ kind: "straight", lane: i, color: laneColor(i) });
    }

    const trimmed = trimTrailing(lanes);
    if (trimmed.length !== lanes.length) {
      lanes.length = trimmed.length;
    }

    const widestLane = Math.max(lanesBefore.length, lanes.length, lane + 1);

    rows.push({
      sha: commit.sha,
      lane,
      nodeColor: laneColor(lane),
      laneCount: widestLane,
      topEdges,
      bottomEdges,
    });
  }

  return { rows, state: { lanes: lanes.slice() } };
}
