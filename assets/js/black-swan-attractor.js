import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

class BlackSwanAttractor {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector);
        if (!this.container) return;

        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        // Scene Setup
        this.scene = new THREE.Scene();
        // matches hero section bg #0f172a
        this.scene.fog = new THREE.FogExp2(0x0f172a, 0.002);

        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        this.camera.position.z = 60;

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Style
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.pointerEvents = 'none'; // allow clicks pass through
        this.renderer.domElement.style.zIndex = '-1'; // Ensure it is behind content

        // Remove old canvas if exists
        const oldCanvas = this.container.querySelector('canvas');
        if (oldCanvas) oldCanvas.remove();

        this.container.appendChild(this.renderer.domElement);

        // Lorenz Parameters
        this.sigma = 10;
        this.rho = 28;
        this.beta = 8 / 3;
        this.dt = 0.006; // Slower time step for smoother motion

        // Particle System
        this.particleCount = 2500; // Slightly reduced count for cleaner look
        this.particlesData = [];
        this.colors = [];

        // Interaction
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetRotationX = 0;
        this.targetRotationY = 0;

        this.init();
        this.animate();
        this.addEventListeners();
    }

    init() {
        const geometry = new THREE.BufferGeometry();
        const positions = [];

        // Initial random positions
        for (let i = 0; i < this.particleCount; i++) {
            const x = (Math.random() - 0.5) * 40;
            const y = (Math.random() - 0.5) * 40;
            const z = (Math.random() - 0.5) * 40;

            positions.push(x, y, z);

            this.particlesData.push({
                x, y, z,
                vx: 0, vy: 0, vz: 0,
                chaosMode: false,
                chaosTimer: 0,
                // Assign each particle a "home" offset for chaos
                chaosTarget: {
                    x: (Math.random() - 0.5) * 50,
                    y: (Math.random() - 0.5) * 50,
                    z: (Math.random() - 0.5) * 50
                }
            });

            // Color gradient (Subtler Indigo/Slate)
            const color = new THREE.Color();
            // mix between 0x6366f1 (indigo-500) and 0x94a3b8 (slate-400)
            if (Math.random() > 0.5) {
                color.setHSL(0.63, 0.6, 0.6); // Indigo
            } else {
                color.setHSL(0.6, 0.4, 0.7); // Slate/Blueish
            }
            this.colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.3, // Smaller particles for elegance
            vertexColors: true,
            transparent: true,
            opacity: 0.5, // Reduced opacity for subtlety
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });

        this.pointsMesh = new THREE.Points(geometry, material);
        // Center the cloud better
        this.pointsMesh.position.y = -5;
        this.scene.add(this.pointsMesh);
    }

    updateParticles() {
        const positions = this.pointsMesh.geometry.attributes.position.array;

        // Gentle "Black Swan" Deviation
        // Instead of explosion, we use a "Drift" probability
        // Very rare event for individual particles to drift off 'orbit'
        const chaosChance = 0.0005;

        for (let i = 0; i < this.particleCount; i++) {
            let p = this.particlesData[i];

            // Randomly trigger individual drift (Chaos)
            if (!p.chaosMode && Math.random() < chaosChance) {
                p.chaosMode = true;
                p.chaosTimer = 200; // Longer, slower drift
                // Gentle velocity towards a random point
                p.vx = (Math.random() - 0.5) * 0.2;
                p.vy = (Math.random() - 0.5) * 0.2;
                p.vz = (Math.random() - 0.5) * 0.2;
            }

            if (p.chaosMode) {
                // Drift phase
                p.x += p.vx;
                p.y += p.vy;
                p.z += p.vz;

                p.chaosTimer--;

                // Return to flow
                if (p.chaosTimer <= 0) {
                    p.chaosMode = false;
                    // Teleport closer to center if too far, to rejoin the flow seamlessly
                    if (Math.abs(p.x) > 80 || Math.abs(p.y) > 80) {
                        p.x = (Math.random() - 0.5) * 10;
                        p.y = (Math.random() - 0.5) * 10;
                        p.z = 20;
                    }
                }
            } else {
                // Standard Lorenz Flow
                let dx = this.sigma * (p.y - p.x);
                let dy = p.x * (this.rho - p.z) - p.y;
                let dz = p.x * p.y - this.beta * p.z;

                p.x += dx * this.dt;
                p.y += dy * this.dt;
                p.z += dz * this.dt;
            }

            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;
        }

        this.pointsMesh.geometry.attributes.position.needsUpdate = true;
    }

    animate = () => {
        requestAnimationFrame(this.animate);

        this.updateParticles();

        // Very slow, majestic rotation
        this.targetRotationX = this.mouseY * 0.0002; // Reduced sensitivity
        this.targetRotationY = this.mouseX * 0.0002;

        this.scene.rotation.x += (this.targetRotationX - this.scene.rotation.x) * 0.02;
        this.scene.rotation.y += (this.targetRotationY - this.scene.rotation.y) * 0.02;

        // Automatic slow pan
        this.scene.rotation.z += 0.0005;

        this.renderer.render(this.scene, this.camera);
    }

    addEventListeners() {
        window.addEventListener('resize', this.onWindowResize.bind(this));
        document.addEventListener('mousemove', this.onDocumentMouseMove.bind(this));
    }

    onWindowResize() {
        if (!this.container) return;
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(this.width, this.height);
    }

    onDocumentMouseMove(event) {
        this.mouseX = (event.clientX - window.innerWidth / 2);
        this.mouseY = (event.clientY - window.innerHeight / 2);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('canvas-container')) {
        new BlackSwanAttractor('#canvas-container');
    }
});
