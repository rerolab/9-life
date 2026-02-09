import { useState } from "react";
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

  // Waiting room (after room is created/joined)
  if (roomId) {
    return (
      <div className="lobby">
        <h1 className="lobby-title">9-life</h1>

        <div className="lobby-room-info">
          <div className="room-id-label">部屋ID</div>
          <div className="room-id-value">{roomId}</div>
          {inviteUrl && <div className="invite-url">{inviteUrl}</div>}
        </div>

        <div className="lobby-card">
          <h2>参加者 ({players.length})</h2>
          <ul className="lobby-players-list">
            {players.map((p, i) => (
              <li key={p.id}>
                <span
                  className="player-avatar"
                  style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                >
                  {p.name.charAt(0)}
                </span>
                {p.name}
              </li>
            ))}
          </ul>

          {isHost && players.length >= 2 && (
            <button className="btn-green btn-lg" onClick={handleStart}>
              ゲーム開始!
            </button>
          )}
          {isHost && players.length < 2 && (
            <p className="lobby-waiting">他のプレイヤーを待っています...</p>
          )}
          {!isHost && (
            <p className="lobby-waiting">ホストの開始を待っています...</p>
          )}
        </div>

        <button className="btn-text" onClick={onDisconnect}>退出する</button>
      </div>
    );
  }

  // Join mode: show room ID input
  if (mode === "join") {
    return (
      <div className="lobby">
        <h1 className="lobby-title">9-life</h1>

        <div className="lobby-card">
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
          <button className="btn-blue btn-lg" onClick={handleJoin}>
            参加する
          </button>
        </div>

        <button className="btn-text" onClick={() => setMode("home")}>もどる</button>
      </div>
    );
  }

  // Home: name input + two big buttons
  return (
    <div className="lobby">
      <h1 className="lobby-title">9-life</h1>
      <p className="lobby-subtitle">みんなで楽しむ人生ゲーム</p>

      <div className="lobby-card">
        <div className="lobby-field">
          <label>プレイヤー名</label>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="名前を入力"
            autoFocus
          />
        </div>
      </div>

      <div className="lobby-actions">
        <button className="btn-lg" onClick={handleCreate}>
          部屋をつくる
        </button>
        <button className="btn-blue btn-lg" onClick={() => setMode("join")}>
          部屋にはいる
        </button>
      </div>
    </div>
  );
}
