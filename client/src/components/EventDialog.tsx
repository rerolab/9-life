import type { Choice, ClientMessage } from "../types/protocol";

interface EventDialogProps {
  choices: Choice[];
  onSend: (msg: ClientMessage) => void;
  mode: "action" | "path";
}

export default function EventDialog({ choices, onSend, mode }: EventDialogProps) {
  if (choices.length === 0) return null;

  return (
    <div className="event-dialog-overlay">
      <div className="event-dialog">
        <h3>選択してください</h3>
        <div className="event-choices">
          {choices.map((c, index) => (
            <button
              key={c.id}
              onClick={() => {
                if (mode === "path") {
                  onSend({ type: "ChoicePath", path_index: index });
                } else {
                  onSend({ type: "ChoiceAction", action_id: c.id });
                }
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
