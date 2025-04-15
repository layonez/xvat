import { describe, it, expect } from 'vitest';
import { Filter, generate } from '../services/seshEngine';

describe('seshEngine.generate', () => {
  it('should return the correct exercises for a valid filter', () => {
    const filter: Filter = {
      protocolName: 'Short Maximal Hangs',
      intensityLevel: 'Low',
      duration: 10,
    };

    const exercises = generate(filter);

    expect(exercises).toEqual([
      {
        GripType: 'Half-Crimp',
        EdgeType: 'Medium Edge (20mm)',
        HangDuration_s: 7,
        RestBetweenHangs_s: 180,
        Reps: 2,
        Sets: 1,
        RestBetweenSets_min: 0,
        IntensityModifier: 'Bodyweight or small added weight',
      },
    ]);
  });

  it('should throw an error if the protocol is not found', () => {
    const filter: Filter = {
      // @ts-ignore 
      protocolName: 'Nonexistent Protocol',
      intensityLevel: 'Low',
      duration: 10,
    };

    expect(() => generate(filter)).toThrow('Protocol \'Nonexistent Protocol\' not found.');
  });

  it('should throw an error if the intensity level is not found', () => {
    const filter: Filter = {
      protocolName: 'Short Maximal Hangs',
      // @ts-ignore 
      intensityLevel: 'Nonexistent Intensity',
      duration: 10,
    };

    expect(() => generate(filter)).toThrow(
      "Intensity level 'Nonexistent Intensity' not found in protocol 'Short Maximal Hangs'."
    );
  });

  it('should throw an error if the duration is not found', () => {
    const filter: Filter = {
      protocolName: 'Short Maximal Hangs',
      intensityLevel: 'Low',
      // @ts-ignore 
      duration: 'Nonexistent Duration',
    };

    expect(() => generate(filter)).toThrow(
      "Duration 'Nonexistent Duration' not found in intensity level 'Low' of protocol 'Short Maximal Hangs'."
    );
  });
});
