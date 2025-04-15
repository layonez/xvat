import { describe, it, expect } from 'vitest';
import { Filter, generate, generateWarmups } from '../services/seshEngine';

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
        Reps: 3,
        Sets: 1,
        RestBetweenSets_min: 0,
        IntensityModifier: 'Bodyweight or moderate added weight',
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


describe('seshEngine.generateWarmups', () => {
    it('should calculate target warmup duration correctly', () => {
      const filter: Filter = {
        protocolName: 'Short Maximal Hangs',
        intensityLevel: 'Low',
        duration: 20,
      };
  
      const warmups = generateWarmups(filter);
  
      const totalDuration = warmups.reduce((acc, warmup) => {
        const oneRepDuration = warmup.Duration_s + warmup.Rest_s;
        const setDuration = oneRepDuration * warmup.Reps + warmup.RestBetweenSets_s;
        return acc + setDuration * warmup.Sets;
      }, 0);
  
      expect(totalDuration).toBeLessThanOrEqual(10 * 60); // Max 10 minutes
      expect(totalDuration).toBeGreaterThanOrEqual(2 * 60); // Min 2 minutes
    });
  
    it('should include at least one exercise targeting finger, finger_joints, wrist, or grip_strength', () => {
      const filter: Filter = {
        protocolName: 'Short Maximal Hangs',
        intensityLevel: 'Low',
        duration: 20,
      };
  
      const warmups = generateWarmups(filter);
  
      const hasFingerTarget = warmups.some((warmup) =>
        warmup.target.some((t) => ['finger', 'finger_joints', 'wrist', 'grip_strength'].includes(t))
      );
  
      expect(hasFingerTarget).toBe(true);
    });
  
    it('should include at least one exercise targeting scapula, upper_back, neck, or rotator_cuff', () => {
      const filter: Filter = {
        protocolName: 'Short Maximal Hangs',
        intensityLevel: 'Low',
        duration: 20,
      };
  
      const warmups = generateWarmups(filter);
  
      const hasScapulaTarget = warmups.some((warmup) =>
        warmup.target.some((t) => ['scapula', 'upper_back', 'neck', 'rotator_cuff'].includes(t))
      );
  
      expect(hasScapulaTarget).toBe(true);
    });
  
    it('should fill remaining time with optional exercises', () => {
      const filter: Filter = {
        protocolName: 'Short Maximal Hangs',
        intensityLevel: 'Low',
        duration: 20,
      };
  
      const warmups = generateWarmups(filter);
  
      const totalDuration = warmups.reduce((acc, warmup) => {
        const oneRepDuration = warmup.Duration_s + warmup.Rest_s;
        const setDuration = oneRepDuration * warmup.Reps + warmup.RestBetweenSets_s;
        return acc + setDuration * warmup.Sets;
      }, 0);
  
      expect(totalDuration).toBeLessThanOrEqual(10 * 60); // Max 10 minutes
    });
  });
  