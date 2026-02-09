import { useEffect, useState } from "react";
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

type GameTab = "board" | "players" | "chat";

export default function App() {
  const { status, connect, sendMessage, onMessage } = useWebSocket();
  const { state, handleServerMessage, reset } = useGameState();
  const [activeTab, setActiveTab] = useState<GameTab>("board");

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
        {state.error && <div className="error-banner">{state.error}</div>}

        <Lobby
          roomId={state.roomId}
          inviteUrl={state.inviteUrl}
          players={state.players}
          isHost={isHost}
          onSend={handleSend}
          connected={status === "connected"}
          onDisconnect={reset}
        />
      </div>
    );
  }

  // In-game view
  return (
    <div className="app game-view">
      {state.error && <div className="error-banner">{state.error}</div>}

      {/* Desktop layout */}
      <div className="game-layout desktop-only">
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

      {/* Mobile layout */}
      <div className="game-mobile mobile-only">
        <Roulette
          spinning={state.phase === "Spinning"}
          result={state.rouletteValue}
          onSpin={() => handleSend({ type: "SpinRoulette" })}
          disabled={!isMyTurn || state.phase !== "WaitingForSpin"}
        />

        <div className="mobile-tab-content">
          {activeTab === "board" && state.board && (
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

          {activeTab === "players" && (
            <div className="players-panel">
              {state.playerStates.map((ps) => (
                <PlayerInfo
                  key={ps.id}
                  player={ps}
                  isCurrent={ps.id === currentPlayerId}
                />
              ))}
            </div>
          )}

          {activeTab === "chat" && (
            <Chat
              log={state.chatLog}
              onSend={handleSend}
            />
          )}
        </div>

        <nav className="mobile-tab-bar">
          <button
            className={`tab-btn ${activeTab === "board" ? "active" : ""}`}
            onClick={() => setActiveTab("board")}
          >
            <span className="tab-icon">&#9776;</span>
            マップ
          </button>
          <button
            className={`tab-btn ${activeTab === "players" ? "active" : ""}`}
            onClick={() => setActiveTab("players")}
          >
            <span className="tab-icon">&#9786;</span>
            情報
          </button>
          <button
            className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            <span className="tab-icon">&#9993;</span>
            チャット
          </button>
        </nav>
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
            <h2>ゲーム終了!</h2>
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
