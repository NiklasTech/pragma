pub(crate) fn resolve_cwd(cwd: Option<&str>, workspace_root: &str) -> String {
    match cwd {
        Some(path) if path.contains("${workspaceRoot}") => {
            path.replace("${workspaceRoot}", workspace_root)
        }
        Some(path) => path.to_string(),
        None => workspace_root.to_string(),
    }
}

pub(crate) fn parse_command(command: &str) -> (String, Vec<String>) {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return (String::new(), Vec::new());
    }

    let chars = trimmed.chars();
    let mut parts: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut quote_char = '\0';

    for c in chars {
        if in_quotes {
            if c == quote_char {
                in_quotes = false;
            } else {
                current.push(c);
            }
        } else if c == '"' || c == '\'' {
            in_quotes = true;
            quote_char = c;
        } else if c.is_whitespace() {
            if !current.is_empty() {
                parts.push(std::mem::take(&mut current));
            }
        } else {
            current.push(c);
        }
    }

    if !current.is_empty() {
        parts.push(current);
    }

    if parts.is_empty() {
        return (String::new(), Vec::new());
    }
    let program = parts.remove(0);
    (program, parts)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_command_respects_quotes() {
        let (program, args) = parse_command("node --foo \"bar baz\"");
        assert_eq!(program, "node");
        assert_eq!(args, vec!["--foo", "bar baz"]);
    }

    #[test]
    fn parse_command_empty_returns_empty() {
        let (program, args) = parse_command("   ");
        assert!(program.is_empty());
        assert!(args.is_empty());
    }
}
