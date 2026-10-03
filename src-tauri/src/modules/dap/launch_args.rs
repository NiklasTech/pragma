//! Launch and attach arguments for Delve (Go) and java-debug (Java), built from
//! a run config command that was already split into program + args.

use crate::platform::resolve_program;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::Read;
use std::path::Path;

const DEFAULT_JDWP_PORT: u16 = 5005;
const JAVA_ATTACH_TIMEOUT_MS: u64 = 30_000;
// `go build` flags whose value is the next token.
const GO_VALUE_FLAGS: [&str; 14] = [
    "-tags",
    "-ldflags",
    "-gcflags",
    "-asmflags",
    "-mod",
    "-modfile",
    "-overlay",
    "-pgo",
    "-p",
    "-pkgdir",
    "-toolexec",
    "-exec",
    "-coverpkg",
    "-covermode",
];
// `java` launcher options whose value is the next token.
const JAVA_VALUE_OPTIONS: [&str; 5] = [
    "--add-modules",
    "--add-opens",
    "--add-exports",
    "--add-reads",
    "--enable-native-access",
];

fn is_tool(program: &str, tool: &str) -> bool {
    Path::new(program)
        .file_stem()
        .is_some_and(|stem| stem.eq_ignore_ascii_case(tool))
}

fn absolute(path: &str, cwd: &str) -> String {
    if path == "." {
        return cwd.to_string();
    }
    let candidate = Path::new(path);
    if candidate.is_absolute() {
        path.to_string()
    } else {
        Path::new(cwd).join(candidate).to_string_lossy().to_string()
    }
}

/// `go test` passes test flags to the test binary, which expects `-test.` names.
fn test_binary_flag(arg: &str) -> String {
    match arg.strip_prefix('-') {
        Some(flag) if !flag.starts_with('-') && !flag.starts_with("test.") => {
            format!("-test.{flag}")
        }
        _ => arg.to_string(),
    }
}

/// Delve launches `go run <pkg>`, `go test <pkg>` or a compiled binary.
pub(super) fn build_go_arguments(
    request: &str,
    name: &str,
    program: &str,
    args: &[String],
    cwd: &str,
    env: &HashMap<String, String>,
) -> Result<Value, String> {
    if request != "launch" {
        return Err("The go adapter supports launch only".to_string());
    }
    if program.is_empty() {
        return Err("Go debug requires 'go run', 'go test' or a compiled binary".to_string());
    }

    if !is_tool(program, "go") {
        return Ok(json!({
            "type": "go",
            "request": "launch",
            "name": name,
            "mode": "exec",
            "program": absolute(program, cwd),
            "args": args,
            "cwd": cwd,
            "env": env,
        }));
    }

    let mode =
        match args.first().map(String::as_str) {
            Some("run") => "debug",
            Some("test") => "test",
            _ => return Err(
                "Go debug supports 'go run <package>', 'go test <package>' or a compiled binary"
                    .to_string(),
            ),
        };

    let rest = &args[1..];
    let mut build_flags: Vec<String> = Vec::new();
    let mut index = 0;
    while let Some(arg) = rest.get(index).filter(|arg| arg.starts_with('-')) {
        build_flags.push(arg.clone());
        if GO_VALUE_FLAGS.contains(&arg.as_str()) {
            index += 1;
            if let Some(value) = rest.get(index) {
                build_flags.push(value.clone());
            }
        }
        index += 1;
    }

    let target = rest.get(index).map(String::as_str).unwrap_or(".");
    index += 1;
    // `go run main.go util.go` lists the package's files; Delve takes one of them.
    while rest.get(index).is_some_and(|arg| arg.ends_with(".go")) {
        index += 1;
    }
    let program_args: Vec<String> = rest
        .get(index..)
        .unwrap_or_default()
        .iter()
        .map(|arg| {
            if mode == "test" {
                test_binary_flag(arg)
            } else {
                arg.clone()
            }
        })
        .collect();

    Ok(json!({
        "type": "go",
        "request": "launch",
        "name": name,
        "mode": mode,
        "program": absolute(target, cwd),
        "args": program_args,
        "buildFlags": build_flags.join(" "),
        "cwd": cwd,
        "env": env,
    }))
}

fn quote_arg(arg: &str) -> String {
    if arg.chars().any(char::is_whitespace) {
        format!("\"{arg}\"")
    } else {
        arg.to_string()
    }
}

fn join_args(args: &[String]) -> String {
    args.iter()
        .map(|arg| quote_arg(arg))
        .collect::<Vec<_>>()
        .join(" ")
}

/// The JDWP port from `-agentlib:jdwp=...,address=*:5005`, if the command has one.
fn jdwp_port(args: &[String]) -> Option<u16> {
    args.iter()
        .filter(|arg| arg.starts_with("-agentlib:jdwp=") || arg.starts_with("-Xrunjdwp:"))
        .flat_map(|arg| arg.split(','))
        .find_map(|option| option.split_once("address="))
        .and_then(|(_, address)| address.rsplit(':').next()?.parse().ok())
}

