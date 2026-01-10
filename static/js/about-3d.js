/* 
 * Refined 3D Scroll + Text Animation
 */

document.addEventListener('DOMContentLoaded', () => {

    // 1. Text Animation Logic (Intersection Observer)
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // observer.unobserve(entry.target); // Keep observing for re-entry? Or once? User wants motion. Let's keep it once for cleaner UI.
            }
        });
    }, observerOptions);

    // Apply classes to content elements
    const header = document.querySelector('.about-header');
    if (header) {
        header.classList.add('scroll-reveal');
        observer.observe(header);
    }

    const contentBlocks = document.querySelectorAll('.about-content > *');
    contentBlocks.forEach((block, index) => {
        block.classList.add('scroll-reveal');
        // Add staggered delay via inline style if needed, or just let scroll handle it
        block.style.transitionDelay = `${(index % 3) * 0.1}s`;
        observer.observe(block);
    });


    // 2. Three.js Scene (Refined for Peripheral/Background usage)
    if (typeof THREE === 'undefined') return;

    const container = document.getElementById('three-canvas-container');
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0f172a, 0.003); // Match bg

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pLight = new THREE.PointLight(0x60a5fa, 2, 50);
    pLight.position.set(15, 15, 15);
    scene.add(pLight);


    // --- Objects (Pushed to sides) ---

    // 1. Background Particles (Entropy)
    const pGeo = new THREE.BufferGeometry();
    const pCount = 1500;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) {
        pPos[i] = (Math.random() - 0.5) * 150; // Spread wide
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
        color: 0x94a3b8,
        size: 0.1,
        transparent: true,
        opacity: 0.3
    });
    const starField = new THREE.Points(pGeo, pMat);
    scene.add(starField);

    // 2. Logos Orb (Right Side)
    // Glass Sphere
    const orbGeo = new THREE.IcosahedronGeometry(8, 2);
    const orbMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0,
        metalness: 0.1,
        transmission: 0.95,
        transparent: true,
    });
    const logosOrb = new THREE.Mesh(orbGeo, orbMat);
    logosOrb.position.set(25, 0, -10); // Far right
    scene.add(logosOrb);

    // Floating inner core
    const coreGeo = new THREE.OctahedronGeometry(3, 0);
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        wireframe: true,
        emissive: 0x1d4ed8
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    logosOrb.add(coreMesh);


    // 3. Tide / Floor (Bottom)
    const gridHelper = new THREE.GridHelper(200, 50, 0x1e293b, 0x1e293b);
    gridHelper.position.y = -20;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.2;
    scene.add(gridHelper);


    // --- Animation Loop ---
    let scrollY = 0;
    window.addEventListener('scroll', () => scrollY = window.scrollY);

    // Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();
        const scrollPercent = scrollY / (document.documentElement.scrollHeight - window.innerHeight);

        // Slow rotation for background
        starField.rotation.y = time * 0.02;

        // Orb Logic
        // Stays on right, gently bobs
        logosOrb.rotation.y = time * 0.1;
        logosOrb.rotation.z = time * 0.05;
        logosOrb.position.y = Math.sin(time * 0.5) * 2 + (scrollPercent * 10 - 5);

        // As you scroll down, maybe orb moves closer?
        // Let's keep it subtle as requested

        // Grid floor moves
        gridHelper.position.z = (time * 2) % 10;

        renderer.render(scene, camera);
    }
    animate();

});
