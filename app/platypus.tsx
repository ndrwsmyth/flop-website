"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type ThrowSample = {
  x: number;
  y: number;
  time: number;
};

type Motion = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  squash: number;
  boostedUntil: number;
  pointerId: number | null;
  isDragging: boolean;
  didDrag: boolean;
  grabOffsetX: number;
  grabOffsetY: number;
  samples: ThrowSample[];
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const AIR_DRAG = 0.88;
const WALL_RESTITUTION = 0.86;
const WALL_FRICTION = 0.97;
const MIN_IDLE_SPEED = 86;
const MAX_THROW_SPEED = 920;
const SPRITE_PIXELS = [
  "................",
  "................",
  "................",
  "......dddddd....",
  ".....tttttdd....",
  "....ttttttbbo...",
  "...ttttttebbbo..",
  "..aattttttbbbo..",
  ".aaatttttttb....",
  "..aattttttt.....",
  "...tttddttt.....",
  "....tffddff.....",
  ".....ffddff.....",
  "....ssttt.......",
  "...ss...........",
  "................",
] as const;

const PIXEL_CLASS_NAMES: Record<string, string> = {
  a: "pixel-tail",
  b: "pixel-bill",
  d: "pixel-teal-dark",
  e: "pixel-eye",
  f: "pixel-foot",
  o: "pixel-bill-dark",
  s: "pixel-tail-dark",
  t: "pixel-teal",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getStageSize() {
  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  };
}

function getSpriteSize(sprite: HTMLElement) {
  return sprite.offsetWidth || 144;
}

