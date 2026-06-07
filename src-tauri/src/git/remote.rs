use std::sync::atomic::{AtomicUsize, Ordering};

use git2::{AnnotatedCommit, Cred, FetchOptions, PushOptions, RemoteCallbacks, Repository};
use tauri::Emitter;

use super::map_git_error;

#[derive(Clone, serde::Serialize)]
pub struct GitProgressEvent {
    pub operation: String,
    pub stage: String,
    pub received_objects: usize,
    pub total_objects: usize,
    pub indexed_objects: usize,
    pub received_bytes: usize,
}

fn home_dir() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("USERPROFILE").map(std::path::PathBuf::from)
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var_os("HOME").map(std::path::PathBuf::from)
    }
}

#[derive(serde::Serialize)]
pub struct GitRemote {
    pub name: String,
    pub url: String,
}

#[derive(serde::Serialize)]
pub struct GitRemoteBranch {
    pub name: String,
    pub remote: String,
}

#[derive(serde::Serialize)]
pub struct GitPushResult {
    pub pushed: bool,
}

#[derive(serde::Serialize)]
pub struct GitPullResult {
    pub pulled: bool,
    pub had_conflicts: bool,
}

fn try_ssh_agent(username: Option<&str>) -> Result<Cred, git2::Error> {
    Cred::ssh_key_from_agent(username.unwrap_or("git"))
}

fn try_ssh_key_files(username: Option<&str>) -> Result<Cred, git2::Error> {
    let home = home_dir().ok_or_else(|| git2::Error::from_str("Home directory not found"))?;
    let ssh_dir = home.join(".ssh");

    let key_pairs = [
        ("id_ed25519", "id_ed25519.pub"),
        ("id_rsa", "id_rsa.pub"),
        ("id_ecdsa", "id_ecdsa.pub"),
    ];

    for (private_name, public_name) in key_pairs {
        let private = ssh_dir.join(private_name);
        let public = ssh_dir.join(public_name);

        if private.exists() {
            return Cred::ssh_key(username.unwrap_or("git"), Some(&public), &private, None);
        }
    }

    Err(git2::Error::from_str(
        "No SSH key files found in ~/.ssh/. Expected id_ed25519, id_rsa, or id_ecdsa.",
    ))
}

fn try_credential_helper(
    repo_path: &str,
    url: &str,
    username: Option<&str>,
) -> Result<Cred, git2::Error> {
    let repo = Repository::open(repo_path).map_err(|e| git2::Error::from_str(&e.message()))?;
    let cfg = repo
        .config()
        .map_err(|e| git2::Error::from_str(&e.message()))?;
    Cred::credential_helper(&cfg, url, username)
}

fn ssh_path_display() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "%USERPROFILE%\\.ssh\\"
    }
    #[cfg(not(target_os = "windows"))]
    {
        "~/.ssh/"
    }
}

fn diagnose_auth_failure() -> String {
    let ssh_auth_sock = std::env::var("SSH_AUTH_SOCK");
    let ssh_agent_available = ssh_auth_sock.is_ok();
    let has_ssh_keys = home_dir().as_ref().map_or(false, |h| {
        let ssh = h.join(".ssh");
        ["id_ed25519", "id_rsa", "id_ecdsa"]
            .iter()
            .any(|k| ssh.join(k).exists())
    });

    let ssh_path = ssh_path_display();

    if !ssh_agent_available && !has_ssh_keys {
        return format!(
            concat!(
                "No authentication method available. ",
                "No ssh-agent detected and no SSH keys found in {path}. ",
                "Options: (1) Generate an SSH key and add it to your Git host. ",
                "(2) Switch to HTTPS and configure a git credential helper."
            ),
            path = ssh_path
        );
    }

    if !ssh_agent_available && has_ssh_keys {
        return format!(
            concat!(
                "SSH keys found in {path} but ssh-agent is not accessible. ",
                "Ensure your SSH agent is running and the key is loaded, then restart Pragma. ",
                "Or use HTTPS with a credential helper instead."
            ),
            path = ssh_path
        );
    }

    if ssh_agent_available && !has_ssh_keys {
        return format!(
            concat!(
                "ssh-agent is running but no SSH key files were found in {path}. ",
                "Generate a key and add it to your agent."
            ),
            path = ssh_path
        );
    }

    concat!(
        "SSH authentication failed. ssh-agent is running and keys exist, ",
        "but the remote rejected all keys. ",
        "Verify the key is registered with your Git host (e.g. GitHub Settings -> SSH Keys)."
    )
    .to_string()
}

