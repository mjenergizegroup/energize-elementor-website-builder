"use client";

// Adapted from beUI's public animated number primitive.
import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export function AnimatedNumber({
  value,
  duration = 0.7,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (reduce) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(fromRef.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (next) => setDisplay(next),
    });
    fromRef.current = value;
    return () => controls.stop();
  }, [duration, reduce, value]);

  return <span className={cn("tabular-nums", className)}>{Math.round(display)}</span>;
}
