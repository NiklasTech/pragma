use super::error::{DapError, Result};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader};

pub(super) async fn write_message<W>(writer: &mut W, message: &str) -> std::io::Result<()>
where
    W: AsyncWrite + Unpin + Send,
{
    let header = format!("Content-Length: {}\r\n\r\n", message.len());
    writer.write_all(header.as_bytes()).await?;
    writer.write_all(message.as_bytes()).await?;
    writer.flush().await
}

pub(super) async fn read_message<R>(reader: &mut BufReader<R>) -> Result<Option<String>>
where
    R: AsyncRead + Unpin + Send,
{
    let mut content_length: Option<usize> = None;
    let mut header_line = String::new();

    loop {
        header_line.clear();
        let bytes_read = reader
            .read_line(&mut header_line)
            .await
            .map_err(DapError::Spawn)?;
        if bytes_read == 0 {
            return Ok(None);
        }

        let trimmed = header_line.trim();
        if trimmed.is_empty() {
            break;
        }

        if let Some(value) = trimmed.strip_prefix("Content-Length:") {
            let value = value.trim();
            content_length = Some(
                value
                    .parse::<usize>()
                    .map_err(|_| DapError::InvalidContentLength)?,
            );
        }
    }

    let length = content_length.ok_or(DapError::InvalidHeader)?;
    let mut body = vec![0u8; length];
    reader
        .read_exact(&mut body)
        .await
        .map_err(DapError::Spawn)?;

    String::from_utf8(body)
        .map(Some)
        .map_err(|e| DapError::Serialization(e.to_string()))
}
