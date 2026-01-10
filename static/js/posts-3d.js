/* Posts Page 3D Experience: "The Planetary Archive" */

document.addEventListener('DOMContentLoaded', () => {

    // Check if Three.js is loaded
    if (typeof THREE === 'undefined') return;

    const container = document.getElementById('three-canvas-container');
    if (!container) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    // No fog for this one, we want clear views of planets

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Initial Position: Far back, looking at center
    camera.position.set(0, 0, 60);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xffffff, 2, 500);
    sunLight.position.set(50, 50, 50);
    scene.add(sunLight);

    // Secondary colored lights for drama
    const blueLight = new THREE.PointLight(0x3b82f6, 3, 100);
    blueLight.position.set(-30, -20, 20);
    scene.add(blueLight);

    // --- Planets ---
    const planets = {};
    const group = new THREE.Group();
    scene.add(group);

    // 1. Religion (Radiant Sun/Gold)
    // Position: Top Right
    const religionGeo = new THREE.IcosahedronGeometry(7, 4); // High detail sphere
    const religionMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b, // Amber
        emissive: 0xd97706,
        emissiveIntensity: 0.8,
        wireframe: false
    });
    const religionPlanet = new THREE.Mesh(religionGeo, religionMat);
    religionPlanet.position.set(20, 15, -10);
    group.add(religionPlanet);
    planets['religion'] = { mesh: religionPlanet, camPos: { x: 20, y: 15, z: 15 } };

    // 2. Philosophy (Deep Water/Earth)
    // Position: Bottom Left
    const philoGeo = new THREE.IcosahedronGeometry(8, 2);
    const philoMat = new THREE.MeshStandardMaterial({
        color: 0x3b82f6, // Blue
        roughness: 0.1,
        metalness: 0.3,
        flatShading: true // Low poly look for structure
    });
    const philoPlanet = new THREE.Mesh(philoGeo, philoMat);
    philoPlanet.position.set(-25, -10, -5);
    group.add(philoPlanet);
    planets['philosophy'] = { mesh: philoPlanet, camPos: { x: -25, y: -10, z: 20 } };

    // 3. Engineering (Metallic/Structure)
    // Position: Top Left
    const engGeo = new THREE.DodecahedronGeometry(6); // Geometric
    const engMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8, // Slate
        roughness: 0.2,
        metalness: 0.9, // Metallic
        wireframe: true
    });
    // Add inner solid for visibility
    const engInnerGeo = new THREE.DodecahedronGeometry(5.8);
    const engInnerMat = new THREE.MeshBasicMaterial({ color: 0x0f172a }); // Dark core
    const engCore = new THREE.Mesh(engInnerGeo, engInnerMat);

    const engPlanet = new THREE.Mesh(engGeo, engMat);
    engPlanet.add(engCore);
    engPlanet.position.set(-15, 20, -15);
    group.add(engPlanet);
    planets['engineering'] = { mesh: engPlanet, camPos: { x: -15, y: 20, z: 10 } };

    // 4. Writing (Paper/Textured)
    // Position: Bottom Right
    const writeGeo = new THREE.SphereGeometry(6, 32, 32);
    const writeMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc, // Paper white
        roughness: 0.9,
        metalness: 0.0
    });
    const writePlanet = new THREE.Mesh(writeGeo, writeMat);
    writePlanet.position.set(25, -15, -10);
    group.add(writePlanet);
    planets['writing'] = { mesh: writePlanet, camPos: { x: 25, y: -15, z: 15 } };


    // Stars (Background)
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        starPos[i * 3] = (Math.random() - 0.5) * 300;
        starPos[i * 3 + 1] = (Math.random() - 0.5) * 300;
        starPos[i * 3 + 2] = (Math.random() - 0.5) * 300 - 50;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ size: 0.5, color: 0xffffff, transparent: true, opacity: 0.6 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);


    // --- Interaction Logic ---
    let targetCameraPos = new THREE.Vector3(0, 0, 60);
    let targetLookAt = new THREE.Vector3(0, 0, 0);

    window.addEventListener('category-changed', (e) => {
        const cat = e.detail.category;
        console.log("Flying to Planet:", cat);

        if (cat === 'all' || !planets[cat]) {
            // Zoom out to see all
            targetCameraPos.set(0, 0, 60);
            targetLookAt.set(0, 0, 0);
        } else {
            // Fly to planet
            const p = planets[cat];
            targetCameraPos.set(p.camPos.x, p.camPos.y, p.camPos.z);
            targetLookAt.copy(p.mesh.position);
        }
    });


    // --- Animation Loop ---
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();

        // 1. Rotate Planets
        religionPlanet.rotation.y = time * 0.2;
        philoPlanet.rotation.y = -time * 0.15;
        engPlanet.rotation.x = time * 0.1;
        engPlanet.rotation.y = time * 0.1;
        writePlanet.rotation.y = time * 0.1;

        // 2. Slow Orbit of entire system (very subtle)
        group.rotation.z = Math.sin(time * 0.05) * 0.05;

        // 3. Camera Interpolation (Smooth Fly)
        camera.position.lerp(targetCameraPos, 0.03); // Smooth damping

        // Custom lookAt interpolation
        const currentLook = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
        currentLook.lerp(targetLookAt, 0.03);
        camera.lookAt(currentLook);

        renderer.render(scene, camera);
    }
    animate();

    // Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});
