use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::game::state::{GameEvent, GameState, MapData, PlayerAction, TurnPhase};
use crate::game::GameEngine;
use crate::protocol::{PlayerId, RoomId, ServerMessage};
use crate::room::models::{Room, RoomStatus};
use crate::transport::traits::Transport;

/// 埋め込みマップデータ
const CLASSIC_MAP_JSON: &str = include_str!("../classic.json");

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
        use rand::RngExt;
        let mut rng = rand::rng();
        let chars: Vec<char> = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".chars().collect();
        (0..6)
            .map(|_| chars[rng.random_range(0..chars.len())])
            .collect()
    }

    /// マップデータをロード
    pub fn load_map(map_id: &str) -> Result<MapData, String> {
        match map_id {
            "classic" => serde_json::from_str(CLASSIC_MAP_JSON)
                .map_err(|e| format!("failed to parse classic map: {}", e)),
            _ => Err(format!("unknown map: {}", map_id)),
        }
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

    /// ゲーム開始
    pub async fn start_game(
        &self,
        room_id: &str,
        player_id: &str,
    ) -> Result<Vec<ServerMessage>, String> {
        let mut rooms = self.rooms.write().await;
        let room = rooms
            .get_mut(room_id)
            .ok_or_else(|| "room not found".to_string())?;

        // ホストのみ開始可能
        if room.host != player_id {
            return Err("only host can start game".to_string());
        }

        let map = Self::load_map(&room.map_id)?;
        let game_state = room.start_game(map)?;

        let turn_order: Vec<PlayerId> = game_state.players.iter().map(|p| p.id.clone()).collect();
        let board = game_state.board.clone();
        let players = game_state.players.clone();
        let careers = game_state.careers.clone();
        let houses = game_state.houses_for_sale.clone();

        let mut msgs = vec![ServerMessage::GameStarted {
            turn_order,
            board,
            players,
            careers,
            houses,
        }];

        // スタートマスが分岐の場合、最初のプレイヤーに選択を求める
        if let Some(gs) = &room.game_state {
            if gs.phase == TurnPhase::ChoosingPath {
                // init 後に ChoosingPath になることはないので通常ここには来ない
            }
        }

        msgs.push(self.build_game_sync(room));

        Ok(msgs)
    }

    /// ルーレット回転
    pub async fn spin_roulette(
        &self,
        room_id: &str,
        player_id: &str,
    ) -> Result<Vec<ServerMessage>, String> {
        let mut rooms = self.rooms.write().await;
        let room = rooms
            .get_mut(room_id)
            .ok_or_else(|| "room not found".to_string())?;

        let engine = room.engine.as_ref().ok_or("game not started")?;
        let state = room.game_state.as_ref().ok_or("no game state")?;

        // 手番チェック
        let current_player_id = state.players[state.current_turn].id.clone();
        if current_player_id != player_id {
            return Err("not your turn".to_string());
        }
        if state.phase != TurnPhase::WaitingForSpin {
            return Err("not in spin phase".to_string());
        }

        // ルーレット
        let (new_state, spin_result) = engine.spin(state);
        let value = spin_result.value;

        // 移動
        let (moved_state, events) = engine.advance(&new_state, value);
        let final_position = moved_state.players[moved_state.current_turn].position;
        let phase = moved_state.phase;

        room.game_state = Some(moved_state);

        let mut msgs = Vec::new();
        msgs.push(ServerMessage::RouletteResult {
            player_id: player_id.to_string(),
            value,
        });
        msgs.push(ServerMessage::PlayerMoved {
            player_id: player_id.to_string(),
            position: final_position,
        });

        // イベント処理結果
        for event in &events {
            if let GameEvent::ChoiceRequired { choices } = event {
                msgs.push(ServerMessage::ChoiceRequired {
                    choices: choices
                        .iter()
                        .map(|c| crate::protocol::Choice {
                            id: c.id.clone(),
                            label: c.label.clone(),
                        })
                        .collect(),
                });
            }
        }

        // TurnEnd の場合は自動的にターンを進める
        if phase == TurnPhase::TurnEnd {
            self.advance_turn(room, &mut msgs);
        }

        msgs.push(self.build_game_sync(room));
        Ok(msgs)
    }

    /// 分岐選択
    pub async fn choose_path(
        &self,
        room_id: &str,
        player_id: &str,
        path_index: usize,
    ) -> Result<Vec<ServerMessage>, String> {
        let mut rooms = self.rooms.write().await;
        let room = rooms
            .get_mut(room_id)
            .ok_or_else(|| "room not found".to_string())?;

        let engine = room.engine.as_ref().ok_or("game not started")?;
        let state = room.game_state.as_ref().ok_or("no game state")?;

        let current_player_id = state.players[state.current_turn].id.clone();
        if current_player_id != player_id {
            return Err("not your turn".to_string());
        }
        if state.phase != TurnPhase::ChoosingPath {
            return Err("not in path choice phase".to_string());
        }

        let new_state = engine.choose_path(state, path_index);
        let phase = new_state.phase;
        room.game_state = Some(new_state);

        let mut msgs = Vec::new();

        if phase == TurnPhase::TurnEnd {
            self.advance_turn(room, &mut msgs);
        }

        msgs.push(self.build_game_sync(room));
        Ok(msgs)
    }

    /// アクション選択（家購入、保険加入、訴訟対象など）
    pub async fn choose_action(
        &self,
        room_id: &str,
        player_id: &str,
        action_id: String,
    ) -> Result<Vec<ServerMessage>, String> {
        let mut rooms = self.rooms.write().await;
        let room = rooms
            .get_mut(room_id)
            .ok_or_else(|| "room not found".to_string())?;

        let engine = room.engine.as_ref().ok_or("game not started")?;
        let state = room.game_state.as_ref().ok_or("no game state")?;

        let current_player_id = state.players[state.current_turn].id.clone();
        if current_player_id != player_id {
            return Err("not your turn".to_string());
        }
        if state.phase != TurnPhase::ChoosingAction {
            return Err("not in action choice phase".to_string());
        }

        // action_id からPlayerAction を構築
        let action = self.parse_action(&action_id, state);
        let (new_state, events) = engine.resolve_action(state, action);
        let phase = new_state.phase;
        room.game_state = Some(new_state);

        let mut msgs = Vec::new();

        // 新たな ChoiceRequired が発生した場合
        for event in &events {
            if let GameEvent::ChoiceRequired { choices } = event {
                msgs.push(ServerMessage::ChoiceRequired {
                    choices: choices
                        .iter()
                        .map(|c| crate::protocol::Choice {
                            id: c.id.clone(),
                            label: c.label.clone(),
                        })
                        .collect(),
                });
            }
        }

        if phase == TurnPhase::TurnEnd {
            self.advance_turn(room, &mut msgs);
        }

        msgs.push(self.build_game_sync(room));
        Ok(msgs)
    }

    /// action_id 文字列から PlayerAction を解析
    fn parse_action(&self, action_id: &str, state: &GameState) -> PlayerAction {
        let current_pos = state.players[state.current_turn].position;
        let tile = state.board.tile(current_pos);
        let tile_type = tile.map(|t| &t.tile_type);

        match tile_type {
            Some(crate::game::state::TileType::House) => {
                if action_id == "skip" {
                    PlayerAction::SkipAction
                } else {
                    PlayerAction::BuyHouse {
                        house_id: action_id.to_string(),
                    }
                }
            }
            Some(crate::game::state::TileType::Insurance) => match action_id {
                "life" => PlayerAction::BuyInsurance {
                    insurance_type: crate::game::state::InsuranceType::Life,
                },
                "auto" => PlayerAction::BuyInsurance {
                    insurance_type: crate::game::state::InsuranceType::Auto,
                },
                _ => PlayerAction::SkipAction,
            },
            Some(crate::game::state::TileType::Lawsuit) => PlayerAction::SelectLawsuitTarget {
                target_id: action_id.to_string(),
            },
            _ => PlayerAction::SkipAction,
        }
    }

    /// ターン進行 + ゲーム終了チェック
    fn advance_turn(&self, room: &mut Room, msgs: &mut Vec<ServerMessage>) {
        let engine = room.engine.as_ref().unwrap();
        let state = room.game_state.as_ref().unwrap();

        if engine.is_finished(state) {
            let rankings = engine.rankings(state);
            room.status = RoomStatus::Finished;
            msgs.push(ServerMessage::GameEnded {
                rankings: rankings
                    .iter()
                    .map(|r| crate::protocol::RankingEntry {
                        player_id: r.player_id.clone(),
                        player_name: r.player_name.clone(),
                        total_assets: r.total_assets,
                        rank: r.rank,
                    })
                    .collect(),
            });
            return;
        }

        let new_state = engine.end_turn(state);
        let next_player_id = new_state.players[new_state.current_turn].id.clone();
        let current_turn = new_state.current_turn;
        room.game_state = Some(new_state);

        msgs.push(ServerMessage::TurnChanged {
            current_turn,
            player_id: next_player_id,
        });
    }

    /// GameSync メッセージを構築
    fn build_game_sync(&self, room: &Room) -> ServerMessage {
        let state = room.game_state.as_ref().unwrap();
        ServerMessage::GameSync {
            players: state.players.clone(),
            current_turn: state.current_turn,
            phase: state.phase,
        }
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
