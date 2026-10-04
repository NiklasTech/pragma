use serde::{Deserialize, Serialize};

/// Media types every vision provider and ACP agent accepts.
pub const SUPPORTED_IMAGE_TYPES: [&str; 4] = ["image/png", "image/jpeg", "image/gif", "image/webp"];
/// Base64 length of a 5 MB image, the smallest per-image limit among the providers.
pub const MAX_IMAGE_BASE64_LEN: usize = 5 * 1024 * 1024 * 4 / 3 + 4;
/// Anthropic accepts at most 100 images per request.
pub const MAX_IMAGES_PER_REQUEST: usize = 100;

/// An image attached to a message, as base64 data without a data URL prefix.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ImageContent {
    pub media_type: String,
    pub data: String,
}

impl ImageContent {
    pub fn data_url(&self) -> String {
        format!("data:{};base64,{}", self.media_type, self.data)
    }
}

pub fn validate_image(image: &ImageContent) -> Result<(), String> {
    if !SUPPORTED_IMAGE_TYPES.contains(&image.media_type.as_str()) {
        return Err(format!("unsupported image type: {}", image.media_type));
    }
    if image.data.is_empty() {
        return Err("image data is empty".to_string());
    }
    if image.data.len() > MAX_IMAGE_BASE64_LEN {
        return Err("image is larger than 5 MB".to_string());
    }
    let is_base64 = image
        .data
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'/' | b'='));
    if !is_base64 {
        return Err("image data is not base64".to_string());
    }
    Ok(())
}

pub fn validate_images<'a>(
    images: impl IntoIterator<Item = &'a ImageContent>,
) -> Result<(), String> {
    let mut count = 0;
    for image in images {
        count += 1;
        if count > MAX_IMAGES_PER_REQUEST {
            return Err(format!(
                "a request may carry at most {MAX_IMAGES_PER_REQUEST} images"
            ));
        }
        validate_image(image)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn image(media_type: &str, data: &str) -> ImageContent {
        ImageContent {
            media_type: media_type.to_string(),
            data: data.to_string(),
        }
    }

    #[test]
    fn accepts_supported_base64_images() {
        assert!(validate_image(&image("image/png", "iVBORw0KGgo=")).is_ok());
        assert!(validate_image(&image("image/webp", "UklGRg+/")).is_ok());
    }

    #[test]
    fn rejects_unsupported_media_types() {
        assert!(validate_image(&image("image/svg+xml", "PHN2Zz4=")).is_err());
        assert!(validate_image(&image("text/plain", "aGk=")).is_err());
    }

    #[test]
    fn rejects_empty_oversized_and_non_base64_data() {
        assert!(validate_image(&image("image/png", "")).is_err());
        assert!(validate_image(&image("image/png", "data:image/png;base64,aGk=")).is_err());
        let oversized = "A".repeat(MAX_IMAGE_BASE64_LEN + 1);
        assert!(validate_image(&image("image/png", &oversized)).is_err());
    }

    #[test]
    fn rejects_too_many_images() {
        let images = vec![image("image/png", "aGk="); MAX_IMAGES_PER_REQUEST + 1];
        assert!(validate_images(&images[..MAX_IMAGES_PER_REQUEST]).is_ok());
        assert!(validate_images(&images).is_err());
    }

    #[test]
    fn builds_a_data_url() {
        assert_eq!(
            image("image/jpeg", "aGk=").data_url(),
            "data:image/jpeg;base64,aGk="
        );
    }
}
