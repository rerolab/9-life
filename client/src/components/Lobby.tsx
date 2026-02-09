import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { ClientMessage, PlayerInfo } from "../types/protocol";

interface LobbyProps {
  roomId: string | null;
  inviteUrl: string | null;
  players: PlayerInfo[];
  isHost: boolean;
  onSend: (msg: ClientMessage) => void;
  connected: boolean;
  onDisconnect: () => void;
}

const AVATAR_COLORS = ["#e60012", "#0ab5f5", "#4fc436", "#ff9800", "#8e24aa", "#00acc1"];

function Title() {
  return (
    <motion.h1
      className="lobby-title"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
    >
      <span className="lobby-title-nine">9</span><span className="lobby-title-sep" aria-hidden="true" /><span className="lobby-title-life">life</span>
    </motion.h1>
  );
}

export default function Lobby({
  roomId,
  inviteUrl,
  players,
  isHost,
  onSend,
  connected,
  onDisconnect,
}: LobbyProps) {
  const [playerName, setPlayerName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [mode, setMode] = useState<"home" | "join">("home");
  const [copiedField, setCopiedField] = useState<"roomId" | "url" | null>(null);

  const copyToClipboard = useCallback((text: string, field: "roomId" | "url") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }, []);

  const handleCreate = () => {
    if (!playerName.trim()) return;
    onSend({ type: "CreateRoom", player_name: playerName.trim(), map_id: "classic" });
  };

  const handleJoin = () => {
    if (!playerName.trim() || !joinRoomId.trim()) return;
    onSend({
      type: "JoinRoom",
      room_id: joinRoomId.trim(),
      player_name: playerName.trim(),
    });
  };

  const handleStart = () => {
    onSend({ type: "StartGame" } as ClientMessage);
  };

  const modeTransition = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.25 },
  };

  const currentMode = roomId ? "waiting" : mode;

  return (
    <AnimatePresence mode="wait">
      {currentMode === "waiting" && (
        <motion.div
          key="waiting"
          className="lobby"
          {...modeTransition}
        >
          <Title />

          <div className="lobby-room-info">
            <div className="room-id-label">部屋ID</div>
            <button
              className="room-id-copy-row"
              onClick={() => roomId && copyToClipboard(roomId, "roomId")}
              title="部屋IDをコピー"
            >
              <span className="room-id-value">{roomId}</span>
              <span className="copy-icon">{copiedField === "roomId" ? "✓" : "⧉"}</span>
            </button>
            {inviteUrl && (
              <button
                className="invite-url-copy-row"
                onClick={() => copyToClipboard(inviteUrl, "url")}
                title="招待URLをコピー"
              >
                <span className="invite-url-text">{inviteUrl}</span>
                <span className="copy-icon">{copiedField === "url" ? "✓" : "⧉"}</span>
              </button>
            )}
            <AnimatePresence>
              {copiedField && (
                <motion.div
                  className="copy-toast"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  コピーしました!
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.div
            className="lobby-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.15 }}
          >
            <h2>参加者 ({players.length})</h2>
            <ul className="lobby-players-list">
              {players.map((p, i) => (
                <motion.li
                  key={p.id}
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  <span
                    className="player-avatar"
                    style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                  >
                    {p.name.charAt(0)}
                  </span>
                  {p.name}
                </motion.li>
              ))}
            </ul>

            {isHost && players.length >= 2 && (
              <motion.button
                className="btn-green btn-lg"
                onClick={handleStart}
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.92 }}
              >
                ゲーム開始!
              </motion.button>
            )}
            {isHost && players.length < 2 && (
              <motion.p
                className="lobby-waiting"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                他のプレイヤーを待っています...
              </motion.p>
            )}
            {!isHost && (
              <motion.p
                className="lobby-waiting"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ホストの開始を待っています...
              </motion.p>
            )}
          </motion.div>

          <motion.button
            className="btn-text"
            onClick={onDisconnect}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.94, y: 2 }}
          >
            退出する
          </motion.button>
        </motion.div>
      )}

      {currentMode === "join" && (
        <motion.div
          key="join"
          className="lobby"
          {...modeTransition}
        >
          <Title />

          <motion.div
            className="lobby-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.15 }}
          >
            <div className="lobby-field">
              <label>プレイヤー名</label>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="名前を入力"
                autoFocus
              />
            </div>
            <div className="lobby-field">
              <label>部屋ID</label>
              <input
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                placeholder="部屋IDを入力"
              />
            </div>
            <motion.button
              className="btn-blue btn-lg"
              onClick={handleJoin}
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.94, y: 2 }}
            >
              参加する
            </motion.button>
          </motion.div>

          <motion.button
            className="btn-text"
            onClick={() => setMode("home")}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.94, y: 2 }}
          >
            もどる
          </motion.button>
        </motion.div>
      )}

      {currentMode === "home" && (
        <motion.div
          key="home"
          className="lobby"
          {...modeTransition}
        >
          <Title />
          <motion.p
            className="lobby-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            みんなで楽しむ人生ゲーム
          </motion.p>

          <motion.div
            className="lobby-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.15 }}
          >
            <div className="lobby-field">
              <label>プレイヤー名</label>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="名前を入力"
                autoFocus
              />
            </div>
          </motion.div>

          <div className="lobby-actions">
            <motion.button
              className="btn-lg"
              onClick={handleCreate}
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.94, y: 2 }}
            >
              部屋をつくる
            </motion.button>
            <motion.button
              className="btn-blue btn-lg"
              onClick={() => setMode("join")}
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.94, y: 2 }}
            >
              部屋にはいる
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
