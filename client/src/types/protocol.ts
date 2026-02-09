// ============================================================
// Tile / Map types
// ============================================================

export type TileType =
  | "Start"
  | "Payday"
  | "Action"
  | "Career"
  | "House"
  | "Marry"
  | "Baby"
  | "Stock"
  | "Insurance"
  | "Tax"
  | "Lawsuit"
  | "Branch"
  | "Retire";

export interface Position {
  x: number;
  y: number;
}

export interface TileEvent {
  type: string;
  amount?: number;
  text?: string;
  pool?: string;
}

export interface Tile {
  id: number;
  type: TileType;
  position: Position;
  next: number[];
  event?: TileEvent;
  labels?: string[];
}

export interface Career {
  id: string;
  name: string;
  salary: number;
  pool: string;
}

export interface House {
  id: string;
  name: string;
  price: number;
  sell_price: number;
}

export interface MapData {
  id: string;
  name: string;
  version: string;
  start_money: number;
  loan_unit: number;
  loan_interest_rate: number;
  tiles: Tile[];
  careers: Career[];
  houses: House[];
}

// ============================================================
// Board (server format)
// ============================================================

export interface Board {
  tiles: Tile[];
}

// ============================================================
// Player / Game state
// ============================================================

export interface PlayerInfo {
  id: string;
  name: string;
}

export interface Stock {
  id: string;
  name: string;
}

export interface PlayerState {
  id: string;
  name: string;
  money: number;
  position: number;
  career: Career | null;
  salary: number;
  married: boolean;
  children: number;
  life_insurance: boolean;
  auto_insurance: boolean;
  stocks: Stock[];
  houses: House[];
  debt: number;
  promissory_notes: { id: string; amount: number }[];
  retired: boolean;
}

export type TurnPhase =
  | "WaitingForSpin"
  | "Spinning"
  | "Moving"
  | "ResolvingEvent"
  | "ChoosingPath"
  | "ChoosingAction"
  | "TurnEnd"
  | "GameOver";

export interface GameState {
  players: PlayerState[];
  board: Board;
  current_turn: number;
  phase: TurnPhase;
}

// ============================================================
// Choice / Ranking
// ============================================================

export interface Choice {
  id: string;
  label: string;
}

export interface RankingEntry {
  player_id: string;
  player_name: string;
  total_assets: number;
  rank: number;
}

// ============================================================
// Client -> Server messages
// ============================================================

export type ClientMessage =
  | { type: "CreateRoom"; player_name: string; map_id: string }
  | { type: "JoinRoom"; room_id: string; player_name: string }
  | { type: "LeaveRoom" }
  | { type: "StartGame" }
  | { type: "SpinRoulette" }
  | { type: "ChoicePath"; path_index: number }
  | { type: "ChoiceAction"; action_id: string }
  | { type: "ChatMessage"; text: string };

// ============================================================
// Server -> Client messages
// ============================================================

export type ServerMessage =
  | { type: "RoomCreated"; room_id: string; invite_url: string; player_id: string }
  | { type: "PlayerJoined"; player_id: string; player_name: string }
  | { type: "PlayerLeft"; player_id: string }
  | { type: "GameStarted"; turn_order: string[]; board: Board; players: PlayerState[]; careers: Career[]; houses: House[] }
  | { type: "GameSync"; players: PlayerState[]; current_turn: number; phase: TurnPhase }
  | { type: "RouletteResult"; player_id: string; value: number }
  | { type: "PlayerMoved"; player_id: string; position: number }
  | { type: "ChoiceRequired"; choices: Choice[] }
  | { type: "TurnChanged"; current_turn: number; player_id: string }
  | { type: "GameEnded"; rankings: RankingEntry[] }
  | { type: "ChatBroadcast"; player_id: string; player_name: string; text: string }
  | { type: "Error"; code: string; message: string }
  | { type: "RoomState"; room_id: string; player_id: string; players: PlayerInfo[]; status: string };
