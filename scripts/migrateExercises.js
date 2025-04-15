import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputFilePath =  path.resolve(__dirname, '../src/xvat.json');
const outputFilePath = './warmups1.json'; // Changed extension for clarity

function migrateExerciseData(data) {
    // Iterate through each protocol object in the main array
    data.FingerboardTrainingData.Protocols.forEach(protocol => {
        // Check if IntensityLevels exists and is an object
        if (protocol.IntensityLevels && typeof protocol.IntensityLevels === 'object') {
            // Iterate through each intensity level (Low, Medium, High)
            Object.values(protocol.IntensityLevels).forEach(level => {
                // Check if level exists and has Durations
                if (level && level.Durations && typeof level.Durations === 'object') {
                    // Iterate through each duration category ("5", "10", etc.)
                    Object.values(level.Durations).forEach(durationDetails => {
                        // IMPORTANT: Check if durationDetails is not null and has an Exercises array
                        if (durationDetails && Array.isArray(durationDetails.Exercises)) {
                            // Use map to create a new array with transformed exercises
                            const migratedExercises = durationDetails.Exercises.map(oldExercise => {
                                // Handle potential missing RestBetweenSets_min, default to 0
                                const restMin = oldExercise.RestBetweenSets_min ?? 0;

                                const newExercise = {
                                    // Generate Description
                                    Description: `${oldExercise.GripType ?? 'Unknown Grip'} on ${oldExercise.EdgeType ?? 'Unknown Edge'}`,
                                    // Add empty Additional_Info
                                    Additional_Info: "",
                                    // Keep existing fields (use nullish coalescing '??' for safety)
                                    GripType: oldExercise.GripType ?? null,
                                    EdgeType: oldExercise.EdgeType ?? null,
                                    Reps: oldExercise.Reps ?? null,
                                    Sets: oldExercise.Sets ?? null,
                                    // Rename fields
                                    Duration_s: oldExercise.HangDuration_s ?? null,
                                    Rest_s: oldExercise.RestBetweenHangs_s ?? null,
                                    Intensity_Modifier: oldExercise.IntensityModifier ?? null,
                                    // Rename and convert units
                                    RestBetweenSets_s: restMin * 60,
                                    // Optional 'target' field - omitting for now
                                    // target: []
                                };

                                // Optional: Clean up properties that ended up as null if the source was missing
                                // Object.keys(newExercise).forEach(key => {
                                //     if (newExercise[key] === null) {
                                //         delete newExercise[key];
                                //     }
                                // });

                                return newExercise;
                            });

                            // Replace the old exercises array with the new migrated one
                            durationDetails.Exercises = migratedExercises;
                        }
                    });
                }
            });
        }
    });
    return data; // Return the modified data structure
}

// --- Main Execution ---
try {
    // Read the input file synchronously
    console.log(`Reading data from ${inputFilePath}...`);
    const rawData = fs.readFileSync(inputFilePath, 'utf8');

    // Parse the JSON data
    console.log('Parsing JSON data...');
    const protocolsData = JSON.parse(rawData);

    // Perform the migration
    console.log('Migrating exercise data structure...');
    const migratedData = migrateExerciseData(protocolsData);

    // Convert the migrated data back to a pretty-printed JSON string
    console.log('Formatting output JSON...');
    const outputJson = JSON.stringify(migratedData, null, 2); // null, 2 for pretty printing

    // Write the migrated data to the output file
    console.log(`Writing migrated data to ${outputFilePath}...`);
    fs.writeFileSync(outputFilePath, outputJson, 'utf8');

    console.log(`Migration successful! Output saved to ${outputFilePath}`);

} catch (error) {
    console.error('An error occurred during the migration process:');
    console.error(error);
    if (error instanceof SyntaxError) {
        console.error(`\nThere might be an issue with the JSON format in ${inputFilePath}.`);
    } else if (error.code === 'ENOENT') {
         console.error(`\nError: Input file not found at ${inputFilePath}`);
    }
}