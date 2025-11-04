import * as THREE from 'three';
import type Stats from 'stats-gl';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

import hdrPath  from './textures/moon_lab_4k.hdr';
import { createStopButton, removeStopButton } from '../ui/benchmarkControls';
import { exportToCSV } from '../utils/exportToCSV';

let scene: THREE.Scene;
let camera: THREE.Camera;
let renderer: THREE.WebGLRenderer;
let geometry: THREE.SphereGeometry;

const OBJECT_NUM = 10_000;
const WARMUP_TIME = 5_000;
const BENCHMARK_TIME = 15_000;

export async function initScene2Webgl(stats: Stats, onComplete: () => void): Promise<void> {
    const oldCanvas = document.getElementById('my-canvas');

    if (oldCanvas && oldCanvas.parentNode) {
        oldCanvas.parentNode.removeChild(oldCanvas);
    }

    const canvas = document.createElement('canvas');
    canvas.id = 'my-canvas';
    document.body.appendChild(canvas);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.set(0, 0, 4);

    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        stencil: false,
        depth: true,
        alpha: true,
        powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    await stats.init(renderer);

    const hdrLoader = new HDRLoader();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const hdrTexture = await hdrLoader.loadAsync(hdrPath);
    const envMap = pmrem.fromEquirectangular(hdrTexture).texture;

    scene.environment = envMap;
    scene.background = envMap;

    geometry = new THREE.SphereGeometry(0.75, 128, 128);

    const materials = [
        new THREE.MeshStandardMaterial({ metalness: 1.0, roughness: 0.05, color: 0xffffff }),
        new THREE.MeshStandardMaterial({ metalness: 0.8, roughness: 0.3, color: 0xccccff }),
        new THREE.MeshStandardMaterial({ metalness: 0.2, roughness: 0.8, color: 0xffccaa }),
    ];

    const spheres: THREE.Mesh[] = [];
    for (let i = 0; i < materials.length; i++) {
        const mesh = new THREE.Mesh(geometry, materials[i]);
        mesh.position.x = (i - 1) * 2;
        scene.add(mesh);
        spheres.push(mesh);
    }

    function animate() {
        requestAnimationFrame(animate);
        spheres.forEach((s, i) => (s.rotation.y += 0.01 + i * 0.002));
        renderer.render(scene, camera);
    }

    animate();

}