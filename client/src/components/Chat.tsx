import { useState } from "react";
import { motion } from "motion/react";
import type { ClientMessage } from "../types/protocol";

interface ChatEntry {
  player_id: string;
  player_name: string;
  text: string;
}

interface ChatProps {
  log: ChatEntry[];
  onSend: (msg: ClientMessage) => void;
}

export default function Chat({ log, onSend }: ChatProps) {
  const [text, setText] = useState("");

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
          <motion.div
            key={i}
            className="chat-entry"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <strong>{entry.player_name}:</strong> {entry.text}
          </motion.div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="chat-form">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="メッセージを入力"
        />
        <motion.button type="submit" whileTap={{ scale: 0.9 }}>
          送信
        </motion.button>
      </form>
    </div>
  );
}
