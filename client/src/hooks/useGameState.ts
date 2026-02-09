import { useCallback, useReducer } from "react";
import type {
  Choice,
  GameState,
  MapData,
  PlayerState,
  ServerMessage,
  TurnPhase,
} from "../types/protocol";

interface ChatEntry {
  player_id: string;
  text: string;
}

export interface AppState {
  roomId: string | null;
  inviteUrl: string | null;
  players: PlayerState[];
  board: MapData | null;
  turnOrder: string[];
  currentTurn: number;
  phase: TurnPhase;
  rouletteValue: number | null;
  choices: Choice[];
  rankings: PlayerState[];
  chatLog: ChatEntry[];
  error: string | null;
  gameStarted: boolean;
}

const initialState: AppState = {
  roomId: null,
  inviteUrl: null,
  players: [],
  board: null,
  turnOrder: [],
  currentTurn: 0,
  phase: "WaitingForSpin",
  rouletteValue: null,
  choices: [],
  rankings: [],
  chatLog: [],
  error: null,
  gameStarted: false,
};

type Action = { type: "SERVER_MESSAGE"; msg: ServerMessage } | { type: "RESET" };

function reducer(state: AppState, action: Action): AppState {
  if (action.type === "RESET") return initialState;

  const msg = action.msg;
  switch (msg.type) {
    case "RoomCreated":
      return { ...state, roomId: msg.room_id, inviteUrl: msg.invite_url };

    case "PlayerJoined":
      return {
        ...state,
        players: state.players.some((p) => p.id === msg.player.id)
          ? state.players
          : [...state.players, msg.player],
      };

    case "PlayerLeft":
      return {
        ...state,
        players: state.players.filter((p) => p.id !== msg.player_id),
      };

    case "GameStarted":
      return {
        ...state,
        board: msg.board,
        players: msg.players,
        turnOrder: msg.turn_order,
        gameStarted: true,
        phase: "WaitingForSpin",
        currentTurn: 0,
      };

    case "RouletteResult":
      return { ...state, rouletteValue: msg.value, phase: "Moving" };

    case "PlayerMoved":
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === msg.player_id ? { ...p, position: msg.position } : p,
        ),
        phase: msg.event ? "Event" : "TurnEnd",
      };

    case "EventResult":
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === msg.player_id ? { ...p, ...msg.changes } : p,
        ),
        phase: "TurnEnd",
      };

    case "ChoiceRequired":
      return { ...state, choices: msg.choices, phase: "ChoiceRequired" };

    case "GameEnded":
      return { ...state, rankings: msg.rankings, phase: "GameOver" };

    case "ChatBroadcast":
      return {
        ...state,
        chatLog: [
          ...state.chatLog,
          { player_id: msg.player_id, text: msg.text },
        ],
      };

    case "Error":
      return { ...state, error: msg.message };

    default:
      return state;
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
