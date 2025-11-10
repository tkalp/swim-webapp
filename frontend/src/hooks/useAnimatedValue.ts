import { useState, useEffect, useRef } from 'react';

interface UseAnimatedValueOptions {
  duration?: number;
  easing?: (t: number) => number;
}

// Easing function for smooth animations
const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

export function useAnimatedValue(
  targetValue: number,
  options: UseAnimatedValueOptions = {}
) {
  const { duration = 500, easing = easeOutCubic } = options; // Reduced default duration
  const [currentValue, setCurrentValue] = useState(targetValue); // Start with target value
  const animationRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);
  const startValueRef = useRef<number>(targetValue);

  useEffect(() => {
    // Skip animation if values haven't actually changed significantly
    if (Math.abs(targetValue - currentValue) < 0.01) {
      return;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    startTimeRef.current = performance.now();
    startValueRef.current = currentValue;

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) return;

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      
      const newValue = startValueRef.current + (targetValue - startValueRef.current) * easedProgress;
      setCurrentValue(newValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration, easing]);

  return currentValue;
}

export function useAnimatedValues<T extends Record<string, number>>(
  targetValues: T,
  options: UseAnimatedValueOptions = {}
): T {
  const { duration = 500, easing = easeOutCubic } = options; // Reduced default duration
  const [currentValues, setCurrentValues] = useState<T>(targetValues); // Start with target values
  
  const animationRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);
  const startValuesRef = useRef<T>(targetValues);

  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    startTimeRef.current = performance.now();
    startValuesRef.current = { ...currentValues };

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) return;

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      
      const newValues = Object.keys(targetValues).reduce((acc, key) => {
        const startValue = startValuesRef.current[key as keyof T] as number;
        const targetValue = targetValues[key as keyof T] as number;
        const newValue = startValue + (targetValue - startValue) * easedProgress;
        acc[key as keyof T] = newValue as T[keyof T];
        return acc;
      }, {} as T);

      setCurrentValues(newValues);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValues, duration, easing]);

  return currentValues;
}