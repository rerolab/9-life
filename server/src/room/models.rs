use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;

use crate::game::{ClassicGameEngine, GameEngine, GameState, MapData};
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
    pub game_state: Option<GameState>,
    pub engine: Option<Box<dyn GameEngine>>,
    pub map_data: Option<MapData>,
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
            game_state: None,
            engine: None,
            map_data: None,
        }
    }

    pub fn is_full(&self) -> bool {
        self.players.len() >= self.max_players
    }

    pub fn find_player(&self, player_id: &str) -> Option<&Player> {
        self.players.iter().find(|p| p.id == player_id)
    }

    /// ゲーム開始: エンジン初期化 + ゲーム状態生成
    pub fn start_game(&mut self, map: MapData) -> Result<&GameState, String> {
        if self.status != RoomStatus::Lobby {
            return Err("room is not in lobby state".to_string());
        }
        if self.players.len() < 2 {
            return Err("need at least 2 players".to_string());
        }

        let engine = ClassicGameEngine::new();
        let player_info: Vec<(PlayerId, String)> = self
            .players
            .iter()
            .map(|p| (p.id.clone(), p.name.clone()))
            .collect();

        let game_state = engine.init(player_info, &map);
        self.game_state = Some(game_state);
        self.engine = Some(Box::new(engine));
        self.map_data = Some(map);
        self.status = RoomStatus::Playing;

        Ok(self.game_state.as_ref().unwrap())
    }
}
