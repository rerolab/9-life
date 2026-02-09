import { useState } from "react";
import type { ClientMessage, PlayerState } from "../types/protocol";

interface LobbyProps {
  roomId: string | null;
  inviteUrl: string | null;
  players: PlayerState[];
  isHost: boolean;
  onSend: (msg: ClientMessage) => void;
}

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
        <h1>9-life</h1>

        <div className="lobby-section">
          <label>
            プレイヤー名:
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="名前を入力"
            />
          </label>
        </div>

        <div className="lobby-section">
          <h2>部屋を作成</h2>
          <label>
            マップ:
            <select value={mapId} onChange={(e) => setMapId(e.target.value)}>
              <option value="classic">クラシック</option>
            </select>
          </label>
          <button onClick={handleCreate}>作成</button>
        </div>

        <div className="lobby-section">
          <h2>部屋に参加</h2>
          <label>
            部屋ID:
            <input
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              placeholder="部屋IDを入力"
            />
          </label>
          <button onClick={handleJoin}>参加</button>
        </div>
      </div>
    );
  }

  // After room is created/joined — waiting for game start
  return (
    <div className="lobby">
      <h1>9-life - ロビー</h1>
      <p>
        部屋ID: <strong>{roomId}</strong>
      </p>
      {inviteUrl && (
        <p>
          招待URL: <code>{inviteUrl}</code>
        </p>
      )}

      <h2>参加者 ({players.length})</h2>
      <ul>
        {players.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>

      {isHost && players.length >= 2 && (
        <button onClick={handleStart}>ゲーム開始</button>
      )}
      {isHost && players.length < 2 && (
        <p>ゲーム開始には2人以上必要です</p>
      )}
    </div>
  );
}
