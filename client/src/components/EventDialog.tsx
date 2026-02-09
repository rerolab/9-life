import type { Choice, ClientMessage } from "../types/protocol";

interface EventDialogProps {
  choices: Choice[];
  onSend: (msg: ClientMessage) => void;
}

export default function EventDialog({ choices, onSend }: EventDialogProps) {
  if (choices.length === 0) return null;

  return (
    <div className="event-dialog-overlay">
      <div className="event-dialog">
        <h3>選択してください</h3>
        <div className="event-choices">
          {choices.map((c) => (
            <button
              key={c.id}
              onClick={() => onSend({ type: "ChoiceAction", action_id: c.id })}
            >
              {c.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
