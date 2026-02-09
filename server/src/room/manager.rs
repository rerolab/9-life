use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::protocol::{PlayerId, RoomId, ServerMessage};
use crate::room::models::{Room, RoomStatus};
use crate::transport::traits::Transport;

/// ルームマネージャー
/// 全ルームの作成・参加・退出を管理する
pub struct RoomManager {
    rooms: Arc<RwLock<HashMap<RoomId, Room>>>,
    max_players_per_room: usize,
}

impl RoomManager {
    pub fn new(max_players_per_room: usize) -> Self {
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
            max_players_per_room,
        }
    }

    /// 6文字の英数字ルームIDを生成
    fn generate_room_id() -> RoomId {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let chars: Vec<char> = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".chars().collect();
        (0..6)
            .map(|_| chars[rng.gen_range(0..chars.len())])
            .collect()
    }

    /// 部屋作成
    pub async fn create_room(
        &self,
        host_name: String,
        map_id: String,
        transport: Arc<dyn Transport>,
    ) -> (RoomId, PlayerId) {
        let room_id = Self::generate_room_id();
        let player_id = uuid::Uuid::new_v4().to_string();

        let room = Room::new(
            room_id.clone(),
            player_id.clone(),
            host_name,
            map_id,
            transport,
            self.max_players_per_room,
        );

        let mut rooms = self.rooms.write().await;
        rooms.insert(room_id.clone(), room);

        (room_id, player_id)
    }

    /// 部屋参加
    pub async fn join_room(
        &self,
        room_id: &str,
        player_name: String,
        transport: Arc<dyn Transport>,
    ) -> Result<PlayerId, String> {
        let mut rooms = self.rooms.write().await;
        let room = rooms
            .get_mut(room_id)
            .ok_or_else(|| "room not found".to_string())?;

        if room.status != RoomStatus::Lobby {
            return Err("room is not in lobby state".to_string());
        }

        if room.is_full() {
            return Err("room is full".to_string());
        }

        let player_id = uuid::Uuid::new_v4().to_string();
        let player = crate::room::models::Player {
            id: player_id.clone(),
            name: player_name,
            transport,
        };
        room.players.push(player);

        Ok(player_id)
    }

    /// 部屋退出
    pub async fn leave_room(&self, room_id: &str, player_id: &str) -> Result<(), String> {
        let mut rooms = self.rooms.write().await;
        let room = rooms
            .get_mut(room_id)
            .ok_or_else(|| "room not found".to_string())?;

        let before = room.players.len();
        room.players.retain(|p| p.id != player_id);

        if room.players.len() == before {
            return Err("player not found in room".to_string());
        }

        // 部屋が空になったら削除
        if room.players.is_empty() {
            let room_id = room_id.to_string();
            rooms.remove(&room_id);
        }

        Ok(())
    }

    /// 部屋情報取得（API用の安全なコピー）
    pub async fn get_room_info(&self, room_id: &str) -> Option<RoomInfo> {
        let rooms = self.rooms.read().await;
        rooms.get(room_id).map(|room| RoomInfo {
            id: room.id.clone(),
            players: room
                .players
                .iter()
                .map(|p| crate::protocol::PlayerInfo {
                    id: p.id.clone(),
                    name: p.name.clone(),
                })
                .collect(),
            status: room.status.to_string(),
            map_id: room.map_id.clone(),
            player_count: room.players.len(),
            max_players: room.max_players,
        })
    }

    /// 部屋内の全プレイヤーにメッセージをブロードキャスト
    pub async fn broadcast(&self, room_id: &str, msg: &ServerMessage) {
        let rooms = self.rooms.read().await;
        if let Some(room) = rooms.get(room_id) {
            for player in &room.players {
                let _ = player.transport.send(msg.clone()).await;
            }
        }
    }

    /// 特定プレイヤーを除外してブロードキャスト
    pub async fn broadcast_except(
        &self,
        room_id: &str,
        except_id: &str,
        msg: &ServerMessage,
    ) {
        let rooms = self.rooms.read().await;
        if let Some(room) = rooms.get(room_id) {
            for player in &room.players {
                if player.id != except_id {
                    let _ = player.transport.send(msg.clone()).await;
                }
            }
        }
    }
}

/// API用のルーム情報（Transport を含まない安全な構造体）
#[derive(Debug, Clone, serde::Serialize)]
pub struct RoomInfo {
    pub id: RoomId,
    pub players: Vec<crate::protocol::PlayerInfo>,
    pub status: String,
    pub map_id: String,
    pub player_count: usize,
    pub max_players: usize,
}
