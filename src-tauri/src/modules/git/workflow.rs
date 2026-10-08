use crate::modules::git::operations::{self, GitOperationKind, GitTag};
use crate::modules::git::types::{
    GitCommitFileChange, GitDiffContentResult, GitLogEntry, GitMergeResult,
};

async fn blocking<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce() -> Result<T, String> + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

fn require(value: &str, message: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(message.to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn git_merge_branch(
    repo_path: String,
    branch_name: String,
    no_ff: Option<bool>,
) -> Result<GitMergeResult, String> {
    require(&repo_path, "Repository path is required")?;
    require(&branch_name, "Branch name is required")?;
    blocking(move || {
        operations::merge_branch(&repo_path, &branch_name, no_ff.unwrap_or(false))
            .map_err(Into::into)
    })
    .await
}

#[tauri::command]
pub async fn git_rebase_branch(repo_path: String, onto: String) -> Result<GitMergeResult, String> {
    require(&repo_path, "Repository path is required")?;
    require(&onto, "Branch name is required")?;
    blocking(move || operations::rebase_branch(&repo_path, &onto).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_operation_state(repo_path: String) -> Result<Option<GitOperationKind>, String> {
    require(&repo_path, "Repository path is required")?;
    blocking(move || operations::operation_state(&repo_path).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_continue_operation(repo_path: String) -> Result<GitMergeResult, String> {
    require(&repo_path, "Repository path is required")?;
    blocking(move || operations::continue_operation(&repo_path).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_abort_operation(repo_path: String) -> Result<(), String> {
    require(&repo_path, "Repository path is required")?;
    blocking(move || operations::abort_operation(&repo_path).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_rename_branch(
    repo_path: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    require(&repo_path, "Repository path is required")?;
    require(&old_name, "Branch name is required")?;
    require(&new_name, "New branch name is required")?;
    blocking(move || {
        operations::rename_branch(&repo_path, &old_name, new_name.trim()).map_err(Into::into)
    })
    .await
}

#[tauri::command]
pub async fn git_tags(repo_path: String) -> Result<Vec<GitTag>, String> {
    require(&repo_path, "Repository path is required")?;
    blocking(move || operations::list_tags(&repo_path).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_create_tag(
    repo_path: String,
    name: String,
    target: Option<String>,
    message: Option<String>,
) -> Result<(), String> {
    require(&repo_path, "Repository path is required")?;
    require(&name, "Tag name is required")?;
    blocking(move || {
        operations::create_tag(
            &repo_path,
            name.trim(),
            target.as_deref(),
            message.as_deref(),
        )
        .map_err(Into::into)
    })
    .await
}

#[tauri::command]
pub async fn git_delete_tag(repo_path: String, name: String) -> Result<(), String> {
    require(&repo_path, "Repository path is required")?;
    require(&name, "Tag name is required")?;
    blocking(move || operations::delete_tag(&repo_path, &name).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_compare_files(
    repo_path: String,
    base: String,
    head: String,
) -> Result<Vec<GitCommitFileChange>, String> {
    require(&repo_path, "Repository path is required")?;
    require(&base, "Base revision is required")?;
    require(&head, "Compared revision is required")?;
    blocking(move || operations::compare_files(&repo_path, &base, &head).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_compare_file_diff(
    repo_path: String,
    base: String,
    head: String,
    path: String,
    original_path: Option<String>,
) -> Result<GitDiffContentResult, String> {
    require(&repo_path, "Repository path is required")?;
    require(&base, "Base revision is required")?;
    require(&head, "Compared revision is required")?;
    require(&path, "File path is required")?;
    blocking(move || {
        operations::compare_file_diff(&repo_path, &base, &head, &path, original_path.as_deref())
            .map_err(Into::into)
    })
    .await
}

#[tauri::command]
pub async fn git_file_history(
    repo_path: String,
    path: String,
    limit: Option<u32>,
) -> Result<Vec<GitLogEntry>, String> {
    require(&repo_path, "Repository path is required")?;
    require(&path, "File path is required")?;
    blocking(move || {
        operations::file_history(&repo_path, &path, limit.unwrap_or(100)).map_err(Into::into)
    })
    .await
}
