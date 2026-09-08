fn main() {
    tauri_build::try_build(tauri_build::Attributes::new())
        .expect("failed to run tauri-build");
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=../src");
    println!("cargo:rerun-if-changed=icons");
}
