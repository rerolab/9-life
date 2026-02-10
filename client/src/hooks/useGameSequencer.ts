import { useCallback, useRef } from "react";
import type { ServerMessage } from "../types/protocol";

/** Messages that bypass the batch pipeline and dispatch immediately */
const PASSTHROUGH = new Set([
  "RoomCreated", "PlayerJoined", "PlayerLeft", "RoomState",
  "GameStarted", "ChatBroadcast", "Error",
]);

type Stage = "roulette" | "move" | "event" | "choice" | "turnEnd" | "sync";
const STAGE_ORDER: Stage[] = ["roulette", "move", "event", "choice", "turnEnd", "sync"];

const STAGE_TIMEOUTS: Record<Stage, number> = {
  roulette: 8000,
  move: 1200,
  event: 3800,
  choice: 0,    // no timeout — waits for next batch
  turnEnd: 2500,
  sync: 0,      // instant
};

interface TurnBatch {
  rouletteResult: ServerMessage | null;
  playerMoved: ServerMessage | null;
  choiceRequired: ServerMessage | null;
  turnChanged: ServerMessage | null;
  gameEnded: ServerMessage | null;
  gameSync: ServerMessage | null;
}

function emptyBatch(): TurnBatch {
  return {
    rouletteResult: null,
    playerMoved: null,
    choiceRequired: null,
    turnChanged: null,
    gameEnded: null,
    gameSync: null,
  };
}

export interface SequencerSignals {
  onRouletteComplete: () => void;
  onMoveComplete: () => void;
  onEventComplete: () => void;
  onTurnBannerComplete: () => void;
}

