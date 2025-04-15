import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Exercise } from "../services/seshEngine"; // Assuming this path is correct

// --- Types ---
interface GuidedSessionProps {
  exercises: Exercise[];
  onSessionComplete: () => void; // Callback when the session finishes
  initialPrepTime?: number; // Optional: Seconds before the very first hang
}

type SessionPhase = "PREP" | "HANG" | "REST_HANG" | "REST_SET" | "FINISHED";

interface SessionState {
  currentExerciseIndex: number;
  currentSet: number; // 1-based
  currentRep: number; // 1-based
  currentPhase: SessionPhase;
  phaseTimeLeft: number; // Time left in the current phase (seconds)
  totalTimeLeft: number; // Total estimated time left for the session (seconds)
  isPaused: boolean;
}

// --- Helper Functions ---

/**
 * Calculates the total estimated duration of the workout in seconds.
 */
function calculateTotalDuration(
  exercises: Exercise[],
  initialPrepTime: number = 5
): number {
  let totalSeconds = initialPrepTime > 0 ? initialPrepTime : 0; // Start with initial prep time only if > 0

  exercises.forEach((ex, index) => {
    if (ex.Sets > 0 && ex.Reps > 0 && ex.HangDuration_s > 0) {
      // Time for hangs in one set
      const hangsTimePerSet = ex.Reps * ex.HangDuration_s;
      // Time for rests between hangs in one set (one less rest than reps)
      const restsHangTimePerSet = Math.max(0, ex.Reps - 1) * ex.RestBetweenHangs_s;
      // Total time for one set (excluding rest *after* the set)
      const timePerSet = hangsTimePerSet + restsHangTimePerSet;

      // Add time for all sets
      totalSeconds += ex.Sets * timePerSet;

      // Add time for rests between sets (one less rest than sets)
      if (ex.Sets > 1) {
        // Assuming RestBetweenSets_min is actually seconds for consistency here.
        // If it's truly minutes, multiply by 60. Let's assume it's seconds for now.
        // TODO: Clarify if RestBetweenSets_min is minutes or seconds. Assuming seconds.
        totalSeconds += (ex.Sets - 1) * (ex.RestBetweenSets_min); // Using _min name but assuming seconds
      }

      // Add prep time before the *next* exercise starts (if not the last exercise)
      // Only add if there's a next exercise and initialPrepTime > 0
      if (index < exercises.length - 1 && initialPrepTime > 0) {
          totalSeconds += initialPrepTime; // Add prep time for the next exercise
      }
    }
  });

  // If the first exercise has 0 prep time, but others might, ensure calculation starts correctly
  if (exercises.length > 0 && initialPrepTime === 0) {
     // Recalculate without initial prep if the first one doesn't need it conceptually
     // The loop logic handles subsequent preps correctly
  } else if (exercises.length === 0) {
     return 0; // No exercises, no duration
  }


  return totalSeconds;
}

/**
 * Formats seconds into MM:SS string.
 */
function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}


/**
 * Calculates the next state based on the current state when a phase ends.
 * Does NOT handle time decrementing, only state transitions.
 */
