use serde::Serialize;
use serde_json::Value;

use super::types::{ContentBlock, SessionUpdate, SessionUpdateDetail};
use crate::ai::cli::CLIChatMessage;

/// How an agent can continue a stored session: `session/resume` keeps quiet, while
/// `session/load` replays the history.
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

/// The way the agent of an `initialize` response continues sessions, if it can. A chat
/// that shows the history already prefers a quiet resume; one that needs it, a load.
pub fn continue_method(init_response: &Value, replay: bool) -> Option<ContinueMethod> {
    let capabilities = init_response.get("agentCapabilities")?;
    if !replay
        && capabilities
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

/// One message of a conversation an agent replayed while it loaded the session.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ReplayedMessage {
    pub role: &'static str,
    pub content: String,
}

/// The user and agent messages of a `session/load` replay, in order. Consecutive chunks of
/// one role form one message; thoughts, tool calls and other updates are left out.
pub fn replay_transcript(updates: &[Value], session_id: &str) -> Vec<ReplayedMessage> {
    let mut messages: Vec<ReplayedMessage> = Vec::new();
    for params in updates {
        let Ok(update) = serde_json::from_value::<SessionUpdate>(params.clone()) else {
            continue;
        };
        if update.session_id != session_id {
            continue;
        }
        let (role, content) = match update.update {
            SessionUpdateDetail::UserMessageChunk { content } => ("user", content),
            SessionUpdateDetail::AgentMessageChunk { content } => ("assistant", content),
            _ => continue,
        };
        let ContentBlock::Text { text } = content else {
            continue;
        };
        match messages.last_mut() {
            Some(last) if last.role == role => last.content.push_str(&text),
            _ => messages.push(ReplayedMessage {
                role,
                content: text,
            }),
        }
    }
    messages.retain(|message| !message.content.trim().is_empty());
    messages
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

        assert_eq!(continue_method(&both, false), Some(ContinueMethod::Resume));
        assert_eq!(continue_method(&both, true), Some(ContinueMethod::Load));
        assert_eq!(continue_method(&load, false), Some(ContinueMethod::Load));
        assert_eq!(continue_method(&none, false), None);
        assert_eq!(continue_method(&none, true), None);
        assert_eq!(continue_method(&Value::Null, false), None);
    }

    fn update(session_id: &str, kind: &str, text: &str) -> Value {
        json!({
            "sessionId": session_id,
            "update": { "sessionUpdate": kind, "content": { "type": "text", "text": text } }
        })
    }

    #[test]
    fn a_replay_becomes_the_chat_transcript() {
        let updates = vec![
            update("s1", "user_message_chunk", "Fix the "),
            update("s1", "user_message_chunk", "bug"),
            update("s1", "agent_thought_chunk", "thinking"),
            json!({ "sessionId": "s1", "update": {
                "sessionUpdate": "tool_call", "toolCallId": "t1", "title": "Read"
            }}),
            update("s1", "agent_message_chunk", "Done."),
            update("other", "agent_message_chunk", "not mine"),
            update("s1", "agent_message_chunk", "  "),
            update("s1", "user_message_chunk", "Thanks"),
        ];

        assert_eq!(
            replay_transcript(&updates, "s1"),
            vec![
                ReplayedMessage {
                    role: "user",
                    content: "Fix the bug".to_string()
                },
                ReplayedMessage {
                    role: "assistant",
                    content: "Done.  ".to_string()
                },
                ReplayedMessage {
                    role: "user",
                    content: "Thanks".to_string()
                },
            ]
        );
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
