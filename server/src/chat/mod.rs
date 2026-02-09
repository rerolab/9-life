use crate::protocol::ServerMessage;
use crate::room::RoomManager;

/// チャットメッセージを処理し、同一部屋内にブロードキャストする
pub async fn handle_chat(
    room_manager: &RoomManager,
    room_id: &str,
    player_id: &str,
    player_name: &str,
    text: String,
) {
    let msg = ServerMessage::ChatBroadcast {
        player_id: player_id.to_string(),
        player_name: player_name.to_string(),
        text,
    };
    room_manager.broadcast(room_id, &msg).await;
}
