import type { Filter } from "../services/seshEngine"; // Assuming this path is correct
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DurationWheel from "./DurationWheel"; // Import the new component

export default function Page() {
  const [duration, setDuration] = useState(10); // Default to 10 as per original steps 5, 10, 15
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // --- Swipe Gesture Logic (Keep as is) ---
  useEffect(() => {
    // Ensure window is defined (for SSR frameworks like Next.js)
    if (typeof window !== 'undefined') {
        const handleTouchStart = (e: TouchEvent) => {
            // Only track swipes if not interacting with the wheel or other interactive elements
            if ((e.target as HTMLElement)?.closest('.duration-wheel-container')) {
                 startY = null; // Don't swipe if touching the wheel area
                 return;
            }
            startY = e.touches[0].clientY;
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!startY) {return;}

            const currentY = e.touches[0].clientY;
            const diff = startY - currentY;

            // If swiping up and menu is closed, open it
            if (diff > 50 && !menuOpen) {
                setMenuOpen(true);
                startY = null; // Reset after triggering
            }

            // If swiping down and menu is open, close it
            // Allow swipe down only if the menu content is scrolled to the top OR if target is the drag handle
            const menuElement = menuRef.current;
            const targetIsDragHandle = (e.target as HTMLElement)?.closest('.drag-handle');
            const canSwipeDown = menuElement ? menuElement.scrollTop <= 0 : true; // Default to true if menuRef not available yet

            if (diff < -50 && menuOpen && (canSwipeDown || targetIsDragHandle)) {
                 // Check if touch started near the top drag handle area for more leniency
                const initialTouchOnHandleArea = startY < 100; // Allow swipe down if starting near the top handle

                if (canSwipeDown || initialTouchOnHandleArea || targetIsDragHandle) {
                     setMenuOpen(false);
                     startY = null; // Reset after triggering
                }

            }
        };


        let startY: number | null = null;
        document.addEventListener("touchstart", handleTouchStart, { passive: true }); // Passive true is generally fine for start
        document.addEventListener("touchmove", handleTouchMove, { passive: false }); // Use passive false if preventDefault might be needed

        return () => {
            document.removeEventListener("touchstart", handleTouchStart);
            document.removeEventListener("touchmove", handleTouchMove);
        };
    }
  }, [menuOpen]); // Re-run when menuOpen changes to potentially adjust logic if needed

  // --- Menu states (Keep as is) ---
  const [type, setType] = useState("Yin");
  const [level, setLevel] = useState("Intermediate 1");
  const [voice, setVoice] = useState("Selama");
  const [instruction, setInstruction] = useState("Full");
  const [videoModel, setVideoModel] = useState("Alexa");
  const [viewPoses, setViewPoses] = useState("0 Liked, 0 Disliked");
  const [transitionSpeed, setTransitionSpeed] = useState("Default");
  const [holdLengths, setHoldLengths] = useState("Auto");
  const [savasana, setSavasana] = useState("None");
  const [musicStyle, setMusicStyle] = useState("Alt Beats");
  const [protocolName, setProtocolName] = useState<Filter["protocolName"]>("Short Maximal Hangs");
  const [intensityLevel, setIntensityLevel] = useState<Filter["intensityLevel"]>("Low");

  // Toggle menu open/closed
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  // Selector component (Keep as is)
  const Selector = ({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) => (
    <div className="bg-[#3a3330] rounded-lg p-4 flex flex-col cursor-pointer" onClick={onClick}> {/* Added cursor-pointer */}
      <span className="text-gray-300 text-sm">{label}</span>
      <span className="text-white text-lg font-medium truncate">{value}</span>
    </div>
  );

  return (
    <div className="relative h-screen w-full bg-[#1a1512] text-white overflow-hidden">
      {/* Welcome text */}
      <div className="pt-16 text-center">
        <h1 className="text-2xl font-medium">Welcome back!</h1>
      </div>

      {/* Duration wheel - only visible when menu is closed */}
      <AnimatePresence>
        {!menuOpen && (
          <motion.div
            key="duration-wheel"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className="flex justify-center items-center mt-16 duration-wheel-container" // Added container class for swipe detection
          >
            <DurationWheel
              value={duration}
              onChange={setDuration}
              min={5}
              max={15} // Set max to 15 to match original steps
              step={5}
              // Optional: Adjust size if needed
              // size={256}
              // strokeWidth={4}
              // handleSize={24}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu - two states: collapsed and expanded */}
      <AnimatePresence initial={false}>
        {menuOpen ? (
          // Expanded menu - full screen
          <motion.div
            key="expanded-menu"
            // Assign ref here for scroll detection in swipe handler
            ref={menuRef}
            className="fixed inset-0 bg-[#2a2320] z-10 pt-2 pb-16 flex flex-col" // Use flex-col
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Drag handle Area (sticky top) */}
            <div className="flex-shrink-0 sticky top-0 bg-[#2a2320] z-20 drag-handle" onClick={toggleMenu}> {/* Added drag-handle class */}
                <div className="flex justify-center py-3"> {/* Increased padding for easier grab */}
                    <div className="w-10 h-1 bg-white/30 rounded-full cursor-pointer" />
                </div>
            </div>

            {/* Expanded menu content - scrollable */}
            {/* Use overflow-y-auto and flex-grow to make this part scrollable */}
            <div className="px-4 overflow-y-auto flex-grow pb-4"> {/* Added pb-4 */}
              <div className="mb-6">
                <h2 className="text-lg font-medium mb-3">PRACTICE</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Selector label="Type" value={type} />
                  <Selector label="Level" value={level} />
                  <Selector label="Voice" value={voice} />
                  <Selector label="Instruction" value={instruction} />
                  <Selector label="Video Model" value={videoModel} />
                  <Selector label="Protocol Name" value={protocolName} />
                  <Selector label="Intensity Level" value={intensityLevel} />
                  <Selector label="View Poses" value={viewPoses} />
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-medium mb-3">TIMING</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Selector label="Transition Speed" value={transitionSpeed} />
                  <Selector label="Hold Lengths" value={holdLengths} />
                  <Selector label="Savasana" value={savasana} />
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-medium mb-3">MUSIC</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Selector label="Style" value={musicStyle} />
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          // Collapsed menu - just at the bottom
          <motion.div
            key="collapsed-menu"
            className="fixed bottom-0 left-0 right-0 bg-[#2a2320] rounded-t-3xl shadow-lg z-10"
            initial={{ y: "100%" }}
            // Animate slightly above the nav bar
            animate={{ y: `-${0}px` }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            // No paddingBottom needed here as it sits above the nav bar
          >
            {/* Drag handle */}
            <div className="flex justify-center py-3 cursor-pointer drag-handle" onClick={toggleMenu}> {/* Added drag-handle class */}
              <div className="w-10 h-1 bg-white/30 rounded-full" />
            </div>

            {/* Collapsed menu content */}
            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Selector label="Protocol Name" value={protocolName} />
                <Selector label="Intensity Level" value={intensityLevel} />
              </div>

              {/* Start button */}
              <button className="w-full bg-[#2196f3] text-white py-4 rounded-full text-xl font-medium">
                START
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}