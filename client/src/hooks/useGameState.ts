import { useCallback, useReducer } from "react";
import type {
  Board,
  Career,
  Choice,
  House,
  PlayerInfo,
  PlayerState,
  RankingEntry,
  ServerMessage,
  TurnPhase,
} from "../types/protocol";

interface ChatEntry {
  player_id: string;
  player_name: string;
  text: string;
}

export interface AppState {
  roomId: string | null;
  inviteUrl: string | null;
  myPlayerId: string | null;
  players: PlayerInfo[];
  turnOrder: string[];
  currentTurn: number;
  phase: TurnPhase;
  rouletteValue: number | null;
  choices: Choice[];
  rankings: RankingEntry[];
  chatLog: ChatEntry[];
  error: string | null;
  gameStarted: boolean;
  board: Board | null;
  playerStates: PlayerState[];
  careers: Career[];
  houses: House[];
}

const initialState: AppState = {
  roomId: null,
  inviteUrl: null,
  myPlayerId: null,
  players: [],
  turnOrder: [],
  currentTurn: 0,
  phase: "WaitingForSpin",
  rouletteValue: null,
  choices: [],
  rankings: [],
  chatLog: [],
  error: null,
  gameStarted: false,
  board: null,
  playerStates: [],
  careers: [],
  houses: [],
};

type Action = { type: "SERVER_MESSAGE"; msg: ServerMessage } | { type: "RESET" };

function reducer(state: AppState, action: Action): AppState {
  if (action.type === "RESET") return initialState;

  const msg = action.msg;

  // Clear error when any non-error message arrives
  const base = msg.type !== "Error" ? { ...state, error: null } : state;

  switch (msg.type) {
    case "RoomCreated":
      return {
        ...base,
        roomId: msg.room_id,
        inviteUrl: msg.invite_url,
        myPlayerId: msg.player_id,
      };

    case "PlayerJoined":
      return {
        ...base,
        players: base.players.some((p) => p.id === msg.player_id)
          ? base.players
          : [...base.players, { id: msg.player_id, name: msg.player_name }],
      };

    case "PlayerLeft":
      return {
        ...base,
        players: base.players.filter((p) => p.id !== msg.player_id),
      };

    case "RoomState":
      return {
        ...base,
        roomId: msg.room_id,
        players: msg.players,
      };

    case "GameStarted":
      return {
        ...base,
        turnOrder: msg.turn_order,
        gameStarted: true,
        phase: "WaitingForSpin",
        currentTurn: 0,
        board: msg.board,
        playerStates: msg.players,
        careers: msg.careers,
        houses: msg.houses,
      };

    case "GameSync":
      return {
        ...base,
        playerStates: msg.players,
        currentTurn: msg.current_turn,
        phase: msg.phase,
      };

    case "TurnChanged":
      return {
        ...base,
        currentTurn: msg.current_turn,
        rouletteValue: null,
      };

    case "RouletteResult":
      return { ...base, rouletteValue: msg.value, phase: "Moving" };

    case "PlayerMoved":
      return {
        ...base,
        phase: "TurnEnd",
      };

    case "ChoiceRequired":
      return { ...base, choices: msg.choices };

    case "GameEnded":
      return { ...base, rankings: msg.rankings, phase: "GameOver" };

    case "ChatBroadcast":
      return {
        ...base,
        chatLog: [
          ...base.chatLog,
          { player_id: msg.player_id, player_name: msg.player_name, text: msg.text },
        ],
      };

    case "Error":
      return { ...state, error: msg.message };

    default:
      return base;
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    dispatch({ type: "SERVER_MESSAGE", msg });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return { state, handleServerMessage, reset };
}
