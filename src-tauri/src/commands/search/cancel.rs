use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

const MAX_SEARCH_ID_LEN: usize = 128;

type Registry = Mutex<HashMap<String, Arc<AtomicBool>>>;

static ACTIVE_SEARCHES: OnceLock<Registry> = OnceLock::new();

fn registry() -> &'static Registry {
    ACTIVE_SEARCHES.get_or_init(Default::default)
}

fn validate_search_id(search_id: &str) -> Result<(), String> {
    if search_id.is_empty() || search_id.len() > MAX_SEARCH_ID_LEN {
        return Err("Invalid search id".to_string());
    }
    Ok(())
}

/// Cancellation flag of a running search; unregisters itself when dropped.
pub(super) struct SearchToken {
    id: Option<String>,
    cancelled: Arc<AtomicBool>,
}

impl SearchToken {
    pub(super) fn register(search_id: Option<&str>) -> Result<Self, String> {
        let cancelled = Arc::new(AtomicBool::new(false));
        let Some(id) = search_id else {
            return Ok(Self {
                id: None,
                cancelled,
            });
        };
        validate_search_id(id)?;
        registry()
            .lock()
            .map_err(|_| "Search registry is unavailable".to_string())?
            .insert(id.to_string(), cancelled.clone());
        Ok(Self {
            id: Some(id.to_string()),
            cancelled,
        })
    }

    pub(super) fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }
}

impl Drop for SearchToken {
    fn drop(&mut self) {
        let Some(id) = &self.id else {
            return;
        };
        if let Ok(mut searches) = registry().lock() {
            if searches
                .get(id)
                .is_some_and(|flag| Arc::ptr_eq(flag, &self.cancelled))
            {
                searches.remove(id);
            }
        }
    }
}

#[tauri::command]
pub fn cancel_workspace_search(search_id: String) -> Result<(), String> {
    validate_search_id(&search_id)?;
    let flag = registry()
        .lock()
        .map_err(|_| "Search registry is unavailable".to_string())?
        .remove(&search_id);
    if let Some(flag) = flag {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_sets_the_flag_of_a_registered_search() {
        let token = SearchToken::register(Some("cancel-test")).unwrap();
        assert!(!token.is_cancelled());
        cancel_workspace_search("cancel-test".to_string()).unwrap();
        assert!(token.is_cancelled());
    }

    #[test]
    fn dropping_a_token_unregisters_it() {
        let token = SearchToken::register(Some("drop-test")).unwrap();
        drop(token);
        assert!(!registry().lock().unwrap().contains_key("drop-test"));
    }

    #[test]
    fn rejects_empty_search_id() {
        assert!(cancel_workspace_search(String::new()).is_err());
        assert!(SearchToken::register(Some("")).is_err());
    }
}
