import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

class ConstellationEffect {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector);
        if (!this.container) return;

        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        this.scene = new THREE.Scene();
        // Fog to fade out distant particles seamlessly into the background color (approx dark blue/slate)
        // Adjust color to match hero section background #0f172a
        this.scene.fog = new THREE.FogExp2(0x0f172a, 0.001);

        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        this.camera.position.z = 50;

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Perf cap

        // Remove existing content (fallback scaling CSS animation) if needed, or just append
        // We'll just append and let CSS absolute positioning handle overlap
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.container.appendChild(this.renderer.domElement);

        this.particles = [];
        this.particleCount = window.innerWidth < 768 ? 60 : 120; // Reduce count/load for mobile

        // Interaction
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetX = 0;
        this.targetY = 0;

        this.init();
        this.animate();
        this.addEventListeners();
    }

    init() {
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.PointsMaterial({
            color: 0x818cf8, // Light Indigo matching the theme
            size: 0.5,
            transparent: true,
            opacity: 0.8
        });

        // Create particles
        for (let i = 0; i < this.particleCount; i++) {
            const x = (Math.random() - 0.5) * 150;
            const y = (Math.random() - 0.5) * 150;
            const z = (Math.random() - 0.5) * 100;

            this.particles.push({
                x, y, z,
                vx: (Math.random() - 0.5) * 0.05,
                vy: (Math.random() - 0.5) * 0.05,
                vz: (Math.random() - 0.5) * 0.02
            });
        }
    }

    addLines() {
        // Dynamic line creation is expensive, but for < 150 particles it's fine.
        // We recreate the line geometry every frame. 
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x818cf8,
            transparent: true,
            opacity: 0.15
        });

        const points = [];
        const connectionDistance = 25;

        for (let i = 0; i < this.particleCount; i++) {
            for (let j = i + 1; j < this.particleCount; j++) {
                const p1 = this.particles[i];
                const p2 = this.particles[j];

                // Simple distance check
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dz = p1.z - p2.z;
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq < connectionDistance * connectionDistance) {
                    points.push(new THREE.Vector3(p1.x, p1.y, p1.z));
                    points.push(new THREE.Vector3(p2.x, p2.y, p2.z));
                }
            }
        }

        if (this.linesMesh) {
            this.scene.remove(this.linesMesh);
            this.linesMesh.geometry.dispose();
        }

        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        this.linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
        this.scene.add(this.linesMesh);
    }

    drawParticles() {
        if (this.pointsMesh) {
            this.scene.remove(this.pointsMesh);
            this.pointsMesh.geometry.dispose();
        }

        const vertices = [];
        this.particles.forEach(p => {
            vertices.push(p.x, p.y, p.z);
        });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        this.pointsMesh = new THREE.Points(geometry, new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.4,
            transparent: true,
            opacity: 0.8
        }));
        this.scene.add(this.pointsMesh);
    }

    animate = () => {
        requestAnimationFrame(this.animate);

        // Update positions
        this.targetX = this.mouseX * 0.001;
        this.targetY = this.mouseY * 0.001;

        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.z += p.vz;

            // Boundary wrap-around (gentle) or bounce
            // Let's wrap around for endless flow
            if (p.x > 75) p.x = -75;
            if (p.x < -75) p.x = 75;
            if (p.y > 75) p.y = -75;
            if (p.y < -75) p.y = 75;
        });

        // Mouse Parallax
        const time = Date.now() * 0.0005; // Time factor for idle movement

        this.scene.rotation.y += 0.0005; // Constant base rotation
        this.scene.rotation.x += (this.targetY - this.scene.rotation.x) * 0.05;
        this.scene.rotation.y += (this.targetX - this.scene.rotation.y) * 0.05;

        // Add subtle wave calculation to particles for "breathing" effect
        this.particles.forEach((p, i) => {
            p.y += Math.sin(time + p.x * 0.05) * 0.02;
        });

        this.drawParticles();
        this.addLines();

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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ConstellationEffect('#canvas-container');
});