/// `Main-Class` from the jar manifest; continuation lines start with a space.
fn jar_main_class(jar: &Path) -> Result<String, String> {
    let file =
        std::fs::File::open(jar).map_err(|e| format!("Cannot open {}: {e}", jar.display()))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Invalid jar {}: {e}", jar.display()))?;
    let mut manifest = String::new();
    archive
        .by_name("META-INF/MANIFEST.MF")
        .map_err(|_| format!("{} has no manifest", jar.display()))?
        .read_to_string(&mut manifest)
        .map_err(|e| format!("Cannot read the manifest of {}: {e}", jar.display()))?;
    let unfolded = manifest.replace("\r\n", "\n").replace("\n ", "");
    unfolded
        .lines()
        .find_map(|line| line.strip_prefix("Main-Class:"))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("{} has no Main-Class in its manifest", jar.display()))
}

fn split_class_path(value: &str, cwd: &str) -> Vec<String> {
    std::env::split_paths(value)
        .map(|path| absolute(&path.to_string_lossy(), cwd))
        .collect()
}

/// java-debug launches `java [options] -cp <classpath> <MainClass> [args]` or
/// `java [options] -jar <jar> [args]`; attach connects to a JDWP port.
pub(super) fn build_java_arguments(
    request: &str,
    name: &str,
    program: &str,
    args: &[String],
    cwd: &str,
    env: &HashMap<String, String>,
) -> Result<Value, String> {
    if request == "attach" {
        return Ok(json!({
            "type": "java",
            "request": "attach",
            "name": name,
            "hostName": "localhost",
            "port": jdwp_port(args).unwrap_or(DEFAULT_JDWP_PORT),
            "timeout": JAVA_ATTACH_TIMEOUT_MS,
        }));
    }
    if !is_tool(program, "java") {
        return Err(
            "Java debug requires a 'java' command (e.g. 'java -cp target/classes com.example.Main')"
                .to_string(),
        );
    }

    let mut vm_args: Vec<String> = Vec::new();
    let mut class_paths: Vec<String> = Vec::new();
    let mut module_paths: Vec<String> = Vec::new();
    let mut main_class: Option<String> = None;
    let mut index = 0;
    while main_class.is_none() {
        let Some(arg) = args.get(index) else { break };
        let value = args.get(index + 1);
        match arg.as_str() {
            "-cp" | "-classpath" | "--class-path" => {
                let value = value.ok_or_else(|| format!("'{arg}' needs a value"))?;
                class_paths.extend(split_class_path(value, cwd));
                index += 1;
            }
            "-p" | "--module-path" => {
                let value = value.ok_or_else(|| format!("'{arg}' needs a value"))?;
                module_paths.extend(split_class_path(value, cwd));
                index += 1;
            }
            "-jar" => {
                let jar = absolute(value.ok_or("'-jar' needs a jar file")?, cwd);
                main_class = Some(jar_main_class(Path::new(&jar))?);
                class_paths.push(jar);
                index += 1;
            }
            "-m" | "--module" => {
                main_class = Some(
                    value
                        .ok_or_else(|| format!("'{arg}' needs a value"))?
                        .clone(),
                );
                index += 1;
            }
            option if JAVA_VALUE_OPTIONS.contains(&option) => {
                vm_args.push(arg.clone());
                if let Some(value) = value {
                    vm_args.push(value.clone());
                }
                index += 1;
            }
            option if option.starts_with('-') => vm_args.push(arg.clone()),
            source if source.ends_with(".java") => {
                return Err(
                    "Java debug needs compiled classes; single-file source launch is not supported"
                        .to_string(),
                )
            }
            class => main_class = Some(class.to_string()),
        }
        index += 1;
    }

    let main_class = main_class.ok_or_else(|| {
        "Java debug requires a main class (e.g. 'java -cp target/classes com.example.Main')"
            .to_string()
    })?;
    if class_paths.is_empty() && module_paths.is_empty() {
        class_paths.push(cwd.to_string());
    }

    let mut value = json!({
        "type": "java",
        "request": "launch",
        "name": name,
        "mainClass": main_class,
        "classPaths": class_paths,
        "modulePaths": module_paths,
        "args": join_args(args.get(index..).unwrap_or_default()),
        "vmArgs": join_args(&vm_args),
        "cwd": cwd,
        "env": env,
        "console": "internalConsole",
        "stopOnEntry": false,
    });
    if let (Ok(java), Some(obj)) = (resolve_program(program), value.as_object_mut()) {
        obj.insert(
            "javaExec".to_string(),
            json!(java.to_string_lossy().to_string()),
        );
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| v.to_string()).collect()
    }

    fn under_ws(relative: &str) -> String {
        Path::new("/ws")
            .join(relative)
            .to_string_lossy()
            .to_string()
    }

    fn go(args: &[&str]) -> Result<Value, String> {
        build_go_arguments(
            "launch",
            "app",
            "go",
            &strings(args),
            "/ws",
            &HashMap::new(),
        )
    }

    #[test]
    fn go_run_debugs_the_package_with_build_flags_and_args() {
        let value = go(&["run", "-tags", "dev", "-race", "./cmd/api", "--port", "80"]).unwrap();
        assert_eq!(value["mode"], "debug");
        assert_eq!(value["program"], under_ws("./cmd/api"));
        assert_eq!(value["buildFlags"], "-tags dev -race");
        assert_eq!(value["args"], json!(["--port", "80"]));
    }

    #[test]
    fn go_run_dot_uses_the_cwd() {
        let value = go(&["run", "."]).unwrap();
        assert_eq!(value["program"], "/ws");
        assert_eq!(value["args"], json!([]));
    }

    #[test]
    fn go_run_with_files_skips_the_extra_files() {
        let value = go(&["run", "main.go", "util.go", "serve"]).unwrap();
        assert_eq!(value["program"], under_ws("main.go"));
        assert_eq!(value["args"], json!(["serve"]));
    }

    #[test]
    fn go_test_prefixes_test_flags() {
        let value = go(&["test", "./pkg/store", "-run", "TestSave", "-v"]).unwrap();
        assert_eq!(value["mode"], "test");
        assert_eq!(value["args"], json!(["-test.run", "TestSave", "-test.v"]));
    }

    #[test]
    fn go_binary_is_launched_in_exec_mode() {
        let value = build_go_arguments(
            "launch",
            "bin",
            "bin/server",
            &strings(&["-v"]),
            "/ws",
            &HashMap::new(),
        )
        .unwrap();
        assert_eq!(value["mode"], "exec");
        assert_eq!(value["program"], under_ws("bin/server"));
    }

    #[test]
    fn go_rejects_attach_and_other_subcommands() {
        assert!(go(&["build", "."]).is_err());
        assert!(build_go_arguments("attach", "x", "go", &[], "/ws", &HashMap::new()).is_err());
    }

    fn java(args: &[&str]) -> Result<Value, String> {
        build_java_arguments(
            "launch",
            "app",
            "java",
            &strings(args),
            "/ws",
            &HashMap::new(),
        )
    }

    #[test]
    fn java_launch_splits_vm_args_classpath_main_class_and_args() {
        let value = java(&[
            "-Xmx512m",
            "-cp",
            "target/classes",
            "com.example.Main",
            "hello world",
            "-x",
        ])
        .unwrap();
        assert_eq!(value["mainClass"], "com.example.Main");
        assert_eq!(value["classPaths"], json!([under_ws("target/classes")]));
        assert_eq!(value["vmArgs"], "-Xmx512m");
        assert_eq!(value["args"], "\"hello world\" -x");
        assert_eq!(value["console"], "internalConsole");
    }

    #[test]
    fn java_without_classpath_uses_the_cwd() {
        let value = java(&["Main"]).unwrap();
        assert_eq!(value["classPaths"], json!(["/ws"]));
    }

    #[test]
    fn java_jar_reads_the_main_class_from_the_manifest() {
        let tmp = tempfile::tempdir().unwrap();
        let jar = tmp.path().join("app.jar");
        let mut writer = zip::ZipWriter::new(std::fs::File::create(&jar).unwrap());
        writer
            .start_file(
                "META-INF/MANIFEST.MF",
                zip::write::SimpleFileOptions::default(),
            )
            .unwrap();
        writer
            .write_all(b"Manifest-Version: 1.0\r\nMain-Class: com.example.Ve\r\n ryLongMain\r\n")
            .unwrap();
        writer.finish().unwrap();

        let cwd = tmp.path().to_str().unwrap();
        let value = build_java_arguments(
            "launch",
            "app",
            "java",
            &strings(&["-jar", "app.jar", "serve"]),
            cwd,
            &HashMap::new(),
        )
        .unwrap();
        assert_eq!(value["mainClass"], "com.example.VeryLongMain");
        assert_eq!(value["args"], "serve");
    }

    #[test]
    fn java_rejects_source_files_and_other_programs() {
        assert!(java(&["Main.java"]).is_err());
        assert!(java(&["-cp", "out"]).is_err());
        assert!(build_java_arguments("launch", "x", "mvn", &[], "/ws", &HashMap::new()).is_err());
    }

    #[test]
    fn java_attach_reads_the_jdwp_port() {
        let value = build_java_arguments(
            "attach",
            "app",
            "java",
            &strings(&[
                "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:8000",
                "-jar",
                "app.jar",
            ]),
            "/ws",
            &HashMap::new(),
        )
        .unwrap();
        assert_eq!(value["port"], 8000);
        let value =
            build_java_arguments("attach", "app", "mvn", &[], "/ws", &HashMap::new()).unwrap();
        assert_eq!(value["port"], 5005);
    }
}
