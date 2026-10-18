export interface VerificationAttemptRecord {
  timestamp: string;
  result: "MATCHED" | "NOT_MATCHED" | "INCONCLUSIVE";
  similarity: number;
  riderId: string;
}

export interface VerificationState {
  riderId: string;
  attemptsRemaining: number;
  failedAttempts: number;
  locked: boolean;
  lockedUntil?: string;
  history: VerificationAttemptRecord[];
  caseId?: string;
}

const ATTEMPTS_KEY_PREFIX = "kinetics_verify_state_";

export function getVerificationState(riderId: string): VerificationState {
  const stored = localStorage.getItem(`${ATTEMPTS_KEY_PREFIX}${riderId}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Check 24 hour reset
      if (parsed.history && parsed.history.length > 0) {
        const lastAttempt = new Date(parsed.history[parsed.history.length - 1].timestamp).getTime();
        const now = Date.now();
        if (now - lastAttempt > 24 * 60 * 60 * 1000) {
          // Reset after 24 hours
          return {
            riderId,
            attemptsRemaining: 3,
            failedAttempts: 0,
            locked: false,
            history: [],
          };
        }
      }
      return parsed;
    } catch {
      // ignore
    }
  }

  return {
    riderId,
    attemptsRemaining: 3,
    failedAttempts: 0,
    locked: false,
    history: [],
  };
}

export function saveVerificationState(state: VerificationState): void {
  localStorage.setItem(`${ATTEMPTS_KEY_PREFIX}${state.riderId}`, JSON.stringify(state));
}

/**
 * Record a verification attempt result and enforce locking rules
 */
export function recordVerificationAttempt(
  riderId: string,
  result: "MATCHED" | "NOT_MATCHED" | "INCONCLUSIVE",
  similarity: number
): {
  state: VerificationState;
  lockedNow: boolean;
} {
  const currentState = getVerificationState(riderId);

  const attemptRecord: VerificationAttemptRecord = {
    timestamp: new Date().toISOString(),
    result,
    similarity,
    riderId,
  };

  const updatedHistory = [...currentState.history, attemptRecord];

  let failedAttempts = currentState.failedAttempts;
  let attemptsRemaining = currentState.attemptsRemaining;
  let locked = currentState.locked;
  let lockedNow = false;
  let caseId = currentState.caseId;

  if (result === "NOT_MATCHED") {
    failedAttempts += 1;
    attemptsRemaining = Math.max(0, 3 - failedAttempts);

    if (failedAttempts >= 3) {
      locked = true;
      lockedNow = true;
      caseId = `case_mismatch_${Date.now()}`;
    }
  } else if (result === "MATCHED") {
    // Successful match clears failed attempts counter
    failedAttempts = 0;
    attemptsRemaining = 3;
    locked = false;
  }
  // INCONCLUSIVE does not change failedAttempts or attemptsRemaining

  const newState: VerificationState = {
    riderId,
    attemptsRemaining,
    failedAttempts,
    locked,
    lockedUntil: locked ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : undefined,
    history: updatedHistory,
    caseId,
  };

  saveVerificationState(newState);

  // Notify Live Monitor (without images)
  try {
    const liveEvents = JSON.parse(localStorage.getItem("kinetics_live_events") || "[]");
    liveEvents.unshift({
      id: `evt_verify_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: "BIOMETRIC_VERIFICATION",
      riderId,
      result,
      similarity,
      attemptsRemaining,
      locked,
    });
    localStorage.setItem("kinetics_live_events", JSON.stringify(liveEvents.slice(0, 100)));
  } catch (err) {
    console.warn("Failed to update live monitor events", err);
  }

  return { state: newState, lockedNow };
}
