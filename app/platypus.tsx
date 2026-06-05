"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
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
const TOUCH_POINTER_ID = -1;
const PIXEL_SIZE_PERCENT = 6.25;
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

type SpritePixel = {
  className: string;
  x: number;
  y: number;
};

const SPRITE_PIXEL_DATA = buildSpritePixelData();

function buildSpritePixelData() {
  const pixels: SpritePixel[] = [];

  for (let y = 0; y < SPRITE_PIXELS.length; y += 1) {
    const row = SPRITE_PIXELS[y];

    for (let x = 0; x < row.length; x += 1) {
      const className = PIXEL_CLASS_NAMES[row.charAt(x)];

      if (className) {
        pixels.push({ className, x, y });
      }
    }
  }

  return pixels;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function distance(x1: number, y1: number, x2: number, y2: number) {
  const deltaX = x1 - x2;
  const deltaY = y1 - y2;

  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function getStageSize() {
  const viewport = window.visualViewport;

  return {
    width: viewport ? viewport.width : window.innerWidth,
    height: viewport ? viewport.height : window.innerHeight,
  };
}

function getSpriteSize(sprite: HTMLElement) {
  return sprite.offsetWidth || 144;
}

export function FloppingPlatypus() {
  const [isPaused, setIsPaused] = useState(false);
  const spriteRef = useRef<HTMLButtonElement>(null);
  const isPausedRef = useRef(false);
  const supportsPointerEventsRef = useRef(true);
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

    supportsPointerEventsRef.current = "PointerEvent" in window;
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

          const speed = distance(motion.vx, motion.vy, 0, 0);
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

    const viewport = window.visualViewport;
    window.addEventListener("resize", keepInBounds);
    if (viewport) {
      viewport.addEventListener("resize", keepInBounds);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", keepInBounds);
      if (viewport) {
        viewport.removeEventListener("resize", keepInBounds);
      }
    };
  }, []);

  const pushBoopAnimation = () => {
    const sprite = spriteRef.current;
    if (!sprite) {
      return;
    }

    sprite.classList.remove("is-booped");
    window.requestAnimationFrame(() => {
      sprite.classList.add("is-booped");
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

      const speed = distance(motion.vx, motion.vy, 0, 0);
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

    if (supportsPointerEventsRef.current) {
      window.addEventListener("pointerup", handleWindowPointerUp);
      window.addEventListener("pointercancel", handleWindowPointerCancel);
    }
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

  const beginDrag = (
    clientX: number,
    clientY: number,
    pointerId: number,
    shouldCapturePointer: boolean,
  ) => {
    const sprite = spriteRef.current;
    if (!sprite) {
      return;
    }

    const motion = motionRef.current;
    const now = performance.now();
    motion.pointerId = pointerId;
    motion.isDragging = true;
    motion.didDrag = false;
    motion.vx = 0;
    motion.vy = 0;
    motion.spin *= 0.35;
    motion.grabOffsetX = clientX - motion.x;
    motion.grabOffsetY = clientY - motion.y;
    motion.samples = [{ x: clientX, y: clientY, time: now }];
    if (shouldCapturePointer && typeof sprite.setPointerCapture === "function") {
      sprite.setPointerCapture(pointerId);
    }
    sprite.classList.add("is-grabbed");
  };

  const moveDrag = (clientX: number, clientY: number, pointerId: number) => {
    const sprite = spriteRef.current;
    const motion = motionRef.current;
    if (!sprite || !motion.isDragging || motion.pointerId !== pointerId) {
      return;
    }

    const stage = getStageSize();
    const spriteSize = getSpriteSize(sprite);
    const maxX = Math.max(0, stage.width - spriteSize);
    const maxY = Math.max(0, stage.height - spriteSize);
    const nextX = clamp(clientX - motion.grabOffsetX, 0, maxX);
    const nextY = clamp(clientY - motion.grabOffsetY, 0, maxY);
    const dragDistance = distance(nextX, nextY, motion.x, motion.y);

    motion.didDrag = motion.didDrag || dragDistance > 4;
    motion.spin = clamp((nextX - motion.x) * 9, -420, 420);
    motion.x = nextX;
    motion.y = nextY;
    motion.samples = [
      ...motion.samples,
      { x: clientX, y: clientY, time: performance.now() },
    ].slice(-6);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    beginDrag(event.clientX, event.clientY, event.pointerId, true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    moveDrag(event.clientX, event.clientY, event.pointerId);
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
    const sprite = spriteRef.current;
    if (sprite) {
      sprite.classList.remove("is-grabbed");
    }
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLButtonElement>) => {
    if (supportsPointerEventsRef.current || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    beginDrag(touch.clientX, touch.clientY, TOUCH_POINTER_ID, false);
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLButtonElement>) => {
    if (supportsPointerEventsRef.current || event.touches.length !== 1) {
      return;
    }

    event.preventDefault();
    const touch = event.touches[0];
    moveDrag(touch.clientX, touch.clientY, TOUCH_POINTER_ID);
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLButtonElement>) => {
    if (supportsPointerEventsRef.current) {
      return;
    }

    const touch = event.changedTouches[0];
    releaseDrag(TOUCH_POINTER_ID, touch.clientX, touch.clientY);
  };

  const handleTouchCancel = () => {
    if (!supportsPointerEventsRef.current) {
      releaseDrag(TOUCH_POINTER_ID);
    }
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
        const sprite = spriteRef.current;
        if (sprite) {
          sprite.classList.remove("is-grabbed");
        }
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <span className="platypus-sprite" aria-hidden="true">
          {SPRITE_PIXEL_DATA.map((pixel) => (
            <span
              className={`sprite-pixel ${pixel.className}`}
              key={`${pixel.y}-${pixel.x}`}
              style={{
                left: `${pixel.x * PIXEL_SIZE_PERCENT}%`,
                top: `${pixel.y * PIXEL_SIZE_PERCENT}%`,
              }}
            />
          ))}
        </span>
      </button>
    </>
  );
}
