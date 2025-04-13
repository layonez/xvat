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
  let totalSeconds = initialPrepTime; // Start with initial prep time

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
        totalSeconds += (ex.Sets - 1) * (ex.RestBetweenSets_min);
      }

      // Add prep time before the *next* exercise starts (if not the last exercise)
      if (index < exercises.length - 1) {
          // Add a short prep time (e.g., 5s) before the next exercise *if* the current one didn't end with a long set rest
          // Or always add a prep time? Let's add a consistent prep time for simplicity before each new exercise type.
          totalSeconds += initialPrepTime; // Add prep time for the next exercise
      }
       // Note: This calculation is an estimate. It doesn't account for the final rest after the last set of the last exercise.
       // If precise total countdown is critical, adjust the logic slightly.
    }
  });

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

  // --- Timer and State Transition Logic ---
  useEffect(() => {
    if (
      sessionState.isPaused ||
      sessionState.currentPhase === "FINISHED" ||
      !currentExercise
    ) {
      return; // Don't run timer if paused, finished, or no exercise
    }

    const timerId = setInterval(() => {
      setSessionState((prev) => {
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
          // --- Phase Transition Logic ---
          let nextState = { ...prev };
          const exercise = validExercises[prev.currentExerciseIndex];

          switch (prev.currentPhase) {
            case "PREP":
              nextState.currentPhase = "HANG";
              nextState.phaseTimeLeft = exercise.HangDuration_s;
              break;

            case "HANG":
              // Check if more reps left in the current set
              if (prev.currentRep < exercise.Reps) {
                nextState.currentPhase = "REST_HANG";
                nextState.phaseTimeLeft = exercise.RestBetweenHangs_s;
                nextState.currentRep += 1;
              }
              // Else, check if more sets left in the current exercise
              else if (prev.currentSet < exercise.Sets) {
                nextState.currentPhase = "REST_SET";
                nextState.phaseTimeLeft = exercise.RestBetweenSets_min;
                nextState.currentSet += 1;
                nextState.currentRep = 1; // Reset reps for next set
              }
              // Else, check if more exercises left
              else if (prev.currentExerciseIndex < validExercises.length - 1) {
                nextState.currentPhase = "PREP";
                nextState.phaseTimeLeft = initialPrepTime; // Prep for next exercise
                nextState.currentExerciseIndex += 1;
                nextState.currentSet = 1; // Reset set/rep for new exercise
                nextState.currentRep = 1;
              }
              // Else, workout finished
              else {
                nextState.currentPhase = "FINISHED";
                nextState.phaseTimeLeft = 0;
                nextState.totalTimeLeft = 0; // Ensure total time shows 0
              }
              break;

            case "REST_HANG":
              // Always go back to HANG after resting between hangs
              nextState.currentPhase = "HANG";
              nextState.phaseTimeLeft = exercise.HangDuration_s;
              break;

            case "REST_SET":
              // Always go back to HANG to start the new set
              nextState.currentPhase = "HANG";
              nextState.phaseTimeLeft = exercise.HangDuration_s;
              break;

            case "FINISHED":
                // Should not happen within the interval loop if checked above, but safe default
                return prev;

          }

          // Update total time left (only needs decrementing, phase transitions don't change it)
          nextState.totalTimeLeft = newTotalTimeLeft;

          // Check if just finished
           if (nextState.currentPhase === "FINISHED" && prev.currentPhase !== "FINISHED" as SessionPhase) {
                onSessionComplete(); // Call the completion callback
           }

          return nextState;
        }
      });
    }, 1000);

    // Cleanup interval on unmount or when dependencies change
    return () => clearInterval(timerId);
  }, [
    sessionState.isPaused,
    sessionState.currentPhase,
    sessionState.phaseTimeLeft, // Re-run effect when phase changes to start new countdown correctly
    sessionState.totalTimeLeft,
    sessionState.currentExerciseIndex,
    sessionState.currentSet,
    sessionState.currentRep,
    validExercises,
    initialPrepTime,
    currentExercise, // Add currentExercise to deps
    onSessionComplete // Add callback to deps
  ]);

  // --- Event Handlers ---
  const togglePause = () => {
    setSessionState((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const handleFinishEarly = () => {
     setSessionState((prev) => ({
        ...prev,
        currentPhase: "FINISHED",
        phaseTimeLeft: 0,
        totalTimeLeft: 0, // Set total time to 0
        isPaused: true, // Effectively stop timer
     }));
     onSessionComplete(); // Trigger completion callback
  }

  // Add a new function to skip the current exercise
  const skipExercise = () => {
    setSessionState((prev) => {
      let nextState = { ...prev };

      // Check if there are more exercises left
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
        nextState.totalTimeLeft = 0;
      }

      return nextState;
    });
  };

  // --- UI Rendering ---

  const getPhaseInfo = (): { text: string; colorClass: string } => {
    switch (sessionState.currentPhase) {
      case "PREP":
        return { text: `Get Ready: ${currentExercise?.GripType}`, colorClass: "text-blue-400" };
      case "HANG":
        return { text: "HANG!", colorClass: "text-red-500" };
      case "REST_HANG":
        return { text: "Rest", colorClass: "text-green-500" };
      case "REST_SET":
        return { text: "Set Rest", colorClass: "text-yellow-500" };
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
        </div>
     )
  }


  return (
    <div className="h-screen w-full bg-[#1a1512] text-white flex flex-col items-center justify-center p-4">
      {/* Total Time Remaining */}
      <div className="absolute top-4 right-4 text-lg text-gray-400">
        Total Left: {formatTime(sessionState.totalTimeLeft)}
      </div>

        {/* Main Content */}
        <motion.div
            key={sessionState.currentExerciseIndex + sessionState.currentPhase} // Re-animate on exercise or phase change
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center w-full max-w-md" // Added max-width
        >
            {sessionState.currentPhase !== "FINISHED" && currentExercise && (
            <>
                {/* Current Phase Indicator */}
                <h2 className={`text-3xl font-bold mb-4 ${phaseColor}`}>
                    {phaseText}
                </h2>

                {/* Exercise Details */}
                <div className="mb-4 bg-gray-800 p-4 rounded-lg shadow-md">
                    <h1 className="text-xl font-semibold mb-2">{currentExercise.GripType}</h1>
                    <p className="text-md text-gray-300">Edge: {currentExercise.EdgeType}</p>
                    <p className="text-md text-gray-300">Set: {sessionState.currentSet} / {currentExercise.Sets}</p>
                    <p className="text-md text-gray-300">Rep: {sessionState.currentRep} / {currentExercise.Reps}</p>
                     <p className="text-sm text-gray-400 mt-1">({currentExercise.IntensityModifier})</p>
                </div>

                {/* Phase Timer */}
                 <div className={`text-7xl font-bold my-6 ${phaseColor}`}>
                    {formatTime(sessionState.phaseTimeLeft)}
                </div>

                {/* Next Up Info (Optional but helpful) */}
                {sessionState.currentPhase === "REST_HANG" && (
                    <p className="text-gray-400 mt-4">Next: Hang ({currentExercise.HangDuration_s}s)</p>
                )}
                 {sessionState.currentPhase === "REST_SET" && (
                    <p className="text-gray-400 mt-4">Next: Set {sessionState.currentSet} - Rep 1 (Hang {currentExercise.HangDuration_s}s)</p>
                )}
                 {sessionState.currentPhase === "PREP" && sessionState.currentExerciseIndex > 0 && (
                     <p className="text-gray-400 mt-4">Previous: {validExercises[sessionState.currentExerciseIndex - 1].GripType} Completed</p>
                 )}


            </>
            )}

            {/* Finished State */}
            {sessionState.currentPhase === "FINISHED" && (
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-green-500 mb-6">Workout Finished!</h1>
                    <p className="text-xl text-gray-300">Great job!</p>
                     {/* Optionally add a button to go back or see summary */}
                     <button
                         onClick={onSessionComplete} // Or navigate elsewhere
                         className="mt-8 bg-[#2196f3] text-white py-2 px-6 rounded-full text-lg font-medium hover:bg-blue-700 transition-colors"
                     >
                        Done
                     </button>
                </div>
            )}
        </motion.div>

      {/* Controls */}
      {sessionState.currentPhase !== "FINISHED" && (
        <div className="mt-8 flex space-x-4">
           <button
            onClick={togglePause}
            className={`py-2 px-6 rounded-full text-lg font-medium transition-colors ${
              sessionState.isPaused
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-yellow-500 hover:bg-yellow-600 text-black"
            }`}
          >
            {sessionState.isPaused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={handleFinishEarly}
            className="bg-red-600 hover:bg-red-700 text-white py-2 px-6 rounded-full text-lg font-medium transition-colors"
            disabled={sessionState.isPaused} // Disable if already paused to avoid confusion
           >
            Finish Early
           </button>
           {/* New Skip Button */}
           <button
            onClick={skipExercise}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-full text-lg font-medium transition-colors"
           >
            Skip Exercise
           </button>
        </div>
      )}
    </div>
  );
}