import React, { useState, useRef, useEffect, useCallback } from "react";

interface DurationWheelProps {
  value: number;
  onChange: (newValue: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: number; // Diameter of the wheel in pixels
  strokeWidth?: number;
  handleSize?: number;
}

const DurationWheel: React.FC<DurationWheelProps> = ({
  value,
  onChange,
  min = 5,
  max = 15, // Changed default max to 15 based on original code
  step = 5,
  size = 256, // Corresponds to w-64 in Tailwind
  strokeWidth = 4,
  handleSize = 24, // Corresponds to w-6 h-6
}) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const radius = size / 2;
  const trackRadius = radius - strokeWidth / 2; // Radius of the path center
  const handleRadius = handleSize / 2;

  const valueToAngle = useCallback((val: number): number => {
    const normalizedValue = (val - min) / (max - min);
    // Map 0-1 to 0-360 degrees, starting at the top (-90 degrees offset)
    return normalizedValue * 360 - 90;
  }, [min, max]);

  const angleToValue = useCallback((angleDegrees: number): number => {
      // Normalize angle to 0-360, starting from the top
      let normalizedAngle = (angleDegrees + 90 + 360) % 360;

      const rawValue = min + (normalizedAngle / 360) * (max - min);

      // Snap to the nearest step
      const steps = (rawValue - min) / step;
      const snappedSteps = Math.round(steps);
      let snappedValue = min + snappedSteps * step;

      // Clamp value within min/max
      snappedValue = Math.max(min, Math.min(max, snappedValue));

      return snappedValue;
  }, [min, max, step]);


  const handleInteraction = useCallback(
    (clientX: number, clientY: number) => {
      if (!wheelRef.current) return;

      const rect = wheelRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const x = clientX - centerX;
      const y = clientY - centerY;

      // Calculate angle in radians, then convert to degrees
      const angleRad = Math.atan2(y, x);
      const angleDeg = (angleRad * 180) / Math.PI;

      const newValue = angleToValue(angleDeg);

      if (newValue !== value) {
        onChange(newValue);
      }
    },
    [angleToValue, onChange, value]
  );

  const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isDragging) return;
      handleInteraction(e.clientX, e.clientY);
  }, [isDragging, handleInteraction]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
      if (!isDragging) return;
      // Prevent page scrolling while dragging the wheel
      e.preventDefault();
      handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
  }, [isDragging, handleInteraction]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      // Optional: Add cursor style change back to default
      document.body.style.cursor = 'default';
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false }); // Need passive: false to preventDefault
      window.addEventListener("touchend", handleTouchEnd);
      window.addEventListener("touchcancel", handleTouchEnd); // Handle cancellation
      // Optional: Change cursor during drag
      document.body.style.cursor = 'grabbing';
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
       // Reset cursor when component unmounts or drag ends
      if (document.body.style.cursor === 'grabbing') {
         document.body.style.cursor = 'default';
      }
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevent text selection during drag
    setIsDragging(true);
    handleInteraction(e.clientX, e.clientY); // Update value on initial click
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // Don't prevent default here if the main wheel area should still be scrollable
    // If only the handle is draggable, add preventDefault there.
    setIsDragging(true);
    handleInteraction(e.touches[0].clientX, e.touches[0].clientY); // Update value on initial touch
  };

  // SVG Arc calculation
  const circumference = 2 * Math.PI * (radius - strokeWidth / 2); // Use radius of the stroke center
  const progress = (value - min) / (max - min);
  const strokeDasharray = `${progress * circumference} ${circumference}`;

  // Handle position calculation
  const handleAngleDegrees = valueToAngle(value); // Angle in degrees for CSS transform
  // Calculate handle center position relative to the wheel center
  const handleAngleRad = (handleAngleDegrees * Math.PI) / 180;
  const handleX = trackRadius * Math.cos(handleAngleRad);
  const handleY = trackRadius * Math.sin(handleAngleRad);

  // Position handle's top-left corner relative to wheel's top-left corner
  const handleTop = radius + handleY - handleRadius;
  const handleLeft = radius + handleX - handleRadius;

  return (
    <div
      ref={wheelRef}
      className="relative flex items-center justify-center cursor-grab"
      style={{ width: size, height: size }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Track */}
      <svg className="absolute inset-0" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={radius}
          cy={radius}
          r={trackRadius}
          fill="none"
          stroke="#1e3a5f" // Track background color
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={radius}
          cy={radius}
          r={trackRadius}
          fill="none"
          stroke="#2980b9" // Progress color
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          transform={`rotate(-90 ${radius} ${radius})`} // Start from top
        />
      </svg>

      {/* Draggable Handle */}
      <div
        className="absolute bg-[#2196f3] rounded-full select-none" // prevent selection on handle
        style={{
          width: handleSize,
          height: handleSize,
          top: `${handleTop}px`,
          left: `${handleLeft}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        // Make the handle itself draggable separately if preferred
        // onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e); }}
        // onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e); }}
      />

      {/* Duration text */}
      <div className="text-center select-none pointer-events-none"> {/* Prevent text selection */}
        <div className="text-7xl font-light">{value}</div>
        <div className="text-xl">minutes</div>
      </div>
    </div>
  );
};

export default DurationWheel;