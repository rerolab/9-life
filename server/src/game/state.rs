use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::protocol::PlayerId;

// ============================================================
// Map data types (loaded from JSON)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MapData {
    pub id: String,
    pub name: String,
    pub version: String,
    #[ts(type = "number")]
    pub start_money: i64,
    #[ts(type = "number")]
    pub loan_unit: u64,
    pub loan_interest_rate: f64,
    pub tiles: Vec<TileData>,
    pub careers: Vec<Career>,
    pub houses: Vec<House>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TileData {
    pub id: usize,
    #[serde(rename = "type")]
    pub tile_type: TileType,
    pub position: Position,
    pub next: Vec<usize>,
    pub event: Option<TileEvent>,
    pub labels: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export)]
pub enum TileType {
    Start,
    Payday,
    Action,
    Career,
    House,
    Marry,
    Baby,
    Stock,
    Insurance,
    Tax,
    Lawsuit,
    Branch,
    Retire,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type")]
pub enum TileEvent {
    #[serde(rename = "money")]
    Money {
        #[ts(type = "number")]
        amount: i64,
        text: String,
    },
    #[serde(rename = "draw_career")]
    DrawCareer { pool: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Career {
    pub id: String,
    pub name: String,
    pub salary: u32,
    pub pool: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct House {
    pub id: String,
    pub name: String,
    #[ts(type = "number")]
    pub price: i64,
    #[ts(type = "number")]
    pub sell_price: i64,
}

// ============================================================
// Game state
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Board {
    pub tiles: Vec<Tile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Tile {
    pub id: usize,
    #[serde(rename = "type")]
    pub tile_type: TileType,
    pub position: Position,
    pub next: Vec<usize>,
    pub event: Option<TileEvent>,
    pub labels: Option<Vec<String>>,
}

impl Board {
    pub fn from_map(map: &MapData) -> Self {
        let tiles = map
            .tiles
            .iter()
            .map(|td| Tile {
                id: td.id,
                tile_type: td.tile_type.clone(),
                position: td.position.clone(),
                next: td.next.clone(),
                event: td.event.clone(),
                labels: td.labels.clone(),
            })
            .collect();
        Board { tiles }
    }

    pub fn tile(&self, id: usize) -> Option<&Tile> {
        self.tiles.iter().find(|t| t.id == id)
    }

    /// Find the tile index in the tiles vec by tile id
    pub fn tile_index(&self, id: usize) -> Option<usize> {
        self.tiles.iter().position(|t| t.id == id)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Stock {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PromissoryNote {
    pub id: String,
    #[ts(type = "number")]
    pub amount: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PlayerState {
    pub id: PlayerId,
    pub name: String,
    #[ts(type = "number")]
    pub money: i64,
    pub career: Option<Career>,
    pub salary: u32,
    pub married: bool,
    pub children: u8,
    pub life_insurance: bool,
    pub auto_insurance: bool,
    pub stocks: Vec<Stock>,
    pub houses: Vec<House>,
    #[ts(type = "number")]
    pub debt: u64,
    pub promissory_notes: Vec<PromissoryNote>,
    pub position: usize,
    pub retired: bool,
}

impl PlayerState {
    pub fn new(id: PlayerId, name: String, start_money: i64) -> Self {
        Self {
            id,
            name,
            money: start_money,
            career: None,
            salary: 0,
            married: false,
            children: 0,
            life_insurance: false,
            auto_insurance: false,
            stocks: Vec::new(),
            houses: Vec::new(),
            debt: 0,
            promissory_notes: Vec::new(),
            position: 0,
            retired: false,
        }
    }

    /// Total assets for ranking: money + house sell prices + promissory notes - debt with interest
    pub fn total_assets(&self, interest_rate: f64) -> i64 {
        let house_value: i64 = self.houses.iter().map(|h| h.sell_price).sum();
        let notes_value: i64 = self.promissory_notes.iter().map(|n| n.amount).sum();
        let debt_value = (self.debt as f64 * interest_rate) as i64;
        self.money + house_value + notes_value - debt_value
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export)]
pub enum TurnPhase {
    WaitingForSpin,
    Spinning,
    Moving,
    ResolvingEvent,
    ChoosingPath,
    ChoosingAction,
    TurnEnd,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameState {
    pub players: Vec<PlayerState>,
    pub board: Board,
    pub current_turn: usize,
    pub phase: TurnPhase,
    pub rng_seed: u64,
    /// Reference to map data for interest rate, loan unit etc.
    pub loan_unit: u64,
    pub loan_interest_rate: f64,
    pub careers: Vec<Career>,
    pub houses_for_sale: Vec<House>,
}

impl GameState {
    pub fn current_player(&self) -> &PlayerState {
        &self.players[self.current_turn]
    }

    pub fn current_player_mut(&mut self) -> &mut PlayerState {
        &mut self.players[self.current_turn]
    }

    pub fn player_by_id(&self, id: &str) -> Option<&PlayerState> {
        self.players.iter().find(|p| p.id == id)
    }

    pub fn active_player_count(&self) -> usize {
        self.players.iter().filter(|p| !p.retired).count()
    }

    /// Advance the RNG seed and return a pseudo-random u64
    pub fn next_random(&mut self) -> u64 {
        // Simple xorshift64
        let mut x = self.rng_seed;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.rng_seed = x;
        x
    }
}

// ============================================================
// Action & Event types
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PlayerAction {
    BuyHouse { house_id: String },
    BuyInsurance { insurance_type: InsuranceType },
    SkipAction,
    SelectLawsuitTarget { target_id: PlayerId },
    RepayDebt,
    BuyStock,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InsuranceType {
    Life,
    Auto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GameEvent {
    MoneyChanged {
        player_id: PlayerId,
        amount: i64,
        reason: String,
    },
    CareerAssigned {
        player_id: PlayerId,
        career: Career,
    },
    Married {
        player_id: PlayerId,
    },
    BabyBorn {
        player_id: PlayerId,
        children: u8,
    },
    HousePurchased {
        player_id: PlayerId,
        house: House,
    },
    InsurancePurchased {
        player_id: PlayerId,
        insurance_type: InsuranceType,
    },
    StockPurchased {
        player_id: PlayerId,
    },
    PlayerRetired {
        player_id: PlayerId,
    },
    ChoiceRequired {
        choices: Vec<GameChoice>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameChoice {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpinResult {
    pub player_id: PlayerId,
    pub value: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ranking {
    pub player_id: PlayerId,
    pub player_name: String,
    pub total_assets: i64,
    pub rank: u32,
}
