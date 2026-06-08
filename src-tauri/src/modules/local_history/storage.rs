use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

use super::config::RetentionPolicy;
use super::diff_engine::compute_diff;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SnapshotMeta {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub file_path: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SnapshotData {
    pub meta: SnapshotMeta,
    pub diff: String,
    pub full_content: Option<String>,
}

fn file_hash(file_path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    file_path.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn history_dir(app_data_dir: &Path, repo_path: &str, file_hash_val: &str) -> PathBuf {
    let mut hasher = DefaultHasher::new();
    repo_path.hash(&mut hasher);
    let repo_hash = format!("{:016x}", hasher.finish());

    app_data_dir
        .join("history")
        .join(repo_hash)
        .join(file_hash_val)
}

fn meta_path(dir: &Path) -> PathBuf {
    dir.join("meta.json")
}

fn snapshot_path(dir: &Path, timestamp: &DateTime<Utc>) -> PathBuf {
    dir.join(format!("{}.diff", timestamp.timestamp_millis()))
}

pub fn load_snapshots(
    app_data_dir: &Path,
    repo_path: &str,
    file_path: &str,
) -> Result<Vec<SnapshotData>, String> {
    let hash = file_hash(file_path);
    let dir = history_dir(app_data_dir, repo_path, &hash);
    let meta_file = meta_path(&dir);

    if !meta_file.exists() {
        return Ok(Vec::new());
    }

    let meta_json =
        fs::read_to_string(&meta_file).map_err(|e| format!("Failed to read meta file: {e}"))?;
    let metas: Vec<SnapshotMeta> =
        serde_json::from_str(&meta_json).map_err(|e| format!("Corrupt meta file: {e}"))?;

    let mut snapshots = Vec::with_capacity(metas.len());
    for meta in metas {
        let snap_path = snapshot_path(&dir, &meta.timestamp);
        let diff = fs::read_to_string(&snap_path)
            .map_err(|e| format!("Failed to read snapshot {}: {e}", meta.id))?;
        snapshots.push(SnapshotData {
            meta,
            diff,
            full_content: None,
        });
    }

    Ok(snapshots)
}

pub fn save_snapshot(
    app_data_dir: &Path,
    repo_path: &str,
    file_path: &str,
    new_content: &str,
    policy: RetentionPolicy,
) -> Result<(), String> {
    let hash = file_hash(file_path);
    let dir = history_dir(app_data_dir, repo_path, &hash);

    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create history dir: {e}"))?;

    let meta_file = meta_path(&dir);
    let mut metas: Vec<SnapshotMeta> = if meta_file.exists() {
        let content =
            fs::read_to_string(&meta_file).map_err(|e| format!("Failed to read meta file: {e}"))?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    let now = Utc::now();
    let snapshot_id = format!("{}", now.timestamp_millis());

    let (diff, _full_content) = if metas.is_empty() {
        (String::new(), Some(new_content.to_string()))
    } else {
        let prev_snapshot_path = snapshot_path(&dir, &metas.last().unwrap().timestamp);
        let prev_content = if prev_snapshot_path.exists() {
            let prev_diff = fs::read_to_string(&prev_snapshot_path)
                .map_err(|e| format!("Failed to read previous snapshot: {e}"))?;
            if metas.len() == 1 {
                metas[0]
                    .file_path
                    .clone()
                    .into_bytes()
                    .into_iter()
                    .map(|b| b as char)
                    .collect::<String>()
            } else {
                super::diff_engine::apply_diff(
                    &reconstruct_content_at(&dir, &metas, metas.len() - 1)?,
                    &prev_diff,
                )?
            }
        } else {
            String::new()
        };
        (compute_diff(&prev_content, new_content), None)
    };

    let meta = SnapshotMeta {
        id: snapshot_id.clone(),
        timestamp: now,
        file_path: file_path.to_string(),
    };

    let snap_path = snapshot_path(&dir, &now);
    fs::write(&snap_path, &diff).map_err(|e| format!("Failed to write snapshot: {e}"))?;

    metas.push(meta);
    apply_retention(&mut metas, &dir, policy)?;

    let meta_json = serde_json::to_string_pretty(&metas)
        .map_err(|e| format!("Failed to serialize meta: {e}"))?;
    fs::write(&meta_file, meta_json).map_err(|e| format!("Failed to write meta file: {e}"))?;

    Ok(())
}

fn reconstruct_content_at(
    dir: &Path,
    metas: &[SnapshotMeta],
    index: usize,
) -> Result<String, String> {
    if metas.is_empty() {
        return Ok(String::new());
    }

    let first_path = snapshot_path(dir, &metas[0].timestamp);
    let first_diff = fs::read_to_string(&first_path)
        .map_err(|e| format!("Failed to read first snapshot: {e}"))?;

    let mut content = if first_diff.is_empty() {
        String::new()
    } else {
        let first_full = fs::read_to_string(&first_path)
            .map_err(|e| format!("Failed to read first snapshot: {e}"))?;
        first_full
    };

    for i in 1..=index {
        let path = snapshot_path(dir, &metas[i].timestamp);
        let diff = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read snapshot {}: {e}", metas[i].id))?;
        content = super::diff_engine::apply_diff(&content, &diff)?;
    }

    Ok(content)
}

fn apply_retention(
    metas: &mut Vec<SnapshotMeta>,
    dir: &Path,
    policy: RetentionPolicy,
) -> Result<(), String> {
    if metas.len() <= 1 {
        return Ok(());
    }

    let cutoff = Utc::now() - chrono::Duration::days(policy.max_age_days as i64);

    let mut to_remove: Vec<usize> = Vec::new();
    for (i, meta) in metas.iter().enumerate() {
        if i == metas.len() - 1 {
            continue;
        }
        if meta.timestamp < cutoff {
            to_remove.push(i);
        }
    }

    let excess = metas.len().saturating_sub(policy.max_snapshots as usize);
    if excess > 0 {
        for i in 0..excess {
            if !to_remove.contains(&i) {
                to_remove.push(i);
            }
        }
    }

    to_remove.sort_unstable_by(|a, b| b.cmp(a));
    for idx in to_remove {
        let path = snapshot_path(dir, &metas[idx].timestamp);
        if path.exists() {
            let _ = fs::remove_file(&path);
        }
        metas.remove(idx);
    }

    if metas.is_empty() {
        let _ = fs::remove_dir_all(dir);
    }

    Ok(())
}

pub fn get_content_at_snapshot(
    app_data_dir: &Path,
    repo_path: &str,
    file_path: &str,
    snapshot_id: &str,
) -> Result<String, String> {
    let hash = file_hash(file_path);
    let dir = history_dir(app_data_dir, repo_path, &hash);
    let meta_file = meta_path(&dir);

    let meta_json =
        fs::read_to_string(&meta_file).map_err(|e| format!("Failed to read meta file: {e}"))?;
    let metas: Vec<SnapshotMeta> =
        serde_json::from_str(&meta_json).map_err(|e| format!("Corrupt meta file: {e}"))?;

    let target_idx = metas
        .iter()
        .position(|m| m.id == snapshot_id)
        .ok_or_else(|| "Snapshot not found".to_string())?;

    reconstruct_content_at(&dir, &metas, target_idx)
}

pub fn get_all_snapshots(
    app_data_dir: &Path,
    repo_path: &str,
    file_path: &str,
) -> Result<Vec<SnapshotMeta>, String> {
    let hash = file_hash(file_path);
    let dir = history_dir(app_data_dir, repo_path, &hash);
    let meta_file = meta_path(&dir);

    if !meta_file.exists() {
        return Ok(Vec::new());
    }

    let meta_json =
        fs::read_to_string(&meta_file).map_err(|e| format!("Failed to read meta file: {e}"))?;
    let metas: Vec<SnapshotMeta> =
        serde_json::from_str(&meta_json).map_err(|e| format!("Corrupt meta file: {e}"))?;

    Ok(metas)
}
