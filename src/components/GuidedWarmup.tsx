import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import restAudioSrc from '/src/assets/rest.mp3'; // Adjust path if needed
import startAudioSrc from '/src/assets/start.mp3'; // Adjust path if needed
import { Exercise } from "../services/seshEngine";

interface GuidedWarmupProps {
  warmups: Exercise[];
  onSessionComplete: () => void; // Callback when the session finishes
  initialPrepTime?: number; // Optional: Seconds before the very first step
}

// Renaming HANG -> WORK, REST_HANG -> REST_REP for clarity in warmup context
type SessionPhase = "PREP" | "WORK" | "REST_REP" | "REST_SET" | "FINISHED";

interface SessionState {
  currentWarmupIndex: number; // Renamed from currentExerciseIndex
  currentSet: number; // 1-based
  currentRep: number; // 1-based
  currentPhase: SessionPhase;
  phaseTimeLeft: number; // Time left in the current phase (seconds)
  totalTimeLeft: number; // Total estimated time left for the session (seconds)
  isPaused: boolean;
}

// --- Helper Functions ---

/**
 * Calculates the total estimated duration of the warmup in seconds.
 */
function calculateTotalWarmupDuration(
  warmups: Exercise[],
  initialPrepTime: number = 5
): number {
  let totalSeconds = initialPrepTime > 0 ? initialPrepTime : 0; // Start with initial prep time only if > 0

  warmups.forEach((wu, index) => {
    // Consider only valid warmups with positive duration, reps, and sets
    if (wu.Sets > 0 && wu.Reps > 0 && wu.Duration_s > 0) {
      const workTimePerSet = wu.Reps * wu.Duration_s;
      // Rest between reps happens (Reps - 1) times per set
      const restRepTimePerSet = Math.max(0, wu.Reps - 1) * wu.Rest_s;
      const timePerSet = workTimePerSet + restRepTimePerSet;
      totalSeconds += wu.Sets * timePerSet;

      // Add rest between sets if there are multiple sets
      if (wu.Sets > 1) {
        totalSeconds += (wu.Sets - 1) * wu.RestBetweenSets_s;
      }

      // Add prep time *between* different warmup items if initialPrepTime is used
      if (index < warmups.length - 1 && initialPrepTime > 0) {
          totalSeconds += initialPrepTime;
      }
    }
  });

  if (warmups.length === 0) {
     return 0; // No warmups, no duration
  }

  // Ensure non-negative duration
  return Math.max(0, totalSeconds);
}

/**
 * Formats seconds into MM:SS string. (No change needed)
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
 */