export function FloppingPlatypus() {
  const [isPaused, setIsPaused] = useState(false);
  const spriteRef = useRef<HTMLButtonElement>(null);
  const isPausedRef = useRef(false);
  const motionRef = useRef<Motion>({
    x: 28,
    y: 180,
    vx: 132,
    vy: 108,
    angle: -8,
    spin: 80,
    squash: 1,
    boostedUntil: 0,
    pointerId: null,
    isDragging: false,
    didDrag: false,
    grabOffsetX: 0,
    grabOffsetY: 0,
    samples: [],
  });

  useEffect(() => {
    const sprite = spriteRef.current;
    if (!sprite) {
      return;
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    let animationFrame = 0;
    let previousTime = performance.now();

    const placeSprite = () => {
      const motion = motionRef.current;
      sprite.style.transform = `translate3d(${motion.x}px, ${motion.y}px, 0) rotate(${motion.angle}deg) scaleY(${motion.squash})`;
    };

    const keepInBounds = () => {
      const motion = motionRef.current;
      const stage = getStageSize();
      const spriteSize = getSpriteSize(sprite);
      const maxX = Math.max(0, stage.width - spriteSize);
      const maxY = Math.max(0, stage.height - spriteSize);
      motion.x = clamp(motion.x, 0, maxX);
      motion.y = clamp(motion.y, 0, maxY);
      placeSprite();
    };

    const setInitialPosition = () => {
      const stage = getStageSize();
      const spriteSize = getSpriteSize(sprite);
      const maxX = Math.max(0, stage.width - spriteSize);
      const maxY = Math.max(0, stage.height - spriteSize);
      motionRef.current.x = clamp(stage.width * 0.64, 16, maxX);
      motionRef.current.y = clamp(stage.height * 0.34, 112, maxY);
      keepInBounds();
    };

    const tick = (time: number) => {
      const motion = motionRef.current;
      const delta = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;

      if (!mediaQuery.matches && (!isPausedRef.current || motion.isDragging)) {
        if (!motion.isDragging) {
          const speedBoost = time < motion.boostedUntil ? 1.34 : 1;
          const drag = Math.pow(AIR_DRAG, delta);
          motion.vx *= drag;
          motion.vy *= drag;
          motion.x += motion.vx * delta * speedBoost;
          motion.y += motion.vy * delta * speedBoost;
          motion.angle += motion.spin * delta * speedBoost;

          const stage = getStageSize();
          const spriteSize = getSpriteSize(sprite);
          const maxX = Math.max(0, stage.width - spriteSize);
          const maxY = Math.max(0, stage.height - spriteSize);
          let bounced = false;

          if (motion.x <= 0 || motion.x >= maxX) {
            motion.x = clamp(motion.x, 0, maxX);
            motion.vx = -motion.vx * WALL_RESTITUTION;
            motion.vy *= WALL_FRICTION;
            motion.spin = -motion.spin * WALL_FRICTION;
            bounced = true;
          }

          if (motion.y <= 0 || motion.y >= maxY) {
            motion.y = clamp(motion.y, 0, maxY);
            motion.vy = -motion.vy * WALL_RESTITUTION;
            motion.vx *= WALL_FRICTION;
            motion.spin = -motion.spin * WALL_FRICTION;
            bounced = true;
          }

          const speed = Math.hypot(motion.vx, motion.vy);
          if (speed < MIN_IDLE_SPEED) {
            const nudge = MIN_IDLE_SPEED / Math.max(speed, 1);
            motion.vx *= nudge;
            motion.vy *= nudge;
          }

          const flop = Math.sin(time / 112) * 0.08;
          motion.squash = bounced ? 0.78 : 1 + flop;
        } else {
          motion.angle += motion.spin * delta * 0.28;
          motion.squash = 0.9 + Math.sin(time / 90) * 0.06;
        }

        placeSprite();
      }

      animationFrame = requestAnimationFrame(tick);
    };

    setInitialPosition();
    animationFrame = requestAnimationFrame(tick);

    window.addEventListener("resize", keepInBounds);
    window.visualViewport?.addEventListener("resize", keepInBounds);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", keepInBounds);
      window.visualViewport?.removeEventListener("resize", keepInBounds);
    };
  }, []);

  const pushBoopAnimation = () => {
    spriteRef.current?.classList.remove("is-booped");
    window.requestAnimationFrame(() => {
      spriteRef.current?.classList.add("is-booped");
    });
  };

  const releaseDrag = useCallback(
    (pointerId: number | null, clientX?: number, clientY?: number) => {
      const sprite = spriteRef.current;
      const motion = motionRef.current;
      if (!sprite || !motion.isDragging) {
        return;
      }

      if (pointerId !== null && motion.pointerId !== pointerId) {
        return;
      }

      if (clientX !== undefined && clientY !== undefined) {
        motion.samples = [
          ...motion.samples,
          { x: clientX, y: clientY, time: performance.now() },
        ].slice(-6);
      }

      const capturedPointerId = motion.pointerId;
      motion.isDragging = false;
      motion.pointerId = null;
      if (
        capturedPointerId !== null &&
        typeof sprite.hasPointerCapture === "function" &&
        sprite.hasPointerCapture(capturedPointerId)
      ) {
        sprite.releasePointerCapture(capturedPointerId);
      }
      sprite.classList.remove("is-grabbed");

      if (isPausedRef.current) {
        motion.vx = 0;
        motion.vy = 0;
        motion.spin = 0;
        motion.squash = 1;
        motion.samples = [];
        return;
      }

      const first = motion.samples[0];
      const last = motion.samples[motion.samples.length - 1];
      if (first && last && last.time > first.time) {
        const seconds = (last.time - first.time) / 1000;
        const rawVx = (last.x - first.x) / seconds;
        const rawVy = (last.y - first.y) / seconds;
        motion.vx = clamp(rawVx, -MAX_THROW_SPEED, MAX_THROW_SPEED);
        motion.vy = clamp(rawVy, -MAX_THROW_SPEED, MAX_THROW_SPEED);
        motion.spin = clamp(motion.vx * 0.7, -520, 520);
      }

      const speed = Math.hypot(motion.vx, motion.vy);
      if (speed < 120) {
        const direction = Math.random() > 0.5 ? 1 : -1;
        motion.vx = 155 * direction;
        motion.vy = -130;
        motion.spin = 220 * direction;
      }

      motion.boostedUntil = performance.now() + 260;
      motion.squash = 0.76;
      motion.samples = [];
      pushBoopAnimation();
    },
    [],
  );

  useEffect(() => {
    const handleWindowPointerUp = (event: globalThis.PointerEvent) => {
      releaseDrag(event.pointerId, event.clientX, event.clientY);
    };

    const handleWindowPointerCancel = (event: globalThis.PointerEvent) => {
      releaseDrag(event.pointerId);
    };

    const handleBlur = () => {
      releaseDrag(null);
    };

    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerCancel);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
      window.removeEventListener("blur", handleBlur);
    };
  }, [releaseDrag]);

  const handleFlop = () => {
    if (isPausedRef.current) {
      return;
    }

    const motion = motionRef.current;
    if (motion.didDrag) {
      motion.didDrag = false;
      return;
    }

    const direction = Math.random() > 0.5 ? 1 : -1;
    motion.vx = (150 + Math.random() * 90) * direction;
    motion.vy = (120 + Math.random() * 110) * (Math.random() > 0.5 ? 1 : -1);
    motion.spin = 170 * direction;
    motion.boostedUntil = performance.now() + 700;
    motion.squash = 0.72;
    pushBoopAnimation();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    const sprite = spriteRef.current;
    if (!sprite) {
      return;
    }

    const motion = motionRef.current;
    const now = performance.now();
    motion.pointerId = event.pointerId;
    motion.isDragging = true;
    motion.didDrag = false;
    motion.vx = 0;
    motion.vy = 0;
    motion.spin *= 0.35;
    motion.grabOffsetX = event.clientX - motion.x;
    motion.grabOffsetY = event.clientY - motion.y;
    motion.samples = [{ x: event.clientX, y: event.clientY, time: now }];
    sprite.setPointerCapture(event.pointerId);
    sprite.classList.add("is-grabbed");
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const sprite = spriteRef.current;
    const motion = motionRef.current;
    if (!sprite || !motion.isDragging || motion.pointerId !== event.pointerId) {
      return;
    }

    const stage = getStageSize();
    const spriteSize = getSpriteSize(sprite);
    const maxX = Math.max(0, stage.width - spriteSize);
    const maxY = Math.max(0, stage.height - spriteSize);
    const nextX = clamp(event.clientX - motion.grabOffsetX, 0, maxX);
    const nextY = clamp(event.clientY - motion.grabOffsetY, 0, maxY);
    const distance = Math.hypot(nextX - motion.x, nextY - motion.y);

    motion.didDrag = motion.didDrag || distance > 4;
    motion.spin = clamp((nextX - motion.x) * 9, -420, 420);
    motion.x = nextX;
    motion.y = nextY;
    motion.samples = [
      ...motion.samples,
      { x: event.clientX, y: event.clientY, time: performance.now() },
    ].slice(-6);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    releaseDrag(event.pointerId, event.clientX, event.clientY);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    releaseDrag(event.pointerId);
  };

  const handleLostPointerCapture = () => {
    const motion = motionRef.current;
    motion.isDragging = false;
    motion.pointerId = null;
    motion.samples = [];
    spriteRef.current?.classList.remove("is-grabbed");
  };

  const togglePaused = () => {
    setIsPaused((currentIsPaused) => {
      const nextIsPaused = !currentIsPaused;
      const motion = motionRef.current;
      isPausedRef.current = nextIsPaused;

      if (nextIsPaused) {
        motion.isDragging = false;
        motion.pointerId = null;
        motion.samples = [];
        spriteRef.current?.classList.remove("is-grabbed");
      } else {
        motion.boostedUntil = performance.now() + 180;
      }

      return nextIsPaused;
    });
  };

  return (
    <>
      <button
        className="motion-toggle"
        type="button"
        aria-pressed={isPaused}
        onClick={togglePaused}
      >
        {isPaused ? "Play" : "Pause"}
      </button>

      <button
        ref={spriteRef}
        className={`platypus-button${isPaused ? " is-paused" : ""}`}
        type="button"
        aria-label="Drag or tap the pixel platypus"
        onClick={handleFlop}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
      >
        <span className="platypus-sprite" aria-hidden="true">
          {SPRITE_PIXELS.flatMap((row, rowIndex) =>
            Array.from(row).map((pixel, columnIndex) => (
              <span
                className={`sprite-pixel ${PIXEL_CLASS_NAMES[pixel] ?? ""}`}
                key={`${rowIndex}-${columnIndex}`}
              />
            )),
          )}
        </span>
      </button>
    </>
  );
}
