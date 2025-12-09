import { useState, useRef, useCallback, Suspense } from 'react';
import { Scale, Globe, Coins, Ticket } from 'lucide-react';
import { AsciiScene } from './AsciiScene';
import './LoginPage.css';

// Feature slides data
const features = [
  {
    icon: Scale,
    title: 'Community Governance',
    description: 'Vote on market disputes and help determine the correct outcomes. Your voice shapes the ecosystem.',
  },
  {
    icon: Globe,
    title: 'Cross-Chain Voting',
    description: 'Cast your votes from Sonic, Base, or any supported chain. Seamless multi-chain participation.',
  },
  {
    icon: Coins,
    title: 'Earn Rewards',
    description: 'Get rewarded for participating in governance. 80% of dispute fees go directly to voters.',
  },
  {
    icon: Ticket,
    title: 'NFT Voting Power',
    description: 'Stake your tokens and wrap NFTs to gain voting power. The more you stake, the more you influence.',
  },
];

// Logo SVG Component
const Logo = () => (
  <svg width="49" height="49" viewBox="0 0 49 49" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M34.6509 36.0159C36.8188 35.9919 38.5436 34.1953 38.5436 32.0274V13.6299C38.5436 13.2826 38.2561 12.9951 37.9088 12.9951H36.4116C36.0642 12.9951 35.7768 13.2826 35.7768 13.6299V32.0513C35.7768 32.6861 35.2498 33.2371 34.615 33.2251C33.9921 33.2132 33.4891 32.6981 33.4891 32.0753V27.0447C33.4891 25.1523 33.1178 23.3078 32.3871 21.571C31.6805 19.8942 30.6624 18.397 29.3808 17.1034C28.0992 15.8098 26.59 14.8037 24.9132 14.097C23.1764 13.3664 21.3319 12.9951 19.4394 12.9951H11.0791C10.7318 12.9951 10.4443 13.2826 10.4443 13.6299V15.1391C10.4443 15.4864 10.7318 15.7739 11.0791 15.7739H19.4155C22.4218 15.7739 25.2605 16.9477 27.3805 19.0797C29.5125 21.2117 30.6863 24.0384 30.6863 27.0447V32.0873C30.6863 34.2552 32.471 36.0399 34.6509 36.0159Z" fill="currentColor"/>
    <path d="M19.4155 18.0732C14.4688 18.0732 10.4443 22.0977 10.4443 27.0444C10.4443 31.9911 14.4688 36.0156 19.4155 36.0156C24.3622 36.0156 28.3866 31.9911 28.3866 27.0444C28.3866 22.0977 24.3742 18.0732 19.4155 18.0732ZM19.4155 33.2727C15.9779 33.2727 13.1872 30.4819 13.1872 27.0444C13.1872 23.6069 15.9779 20.8161 19.4155 20.8161C22.853 20.8161 25.6438 23.6069 25.6438 27.0444C25.6438 30.4819 22.853 33.2727 19.4155 33.2727Z" fill="currentColor"/>
  </svg>
);

// Globe icon for language selector
const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
    <ellipse cx="7" cy="7" rx="3" ry="6" stroke="currentColor" strokeWidth="1.2"/>
    <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);

// Telegram icon
const TelegramIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="7" fill="url(#telegram-gradient)"/>
    <path d="M22.9866 10.2088C23.1112 9.40332 22.3454 8.76755 21.6292 9.082L7.36482 15.3448C6.85123 15.5703 6.8888 16.3483 7.42147 16.5179L10.3631 17.4547C10.9246 17.6335 11.5325 17.541 12.0228 17.2023L18.655 12.6203C18.855 12.4821 19.073 12.7665 18.9021 12.9426L14.1281 17.8646C13.665 18.3421 13.7569 19.1512 14.314 19.5005L19.659 22.9356C20.2585 23.3127 21.0297 22.9767 21.1418 22.2642L22.9866 10.2088Z" fill="white"/>
    <defs>
      <linearGradient id="telegram-gradient" x1="16" y1="0" x2="16" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2AABEE"/>
        <stop offset="1" stopColor="#229ED9"/>
      </linearGradient>
    </defs>
  </svg>
);

// PassKey icon
const PassKeyIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="7" fill="#EBAD1C"/>
    <path d="M16 8C13.2386 8 11 10.2386 11 13C11 14.5217 11.6839 15.8826 12.7574 16.8027L10.2929 19.2671C10.1054 19.4547 10 19.7091 10 19.9743V22.5C10 23.0523 10.4477 23.5 11 23.5H13.5C14.0523 23.5 14.5 23.0523 14.5 22.5V21.5H15.5C16.0523 21.5 16.5 21.0523 16.5 20.5V19.5H17.5C17.7652 19.5 18.0196 19.3946 18.2071 19.2071L19.1973 18.2426C19.7252 18.4074 20.2889 18.5 20.875 18.5C23.4283 18.5 25.5 16.4283 25.5 13.875C25.5 11.3217 23.4283 9.25 20.875 9.25C20.5272 9.25 20.1883 9.28635 19.8616 9.35547C19.0156 8.51841 17.8649 8 16.5869 8H16Z" fill="#151515"/>
    <circle cx="21" cy="13" r="1.5" fill="#EBAD1C"/>
  </svg>
);

