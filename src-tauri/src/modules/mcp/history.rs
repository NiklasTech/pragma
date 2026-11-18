//! What Pragma keeps about a server between status changes: the last error, whether it asked
//! for a sign-in and the tail of its log, so a failure still shows after the event has passed.

use crate::modules::mcp::McpServerStatus;
use serde::Serialize;
use std::collections::VecDeque;

const MAX_LOG_LINES: usize = 50;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct McpLogLine {
    pub timestamp: String,
    pub line: String,
}

#[derive(Debug, Clone, Default)]
pub struct McpServerHistory {
    pub error: Option<String>,
    pub auth_required: bool,
    pub log: VecDeque<McpLogLine>,
}

impl McpServerHistory {
    pub fn push_line(&mut self, timestamp: String, line: String) {
        self.log.push_back(McpLogLine { timestamp, line });
        while self.log.len() > MAX_LOG_LINES {
            self.log.pop_front();
        }
    }

    /// A start clears the last error; an error keeps its message and adds it to the log.
    pub fn record_status(
        &mut self,
        status: McpServerStatus,
        error: Option<&str>,
        auth_required: bool,
        timestamp: String,
    ) {
        match status {
            McpServerStatus::Starting => {
                self.error = None;
                self.auth_required = false;
                self.push_line(timestamp, "starting".to_string());
            }
            McpServerStatus::Running | McpServerStatus::Stopped => {
                self.error = None;
                self.auth_required = false;
            }
            McpServerStatus::Error => {
                let message = error.unwrap_or("failed").to_string();
                self.error = Some(message.clone());
                self.auth_required = auth_required;
                self.push_line(timestamp, message);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(n: usize) -> String {
        format!("t{n}")
    }

    #[test]
    fn keeps_the_last_lines_only() {
        let mut history = McpServerHistory::default();
        for n in 0..(MAX_LOG_LINES + 5) {
            history.push_line(at(n), format!("line {n}"));
        }
        assert_eq!(history.log.len(), MAX_LOG_LINES);
        assert_eq!(history.log.front().map(|l| l.line.as_str()), Some("line 5"));
    }

    #[test]
    fn an_error_stays_until_the_next_start() {
        let mut history = McpServerHistory::default();
        history.record_status(McpServerStatus::Starting, None, false, at(0));
        history.record_status(
            McpServerStatus::Error,
            Some("exited with code 1"),
            false,
            at(1),
        );
        assert_eq!(history.error.as_deref(), Some("exited with code 1"));
        let lines: Vec<&str> = history.log.iter().map(|l| l.line.as_str()).collect();
        assert_eq!(lines, vec!["starting", "exited with code 1"]);

        history.record_status(McpServerStatus::Starting, None, false, at(2));
        assert_eq!(history.error, None);
        assert_eq!(history.log.len(), 3);
    }

    #[test]
    fn remembers_a_sign_in_request() {
        let mut history = McpServerHistory::default();
        history.record_status(McpServerStatus::Error, Some("sign in"), true, at(0));
        assert!(history.auth_required);
        history.record_status(McpServerStatus::Running, None, false, at(1));
        assert!(!history.auth_required);
        assert_eq!(history.error, None);
    }
}
