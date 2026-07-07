#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

const VERSION: &str = env!("CARGO_PKG_VERSION");

fn print_version() {
    println!("{VERSION}");
}

fn print_help() {
    println!("Pragma IDE");
    println!();
    println!("Usage: pragma [OPTIONS] [PATH]");
    println!();
    println!("Arguments:");
    println!("  [PATH]  Project folder to open");
    println!();
    println!("Options:");
    println!("  -v, --version  Print version");
    println!("  -h, --help     Print help");
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|arg| arg == "--version" || arg == "-v") {
        print_version();
        return;
    }
    if args.iter().any(|arg| arg == "--help" || arg == "-h") {
        print_help();
        return;
    }
    app_lib::run();
}
