const TAU = Math.PI * 2;
const LIVE_BACKDROP_POINT_LIMIT = 72;
const LIVE_BACKDROP_EXCLUSION_SELECTORS = [
  ["#live-heading", 20],
  ["#live-stage-label", 12],
  ["#live-scripture-reference", 12],
  ["#live-timer", 14],
  ["#live-mode-label", 12],
];

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function isPointInsideZone(point, zone) {
  return point.x > zone.left && point.x < zone.right && point.y > zone.top && point.y < zone.bottom;
}

function zonesOverlap(first, second) {
  return first.left < second.right
    && first.right > second.left
    && first.top < second.bottom
    && first.bottom > second.top;
}

export function mergeOverlappingZones(zones) {
  const merged = [];
  zones.forEach((zone) => {
    let next = { ...zone };
    let mergedAnother = true;
    while (mergedAnother) {
      mergedAnother = false;
      for (let index = merged.length - 1; index >= 0; index -= 1) {
        if (!zonesOverlap(next, merged[index])) continue;
        const overlap = merged.splice(index, 1)[0];
        next = {
          left: Math.min(next.left, overlap.left),
          right: Math.max(next.right, overlap.right),
          top: Math.min(next.top, overlap.top),
          bottom: Math.max(next.bottom, overlap.bottom),
        };
        mergedAnother = true;
      }
    }
    merged.push(next);
  });
  return merged;
}

export function movePointOutsideZones(point, zones, index, width, height) {
  let x = point.x;
  let y = point.y;
  const mergedZones = mergeOverlappingZones(zones);
  const maximumAttempts = mergedZones.length * 2 + 2;

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const zoneIndex = mergedZones.findIndex((zone) => isPointInsideZone({ x, y }, zone));
    if (zoneIndex < 0) break;
    const zone = mergedZones[zoneIndex];
    const tangentOffset = (((index * 7 + zoneIndex * 5) % 13) - 6) * 2.4;
    const normalOffset = 5 + ((index * 11 + zoneIndex * 3) % 6) * 2.2;
    const centerX = (zone.left + zone.right) / 2;
    const centerY = (zone.top + zone.bottom) / 2;
    const halfWidth = Math.max(1, (zone.right - zone.left) / 2);
    const halfHeight = Math.max(1, (zone.bottom - zone.top) / 2);
    const horizontalCurve = Math.pow(clamp((x - centerX) / halfWidth, -1, 1), 2) * 14;
    const verticalCurve = Math.pow(clamp((y - centerY) / halfHeight, -1, 1), 2) * 14;
    const candidates = [
      { x: zone.left - normalOffset - verticalCurve, y: y + tangentOffset },
      { x: zone.right + normalOffset + verticalCurve, y: y + tangentOffset },
      { x: x + tangentOffset, y: zone.top - normalOffset - horizontalCurve },
      { x: x + tangentOffset, y: zone.bottom + normalOffset + horizontalCurve },
    ].map((candidate) => ({
      x: clamp(candidate.x, 8, width - 8),
      y: clamp(candidate.y, 8, height - 8),
    })).sort((first, second) => (
      Math.hypot(first.x - x, first.y - y) - Math.hypot(second.x - x, second.y - y)
    ));
    const safeCandidate = candidates.find((candidate) => (
      mergedZones.every((otherZone) => !isPointInsideZone(candidate, otherZone))
    ));
    const selected = safeCandidate ?? candidates[0];
    x = selected.x;
    y = selected.y;
  }

  if (mergedZones.some((zone) => isPointInsideZone({ x, y }, zone))) {
    const corners = [
      { x: 8, y: 8 },
      { x: width - 8, y: 8 },
      { x: 8, y: height - 8 },
      { x: width - 8, y: height - 8 },
    ].filter((candidate) => mergedZones.every((zone) => !isPointInsideZone(candidate, zone)));
    corners.sort((first, second) => (
      Math.hypot(first.x - x, first.y - y) - Math.hypot(second.x - x, second.y - y)
    ));
    if (corners[0]) ({ x, y } = corners[0]);
  }

  return { ...point, x, y };
}

