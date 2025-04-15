import { useState, useEffect, useMemo, useCallback, useRef } from "react"; // Import useRef
import { motion } from "framer-motion";
import { Exercise } from "../services/seshEngine"; // Assuming this path is correct
import restAudioSrc from '/src/assets/rest.mp3'; // Ensure path is correct
import startAudioSrc from '/src/assets/start.mp3'; // Ensure path is correct

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
      const hangsTimePerSet = ex.Reps * ex.HangDuration_s;
      const restsHangTimePerSet = Math.max(0, ex.Reps - 1) * ex.RestBetweenHangs_s;
      const timePerSet = hangsTimePerSet + restsHangTimePerSet;
      totalSeconds += ex.Sets * timePerSet;

      if (ex.Sets > 1) {
        // TODO: Clarify if RestBetweenSets_min is minutes or seconds. Assuming seconds.
        totalSeconds += (ex.Sets - 1) * (ex.RestBetweenSets_min);
      }

      if (index < exercises.length - 1 && initialPrepTime > 0) {
          totalSeconds += initialPrepTime;
      }
    }
  });

  if (exercises.length === 0) {
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
 */
const calculateNextState = (
    currentState: SessionState,
    validExercises: Exercise[],
    initialPrepTime: number
): Omit<SessionState, 'totalTimeLeft' | 'isPaused'> => {
    let nextPhase = currentState.currentPhase;
    let nextPhaseTimeLeft = 0;
    let nextExerciseIndex = currentState.currentExerciseIndex;
    let nextSet = currentState.currentSet;
    let nextRep = currentState.currentRep;

    const exercise = validExercises[currentState.currentExerciseIndex];
    if (!exercise) {
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
            if (currentState.currentRep < exercise.Reps) {
                nextPhase = "REST_HANG";
                nextPhaseTimeLeft = exercise.RestBetweenHangs_s;
                nextRep = currentState.currentRep + 1;
            } else if (currentState.currentSet < exercise.Sets) {
                nextPhase = "REST_SET";
                nextPhaseTimeLeft = exercise.RestBetweenSets_min; // Assuming seconds
                nextSet = currentState.currentSet + 1;
                nextRep = 1;
            } else if (currentState.currentExerciseIndex < validExercises.length - 1) {
                nextPhase = "PREP";
                nextPhaseTimeLeft = initialPrepTime;
                nextExerciseIndex = currentState.currentExerciseIndex + 1;
                nextSet = 1;
                nextRep = 1;
            } else {
                nextPhase = "FINISHED";
                nextPhaseTimeLeft = 0;
            }
            break;
        case "REST_HANG":
            nextPhase = "HANG";
            nextPhaseTimeLeft = exercise.HangDuration_s;
            break;
        case "REST_SET":
            nextPhase = "HANG";
            nextPhaseTimeLeft = exercise.HangDuration_s;
            break;
        case "FINISHED":
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
  initialPrepTime = 5,
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

  // --- Audio Refs --- <<< ADDED
  const restAudioRef = useRef<HTMLAudioElement | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioInitialized = useRef(false);

  // --- Initialize Audio Effect --- <<< ADDED
  useEffect(() => {
    if (!audioInitialized.current && typeof window !== 'undefined') { // Check for window object for SSR safety
      console.log("Initializing audio elements...");
      try {
          restAudioRef.current = new Audio(restAudioSrc);
          restAudioRef.current.loop = true;

          startAudioRef.current = new Audio(startAudioSrc);
        //   startAudioRef.current.playbackRate = 0.4; // Slowed 2x
          startAudioRef.current.volume = 0.8; // Optional volume adjustment

          // Preload audio files
          restAudioRef.current.preload = 'auto';
          startAudioRef.current.preload = 'auto';

          audioInitialized.current = true;
          console.log("Audio elements initialized.");

      } catch (error) {
          console.error("Error initializing audio:", error);
          // Handle potential errors during audio object creation
      }
    }

    // Cleanup function: Pause audio and remove refs on unmount
    return () => {
      console.log("Pausing audio on unmount...");
      restAudioRef.current?.pause();
      startAudioRef.current?.pause();
      // Optional: Nullify refs if needed, though usually not required
      // restAudioRef.current = null;
      // startAudioRef.current = null;
      // audioInitialized.current = false; // Reset if component could remount
    };
  }, []); // Empty array ensures this runs only once

  // --- Timer Logic --- (Keep Existing)
  useEffect(() => {
    if (
      sessionState.isPaused ||
      sessionState.currentPhase === "FINISHED" ||
      !currentExercise
    ) {
      return;
    }

    const timerId = setInterval(() => {
      setSessionState((prev) => {
         if (prev.isPaused || prev.currentPhase === "FINISHED") {
            clearInterval(timerId);
            return prev;
        }

        const newPhaseTimeLeft = prev.phaseTimeLeft - 1;
        const newTotalTimeLeft = Math.max(0, prev.totalTimeLeft - 1);

        if (newPhaseTimeLeft > 0) {
          return {
            ...prev,
            phaseTimeLeft: newPhaseTimeLeft,
            totalTimeLeft: newTotalTimeLeft,
          };
        } else {
          const nextStateCore = calculateNextState(prev, validExercises, initialPrepTime);

          if (nextStateCore.currentPhase === "FINISHED" && prev.currentPhase !== "FINISHED") {
            onSessionComplete();
          }

          return {
            ...prev,
            ...nextStateCore,
            totalTimeLeft: newTotalTimeLeft,
            ...(nextStateCore.currentPhase === "FINISHED" && { totalTimeLeft: 0 }),
          };
        }
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [
    sessionState.isPaused,
    sessionState.currentPhase,
    sessionState.phaseTimeLeft,
    sessionState.totalTimeLeft,
    sessionState.currentExerciseIndex,
    sessionState.currentSet,
    sessionState.currentRep,
    validExercises,
    initialPrepTime,
    currentExercise,
    onSessionComplete
  ]);

  // --- Audio Control Logic --- <<< ADDED
  useEffect(() => {
    const restAudio = restAudioRef.current;
    const startAudio = startAudioRef.current;

    if (!restAudio || !startAudio || !audioInitialized.current) {
        // console.log("Audio not ready or not initialized");
        return; // Don't proceed if audio isn't set up
    }

    const isRestPhase = sessionState.currentPhase === "REST_HANG" || sessionState.currentPhase === "REST_SET";
    const isPreHangPhase = sessionState.currentPhase === "PREP" || sessionState.currentPhase === "REST_HANG" || sessionState.currentPhase === "REST_SET";

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
            // Might be due to browser autoplay restrictions requiring user interaction first
          });
        }
      }
    } else {
      // If not in a rest phase, ensure rest audio is stopped
      if (!restAudio.paused) {
        // console.log("Audio: Pausing rest audio");
        restAudio.pause();
        restAudio.currentTime = 0; // Reset playback position
      }
    }

    // --- Start Audio Playback (Countdown) ---
    if (isPreHangPhase && sessionState.phaseTimeLeft === 3) { // Exactly 3 seconds left before hang
      // console.log(`Audio: Playing start audio (3s before HANG in ${sessionState.currentPhase})`);
      startAudio.currentTime = 0; // Rewind to start
      const playPromise = startAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Error attempting to play start audio:", error);
        });
      }
    }
    // No need to explicitly stop startAudio as it doesn't loop

  }, [sessionState.currentPhase, sessionState.phaseTimeLeft, sessionState.isPaused]);


  // --- Event Handlers --- (Keep Existing)
  const togglePause = useCallback(() => {
    setSessionState((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  const handleFinishEarly = useCallback(() => {
     setSessionState((prev) => {
        if (prev.currentPhase === "FINISHED") return prev;
        onSessionComplete();
        return {
            ...prev,
            currentPhase: "FINISHED",
            phaseTimeLeft: 0,
            totalTimeLeft: 0,
            isPaused: true,
        };
     });
     // Stop audio immediately when finishing early
     restAudioRef.current?.pause();
     startAudioRef.current?.pause();
  }, [onSessionComplete]);

  const skipExercise = useCallback(() => {
    setSessionState((prev) => {
       if (prev.isPaused || prev.currentPhase === "FINISHED") return prev;

      let nextState = { ...prev };
      const currentPhaseRemainingTime = prev.phaseTimeLeft;

      // Stop current sounds before calculating next state
      restAudioRef.current?.pause();
      startAudioRef.current?.pause();


      if (prev.currentExerciseIndex < validExercises.length - 1) {
        nextState.currentPhase = "PREP";
        nextState.phaseTimeLeft = initialPrepTime;
        nextState.currentExerciseIndex += 1;
        nextState.currentSet = 1;
        nextState.currentRep = 1;
      } else {
        nextState.currentPhase = "FINISHED";
        nextState.phaseTimeLeft = 0;
        nextState.totalTimeLeft = 0;
        onSessionComplete();
      }

       if (nextState.currentPhase !== "FINISHED") {
            // Keep the simple decrement for total time on skip, acknowledge inaccuracy
            nextState.totalTimeLeft = Math.max(0, prev.totalTimeLeft - currentPhaseRemainingTime);
       } else {
           // Ensure audio stops if finishing
            restAudioRef.current?.pause();
            startAudioRef.current?.pause();
       }


      return nextState;
    });
  }, [validExercises, initialPrepTime, onSessionComplete]);


  const handleNextPhase = useCallback(() => {
     setSessionState(prev => {
         if (prev.isPaused || prev.currentPhase === "FINISHED") {
             return prev;
         }

         // Stop current sounds before calculating next state
         restAudioRef.current?.pause();
         startAudioRef.current?.pause();

         const timeSkipped = prev.phaseTimeLeft;
         const nextStateCore = calculateNextState(prev, validExercises, initialPrepTime);

         if (nextStateCore.currentPhase === "FINISHED" && prev.currentPhase !== "FINISHED") {
            onSessionComplete();
            // Ensure audio stops if finishing
            restAudioRef.current?.pause();
            startAudioRef.current?.pause();
         }

         return {
            ...prev,
            ...nextStateCore,
            totalTimeLeft: Math.max(0, prev.totalTimeLeft - timeSkipped),
            ...(nextStateCore.currentPhase === "FINISHED" && { totalTimeLeft: 0 }),
         };
     });
  }, [validExercises, initialPrepTime, onSessionComplete]);


  // --- UI Rendering --- (Keep Existing)

  const getPhaseInfo = (): { text: string; colorClass: string } => {
    // ... (implementation as before) ...
     switch (sessionState.currentPhase) {
      case "PREP":
        const gripType = currentExercise ? `: ${currentExercise.GripType}` : "";
        return { text: `Get Ready${gripType}`, colorClass: "text-blue-400" };
      case "HANG":
        return { text: "HANG!", colorClass: "text-red-500" };
      case "REST_HANG":
        return { text: "Rest", colorClass: "text-green-500" };
      case "REST_SET":
        const setRestDuration = currentExercise ? ` (${formatTime(currentExercise.RestBetweenSets_min)})` : ""; // Assuming seconds
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
                onClick={onSessionComplete}
                className="mt-8 bg-[#2196f3] text-white py-2 px-6 rounded-full text-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Back
            </button>
        </div>
     )
  }

  // Main container
 return (
    <div className="h-screen w-full bg-[#1a1512] text-white flex flex-col justify-between p-4 overflow-hidden">

      {/* Top Section (Exercise Info + Timer) */}
      <div className="flex-grow flex flex-col items-center justify-center text-center w-full max-w-md mx-auto">
        <div className="absolute top-4 right-4 text-lg text-gray-400 h-6">
          {sessionState.currentPhase !== "FINISHED" ? `Total: ${formatTime(sessionState.totalTimeLeft)}` : ""}
        </div>

        <motion.div
          key={sessionState.currentExerciseIndex + sessionState.currentPhase}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          {sessionState.currentPhase !== "FINISHED" && currentExercise && (
            <>
              <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${phaseColor} break-words`}>
                {phaseText}
              </h2>
              <div className={`text-8xl md:text-9xl font-bold my-6 ${phaseColor}`}>
                {formatTime(sessionState.phaseTimeLeft)}
              </div>
               <div className="mb-6 bg-gray-800 p-4 rounded-lg shadow-md text-base md:text-lg">
                <h3 className="text-xl md:text-2xl font-semibold mb-2">{currentExercise.GripType}</h3>
                <p className="text-gray-300">Edge: {currentExercise.EdgeType}</p>
                <p className="text-gray-300">Set: {sessionState.currentSet} / {currentExercise.Sets}</p>
                <p className="text-gray-300">Rep: {sessionState.currentRep} / {currentExercise.Reps}</p>
                {currentExercise.IntensityModifier && <p className="text-sm text-gray-400 mt-1">({currentExercise.IntensityModifier})</p>}
              </div>
              <div className="h-8 text-gray-400 mt-4 text-md md:text-lg">
                {sessionState.currentPhase === "REST_HANG" && `Next: Hang (${currentExercise.HangDuration_s}s)`}
                {sessionState.currentPhase === "REST_SET" && `Next: Set ${sessionState.currentSet} / Rep 1`}
                {sessionState.currentPhase === "PREP" && sessionState.currentExerciseIndex > 0 && `Prev: ${validExercises[sessionState.currentExerciseIndex - 1]?.GripType || ''}`}
                 {sessionState.currentPhase === "REST_SET" &&
                    sessionState.currentSet === currentExercise.Sets &&
                    sessionState.currentExerciseIndex < validExercises.length - 1 &&
                    `Next Ex: ${validExercises[sessionState.currentExerciseIndex + 1]?.GripType || ''}`
                 }
              </div>
            </>
          )}
          {sessionState.currentPhase === "FINISHED" && (
             <div className="text-center">
              <motion.h1
                 initial={{ scale: 0.5, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
                 className="text-4xl md:text-5xl font-bold text-green-500 mb-6">
                    Workout Finished!
              </motion.h1>
              <motion.p
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ delay: 0.4 }}
                 className="text-xl md:text-2xl text-gray-300 mb-8">
                    Great job!
                </motion.p>
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

      {/* Bottom Section (Controls) */}
      {sessionState.currentPhase !== "FINISHED" && (
        <div className="flex-shrink-0 pb-4 mt-auto">
             <div className="flex flex-wrap space-x-2 justify-center">
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
                <button
                    onClick={handleNextPhase}
                    className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-5 rounded-full text-md font-medium transition-colors"
                    disabled={sessionState.isPaused}
                >
                    Next
                </button>
                <button
                    onClick={skipExercise}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-5 rounded-full text-md font-medium transition-colors"
                     disabled={sessionState.isPaused}
                >
                    Skip Ex.
                </button>
                <button
                    onClick={handleFinishEarly}
                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-5 rounded-full text-md font-medium transition-colors"
                    disabled={sessionState.isPaused}
                >
                    Finish
                </button>
            </div>
        </div>
      )}
    </div>
  );
}