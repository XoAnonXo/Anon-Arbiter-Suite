import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import './OrbitCarousel.css';

// Logo SVG Component
const AnonLogo = () => (
  <svg width="100%" height="100%" viewBox="0 0 49 49" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M34.6509 36.0159C36.8188 35.9919 38.5436 34.1953 38.5436 32.0274V13.6299C38.5436 13.2826 38.2561 12.9951 37.9088 12.9951H36.4116C36.0642 12.9951 35.7768 13.2826 35.7768 13.6299V32.0513C35.7768 32.6861 35.2498 33.2371 34.615 33.2251C33.9921 33.2132 33.4891 32.6981 33.4891 32.0753V27.0447C33.4891 25.1523 33.1178 23.3078 32.3871 21.571C31.6805 19.8942 30.6624 18.397 29.3808 17.1034C28.0992 15.8098 26.59 14.8037 24.9132 14.097C23.1764 13.3664 21.3319 12.9951 19.4394 12.9951H11.0791C10.7318 12.9951 10.4443 13.2826 10.4443 13.6299V15.1391C10.4443 15.4864 10.7318 15.7739 11.0791 15.7739H19.4155C22.4218 15.7739 25.2605 16.9477 27.3805 19.0797C29.5125 21.2117 30.6863 24.0384 30.6863 27.0447V32.0873C30.6863 34.2552 32.471 36.0399 34.6509 36.0159Z" fill="currentColor"/>
    <path d="M19.4155 18.0732C14.4688 18.0732 10.4443 22.0977 10.4443 27.0444C10.4443 31.9911 14.4688 36.0156 19.4155 36.0156C24.3622 36.0156 28.3866 31.9911 28.3866 27.0444C28.3866 22.0977 24.3742 18.0732 19.4155 18.0732ZM19.4155 33.2727C15.9779 33.2727 13.1872 30.4819 13.1872 27.0444C13.1872 23.6069 15.9779 20.8161 19.4155 20.8161C22.853 20.8161 25.6438 23.6069 25.6438 27.0444C25.6438 30.4819 22.853 33.2727 19.4155 33.2727Z" fill="currentColor"/>
  </svg>
);

// Dispute items to orbit
const disputes = [
  { id: 1, title: "Real Madrid vs Barcelona" },
  { id: 2, title: "Bitcoin > $100k" },
  { id: 3, title: "ETH Merge Success" },
  { id: 4, title: "F1 Monaco Grand Prix" },
  { id: 5, title: "Champions League Final" },
  { id: 6, title: "Super Bowl Winner" },
  { id: 7, title: "World Cup 2026" },
  { id: 8, title: "Apple Stock Split" },
];

// Custom hook for mobile detection
const useIsMobile = (breakpoint: number = 768): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkScreenSize = (): void => setIsMobile(window.innerWidth < breakpoint);
    
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, [breakpoint]);
  
  return isMobile;
};

interface OrbitCarouselProps {
  onVoteClick?: () => void;
}

export function OrbitCarousel({ onVoteClick }: OrbitCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const isMobile = useIsMobile();
  const containerRadius = isMobile ? 130 : 180;
  const profileSize = isMobile ? 50 : 60;
  const containerSize = containerRadius * 2 + 100;

  // Calculate rotation for each profile
  const getRotation = useCallback(
    (index: number): number => (index - activeIndex) * (360 / disputes.length),
    [activeIndex]
  );

  // Navigation
  const next = () => setActiveIndex((i) => (i + 1) % disputes.length);
  const prev = () => setActiveIndex((i) => (i - 1 + disputes.length) % disputes.length);

  const handleProfileClick = useCallback((index: number) => {
    if (index === activeIndex) return;
    setActiveIndex(index);
  }, [activeIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft') prev();
      else if (event.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-rotate
  useEffect(() => {
    const interval = setInterval(next, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="orbit-carousel">
      <div
        className="orbit-container"
        style={{ width: containerSize, height: containerSize }}
      >
        {/* Orbit circle */}
        <div
          className="orbit-ring"
          style={{
            width: containerRadius * 2,
            height: containerRadius * 2,
          }}
        />

        {/* Center Card - Dispute Info */}
        <AnimatePresence mode="wait">
          <motion.div
            key={disputes[activeIndex].id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="orbit-center-card"
          >
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="orbit-card-content"
            >
              <h2 className="orbit-card-title">{disputes[activeIndex].title}</h2>
              <p className="orbit-card-type">AMM Market</p>
              <p className="orbit-card-status">Awaits Resolution</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="orbit-card-actions"
            >
              <button onClick={prev} className="orbit-nav-btn">
                <ChevronLeft size={16} />
              </button>
              <button className="orbit-vote-btn" onClick={onVoteClick}>
                Vote
              </button>
              <button onClick={next} className="orbit-nav-btn">
                <ChevronRight size={16} />
              </button>
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Orbiting Logos */}
        {disputes.map((d, i) => {
          const rotation = getRotation(i);
          return (
            <motion.div
              key={d.id}
              animate={{
                transform: `rotate(${rotation}deg) translateY(-${containerRadius}px)`,
              }}
              transition={{
                duration: 0.8,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className="orbit-item"
              style={{
                width: profileSize,
                height: profileSize,
                top: `calc(50% - ${profileSize / 2}px)`,
                left: `calc(50% - ${profileSize / 2}px)`,
              }}
            >
              {/* Counter-rotation to keep logo upright */}
              <motion.div
                animate={{ rotate: -rotation }}
                transition={{
                  duration: 0.8,
                  ease: [0.34, 1.56, 0.64, 1],
                }}
                className="orbit-item-inner"
              >
                <motion.div
                  onClick={() => handleProfileClick(i)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`orbit-logo ${i === activeIndex ? 'active' : ''}`}
                >
                  <AnonLogo />
                </motion.div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}


