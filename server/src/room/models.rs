use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;

use crate::protocol::{PlayerId, RoomId};
use crate::transport::traits::Transport;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RoomStatus {
    Lobby,
    Playing,
    Finished,
}

impl std::fmt::Display for RoomStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RoomStatus::Lobby => write!(f, "lobby"),
            RoomStatus::Playing => write!(f, "playing"),
            RoomStatus::Finished => write!(f, "finished"),
        }
    }
}

/// 接続済みプレイヤー
pub struct Player {
    pub id: PlayerId,
    pub name: String,
    pub transport: Arc<dyn Transport>,
}

/// 部屋
pub struct Room {
    pub id: RoomId,
    pub host: PlayerId,
    pub players: Vec<Player>,
    pub status: RoomStatus,
    pub map_id: String,
    pub created_at: Instant,
    pub max_players: usize,
}

impl Room {
    pub fn new(
        id: RoomId,
        host_id: PlayerId,
        host_name: String,
        map_id: String,
        transport: Arc<dyn Transport>,
        max_players: usize,
    ) -> Self {
        let host = Player {
            id: host_id.clone(),
            name: host_name,
            transport,
        };
        Self {
            id,
            host: host_id,
            players: vec![host],
            status: RoomStatus::Lobby,
            map_id,
            created_at: Instant::now(),
            max_players,
        }
    }

    pub fn is_full(&self) -> bool {
        self.players.len() >= self.max_players
    }

    pub fn find_player(&self, player_id: &str) -> Option<&Player> {
        self.players.iter().find(|p| p.id == player_id)
    }
}
