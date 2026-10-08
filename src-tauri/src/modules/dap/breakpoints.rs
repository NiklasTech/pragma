use crate::modules::dap::types::{DapCapabilities, DapSourceBreakpoint};

fn non_empty(value: Option<&String>) -> Option<String> {
    value
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
        .map(str::to_string)
}

/// Drops empty options and the ones the adapter does not support.
pub fn to_request_breakpoints(
    breakpoints: &[DapSourceBreakpoint],
    capabilities: DapCapabilities,
) -> Vec<DapSourceBreakpoint> {
    breakpoints
        .iter()
        .map(|bp| DapSourceBreakpoint {
            line: bp.line,
            condition: non_empty(bp.condition.as_ref())
                .filter(|_| capabilities.supports_conditional_breakpoints),
            hit_condition: non_empty(bp.hit_condition.as_ref())
                .filter(|_| capabilities.supports_hit_conditional_breakpoints),
            log_message: non_empty(bp.log_message.as_ref())
                .filter(|_| capabilities.supports_log_points),
        })
        .collect()
}

pub fn validate_breakpoints(breakpoints: &[DapSourceBreakpoint]) -> Result<(), String> {
    if breakpoints.iter().any(|bp| bp.line == 0) {
        return Err("Breakpoint lines start at 1".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn breakpoint() -> DapSourceBreakpoint {
        DapSourceBreakpoint {
            line: 4,
            condition: Some("x > 1".to_string()),
            hit_condition: Some(" 3 ".to_string()),
            log_message: Some("x is {x}".to_string()),
        }
    }

    #[test]
    fn keeps_supported_options() {
        let capabilities = DapCapabilities {
            supports_conditional_breakpoints: true,
            supports_hit_conditional_breakpoints: true,
            supports_log_points: true,
        };
        let result = to_request_breakpoints(&[breakpoint()], capabilities);
        let value = serde_json::to_value(&result[0]).unwrap();
        assert_eq!(value["line"], 4);
        assert_eq!(value["condition"], "x > 1");
        assert_eq!(value["hitCondition"], "3");
        assert_eq!(value["logMessage"], "x is {x}");
    }

    #[test]
    fn drops_unsupported_options() {
        let capabilities = DapCapabilities {
            supports_conditional_breakpoints: true,
            ..DapCapabilities::default()
        };
        let result = to_request_breakpoints(&[breakpoint()], capabilities);
        let value = serde_json::to_value(&result[0]).unwrap();
        assert_eq!(value["condition"], "x > 1");
        assert!(value.get("hitCondition").is_none());
        assert!(value.get("logMessage").is_none());
    }

    #[test]
    fn drops_blank_options() {
        let capabilities = DapCapabilities {
            supports_conditional_breakpoints: true,
            ..DapCapabilities::default()
        };
        let mut bp = breakpoint();
        bp.condition = Some("   ".to_string());
        let result = to_request_breakpoints(&[bp], capabilities);
        assert!(result[0].condition.is_none());
    }

    #[test]
    fn rejects_line_zero() {
        let mut bp = breakpoint();
        bp.line = 0;
        assert!(validate_breakpoints(&[bp]).is_err());
        assert!(validate_breakpoints(&[breakpoint()]).is_ok());
    }

    #[test]
    fn parses_capabilities_with_missing_fields() {
        let capabilities: DapCapabilities =
            serde_json::from_value(serde_json::json!({ "supportsLogPoints": true })).unwrap();
        assert!(capabilities.supports_log_points);
        assert!(!capabilities.supports_conditional_breakpoints);
    }
}
