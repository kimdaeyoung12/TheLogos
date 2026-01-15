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
        this.renderer.domElement.style.pointerEvents = 'none'; // allow clicks pass through if needed, but we capture mouse for interaction

        // Remove old canvas if exists
        const oldCanvas = this.container.querySelector('canvas');
        if (oldCanvas) oldCanvas.remove();

        this.container.appendChild(this.renderer.domElement);

        // Lorenz Parameters
        this.sigma = 10;
        this.rho = 28;
        this.beta = 8 / 3;
        this.dt = 0.008;

        // Particle System
        this.particleCount = 3000;
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

            // Store comprehensive state for each particle
            this.particlesData.push({
                x, y, z,
                vx: 0, vy: 0, vz: 0, // velocity not strictly used in pure Lorenz, but used for chaos
                life: Math.random(),     // for color/opacity cycling?
                chaosMode: false,        // is this particle in Black Swan mode?
                chaosTimer: 0
            });

            // Color gradient (Indigo to Purple)
            const color = new THREE.Color();
            // mix between 0x818cf8 (indigo-400) and 0xc084fc (purple-400)
            color.setHSL(0.6 + Math.random() * 0.1, 0.8, 0.7);
            this.colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.4,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });

        this.pointsMesh = new THREE.Points(geometry, material);
        this.scene.add(this.pointsMesh);
    }

    updateParticles() {
        const positions = this.pointsMesh.geometry.attributes.position.array;

        // Chance for a Black Swan event (collective disruption)
        // A very low probability every frame to trigger a burst
        const globalChaos = Math.random() < 0.001;

        for (let i = 0; i < this.particleCount; i++) {
            let p = this.particlesData[i];

            if (globalChaos && Math.random() < 0.1) {
                // 10% of particles get hit by the Black Swan event
                p.chaosMode = true;
                p.chaosTimer = 100 + Math.random() * 100;
                // Explosion velocity
                p.vx = (Math.random() - 0.5) * 5;
                p.vy = (Math.random() - 0.5) * 5;
                p.vz = (Math.random() - 0.5) * 5;
            }

            if (p.chaosMode) {
                // Newtonian physics for chaos mode (flying off)
                p.x += p.vx;
                p.y += p.vy;
                p.z += p.vz;

                // Damping
                p.vx *= 0.98;
                p.vy *= 0.98;
                p.vz *= 0.98;

                p.chaosTimer--;

                // Return to attractor if slow enough or timer done
                if (p.chaosTimer <= 0) {
                    p.chaosMode = false;
                    // Reset to a random spot near center to influence loop
                    // or just let it get caught by Lorenz field at current pos (risky if too far)
                    // Let's teleport it closer if super far
                    if (Math.abs(p.x) > 100 || Math.abs(p.y) > 100 || Math.abs(p.z) > 100) {
                        p.x = (Math.random() - 0.5) * 20;
                        p.y = (Math.random() - 0.5) * 20;
                        p.z = 20 + (Math.random() - 0.5) * 20;
                    }
                }
            } else {
                // Lorenz Attractor Math
                // dx/dt = sigma * (y - x)
                // dy/dt = x * (rho - z) - y
                // dz/dt = x * y - beta * z

                let dx = this.sigma * (p.y - p.x);
                let dy = p.x * (this.rho - p.z) - p.y;
                let dz = p.x * p.y - this.beta * p.z;

                p.x += dx * this.dt;
                p.y += dy * this.dt;
                p.z += dz * this.dt;
            }

            // Interaction Influence (Mouse repulsion/attraction)
            // If mouse is moving, slightly perturb rho or positions?
            // Simple visual rotation is handled in animate()

            // Update Buffer
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;
        }

        this.pointsMesh.geometry.attributes.position.needsUpdate = true;

        // Centering the attractor visually
        // Lorenz attractor center is around z = rho - 1 usually? 
        // We'll just shift the mesh or camera. 
        // Standard Lorenz is a bit offset in Z.
        // Let's manually offset the mesh for centering.
        this.pointsMesh.position.y = -10;
        this.pointsMesh.position.z = -10;
    }

    animate = () => {
        requestAnimationFrame(this.animate);

        this.updateParticles();

        // Smooth Rotation based on mouse
        this.targetRotationX = this.mouseY * 0.0005;
        this.targetRotationY = this.mouseX * 0.0005;

        this.scene.rotation.x += (this.targetRotationX - this.scene.rotation.x) * 0.05;
        this.scene.rotation.y += (this.targetRotationY - this.scene.rotation.y) * 0.05;

        // Constant slow rotation
        this.scene.rotation.z += 0.0002;

        this.renderer.render(this.scene, this.camera);
    }

    addEventListeners() {
        window.addEventListener('resize', this.onWindowResize.bind(this));
        document.addEventListener('mousemove', this.onDocumentMouseMove.bind(this));
        // Click to trigger manual Black Swan?
        document.addEventListener('mousedown', () => {
            // Trigger manual chaos on 30% of particles
            for (let i = 0; i < this.particleCount; i++) {
                if (Math.random() < 0.3) {
                    let p = this.particlesData[i];
                    p.chaosMode = true;
                    p.chaosTimer = 60;
                    p.vx = (Math.random() - 0.5) * 8;
                    p.vy = (Math.random() - 0.5) * 8;
                    p.vz = (Math.random() - 0.5) * 8;
                }
            }
        });
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
    // Only init if we are on the home page or a specific container exists
    if (document.getElementById('canvas-container')) {
        new BlackSwanAttractor('#canvas-container');
    }
});
