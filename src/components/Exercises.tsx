import { ChevronLeft, Trash2 } from "lucide-react"
import { Exercise } from "../services/seshEngine"

interface ExerciseListScreenProps {
  onStart: () => void
  onBack: () => void
  exercises: Exercise[]
}


export function ExerciseListScreen({ onStart, onBack, exercises }: ExerciseListScreenProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-[#1a1512] text-white pb-16">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-gray-800 active:bg-gray-700 transition-colors touch-manipulation"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-medium">Exercises</h1>
        <div className="w-10"></div> {/* Spacer for alignment */}
      </div>

      {/* Exercise list */}
      <div className="p-4 space-y-4">
        {exercises.map((exercise, index) => (
          <div
            key={index}
            className="bg-[#2a2320] rounded-lg overflow-hidden shadow-md border border-gray-800"
          >
            <div className="p-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium">{`${exercise.GripType === "None" ? "" : (exercise.GripType + " ")}${exercise.Description}`}</h2>
                <Trash2 className="text-gray-400" />
              </div>
              <div className="flex  items-start mt-2">
                <div className="text-gray-400">{exercise.Additional_Info}</div>
              </div>


              <div className="flex flex-wrap gap-2 mt-3">
                <span className="bg-[#2196f3] text-white px-3 py-1 rounded-full text-sm">
                  {exercise.Sets} set{exercise.Sets > 1 ? "s" : ""}
                </span>
                <span className="text-gray-400 mx-1">×</span>
                <span className="bg-[#2196f3] text-white px-3 py-1 rounded-full text-sm">{exercise.Reps} reps</span>
                <span className="text-gray-400 mx-1">×</span>
                <span className="bg-[#2196f3] text-white px-3 py-1 rounded-full text-sm">
                  {formatTime(exercise.Duration_s)} per rep
                </span>
              </div>

              <div className="mt-2 text-gray-300">Rest {formatTime(exercise.Rest_s)} per rep</div>

              <div className="mt-2">
                <div className="text-gray-400">Resistance</div>
                <div className="text-gray-300">{exercise.Intensity_Modifier}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Start workout button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#1a1512] border-t border-gray-800">
        <button
          className="w-full bg-[#2196f3] text-white py-4 rounded-full text-lg font-medium active:bg-[#1976d2] transition-colors touch-manipulation"
          onClick={() => onStart()}
        >
          Start Workout
        </button>
      </div>
    </div>
  )
}
