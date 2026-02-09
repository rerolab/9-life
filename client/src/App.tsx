import { useEffect } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useGameState } from "./hooks/useGameState";
import type { ClientMessage } from "./types/protocol";
import Lobby from "./components/Lobby";
import Roulette from "./components/Roulette";
import Chat from "./components/Chat";
import EventDialog from "./components/EventDialog";
import Board from "./components/Board";
import PlayerInfo from "./components/PlayerInfo";

const DEFAULT_WS_URL =
  import.meta.env.VITE_WS_URL ??
  (location.protocol === "https:"
    ? `wss://${location.hostname.replace(/\.\w+$/, "")}-server.fly.dev/ws`
    : "ws://localhost:3000/ws");

export default function App() {
  const { status, connect, sendMessage, onMessage } = useWebSocket();
  const { state, handleServerMessage, reset } = useGameState();

  useEffect(() => {
    onMessage((msg) => {
      handleServerMessage(msg);
    });
  }, [onMessage, handleServerMessage]);

  const handleSend = (msg: ClientMessage) => {
    if (status !== "connected") {
      connect(DEFAULT_WS_URL);
      const interval = setInterval(() => {
        sendMessage(msg);
        clearInterval(interval);
      }, 500);
      return;
    }
    sendMessage(msg);
  };

  const isHost = state.players.length > 0 && state.players[0]?.id === state.myPlayerId;
  const currentPlayerId =
    state.turnOrder.length > 0
      ? state.turnOrder[state.currentTurn % state.turnOrder.length]
      : null;
  const isMyTurn = currentPlayerId === state.myPlayerId;

  // Not in game yet - show lobby
  if (!state.gameStarted) {
    return (
      <div className="app">
        <div className="connection-bar">
          <span className="ws-url">{DEFAULT_WS_URL}</span>
          <button
            onClick={() =>
              status === "connected" ? reset() : connect(DEFAULT_WS_URL)
            }
          >
            {status === "connected"
              ? "切断"
              : status === "connecting"
                ? "接続中..."
                : "接続"}
          </button>
          <span className={`status-indicator ${status}`} />
        </div>

        {state.error && <div className="error-banner">{state.error}</div>}

        <Lobby
          roomId={state.roomId}
          inviteUrl={state.inviteUrl}
          players={state.players}
          isHost={isHost}
          onSend={handleSend}
        />
      </div>
    );
  }

  // In-game view
  return (
    <div className="app game-view">
      {state.error && <div className="error-banner">{state.error}</div>}

      <div className="game-layout">
        <div className="game-main">
          {state.board && (
            <Board
              board={{
                id: "",
                name: "",
                version: "",
                start_money: 0,
                loan_unit: 0,
                loan_interest_rate: 0,
                tiles: state.board.tiles,
                careers: state.careers,
                houses: state.houses,
              }}
              players={state.playerStates}
            />
          )}

          <Roulette
            spinning={state.phase === "Spinning"}
            result={state.rouletteValue}
            onSpin={() => handleSend({ type: "SpinRoulette" })}
            disabled={!isMyTurn || state.phase !== "WaitingForSpin"}
          />
        </div>

        <div className="game-sidebar">
          <div className="players-panel">
            <h3>プレイヤー</h3>
            {state.playerStates.map((ps) => (
              <PlayerInfo
                key={ps.id}
                player={ps}
                isCurrent={ps.id === currentPlayerId}
              />
            ))}
          </div>

          <Chat
            log={state.chatLog}
            onSend={handleSend}
          />
        </div>
      </div>

      {state.phase === "ChoosingPath" && state.choices.length > 0 && (
        <EventDialog choices={state.choices} onSend={handleSend} mode="path" />
      )}

      {state.phase === "ChoosingAction" && state.choices.length > 0 && (
        <EventDialog choices={state.choices} onSend={handleSend} mode="action" />
      )}

      {state.phase === "GameOver" && (
        <div className="event-dialog-overlay">
          <div className="event-dialog">
            <h2>ゲーム終了</h2>
            <ol>
              {state.rankings.map((r) => (
                <li key={r.player_id}>
                  {r.rank}位: {r.player_name} - ${r.total_assets.toLocaleString()}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
