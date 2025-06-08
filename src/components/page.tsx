import { AnimatePresence, motion } from "framer-motion";
import DurationWheel from "./DurationWheel"; // Import the new component
import { Exercise, Filter } from "../services/seshEngine";
import GuidedSession from "./GuidedSession";
import GuidedWarmup from "./GuidedWarmup"; // Import GuidedWarmup component
import { generate, generateWarmups } from "../services/seshEngine"; // Import generateWarmups method
import { ExerciseListScreen } from "./Exercises"; // Import ExerciseListScreen
import { useRef, useState, useEffect } from "react";

  // Selector component (Keep as is)
  const Selector = ({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleOptionClick = (option: string) => {
      onChange(option);
      setIsOpen(false);
    };

    return (
      <div>
        {!isOpen ? (
          <div className="bg-[#3a3330] rounded-lg p-4 flex flex-col" onClick={() => setIsOpen(true)}>
            <span className="text-gray-300 text-sm">{label}</span>
            <span className="text-white text-lg font-medium truncate">{value}</span>
          </div>
        ) : (
          <motion.div
            className="fixed inset-0 bg-[#2a2320] z-10 pt-8 pb-16"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="flex justify-center py-2 sticky top-0 bg-[#2a2320] z-20 mb-4">
              <div className="w-10 h-1 bg-white/30 rounded-full cursor-pointer" onClick={() => setIsOpen(false)} />
            </div>
            <div className="px-4 overflow-y-auto h-full">
              <h2 className="text-lg font-medium mb-3">Select {label}</h2>
              <div className="grid grid-cols-1 gap-4">
                {options.map((option) => (
                  <div
                    key={option}
                    className={`p-4 rounded-lg cursor-pointer ${option === value ? "bg-[#2196f3] text-white" : "bg-[#3a3330] text-gray-300"}`}
                    onClick={() => handleOptionClick(option)}
                  >
                    {option}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    );
  };
  
export default function Page() {
  // PWA Install button logic
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // Optionally, you can show a toast or log
    setDeferredPrompt(null);
    setShowInstall(false);
    console.log(`User response: ${outcome}`);
  };
  const [filters, setFilters] = useState<Filter>({
    protocolName: "Isometric protocol",
    intensityLevel: "Medium",
    duration: 10,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<Exercise[] | null>(null);
  const [warmups, setWarmups] = useState<Exercise[] | null>(null); // State to hold warmups
  const [warmupComplete, setWarmupComplete] = useState(false); // State to track warmup completion
  const [showExerciseList, setShowExerciseList] = useState(false); // State to show exercise list

  const startSession = () => {
    try {
      const generatedWarmups = generateWarmups(filters);
      setWarmups(generatedWarmups);

      const generatedSession = generate(filters);
      setSession(generatedSession);

      console.log("Generated session:", generatedSession);
      console.log("Generated warmups:", generatedWarmups);

      setShowExerciseList(true); // Show exercise list after generating session
    } catch (error) {
      console.error("Error generating session:", error);
    }
  };

  if (showExerciseList && session) {
    return (
      <ExerciseListScreen
        exercises={[...warmups, ...session]}
        onStart={() => setShowExerciseList(false)} // Proceed to GuidedSession
        onBack={() => setShowExerciseList(false)} // Go back to main page
      />
    );
  }

  if (!warmupComplete && warmups) {
    return (
      <GuidedWarmup
        warmups={warmups}
        onSessionComplete={() => setWarmupComplete(true)}
      />
    );
  }

  if (session) {
    return <GuidedSession exercises={session} onSessionComplete={() => setSession(null)} />;
  }
  
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

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
              value={filters.duration}
              onChange={(value) => setFilters({ ...filters, duration: value as Filter["duration"] })}
              min={10}
              max={30} 
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
                  {/* <Selector label="Type" value={type} />
                  <Selector label="Level" value={level} />
                  <Selector label="Voice" value={voice} />
                  <Selector label="Instruction" value={instruction} />
                  <Selector label="Video Model" value={videoModel} /> */}
                  <Selector
                    label="Protocol Name"
                    value={filters.protocolName}
                    options={[
                      "Short Maximal Hangs",
                      "Longer Hangs (Strength-Endurance)",
                      "Classic 7:3 Repeaters",
                      "6:10 Heavy Repeaters",
                      "10:5 Repeaters",
                      "Frequent Low-Intensity Hangs (e.g., Abrahangs)",
                      "Active Recovery Hangs",
                      "Isometric protocol",
                    ]}
                    onChange={(value) => setFilters({ ...filters, protocolName: value as Filter["protocolName"] })}
                  />
                  <Selector
                    label="Intensity Level"
                    value={filters.intensityLevel}
                    options={["Low", "Medium", "High"]}
                    onChange={(value) => setFilters({ ...filters, intensityLevel: value as Filter["intensityLevel"] })}
                  />
                  {/* <Selector label="View Poses" value={viewPoses} /> */}
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-medium mb-3">TIMING</h2>
                <div className="grid grid-cols-2 gap-4">
                  {/* <Selector label="Transition Speed" value={transitionSpeed} />
                  <Selector label="Hold Lengths" value={holdLengths} />
                  <Selector label="Savasana" value={savasana} /> */}
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-medium mb-3">MUSIC</h2>
                <div className="grid grid-cols-2 gap-4">
                  {/* <Selector label="Style" value={musicStyle} /> */}
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
                <Selector
                  label="Protocol Name"
                  value={filters.protocolName}
                  options={[
                    "Short Maximal Hangs",
                    "Longer Hangs (Strength-Endurance)",
                    "Classic 7:3 Repeaters",
                    "6:10 Heavy Repeaters",
                    "10:5 Repeaters",
                    "Frequent Low-Intensity Hangs (e.g., Abrahangs)",
                    "Active Recovery Hangs",
                  ]}
                  onChange={(value) => setFilters({ ...filters, protocolName: value as Filter["protocolName"] })}
                />
                <Selector
                  label="Intensity Level"
                  value={filters.intensityLevel}
                  options={["Low", "Medium", "High"]}
                  onChange={(value) => setFilters({ ...filters, intensityLevel: value as Filter["intensityLevel"] })}
                />
              </div>

              {/* Start button */}
              {showInstall && (
                <button
                  className="w-full bg-[#317EFB] text-white py-3 rounded-full text-base font-medium mb-3 flex items-center justify-center gap-2 shadow"
                  onClick={handleInstallClick}
                  style={{letterSpacing: 1}}
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="inline-block mr-1"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4m-7 7h10"/></svg>
                  Install App
                </button>
              )}
              <button
                className="w-full bg-[#2196f3] text-white py-4 rounded-full text-xl font-medium"
                onClick={startSession}
              >
                START
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}