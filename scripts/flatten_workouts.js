import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputFilePath =  path.resolve(__dirname, '../src/exercises.json');

const outputFilePath = 'flattened_workouts.json';

/**
 * Flattens the nested protocol data into a list of specific workouts.
 * @param {Array} nestedData - The input array of protocols with nested intensity levels and durations.
 * @returns {Array} - A flat array of workout objects.
 */
function flattenWorkoutData(nestedData) {
    const flatWorkouts = []; // Initialize an empty array to store the results

    // 1. Iterate through each Protocol object
    nestedData.forEach(protocol => {
        const protocolName = protocol.ProtocolName;
        const protocolDescription = protocol.Description; // Keep protocol description for potential use

        // Check if IntensityLevels exists and is an object
        if (protocol.IntensityLevels && typeof protocol.IntensityLevels === 'object') {

            // 2. Iterate through each Intensity Level (e.g., "Low", "Medium", "High")
            Object.entries(protocol.IntensityLevels).forEach(([intensityKey, level]) => {
                // Check if level exists (it might be null or undefined)
                if (level && level.Durations && typeof level.Durations === 'object') {
                    const intensityDescription = level.Description; // Description specific to this intensity

                    // 3. Iterate through each Duration category (e.g., "5", "10", "15", "20")
                    Object.entries(level.Durations).forEach(([durationKey, durationDetails]) => {

                        // 4. Check if durationDetails exists and has a valid Exercises array
                        //    We only create a workout entry if there are actual exercises defined.
                        if (durationDetails && Array.isArray(durationDetails.Exercises) && durationDetails.Exercises.length > 0) {

                            // 5. Create the flat workout object
                            const workout = {
                                Protocol: protocolName,
                                IntensityLevel: intensityKey, // e.g., "Low", "Medium", "High"
                                Duration: durationKey,        // e.g., "5", "10", "15", "20" (as string key)
                                // Use the more specific Intensity Level Description for the workout
                                Description: intensityDescription || protocolDescription || 'N/A', // Fallback description
                                // Include the Estimated Workout Time if available
                                EstimatedTime: durationDetails.EstimatedWorkoutTime ?? 'N/A',
                                // Copy the actual array of exercises for this specific workout
                                Exercises: durationDetails.Exercises
                            };

                            // 6. Add the newly created workout object to our flat list
                            flatWorkouts.push(workout);
                        }
                        // Optional: Handle cases where durationDetails exists but Exercises is empty or missing
                        // else if (durationDetails) {
                        //    console.log(`Skipping ${protocolName} - ${intensityKey} - ${durationKey} min (No exercises found or null entry)`);
                        // }
                    });
                }
            });
        }
    });

    return flatWorkouts;
}

// --- Main Execution ---
try {
    // Read the input file (output from the previous script)
    console.log(`Reading data from ${inputFilePath}...`);
    const rawData = fs.readFileSync(inputFilePath, 'utf8');

    // Parse the JSON data
    console.log('Parsing JSON data...');
    const nestedProtocolsData = JSON.parse(rawData);

    // Perform the flattening transformation
    console.log('Flattening data into workout list...');
    const flattenedWorkouts = flattenWorkoutData(nestedProtocolsData);

    // Convert the flattened data back to a pretty-printed JSON string
    console.log('Formatting output JSON...');
    const outputJson = JSON.stringify(flattenedWorkouts, null, 2); // null, 2 for pretty printing

    // Write the flattened data to the output file
    console.log(`Writing flattened workout data to ${outputFilePath}...`);
    fs.writeFileSync(outputFilePath, outputJson, 'utf8');

    console.log(`Flattening successful! ${flattenedWorkouts.length} workouts generated.`);
    console.log(`Output saved to ${outputFilePath}`);

} catch (error) {
    console.error('An error occurred during the flattening process:');
    console.error(error);
    if (error instanceof SyntaxError) {
        console.error(`\nThere might be an issue with the JSON format in ${inputFilePath}.`);
    } else if (error.code === 'ENOENT') {
         console.error(`\nError: Input file not found at ${inputFilePath}`);
    }
}