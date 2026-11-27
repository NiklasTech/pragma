use serde_json::Value;

use crate::ai::cli::CLIChatMessage;

/// How an agent can continue a stored session: `session/resume` keeps quiet, while
/// `session/load` replays the history, which the chat already shows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContinueMethod {
    Resume,
    Load,
}

impl ContinueMethod {
    pub fn rpc_method(self) -> &'static str {
        match self {
            Self::Resume => "session/resume",
            Self::Load => "session/load",
        }
    }
}

/// The way the agent of an `initialize` response continues sessions, if it can.
pub fn continue_method(init_response: &Value) -> Option<ContinueMethod> {
    let capabilities = init_response.get("agentCapabilities")?;
    if capabilities
        .pointer("/sessionCapabilities/resume")
        .is_some_and(|resume| !resume.is_null())
    {
        return Some(ContinueMethod::Resume);
    }
    capabilities
        .get("loadSession")
        .and_then(Value::as_bool)
        .filter(|load| *load)
        .map(|_| ContinueMethod::Load)
}

/// The texts of a prompt. A session that knows the conversation gets only the newest user
/// message; a new session of a chat with history gets everything, so it knows the context.
pub fn prompt_texts(messages: Vec<CLIChatMessage>, with_history: bool) -> Vec<String> {
    if with_history {
        return messages
            .into_iter()
            .map(|message| message.content)
            .collect();
    }
    messages
        .into_iter()
        .rev()
        .find(|message| message.role == "user")
        .map(|message| vec![message.content])
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn message(role: &str, content: &str) -> CLIChatMessage {
        CLIChatMessage {
            role: role.to_string(),
            content: content.to_string(),
        }
    }

    #[test]
    fn prefers_resume_over_load() {
        let both = json!({ "agentCapabilities": {
            "loadSession": true,
            "sessionCapabilities": { "resume": {} }
        }});
        let load = json!({ "agentCapabilities": { "loadSession": true } });
        let none = json!({ "agentCapabilities": { "loadSession": false } });

        assert_eq!(continue_method(&both), Some(ContinueMethod::Resume));
        assert_eq!(continue_method(&load), Some(ContinueMethod::Load));
        assert_eq!(continue_method(&none), None);
        assert_eq!(continue_method(&Value::Null), None);
    }

    #[test]
    fn a_session_that_knows_the_chat_gets_only_the_newest_user_message() {
        let messages = vec![
            message("system", "rules"),
            message("user", "first"),
            message("assistant", "answer"),
            message("user", "second"),
        ];

        assert_eq!(prompt_texts(messages.clone(), false), vec!["second"]);
        assert_eq!(
            prompt_texts(messages, true),
            vec!["rules", "first", "answer", "second"]
        );
    }
}
