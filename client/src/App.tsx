import { useEffect, useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useGameState } from "./hooks/useGameState";
import type { ClientMessage } from "./types/protocol";
import Lobby from "./components/Lobby";
import Board from "./components/Board";
import Roulette from "./components/Roulette";
import PlayerInfo from "./components/PlayerInfo";
import Chat from "./components/Chat";
import EventDialog from "./components/EventDialog";

const DEFAULT_WS_URL =
  import.meta.env.VITE_WS_URL ??
  (location.protocol === "https:"
    ? `wss://${location.hostname.replace(/\.\w+$/, "")}-server.fly.dev/ws`
    : "ws://localhost:3000/ws");

export default function App() {
  const { status, connect, sendMessage, onMessage } = useWebSocket();
  const { state, handleServerMessage, reset } = useGameState();
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);

  // Register message handler
  useEffect(() => {
    onMessage((msg) => {
      handleServerMessage(msg);

      // Track own player id from RoomCreated or first PlayerJoined
      if (msg.type === "PlayerJoined" && myPlayerId === null) {
        setMyPlayerId(msg.player.id);
      }
    });
  }, [onMessage, handleServerMessage, myPlayerId]);

  const handleSend = (msg: ClientMessage) => {
    if (status !== "connected") {
      // Auto-connect on first action
      connect(wsUrl);
      // Queue the message after connect
      const interval = setInterval(() => {
        sendMessage(msg);
        clearInterval(interval);
      }, 500);
      return;
    }
    sendMessage(msg);
  };

  const isHost = state.players.length > 0 && state.players[0]?.id === myPlayerId;
  const currentPlayerId =
    state.turnOrder.length > 0
      ? state.turnOrder[state.currentTurn % state.turnOrder.length]
      : null;
  const isMyTurn = currentPlayerId === myPlayerId;

  // Not in game yet - show lobby
  if (!state.gameStarted) {
    return (
      <div className="app">
        <div className="connection-bar">
          <input
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            placeholder="WebSocket URL"
          />
          <button
            onClick={() =>
              status === "connected" ? reset() : connect(wsUrl)
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
          {state.board && <Board board={state.board} players={state.players} />}

          <Roulette
            spinning={state.phase === "Spinning"}
            result={state.rouletteValue}
            onSpin={() => handleSend({ type: "SpinRoulette" })}
            disabled={!isMyTurn || state.phase !== "WaitingForSpin"}
          />
        </div>

        <div className="game-sidebar">
          <div className="players-panel">
            {state.players.map((p) => (
              <PlayerInfo
                key={p.id}
                player={p}
                isCurrent={p.id === currentPlayerId}
              />
            ))}
          </div>

          <Chat
            log={state.chatLog}
            players={state.players}
            onSend={handleSend}
          />
        </div>
      </div>

      {state.phase === "ChoiceRequired" && (
        <EventDialog choices={state.choices} onSend={handleSend} />
      )}

      {state.phase === "GameOver" && (
        <div className="event-dialog-overlay">
          <div className="event-dialog">
            <h2>ゲーム終了</h2>
            <ol>
              {state.rankings.map((p, i) => (
                <li key={p.id}>
                  {i + 1}位: {p.name} - ${p.money.toLocaleString()}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
