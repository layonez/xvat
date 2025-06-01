import exercisesJson from '../workouts.json' assert { type: 'json' };
import warmupsJson from '../warmups.json' assert { type: 'json' };

const workouts: Workout[] = exercisesJson as Workout[];

export interface Exercise {
  Description: string;
  Additional_Info: string;
  GripType: string;
  EdgeType: string;
  Duration_s: number;
  Rest_s: number;
  Reps: number;
  Sets: number;
  RestBetweenSets_s: number;
  Intensity_Modifier: string;
  Target?: string[];
}

export interface Workout {
  Protocol: "Short Maximal Hangs" | "Longer Hangs (Strength-Endurance)" | "Classic 7:3 Repeaters" | "6:10 Heavy Repeaters" | "10:5 Repeaters" | "Frequent Low-Intensity Hangs (e.g., Abrahangs)" | "Active Recovery Hangs";
  IntensityLevel: "Low" | "Medium" | "High";
  Duration: 10 | 15 | 20 | 25 | 30;
  Description: string;
  EstimatedTime: string;
  Exercises: Exercise[];
}


export interface Filter {
  protocolName: "Short Maximal Hangs" | "Longer Hangs (Strength-Endurance)" | "Classic 7:3 Repeaters" | "6:10 Heavy Repeaters" | "10:5 Repeaters" | "Frequent Low-Intensity Hangs (e.g., Abrahangs)" | "Active Recovery Hangs";
  intensityLevel: "Low" | "Medium" | "High";
  duration: 10 | 15 | 20 | 25 | 30;
}

export function generate(filter: Filter): Exercise[] {
  const { protocolName, intensityLevel, duration } = filter;

  // Find the protocol
  const protocol = workouts.filter(
    (p) => p.Protocol === protocolName
  );
  if (!protocol) {
    throw new Error(`Protocol '${protocolName}' not found.`);
  }

  // Find the intensity level
  const intensity = protocol.filter((i) => i.IntensityLevel === intensityLevel);
  if (!intensity) {
    throw new Error(`Intensity level '${intensityLevel}' not found in protocol '${protocolName}'.`);
  }

  // Find the duration
  const durationData = intensity.filter((d) => d.Duration === duration);
  if (durationData.length === 0) {
    throw new Error(
      `Duration '${duration}' not found in intensity level '${intensityLevel}' of protocol '${protocolName}'.`
    );
  }

  // Return the list of exercises
  return durationData[0].Exercises;
}

export function generateWarmups(filter: Filter): Exercise[] {
  const { duration } = filter;

  // Calculate target warmup duration (min 2 mins, max 10 mins, 20% of duration)
  const targetWarmupDuration = Math.min(Math.max(duration * 0.2, 2), 10) * 60; // Convert to seconds

  // Helper function to calculate total duration of a warmup
  const calculateWarmupDuration = (warmup: Exercise): number => {
    const oneRepDuration = warmup.Duration_s + warmup.Rest_s;
    const setDuration = oneRepDuration * warmup.Reps + warmup.RestBetweenSets_s;
    return setDuration * warmup.Sets;
  };

  // Shuffle array utility function
  const shuffleArray = <T>(array: T[]): T[] => {
    return array
      .map((item) => ({ item, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ item }) => item);
  };

  // Separate warmups into required and optional categories
  const requiredFingerWarmups: Exercise[] = warmupsJson.filter((warmup: Exercise) =>
    warmup.Target?.some((t) => ["finger", "finger_joints", "wrist", "grip_strength"].includes(t))
  );

  const requiredScapulaWarmups: Exercise[] = warmupsJson.filter((warmup: Exercise) =>
    warmup.Target?.some((t) => ["scapula", "upper_back", "neck", "rotator_cuff"].includes(t))
  );

  const optionalWarmups = warmupsJson.filter((warmup: Exercise) =>
    !requiredFingerWarmups.includes(warmup) && !requiredScapulaWarmups.includes(warmup)
  );

  // Shuffle warmups to introduce fuzziness
  const shuffledFingerWarmups = shuffleArray(requiredFingerWarmups);
  const shuffledScapulaWarmups = shuffleArray(requiredScapulaWarmups);
  const shuffledOptionalWarmups = shuffleArray(optionalWarmups);

  // Prioritize required warmups
  const selectedWarmups: Exercise[] = [];
  let accumulatedDuration = 0;

  // Ensure at least one warmup from each required category
  for (const warmup of shuffledFingerWarmups) {
    const warmupDuration = calculateWarmupDuration(warmup);
    if (accumulatedDuration + warmupDuration <= targetWarmupDuration) {
      selectedWarmups.push(warmup);
      accumulatedDuration += warmupDuration;
      break;
    }
  }

  for (const warmup of shuffledScapulaWarmups) {
    const warmupDuration = calculateWarmupDuration(warmup);
    if (accumulatedDuration + warmupDuration <= targetWarmupDuration) {
      selectedWarmups.push(warmup);
      accumulatedDuration += warmupDuration;
      break;
    }
  }

  // Fill remaining time with optional warmups
  for (const warmup of shuffledOptionalWarmups) {
    const warmupDuration = calculateWarmupDuration(warmup);
    if (accumulatedDuration + warmupDuration <= targetWarmupDuration) {
      selectedWarmups.push(warmup);
      accumulatedDuration += warmupDuration;
    }
    if (accumulatedDuration >= targetWarmupDuration) {
      break;
    }
  }

  return selectedWarmups;
}