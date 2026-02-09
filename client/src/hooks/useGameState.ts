import { useCallback, useReducer } from "react";
import type {
  Choice,
  PlayerInfo,
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
};

type Action = { type: "SERVER_MESSAGE"; msg: ServerMessage } | { type: "RESET" };

function reducer(state: AppState, action: Action): AppState {
  if (action.type === "RESET") return initialState;

  const msg = action.msg;
  switch (msg.type) {
    case "RoomCreated":
      return {
        ...state,
        roomId: msg.room_id,
        inviteUrl: msg.invite_url,
        myPlayerId: msg.player_id,
      };

    case "PlayerJoined":
      return {
        ...state,
        players: state.players.some((p) => p.id === msg.player_id)
          ? state.players
          : [...state.players, { id: msg.player_id, name: msg.player_name }],
      };

    case "PlayerLeft":
      return {
        ...state,
        players: state.players.filter((p) => p.id !== msg.player_id),
      };

    case "RoomState":
      return {
        ...state,
        roomId: msg.room_id,
        players: msg.players,
      };

    case "GameStarted":
      return {
        ...state,
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
          { player_id: msg.player_id, player_name: msg.player_name, text: msg.text },
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