// Wallet icon
const WalletIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 10C6 8.89543 6.89543 8 8 8H24C25.1046 8 26 8.89543 26 10V22C26 23.1046 25.1046 24 24 24H8C6.89543 24 6 23.1046 6 22V10Z" stroke="white" strokeWidth="1.5"/>
    <path d="M6 12H26" stroke="white" strokeWidth="1.5"/>
    <circle cx="22" cy="18" r="2" fill="white"/>
  </svg>
);

// Sparkle stars for Web3Wallet
const SparkleStars = () => (
  <svg width="46" height="36" viewBox="0 0 46 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 3L8 6L11 7L8 8L7 11L6 8L3 7L6 6L7 3Z" fill="white"/>
    <path d="M3 13L3.7 15.3L6 16L3.7 16.7L3 19L2.3 16.7L0 16L2.3 15.3L3 13Z" fill="white" opacity="0.7"/>
    <path d="M11 0L11.5 2L13.5 2.5L11.5 3L11 5L10.5 3L8.5 2.5L10.5 2L11 0Z" fill="white" opacity="0.5"/>
    <g transform="translate(14, 4)">
      <path d="M6 10C6 8.89543 6.89543 8 8 8H24C25.1046 8 26 8.89543 26 10V22C26 23.1046 25.1046 24 24 24H8C6.89543 24 6 23.1046 6 22V10Z" stroke="white" strokeWidth="1.5"/>
      <path d="M6 12H26" stroke="white" strokeWidth="1.5"/>
      <circle cx="22" cy="18" r="2" fill="white"/>
    </g>
  </svg>
);

interface LoginPageProps {
  onConnect: () => void;
  connecting: boolean;
}

export function LoginPage({ onConnect, connecting }: LoginPageProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(Math.max(0, Math.min(index, features.length - 1)));
    setTranslateX(0);
  }, []);

  const handleDragStart = (clientX: number) => {
    setIsDragging(true);
    setStartX(clientX);
  };

  const handleDragMove = (clientX: number) => {
    if (!isDragging) return;
    const diff = clientX - startX;
    setTranslateX(diff);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const threshold = 50;
    if (translateX > threshold && currentSlide > 0) {
      goToSlide(currentSlide - 1);
    } else if (translateX < -threshold && currentSlide < features.length - 1) {
      goToSlide(currentSlide + 1);
    } else {
      setTranslateX(0);
    }
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => handleDragStart(e.clientX);
  const handleMouseMove = (e: React.MouseEvent) => handleDragMove(e.clientX);
  const handleMouseUp = () => handleDragEnd();
  const handleMouseLeave = () => isDragging && handleDragEnd();

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientX);
  const handleTouchEnd = () => handleDragEnd();

  return (
    <div className="login-page">
      {/* Header */}
      <header className="login-header">
        <div className="login-logo">
          <Logo />
        </div>
        <div className="language-selector">
          <GlobeIcon />
          <span>EN</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="login-content">
        {/* Left Side - Login Options */}
        <div className="login-left">
          <div className="login-form-container">
            <div className="login-welcome">
              <h1>Welcome!</h1>
              <p>Verify yourself to log in into Anon</p>
            </div>

            <div className="login-options">
              <button className="login-option-btn" disabled>
                <TelegramIcon />
                <span>Telegram</span>
              </button>

              <button className="login-option-btn" disabled>
                <PassKeyIcon />
                <span>PassKey</span>
              </button>

              <button className="login-option-btn" disabled>
                <SparkleStars />
                <span>Web3Wallet</span>
              </button>
            </div>

            <div className="login-divider">
              <div className="divider-line"></div>
              <span className="divider-text">OR</span>
              <div className="divider-line"></div>
            </div>

            <button 
              className="connect-wallet-btn" 
              onClick={onConnect}
              disabled={connecting}
            >
              <WalletIcon />
              <span>{connecting ? 'Connecting...' : 'Connect Wallet'}</span>
            </button>

            <p className="login-notice">
              Create a new wallet for an optimal experience. Connecting an existing wallet 
              will require approval of individual transactions.
            </p>
          </div>
        </div>

        {/* Right Side - Promo Card with ASCII Effect */}
        <div className="login-right">
          <div className="promo-card">
            {/* ASCII 3D Background */}
            <div className="ascii-background">
              <Suspense fallback={<div className="ascii-fallback" />}>
                <AsciiScene />
              </Suspense>
            </div>

            {/* Swipable content */}
            <div 
              className="promo-slider"
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div 
                className="promo-slides"
                style={{
                  transform: `translateX(calc(-${currentSlide * 100}% + ${translateX}px))`,
                  transition: isDragging ? 'none' : 'transform 0.3s ease-out',
                }}
              >
                {features.map((feature, index) => {
                  const IconComponent = feature.icon;
                  return (
                    <div key={index} className="promo-slide">
                      <div className="feature-icon">
                        <IconComponent size={64} strokeWidth={1.5} />
                      </div>
                      <h2>{feature.title}</h2>
                      <p>{feature.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Navigation dots */}
            <div className="promo-dots">
              {features.map((_, index) => (
                <button
                  key={index}
                  className={`dot ${currentSlide === index ? 'active' : ''}`}
                  onClick={() => goToSlide(index)}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}