const calculateNextWarmupState = (
    currentState: SessionState,
    validWarmups: Exercise[],
    initialPrepTime: number
): Omit<SessionState, 'totalTimeLeft' | 'isPaused'> => {
    let nextPhase = currentState.currentPhase;
    let nextPhaseTimeLeft = 0;
    let nextWarmupIndex = currentState.currentWarmupIndex;
    let nextSet = currentState.currentSet;
    let nextRep = currentState.currentRep;

    const warmup = validWarmups[currentState.currentWarmupIndex];
    if (!warmup) {
        // Should not happen if called correctly, but safeguard
        return {
            currentWarmupIndex: currentState.currentWarmupIndex,
            currentSet: currentState.currentSet,
            currentRep: currentState.currentRep,
            currentPhase: "FINISHED",
            phaseTimeLeft: 0,
        };
    }

    switch (currentState.currentPhase) {
        case "PREP":
            nextPhase = "WORK";
            nextPhaseTimeLeft = warmup.Duration_s;
            break;
        case "WORK":
            if (currentState.currentRep < warmup.Reps) {
                // More reps in the current set
                nextPhase = "REST_REP";
                nextPhaseTimeLeft = warmup.Rest_s; // Use Rest_s for inter-rep rest
                nextRep = currentState.currentRep + 1;
            } else if (currentState.currentSet < warmup.Sets) {
                // More sets in the current warmup item
                nextPhase = "REST_SET";
                nextPhaseTimeLeft = warmup.RestBetweenSets_s; // Use RestBetweenSets_s
                nextSet = currentState.currentSet + 1;
                nextRep = 1; // Reset rep count for the new set
            } else if (currentState.currentWarmupIndex < validWarmups.length - 1) {
                // Move to the next warmup item
                nextPhase = "PREP";
                nextPhaseTimeLeft = initialPrepTime;
                nextWarmupIndex = currentState.currentWarmupIndex + 1;
                nextSet = 1; // Reset set count
                nextRep = 1; // Reset rep count
            } else {
                // Last rep of last set of last warmup item
                nextPhase = "FINISHED";
                nextPhaseTimeLeft = 0;
            }
            break;
        case "REST_REP":
            // Finished resting between reps, start next rep's work
            nextPhase = "WORK";
            nextPhaseTimeLeft = warmup.Duration_s;
            break;
        case "REST_SET":
            // Finished resting between sets, start first rep of next set's work
            nextPhase = "WORK";
            nextPhaseTimeLeft = warmup.Duration_s;
            break;
        case "FINISHED":
            // Stay finished
            nextPhase = "FINISHED";
            nextPhaseTimeLeft = 0;
            break;
    }

    return {
        currentWarmupIndex: nextWarmupIndex,
        currentSet: nextSet,
        currentRep: nextRep,
        currentPhase: nextPhase,
        phaseTimeLeft: nextPhaseTimeLeft,
    };
};


// --- Component ---

