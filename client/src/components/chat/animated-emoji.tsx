import { useEffect, useRef, useState } from "react";
import { motion, useAnimation, useSpring } from "framer-motion";

interface AnimatedEmojiProps {
  emoji: string;
  size?: "sm" | "md" | "lg";
  initialScale?: number;
  onAnimationComplete?: () => void;
  style?: React.CSSProperties;
}

export function AnimatedEmoji({
  emoji,
  size = "md",
  initialScale = 0.1,
  onAnimationComplete,
  style
}: AnimatedEmojiProps) {
  const controls = useAnimation();
  const [hasAnimated, setHasAnimated] = useState(false);
  const initialPosition = useRef({ x: 0, y: 20 });
  
  // Map size to pixel values
  const sizeMap = {
    sm: "1rem",
    md: "1.5rem",
    lg: "2.5rem"
  };
  
  // Physics spring parameters for the bounce effect
  const springConfig = {
    type: "spring",
    stiffness: 300,
    damping: 10,
    mass: 0.8,
    velocity: 5
  };
  
  // Generate a random horizontal position for the entrance
  useEffect(() => {
    initialPosition.current = {
      x: Math.random() * 40 - 20, // Random -20 to 20
      y: 20  // Always start from bottom
    };
    
    // Sequential animations
    const runAnimation = async () => {
      // First, rapidly grow from small size
      await controls.start({
        opacity: 1,
        scale: [initialScale, 1.3, 1],
        x: initialPosition.current.x,
        y: [initialPosition.current.y, -5, 0],
        transition: {
          ...springConfig,
          duration: 0.6
        }
      });
      
      // Then, add a slight bounce/wobble
      await controls.start({
        y: [0, -8, -5, 0],
        scale: [1, 1.2, 0.9, 1],
        rotate: [0, -5, 5, 0],
        transition: {
          duration: 0.7,
          times: [0, 0.3, 0.6, 1],
          ease: "easeInOut"
        }
      });
      
      setHasAnimated(true);
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    };
    
    runAnimation();
  }, [controls, emoji, initialScale, onAnimationComplete]);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: initialScale }}
      animate={controls}
      style={{
        fontSize: sizeMap[size],
        display: "inline-block",
        lineHeight: 1,
        fontWeight: 400,
        ...style
      }}
      className={`emoji-container ${hasAnimated ? "animated" : ""}`}
    >
      {emoji}
    </motion.div>
  );
}

// Component to display multiple emojis entering in a sequence
export function AnimatedEmojiCluster({
  emojis,
  size = "md",
  staggerDelay = 0.08
}: {
  emojis: string[];
  size?: "sm" | "md" | "lg";
  staggerDelay?: number;
}) {
  // Filter duplicates but preserve order
  const uniqueEmojis = Array.from(new Set(emojis));
  
  return (
    <div className="emoji-cluster inline-flex gap-0.5 flex-wrap">
      {uniqueEmojis.map((emoji, index) => (
        <AnimatedEmoji
          key={`${emoji}-${index}`}
          emoji={emoji}
          size={size}
          style={{ animationDelay: `${index * staggerDelay}s` }}
        />
      ))}
    </div>
  );
}

// Component for a floating emoji that rises and fades
export function RisingEmoji({
  emoji,
  size = "md",
  color = "currentColor"
}: {
  emoji: string;
  size?: "sm" | "md" | "lg";
  color?: string;
}) {
  // Map size to pixel values
  const sizeMap = {
    sm: "1rem",
    md: "1.5rem",
    lg: "2.5rem"
  };
  
  const xOffset = useSpring(0, {
    stiffness: 100,
    damping: 10
  });
  
  useEffect(() => {
    // Add a gentle horizontal oscillation
    let interval: NodeJS.Timeout;
    interval = setInterval(() => {
      xOffset.set(Math.random() * 20 - 10);
    }, 700);
    
    return () => clearInterval(interval);
  }, [xOffset]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 0, scale: 0.5 }}
      animate={{ 
        opacity: [0, 1, 0.7, 0], 
        y: [-10, -60], 
        scale: [0.5, 1.5, 1, 0.5] 
      }}
      style={{ 
        fontSize: sizeMap[size],
        color,
        x: xOffset,
        position: "absolute",
        zIndex: 10
      }}
      transition={{ 
        duration: 1.5,
        ease: "easeOut"
      }}
      exit={{ opacity: 0 }}
    >
      {emoji}
    </motion.div>
  );
}