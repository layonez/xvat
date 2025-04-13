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
  max = 20,
  step = 5,
  size = 256,
  strokeWidth = 4,
  handleSize = 24,
}) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const radius = size / 2;
  const trackRadius = radius - strokeWidth / 2;
  const handleRadius = handleSize / 2;

  // --- Angle Calculation Callbacks ---

  const valueToAngle = useCallback((val: number): number => {
    const normalizedValue = (val - min) / (max - min);
    // Map 0-1 to 0-360 degrees, starting at the top (-90 degrees offset)
    return normalizedValue * 360 - 90;
  }, [min, max]);

  const angleToValue = useCallback((angleDegrees: number): number => {
    // Normalize angle to 0-360, starting from the top
    let normalizedAngle = (angleDegrees + 90 + 360) % 360;

    // Handle the 0/360 degree wrap-around case for max value
    // If very close to 360, consider it max
    if (normalizedAngle > 359.9) {
        normalizedAngle = 360;
    }
     // If very close to 0 (from negative side), consider it min
     if (normalizedAngle < 0.1 && angleDegrees < -89) { // Check original angle too
        normalizedAngle = 0;
     }

    const rawValue = min + (normalizedAngle / 360) * (max - min);

    // Snap to the nearest step
    const steps = (rawValue - min) / step;
    const snappedSteps = Math.round(steps);
    let snappedValue = min + snappedSteps * step;

    // Clamp value within min/max
    snappedValue = Math.max(min, Math.min(max, snappedValue));

    return snappedValue;
  }, [min, max, step]);

  // --- State for Visual Handle Angle ---
  // This angle drives the handle's visual position. It follows the drag directly
  // and animates to the snapped value's angle on release.
  const [displayAngle, setDisplayAngle] = useState<number>(() => valueToAngle(value));

  // --- Interaction Logic ---

  const handleInteraction = useCallback(
    (clientX: number, clientY: number) => {
      if (!wheelRef.current) return;

      const rect = wheelRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const x = clientX - centerX;
      const y = clientY - centerY;

      const angleRad = Math.atan2(y, x);
      let angleDeg = (angleRad * 180) / Math.PI;

      // Update the visual handle position immediately (no snapping)
      setDisplayAngle(angleDeg);

      // Calculate the corresponding *snapped* value for feedback/onChange
      const newValue = angleToValue(angleDeg);

      // Call onChange only if the snapped value actually changes
      if (newValue !== value) {
        onChange(newValue);
      }
    },
    [angleToValue, onChange, value, setDisplayAngle] // Include value here
  );

  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;

      let clientX: number, clientY: number;
      if (e instanceof MouseEvent) {
          clientX = e.clientX;
          clientY = e.clientY;
      } else {
          // Prevent page scrolling while dragging the wheel (important for touch)
          e.preventDefault();
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      }
      handleInteraction(clientX, clientY);
  }, [isDragging, handleInteraction]);

  const handleRelease = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      // Animate the handle to the final snapped value's position
      const finalAngle = valueToAngle(value);
      setDisplayAngle(finalAngle);
      document.body.style.cursor = 'default';
    }
  }, [isDragging, value, valueToAngle, setIsDragging, setDisplayAngle]); // Add dependencies


  // --- Event Listeners Effect ---
  useEffect(() => {
    // Separate move/end listeners for mouse and touch
    const handleMouseMove = (e: MouseEvent) => handleMove(e);
    const handleTouchMove = (e: TouchEvent) => handleMove(e);

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleRelease);
      // Use passive: false for touchmove to allow preventDefault
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleRelease);
      window.addEventListener("touchcancel", handleRelease);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none'; // Prevent text selection globally
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleRelease);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleRelease);
      window.removeEventListener("touchcancel", handleRelease);
      // Reset cursor and selection only if it was set by this component
      if (document.body.style.cursor === 'grabbing') {
         document.body.style.cursor = 'default';
      }
       if (document.body.style.userSelect === 'none') {
         document.body.style.userSelect = 'auto';
      }
    };
    // Ensure handleMove and handleRelease are stable or included in deps
  }, [isDragging, handleMove, handleRelease]);

  // --- Sync displayAngle if value prop changes externally ---
  useEffect(() => {
    // Only update displayAngle if not currently dragging
    // This prevents the handle jumping if the parent updates `value` mid-drag
    if (!isDragging) {
      setDisplayAngle(valueToAngle(value));
    }
  }, [value, isDragging, valueToAngle]);


  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevent default drag behavior (like image dragging)
    setIsDragging(true);
    handleInteraction(e.clientX, e.clientY); // Update value on initial click
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // No preventDefault needed here unless the entire wheel area shouldn't scroll
    setIsDragging(true);
    handleInteraction(e.touches[0].clientX, e.touches[0].clientY); // Update value on initial touch
  };

  // --- SVG Arc Calculation ---
  const circumference = 2 * Math.PI * trackRadius;
  const progress = Math.max(0, Math.min(1, (value - min) / (max - min))); // Clamp progress 0-1
  // Prevent tiny negative values or values slightly > circumference
  const strokeDashoffsetValue = Math.max(0, circumference * (1 - progress));
  const strokeDasharray = `${circumference} ${circumference}`; // Full circle, use offset


  // --- Handle Position Calculation (using displayAngle) ---
  const handleAngleRad = (displayAngle * Math.PI) / 180;
  const handleX = trackRadius * Math.cos(handleAngleRad);
  const handleY = trackRadius * Math.sin(handleAngleRad);
  const handleTop = radius + handleY - handleRadius;
  const handleLeft = radius + handleX - handleRadius;

  // --- Dynamic Styles ---
  const handleStyle: React.CSSProperties = {
    width: handleSize,
    height: handleSize,
    top: `${handleTop}px`,
    left: `${handleLeft}px`,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none', // Prevent scrolling etc. when interacting with handle
    // Apply transition only when NOT dragging
    transition: isDragging ? 'none' : 'top 0.25s ease-out, left 0.25s ease-out',
    // Hint for browser optimization for transforms/position changes
    willChange: 'top, left',
    // transform: 'translateZ(0)', // Another optimization hint if needed
  };

  const progressCircleStyle: React.CSSProperties = {
    strokeDashoffset: strokeDashoffsetValue,
    // Add transition for the arc fill as well if desired
     transition: 'stroke-dashoffset 0.25s ease-out',
  };


  return (
    <div
      ref={wheelRef}
      className="relative flex items-center justify-center touch-none select-none" // Prevent text selection on the wheel itself
      style={{ width: size, height: size, cursor: isDragging ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Track */}
      <svg className="absolute inset-0 pointer-events-none" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={radius}
          cy={radius}
          r={trackRadius}
          fill="none"
          stroke="hsl(215, 40%, 85%)" // Lighter track color
          strokeWidth={strokeWidth}
        />
        {/* Progress arc - Using stroke-dashoffset for smoother animation */}
        <circle
          cx={radius}
          cy={radius}
          r={trackRadius}
          fill="none"
          stroke="hsl(205, 60%, 50%)" // Progress color
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          // strokeDashoffset={strokeDashoffsetValue} // Applied via style
          style={progressCircleStyle} // Apply dynamic style
          strokeLinecap="round"
          transform={`rotate(-90 ${radius} ${radius})`} // Start from top
        />
      </svg>

      {/* Draggable Handle */}
      <div
        className="absolute bg-blue-500 rounded-full shadow-md"
        style={handleStyle}
        // Event listeners are on the parent div, no need to add stopPropagation here
        // unless you specifically want interaction *only* on the handle itself.
      />

      {/* Duration text */}
      <div className="text-center select-none pointer-events-none z-10"> {/* Ensure text is above SVG */}
        <div className="text-6xl font-light text-slate-200">{value}</div>
        <div className="text-lg text-slate-200">minutes</div>
      </div>
    </div>
  );
};

export default DurationWheel;