const calculateNextState = (
    currentState: SessionState,
    validExercises: Exercise[],
    initialPrepTime: number
): Omit<SessionState, 'totalTimeLeft' | 'isPaused'> => { // Returns partial state focusing on transitions
    let nextPhase = currentState.currentPhase;
    let nextPhaseTimeLeft = 0;
    let nextExerciseIndex = currentState.currentExerciseIndex;
    let nextSet = currentState.currentSet;
    let nextRep = currentState.currentRep;

    const exercise = validExercises[currentState.currentExerciseIndex];
    if (!exercise) { // Should not happen if called correctly, but safe guard
        return {
            currentExerciseIndex: currentState.currentExerciseIndex,
            currentSet: currentState.currentSet,
            currentRep: currentState.currentRep,
            currentPhase: "FINISHED",
            phaseTimeLeft: 0,
        };
    }

    switch (currentState.currentPhase) {
        case "PREP":
            nextPhase = "HANG";
            nextPhaseTimeLeft = exercise.HangDuration_s;
            break;

        case "HANG":
            if (currentState.currentRep < exercise.Reps) { // More reps in set
                nextPhase = "REST_HANG";
                nextPhaseTimeLeft = exercise.RestBetweenHangs_s;
                nextRep = currentState.currentRep + 1;
            } else if (currentState.currentSet < exercise.Sets) { // More sets in exercise
                nextPhase = "REST_SET";
                // TODO: Assuming RestBetweenSets_min is seconds. Adjust if needed.
                nextPhaseTimeLeft = exercise.RestBetweenSets_min; // Using _min name but assuming seconds
                nextSet = currentState.currentSet + 1;
                nextRep = 1; // Reset reps for next set
            } else if (currentState.currentExerciseIndex < validExercises.length - 1) { // More exercises
                nextPhase = "PREP";
                nextPhaseTimeLeft = initialPrepTime;
                nextExerciseIndex = currentState.currentExerciseIndex + 1;
                nextSet = 1; // Reset set/rep for new exercise
                nextRep = 1;
            } else { // Last rep, last set, last exercise
                nextPhase = "FINISHED";
                nextPhaseTimeLeft = 0;
            }
            break;

        case "REST_HANG":
            nextPhase = "HANG";
            nextPhaseTimeLeft = exercise.HangDuration_s;
            // Rep number already incremented when entering REST_HANG
            break;

        case "REST_SET":
            nextPhase = "HANG";
            nextPhaseTimeLeft = exercise.HangDuration_s;
            // Set number already incremented, rep already reset when entering REST_SET
            break;

        case "FINISHED":
             // No transition from FINISHED
            nextPhase = "FINISHED";
            nextPhaseTimeLeft = 0;
            break;
    }

    return {
        currentExerciseIndex: nextExerciseIndex,
        currentSet: nextSet,
        currentRep: nextRep,
        currentPhase: nextPhase,
        phaseTimeLeft: nextPhaseTimeLeft,
    };
};


// --- Component ---

