import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Exercise } from "../services/seshEngine";

interface GuidedSessionProps {
  exercises: Exercise[];
}

export default function GuidedSession({ exercises }: GuidedSessionProps) {
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(exercises[0]?.HangDuration_s || 0);

  useEffect(() => {
    const timer = setInterval(() => {
    setTimeLeft((prev: number): number => {
      if (prev > 0) return prev - 1;
      clearInterval(timer);
      return 0;
    });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentExerciseIndex]);

  const nextExercise = () => {
    if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex((prev) => prev + 1);
      setTimeLeft(exercises[currentExerciseIndex + 1]?.HangDuration_s || 0);
    }
  };

  const currentExercise = exercises[currentExerciseIndex];

  return (
    <div className="h-screen w-full bg-[#1a1512] text-white flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <h1 className="text-2xl font-medium mb-4">{currentExercise?.GripType}</h1>
        <p className="text-lg mb-2">Edge Type: {currentExercise?.EdgeType}</p>
        <p className="text-lg mb-2">Reps: {currentExercise?.Reps}</p>
        <p className="text-lg mb-2">Sets: {currentExercise?.Sets}</p>
        <p className="text-lg mb-2">Rest Between Hangs: {currentExercise?.RestBetweenHangs_s}s</p>
        <p className="text-lg mb-2">Rest Between Sets: {currentExercise?.RestBetweenSets_min}min</p>
        <div className="text-4xl font-bold mt-4">{timeLeft}s</div>
      </motion.div>

      <button
        onClick={nextExercise}
        className="mt-8 bg-[#2196f3] text-white py-2 px-6 rounded-full text-lg font-medium"
        disabled={timeLeft > 0}
      >
        {currentExerciseIndex < exercises.length - 1 ? "Next Exercise" : "Finish"}
      </button>
    </div>
  );
}
