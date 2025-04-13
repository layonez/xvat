import React, { useState, useEffect } from 'react';
import './App.css' // Make sure CSS is imported
import Page from './components/page'
import SplashScreen from './components/SplashScreen'; // Import the splash screen

// If using Next.js font (keep commented if not)
// import { Inter } from "next/font/google"
// const inter = Inter({ subsets: ["latin"] })

// If using ThemeProvider (keep commented if not)
// import { ThemeProvider } from "@/components/theme-provider"

// Metadata - Note: In React SPA (like Vite/CRA), this doesn't directly set head tags.
// You'd use react-helmet or similar, or set it in index.html.
// export const metadata = {
//   title: "Yoga Practice App",
//   description: "A mobile-first yoga practice app with customizable settings",
// }

// --- Main App Component ---
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const splashDuration = 2000; // 2 seconds

  useEffect(() => {
    // Timer to hide the splash screen after splashDuration
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, splashDuration);

    // Cleanup the timer if the component unmounts early
    return () => clearTimeout(timer);
  }, []); // Empty dependency array ensures this runs only once on mount

  // Note: The top-level return should ideally be just the App's content,
  // not <html> and <body> tags. These are usually handled in your
  // main entry file (main.tsx/index.tsx) or public/index.html.
  // Assuming this structure is required by your setup, we keep it,
  // otherwise, it's better to remove <html> and <body> from here.

  return (
    // --- If this component *is* the absolute root including HTML/Body ---
    // <html lang="en" suppressHydrationWarning>
    //   <body> {/* Apply font class if needed: className={inter.className} */}
    //     {/* Render SplashScreen on top */}
    //     <SplashScreen isVisible={isLoading} />

    //     {/* Render Page content underneath. It will be revealed when splash fades */}
    //     {/* Optionally delay Page rendering slightly if needed, but usually not required */}
    //     <Page />

    //     {/* ThemeProvider if used */}
    //     {/* <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
    //       <Page />
    //     </ThemeProvider> */}
    //   </body>
    // </html>

    // --- More common React SPA structure (render *inside* body) ---
    <React.Fragment>
      {/* Render SplashScreen on top */}
      <SplashScreen isVisible={isLoading} />

      {/*
        Render Page content underneath.
        It gets revealed as the splash screen fades (opacity goes to 0).
        The pointer-events: none on the faded splash screen makes the Page interactive.
      */}
      <Page />

      {/* Example ThemeProvider wrapping Page */}
      {/* <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <Page />
        </ThemeProvider> */}
    </React.Fragment>
  );
}