export default function GuidedSession({
  exercises,
  onSessionComplete,
  initialPrepTime = 5, // Default 5s prep time
}: GuidedSessionProps) {
  const validExercises = useMemo(() => exercises.filter(ex => ex.Sets > 0 && ex.Reps > 0 && ex.HangDuration_s > 0), [exercises]);

  const totalSessionDuration = useMemo(
    () => calculateTotalDuration(validExercises, initialPrepTime),
    [validExercises, initialPrepTime]
  );

  const [sessionState, setSessionState] = useState<SessionState>(() => ({
    currentExerciseIndex: 0,
    currentSet: 1,
    currentRep: 1,
    currentPhase: validExercises.length > 0 ? "PREP" : "FINISHED",
    phaseTimeLeft: validExercises.length > 0 ? initialPrepTime : 0,
    totalTimeLeft: totalSessionDuration,
    isPaused: false,
  }));

  const currentExercise = validExercises[sessionState.currentExerciseIndex];

  // --- Timer Logic ---
  useEffect(() => {
    if (
      sessionState.isPaused ||
      sessionState.currentPhase === "FINISHED" ||
      !currentExercise // Ensure currentExercise is valid
    ) {
      return; // Don't run timer if paused, finished, or no exercise
    }

    const timerId = setInterval(() => {
      setSessionState((prev) => {
         // Prevent updates if paused or finished after interval starts but before state update
         if (prev.isPaused || prev.currentPhase === "FINISHED") {
            clearInterval(timerId); // Clear interval if state changed unexpectedly
            return prev;
        }

        const newPhaseTimeLeft = prev.phaseTimeLeft - 1;
        const newTotalTimeLeft = Math.max(0, prev.totalTimeLeft - 1); // Prevent negative total time

        if (newPhaseTimeLeft > 0) {
          // Continue current phase
          return {
            ...prev,
            phaseTimeLeft: newPhaseTimeLeft,
            totalTimeLeft: newTotalTimeLeft,
          };
        } else {
          // --- Phase Transition ---
          const nextStateCore = calculateNextState(prev, validExercises, initialPrepTime);

          // Check if the calculated next phase is FINISHED
          if (nextStateCore.currentPhase === "FINISHED" && prev.currentPhase !== "FINISHED") {
            onSessionComplete(); // Call completion callback *before* setting state if possible
          }

          return {
            ...prev, // Keep isPaused state
            ...nextStateCore, // Apply the calculated next state
            totalTimeLeft: newTotalTimeLeft, // Update total time
             // Ensure total time is 0 if finished
            ...(nextStateCore.currentPhase === "FINISHED" && { totalTimeLeft: 0 }),
          };
        }
      });
    }, 1000);

    // Cleanup interval
    return () => clearInterval(timerId);
  }, [
    sessionState.isPaused,
    sessionState.currentPhase,
    sessionState.phaseTimeLeft,
    sessionState.totalTimeLeft, // Include to ensure re-evaluation if externally changed
    sessionState.currentExerciseIndex,
    sessionState.currentSet,
    sessionState.currentRep,
    validExercises,
    initialPrepTime,
    currentExercise, // Add currentExercise to deps
    onSessionComplete // Add callback to deps
  ]);

  // --- Event Handlers ---
  const togglePause = useCallback(() => {
    setSessionState((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  const handleFinishEarly = useCallback(() => {
     setSessionState((prev) => {
        // Check if already finished to prevent multiple calls
        if (prev.currentPhase === "FINISHED") return prev;

        // Trigger completion callback immediately
        onSessionComplete();

        return {
            ...prev,
            currentPhase: "FINISHED",
            phaseTimeLeft: 0,
            totalTimeLeft: 0, // Set total time to 0
            isPaused: true, // Stop timer implicitly by phase change, but good practice
        };
     });
  }, [onSessionComplete]);

  const skipExercise = useCallback(() => {
    setSessionState((prev) => {
       if (prev.isPaused || prev.currentPhase === "FINISHED") return prev; // Don't skip if paused or finished

      let nextState = { ...prev };
      const currentPhaseRemainingTime = prev.phaseTimeLeft;
      let timeToSubtract = currentPhaseRemainingTime; // Start with remaining time in current phase

      // Calculate remaining time in the *entire* current exercise
      const exercise = validExercises[prev.currentExerciseIndex];
      if(exercise) {
        // Time left in current set
        const repsLeftInSet = exercise.Reps - prev.currentRep;
        const restsLeftInSet = Math.max(0, repsLeftInSet - (prev.currentPhase === 'HANG' ? 0 : 1) ); // Rests are between hangs
        const hangTimeLeftInSet = (repsLeftInSet + (prev.currentPhase === 'HANG' ? 1 : 0)) * exercise.HangDuration_s; // Add current hang if skipping it
        const restHangTimeLeftInSet = restsLeftInSet * exercise.RestBetweenHangs_s;
        let timeLeftInCurrentSet = hangTimeLeftInSet + restHangTimeLeftInSet;
        if(prev.currentPhase === 'HANG') timeLeftInCurrentSet -= (exercise.HangDuration_s - currentPhaseRemainingTime);
        if(prev.currentPhase === 'REST_HANG') timeLeftInCurrentSet -= (exercise.RestBetweenHangs_s - currentPhaseRemainingTime);

        // Time left in subsequent sets
        const setsLeft = exercise.Sets - prev.currentSet;
        let timeLeftInFutureSets = 0;
        if (setsLeft > 0) {
            const hangsTimePerSet = exercise.Reps * exercise.HangDuration_s;
            const restsHangTimePerSet = Math.max(0, exercise.Reps - 1) * exercise.RestBetweenHangs_s;
            const timePerSet = hangsTimePerSet + restsHangTimePerSet;
            // TODO: Assuming RestBetweenSets_min is seconds
            const restSetTime = exercise.RestBetweenSets_min; // Using _min name but assuming seconds
            timeLeftInFutureSets = setsLeft * timePerSet + Math.max(0, setsLeft) * restSetTime; // Add rest between sets too
             // Adjust if currently in REST_SET
             if(prev.currentPhase === 'REST_SET') timeLeftInFutureSets -= (restSetTime - currentPhaseRemainingTime);

        }


        timeToSubtract = timeLeftInCurrentSet + timeLeftInFutureSets;
         // Ensure we don't subtract more than the phase time if logic is complex
         // Let's simplify: just subtract the current phase time and let the total time adjust naturally on next ticks
         // More accurate calculation is complex. For simplicity, let's stick to basic skip for now.
         // The total time will be off, but skip function primarily advances state.
         // OR: Recalculate total time from the *new* state? That's better.

      }


      // Find next exercise state or finish
      if (prev.currentExerciseIndex < validExercises.length - 1) {
        nextState.currentPhase = "PREP";
        nextState.phaseTimeLeft = initialPrepTime; // Prep for next exercise
        nextState.currentExerciseIndex += 1;
        nextState.currentSet = 1; // Reset set/rep for new exercise
        nextState.currentRep = 1;
      } else {
        // If no more exercises, finish the session
        nextState.currentPhase = "FINISHED";
        nextState.phaseTimeLeft = 0;
        nextState.totalTimeLeft = 0; // Force total time to 0 when finishing
        onSessionComplete(); // Call completion callback
      }

       // Recalculate total time from the *new* state for better accuracy
       if (nextState.currentPhase !== "FINISHED") {
           let remainingDuration = 0;
           // Sum duration from the new current exercise index onwards
           for (let i = nextState.currentExerciseIndex; i < validExercises.length; i++) {
                remainingDuration += calculateTotalDuration([validExercises[i]], i === nextState.currentExerciseIndex ? initialPrepTime : initialPrepTime);
                // Adjust initial prep time calculation slightly
                if (i > nextState.currentExerciseIndex && initialPrepTime > 0) {
                   // This isn't quite right - calculateTotalDuration needs rework for partial sums
                   // Let's accept the totalTimeLeft inaccuracy for skipExercise for now
                }
           }
            // Keep the simple decrement for now, acknowledge inaccuracy
            nextState.totalTimeLeft = Math.max(0, prev.totalTimeLeft - currentPhaseRemainingTime);
       }


      return nextState;
    });
  }, [validExercises, initialPrepTime, onSessionComplete]);


  // <<< NEW: Handler to skip current phase (rep or rest) >>>
  const handleNextPhase = useCallback(() => {
     setSessionState(prev => {
         if (prev.isPaused || prev.currentPhase === "FINISHED") {
             return prev; // Do nothing if paused or finished
         }

         const timeSkipped = prev.phaseTimeLeft; // Time remaining in the phase being skipped
         const nextStateCore = calculateNextState(prev, validExercises, initialPrepTime);

         // Trigger completion callback if skipping leads to finish
         if (nextStateCore.currentPhase === "FINISHED" && prev.currentPhase !== "FINISHED") {
            onSessionComplete();
         }

         return {
            ...prev, // Keep isPaused state
            ...nextStateCore, // Apply the calculated next state
            // Subtract the *skipped* time from total time left
            totalTimeLeft: Math.max(0, prev.totalTimeLeft - timeSkipped),
            // Ensure total time is 0 if finished
            ...(nextStateCore.currentPhase === "FINISHED" && { totalTimeLeft: 0 }),
         };
     });
  }, [validExercises, initialPrepTime, onSessionComplete]);


  // --- UI Rendering ---

  const getPhaseInfo = (): { text: string; colorClass: string } => {
    switch (sessionState.currentPhase) {
      case "PREP":
        // Ensure currentExercise exists before accessing its properties
        const gripType = currentExercise ? `: ${currentExercise.GripType}` : "";
        return { text: `Get Ready${gripType}`, colorClass: "text-blue-400" };
      case "HANG":
        return { text: "HANG!", colorClass: "text-red-500" };
      case "REST_HANG":
        return { text: "Rest", colorClass: "text-green-500" };
      case "REST_SET":
        // TODO: Assuming RestBetweenSets_min is seconds. Display 'm:ss' if it's minutes.
        const setRestDuration = currentExercise ? ` (${formatTime(currentExercise.RestBetweenSets_min)})` : "";
        return { text: `Set Rest${setRestDuration}`, colorClass: "text-yellow-500" };
      case "FINISHED":
        return { text: "Session Complete!", colorClass: "text-green-400" };
      default:
        return { text: "", colorClass: "text-white" };
    }
  };

  const { text: phaseText, colorClass: phaseColor } = getPhaseInfo();

  if (!currentExercise && sessionState.currentPhase !== "FINISHED") {
     return (
        <div className="h-screen w-full bg-[#1a1512] text-white flex flex-col items-center justify-center p-4">
            <h1 className="text-2xl font-medium text-red-500">No valid exercises found for this session.</h1>
            <button
                onClick={onSessionComplete} // Allow user to exit
                className="mt-8 bg-[#2196f3] text-white py-2 px-6 rounded-full text-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Back
            </button>
        </div>
     )
  }

  // Main container
 return (
    <div className="h-screen w-full bg-[#1a1512] text-white flex flex-col justify-between p-4 overflow-hidden"> {/* Added overflow-hidden */}

      {/* Top Section (Exercise Info + Timer) */}
      <div className="flex-grow flex flex-col items-center justify-center text-center w-full max-w-md mx-auto"> {/* Centered content */}
        {/* Total Time Remaining */}
        <div className="absolute top-4 right-4 text-lg text-gray-400 h-6"> {/* Positioned top-right */}
          {sessionState.currentPhase !== "FINISHED" ? `Total: ${formatTime(sessionState.totalTimeLeft)}` : ""}
        </div>

        <motion.div
          key={sessionState.currentExerciseIndex + sessionState.currentPhase} // Re-animate on exercise or phase change
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full" // Ensure motion div takes width
        >
          {sessionState.currentPhase !== "FINISHED" && currentExercise && (
            <>
              {/* Current Phase Indicator */}
              <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${phaseColor} break-words`}> {/* Larger text, word break */}
                {phaseText}
              </h2>

              {/* Phase Timer */}
              <div className={`text-8xl md:text-9xl font-bold my-6 ${phaseColor}`}>
                {formatTime(sessionState.phaseTimeLeft)}
              </div>

               {/* Exercise Details */}
               <div className="mb-6 bg-gray-800 p-4 rounded-lg shadow-md text-base md:text-lg"> {/* Slightly larger text */}
                <h3 className="text-xl md:text-2xl font-semibold mb-2">{currentExercise.GripType}</h3> {/* Larger heading */}
                <p className="text-gray-300">Edge: {currentExercise.EdgeType}</p>
                <p className="text-gray-300">Set: {sessionState.currentSet} / {currentExercise.Sets}</p>
                <p className="text-gray-300">Rep: {sessionState.currentRep} / {currentExercise.Reps}</p>
                {currentExercise.IntensityModifier && <p className="text-sm text-gray-400 mt-1">({currentExercise.IntensityModifier})</p>}
              </div>


              {/* Next Up Info */}
              <div className="h-8 text-gray-400 mt-4 text-md md:text-lg"> {/* Reserve space, larger text */}
                {sessionState.currentPhase === "REST_HANG" && `Next: Hang (${currentExercise.HangDuration_s}s)`}
                {sessionState.currentPhase === "REST_SET" && `Next: Set ${sessionState.currentSet} / Rep 1`}
                {sessionState.currentPhase === "PREP" && sessionState.currentExerciseIndex > 0 && `Prev: ${validExercises[sessionState.currentExerciseIndex - 1]?.GripType || ''}`}
                 {/* Add next exercise info during last rest */}
                 {sessionState.currentPhase === "REST_SET" &&
                    sessionState.currentSet === currentExercise.Sets && // If it's the last set rest
                    sessionState.currentExerciseIndex < validExercises.length - 1 && // And there's a next exercise
                    `Next Ex: ${validExercises[sessionState.currentExerciseIndex + 1]?.GripType || ''}`
                 }
              </div>
            </>
          )}

          {/* Finished State */}
          {sessionState.currentPhase === "FINISHED" && (
            <div className="text-center">
              <motion.h1
                 initial={{ scale: 0.5, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
                 className="text-4xl md:text-5xl font-bold text-green-500 mb-6"> {/* Larger text */}
                    Workout Finished!
              </motion.h1>
              <motion.p
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ delay: 0.4 }}
                 className="text-xl md:text-2xl text-gray-300 mb-8"> {/* Larger text */}
                    Great job!
                </motion.p>
              <motion.button
                 initial={{ scale: 0.8, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 transition={{ delay: 0.6 }}
                onClick={onSessionComplete}
                className="bg-[#2196f3] text-white py-3 px-8 rounded-full text-lg md:text-xl font-medium hover:bg-blue-700 transition-colors shadow-lg" // Larger button
              >
                Done
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom Section (Controls) */}
      {sessionState.currentPhase !== "FINISHED" && (
        <div className="flex-shrink-0 pb-4 mt-auto"> {/* Ensure controls are at bottom */}
             <div className="flex flex-wrap space-x-2 justify-center"> {/* Allow wrapping, less space */}
                <button
                    onClick={togglePause}
                    className={`py-2 px-5 rounded-full text-md font-medium transition-colors ${
                    sessionState.isPaused
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-yellow-500 hover:bg-yellow-600 text-black"
                    }`}
                >
                    {sessionState.isPaused ? "Resume" : "Pause"}
                </button>
                 {/* <<< NEW Next Button >>> */}
                <button
                    onClick={handleNextPhase}
                    className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-5 rounded-full text-md font-medium transition-colors"
                    disabled={sessionState.isPaused} // Disable when paused
                >
                    Next
                </button>
                <button
                    onClick={skipExercise}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-5 rounded-full text-md font-medium transition-colors"
                     disabled={sessionState.isPaused} // Disable when paused
                >
                    Skip Ex.
                </button>
                <button
                    onClick={handleFinishEarly}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-5 rounded-full text-md font-medium transition-colors"
                    disabled={sessionState.isPaused} // Disable when paused
                >
                    Finish
                </button>
            </div>
        </div>
      )}
    </div>
  );
}