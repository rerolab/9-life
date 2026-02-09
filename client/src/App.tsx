import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useGameState } from "./hooks/useGameState";
import type { ClientMessage } from "./types/protocol";
import Lobby from "./components/Lobby";
import Roulette from "./components/Roulette";
import Chat from "./components/Chat";
import EventDialog from "./components/EventDialog";
import Board from "./components/Board";
import PlayerInfo from "./components/PlayerInfo";
import GameOverScreen from "./components/GameOverScreen";

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

  const boardProps = {
    board: {
      id: "",
      name: "",
      version: "",
      start_money: 0,
      loan_unit: 0,
      loan_interest_rate: 0,
      tiles: state.board?.tiles ?? [],
      careers: state.careers,
      houses: state.houses,
    },
    players: state.playerStates,
    prevPositions: state.prevPlayerPositions,
    currentPlayerId,
  };

  return (
    <div className="app">
      <AnimatePresence>
        {state.error && (
          <motion.div
            key="error"
            className="error-banner"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            {state.error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!state.gameStarted ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <Lobby
              roomId={state.roomId}
              inviteUrl={state.inviteUrl}
              players={state.players}
              isHost={isHost}
              onSend={handleSend}
              connected={status === "connected"}
              onDisconnect={reset}
            />
          </motion.div>
        ) : (
          <motion.div
            key="game"
            className="game-view"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {/* Desktop layout */}
            <div className="game-layout desktop-only">
              <div className="game-main">
                {state.board && <Board {...boardProps} />}

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
                <AnimatePresence mode="wait">
                  {activeTab === "board" && state.board && (
                    <motion.div
                      key="board"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Board {...boardProps} />
                    </motion.div>
                  )}

                  {activeTab === "players" && (
                    <motion.div
                      key="players"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="players-panel">
                        {state.playerStates.map((ps) => (
                          <PlayerInfo
                            key={ps.id}
                            player={ps}
                            isCurrent={ps.id === currentPlayerId}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === "chat" && (
                    <motion.div
                      key="chat"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Chat
                        log={state.chatLog}
                        onSend={handleSend}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <nav className="mobile-tab-bar">
                <motion.button
                  className={`tab-btn ${activeTab === "board" ? "active" : ""}`}
                  onClick={() => setActiveTab("board")}
                  whileTap={{ scale: 0.9 }}
                >
                  <span className="tab-icon">&#9776;</span>
                  マップ
                </motion.button>
                <motion.button
                  className={`tab-btn ${activeTab === "players" ? "active" : ""}`}
                  onClick={() => setActiveTab("players")}
                  whileTap={{ scale: 0.9 }}
                >
                  <span className="tab-icon">&#9786;</span>
                  情報
                </motion.button>
                <motion.button
                  className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
                  onClick={() => setActiveTab("chat")}
                  whileTap={{ scale: 0.9 }}
                >
                  <span className="tab-icon">&#9993;</span>
                  チャット
                </motion.button>
              </nav>
            </div>

            <AnimatePresence>
              {state.phase === "ChoosingPath" && state.choices.length > 0 && (
                <EventDialog key="path-dialog" choices={state.choices} onSend={handleSend} mode="path" />
              )}
              {state.phase === "ChoosingAction" && state.choices.length > 0 && (
                <EventDialog key="action-dialog" choices={state.choices} onSend={handleSend} mode="action" />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {state.phase === "GameOver" && (
                <GameOverScreen rankings={state.rankings} />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
