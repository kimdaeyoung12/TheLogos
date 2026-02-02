// Lorenz Attractor Script for The Logos Homepage
// Based on Three.js examples

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('lorenz-container');
    if (!container) return;

    // Remove any existing canvas
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Setup Scene
    const scene = new THREE.Scene();
    // Assuming dark mode default or transparent
    // scene.background = new THREE.Color(0x000000); // Let CSS handle background

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.x = 20; // Adjusted for better view
    camera.position.y = 10;
    camera.position.z = 40;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lorenz Attractor Logic
    const x0 = 0.1, y0 = 0.1, z0 = 0.1;
    const sigma = 10.0;
    const rho = 28.0;
    const beta = 8.0 / 3.0;
    const dt = 0.01;
    const maxPoints = 5000; // Limit points for performance

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    let x = x0, y = y0, z = z0;
    let count = 0;

    // Pre-calculate path
    for (let i = 0; i < maxPoints; i++) {
        const dx = sigma * (y - x) * dt;
        const dy = (x * (rho - z) - y) * dt;
        const dz = (x * y - beta * z) * dt;

        x += dx;
        y += dy;
        z += dz;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
    }

    // Color gradient based on vertex index
    const colors = new Float32Array(maxPoints * 3);
    const color = new THREE.Color();

    // Logos Theme Colors (Blue/Purple/White)
    const color1 = new THREE.Color("#135bec"); // design-primary
    const color2 = new THREE.Color("#ffffff");

    for (let i = 0; i < maxPoints; i++) {
        const t = i / maxPoints;
        color.lerpColors(color1, color2, t);

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));


    const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        linewidth: 2 // Note: WebGL linewidth is usually 1 on Windows
    });

    const line = new THREE.Line(geometry, material);
    scene.add(line);

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);

        // Slowly rotate the attractor
        line.rotation.y += 0.002;
        line.rotation.z += 0.001;

        renderer.render(scene, camera);
    }

    animate();

    // Resize Handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});
