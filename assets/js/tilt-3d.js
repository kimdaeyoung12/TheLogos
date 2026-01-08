/**
 * Simple 3D Tilt Effect
 * Applied to elements with class 'tilt-card'
 */

class TiltEffect {
    constructor(element) {
        this.element = element;
        this.container = element;
        this.perspective = 1000;
        this.max = 8; // Max rotation degrees
        this.scale = 1.02; // Scale on hover
        this.speed = 500; // Transition speed

        this.init();
    }

    init() {
        this.element.style.transition = `transform ${this.speed}ms cubic-bezier(.03,.98,.52,.99)`;
        this.element.addEventListener('mouseenter', this.onMouseEnter.bind(this));
        this.element.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.element.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    }

    onMouseEnter() {
        this.element.style.transition = 'none';
        this.element.style.zIndex = 10;
        // Trigger generic hover effects if any
    }

    onMouseMove(event) {
        const rect = this.element.getBoundingClientRect();
        const x = event.clientX - rect.left; // x position within the element
        const y = event.clientY - rect.top; // y position within the element

        const w = this.element.offsetWidth;
        const h = this.element.offsetHeight;

        const centerX = w / 2;
        const centerY = h / 2;

        const rotateX = ((y - centerY) / centerY) * -this.max; // Invert tilt
        const rotateY = ((x - centerX) / centerX) * this.max;

        this.element.style.transform =
            `perspective(${this.perspective}px) ` +
            `rotateX(${rotateX.toFixed(2)}deg) ` +
            `rotateY(${rotateY.toFixed(2)}deg) ` +
            `scale3d(${this.scale}, ${this.scale}, ${this.scale})`;
    }

    onMouseLeave() {
        this.element.style.transition = `transform ${this.speed}ms cubic-bezier(.03,.98,.52,.99)`;
        this.element.style.transform =
            `perspective(${this.perspective}px) ` +
            `rotateX(0deg) ` +
            `rotateY(0deg) ` +
            `scale3d(1, 1, 1)`;
        this.element.style.zIndex = 1;
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Apply to Featured Post and Post Cards
    const cards = document.querySelectorAll('.featured-post, .post-card');
    cards.forEach(card => new TiltEffect(card));
});
