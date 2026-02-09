use serde::{Deserialize, Serialize};

pub type RoomId = String;
pub type PlayerId = String;

/// クライアント -> サーバー メッセージ
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    CreateRoom {
        player_name: String,
        map_id: String,
    },
    JoinRoom {
        room_id: RoomId,
        player_name: String,
    },
    LeaveRoom,
    StartGame,
    SpinRoulette,
    ChoicePath {
        path_index: usize,
    },
    ChoiceAction {
        action_id: String,
    },
    ChatMessage {
        text: String,
    },
}

/// サーバー -> クライアント メッセージ
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    RoomCreated {
        room_id: RoomId,
        invite_url: String,
        player_id: PlayerId,
    },
    PlayerJoined {
        player_id: PlayerId,
        player_name: String,
    },
    PlayerLeft {
        player_id: PlayerId,
    },
    GameStarted {
        turn_order: Vec<PlayerId>,
    },
    RouletteResult {
        player_id: PlayerId,
        value: u32,
    },
    PlayerMoved {
        player_id: PlayerId,
        position: u32,
    },
    ChoiceRequired {
        choices: Vec<Choice>,
    },
    GameEnded {
        rankings: Vec<RankingEntry>,
    },
    ChatBroadcast {
        player_id: PlayerId,
        player_name: String,
        text: String,
    },
    Error {
        code: String,
        message: String,
    },
    RoomState {
        room_id: RoomId,
        players: Vec<PlayerInfo>,
        status: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Choice {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankingEntry {
    pub player_id: PlayerId,
    pub player_name: String,
    pub total_assets: i64,
    pub rank: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerInfo {
    pub id: PlayerId,
    pub name: String,
}
