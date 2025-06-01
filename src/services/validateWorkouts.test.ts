// src/validateWorkouts.test.ts
import { describe, it, expect } from 'vitest';
// Assuming workouts.json is in the project root directory (../ from src/)
import exercisesJson from '../workouts.json' with { type: 'json' }; 
import { Exercise, Workout } from './seshEngine'; // Types from src/seshEngine.ts

/**
 * Calculates the total duration of a single exercise in seconds.
 * This includes hang time, rest between reps, and rest between sets FOR THAT EXERCISE.
 * @param exercise The exercise object.
 * @returns Total duration of the exercise in seconds.
 */
export function calculateSingleExerciseDuration(exercise: Exercise) {
  if (exercise.Sets <= 0 || exercise.Reps <= 0) {
    return 0;
  }

  // Time for hangs in one set
  const hangTimePerSet = exercise.Duration_s * exercise.Reps;

  // Time for rests between reps in one set
  // (Reps - 1) because there's no rest after the last rep within a set block
  const restBetweenRepsPerSet = exercise.Reps > 1 ? exercise.Rest_s * (exercise.Reps - 1) : 0;

  // Total time for one set's execution (hangs + intra-rep rests)
  const timePerSetExecution = hangTimePerSet + restBetweenRepsPerSet;

  // Total time for all sets' execution
  const totalExecutionTimeForAllSets = timePerSetExecution * exercise.Sets;

  // Total time for rests between sets OF THIS EXERCISE
  // (Sets - 1) because there's no RestBetweenSets_s after the last set of this exercise
  const totalRestBetweenSets = exercise.Sets > 1 ? exercise.RestBetweenSets_s * (exercise.Sets - 1) : 0;
  
  return totalExecutionTimeForAllSets + totalRestBetweenSets;
}

const workouts: Workout[] = exercisesJson as Workout[];

describe('Workout Duration Validation', () => {
  const DIVERGENCE_THRESHOLD = 0.20; // 20%

  // Prepare test cases with a readable ID for Vitest's output
  const testCases = workouts.map(workout => ({
    ...workout, // Spread all properties of the workout
    // Create a unique and descriptive ID for each test case
    id: `${workout.Protocol} - ${workout.IntensityLevel} - ${workout.Duration}min - "${workout.Description.substring(0, 30)}..."`
  }));

  it.each(testCases)(
    'should have calculated duration within $DIVERGENCE_THRESHOLD divergence for: $id',
    (workout) => { // 'workout' here is an individual test case object from 'testCases'
      const declaredDurationSeconds = workout.Duration * 60;
      
      let calculatedTotalDurationSeconds = 0;
      for (const exercise of workout.Exercises) {
        calculatedTotalDurationSeconds += calculateSingleExerciseDuration(exercise);
      }

      const workoutIdentifier = `${workout.Protocol} (${workout.IntensityLevel}, ${workout.Duration}min)`;

      // Handle workouts with a declared duration of 0
      if (declaredDurationSeconds === 0) {
        if (calculatedTotalDurationSeconds === 0) {
          // If both declared and calculated are 0, it's considered valid (no divergence).
          expect(calculatedTotalDurationSeconds, 
            `Workout "${workoutIdentifier}" declared 0s and calculated 0s. This is valid.`
          ).toBe(0);
        } else {
          // Declared 0 but calculated > 0 implies infinite divergence. This should fail.
          const failureMessage = 
            `Workout "${workoutIdentifier}" has declared duration 0s but calculated ${calculatedTotalDurationSeconds}s. ` +
            `This results in an undefined or infinite divergence.`;
          expect.fail(failureMessage);
        }
        return; // Test case finished for declaredDurationSeconds === 0
      }

      // Normal divergence calculation for non-zero declared durations
      const difference = Math.abs(declaredDurationSeconds - calculatedTotalDurationSeconds);
      const divergence = difference / declaredDurationSeconds;

      const detailedMessage = 
        `Workout: ${workoutIdentifier}\n` +
        `Declared Duration: ${declaredDurationSeconds}s, Calculated Duration: ${calculatedTotalDurationSeconds}s\n` +
        `Difference: ${difference}s, Divergence: ${(divergence * 100).toFixed(2)}% (Threshold: ${(DIVERGENCE_THRESHOLD * 100).toFixed(2)}%)`;

      // Assertion: The calculated divergence must be less than or equal to the threshold.
      // Vitest will show 'detailedMessage' if the assertion fails.
      expect(divergence, detailedMessage).toBeLessThanOrEqual(DIVERGENCE_THRESHOLD);
    }
  );
});