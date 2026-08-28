const TAU = Math.PI * 2;

function fibonacciSphere(count) {
  const points = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < count; index += 1) {
    const y = 1 - (index / Math.max(count - 1, 1)) * 2;
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
  constructor(canvas, { count = 0, compact = false } = {}) {
    this.canvas = canvas;
    this.context = canvas?.getContext?.("2d", { alpha: true });
    this.compact = compact;
    this.count = count;
    this.points = count > 0 ? fibonacciSphere(Math.min(count, compact ? 48 : 120)) : [];
    this.reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    this.frame = null;
    this.angle = 0.25;
    this.resizeObserver = null;
    this.visible = true;
  }

  setCount(count) {
    const next = Math.max(0, Number(count) || 0);
    if (next === this.count) return;
    this.count = next;
    this.points = next > 0 ? fibonacciSphere(Math.min(next, this.compact ? 48 : 120)) : [];
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
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
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
      this.angle = (time / 26000) % TAU;
      this.draw(time);
      this.schedule();
    });
  }

  draw(time = 0) {
    if (!this.context || !this.width || !this.height) return;
    const ctx = this.context;
    const width = this.width;
    const height = this.height;
    const centerX = width * 0.5;
    const centerY = height * (this.compact ? 0.5 : 0.48);
    const scale = Math.min(width, height) * (this.compact ? 0.25 : 0.33);
    ctx.clearRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, scale * 1.7);
    glow.addColorStop(0, "rgba(218, 190, 126, .13)");
    glow.addColorStop(0.55, "rgba(118, 145, 128, .07)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const cosY = Math.cos(this.angle);
    const sinY = Math.sin(this.angle);
    const cosX = Math.cos(-0.18);
    const sinX = Math.sin(-0.18);
    const projected = this.points.map((point) => {
      const rotatedX = point.x * cosY - point.z * sinY;
      const rotatedZ = point.x * sinY + point.z * cosY;
      const rotatedY = point.y * cosX - rotatedZ * sinX;
      const depth = point.y * sinX + rotatedZ * cosX;
      const perspective = 1.12 + depth * 0.16;
      return {
        x: centerX + rotatedX * scale * perspective,
        y: centerY + rotatedY * scale * perspective,
        depth,
        phase: point.phase,
      };
    });

    for (let a = 0; a < projected.length; a += 1) {
      for (let b = a + 1; b < projected.length; b += 1) {
        const first = projected[a];
        const second = projected[b];
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        if (distance < scale * 0.54) {
          ctx.strokeStyle = `rgba(72, 94, 78, ${Math.max(0, 0.08 - distance / (scale * 8))})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(first.x, first.y);
          ctx.lineTo(second.x, second.y);
          ctx.stroke();
        }
      }
    }

    projected
      .sort((a, b) => a.depth - b.depth)
      .forEach((point) => {
        const breathe = this.reducedMotion ? 0.7 : 0.68 + Math.sin(time / 1900 + point.phase) * 0.12;
        const radius = (this.compact ? 1.5 : 2.3) + (point.depth + 1) * (this.compact ? 0.65 : 1.15);
        ctx.shadowColor = "rgba(205, 168, 92, .5)";
        ctx.shadowBlur = this.compact ? 5 : 9;
        ctx.fillStyle = `rgba(195, 151, 71, ${Math.max(0.25, breathe + point.depth * 0.09)})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, TAU);
        ctx.fill();
      });
    ctx.shadowBlur = 0;
  }
}
