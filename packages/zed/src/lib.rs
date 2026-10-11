use zed_extension_api as zed;

struct WallTheme;

impl zed::Extension for WallTheme {
    fn new() -> Self {
        // Zed forwards extension stdout to its process. Run Zed with
        // --foreground to see this greeting in the launching terminal.
        println!("Hi");
        Self
    }
}

zed::register_extension!(WallTheme);
