use crate::ai::{
    config::ProviderConfig,
    error::AIError,
    provider::{
        AIProvider, BoxFuture, CompletionChunk, CompletionRequest, CompletionResponse, ModelInfo,
    },
    providers::openai::OpenAIProvider,
};

const MODELS: &[(&str, &str, Option<usize>, bool, bool)] = &[];

pub struct CustomProvider {
    inner: OpenAIProvider,
}

impl CustomProvider {
    pub fn new(config: ProviderConfig) -> Result<Self, AIError> {
        if config.base_url.is_empty() {
            return Err(AIError::InvalidModel(
                "custom provider requires a base URL".to_string(),
            ));
        }

        let inner = OpenAIProvider::new_for_provider(config, "custom")?;
        Ok(Self { inner })
    }
}

impl AIProvider for CustomProvider {
    fn name(&self) -> &'static str {
        "custom"
    }

    fn config(&self) -> &ProviderConfig {
        self.inner.config()
    }

    fn models(&self) -> Vec<ModelInfo> {
        MODELS
            .iter()
            .map(|(id, name, ctx, stream, vision)| ModelInfo {
                id: id.to_string(),
                name: name.to_string(),
                context_window: *ctx,
                supports_streaming: *stream,
                supports_vision: *vision,
            })
            .collect()
    }

    fn complete(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<CompletionResponse, AIError>> {
        self.inner.complete(req)
    }

    fn stream(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<Vec<CompletionChunk>, AIError>> {
        self.inner.stream(req)
    }

    fn stream_chunks(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<tokio::sync::mpsc::Receiver<Result<CompletionChunk, AIError>>, AIError>>
    {
        self.inner.stream_chunks(req)
    }

    fn stream_chunks_with_cancel(
        &self,
        req: CompletionRequest,
        cancel_token: Option<tokio_util::sync::CancellationToken>,
    ) -> BoxFuture<'_, Result<tokio::sync::mpsc::Receiver<Result<CompletionChunk, AIError>>, AIError>>
    {
        self.inner.stream_chunks_with_cancel(req, cancel_token)
    }
}
