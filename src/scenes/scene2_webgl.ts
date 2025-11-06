import * as THREE from 'three';
import type Stats from 'stats-gl';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { EffectComposer, RenderPass, UnrealBloomPass } from 'three/examples/jsm/Addons.js';

import { exportToCSV, updateFrameStats } from '../utils/exportToCSV';
import hdrPath from '../assets/textures/moon_lab_8k.hdr';
import { createStopButton, removeStopButton, setupCanvas } from '../ui/benchmarkControls';


let scene: THREE.Scene;
let camera: THREE.Camera;
let renderer: THREE.WebGLRenderer;
let geometry: THREE.SphereGeometry;
let light: THREE.DirectionalLight;

const WARMUP_TIME = 5_000;
const BENCHMARK_TIME = 10_000;
const USE_BLOOM = true;

export async function initScene2Webgl(stats: Stats, onComplete: () => void): Promise<void> {
    const canvas = setupCanvas();

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200)
    camera.position.set(0, 0, 4);
    const orbitRadius = 5;
    let orbitAngle = 0;

    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        stencil: false,
        depth: true,
        alpha: true,
        powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(1.0);
    document.body.appendChild(renderer.domElement);

    await stats.init(renderer);

    const hdrLoader = new HDRLoader();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const hdrTexture = await hdrLoader.loadAsync(hdrPath);
    const envMap = pmrem.fromEquirectangular(hdrTexture).texture;
    scene.environment = envMap;
    scene.background = envMap;

    light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(10, 20, 10);
    light.castShadow = true;
    light.shadow.mapSize.set(4096, 4096);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040, 1.5));

    geometry = new THREE.SphereGeometry(0.75, 128, 128);

    const materials = [
        new THREE.MeshStandardMaterial({ metalness: 1.0, roughness: 0.05, color: 0xffffff }),
        new THREE.MeshStandardMaterial({ metalness: 1.0, roughness: 0.05, color: 0xffffff }),
        new THREE.MeshStandardMaterial({ metalness: 1.0, roughness: 0.05, color: 0xffffff }),
        //new THREE.MeshStandardMaterial({ metalness: 0.8, roughness: 0.3, color: 0xccccff }),
        //new THREE.MeshStandardMaterial({ metalness: 0.2, roughness: 0.8, color: 0xffccaa }),
    ];

    const spheres: THREE.Mesh[] = [];
    // for (let i = 0; i < materials.length; i++) {
    //     const mesh = new THREE.Mesh(geometry, materials[i]);
    //     mesh.position.x = (i - 1) * 2;
    //     scene.add(mesh);
    //     spheres.push(mesh);
    // }

    function populateScene(count: number) {
        // Clear existing
        for (const s of spheres) scene.remove(s);
        spheres.length = 0;

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(geometry, createHeavyMaterial());
            mesh.position.set(
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 50
            );
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            spheres.push(mesh);
        }
    }

    populateScene(100);

    let composer: EffectComposer | null = null;
    if (USE_BLOOM) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(
            new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.1,
                0.2,
                0.1
            )
        );
    }

    const clock = new THREE.Clock();
    const lastLogCount = 0;
    let capturing = false;
    let startTime = 0;
    let stoppedManually = false;

    function stopBenchmark() {
        stoppedManually = true;
        capturing = false;
        console.info('Benchmark stopped manually.');

        renderer.setAnimationLoop(null);
        removeStopButton();
        onComplete();
    }

    console.info('Warming up for 5 seconds.');
    createStopButton(stopBenchmark);

    const frameData: {
        time: number,
        fps: number,
        cpu: number,
        gpu: number,
    }[] = [];

    setTimeout(() => {
        capturing = true;
        startTime = performance.now();
        console.info('Benchmark started (capturing Performance Data.');
    }, WARMUP_TIME);

    setTimeout(() => {
        if (stoppedManually) return;
        capturing = false;
        console.info('Benchmark finished.');

        renderer.setAnimationLoop(null);
        removeStopButton();

        exportToCSV(frameData);

        onComplete();
    }, WARMUP_TIME + BENCHMARK_TIME);

    renderer.setAnimationLoop(() => {
        const delta = clock.getDelta();

        stats.begin()

        orbitAngle += delta * 0.3;
        const x = Math.sin(orbitAngle) * orbitRadius;
        const z = Math.cos(orbitAngle) * orbitRadius;
        camera.position.set(x, 1.5, z);
        camera.lookAt(0, 0.5, 0);

        light.position.set(Math.sin(orbitAngle) * 20, 20, Math.cos(orbitAngle) * 20); // light position for dynamic shadows

        for (const s of spheres) s.rotation.y += delta * 0.5; // sphere rotation

        if (composer) {
            composer.render();
        } else {
            renderer.render(scene, camera);
        }

        stats.end();
        stats.update();

        updateFrameStats(capturing, stats, lastLogCount, startTime, frameData);

    });

    function createHeavyMaterial(): THREE.MeshStandardMaterial {
        const mat = new THREE.MeshStandardMaterial({
            metalness: Math.random(),
            roughness: Math.random(),
            color: new THREE.Color(Math.random(), Math.random(), Math.random()),
        });

        mat.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `
                for (int i = 0; i < 64; i++) {
                    vec3 tmp = normalize(vec3(
                    sin(gl_FragCoord.x * 0.05 + float(i)),
                    cos(gl_FragCoord.y * 0.05 - float(i)),
                    0.5
                    ));
                    gl_FragColor.rgb += tmp * 0.002;
                }
                #include <dithering_fragment>
            `
            );
        };

        return mat;
    }
}


