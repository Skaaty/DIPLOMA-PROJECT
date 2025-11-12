import * as THREE from 'three';
import type Stats from 'stats-gl';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { EffectComposer, RenderPass, UnrealBloomPass, GLTFLoader, SMAAPass, SSRPass, Reflector } from 'three/examples/jsm/Addons.js';

import { exportToCSV, updateFrameStats } from '../utils/exportToCSV';
import hdrPath from '../assets/textures/bloem_olive_house_8k.hdr';
//import modelPath from '../assets/models/DamagedHelmet.glb';
import modelPath from '../assets/models/IridescenceSuzanne.glb';
import { createStopButton, removeStopButton, setupCanvas } from '../ui/benchmarkControls';


let scene: THREE.Scene;
let camera: THREE.Camera;
let renderer: THREE.WebGLRenderer;
let light: THREE.DirectionalLight;
let pointLight1: THREE.PointLight;
let pointLight2: THREE.PointLight;
let model: THREE.Group | null = null;

const WARMUP_TIME = 5_000;
const BENCHMARK_TIME = 10_000;
const USE_BLOOM = true;

export async function initScene2Webgl(stats: Stats, onComplete: () => void): Promise<void> {
    const canvas = setupCanvas();

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    const orbitRadius = 6;
    let orbitAngle = 0;

    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
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
    renderer.setPixelRatio(window.devicePixelRatio * 2.0);
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);

    await stats.init(renderer);

    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
        modelPath,
        (gltf) => {
            model = gltf.scene;
            model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                }
            });

            model.scale.set(1.0, 1.0, 1.0);
            scene.add(model);
        },
        undefined,
        (err) => console.error('An error occurred while loading the glTF model', err)
    );

    const hdrLoader = new HDRLoader();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const hdrTexture = await hdrLoader.loadAsync(hdrPath);
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    hdrTexture.colorSpace = THREE.LinearSRGBColorSpace;
    const envMap = pmrem.fromEquirectangular(hdrTexture).texture;
    scene.environment = envMap;
    scene.background = envMap;
    scene.environmentIntensity = 2.0;

    light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(10, 20, 10);
    light.castShadow = true;
    light.shadow.mapSize.set(4096, 4096);
    scene.add(light);

    pointLight1 = new THREE.PointLight(0xff8888, 30, 50);
    pointLight1.position.set(-10, 5, 5);
    pointLight1.castShadow = true;
    pointLight1.shadow.mapSize.set(2048, 2048); // 2K shadows
    scene.add(pointLight1);

    pointLight2 = new THREE.PointLight(0x8888ff, 30, 50);
    pointLight2.position.set(10, 5, -5);
    pointLight2.castShadow = true;
    pointLight2.shadow.mapSize.set(2048, 2048); // 2K shadows
    scene.add(pointLight2);

    scene.add(new THREE.AmbientLight(0x404040, 2.0));

    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMirror = new Reflector(groundGeo, {
        clipBias: 0.003,
        textureWidth: window.innerWidth * window.devicePixelRatio,
        textureHeight: window.innerHeight * window.devicePixelRatio,
        color: 0xffffff,
    });
    groundMirror.rotateX(-Math.PI / 2);
    groundMirror.position.y = -3.0;
    scene.add(groundMirror);

    let composer: EffectComposer | null = null;
    const bloom1 = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.1, 0.1, 0.2);
    const bloom2 = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.1, 0.2);
    const ssrPass = new SSRPass({
        renderer,
        scene,
        camera,
        width: innerWidth,
        height: innerHeight,
        selects: [],
        groundReflector: null,
    });

    if (USE_BLOOM) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(bloom1);
        composer.addPass(bloom2);
        //composer.addPass(new SSAOPass(scene, camera, window.innerWidth, window.innerHeight));
        composer.addPass(new SMAAPass());
        composer.addPass(new SSRPass(ssrPass));
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

        orbitAngle += delta * 0.4;
        const x = Math.sin(orbitAngle) * orbitRadius;
        const z = Math.cos(orbitAngle) * orbitRadius;
        camera.position.set(x, 1, z);
        camera.lookAt(0, 0, 0);

        light.position.set(Math.sin(orbitAngle) * 20, 20, Math.cos(orbitAngle) * 20); // light position for dynamic shadows

        if (composer) {
            composer.render();
        } else {
            renderer.render(scene, camera);
        }

        stats.end();
        stats.update();

        updateFrameStats(capturing, stats, lastLogCount, startTime, frameData);

    });
}


