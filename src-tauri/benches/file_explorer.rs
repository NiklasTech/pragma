use app_lib::modules::fs::list_directory;
use criterion::{criterion_group, criterion_main, Criterion};
use std::fs;
use std::path::PathBuf;

fn create_temp_dir_with_files(count: usize) -> PathBuf {
    let dir =
        std::env::temp_dir().join(format!("pragma_bench_file_explorer_{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();

    for i in 0..count {
        fs::write(dir.join(format!("file_{:04}.txt", i)), "content").unwrap();
    }

    dir
}

fn bench_list_directory(c: &mut Criterion) {
    let dir = create_temp_dir_with_files(1000);

    c.bench_function("list_directory 1000 files", |b| {
        b.iter(|| {
            let entries = list_directory(dir.to_string_lossy().to_string()).unwrap();
            assert_eq!(entries.len(), 1000);
        })
    });

    let _ = fs::remove_dir_all(&dir);
}

criterion_group!(benches, bench_list_directory);
criterion_main!(benches);
