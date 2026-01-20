/* 
 * Refined 3D Scroll + Text Animation
 * Theme: "Flashy Universe" - High density stars, nebulas, dynamic movement
 */

// 1. Text Animation Logic
function initTextAnimation() {
    const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, observerOptions);

    const header = document.querySelector('.about-header');
    if (header) { header.classList.add('scroll-reveal'); observer.observe(header); }

    const contentBlocks = document.querySelectorAll('.about-content > *');
    contentBlocks.forEach((block, index) => {
        block.classList.add('scroll-reveal');
        block.style.transitionDelay = `${(index % 5) * 0.05}s`; // Faster stagger
        observer.observe(block);
    });
}

// 2. Three.js Universe Scene
function initAbout3D() {
    initTextAnimation();

    if (typeof THREE === 'undefined') {
        console.warn('Three.js not loaded yet, retrying in 100ms...');
        setTimeout(initAbout3D, 100);
        return;
    }

    const container = document.getElementById('three-canvas-container');
    if (!container) return;

    // Avoid double init
    if (container.querySelectorAll('canvas').length > 0) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020205, 0.001); // Very deep space black

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 50;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Dynamic Lights
    const ambientLight = new THREE.AmbientLight(0x404040, 1); // Soft white
    scene.add(ambientLight);

    const colors = [0x6366f1, 0xf43f5e, 0x10b981]; // Indigo, Rose, Emerald
    colors.forEach((col, i) => {
        const light = new THREE.PointLight(col, 2, 200);
        light.position.set(
            Math.sin(i * 2) * 50,
            Math.cos(i * 2) * 50,
            Math.sin(i * 3) * 50
        );
        scene.add(light);
    });

    // --- Universe Objects ---

    // 1. Star Field (High Density)
    const starGeo = new THREE.BufferGeometry();
    const starCount = 5000; // More stars!
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
        starPos[i * 3] = (Math.random() - 0.5) * 400; // Wide field
        starPos[i * 3 + 1] = (Math.random() - 0.5) * 400;
        starPos[i * 3 + 2] = (Math.random() - 0.5) * 400;

        // Random star colors (Blueish to reddish)
        const color = new THREE.Color();
        color.setHSL(Math.random(), 0.8, 0.8);
        starColors[i * 3] = color.r;
        starColors[i * 3 + 1] = color.g;
        starColors[i * 3 + 2] = color.b;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
    });
    const starSystem = new THREE.Points(starGeo, starMat);
    scene.add(starSystem);


    // 2. "Nebula" Clouds (using large soft particles)
    const cloudGeo = new THREE.BufferGeometry();
    const cloudCount = 50;
    const cloudPos = new Float32Array(cloudCount * 3);
    for (let i = 0; i < cloudCount; i++) {
        cloudPos[i * 3] = (Math.random() - 0.5) * 100;
        cloudPos[i * 3 + 1] = (Math.random() - 0.5) * 100;
        cloudPos[i * 3 + 2] = (Math.random() - 0.5) * 100 - 20; // Behind
    }
    cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3));
    const cloudMat = new THREE.PointsMaterial({
        size: 20,
        color: 0x4f46e5, // Indigo clouds
        transparent: true,
        opacity: 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const nebulaSystem = new THREE.Points(cloudGeo, cloudMat);
    scene.add(nebulaSystem);


    // 3. The Logos Orb (Enhanced)
    // Wireframe surrounding a core
    const outerGeo = new THREE.IcosahedronGeometry(10, 2);
    const outerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.1
    });
    const logosOuter = new THREE.Mesh(outerGeo, outerMat);
    logosOuter.position.set(30, 0, -20);
    scene.add(logosOuter);

    const innerGeo = new THREE.IcosahedronGeometry(4, 0);
    const innerMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x6366f1,
        emissiveIntensity: 1,
        roughness: 0,
        metalness: 1
    });
    const logosInner = new THREE.Mesh(innerGeo, innerMat);
    logosOuter.add(logosInner);

    // --- Animation State ---
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

        // Universe Rotation (Slow fly-through)
        starSystem.rotation.y = time * 0.03;
        starSystem.rotation.z = time * 0.01;

        // Nebula Pulse
        const scale = 1 + Math.sin(time * 0.5) * 0.1;
        nebulaSystem.scale.set(scale, scale, scale);
        nebulaSystem.rotation.y = -time * 0.02;

        // Camera Movement (Fly forward based on scroll)
        // Move camera Z from 50 down to 10
        const targetZ = 50 - scrollPercent * 40;
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.05);

        // Camera slight rotation for dynamic feel
        camera.rotation.z = Math.sin(time * 0.2) * 0.05;

        // Logos Orb Interaction
        logosOuter.rotation.x = time * 0.2;
        logosOuter.rotation.y = time * 0.3;
        // Bobbing
        logosOuter.position.y = Math.sin(time) * 2;

        renderer.render(scene, camera);
    }
    animate();
}

// 1. Try to init immediately (for soft navigation where DOM is ready)
initAbout3D();

// 2. Init on DOMContentLoaded (for hard refresh)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAbout3D);
}

// 3. Re-initialize on future soft navigations
window.addEventListener('pageReady', initAbout3D);
