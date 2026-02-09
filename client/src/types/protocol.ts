// ============================================================
// Auto-generated types from server (ts-rs)
// Do NOT edit the files in ./generated/ manually.
// Run: npm run gen:types
// ============================================================

export type { Board } from "./generated/Board";
export type { Career } from "./generated/Career";
export type { Choice } from "./generated/Choice";
export type { ClientMessage } from "./generated/ClientMessage";
export type { House } from "./generated/House";
export type { MapData } from "./generated/MapData";
export type { PlayerInfo } from "./generated/PlayerInfo";
export type { PlayerState } from "./generated/PlayerState";
export type { Position } from "./generated/Position";
export type { PromissoryNote } from "./generated/PromissoryNote";
export type { RankingEntry } from "./generated/RankingEntry";
export type { ServerMessage } from "./generated/ServerMessage";
export type { Stock } from "./generated/Stock";
export type { Tile } from "./generated/Tile";
export type { TileData } from "./generated/TileData";
export type { TileEvent } from "./generated/TileEvent";
export type { TileType } from "./generated/TileType";

// ============================================================
// Client-only extensions
// ============================================================

// Server's TurnPhase + client-only "GameOver" (set when GameEnded is received)
import type { TurnPhase as ServerTurnPhase } from "./generated/TurnPhase";
export type TurnPhase = ServerTurnPhase | "GameOver";
