use futures_util::StreamExt;

use crate::ai::{
    config::ProviderConfig,
    error::AIError,
    provider::{
        AIProvider, BoxFuture, CompletionChunk, CompletionRequest, CompletionResponse,
        FunctionCall, ModelInfo, ToolCall, Usage,
    },
};

use super::error::{map_anthropic_error, map_reqwest_error};
use super::provider::{AnthropicProvider, MESSAGES_PATH, MODELS_PATH};
use super::request::AnthropicRequestBody;
use super::response::{AnthropicContent, AnthropicResponse};
use super::stream::{
    send_tool_call_chunk, AnthropicContentBlock, AnthropicCurrentBlock, AnthropicDelta,
    AnthropicStreamEvent,
};

impl AIProvider for AnthropicProvider {
    fn name(&self) -> &'static str {
        "anthropic"
    }

    fn config(&self) -> &ProviderConfig {
        &self.config
    }

    fn models(&self) -> Vec<ModelInfo> {
        Vec::new()
    }

    fn list_models(&self) -> BoxFuture<'_, Result<Vec<ModelInfo>, AIError>> {
        Box::pin(async move {
            let url = format!("{}{}", self.base_url(), MODELS_PATH);
            let response = self
                .client
                .get(&url)
                .send()
                .await
                .map_err(map_reqwest_error)?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_anthropic_error(status, &text));
            }

            let body: serde_json::Value = response
                .json()
                .await
                .map_err(|e| AIError::Serialization(e.to_string()))?;

            let models = body
                .get("data")
                .and_then(|d| d.as_array())
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|m| {
                    let id = m.get("id").and_then(|id| id.as_str())?;
                    let name = m.get("display_name").and_then(|n| n.as_str()).unwrap_or(id);
                    Some(ModelInfo {
                        id: id.to_string(),
                        name: name.to_string(),
                        context_window: None,
                        supports_streaming: true,
                        supports_vision: true,
                    })
                })
                .collect();

            Ok(models)
        })
    }

    fn complete(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<CompletionResponse, AIError>> {
        Box::pin(async move {
            self.validate_model()?;

            let (system, messages, temperature, max_tokens) = self.split_messages(req.messages);
            let body = AnthropicRequestBody::from_completion_request(
                &self.config.model,
                system,
                messages,
                temperature,
                max_tokens,
                req.tools.clone(),
            );
            let url = format!("{}{}", self.base_url(), MESSAGES_PATH);

            let response = self
                .client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(map_reqwest_error)?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_anthropic_error(status, &text));
            }

            let anthropic_resp: AnthropicResponse = response
                .json()
                .await
                .map_err(|e| AIError::Serialization(e.to_string()))?;

            let mut content = String::new();
            let mut tool_calls = Vec::new();
            for block in anthropic_resp.content {
                match block {
                    AnthropicContent::Text { text } => content.push_str(&text),
                    AnthropicContent::ToolUse { id, name, input } => {
                        tool_calls.push(ToolCall {
                            id,
                            r#type: "function".to_string(),
                            function: FunctionCall {
                                name,
                                arguments: input.to_string(),
                            },
                        });
                    }
                }
            }

            Ok(CompletionResponse {
                content,
                model: anthropic_resp.model,
                usage: anthropic_resp.usage.map(|u| Usage {
                    prompt_tokens: u.input_tokens,
                    completion_tokens: u.output_tokens,
                    total_tokens: u.input_tokens + u.output_tokens,
                }),
                tool_calls: if tool_calls.is_empty() {
                    None
                } else {
                    Some(tool_calls)
                },
                finish_reason: Some("stop".to_string()),
            })
        })
    }

    fn stream(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<Vec<CompletionChunk>, AIError>> {
        Box::pin(async move {
            self.validate_model()?;

            let (system, messages, temperature, max_tokens) = self.split_messages(req.messages);
            let mut body = AnthropicRequestBody::from_completion_request(
                &self.config.model,
                system,
                messages,
                temperature,
                max_tokens,
                req.tools.clone(),
            );
            body.stream = true;

            let url = format!("{}{}", self.base_url(), MESSAGES_PATH);

            let response = self
                .client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(map_reqwest_error)?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_anthropic_error(status, &text));
            }

            let bytes = response
                .bytes()
                .await
                .map_err(|e| AIError::Network(e.to_string()))?;
            let text = String::from_utf8_lossy(&bytes);

            let mut chunks = Vec::new();
            let mut current_block: Option<AnthropicCurrentBlock> = None;
            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }

                if let Some(data) = line.strip_prefix("data: ") {
                    if data == "[DONE]" {
                        continue;
                    }

                    let event: AnthropicStreamEvent = serde_json::from_str(data)
                        .map_err(|e| AIError::Stream(format!("invalid sse event: {e}")))?;

                    match event {
                        AnthropicStreamEvent::ContentBlockStart { content_block } => {
                            current_block = Some(match content_block {
                                AnthropicContentBlock::Text => AnthropicCurrentBlock::Text,
                                AnthropicContentBlock::ToolUse { id, name } => {
                                    AnthropicCurrentBlock::ToolUse {
                                        id,
                                        name,
                                        input: String::new(),
                                    }
                                }
                            });
                        }
                        AnthropicStreamEvent::ContentBlockDelta { delta } => match delta {
                            AnthropicDelta::TextDelta { text } => {
                                if !text.is_empty() {
                                    chunks.push(CompletionChunk {
                                        content: text,
                                        finish_reason: None,
                                        tool_calls: None,
                                    });
                                }
                            }
                            AnthropicDelta::InputJsonDelta { partial_json } => {
                                if let Some(AnthropicCurrentBlock::ToolUse { input, .. }) =
                                    &mut current_block
                                {
                                    input.push_str(&partial_json);
                                }
                            }
                        },
                        AnthropicStreamEvent::ContentBlockStop => {
                            if let Some(AnthropicCurrentBlock::ToolUse { id, name, input }) =
                                current_block.take()
                            {
                                chunks.push(CompletionChunk {
                                    content: String::new(),
                                    finish_reason: Some("tool_calls".to_string()),
                                    tool_calls: Some(vec![ToolCall {
                                        id,
                                        r#type: "function".to_string(),
                                        function: FunctionCall {
                                            name,
                                            arguments: input,
                                        },
                                    }]),
                                });
                            }
                        }
                        AnthropicStreamEvent::MessageDelta { usage, .. } if usage.is_some() => {
                            if let Some(last) = chunks.last_mut() {
                                last.finish_reason = Some("stop".to_string());
                            }
                        }
                        _ => {}
                    }
                }
            }

            Ok(chunks)
        })
    }

    fn stream_chunks(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<tokio::sync::mpsc::Receiver<Result<CompletionChunk, AIError>>, AIError>>
    {
        Box::pin(async move {
            self.validate_model()?;

            let (system, messages, temperature, max_tokens) = self.split_messages(req.messages);
            let mut body = AnthropicRequestBody::from_completion_request(
                &self.config.model,
                system,
                messages,
                temperature,
                max_tokens,
                req.tools.clone(),
            );
            body.stream = true;

            let url = format!("{}{}", self.base_url(), MESSAGES_PATH);

            let response = self
                .client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(map_reqwest_error)?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_anthropic_error(status, &text));
            }

            let (tx, rx) = tokio::sync::mpsc::channel::<Result<CompletionChunk, AIError>>(64);
            let mut stream = response.bytes_stream();

            tokio::spawn(async move {
                let mut buffer = String::new();
                let mut event_data: Vec<String> = Vec::new();
                let mut current_block: Option<AnthropicCurrentBlock> = None;

                while let Some(result) = stream.next().await {
                    match result {
                        Ok(bytes) => {
                            buffer.push_str(&String::from_utf8_lossy(&bytes));

                            while let Some(pos) = buffer.find('\n') {
                                let line = buffer.drain(..=pos).collect::<String>();
                                let line = line.trim_end_matches('\n').trim_end_matches('\r');

                                if line.is_empty() {
                                    for data in &event_data {
                                        if data == "[DONE]" {
                                            continue;
                                        }

                                        match serde_json::from_str::<AnthropicStreamEvent>(data) {
                                            Ok(event) => {
                                                match event {
                                                    AnthropicStreamEvent::ContentBlockStart {
                                                        content_block,
                                                    } => {
                                                        current_block = Some(match content_block {
                                                            AnthropicContentBlock::Text => {
                                                                AnthropicCurrentBlock::Text
                                                            }
                                                            AnthropicContentBlock::ToolUse {
                                                                id,
                                                                name,
                                                            } => AnthropicCurrentBlock::ToolUse {
                                                                id,
                                                                name,
                                                                input: String::new(),
                                                            },
                                                        });
                                                    }
                                                    AnthropicStreamEvent::ContentBlockDelta {
                                                        delta,
                                                    } => {
                                                        match delta {
                                                            AnthropicDelta::TextDelta { text } => {
                                                                if !text.is_empty() {
                                                                    let _ = tx
                                                                        .send(Ok(CompletionChunk {
                                                                            content: text,
                                                                            finish_reason: None,
                                                                            tool_calls: None,
                                                                        }))
                                                                        .await;
                                                                }
                                                            }
                                                            AnthropicDelta::InputJsonDelta {
                                                                partial_json,
                                                            } => {
                                                                if let Some(AnthropicCurrentBlock::ToolUse { input, .. }) = &mut current_block {
                                                                    input.push_str(&partial_json);
                                                                }
                                                            }
                                                        }
                                                    }
                                                    AnthropicStreamEvent::ContentBlockStop => {
                                                        if let Some(block) = current_block.take() {
                                                            send_tool_call_chunk(block, &tx).await;
                                                        }
                                                    }
                                                    AnthropicStreamEvent::MessageDelta {
                                                        usage,
                                                        ..
                                                    } if usage.is_some() => {
                                                        let _ = tx
                                                            .send(Ok(CompletionChunk {
                                                                content: String::new(),
                                                                finish_reason: Some(
                                                                    "stop".to_string(),
                                                                ),
                                                                tool_calls: None,
                                                            }))
                                                            .await;
                                                    }
                                                    _ => {}
                                                }
                                            }
                                            Err(e) => {
                                                let _ = tx
                                                    .send(Err(AIError::Stream(format!(
                                                        "invalid sse event: {e}"
                                                    ))))
                                                    .await;
                                            }
                                        }
                                    }
                                    event_data.clear();
                                } else if let Some(data) = line.strip_prefix("data: ") {
                                    event_data.push(data.to_string());
                                }
                            }
                        }
                        Err(e) => {
                            let _ = tx.send(Err(map_reqwest_error(e))).await;
                            break;
                        }
                    }
                }

                if let Some(block) = current_block.take() {
                    send_tool_call_chunk(block, &tx).await;
                }
            });

            Ok(rx)
        })
    }
}
