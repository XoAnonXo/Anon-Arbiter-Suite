import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scale, 
  Coins, 
  Vote, 
  Gift, 
  AlertTriangle, 
  Info,
  ChevronDown,
  ChevronRight,
  Check,
  Sparkles,
  Shield,
  Zap,
  Clock
} from 'lucide-react';
import './HowItWorksVariations.css';

// Data shared across all variations
const steps = [
  {
    number: 1,
    icon: Scale,
    title: "What is Arbiter Suite?",
    description: "When a prediction market result looks wrong, anyone can challenge it. Token holders then vote to decide the correct outcome.",
    highlight: "community jury",
    items: null,
    note: null,
    type: 'default'
  },
  {
    number: 2,
    icon: Coins,
    title: "Get Voting Power",
    description: "To vote on disputes, you need Voting NFTs. Here's how:",
    highlight: null,
    items: [
      "Stake your ANON tokens to receive a Staking NFT",
      'Go to "My NFTs" tab',
      'Click "Wrap" to convert your Staking NFT into a Voting NFT',
      "Your voting power = amount of tokens staked"
    ],
    note: null,
    type: 'default'
  },
  {
    number: 3,
    icon: Vote,
    title: "Vote on Disputes",
    description: "When a dispute is active, you can cast your vote:",
    highlight: null,
    items: [
      "Yes — The market result was correct",
      "No — The market result was wrong",
      "Unknown — Cannot determine the outcome"
    ],
    note: "Select your NFTs and submit your vote. The option with the most voting power wins.",
    type: 'default'
  },
  {
    number: 4,
    icon: Gift,
    title: "Earn Rewards",
    description: "All voters get paid! When a dispute resolves:",
    highlight: null,
    items: [
      "80% of the dispute deposit goes to voters",
      "Rewards are proportional to your voting power",
      "You earn regardless of which side you voted for"
    ],
    note: "The more you participate, the more you earn.",
    type: 'default'
  },
  {
    number: 5,
    icon: AlertTriangle,
    title: "Penalty for Wrong Votes",
    description: "If you vote against the consensus (the losing side), your NFT may receive a penalty:",
    highlight: null,
    items: [
      "Your NFT will be blocked from unwrapping",
      "You cannot transfer or withdraw the NFT",
      "You must pay the penalty fee to unblock it",
      "Once paid, your NFT is free to use again"
    ],
    note: "💡 Vote carefully! Consider the evidence before choosing a side.",
    type: 'warning'
  },
  {
    number: 6,
    icon: Info,
    title: "Important Rules",
    description: null,
    highlight: null,
    items: [
      "60-hour cooldown after wrapping before you can vote",
      "NFTs are locked for 60 hours after voting",
      "One vote per NFT per dispute",
      "Voting period is limited — vote before time runs out"
    ],
    note: null,
    type: 'highlight'
  }
];

