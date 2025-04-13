import React from 'react';
import logoSrc from '../assets/logo.png'; // Import the logo

interface SplashScreenProps {
  isVisible: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ isVisible }) => {
  // Determine classes based on visibility for fade effect
  const splashClasses = `
    fixed inset-0 z-50  // Position fixed, cover screen, high z-index
    flex flex-col items-center justify-center // Center content
    bg-white // White background
    transition-opacity duration-500 ease-out // Fade transition for opacity
    ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} // Control opacity and interaction
  `;

  return (
    <div className={splashClasses} aria-hidden={!isVisible}>
      {/* Logo */}
      <img src={logoSrc} alt="App Logo" className="w-88 h-88 mb-8" /> {/* Adjust size as needed */}

      {/* Simple CSS Loading Indicator */}
      <div className="flex space-x-2">
        <div className="w-3 h-3 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '-0.3s' }}></div>
        <div className="w-3 h-3 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '-0.15s' }}></div>
        <div className="w-3 h-3 bg-gray-500 rounded-full animate-bounce"></div>
      </div>
    </div>
  );
};

export default SplashScreen;