function fibonacciSphere(count) {
  const points = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < count; index += 1) {
    const y = 1 - ((index + 0.5) / Math.max(count, 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * index;
    points.push({
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
      phase: (index * 0.73) % TAU,
    });
  }
  return points;
}

export class PrayerPresenceCanvas {
  constructor(canvas, { count = 0, compact = false, variant = "default" } = {}) {
    this.canvas = canvas;
    this.context = canvas?.getContext?.("2d", { alpha: true });
    this.compact = compact;
    this.variant = variant;
    this.pointLimit = variant === "live-backdrop" ? LIVE_BACKDROP_POINT_LIMIT : compact ? 48 : 120;
    this.count = count;
    this.points = count > 0 ? fibonacciSphere(Math.min(count, this.pointLimit)) : [];
    this.reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    this.frame = null;
    this.frameInterval = variant === "live-backdrop" ? 1000 / 15 : 0;
    this.lastDrawAt = 0;
    this.angle = 0.25;
    this.resizeObserver = null;
    this.visible = true;
  }

  setCount(count) {
    const next = Math.max(0, Number(count) || 0);
    if (next === this.count) return;
    this.count = next;
    this.points = next > 0 ? fibonacciSphere(Math.min(next, this.pointLimit)) : [];
    this.draw();
  }

  start() {
    if (!this.context || !this.canvas) return false;
    if (typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas);
    } else {
      this.windowResizeHandler = () => this.resize();
      globalThis.addEventListener?.("resize", this.windowResizeHandler, { passive: true });
    }
    this.resize();
    if (typeof IntersectionObserver === "function") {
      const observer = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        if (this.visible) this.schedule();
      });
      observer.observe(this.canvas);
      this.intersectionObserver = observer;
    }
    this.schedule();
    return true;
  }

  stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    if (this.windowResizeHandler) globalThis.removeEventListener?.("resize", this.windowResizeHandler);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratioLimit = this.variant === "live-backdrop" ? 1.25 : 2;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, ratioLimit);
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
    this.draw();
  }

  schedule() {
    if (!this.visible || this.frame) return;
    if (this.reducedMotion) {
      this.draw();
      return;
    }
    this.frame = requestAnimationFrame((time) => {
      this.frame = null;
      if (!this.frameInterval || time - this.lastDrawAt >= this.frameInterval) {
        this.lastDrawAt = time;
        this.angle = (time / (this.variant === "live-backdrop" ? 42000 : 26000)) % TAU;
        this.draw(time);
      }
      this.schedule();
    });
  }

  getLiveBackdropExclusionZones() {
    const ownerDocument = this.canvas?.ownerDocument;
    if (!ownerDocument || !this.canvas?.getBoundingClientRect) return [];
    const canvasRect = this.canvas.getBoundingClientRect();
    const zones = LIVE_BACKDROP_EXCLUSION_SELECTORS.flatMap(([selector, padding]) => {
      const element = ownerDocument.querySelector(selector);
      if (!element || element.hidden) return [];
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      return [{
        left: rect.left - canvasRect.left - padding,
        right: rect.right - canvasRect.left + padding,
        top: rect.top - canvasRect.top - padding,
        bottom: rect.bottom - canvasRect.top + padding,
      }];
    });
    return mergeOverlappingZones(zones);
  }

  draw(time = 0) {
    if (!this.context || !this.width || !this.height) return;
    const ctx = this.context;
    const width = this.width;
    const height = this.height;
    const centerX = width * 0.5;
    const centerY = height * (this.compact ? 0.5 : 0.48);
    const isLiveBackdrop = this.variant === "live-backdrop";
    const scale = Math.min(width, height) * (isLiveBackdrop ? 0.43 : this.compact ? 0.25 : 0.33);
    const exclusionZones = isLiveBackdrop ? this.getLiveBackdropExclusionZones() : [];
    ctx.clearRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, scale * 1.7);
    glow.addColorStop(0, isLiveBackdrop ? "rgba(218, 190, 126, .065)" : "rgba(218, 190, 126, .13)");
    glow.addColorStop(0.55, isLiveBackdrop ? "rgba(118, 145, 128, .04)" : "rgba(118, 145, 128, .07)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const cosY = Math.cos(this.angle);
    const sinY = Math.sin(this.angle);
    const cosX = Math.cos(-0.18);
    const sinX = Math.sin(-0.18);
    const projected = this.points.map((point, index) => {
      const rotatedX = point.x * cosY - point.z * sinY;
      const rotatedZ = point.x * sinY + point.z * cosY;
      const rotatedY = point.y * cosX - rotatedZ * sinX;
      const depth = point.y * sinX + rotatedZ * cosX;
      const perspective = 1.12 + depth * 0.16;
      const projectedX = centerX + rotatedX * scale * perspective;
      const projectedY = centerY + rotatedY * scale * perspective;

      const projectedPoint = {
        x: projectedX,
        y: projectedY,
        depth,
        phase: point.phase,
        index,
      };
      return isLiveBackdrop
        ? movePointOutsideZones(projectedPoint, exclusionZones, index, width, height)
        : projectedPoint;
    });

    for (let a = 0; a < projected.length; a += 1) {
      for (let b = a + 1; b < projected.length; b += 1) {
        const first = projected[a];
        const second = projected[b];
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        const connectionDistance = scale * (isLiveBackdrop ? 0.46 : 0.54);
        if (distance < connectionDistance && (!isLiveBackdrop || (a + b) % 3 === 0)) {
          const maxAlpha = isLiveBackdrop ? 0.075 : 0.08;
          ctx.strokeStyle = `rgba(72, 94, 78, ${Math.max(0, maxAlpha - distance / (scale * 8))})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(first.x, first.y);
          ctx.lineTo(second.x, second.y);
          ctx.stroke();
        }
      }
    }

    const densityScale = isLiveBackdrop
      ? clamp(1.12 - projected.length / 180, 0.74, 1.08)
      : 1;
    const lightPalettes = [
      { halo: "rgba(201, 158, 76, .44)", body: [196, 150, 64], core: "rgba(255, 246, 209, .96)" },
      { halo: "rgba(94, 132, 106, .34)", body: [105, 143, 116], core: "rgba(246, 241, 211, .94)" },
      { halo: "rgba(221, 190, 123, .38)", body: [212, 174, 95], core: "rgba(255, 250, 226, .98)" },
    ];

    projected
      .sort((a, b) => a.depth - b.depth)
      .forEach((point) => {
        const breathe = this.reducedMotion ? 0.7 : 0.68 + Math.sin(time / 1900 + point.phase) * 0.12;
        const baseRadius = isLiveBackdrop ? 2.2 : this.compact ? 1.5 : 2.3;
        const depthRadius = isLiveBackdrop ? 1.05 : this.compact ? 0.65 : 1.15;
        const radius = (baseRadius + (point.depth + 1) * depthRadius) * densityScale;
        const palette = lightPalettes[point.index % lightPalettes.length];
        const alpha = clamp(breathe + point.depth * 0.08 - (isLiveBackdrop ? 0.08 : 0), 0.42, 0.88);

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = isLiveBackdrop ? palette.halo : "rgba(205, 168, 92, .5)";
        ctx.shadowBlur = isLiveBackdrop ? radius * 4.8 : this.compact ? 5 : 9;
        ctx.fillStyle = `rgba(${palette.body.join(", ")}, ${alpha * 0.54})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * (isLiveBackdrop ? 1.65 : 1), 0, TAU);
        ctx.fill();

        if (isLiveBackdrop) {
          ctx.shadowBlur = radius * 2.2;
          ctx.fillStyle = `rgba(${palette.body.join(", ")}, ${alpha * 0.76})`;
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius * 0.92, 0, TAU);
          ctx.fill();

          ctx.shadowBlur = radius * 1.1;
          ctx.fillStyle = palette.core;
          ctx.beginPath();
          ctx.arc(point.x - radius * 0.16, point.y - radius * 0.2, Math.max(1.05, radius * 0.34), 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      });
    ctx.shadowBlur = 0;
  }
}