fn build_callbacks<'a>(
    repo_path: &str,
    app: Option<&tauri::AppHandle>,
    operation: &str,
) -> RemoteCallbacks<'a> {
    let mut callbacks = RemoteCallbacks::new();
    let repo_path = repo_path.to_string();
    let attempt = AtomicUsize::new(0);
    let op = operation.to_string();

    callbacks.credentials(move |url, username_from_url, allowed_types| {
        let count = attempt.fetch_add(1, Ordering::SeqCst);
        if count >= 2 {
            return Err(git2::Error::from_str(&diagnose_auth_failure()));
        }

        if allowed_types.contains(git2::CredentialType::SSH_KEY) {
            if let Ok(cred) = try_ssh_agent(username_from_url) {
                return Ok(cred);
            }
            if let Ok(cred) = try_ssh_key_files(username_from_url) {
                return Ok(cred);
            }
        }

        if allowed_types.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            if let Ok(cred) = try_credential_helper(&repo_path, url, username_from_url) {
                return Ok(cred);
            }
        }

        Err(git2::Error::from_str(
            "No matching credentials. Retrying with alternative method...",
        ))
    });

    if let Some(app_handle) = app {
        let app_clone = app_handle.clone();
        let op_clone = op.clone();
        callbacks.transfer_progress(move |stats| {
            let _ = app_clone.emit(
                "git:progress",
                GitProgressEvent {
                    operation: op_clone.clone(),
                    stage: if stats.received_objects() == stats.total_objects() {
                        "resolving".to_string()
                    } else {
                        "downloading".to_string()
                    },
                    received_objects: stats.received_objects(),
                    total_objects: stats.total_objects(),
                    indexed_objects: stats.indexed_objects(),
                    received_bytes: stats.received_bytes(),
                },
            );
            true
        });
    }

    callbacks
}

pub fn list_remotes(repo_path: &str) -> Result<Vec<GitRemote>, String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;
    let remotes = repo.remotes().map_err(map_git_error)?;

    let mut result = Vec::new();
    for name in remotes.iter().flatten() {
        if let Ok(remote) = repo.find_remote(name) {
            if let Some(url) = remote.url() {
                result.push(GitRemote {
                    name: name.to_string(),
                    url: url.to_string(),
                });
            }
        }
    }

    Ok(result)
}

pub fn list_remote_branches(
    repo_path: &str,
    remote_name: Option<String>,
) -> Result<Vec<GitRemoteBranch>, String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;
    let remote_name = remote_name.unwrap_or_else(|| "origin".to_string());

    let mut result = Vec::new();

    for branch_result in repo
        .branches(Some(git2::BranchType::Remote))
        .map_err(map_git_error)?
    {
        let (branch, _) = branch_result.map_err(map_git_error)?;
        if let Ok(Some(name)) = branch.name() {
            if name.starts_with(&format!("{}/", remote_name)) {
                let short_name = name
                    .strip_prefix(&format!("{}/", remote_name))
                    .unwrap_or(name);
                result.push(GitRemoteBranch {
                    name: short_name.to_string(),
                    remote: remote_name.clone(),
                });
            }
        }
    }

    Ok(result)
}

pub fn fetch(
    repo_path: &str,
    remote_name: Option<String>,
    branch_name: Option<String>,
    app: Option<&tauri::AppHandle>,
) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;
    let remote_name = remote_name.unwrap_or_else(|| "origin".to_string());

    let mut remote = repo.find_remote(&remote_name).map_err(map_git_error)?;

    let callbacks = build_callbacks(repo_path, app, "fetch");
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    let refspecs: Vec<&str> = match branch_name.as_deref() {
        Some(branch) => vec![branch],
        None => vec![],
    };

    remote
        .fetch(&refspecs, Some(&mut fetch_opts), None)
        .map_err(map_git_error)?;

    Ok(())
}

pub fn push(
    repo_path: &str,
    remote_name: Option<String>,
    branch_name: Option<String>,
    app: Option<&tauri::AppHandle>,
) -> Result<GitPushResult, String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;
    let remote_name = remote_name.unwrap_or_else(|| "origin".to_string());

    let branch = branch_name.unwrap_or_else(|| {
        repo.head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string()))
            .unwrap_or_else(|| "HEAD".to_string())
    });

    let refspec = format!("refs/heads/{0}:refs/heads/{0}", branch);

    let mut remote = repo.find_remote(&remote_name).map_err(map_git_error)?;

    let callbacks = build_callbacks(repo_path, app, "push");
    let mut push_opts = PushOptions::new();
    push_opts.remote_callbacks(callbacks);

    remote
        .push(&[&refspec], Some(&mut push_opts))
        .map_err(map_git_error)?;

    Ok(GitPushResult { pushed: true })
}

