//! A globally installed TypeScript 7 for files whose folder brings no TypeScript of its own.

use std::path::{Path, PathBuf};

/// The global `tsc` when it is TypeScript 7, whose `tsc --lsp` needs no project or `node_modules`.
/// A project with its own TypeScript keeps it, so its version decides what the editor reports.
pub(super) fn global_typescript_native_lsp(root: &Path, path: &str) -> Option<PathBuf> {
    if root.join("node_modules").join("typescript").exists() {
        return None;
    }
    let tsc = find_on_path("tsc", path)?;
    let package = typescript_package(&tsc)?;
    is_native(&package).then_some(tsc)
}

fn find_on_path(command: &str, path: &str) -> Option<PathBuf> {
    let names: Vec<String> = if cfg!(target_os = "windows") {
        vec![format!("{command}.cmd"), format!("{command}.exe")]
    } else {
        vec![command.to_string()]
    };
    std::env::split_paths(path)
        .flat_map(|dir| names.iter().map(move |name| dir.join(name)))
        .find(|candidate| candidate.is_file())
}

/// npm links `<prefix>/bin/tsc` to the package's `bin/tsc`; on Windows `<prefix>\tsc.cmd` sits
/// next to `<prefix>\node_modules\typescript`, and a local `node_modules\.bin\tsc.cmd` one level
/// below it.
fn typescript_package(tsc: &Path) -> Option<PathBuf> {
    let linked = tsc
        .canonicalize()
        .ok()
        .and_then(|target| Some(target.parent()?.parent()?.to_path_buf()));
    let beside = tsc
        .parent()
        .map(|dir| dir.join("node_modules").join("typescript"));
    let local_bin = tsc
        .parent()
        .and_then(Path::parent)
        .map(|node_modules| node_modules.join("typescript"));
    [linked, beside, local_bin]
        .into_iter()
        .flatten()
        .find(|package| package.join("package.json").is_file() && package.join("lib").is_dir())
}

/// TypeScript 7 ships the native compiler launcher and no `tsserver.js` to wrap.
fn is_native(package: &Path) -> bool {
    let lib = package.join("lib");
    lib.join("getExePath.js").is_file() && !lib.join("tsserver.js").exists()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pragma-global-ts-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn touch(path: &Path) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, "").unwrap();
    }

    /// A global npm prefix with TypeScript installed the way npm lays it out on this system.
    fn global_typescript(prefix: &Path, native: bool) -> PathBuf {
        let package = if cfg!(target_os = "windows") {
            prefix.join("node_modules/typescript")
        } else {
            prefix.join("lib/node_modules/typescript")
        };
        touch(&package.join("package.json"));
        touch(&package.join("bin/tsc"));
        if native {
            touch(&package.join("lib/getExePath.js"));
        } else {
            touch(&package.join("lib/tsserver.js"));
        }
        if cfg!(target_os = "windows") {
            touch(&prefix.join("tsc.cmd"));
            prefix.to_path_buf()
        } else {
            let bin = prefix.join("bin");
            fs::create_dir_all(&bin).unwrap();
            #[cfg(unix)]
            std::os::unix::fs::symlink(package.join("bin/tsc"), bin.join("tsc")).unwrap();
            bin
        }
    }

    fn path_of(dir: &Path) -> String {
        dir.to_string_lossy().to_string()
    }

    #[test]
    fn uses_a_global_typescript_7_for_a_folder_without_typescript() {
        let dir = temp_dir("native");
        let bin = global_typescript(&dir.join("prefix"), true);
        let root = dir.join("project");
        fs::create_dir_all(&root).unwrap();

        let tsc = global_typescript_native_lsp(&root, &path_of(&bin)).unwrap();
        assert!(tsc.starts_with(&bin));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn skips_a_global_typescript_with_tsserver() {
        let dir = temp_dir("tsserver");
        let bin = global_typescript(&dir.join("prefix"), false);
        let root = dir.join("project");
        fs::create_dir_all(&root).unwrap();

        assert_eq!(global_typescript_native_lsp(&root, &path_of(&bin)), None);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn keeps_the_typescript_of_the_project() {
        let dir = temp_dir("project-ts");
        let bin = global_typescript(&dir.join("prefix"), true);
        let root = dir.join("project");
        touch(&root.join("node_modules/typescript/package.json"));

        assert_eq!(global_typescript_native_lsp(&root, &path_of(&bin)), None);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn finds_a_typescript_7_installed_into_a_local_node_modules() {
        let dir = temp_dir("local-bin");
        let node_modules = dir.join("npm/node_modules");
        let package = node_modules.join("typescript");
        touch(&package.join("package.json"));
        touch(&package.join("bin/tsc"));
        touch(&package.join("lib/getExePath.js"));
        let bin = node_modules.join(".bin");
        if cfg!(target_os = "windows") {
            touch(&bin.join("tsc.cmd"));
        } else {
            fs::create_dir_all(&bin).unwrap();
            #[cfg(unix)]
            std::os::unix::fs::symlink(package.join("bin/tsc"), bin.join("tsc")).unwrap();
        }
        let root = dir.join("project");
        fs::create_dir_all(&root).unwrap();

        let tsc = global_typescript_native_lsp(&root, &path_of(&bin)).unwrap();
        assert!(tsc.starts_with(&bin));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn finds_nothing_without_a_global_tsc() {
        let dir = temp_dir("none");
        let root = dir.join("project");
        fs::create_dir_all(&root).unwrap();

        assert_eq!(global_typescript_native_lsp(&root, &path_of(&dir)), None);

        let _ = fs::remove_dir_all(&dir);
    }
}
