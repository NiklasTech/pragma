use app_lib::modules::git::graph_layout::{layout_graph, CommitRef, GraphState};
use criterion::{criterion_group, criterion_main, Criterion};

fn generate_linear_commits(count: usize) -> Vec<CommitRef> {
    let shas: Vec<String> = (0..count).map(|i| format!("{:040x}", i)).collect();
    shas.iter()
        .enumerate()
        .map(|(i, sha)| CommitRef {
            sha: sha.clone(),
            parents: if i == 0 { vec![] } else { vec![shas[i - 1].clone()] },
        })
        .collect()
}

fn generate_branching_commits(count: usize) -> Vec<CommitRef> {
    let shas: Vec<String> = (0..count).map(|i| format!("{:040x}", i)).collect();
    shas.iter()
        .enumerate()
        .map(|(i, sha)| CommitRef {
            sha: sha.clone(),
            parents: if i == 0 {
                vec![]
            } else if i % 5 == 0 {
                vec![shas[i - 1].clone(), shas[i / 2].clone()]
            } else {
                vec![shas[i - 1].clone()]
            },
        })
        .collect()
}

fn bench_layout_linear(c: &mut Criterion) {
    let commits = generate_linear_commits(1000);
    c.bench_function("git_graph_layout linear 1000", |b| {
        b.iter(|| {
            let (rows, _) = layout_graph(&commits, &GraphState::default());
            assert_eq!(rows.len(), 1000);
        })
    });
}

fn bench_layout_branching(c: &mut Criterion) {
    let commits = generate_branching_commits(1000);
    c.bench_function("git_graph_layout branching 1000", |b| {
        b.iter(|| {
            let (rows, _) = layout_graph(&commits, &GraphState::default());
            assert_eq!(rows.len(), 1000);
        })
    });
}

criterion_group!(benches, bench_layout_linear, bench_layout_branching);
criterion_main!(benches);
