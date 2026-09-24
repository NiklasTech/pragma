use crate::modules::dap::types::{
    DapBreakpoint, DapEvaluateResult, DapScope, DapStackFrame, DapVariable,
};

use super::DapManager;

impl DapManager {
    pub async fn set_breakpoints(
        &self,
        file_path: &str,
        lines: &[u32],
    ) -> std::result::Result<Vec<DapBreakpoint>, String> {
        let client = self.get_client().await?;
        let body = client
            .request(
                "setBreakpoints",
                Some(serde_json::json!({
                    "source": { "path": file_path },
                    "breakpoints": lines.iter().map(|line| serde_json::json!({ "line": line })).collect::<Vec<_>>(),
                    "sourceModified": false,
                })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;

        let breakpoints = body
            .get("breakpoints")
            .cloned()
            .unwrap_or(serde_json::Value::Array(Vec::new()));
        serde_json::from_value(breakpoints).map_err(|e| e.to_string())
    }

    pub async fn continue_(&self, thread_id: u64) -> std::result::Result<(), String> {
        let client = self.get_client().await?;
        client
            .request(
                "continue",
                Some(serde_json::json!({ "threadId": thread_id })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn pause(&self, thread_id: u64) -> std::result::Result<(), String> {
        let client = self.get_client().await?;
        client
            .request(
                "pause",
                Some(serde_json::json!({ "threadId": thread_id })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn next(&self, thread_id: u64) -> std::result::Result<(), String> {
        let client = self.get_client().await?;
        client
            .request(
                "next",
                Some(serde_json::json!({ "threadId": thread_id })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn step_in(&self, thread_id: u64) -> std::result::Result<(), String> {
        let client = self.get_client().await?;
        client
            .request(
                "stepIn",
                Some(serde_json::json!({ "threadId": thread_id })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn step_out(&self, thread_id: u64) -> std::result::Result<(), String> {
        let client = self.get_client().await?;
        client
            .request(
                "stepOut",
                Some(serde_json::json!({ "threadId": thread_id })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn stack_trace(
        &self,
        thread_id: u64,
    ) -> std::result::Result<Vec<DapStackFrame>, String> {
        let client = self.get_client().await?;
        let body = client
            .request(
                "stackTrace",
                Some(serde_json::json!({
                    "threadId": thread_id,
                    "startFrame": 0,
                    "levels": 50,
                })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;

        let frames = body
            .get("stackFrames")
            .cloned()
            .unwrap_or(serde_json::Value::Array(Vec::new()));
        serde_json::from_value(frames).map_err(|e| e.to_string())
    }

    pub async fn scopes(&self, frame_id: u64) -> std::result::Result<Vec<DapScope>, String> {
        let client = self.get_client().await?;
        let body = client
            .request(
                "scopes",
                Some(serde_json::json!({ "frameId": frame_id })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;

        let scopes = body
            .get("scopes")
            .cloned()
            .unwrap_or(serde_json::Value::Array(Vec::new()));
        serde_json::from_value(scopes).map_err(|e| e.to_string())
    }

    pub async fn variables(
        &self,
        variables_reference: u64,
    ) -> std::result::Result<Vec<DapVariable>, String> {
        let client = self.get_client().await?;
        let body = client
            .request(
                "variables",
                Some(serde_json::json!({ "variablesReference": variables_reference })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;

        let variables = body
            .get("variables")
            .cloned()
            .unwrap_or(serde_json::Value::Array(Vec::new()));
        serde_json::from_value(variables).map_err(|e| e.to_string())
    }

    pub async fn evaluate(
        &self,
        expression: &str,
        frame_id: Option<u64>,
    ) -> std::result::Result<DapEvaluateResult, String> {
        let client = self.get_client().await?;
        let mut arguments = serde_json::json!({
            "expression": expression,
            "context": "watch",
        });
        if let Some(frame_id) = frame_id {
            arguments["frameId"] = serde_json::json!(frame_id);
        }

        let body = client
            .request("evaluate", Some(arguments), None)
            .await
            .map_err(|e| e.to_string())?;
        serde_json::from_value(body).map_err(|e| e.to_string())
    }
}