pub fn pull(
    repo_path: &str,
    remote_name: Option<String>,
    branch_name: Option<String>,
    rebase: bool,
    app: Option<&tauri::AppHandle>,
) -> Result<GitPullResult, String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;
    let remote_name = remote_name.unwrap_or_else(|| "origin".to_string());
    let branch_name = branch_name.unwrap_or_else(|| {
        repo.head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string()))
            .unwrap_or_else(|| "master".to_string())
    });

    // Fetch
    let mut remote = repo.find_remote(&remote_name).map_err(map_git_error)?;
    let callbacks = build_callbacks(repo_path, app, "pull");
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    remote
        .fetch(&[&branch_name], Some(&mut fetch_opts), None)
        .map_err(map_git_error)?;

    // Get fetch commit via FETCH_HEAD
    let fetch_head = repo.find_reference("FETCH_HEAD").map_err(map_git_error)?;
    let fetch_commit = repo
        .reference_to_annotated_commit(&fetch_head)
        .map_err(map_git_error)?;

    // Merge analysis
    let analysis = repo
        .merge_analysis(&[&fetch_commit])
        .map_err(map_git_error)?;

    if analysis.0.is_up_to_date() {
        return Ok(GitPullResult {
            pulled: false,
            had_conflicts: false,
        });
    }

    if analysis.0.is_fast_forward() {
        return do_fast_forward(&repo, &fetch_commit, &branch_name);
    }

    if analysis.0.is_normal() {
        let head_commit = repo
            .reference_to_annotated_commit(&repo.head().map_err(map_git_error)?)
            .map_err(map_git_error)?;

        if rebase {
            return do_rebase(&repo, &head_commit, &fetch_commit);
        }
        return do_merge(&repo, &head_commit, &fetch_commit);
    }

    Ok(GitPullResult {
        pulled: false,
        had_conflicts: false,
    })
}

fn do_fast_forward(
    repo: &Repository,
    rc: &AnnotatedCommit,
    branch_name: &str,
) -> Result<GitPullResult, String> {
    let refname = format!("refs/heads/{}", branch_name);

    match repo.find_reference(&refname) {
        Ok(mut r) => {
            r.set_target(
                rc.id(),
                &format!("Fast-Forward: Setting {} to {}", refname, rc.id()),
            )
            .map_err(map_git_error)?;
        }
        Err(_) => {
            repo.reference(
                &refname,
                rc.id(),
                true,
                &format!("Setting {} to {}", refname, rc.id()),
            )
            .map_err(map_git_error)?;
        }
    }

    repo.set_head(&refname).map_err(map_git_error)?;

    let mut checkout_opts = git2::build::CheckoutBuilder::new();
    checkout_opts.force();
    repo.checkout_head(Some(&mut checkout_opts))
        .map_err(map_git_error)?;

    Ok(GitPullResult {
        pulled: true,
        had_conflicts: false,
    })
}

fn do_rebase(
    repo: &Repository,
    local: &AnnotatedCommit,
    remote: &AnnotatedCommit,
) -> Result<GitPullResult, String> {
    let mut rebase = repo
        .rebase(Some(local), Some(remote), None, None)
        .map_err(map_git_error)?;

    while let Some(op) = rebase.next() {
        let _ = op.map_err(map_git_error)?;

        let index = repo.index().map_err(map_git_error)?;
        if index.has_conflicts() {
            rebase.abort().ok();
            return Ok(GitPullResult {
                pulled: false,
                had_conflicts: true,
            });
        }
    }

    rebase.finish(None).map_err(map_git_error)?;

    Ok(GitPullResult {
        pulled: true,
        had_conflicts: false,
    })
}

fn do_merge(
    repo: &Repository,
    local: &AnnotatedCommit,
    remote: &AnnotatedCommit,
) -> Result<GitPullResult, String> {
    let local_tree = repo
        .find_commit(local.id())
        .map_err(map_git_error)?
        .tree()
        .map_err(map_git_error)?;
    let remote_tree = repo
        .find_commit(remote.id())
        .map_err(map_git_error)?
        .tree()
        .map_err(map_git_error)?;

    let ancestor_oid = repo
        .merge_base(local.id(), remote.id())
        .map_err(map_git_error)?;
    let ancestor = repo
        .find_commit(ancestor_oid)
        .map_err(map_git_error)?
        .tree()
        .map_err(map_git_error)?;

    let mut idx = repo
        .merge_trees(&ancestor, &local_tree, &remote_tree, None)
        .map_err(map_git_error)?;

    if idx.has_conflicts() {
        repo.checkout_index(Some(&mut idx), None)
            .map_err(map_git_error)?;
        return Ok(GitPullResult {
            pulled: false,
            had_conflicts: true,
        });
    }

    let result_tree = repo
        .find_tree(idx.write_tree_to(repo).map_err(map_git_error)?)
        .map_err(map_git_error)?;

    let sig = repo.signature().map_err(map_git_error)?;
    let local_commit = repo.find_commit(local.id()).map_err(map_git_error)?;
    let remote_commit = repo.find_commit(remote.id()).map_err(map_git_error)?;

    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &format!("Merge remote-tracking branch '{}'", remote.id()),
        &result_tree,
        &[&local_commit, &remote_commit],
    )
    .map_err(map_git_error)?;

    repo.checkout_head(None).map_err(map_git_error)?;

    Ok(GitPullResult {
        pulled: true,
        had_conflicts: false,
    })
}
