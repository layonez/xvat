import xvatJson from '../xvat.json' assert { type: 'json' };
import warmupsJson from '../warmups.json' assert { type: 'json' };

const xvatData: XvatData = xvatJson;
// Define TypeScript types for the xvat.json structure
export interface Exercise {
  GripType: string;
  EdgeType: string;
  HangDuration_s: number;
  RestBetweenHangs_s: number;
  Reps: number;
  Sets: number;
  RestBetweenSets_min: number;
  IntensityModifier: string;
}

interface Duration {
  EstimatedWorkoutTime: string;
  Exercises: Exercise[];
}

interface IntensityLevel {
  Description: string;
  Durations: Record<string, Duration | null>;
}

interface Protocol {
  ProtocolName: string;
  Description: string;
  IntensityLevels: Record<string, IntensityLevel>;
}

interface FingerboardTrainingData {
  GlobalGripTypes: string[];
  GlobalEdgeTypes: string[];
  Protocols: Protocol[];
}

interface XvatData {
  FingerboardTrainingData: FingerboardTrainingData;
}

export interface Filter {
    protocolName: "Short Maximal Hangs" | "Longer Hangs (Strength-Endurance)" | "Classic 7:3 Repeaters" | "6:10 Heavy Repeaters" | "10:5 Repeaters" | "Frequent Low-Intensity Hangs (e.g., Abrahangs)" | "Active Recovery Hangs";
    intensityLevel: "Low" | "Medium" | "High";
    duration: 10 | 15 | 20 | 25 | 30;
}

// Load xvat.json data on module initialization
// const xvatFilePath = path.resolve(__dirname, '../xvat.json');
// const xvatData: XvatData = JSON.parse(fs.readFileSync('../xvat.json', 'utf-8'));

// Exported method to generate a list of exercises based on filters
export function generate(filter: Filter): Exercise[] {
  const { protocolName, intensityLevel, duration } = filter;

  // Find the protocol
  const protocol = xvatData.FingerboardTrainingData.Protocols.find(
    (p) => p.ProtocolName === protocolName
  );
  if (!protocol) {
    throw new Error(`Protocol '${protocolName}' not found.`);
  }

  // Find the intensity level
  const intensity = protocol.IntensityLevels[intensityLevel];
  if (!intensity) {
    throw new Error(`Intensity level '${intensityLevel}' not found in protocol '${protocolName}'.`);
  }

  // Find the duration
  const durationData = intensity.Durations[`${duration}`];
  if (!durationData) {
    throw new Error(
      `Duration '${duration}' not found in intensity level '${intensityLevel}' of protocol '${protocolName}'.`
    );
  }

  // Return the list of exercises
  return durationData.Exercises;
}

export interface Warmup {
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
  target: string[];
}

export function generateWarmups(filter: Filter): Warmup[] {
  const { duration } = filter;

  // Calculate target warmup duration (min 2 mins, max 10 mins, 20% of duration)
  const targetWarmupDuration = Math.min(Math.max(duration * 0.2, 2), 10) * 60; // Convert to seconds

  // Helper function to calculate total duration of a warmup
  const calculateWarmupDuration = (warmup: Warmup): number => {
    const oneRepDuration = warmup.Duration_s + warmup.Rest_s;
    const setDuration = oneRepDuration * warmup.Reps + warmup.RestBetweenSets_s;
    return setDuration * warmup.Sets;
  };

  // Separate warmups into required and optional categories
  const requiredWarmups = warmupsJson.filter((warmup: Warmup) =>
    warmup.target.some((t) => ["finger", "finger_joints", "wrist", "grip_strength"].includes(t)) ||
    warmup.target.some((t) => ["scapula", "upper_back", "neck", "rotator_cuff"].includes(t))
  );

  const optionalWarmups = warmupsJson.filter((warmup: Warmup) =>
    !requiredWarmups.includes(warmup)
  );

  // Prioritize required warmups
  const selectedWarmups: Warmup[] = [];
  let accumulatedDuration = 0;

  for (const warmup of requiredWarmups) {
    const warmupDuration = calculateWarmupDuration(warmup);
    if (accumulatedDuration + warmupDuration <= targetWarmupDuration) {
      selectedWarmups.push(warmup);
      accumulatedDuration += warmupDuration;
    }
    if (selectedWarmups.some((w) => w.target.some((t) => ["finger", "finger_joints", "wrist", "grip_strength"].includes(t))) &&
        selectedWarmups.some((w) => w.target.some((t) => ["scapula", "upper_back", "neck", "rotator_cuff"].includes(t)))) {
      break;
    }
  }

  // Fill remaining time with optional warmups
  for (const warmup of optionalWarmups) {
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