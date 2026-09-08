use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if app.webview_windows().is_empty() {
                    tauri::WebviewWindowBuilder::new(
                        app,
                        "main",
                        tauri::WebviewUrl::External("http://localhost:5173".parse().unwrap())
                    )
                    .title("Salve")
                    .inner_size(1200.0, 700.0)
                    .position(100.0, 100.0)
                    .decorations(true)
                    .resizable(true)
                    .build()?;
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
