use serde::Serialize;

pub const LANE_COLORS: &[&str] = &[
    "#60a5fa", "#c084fc", "#34d399", "#fbbf24", "#f472b6", "#22d3ee", "#fb923c", "#a3e635",
];

pub fn lane_color(index: usize) -> &'static str {
    LANE_COLORS[index % LANE_COLORS.len()]
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(tag = "kind")]
pub enum GraphEdge {
    Straight {
        lane: usize,
        color: String,
    },
    Merge {
        from_lane: usize,
        to_lane: usize,
        color: String,
    },
    Branch {
        from_lane: usize,
        to_lane: usize,
        color: String,
    },
}

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct GraphRow {
    pub sha: String,
    pub lane: usize,
    pub node_color: String,
    pub lane_count: usize,
    pub top_edges: Vec<GraphEdge>,
    pub bottom_edges: Vec<GraphEdge>,
}

#[derive(Clone, Debug, Default, Serialize, PartialEq)]
pub struct GraphState {
    pub lanes: Vec<Option<String>>,
}

fn trim_trailing(lanes: &mut Vec<Option<String>>) {
    while let Some(None) = lanes.last() {
        lanes.pop();
    }
}

fn first_free_slot(lanes: &[Option<String>]) -> usize {
    lanes
        .iter()
        .position(|l| l.is_none())
        .unwrap_or(lanes.len())
}

pub fn layout_graph(commits: &[CommitRef], previous: &GraphState) -> (Vec<GraphRow>, GraphState) {
    let mut lanes = previous.lanes.clone();
    let mut rows = Vec::with_capacity(commits.len());

    for commit in commits {
        let claiming: Vec<usize> = lanes
            .iter()
            .enumerate()
            .filter(|(_, l)| l.as_deref() == Some(commit.sha.as_str()))
            .map(|(i, _)| i)
            .collect();

        let lane = if let Some(&first) = claiming.first() {
            first
        } else {
            let slot = first_free_slot(&lanes);
            if slot == lanes.len() {
                lanes.push(None);
            }
            slot
        };

        let lanes_before = lanes.clone();
        let mut top_edges = Vec::new();

        for (i, v) in lanes_before.iter().enumerate() {
            let Some(v_sha) = v.as_deref() else {
                continue;
            };
            if v_sha == commit.sha.as_str() && i != lane {
                top_edges.push(GraphEdge::Merge {
                    from_lane: i,
                    to_lane: lane,
                    color: lane_color(i).to_string(),
                });
            } else {
                top_edges.push(GraphEdge::Straight {
                    lane: i,
                    color: lane_color(i).to_string(),
                });
            }
        }

        for &idx in &claiming {
            lanes[idx] = None;
        }
        if claiming.is_empty() {
            lanes[lane] = None;
        }

        let mut bottom_edges = Vec::new();
        if !commit.parents.is_empty() {
            lanes[lane] = Some(commit.parents[0].clone());

            for parent_sha in &commit.parents[1..] {
                let parent_lane = lanes
                    .iter()
                    .position(|l| l.as_deref() == Some(parent_sha.as_str()))
                    .unwrap_or_else(|| {
                        let slot = first_free_slot(&lanes);
                        if slot == lanes.len() {
                            lanes.push(None);
                        }
                        lanes[slot] = Some(parent_sha.clone());
                        slot
                    });
                if parent_lane != lane {
                    bottom_edges.push(GraphEdge::Branch {
                        from_lane: lane,
                        to_lane: parent_lane,
                        color: lane_color(parent_lane).to_string(),
                    });
                }
            }
        }

        let branch_targets: std::collections::HashSet<usize> = bottom_edges
            .iter()
            .filter_map(|e| match e {
                GraphEdge::Branch { to_lane, .. } => Some(*to_lane),
                _ => None,
            })
            .collect();

        for (i, v) in lanes.iter().enumerate() {
            if v.is_none() {
                continue;
            }
            if branch_targets.contains(&i) {
                continue;
            }
            bottom_edges.push(GraphEdge::Straight {
                lane: i,
                color: lane_color(i).to_string(),
            });
        }

        trim_trailing(&mut lanes);

        let widest_lane = lanes_before.len().max(lanes.len()).max(lane + 1);

        rows.push(GraphRow {
            sha: commit.sha.clone(),
            lane,
            node_color: lane_color(lane).to_string(),
            lane_count: widest_lane,
            top_edges,
            bottom_edges,
        });
    }

    (rows, GraphState { lanes })
}

#[derive(Clone, Debug)]
pub struct CommitRef {
    pub sha: String,
    pub parents: Vec<String>,
}