export default function GuidedWarmup({
  warmups,
  onSessionComplete,
  initialPrepTime = 5, // Default prep time
}: GuidedWarmupProps) {
  // Filter out warmups that don't have valid parameters
  const validWarmups = useMemo(() =>
    warmups.filter(wu => wu.Sets > 0 && wu.Reps > 0 && wu.Duration_s > 0),
    [warmups]
  );

  const totalWarmupDuration = useMemo(
    () => calculateTotalWarmupDuration(validWarmups, initialPrepTime),
    [validWarmups, initialPrepTime]
  );

  const [sessionState, setSessionState] = useState<SessionState>(() => ({
    currentWarmupIndex: 0, // Start with the first warmup
    currentSet: 1,
    currentRep: 1,
    currentPhase: validWarmups.length > 0 ? "PREP" : "FINISHED", // Start with PREP if valid warmups exist
    phaseTimeLeft: validWarmups.length > 0 ? initialPrepTime : 0,
    totalTimeLeft: totalWarmupDuration,
    isPaused: false,
  }));

  // Get the current warmup item based on the index
  const currentWarmup = validWarmups[sessionState.currentWarmupIndex];

  // --- Audio Refs & Initialization (Keep as is, functionally the same) ---
  const restAudioRef = useRef<HTMLAudioElement | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioInitialized = useRef(false);

  useEffect(() => {
    if (!audioInitialized.current && typeof window !== 'undefined') {
      console.log("Initializing audio elements...");
      try {
          restAudioRef.current = new Audio(restAudioSrc);
          restAudioRef.current.loop = true; // Rest sound loops

          startAudioRef.current = new Audio(startAudioSrc);
          startAudioRef.current.volume = 0.8; // Optional adjustment

          restAudioRef.current.preload = 'auto';
          startAudioRef.current.preload = 'auto';

          audioInitialized.current = true;
          console.log("Audio elements initialized.");
      } catch (error) {
          console.error("Error initializing audio:", error);
      }
    }

    return () => {
      // console.log("Pausing audio on unmount...");
      restAudioRef.current?.pause();
      startAudioRef.current?.pause();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Timer Logic ---
  useEffect(() => {
    if (
      sessionState.isPaused ||
      sessionState.currentPhase === "FINISHED" ||
      !currentWarmup // Stop if there's no current warmup (e.g., empty list or finished)
    ) {
      return; // Exit if paused, finished, or no valid warmup item active
    }

    // Set up the interval timer
    const timerId = setInterval(() => {
      setSessionState((prev) => {
         // Double check pause/finished state inside interval callback
         if (prev.isPaused || prev.currentPhase === "FINISHED") {
            clearInterval(timerId); // Clear interval if state changed
            return prev;
        }

        const newPhaseTimeLeft = prev.phaseTimeLeft - 1;
        const newTotalTimeLeft = Math.max(0, prev.totalTimeLeft - 1); // Ensure total time doesn't go below 0

        if (newPhaseTimeLeft > 0) {
          // Still time left in the current phase
          return {
            ...prev,
            phaseTimeLeft: newPhaseTimeLeft,
            totalTimeLeft: newTotalTimeLeft,
          };
        } else {
          // Phase ended, calculate the next state
          const nextStateCore = calculateNextWarmupState(prev, validWarmups, initialPrepTime);

          // Check if the session just finished
          if (nextStateCore.currentPhase === "FINISHED" && prev.currentPhase !== "FINISHED") {
            onSessionComplete(); // Call the completion callback
          }

          // Update the state with the next phase details
          return {
            ...prev,
            ...nextStateCore,
            totalTimeLeft: newTotalTimeLeft,
             // Ensure total time is 0 if finished
            ...(nextStateCore.currentPhase === "FINISHED" && { totalTimeLeft: 0 }),
          };
        }
      });
    }, 1000); // Run every second

    // Cleanup function to clear the interval when dependencies change or component unmounts
    return () => clearInterval(timerId);
  }, [
    // Dependencies for the timer effect
    sessionState.isPaused,
    sessionState.currentPhase,
    sessionState.phaseTimeLeft,
    sessionState.totalTimeLeft,
    sessionState.currentWarmupIndex,
    sessionState.currentSet,
    sessionState.currentRep,
    validWarmups, // Recalculate if the list of valid warmups changes
    initialPrepTime,
    currentWarmup, // Recalculate if the current warmup item changes
    onSessionComplete // Include callback in dependencies
  ]);

  // --- Audio Control Logic ---
  useEffect(() => {
    const restAudio = restAudioRef.current;
    const startAudio = startAudioRef.current;

    if (!restAudio || !startAudio || !audioInitialized.current) {
        // console.log("Audio not ready or not initialized");
        return; // Don't proceed if audio isn't set up
    }

    // Determine if the current phase is any type of rest
    const isRestPhase = sessionState.currentPhase === "REST_REP" || sessionState.currentPhase === "REST_SET";
    // Determine if the phase is one that precedes the main work phase (WORK)
    const isPreWorkPhase = sessionState.currentPhase === "PREP" || sessionState.currentPhase === "REST_REP" || sessionState.currentPhase === "REST_SET";

    // --- Handle Paused State ---
    if (sessionState.isPaused) {
      // console.log("Audio: Paused state detected, pausing audio");
      if (!restAudio.paused) restAudio.pause();
      if (!startAudio.paused) startAudio.pause();
      return; // Exit early if paused
    }

    // --- Rest Audio Playback ---
    if (isRestPhase) {
      if (restAudio.paused) {
        // console.log("Audio: Playing rest audio");
        const playPromise = restAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Error attempting to play rest audio:", error);
          });
        }
      }
    } else {
      // If not in a rest phase, ensure rest audio is stopped and reset
      if (!restAudio.paused) {
        // console.log("Audio: Pausing rest audio");
        restAudio.pause();
        restAudio.currentTime = 0; // Reset playback position
      }
    }

    // --- Start Audio Playback (Countdown before WORK) ---
    // Play the 'start' sound 3 seconds before the WORK phase begins
    if (isPreWorkPhase && sessionState.phaseTimeLeft === 3) {
      // console.log(`Audio: Playing start audio (3s before WORK in ${sessionState.currentPhase})`);
      startAudio.currentTime = 0; // Rewind to start
      const playPromise = startAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Error attempting to play start audio:", error);
        });
      }
    }
    // No need to explicitly stop startAudio as it's short and doesn't loop

  }, [sessionState.currentPhase, sessionState.phaseTimeLeft, sessionState.isPaused]); // Dependencies for audio effect


  // --- Event Handlers ---
  const togglePause = useCallback(() => {
    setSessionState((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  const handleFinishEarly = useCallback(() => {
     setSessionState((prev) => {
        if (prev.currentPhase === "FINISHED") return prev; // Already finished
        onSessionComplete(); // Call the completion callback
        return {
            ...prev,
            currentPhase: "FINISHED",
            phaseTimeLeft: 0,
            totalTimeLeft: 0,
            isPaused: true, // Often good to pause when finishing early
        };
     });
     // Stop audio immediately
     restAudioRef.current?.pause();
     startAudioRef.current?.pause();
  }, [onSessionComplete]);

  // Renamed from skipExercise
  const skipWarmupItem = useCallback(() => {
    setSessionState((prev) => {
       if (prev.isPaused || prev.currentPhase === "FINISHED") return prev;

      let nextState = { ...prev };
      const currentPhaseRemainingTime = prev.phaseTimeLeft;

      // Stop current sounds before calculating next state
      restAudioRef.current?.pause();
      startAudioRef.current?.pause();

      // Check if there is a next warmup item
      if (prev.currentWarmupIndex < validWarmups.length - 1) {
        // Move to the PREP phase of the next item
        nextState.currentPhase = "PREP";
        nextState.phaseTimeLeft = initialPrepTime;
        nextState.currentWarmupIndex += 1;
        nextState.currentSet = 1; // Reset set
        nextState.currentRep = 1; // Reset rep
      } else {
        // This was the last warmup item, finish the session
        nextState.currentPhase = "FINISHED";
        nextState.phaseTimeLeft = 0;
        nextState.totalTimeLeft = 0; // Set total time to 0
        onSessionComplete(); // Call completion callback
      }

       // Adjust total time left - this is an approximation
       if (nextState.currentPhase !== "FINISHED") {
            nextState.totalTimeLeft = Math.max(0, prev.totalTimeLeft - currentPhaseRemainingTime);
       } else {
           // Ensure audio stops if finishing via skip
            restAudioRef.current?.pause();
            startAudioRef.current?.pause();
       }

      return nextState;
    });
  }, [validWarmups, initialPrepTime, onSessionComplete]);


  // Renamed from handleNextPhase, functions similarly
  const handleSkipPhase = useCallback(() => {
     setSessionState(prev => {
         if (prev.isPaused || prev.currentPhase === "FINISHED") {
             return prev; // Do nothing if paused or finished
         }

         // Stop current sounds before calculating next state
         restAudioRef.current?.pause();
         startAudioRef.current?.pause();

         const timeSkipped = prev.phaseTimeLeft;
         // Calculate the state as if the current phase just ended
         const nextStateCore = calculateNextWarmupState(prev, validWarmups, initialPrepTime);

         // Check if skipping this phase finishes the session
         if (nextStateCore.currentPhase === "FINISHED" && prev.currentPhase !== "FINISHED") {
            onSessionComplete();
            // Ensure audio stops if finishing
            restAudioRef.current?.pause();
            startAudioRef.current?.pause();
         }

         // Update state, adjusting total time left by the skipped amount
         return {
            ...prev,
            ...nextStateCore,
            totalTimeLeft: Math.max(0, prev.totalTimeLeft - timeSkipped),
            // Ensure total time is 0 if finished
            ...(nextStateCore.currentPhase === "FINISHED" && { totalTimeLeft: 0 }),
         };
     });
  }, [validWarmups, initialPrepTime, onSessionComplete]);


  // --- UI Rendering ---

  // Get descriptive text and color for the current phase
  const getPhaseInfo = (): { text: string; colorClass: string } => {
     switch (sessionState.currentPhase) {
      case "PREP":
        // Show the description of the upcoming warmup item
        const description = currentWarmup ? `: ${currentWarmup.Description}` : "";
        return { text: `Get Ready${description}`, colorClass: "text-blue-400" };
      case "WORK":
        // Indicate the active work phase
        return { text: "Work!", colorClass: "text-red-500" };
      case "REST_REP":
        // Indicate rest between repetitions
        return { text: "Rest", colorClass: "text-green-500" };
      case "REST_SET":
        // Indicate rest between sets, show duration
        const setRestDuration = currentWarmup ? ` (${formatTime(currentWarmup.RestBetweenSets_s)})` : "";
        return { text: `Set Rest${setRestDuration}`, colorClass: "text-yellow-500" };
      case "FINISHED":
        return { text: "Warmup Complete!", colorClass: "text-green-400" };
      default:
        return { text: "", colorClass: "text-white" }; // Fallback
    }
  };

  const { text: phaseText, colorClass: phaseColor } = getPhaseInfo();

  // Handle case where there are no valid warmups to perform
  if (!currentWarmup && sessionState.currentPhase !== "FINISHED") {
     return (
        <div className="h-screen w-full bg-[#1a1512] text-white flex flex-col items-center justify-center p-4">
            <h1 className="text-2xl font-medium text-red-500 text-center">No valid warmup items found for this session.</h1>
            <button
                onClick={onSessionComplete}
                className="mt-8 bg-[#2196f3] text-white py-2 px-6 rounded-full text-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Back
            </button>
        </div>
     )
  }

  // Main component layout
 return (
    <div className="h-screen w-full bg-[#1a1512] text-white flex flex-col justify-between p-4 overflow-hidden">

      {/* Top Section (Warmup Info + Timer) */}
      <div className="flex-grow flex flex-col items-center justify-center text-center w-full max-w-md mx-auto pt-10"> {/* Added pt-10 for space from top */}
        {/* Display total time left */}
        <div className="absolute top-4 right-4 text-lg text-gray-400 h-6">
          {sessionState.currentPhase !== "FINISHED" ? `Total: ${formatTime(sessionState.totalTimeLeft)}` : ""}
        </div>

        <motion.div
          key={sessionState.currentWarmupIndex + sessionState.currentPhase} // Animate when warmup item or phase changes
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          {/* Display when session is active */}
          {sessionState.currentPhase !== "FINISHED" && currentWarmup && (
            <>
              {/* Phase Title */}
              <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${phaseColor} break-words`}>
                {phaseText}
              </h2>
              {/* Phase Timer */}
              <div className={`text-8xl md:text-9xl font-bold my-6 ${phaseColor}`}>
                {formatTime(sessionState.phaseTimeLeft)}
              </div>
              {/* Current Warmup Details Box */}
               <div className="mb-6 bg-gray-800 p-4 rounded-lg shadow-md text-base md:text-lg">
                <h3 className="text-xl md:text-2xl font-semibold mb-2">{currentWarmup.Description}</h3>
                {/* Optional details */}
                {currentWarmup.GripType && <p className="text-gray-300">Grip: {currentWarmup.GripType}</p>}
                {currentWarmup.EdgeType && <p className="text-gray-300">Edge: {currentWarmup.EdgeType}</p>}
                 {/* Set and Rep counters */}
                <p className="text-gray-300">Set: {sessionState.currentSet} / {currentWarmup.Sets}</p>
                <p className="text-gray-300">Rep: {sessionState.currentRep} / {currentWarmup.Reps}</p>
                 {/* Additional Info and Intensity */}
                {currentWarmup.Intensity_Modifier && <p className="text-sm text-gray-400 mt-1">({currentWarmup.Intensity_Modifier})</p>}
                {currentWarmup.Additional_Info && <p className="text-sm text-gray-400 mt-1">{currentWarmup.Additional_Info}</p>}
                {currentWarmup.Target && currentWarmup.Target.length > 0 && <p className="text-xs text-gray-500 mt-2">Target: {currentWarmup.Target.join(', ')}</p>}
               </div>
              {/* Contextual "Next" information */}
              <div className="h-8 text-gray-400 mt-4 text-md md:text-lg">
                {sessionState.currentPhase === "REST_REP" && `Next: Work (${currentWarmup.Duration_s}s)`}
                {sessionState.currentPhase === "REST_SET" && `Next Set: ${sessionState.currentSet} / Rep 1`}
                {sessionState.currentPhase === "PREP" && sessionState.currentWarmupIndex > 0 && `Prev: ${validWarmups[sessionState.currentWarmupIndex - 1]?.Description || ''}`}
                 {/* Show next warmup item description if resting after the last set */}
                 {sessionState.currentPhase === "REST_SET" &&
                    sessionState.currentSet === currentWarmup.Sets && // Check if it's the last set
                    sessionState.currentWarmupIndex < validWarmups.length - 1 && // Check if there is a next item
                    `Next Item: ${validWarmups[sessionState.currentWarmupIndex + 1]?.Description || ''}`
                 }
              </div>
            </>
          )}

          {/* Display when session is finished */}
          {sessionState.currentPhase === "FINISHED" && (
             <div className="text-center">
              <motion.h1
                 initial={{ scale: 0.5, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
                 className="text-4xl md:text-5xl font-bold text-green-500 mb-6">
                    Warmup Finished!
              </motion.h1>
              <motion.p
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ delay: 0.4 }}
                 className="text-xl md:text-2xl text-gray-300 mb-8">
                    Ready to go!
                </motion.p>
              {/* Button to call the completion handler */}
              <motion.button
                 initial={{ scale: 0.8, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 transition={{ delay: 0.6 }}
                onClick={onSessionComplete}
                className="bg-[#2196f3] text-white py-3 px-8 rounded-full text-lg md:text-xl font-medium hover:bg-blue-700 transition-colors shadow-lg"
              >
                Done
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom Section (Controls) - Only show if not finished */}
      {sessionState.currentPhase !== "FINISHED" && (
        <div className="flex-shrink-0 pb-4 mt-auto">
             <div className="flex flex-wrap space-x-2 justify-center">
                {/* Pause/Resume Button */}
                <button
                    onClick={togglePause}
                    className={`py-2 px-5 rounded-full text-md font-medium transition-colors ${
                    sessionState.isPaused
                        ? "bg-green-600 hover:bg-green-700 text-white" // Green when paused (shows Resume)
                        : "bg-yellow-500 hover:bg-yellow-600 text-black" // Yellow when running (shows Pause)
                    }`}
                >
                    {sessionState.isPaused ? "Resume" : "Pause"}
                </button>
                {/* Skip Phase Button */}
                <button
                    onClick={handleSkipPhase}
                    className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-5 rounded-full text-md font-medium transition-colors"
                    disabled={sessionState.isPaused} // Disable if paused
                >
                    Next
                </button>
                 {/* Skip Warmup Item Button */}
                <button
                    onClick={skipWarmupItem} // Use the renamed handler
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-5 rounded-full text-md font-medium transition-colors"
                     disabled={sessionState.isPaused || validWarmups.length <= 1} // Disable if paused or only one item
                >
                    Skip Item
                </button>
                 {/* Finish Early Button */}
                <button
                    onClick={handleFinishEarly}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-5 rounded-full text-md font-medium transition-colors"
                    disabled={sessionState.isPaused} // Disable if paused
                >
                    Finish
                </button>
            </div>
        </div>
      )}
    </div>
  );
}