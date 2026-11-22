//! Where the desktop puts the window buttons, so the drawn title bar matches it on Linux.

use serde::Serialize;

/// The window buttons on each side of the title bar, in the order the desktop shows them.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ButtonLayout {
    pub left: Vec<&'static str>,
    pub right: Vec<&'static str>,
}

impl Default for ButtonLayout {
    fn default() -> Self {
        Self {
            left: Vec::new(),
            right: vec!["minimize", "maximize", "close"],
        }
    }
}

#[cfg(any(target_os = "linux", test))]
fn gnome_button(name: &str) -> Option<&'static str> {
    match name.trim() {
        "minimize" => Some("minimize"),
        "maximize" => Some("maximize"),
        "close" => Some("close"),
        _ => None,
    }
}

/// Reads GNOME's `button-layout`, like `'appmenu:minimize,maximize,close'`.
#[cfg(any(target_os = "linux", test))]
fn parse_gnome(value: &str) -> Option<ButtonLayout> {
    let value = value.trim().trim_matches('\'');
    let (left, right) = value.split_once(':')?;
    let side = |part: &str| part.split(',').filter_map(gnome_button).collect::<Vec<_>>();
    let layout = ButtonLayout {
        left: side(left),
        right: side(right),
    };
    (!layout.left.is_empty() || !layout.right.is_empty()).then_some(layout)
}

#[cfg(any(target_os = "linux", test))]
fn kde_button(letter: char) -> Option<&'static str> {
    match letter {
        'I' => Some("minimize"),
        'A' => Some("maximize"),
        'X' => Some("close"),
        _ => None,
    }
}

/// Reads `ButtonsOnLeft` and `ButtonsOnRight` of the decoration section in KDE's kwinrc.
#[cfg(any(target_os = "linux", test))]
fn parse_kde(kwinrc: &str) -> Option<ButtonLayout> {
    let mut in_section = false;
    let mut left = None;
    let mut right = None;
    for line in kwinrc.lines().map(str::trim) {
        if line.starts_with('[') {
            in_section = line == "[org.kde.kdecoration2]";
            continue;
        }
        if !in_section {
            continue;
        }
        let side = |value: &str| value.chars().filter_map(kde_button).collect::<Vec<_>>();
        if let Some(value) = line.strip_prefix("ButtonsOnLeft=") {
            left = Some(side(value));
        } else if let Some(value) = line.strip_prefix("ButtonsOnRight=") {
            right = Some(side(value));
        }
    }
    if left.is_none() && right.is_none() {
        return None;
    }
    // KDE's defaults apply to the side kwinrc leaves out.
    Some(ButtonLayout {
        left: left.unwrap_or_default(),
        right: right.unwrap_or_else(|| vec!["minimize", "maximize", "close"]),
    })
}

#[cfg(target_os = "linux")]
fn desktop_layout() -> Option<ButtonLayout> {
    let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default();
    if desktop.to_ascii_uppercase().contains("KDE") {
        let home = std::env::var_os("HOME")?;
        let kwinrc = std::path::Path::new(&home).join(".config").join("kwinrc");
        return std::fs::read_to_string(kwinrc)
            .ok()
            .and_then(|text| parse_kde(&text));
    }
    let output = crate::platform::new_std_command("gsettings")
        .args(["get", "org.gnome.desktop.wm.preferences", "button-layout"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    parse_gnome(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(not(target_os = "linux"))]
fn desktop_layout() -> Option<ButtonLayout> {
    None
}

/// The window button layout of the desktop; minimize, maximize and close on the right when unknown.
#[tauri::command]
pub async fn window_button_layout() -> Result<ButtonLayout, String> {
    tauri::async_runtime::spawn_blocking(|| desktop_layout().unwrap_or_default())
        .await
        .map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gnome_layout_keeps_each_side_in_order() {
        assert_eq!(
            parse_gnome("'close,minimize,maximize:appmenu'\n"),
            Some(ButtonLayout {
                left: vec!["close", "minimize", "maximize"],
                right: vec![],
            })
        );
        assert_eq!(
            parse_gnome("'appmenu:close'"),
            Some(ButtonLayout {
                left: vec![],
                right: vec!["close"],
            })
        );
    }

    #[test]
    fn gnome_layout_without_buttons_or_separator_is_unknown() {
        assert_eq!(parse_gnome("'appmenu:'"), None);
        assert_eq!(parse_gnome("garbage"), None);
    }

    #[test]
    fn kde_layout_reads_the_decoration_section_only() {
        let kwinrc = "[Windows]\nButtonsOnLeft=X\n\n[org.kde.kdecoration2]\nButtonsOnLeft=XIA\nButtonsOnRight=HS\n";
        assert_eq!(
            parse_kde(kwinrc),
            Some(ButtonLayout {
                left: vec!["close", "minimize", "maximize"],
                right: vec![],
            })
        );
    }

    #[test]
    fn kde_layout_falls_back_to_defaults_for_a_missing_side() {
        assert_eq!(
            parse_kde("[org.kde.kdecoration2]\nButtonsOnLeft=M\n"),
            Some(ButtonLayout::default())
        );
        assert_eq!(parse_kde("[General]\nfoo=bar\n"), None);
    }
}
