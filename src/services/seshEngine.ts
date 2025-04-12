import fs from 'fs';
import path from 'path';

// Define TypeScript types for the xvat.json structure
interface Exercise {
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

// Load xvat.json data on module initialization
const xvatFilePath = path.resolve(__dirname, '../xvat.json');
const xvatData: XvatData = JSON.parse(fs.readFileSync(xvatFilePath, 'utf-8'));

// Exported method to generate a list of exercises based on filters
export function generate(filter: {
  protocolName: string;
  intensityLevel: string;
  duration: string;
}): Exercise[] {
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
  const durationData = intensity.Durations[duration];
  if (!durationData) {
    throw new Error(
      `Duration '${duration}' not found in intensity level '${intensityLevel}' of protocol '${protocolName}'.`
    );
  }

  // Return the list of exercises
  return durationData.Exercises;
}