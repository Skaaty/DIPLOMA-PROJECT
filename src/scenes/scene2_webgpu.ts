import * as THREE from 'three';
import type Stats from 'stats-gl';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { pass } from 'three/tsl';
import { WebGPURenderer, PostProcessing } from 'three/webgpu';

import { exportToCSV, updateFrameStats } from '../utils/exportToCSV';
import hdrPath from '../assets/textures/moon_lab_8k.hdr';
import { createStopButton, removeStopButton, setupCanvas } from '../ui/benchmarkControls';

let scene: THREE.Scene;
let camera: THREE.Camera;
let renderer: WebGPURenderer;
let geometry: THREE.SphereGeometry;
let light: THREE.DirectionalLight;

const WARMUP_TIME = 5_000;
const BENCHMARK_TIME = 10_000;
const USE_BLOOM = true;

export async function initScene2Webgpu(stats: Stats, onComplete: () => void): Promise<void> {
    const canvas = setupCanvas();

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200)
    camera.position.set(0, 0, 4);
    const orbitRadius = 5;
    let orbitAngle = 0;

    if (!navigator.gpu) {
        console.warn('WebGPU not supported.');
    }

    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) {
        throw new Error('Failed to get WebGPU context');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error('WebGPU adapter not available.');
    }

    const device = await adapter.requestDevice();
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format,
        alphaMode: 'opaque',
    });

    renderer = new WebGPURenderer({
        canvas,
        antialias: true,
        stencil: false,
        depth: true,
        alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(1.0);
    document.body.appendChild(renderer.domElement);

    await renderer.init();

    await stats.init(renderer);

    const hdrLoader = new HDRLoader();
    //const pmrem = new THREE.PMREMGenerator(renderer as any);
    const hdrTexture = await hdrLoader.loadAsync(hdrPath);
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = hdrTexture;
    scene.background = hdrTexture;

    light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(10, 20, 10);
    light.castShadow = true;
    light.shadow.mapSize.set(4096, 4096);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040, 1.5));

    geometry = new THREE.SphereGeometry(0.75, 128, 128);

    const spheres: THREE.Mesh[] = [];

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

    let postProcessing: PostProcessing | null = null;

    if (USE_BLOOM) {
        const post = new PostProcessing(renderer);
        const scenePass = pass(scene, camera);
        const sceneColor = scenePass.getTextureNode('output');
        const bloomPass = bloom(sceneColor, 0.1, 0.2, 0.1);

        post.outputNode = sceneColor.add(bloomPass);
        postProcessing = post;
    }

    const clock = new THREE.Clock();
    const lastLogCount = 0;
    let capturing = false;
    let startTime = 0;
    let stoppedManually = false;

    async function stopBenchmark() {
        stoppedManually = true;
        capturing = false;
        console.info('Benchmark stopped manually.');

        await renderer.setAnimationLoop(null);
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

    setTimeout(async () => {
        if (stoppedManually) return;
        capturing = false;
        console.info('Benchmark finished.');

        await renderer.setAnimationLoop(null);
        removeStopButton();

        exportToCSV(frameData);

        onComplete();
    }, WARMUP_TIME + BENCHMARK_TIME);

    await renderer.setAnimationLoop(async () => {
        const delta = clock.getDelta();
        stats.begin();

        orbitAngle += delta * 0.3;
        const x = Math.sin(orbitAngle) * orbitRadius;
        const z = Math.cos(orbitAngle) * orbitRadius;
        camera.position.set(x, 1.5, z);
        camera.lookAt(0, 0.5, 0);

        light.position.set(Math.sin(orbitAngle) * 20, 20, Math.cos(orbitAngle) * 20);

        for (const s of spheres) s.rotation.y += delta * 0.5;

        if (postProcessing) postProcessing.render();
        else await renderer.render(scene, camera);

        if (renderer instanceof WebGPURenderer) {
            await renderer.resolveTimestampsAsync(THREE.TimestampQuery.RENDER);
        }

        stats.end();
        stats.update();

        updateFrameStats(capturing, stats, 0, startTime, frameData);
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
                for (var i: i32 = 0; i < 64; i = i + 1) {
                let tmp = normalize(vec3f(
                    sin(in.position.x * 0.05f + f32(i)),
                    cos(in.position.y * 0.05f - f32(i)),
                    0.5f
                ));
                fragmentColor.rgb += tmp * 0.002f;
            }
            #include <dithering_fragment>`
            );
        };

        return mat
    }
}

