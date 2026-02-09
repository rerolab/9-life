use async_trait::async_trait;

use crate::protocol::{ClientMessage, ServerMessage};

pub type TransportError = Box<dyn std::error::Error + Send + Sync>;
pub type Result<T> = std::result::Result<T, TransportError>;

#[async_trait]
pub trait Transport: Send + Sync {
    async fn send(&self, msg: ServerMessage) -> Result<()>;
    async fn recv(&mut self) -> Result<ClientMessage>;
    async fn close(&self) -> Result<()>;
}
