/* 
 * 3D Scroll Animation for The Logos About Page
 * Uses Three.js to render a dynamic scene representing:
 * 1. Tide/Ocean (Introduction)
 * 2. Entropy/Chaos (Particles)
 * 3. Logos/Order (Geometry)
 * 4. Growth/Rings (Torus/Spiral)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check if Three.js is loaded
    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded');
        return;
    }

    const container = document.getElementById('three-canvas-container');
    if (!container) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    // Add subtle fog for depth
    scene.fog = new THREE.FogExp2(0x050510, 0.0025);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x6366f1, 2, 100); // Indigo glow
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    const blueLight = new THREE.PointLight(0x4facfe, 2, 100); // Blue glow
    blueLight.position.set(-10, -10, 10);
    scene.add(blueLight);

    // --- Objects ---

    // 1. The Ocean/Tide (Wireframe Plane)
    // Represents the "Tide" mentioned in the intro
    const planeGeometry = new THREE.PlaneGeometry(100, 100, 40, 40);
    const planeMaterial = new THREE.MeshBasicMaterial({
        color: 0x667eea,
        wireframe: true,
        transparent: true,
        opacity: 0.3
    });
    const tidePlane = new THREE.Mesh(planeGeometry, planeMaterial);
    tidePlane.rotation.x = -Math.PI / 2;
    tidePlane.position.y = -10;
    scene.add(tidePlane);

    // 2. Entropy (Particles)
    // Chaos field that surrounds the camera
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 2000;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 80; // Spread wide
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
    });
    const entropyField = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(entropyField);


    // 3. The Logos (Geometry)
    // Icosahedron representing Order/Truth
    const logosGeometry = new THREE.IcosahedronGeometry(4, 1);
    const logosMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        emissive: 0x111111,
        specular: 0x666666,
        shininess: 10,
        flatShading: true,
        wireframe: false,
        transparent: true,
        opacity: 0.9
    });
    const logosMesh = new THREE.Mesh(logosGeometry, logosMaterial);
    logosMesh.position.set(0, 0, -20); // Start far away
    scene.add(logosMesh);

    // Wireframe overlay for Logos
    const logosWireParams = new THREE.IcosahedronGeometry(4.1, 1);
    const logosWireMat = new THREE.MeshBasicMaterial({ color: 0x6366f1, wireframe: true, transparent: true, opacity: 0.5 });
    const logosWire = new THREE.Mesh(logosWireParams, logosWireMat);
    logosMesh.add(logosWire); // Child of logosMesh


    // 4. Growth/Rings (Torus)
    // Representing Tree rings / Life
    const ringsGroup = new THREE.Group();
    const ringCount = 5;
    for (let i = 0; i < ringCount; i++) {
        const torusGeo = new THREE.TorusGeometry(3 + i * 1.5, 0.05, 16, 100);
        const torusMat = new THREE.MeshBasicMaterial({ color: 0xf5576c, transparent: true, opacity: 0.3 + (i * 0.1) });
        const ring = new THREE.Mesh(torusGeo, torusMat);
        ring.rotation.x = Math.PI / 2;
        ring.rotation.y = Math.random() * Math.PI;
        ringsGroup.add(ring);
    }
    ringsGroup.position.set(0, -20, -10); // Start hidden below
    scene.add(ringsGroup);


    // --- Post-Processing / Animation State ---

    let scrollY = 0;
    let limit = Math.max(document.body.scrollHeight, document.body.offsetHeight,
        document.documentElement.clientHeight, document.documentElement.scrollHeight, document.documentElement.offsetHeight);

    // Resize Handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);

        // Recalculate limit
        limit = Math.max(document.body.scrollHeight, document.body.offsetHeight,
            document.documentElement.clientHeight, document.documentElement.scrollHeight, document.documentElement.offsetHeight);
    });

    // Scroll Handler
    window.addEventListener('scroll', () => {
        scrollY = window.scrollY;
    });

    const clock = new THREE.Clock();

    // --- Animation Loop ---
    function animate() {
        requestAnimationFrame(animate);

        const time = clock.getElapsedTime();
        const scrollPercent = scrollY / (document.documentElement.scrollHeight - window.innerHeight);

        // 1. Tide Animation
        // Waves movement
        const positions = tidePlane.geometry.attributes.position;
        // Simple vertex wave (if segment count allows) - PlaneGeometry(100, 100, 40, 40) has enough verts
        // We'll skip complex vertex shader for simplicity and just rotate/move
        tidePlane.position.z = -10 + scrollPercent * 20; // Move closer then pass
        tidePlane.rotation.z = time * 0.05;

        // 2. Entropy Field
        // Particles rotate slowly, speed up with scroll
        entropyField.rotation.y = time * 0.05 + scrollPercent * 2;
        entropyField.rotation.x = scrollPercent * 1;

        // 3. Logos (The Order)
        // Comes into view in the middle section
        // Map scroll 0.3 - 0.7 to visibility/position
        if (scrollPercent > 0.15) {
            // Move from -20 z to 0 z (closer)
            // And y position from 0 to slightly up
            const targetZ = -20 + (scrollPercent - 0.15) * 40;
            logosMesh.position.z = THREE.MathUtils.lerp(logosMesh.position.z, targetZ, 0.1);
            logosMesh.rotation.x = time * 0.2;
            logosMesh.rotation.y = time * 0.3;
        } else {
            logosMesh.position.z = -50; // Hide
        }

        // 4. Growth Rings
        // Appear at the end (bottom of scroll)
        if (scrollPercent > 0.6) {
            // Rise from below
            const targetY = -20 + (scrollPercent - 0.6) * 60;
            ringsGroup.position.y = THREE.MathUtils.lerp(ringsGroup.position.y, targetY, 0.1);
            ringsGroup.rotation.z = time * 0.1;

            // Subtle pulse
            const scale = 1 + Math.sin(time) * 0.05;
            ringsGroup.scale.set(scale, scale, scale);
        } else {
            ringsGroup.position.y = -50;
        }

        // Camera gentle float
        camera.position.y = Math.sin(time * 0.5) * 0.5;

        renderer.render(scene, camera);
    }

    animate();
});