// ============================================
// VARIATION 1: Bento Grid Layout
// ============================================
export const Variation1Bento = () => {
  return (
    <div className="v1-bento-container">
      <div className="v1-bento-grid">
        {/* Large featured card */}
        <motion.div 
          className="v1-bento-card v1-featured"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="v1-card-glow" />
          <Scale className="v1-icon-large" />
          <h3>{steps[0].title}</h3>
          <p>{steps[0].description}</p>
          <div className="v1-badge">
            <Sparkles size={14} />
            <span>Community Jury</span>
          </div>
        </motion.div>

        {/* Medium cards row */}
        <motion.div 
          className="v1-bento-card v1-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="v1-card-header">
            <Coins className="v1-icon" />
            <span className="v1-step">Step 2</span>
          </div>
          <h4>{steps[1].title}</h4>
          <ul className="v1-list">
            {steps[1].items?.slice(0, 2).map((item, i) => (
              <li key={i}><Check size={14} />{item}</li>
            ))}
          </ul>
        </motion.div>

        <motion.div 
          className="v1-bento-card v1-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="v1-card-header">
            <Vote className="v1-icon" />
            <span className="v1-step">Step 3</span>
          </div>
          <h4>{steps[2].title}</h4>
          <div className="v1-vote-options">
            <span className="v1-vote yes">Yes</span>
            <span className="v1-vote no">No</span>
            <span className="v1-vote unknown">Unknown</span>
          </div>
        </motion.div>

        {/* Rewards card */}
        <motion.div 
          className="v1-bento-card v1-rewards"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Gift className="v1-icon-reward" />
          <div className="v1-reward-content">
            <h4>Earn Rewards</h4>
            <p className="v1-reward-highlight">80%</p>
            <span>of deposits go to voters</span>
          </div>
        </motion.div>

        {/* Warning card */}
        <motion.div 
          className="v1-bento-card v1-warning"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <AlertTriangle className="v1-icon-warning" />
          <h4>Penalties Apply</h4>
          <p>Wrong votes may block your NFT</p>
        </motion.div>

        {/* Rules card */}
        <motion.div 
          className="v1-bento-card v1-rules"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="v1-rules-grid">
            <div className="v1-rule">
              <Clock size={20} />
              <span>60h cooldown</span>
            </div>
            <div className="v1-rule">
              <Shield size={20} />
              <span>NFT locked</span>
            </div>
            <div className="v1-rule">
              <Zap size={20} />
              <span>1 vote/NFT</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// ============================================
// VARIATION 2: Vertical Timeline
// ============================================
export const Variation2Timeline = () => {
  return (
    <div className="v2-timeline-container">
      <div className="v2-timeline-line" />
      {steps.map((step, index) => (
        <motion.div 
          key={index}
          className={`v2-timeline-item ${step.type}`}
          initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
        >
          <div className="v2-timeline-dot">
            <step.icon size={20} />
          </div>
          <div className="v2-timeline-content">
            <div className="v2-timeline-header">
              <span className="v2-step-badge">Step {step.number}</span>
              <h4>{step.title}</h4>
            </div>
            {step.description && <p>{step.description}</p>}
            {step.items && (
              <ul className="v2-timeline-list">
                {step.items.map((item, i) => (
                  <li key={i}>
                    <ChevronRight size={14} />
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {step.note && (
              <div className="v2-timeline-note">
                <Info size={14} />
                {step.note}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ============================================
// VARIATION 3: Accordion / Expandable
// ============================================
export const Variation3Accordion = () => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  return (
    <div className="v3-accordion-container">
      {steps.map((step, index) => (
        <motion.div 
          key={index}
          className={`v3-accordion-item ${step.type} ${expandedIndex === index ? 'expanded' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
        >
          <button 
            className="v3-accordion-header"
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
          >
            <div className="v3-header-left">
              <div className="v3-icon-wrapper">
                <step.icon size={20} />
              </div>
              <span className="v3-title">{step.title}</span>
            </div>
            <motion.div
              animate={{ rotate: expandedIndex === index ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={20} />
            </motion.div>
          </button>
          <AnimatePresence>
            {expandedIndex === index && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="v3-accordion-body"
              >
                <div className="v3-body-content">
                  {step.description && <p>{step.description}</p>}
                  {step.items && (
                    <ul className="v3-list">
                      {step.items.map((item, i) => (
                        <li key={i}>
                          <Check size={14} className="v3-check" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                  {step.note && (
                    <div className="v3-note">
                      <Sparkles size={14} />
                      {step.note}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
};

// ============================================
// VARIATION 4: Horizontal Tabs
// ============================================
export const Variation4Tabs = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="v4-tabs-container">
      <div className="v4-tabs-header">
        {steps.map((step, index) => (
          <button
            key={index}
            className={`v4-tab ${activeTab === index ? 'active' : ''} ${step.type}`}
            onClick={() => setActiveTab(index)}
          >
            <step.icon size={18} />
            <span className="v4-tab-number">{step.number}</span>
          </button>
        ))}
        <motion.div 
          className="v4-tab-indicator"
          layoutId="tab-indicator"
          style={{ left: `${activeTab * (100 / steps.length)}%`, width: `${100 / steps.length}%` }}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          className={`v4-tab-content ${steps[activeTab].type}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="v4-content-header">
            {(() => { const Icon = steps[activeTab].icon; return <Icon size={32} />; })()}
            <h3>{steps[activeTab].title}</h3>
          </div>
          {steps[activeTab].description && (
            <p className="v4-description">{steps[activeTab].description}</p>
          )}
          {steps[activeTab].items && (
            <div className="v4-items-grid">
              {steps[activeTab].items.map((item, i) => (
                <motion.div 
                  key={i}
                  className="v4-item"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="v4-item-number">{i + 1}</div>
                  <span>{item}</span>
                </motion.div>
              ))}
            </div>
          )}
          {steps[activeTab].note && (
            <div className="v4-note">
              <Info size={16} />
              {steps[activeTab].note}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ============================================
// VARIATION 5: Icon Cards Grid
// ============================================
export const Variation5IconCards = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Get gradient colors based on step type
  const getGradientColors = (type: string, index: number) => {
    if (type === 'warning') {
      return { primary: '#ef4444', secondary: '#dc2626' };
    }
    if (type === 'highlight') {
      return { primary: '#f59e0b', secondary: '#d97706' };
    }
    // Default colors cycle through purple, blue, teal, green
    const colors = [
      { primary: '#6366f1', secondary: '#4f46e5' },
      { primary: '#3b82f6', secondary: '#2563eb' },
      { primary: '#14b8a6', secondary: '#0d9488' },
      { primary: '#10b981', secondary: '#059669' },
      { primary: '#8b5cf6', secondary: '#7c3aed' },
      { primary: '#6366f1', secondary: '#4f46e5' },
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="v5-cards-container">
      {steps.map((step, index) => {
        const colors = getGradientColors(step.type, index);
        return (
          <motion.div
            key={index}
            className={`v5-card ${step.type} ${hoveredIndex === index ? 'hovered' : ''}`}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}
            whileHover={{ scale: 1.02, y: -4 }}
          >
            {/* Animated distorted background */}
            <div className="v5-distorted-bg">
              <div 
                className="v5-blob v5-blob-1" 
                style={{ 
                  background: `radial-gradient(circle, ${colors.primary}40 0%, transparent 70%)`,
                  animationDelay: `${index * 0.2}s`
                }} 
              />
              <div 
                className="v5-blob v5-blob-2" 
                style={{ 
                  background: `radial-gradient(circle, ${colors.secondary}30 0%, transparent 70%)`,
                  animationDelay: `${index * 0.3}s`
                }} 
              />
              <div 
                className="v5-blob v5-blob-3" 
                style={{ 
                  background: `radial-gradient(circle, ${colors.primary}20 0%, transparent 60%)`,
                  animationDelay: `${index * 0.1}s`
                }} 
              />
            </div>
            <div className="v5-card-noise" />
            <div className="v5-card-overlay" />
            
            <div className="v5-icon-container">
              <div className="v5-icon-ring">
                <step.icon size={24} />
              </div>
              <span className="v5-step-number">{step.number}</span>
            </div>
            <h4>{step.title}</h4>
            {step.description && (
              <p className="v5-description">{step.description}</p>
            )}
            {step.items && (
              <ul className="v5-list">
                {step.items.map((item, i) => (
                  <li key={i}>
                    <Check size={14} className="v5-check-icon" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
            {step.note && (
              <div className="v5-note">
                <Sparkles size={14} />
                <span>{step.note}</span>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

// ============================================
// VARIATION 6: Horizontal Stepper
// ============================================
export const Variation6Stepper = () => {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <div className="v6-stepper-container">
      {/* Progress bar */}
      <div className="v6-progress-track">
        <motion.div 
          className="v6-progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
        {steps.map((step, index) => (
          <button
            key={index}
            className={`v6-step-dot ${index <= currentStep ? 'active' : ''} ${step.type}`}
            onClick={() => setCurrentStep(index)}
            style={{ left: `${(index / (steps.length - 1)) * 100}%` }}
          >
            {index < currentStep ? (
              <Check size={14} />
            ) : (
              <step.icon size={14} />
            )}
          </button>
        ))}
      </div>

      {/* Step labels */}
      <div className="v6-step-labels">
        {steps.map((step, index) => (
          <button
            key={index}
            className={`v6-label ${index === currentStep ? 'active' : ''}`}
            onClick={() => setCurrentStep(index)}
          >
            {step.title.split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          className={`v6-content ${steps[currentStep].type}`}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          <div className="v6-content-inner">
            <div className="v6-content-icon">
              {(() => { const Icon = steps[currentStep].icon; return <Icon size={48} />; })()}
            </div>
            <div className="v6-content-text">
              <h3>{steps[currentStep].title}</h3>
              {steps[currentStep].description && (
                <p>{steps[currentStep].description}</p>
              )}
              {steps[currentStep].items && (
                <ul className="v6-list">
                  {steps[currentStep].items.map((item, i) => (
                    <motion.li 
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <ChevronRight size={16} />
                      {item}
                    </motion.li>
                  ))}
                </ul>
              )}
              {steps[currentStep].note && (
                <div className="v6-note">
                  <Sparkles size={16} />
                  {steps[currentStep].note}
                </div>
              )}
            </div>
          </div>
          <div className="v6-navigation">
            <button 
              className="v6-nav-btn"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              Previous
            </button>
            <span className="v6-step-counter">{currentStep + 1} / {steps.length}</span>
            <button 
              className="v6-nav-btn primary"
              onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
              disabled={currentStep === steps.length - 1}
            >
              Next
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ============================================
// PREVIEW COMPONENT - Shows all variations
// ============================================
interface HowItWorksVariationsProps {
  onVoteClick?: () => void;
}

export const HowItWorksVariations = ({ onVoteClick }: HowItWorksVariationsProps) => {
  const [selectedVariation, setSelectedVariation] = useState(5);

  const variations = [
    { id: 1, name: "Bento Grid", component: Variation1Bento },
    { id: 2, name: "Timeline", component: Variation2Timeline },
    { id: 3, name: "Accordion", component: Variation3Accordion },
    { id: 4, name: "Tabs", component: Variation4Tabs },
    { id: 5, name: "Icon Cards", component: Variation5IconCards },
    { id: 6, name: "Stepper", component: Variation6Stepper },
  ];

  const SelectedComponent = variations.find(v => v.id === selectedVariation)?.component || Variation1Bento;

  return (
    <div className="variations-preview">
      <div className="variations-selector">
        <span className="selector-label">Choose a layout:</span>
        <div className="selector-buttons">
          {variations.map(v => (
            <button
              key={v.id}
              className={`selector-btn ${selectedVariation === v.id ? 'active' : ''}`}
              onClick={() => setSelectedVariation(v.id)}
            >
              {v.id}. {v.name}
            </button>
          ))}
        </div>
      </div>
      
      <div className="variation-content">
        <SelectedComponent />
      </div>

      {onVoteClick && (
        <div className="variations-cta">
          <button className="cta-button" onClick={onVoteClick}>
            Start Voting Now
          </button>
        </div>
      )}
    </div>
  );
};

export default HowItWorksVariations;