export function useGameSequencer(
  handleServerMessage: (msg: ServerMessage) => void,
  myPlayerId: string | null,
): {
  processMessage: (msg: ServerMessage) => void;
  signals: SequencerSignals;
} {
  const dispatchRef = useRef(handleServerMessage);
  dispatchRef.current = handleServerMessage;

  const myPlayerIdRef = useRef(myPlayerId);
  myPlayerIdRef.current = myPlayerId;

  const pendingBatch = useRef<TurnBatch>(emptyBatch());
  const batchQueue = useRef<TurnBatch[]>([]);
  const running = useRef(false);
  const stageIdx = useRef(0);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const awaitingSignal = useRef(false);

  const advanceStage = useCallback(() => {
    if (fallbackTimer.current !== undefined) {
      clearTimeout(fallbackTimer.current);
      fallbackTimer.current = undefined;
    }
    awaitingSignal.current = false;
    stageIdx.current++;
    runPipeline();
  }, []);

  const runPipeline = useCallback(() => {
    if (batchQueue.current.length === 0) {
      running.current = false;
      return;
    }

    const batch = batchQueue.current[0];
    const stages = STAGE_ORDER;

    while (stageIdx.current < stages.length) {
      const stage = stages[stageIdx.current];
      const isMyTurn = batch.rouletteResult !== null; // if we have roulette, it was our spin

      switch (stage) {
        case "roulette": {
          // Skip if not my spin
          if (!isMyTurn || batch.rouletteResult === null) {
            stageIdx.current++;
            continue;
          }
          dispatchRef.current(batch.rouletteResult);
          awaitingSignal.current = true;
          fallbackTimer.current = setTimeout(advanceStage, STAGE_TIMEOUTS.roulette);
          return; // wait for signal
        }

        case "move": {
          if (batch.playerMoved) dispatchRef.current(batch.playerMoved);
          if (batch.gameSync) dispatchRef.current(batch.gameSync);
          awaitingSignal.current = true;
          fallbackTimer.current = setTimeout(advanceStage, STAGE_TIMEOUTS.move);
          return; // wait for signal
        }

        case "event": {
          // Skip if there's a ChoiceRequired (dialog handles the event display)
          if (batch.choiceRequired) {
            stageIdx.current++;
            continue;
          }
          awaitingSignal.current = true;
          fallbackTimer.current = setTimeout(advanceStage, STAGE_TIMEOUTS.event);
          return; // wait for signal (EventToast auto-detects position change)
        }

        case "choice": {
          if (!batch.choiceRequired) {
            stageIdx.current++;
            continue;
          }
          dispatchRef.current(batch.choiceRequired);
          // choice stage completes when next batch arrives (user makes a choice → new batch)
          // So we just advance immediately — the choice dialog stays until new GameSync
          stageIdx.current++;
          continue;
        }

        case "turnEnd": {
          if (batch.gameEnded) {
            dispatchRef.current(batch.gameEnded);
            // GameEnded also implies game over — no need for turn banner signal
            stageIdx.current++;
            continue;
          }
          if (batch.turnChanged) {
            dispatchRef.current(batch.turnChanged);
            awaitingSignal.current = true;
            fallbackTimer.current = setTimeout(advanceStage, STAGE_TIMEOUTS.turnEnd);
            return; // wait for signal
          }
          stageIdx.current++;
          continue;
        }

        case "sync": {
          // GameSync was already dispatched in move stage; nothing to do
          stageIdx.current++;
          continue;
        }
      }
    }

    // Pipeline complete for this batch
    batchQueue.current.shift();
    stageIdx.current = 0;

    if (batchQueue.current.length > 0) {
      runPipeline();
    } else {
      running.current = false;
    }
  }, [advanceStage]);

  const startPipeline = useCallback(() => {
    if (running.current) return;
    if (batchQueue.current.length === 0) return;
    running.current = true;
    stageIdx.current = 0;
    runPipeline();
  }, [runPipeline]);

  const processMessage = useCallback((msg: ServerMessage) => {
    // Passthrough messages go directly to reducer
    if (PASSTHROUGH.has(msg.type)) {
      dispatchRef.current(msg);
      return;
    }

    // Accumulate into pending batch
    switch (msg.type) {
      case "RouletteResult":
        pendingBatch.current.rouletteResult = msg;
        break;
      case "PlayerMoved":
        pendingBatch.current.playerMoved = msg;
        break;
      case "ChoiceRequired":
        pendingBatch.current.choiceRequired = msg;
        break;
      case "TurnChanged":
        pendingBatch.current.turnChanged = msg;
        break;
      case "GameEnded":
        pendingBatch.current.gameEnded = msg;
        break;
      case "GameSync":
        // GameSync is always the last message in a burst — finalize the batch
        pendingBatch.current.gameSync = msg;
        batchQueue.current.push(pendingBatch.current);
        pendingBatch.current = emptyBatch();

        // If pipeline is waiting on choice stage and new batch arrives, advance
        if (running.current && awaitingSignal.current) {
          // Don't auto-advance — let the current stage's signal or fallback handle it
        }

        startPipeline();
        break;
    }
  }, [startPipeline]);

  const onRouletteComplete = useCallback(() => {
    if (awaitingSignal.current && stageIdx.current < STAGE_ORDER.length &&
        STAGE_ORDER[stageIdx.current] === "roulette") {
      advanceStage();
    }
  }, [advanceStage]);

  const onMoveComplete = useCallback(() => {
    if (awaitingSignal.current && stageIdx.current < STAGE_ORDER.length &&
        STAGE_ORDER[stageIdx.current] === "move") {
      advanceStage();
    }
  }, [advanceStage]);

  const onEventComplete = useCallback(() => {
    if (awaitingSignal.current && stageIdx.current < STAGE_ORDER.length &&
        STAGE_ORDER[stageIdx.current] === "event") {
      advanceStage();
    }
  }, [advanceStage]);

  const onTurnBannerComplete = useCallback(() => {
    if (awaitingSignal.current && stageIdx.current < STAGE_ORDER.length &&
        STAGE_ORDER[stageIdx.current] === "turnEnd") {
      advanceStage();
    }
  }, [advanceStage]);

  const signals: SequencerSignals = {
    onRouletteComplete,
    onMoveComplete,
    onEventComplete,
    onTurnBannerComplete,
  };

  return { processMessage, signals };
}
