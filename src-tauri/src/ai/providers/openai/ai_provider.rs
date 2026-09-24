use std::time::Duration;

use futures_util::StreamExt;

use crate::ai::{
    config::ProviderConfig,
    error::AIError,
    provider::{
        AIProvider, BoxFuture, CompletionChunk, CompletionRequest, CompletionResponse,
        FunctionCall, ModelInfo, ToolCall, Usage,
    },
};

use super::error::{map_openai_error, map_reqwest_error};
use super::provider::{OpenAIProvider, COMPLETIONS_PATH, MODELS_PATH};
use super::request::OpenAIRequestBody;
use super::response::OpenAIResponse;
use super::stream::{
    build_stream_chunk, parse_stream_event, ParseOutcome, DATA_PREFIX, DONE_EVENT,
};
use super::tool_calls::{extract_tool_calls_from_content, send_tool_call_chunk, PartialToolCall};

impl AIProvider for OpenAIProvider {
    fn name(&self) -> &'static str {
        "openai"
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
                .timeout(Duration::from_secs(self.config.timeout_seconds))
                .send()
                .await
                .map_err(map_reqwest_error)?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_openai_error(status, &text));
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
                .filter_map(|m| m.get("id").and_then(|id| id.as_str()))
                .map(|id| ModelInfo {
                    id: id.to_string(),
                    name: id.to_string(),
                    context_window: None,
                    supports_streaming: true,
                    supports_vision: false,
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

            let body = OpenAIRequestBody::from_completion_request(&self.config.model, req);
            let url = format!("{}{}", self.base_url(), COMPLETIONS_PATH);

            let response = self
                .client
                .post(&url)
                .timeout(Duration::from_secs(self.config.timeout_seconds))
                .json(&body)
                .send()
                .await
                .map_err(map_reqwest_error)?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_openai_error(status, &text));
            }

            let openai_resp: OpenAIResponse = response
                .json()
                .await
                .map_err(|e| AIError::Serialization(e.to_string()))?;

            let choice = openai_resp
                .choices
                .into_iter()
                .next()
                .ok_or_else(|| AIError::Provider("no choices in response".to_string()))?;

            let content = choice
                .message
                .content
                .clone()
                .filter(|c| !c.is_empty())
                .unwrap_or_else(|| {
                    choice
                        .message
                        .reasoning_content
                        .clone()
                        .filter(|c| !c.is_empty())
                        .map(|r| format!("<thinking>{}</thinking>", r))
                        .unwrap_or_default()
                });

            let tool_calls = if let Some(calls) = choice.message.tool_calls {
                Some(
                    calls
                        .into_iter()
                        .map(|call| ToolCall {
                            id: call.id,
                            r#type: call.r#type,
                            function: FunctionCall {
                                name: call.function.name,
                                arguments: call.function.arguments,
                            },
                        })
                        .collect(),
                )
            } else {
                extract_tool_calls_from_content(&content)
            };

            Ok(CompletionResponse {
                content,
                model: openai_resp.model,
                usage: openai_resp.usage.map(|u| Usage {
                    prompt_tokens: u.prompt_tokens,
                    completion_tokens: u.completion_tokens,
                    total_tokens: u.total_tokens,
                }),
                tool_calls,
                finish_reason: choice.finish_reason,
            })
        })
    }

    fn stream(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<Vec<CompletionChunk>, AIError>> {
        Box::pin(async move {
            self.validate_model()?;

            let mut body = OpenAIRequestBody::from_completion_request(&self.config.model, req);
            body.stream = Some(true);

            let url = format!("{}{}", self.base_url(), COMPLETIONS_PATH);

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
                return Err(map_openai_error(status, &text));
            }

            let bytes = response
                .bytes()
                .await
                .map_err(|e| AIError::Network(e.to_string()))?;
            let text = String::from_utf8_lossy(&bytes);

            let mut chunks = Vec::new();
            let mut in_reasoning = false;
            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() || line == DONE_EVENT {
                    continue;
                }
                if let Some(data) = line.strip_prefix(DATA_PREFIX) {
                    let event = match parse_stream_event(data)? {
                        ParseOutcome::Event(event) => event,
                        ParseOutcome::Skip => continue,
                    };

                    if let Some(mut choice) = event.choices.into_iter().next() {
                        choice.delta.tool_calls = None;
                        let (content, finish_reason) =
                            build_stream_chunk(&mut choice, &mut in_reasoning);
                        if !content.is_empty() {
                            chunks.push(CompletionChunk {
                                content,
                                finish_reason,
                                tool_calls: None,
                            });
                        }
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
        self.stream_chunks_with_cancel(req, None)
    }

    fn stream_chunks_with_cancel(
        &self,
        req: CompletionRequest,
        cancel_token: Option<tokio_util::sync::CancellationToken>,
    ) -> BoxFuture<'_, Result<tokio::sync::mpsc::Receiver<Result<CompletionChunk, AIError>>, AIError>>
    {
        Box::pin(async move {
            self.validate_model()?;

            let mut body = OpenAIRequestBody::from_completion_request(&self.config.model, req);
            body.stream = Some(true);

            let url = format!("{}{}", self.base_url(), COMPLETIONS_PATH);

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
                return Err(map_openai_error(status, &text));
            }

            let (tx, rx) = tokio::sync::mpsc::channel::<Result<CompletionChunk, AIError>>(64);
            let mut stream = response.bytes_stream();

            tokio::spawn(async move {
                let mut buffer = String::new();
                let mut event_data: Vec<String> = Vec::new();
                let mut in_reasoning = false;
                let mut content_buffer = String::new();
                let mut partial_tool_calls: std::collections::HashMap<usize, PartialToolCall> =
                    std::collections::HashMap::new();

                loop {
                    if cancel_token.as_ref().is_some_and(|t| t.is_cancelled()) {
                        break;
                    }

                    let cancel_fut = async {
                        match &cancel_token {
                            Some(token) => token.cancelled().await,
                            None => std::future::pending().await,
                        }
                    };

                    match tokio::select! {
                        biased;
                        _ = cancel_fut => None,
                        result = stream.next() => Some(result),
                    } {
                        None => {
                            let remaining: Vec<ToolCall> = partial_tool_calls
                                .drain()
                                .map(|(_, partial)| partial.into())
                                .collect();
                            send_tool_call_chunk(remaining, &tx).await;
                            break;
                        }
                        Some(Some(Ok(bytes))) => {
                            buffer.push_str(&String::from_utf8_lossy(&bytes));

                            while let Some(pos) = buffer.find('\n') {
                                let line = buffer.drain(..=pos).collect::<String>();
                                let line = line.trim_end_matches('\n').trim_end_matches('\r');

                                if line.is_empty() {
                                    for data in &event_data {
                                        if data == DONE_EVENT {
                                            continue;
                                        }

                                        let event = match parse_stream_event(data) {
                                            Ok(ParseOutcome::Event(event)) => event,
                                            Ok(ParseOutcome::Skip) => continue,
                                            Err(e) => {
                                                let _ = tx.send(Err(e)).await;
                                                continue;
                                            }
                                        };

                                        if let Some(mut choice) = event.choices.into_iter().next() {
                                            let tool_call_deltas = choice.delta.tool_calls.take();
                                            let (chunk, finish_reason) =
                                                build_stream_chunk(&mut choice, &mut in_reasoning);

                                            if !chunk.is_empty() {
                                                content_buffer.push_str(&chunk);

                                                if tx
                                                    .send(Ok(CompletionChunk {
                                                        content: chunk,
                                                        finish_reason: finish_reason.clone(),
                                                        tool_calls: None,
                                                    }))
                                                    .await
                                                    .is_err()
                                                {
                                                    break;
                                                }
                                            }

                                            if let Some(deltas) = tool_call_deltas {
                                                for delta in deltas {
                                                    let partial = partial_tool_calls
                                                        .entry(delta.index)
                                                        .or_default();
                                                    if let Some(id) = delta.id {
                                                        partial.id = id;
                                                    }
                                                    if let Some(r#type) = delta.r#type {
                                                        partial.r#type = r#type;
                                                    }
                                                    if let Some(function) = delta.function {
                                                        if let Some(name) = function.name {
                                                            partial.name = Some(name);
                                                        }
                                                        if let Some(args) = function.arguments {
                                                            partial.arguments.push_str(&args);
                                                        }
                                                    }
                                                }
                                            }

                                            if finish_reason.as_deref() == Some("tool_calls") {
                                                let completed: Vec<ToolCall> = partial_tool_calls
                                                    .drain()
                                                    .map(|(_, partial)| partial.into())
                                                    .collect();
                                                send_tool_call_chunk(completed, &tx).await;
                                            }
                                        }
                                    }
                                    event_data.clear();
                                } else if let Some(data) = line.strip_prefix(DATA_PREFIX) {
                                    event_data.push(data.to_string());
                                }
                            }
                        }
                        Some(Some(Err(e))) => {
                            let _ = tx.send(Err(map_reqwest_error(e))).await;
                            break;
                        }
                        Some(None) => {
                            let remaining: Vec<ToolCall> = partial_tool_calls
                                .drain()
                                .map(|(_, partial)| partial.into())
                                .collect();
                            if remaining.is_empty() {
                                if let Some(calls) =
                                    extract_tool_calls_from_content(&content_buffer)
                                {
                                    send_tool_call_chunk(calls, &tx).await;
                                }
                            } else {
                                send_tool_call_chunk(remaining, &tx).await;
                            }
                            break;
                        }
                    }
                }
            });

            Ok(rx)
        })
    }
}
