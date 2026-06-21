use diffy::{create_patch, Patch};

pub fn compute_diff(old_content: &str, new_content: &str) -> String {
    create_patch(old_content, new_content).to_string()
}

pub fn apply_diff(base_content: &str, patch_text: &str) -> Result<String, String> {
    let patch = Patch::from_str(patch_text).map_err(|e| format!("Invalid patch: {e}"))?;
    diffy::apply(base_content, &patch).map_err(|e| format!("Failed to apply patch: {e:?}"))
}

pub fn reconstruct_content(snapshots: &[super::storage::SnapshotData]) -> Result<String, String> {
    if snapshots.is_empty() {
        return Ok(String::new());
    }

    let mut content = snapshots[0]
        .full_content
        .clone()
        .ok_or_else(|| "First snapshot missing full content".to_string())?;

    for snapshot in snapshots.iter().skip(1) {
        content = apply_diff(&content, &snapshot.diff)?;
    }

    Ok(content)
}
