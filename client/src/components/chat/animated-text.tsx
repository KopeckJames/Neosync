import { useState, useEffect, useRef } from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedTextProps {
  text: string;
  className?: string;
  speed?: "slow" | "normal" | "fast";
  animationType?: "typewriter" | "fade" | "scale" | "wave" | "none";
  onComplete?: () => void;
  children?: React.ReactNode;
}

export function AnimatedText({
  text,
  className,
  speed = "normal",
  animationType = "typewriter",
  onComplete,
  children
}: AnimatedTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isAnimating, setIsAnimating] = useState(true);
  const charactersRef = useRef<HTMLSpanElement[]>([]);
  
  // Configure animation speeds
  const speedMap = {
    slow: 50,
    normal: 30, 
    fast: 15
  };
  
  // Typewriter effect
  useEffect(() => {
    if (animationType !== "typewriter" || !text) return;
    
    let currentIndex = 0;
    setDisplayedText("");
    
    const typingInterval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setIsAnimating(false);
        if (onComplete) onComplete();
      }
    }, speedMap[speed]);
    
    return () => clearInterval(typingInterval);
  }, [text, speed, animationType, onComplete]);
  
  // Wave animation (character-by-character)
  const waveVariants = {
    hidden: { y: 0 },
    visible: (i: number) => ({
      y: [0, -5, 0],
      transition: {
        delay: i * 0.05,
        duration: 0.5,
        repeat: 0,
        ease: "easeInOut"
      }
    })
  };

  // Fade animation
  const fadeVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: "easeOut"
      }
    }
  };
  
  // Scale animation 
  const scaleVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: "backOut"
      } 
    }
  };
  
  if (animationType === "typewriter") {
    return (
      <div className={cn("whitespace-pre-wrap break-words", className)}>
        {displayedText}
        {isAnimating && (
          <span className="inline-block w-1 h-4 ml-0.5 bg-primary animate-pulse" />
        )}
        {children}
      </div>
    );
  }
  
  if (animationType === "wave") {
    return (
      <div className={cn("whitespace-pre-wrap break-words flex flex-wrap", className)}>
        {text.split("").map((char, i) => (
          <motion.span
            key={`${char}-${i}`}
            ref={el => {
              if (el) charactersRef.current[i] = el;
            }}
            custom={i}
            variants={waveVariants}
            initial="hidden"
            animate="visible"
            className="inline-block"
            onAnimationComplete={i === text.length - 1 ? () => {
              setIsAnimating(false);
              if (onComplete) onComplete();
            } : undefined}
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
        {children}
      </div>
    );
  }
  
  if (animationType === "fade") {
    return (
      <motion.div
        className={cn("whitespace-pre-wrap break-words", className)}
        variants={fadeVariants}
        initial="hidden"
        animate="visible"
        onAnimationComplete={() => {
          setIsAnimating(false);
          if (onComplete) onComplete();
        }}
      >
        {text}
        {children}
      </motion.div>
    );
  }
  
  if (animationType === "scale") {
    return (
      <motion.div
        className={cn("whitespace-pre-wrap break-words", className)}
        variants={scaleVariants}
        initial="hidden"
        animate="visible"
        onAnimationComplete={() => {
          setIsAnimating(false);
          if (onComplete) onComplete();
        }}
      >
        {text}
        {children}
      </motion.div>
    );
  }
  
  // Default or "none" animation type
  return (
    <div className={cn("whitespace-pre-wrap break-words", className)}>
      {text}
      {children}
    </div>
  );
}

export function TextCommandTag({
  command,
  variant = "default"
}: {
  command: string;
  variant?: "default" | "highlight" | "accent"
}) {
  const variantClassMap = {
    default: "bg-secondary text-secondary-foreground",
    highlight: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent"
  };
  
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono",
      variantClassMap[variant]
    )}>
      {command}
    </span>
  );
}

export function TextEffects({
  effectType = "highlight",
  children
}: {
  effectType?: "highlight" | "gradient" | "glow" | "blur";
  children: React.ReactNode;
}) {
  const effectClassMap = {
    highlight: "bg-primary/10 text-primary px-1 py-0.5 rounded",
    gradient: "gradient-text font-semibold",
    glow: "text-primary drop-shadow-[0_0_3px_rgba(var(--primary-rgb),0.7)]",
    blur: "blur-[0.5px] hover:blur-none transition-all duration-300"
  };
  
  return (
    <span className={cn(effectClassMap[effectType])}>
      {children}
    </span>
  );
}

// Revealing text that gradually appears as user scrolls down
export function RevealText({ children, className }: { children: React.ReactNode; className?: string }) {
  const controls = useAnimation();
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          controls.start("visible");
        }
      },
      { threshold: 0.1 }
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [controls]);
  
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={controls}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.6,
            ease: "easeOut"
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
}