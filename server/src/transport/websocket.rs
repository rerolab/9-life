use async_trait::async_trait;
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::protocol::{ClientMessage, ServerMessage};
use crate::transport::traits::{Result, Transport};

/// WebSocket の sender 側のみを保持する Transport 実装
/// RoomManager にプレイヤー単位で登録し、ブロードキャスト送信に使う
#[derive(Clone)]
pub struct WsSender {
    sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
}

impl WsSender {
    pub fn new(sender: SplitSink<WebSocket, Message>) -> Self {
        Self {
            sender: Arc::new(Mutex::new(sender)),
        }
    }
}

#[async_trait]
impl Transport for WsSender {
    async fn send(&self, msg: ServerMessage) -> Result<()> {
        let json = serde_json::to_string(&msg)?;
        let mut sender = self.sender.lock().await;
        sender.send(Message::Text(json.into())).await?;
        Ok(())
    }

    async fn recv(&mut self) -> Result<ClientMessage> {
        // WsSender は送信専用。recv は呼ばれない想定
        Err("WsSender does not support recv".into())
    }

    async fn close(&self) -> Result<()> {
        let mut sender = self.sender.lock().await;
        sender.send(Message::Close(None)).await?;
        Ok(())
    }
}

/// WebSocket の receiver 側をラップするヘルパー
pub struct WsReceiver {
    receiver: SplitStream<WebSocket>,
}

impl WsReceiver {
    pub fn new(receiver: SplitStream<WebSocket>) -> Self {
        Self { receiver }
    }

    /// 次のクライアントメッセージを受信する
    pub async fn recv(&mut self) -> Result<ClientMessage> {
        loop {
            match self.receiver.next().await {
                Some(Ok(Message::Text(text))) => {
                    let msg: ClientMessage = serde_json::from_str(&text)?;
                    return Ok(msg);
                }
                Some(Ok(Message::Close(_))) => {
                    return Err("connection closed".into());
                }
                Some(Ok(_)) => {
                    // ping/pong/binary は無視して次のメッセージを待つ
                    continue;
                }
                Some(Err(e)) => {
                    let err: Box<dyn std::error::Error + Send + Sync> = Box::new(e);
                    return Err(err);
                }
                None => {
                    return Err("stream ended".into());
                }
            }
        }
    }
}

/// WebSocket を sender/receiver に分割する
pub fn split_websocket(socket: WebSocket) -> (WsSender, WsReceiver) {
    let (sender, receiver) = socket.split();
    (WsSender::new(sender), WsReceiver::new(receiver))
}
