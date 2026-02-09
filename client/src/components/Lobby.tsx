import { useState } from "react";
import type { ClientMessage, PlayerInfo } from "../types/protocol";

interface LobbyProps {
  roomId: string | null;
  inviteUrl: string | null;
  players: PlayerInfo[];
  isHost: boolean;
  onSend: (msg: ClientMessage) => void;
}

const AVATAR_COLORS = ["#e60012", "#0ab5f5", "#4fc436", "#ff9800", "#8e24aa", "#00acc1"];

export default function Lobby({
  roomId,
  inviteUrl,
  players,
  isHost,
  onSend,
}: LobbyProps) {
  const [playerName, setPlayerName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [mapId, setMapId] = useState("classic");

  const handleCreate = () => {
    if (!playerName.trim()) return;
    onSend({ type: "CreateRoom", player_name: playerName.trim(), map_id: mapId });
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

  // Before room is created/joined
  if (!roomId) {
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
              placeholder="名前を入力..."
            />
          </div>
        </div>

        <div className="lobby-card">
          <h2><span className="icon icon-red">+</span>部屋を作成</h2>
          <div className="lobby-field">
            <label>マップ</label>
            <select value={mapId} onChange={(e) => setMapId(e.target.value)}>
              <option value="classic">クラシック</option>
            </select>
          </div>
          <button onClick={handleCreate}>作成する</button>
        </div>

        <div className="lobby-divider">または</div>

        <div className="lobby-card">
          <h2><span className="icon icon-blue">→</span>部屋に参加</h2>
          <div className="lobby-field">
            <label>部屋ID</label>
            <input
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              placeholder="部屋IDを入力..."
            />
          </div>
          <button className="btn-blue" onClick={handleJoin}>参加する</button>
        </div>
      </div>
    );
  }

  // After room is created/joined — waiting for game start
  return (
    <div className="lobby">
      <h1 className="lobby-title">9-life</h1>
      <p className="lobby-subtitle">ロビー</p>

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
          <button className="btn-green" onClick={handleStart}>ゲーム開始!</button>
        )}
        {isHost && players.length < 2 && (
          <p className="lobby-waiting">ゲーム開始には2人以上必要です</p>
        )}
        {!isHost && (
          <p className="lobby-waiting">ホストがゲームを開始するのを待っています...</p>
        )}
      </div>
    </div>
  );
}
