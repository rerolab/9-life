import { motion, type Variants } from "motion/react";
import type { Choice, ClientMessage } from "../types/protocol";

interface EventDialogProps {
  choices: Choice[];
  onSend: (msg: ClientMessage) => void;
  mode: "action" | "path";
}

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const dialogVariants: Variants = {
  hidden: { scale: 0.8, y: 40, opacity: 0 },
  visible: {
    scale: 1,
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 22, mass: 0.8 },
  },
  exit: {
    scale: 0.85,
    y: 20,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

const choiceVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: 0.15 + i * 0.08,
      type: "spring",
      stiffness: 350,
      damping: 25,
    },
  }),
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.15 },
  },
};

export default function EventDialog({
  choices,
  onSend,
  mode,
}: EventDialogProps) {
  if (choices.length === 0) return null;

  return (
    <motion.div
      className="event-dialog-overlay"
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div
        className="event-dialog"
        variants={dialogVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.h3
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
        >
          選択してください
        </motion.h3>
        <div className="event-choices">
          {choices.map((c, index) => (
            <motion.button
              key={c.id}
              custom={index}
              variants={choiceVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (mode === "path") {
                  onSend({ type: "ChoicePath", path_index: index });
                } else {
                  onSend({ type: "ChoiceAction", action_id: c.id });
                }
              }}
            >
              {c.label}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
