import type { Filter } from "../services/seshEngine"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function Page() {
  const [duration, setDuration] = useState(30)
  const [menuOpen, setMenuOpen] = useState(false)
  const [windowHeight, setWindowHeight] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // Get window height on client side
  useEffect(() => {
    setWindowHeight(window.innerHeight)

    // Add event listener for swipe gestures
    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!startY) return

      const currentY = e.touches[0].clientY
      const diff = startY - currentY

      // If swiping up and menu is closed, open it
      if (diff > 50 && !menuOpen) {
        setMenuOpen(true)
        startY = null
      }

      // If swiping down and menu is open, close it
      if (diff < -50 && menuOpen) {
        setMenuOpen(false)
        startY = null
      }
    }

    let startY: number | null = null
    document.addEventListener("touchstart", handleTouchStart)
    document.addEventListener("touchmove", handleTouchMove)

    return () => {
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchmove", handleTouchMove)
    }
  }, [menuOpen])

  // Menu states
  const [type, setType] = useState("Yin")
  const [level, setLevel] = useState("Intermediate 1")
  const [voice, setVoice] = useState("Selama")
  const [instruction, setInstruction] = useState("Full")
  const [videoModel, setVideoModel] = useState("Alexa")
  const [viewPoses, setViewPoses] = useState("0 Liked, 0 Disliked")
  const [transitionSpeed, setTransitionSpeed] = useState("Default")
  const [holdLengths, setHoldLengths] = useState("Auto")
  const [savasana, setSavasana] = useState("None")
  const [musicStyle, setMusicStyle] = useState("Alt Beats")
  const [protocolName, setProtocolName] = useState<Filter["protocolName"]>("Short Maximal Hangs")
  const [intensityLevel, setIntensityLevel] = useState<Filter["intensityLevel"]>("Low")

  // Navigation bar height
  const navBarHeight = 60

  // Toggle menu open/closed
  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
  }

  // Update duration based on drag position on the wheel
  const handleWheelDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const x = e.clientX - centerX
    const y = e.clientY - centerY

    // Calculate angle in radians
    const angle = Math.atan2(y, x)

    // Convert to degrees and adjust to start from top
    let degrees = (angle * 180) / Math.PI + 90
    if (degrees < 0) degrees += 360

    // Map 0-360 degrees to 5-15 minutes with steps of 5
    let newDuration
    if (degrees < 120) {
      newDuration = 5
    } else if (degrees < 240) {
      newDuration = 10
    } else {
      newDuration = 15
    }

    setDuration(newDuration)
  }

  // Selector component
  const Selector = ({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) => (
    <div className="bg-[#3a3330] rounded-lg p-4 flex flex-col" onClick={onClick}>
      <span className="text-gray-300 text-sm">{label}</span>
      <span className="text-white text-lg font-medium truncate">{value}</span>
    </div>
  )

  return (
    <div className="relative h-screen w-full bg-[#1a1512] text-white overflow-hidden">
      {/* Welcome text */}
      <div className="pt-16 text-center">
        <h1 className="text-2xl font-medium">Welcome back!</h1>
      </div>

      {/* Duration wheel - only visible when menu is closed */}
      {!menuOpen && (
        <div className="flex justify-center items-center mt-16">
          <div
            className="relative w-64 h-64 rounded-full border-4 border-[#1e3a5f] flex items-center justify-center cursor-pointer"
            onMouseMove={handleWheelDrag}
          >
            {/* Progress arc */}
            <svg className="absolute inset-0" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="#2980b9"
                strokeWidth="4"
                strokeDasharray={`${(duration / 15) * 300} 300`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>

            {/* Draggable handle */}
            <div
              className="absolute w-6 h-6 bg-[#2196f3] rounded-full"
              style={{
                transform: `rotate(${(duration / 15) * 360}deg) translateY(-32px)`,
                top: "50%",
                left: "50%",
                marginLeft: "-12px",
                marginTop: "-12px",
                transformOrigin: "center",
              }}
            />

            {/* Duration text */}
            <div className="text-center">
              <div className="text-7xl font-light">{duration}</div>
              <div className="text-xl">minutes</div>
            </div>
          </div>
        </div>
      )}

      {/* Menu - two states: collapsed and expanded */}
      <AnimatePresence initial={false}>
        {menuOpen ? (
          // Expanded menu - full screen
          <motion.div
            key="expanded-menu"
            ref={menuRef}
            className="fixed inset-0 bg-[#2a2320] z-10 pt-8 pb-16"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{ paddingBottom: navBarHeight }}
          >
            {/* Drag handle */}
            <div className="flex justify-center py-2 sticky top-0 bg-[#2a2320] z-20 mb-4">
              <div className="w-10 h-1 bg-white/30 rounded-full cursor-pointer" onClick={toggleMenu} />
            </div>

            {/* Expanded menu content - scrollable */}
            <div className="px-4 overflow-y-auto h-full">
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
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{ paddingBottom: navBarHeight }}
          >
            {/* Drag handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-white/30 rounded-full cursor-pointer" onClick={toggleMenu} />
            </div>

            {/* Collapsed menu content */}
            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Selector label="Protocol Name" value={protocolName} />
                <Selector label="Intensity Level" value={intensityLevel} />
              </div>

              {/* Start button */}
              <button className="w-full bg-[#2196f3] text-white py-4 rounded-full text-xl font-medium mb-4">
                START
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation bar - fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1a1512] flex justify-around py-4 border-t border-gray-800 z-20">
        <button className="p-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </button>
        <button className="p-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <button className="p-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </button>
        <button className="p-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>
        <button className="p-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
