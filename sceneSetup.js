// sceneSetup.js
import * as THREE from 'three';

export function setupScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020d1a);
    // Linear fog: (color, near distance, far distance)
    scene.fog = new THREE.Fog(0x020d1a, 40, 500);

    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 80;
    
    const camera = new THREE.OrthographicCamera(
        (frustumSize * aspect) / -2, 
        (frustumSize * aspect) / 2, 
        frustumSize / 2, 
        frustumSize / -2, 
        0.1, 
        2000
    );

    camera.position.set(50, 60, 50);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // Ensure canvas stretches to cover 100% width and height without layout gaps
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x88aacc, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(100, 200, 100);
    scene.add(sunLight);

    window.addEventListener('resize', () => {
        const newAspect = window.innerWidth / window.innerHeight;
        camera.left = (frustumSize * newAspect) / -2;
        camera.right = (frustumSize * newAspect) / 2;
        camera.top = frustumSize / 2;
        camera.bottom = frustumSize / -2;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, camera, renderer, sunLight, ambientLight };
}