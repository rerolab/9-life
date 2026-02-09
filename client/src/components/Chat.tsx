import { useState } from "react";
import type { ClientMessage, PlayerState } from "../types/protocol";

interface ChatEntry {
  player_id: string;
  text: string;
}

interface ChatProps {
  log: ChatEntry[];
  players: PlayerState[];
  onSend: (msg: ClientMessage) => void;
}

export default function Chat({ log, players, onSend }: ChatProps) {
  const [text, setText] = useState("");

  const playerName = (id: string) =>
    players.find((p) => p.id === id)?.name ?? id;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend({ type: "ChatMessage", text: text.trim() });
    setText("");
  };

  return (
    <div className="chat">
      <h3>チャット</h3>
      <div className="chat-log">
        {log.map((entry, i) => (
          <div key={i} className="chat-entry">
            <strong>{playerName(entry.player_id)}:</strong> {entry.text}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="chat-form">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="メッセージを入力"
        />
        <button type="submit">送信</button>
      </form>
    </div>
  );
}
