/* 
 * Refined 3D Scroll Animation
 * Theme: Sophisticated, Abstract, Glassy
 */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof THREE === 'undefined') return;

    const container = document.getElementById('three-canvas-container');
    if (!container) return;

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1e293b, 0.002); // Darker blue fog

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 25;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    // --- Lights ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(10, 20, 20);
    scene.add(dirLight);

    const blueSpot = new THREE.PointLight(0x60a5fa, 2, 50);
    blueSpot.position.set(-10, 5, 10);
    scene.add(blueSpot);

    // --- Materials (Refined/Glassy) ---
    // Glass/Crystal Material
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.9, // Glass effect
        transparent: true,
        thickness: 0.5,
    });

    // Abstract Matte Material
    const matteMaterial = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0, // Slate 200
        roughness: 0.4,
        metalness: 0.6,
    });

    // --- Objects ---

    // 1. The Tide (Smooth wave mesh instead of wireframe)
    // Using a Point cloud for a more abstract "stardust" wave
    const tideGeometry = new THREE.PlaneGeometry(120, 120, 60, 60);
    const tideMaterial = new THREE.PointsMaterial({
        color: 0x94a3b8,
        size: 0.15,
        transparent: true,
        opacity: 0.6
    });
    const tideMesh = new THREE.Points(tideGeometry, tideMaterial);
    tideMesh.rotation.x = -Math.PI / 2.5;
    tideMesh.position.y = -15;
    tideMesh.position.z = -10;
    scene.add(tideMesh);


    // 2. The Logos (Glass Polyhedron)
    // A complex but smooth shape (Dodecahedron)
    const logosGeometry = new THREE.DodecahedronGeometry(5, 0); // Faceted
    const logosMesh = new THREE.Mesh(logosGeometry, glassMaterial);
    logosMesh.position.set(12, 0, -10); // Offset to right, not center, so it doesn't block text
    scene.add(logosMesh);

    // Inner core for visibility
    const coreGeometry = new THREE.IcosahedronGeometry(2, 0);
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x60a5fa,
        emissive: 0x1d4ed8,
        emissiveIntensity: 0.5,
        wireframe: true
    });
    const coreMesh = new THREE.Mesh(coreGeometry, coreMat);
    logosMesh.add(coreMesh);


    // 3. Entropy (Subtle Dust)
    const particlesGeo = new THREE.BufferGeometry();
    const pCount = 800;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) {
        pPos[i] = (Math.random() - 0.5) * 100;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const dustMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.1,
        transparent: true,
        opacity: 0.4
    });
    const dustSystem = new THREE.Points(particlesGeo, dustMat);
    scene.add(dustSystem);


    // 4. Time/Growth (Golden Spiral)
    // Abstract curve
    const spiralPoints = [];
    for (let i = 0; i < 100; i++) {
        const t = i * 0.5;
        const x = t * Math.cos(t) * 0.2;
        const y = t * Math.sin(t) * 0.2;
        const z = -i * 0.5;
        spiralPoints.push(new THREE.Vector3(x, y, z));
    }
    const spiralGeo = new THREE.BufferGeometry().setFromPoints(spiralPoints);
    const spiralMat = new THREE.LineBasicMaterial({ color: 0xfcd34d, transparent: true, opacity: 0.5 });
    const spiralMesh = new THREE.Line(spiralGeo, spiralMat);
    spiralMesh.position.set(-10, -10, -10);
    spiralMesh.rotation.x = Math.PI / 2;
    scene.add(spiralMesh);


    // --- Animation State ---
    let scrollY = 0;

    window.addEventListener('scroll', () => { scrollY = window.scrollY; });
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = scrollY / (maxScroll || 1);

        // 1. Tide: Gentle waving
        const positions = tideGeometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            // Very simple wave effect on z-axis of the plane
            // x is pos[i], y is pos[i+1]
            const x = positions[i];
            const y = positions[i + 1];
            // Initial Z is 0 (plane geometry)
            // We want to perturb it based on time and position
            // We can't easily modify buffer geometry per frame performantly without marking needsUpdate
            // So let's just rotate the whole mesh
        }
        // Rotate/sway tide
        tideMesh.rotation.z = Math.sin(time * 0.1) * 0.1;
        tideMesh.position.y = -15 + scrollPercent * 10; // Rises slightly

        // 2. Logos (Glass shape)
        // Moves from right to left as you scroll
        // Target position: Start (12, 0, -10), End (12, 10, -30) or Cross over?
        // Let's keep it on the side to be "sophisticated" and not block text
        const targetLogosY = -5 + scrollPercent * 20;
        logosMesh.position.y = THREE.MathUtils.lerp(logosMesh.position.y, targetLogosY, 0.05);

        // Gentle rotation
        logosMesh.rotation.x = time * 0.2;
        logosMesh.rotation.y = time * 0.1 + scrollPercent * Math.PI;

        // 3. Dust
        dustSystem.rotation.y = time * 0.05;

        // 4. Spiral (Growth)
        // Comes up at the end
        if (scrollPercent > 0.7) {
            spiralMesh.position.y = THREE.MathUtils.lerp(spiralMesh.position.y, 0, 0.05);
            spiralMesh.rotation.z = time * 0.2;
        } else {
            spiralMesh.position.y = -50;
        }

        renderer.render(scene, camera);
    }
    animate();
});
