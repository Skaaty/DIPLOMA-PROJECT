import type Stats from 'stats-gl';
import * as THREE from 'three';
import { MeshNormalNodeMaterial, WebGPURenderer } from 'three/webgpu';

import { createStopButton, removeStopButton } from '../ui/benchmarkControls';
import { exportToCSV, updateFrameStats } from '../utils/exportToCSV';

let scene: THREE.Scene;
let camera: THREE.Camera;
let renderer: WebGPURenderer;
let material: THREE.Material;
let geometries: THREE.BufferGeometry[];

const OBJECT_NUM = 5_000; 
const WARMUP_TIME = 5_000;
const BENCHMARK_TIME = 15_000;

export async function initScene1WebGPUNaive(stats: Stats, onComplete: () => void): Promise<void> {
    const oldCanvas = document.getElementById('my-canvas');

    if (oldCanvas && oldCanvas.parentNode) {
        oldCanvas.parentNode.removeChild(oldCanvas);
    }

    const canvas = document.createElement('canvas');
    canvas.id = 'my-canvas';
    document.body.appendChild(canvas);

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#000000');

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 17, 25);
    camera.lookAt(0, 0, 7);

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
    await renderer.init();

    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    await stats.init(renderer);
    
    geometries = [
        new THREE.ConeGeometry(0.1, 0.3, 40),
        new THREE.BoxGeometry(0.15, 0.15, 0.15, 2, 2, 1),
        new THREE.SphereGeometry(0.1, 10, 8),
    ];

    const userInput = document.getElementById('obj-count') as HTMLInputElement | null;
    const userNum = userInput ? parseInt(userInput.value) : NaN;
    const objNum = isNaN(userNum) ? OBJECT_NUM : userNum;

    material = new MeshNormalNodeMaterial();

    const majorRadius = 10;
    const minorRadius = 4;

    console.log(`Generating ${objNum} naive meshes...`);

    for (let i = 0; i < objNum; i++) {
        const geometry = geometries[i % geometries.length];
        const mesh = new THREE.Mesh(geometry, material);

        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * Math.PI * 2;

        const radialOffset = (Math.random() * 2 - 1) * 0.6;
        const effectiveMinorRadius = minorRadius * (1 + radialOffset * 0.5);

        const x = (majorRadius + effectiveMinorRadius * Math.cos(v)) * Math.cos(u);
        const y = effectiveMinorRadius * Math.sin(v);
        const z = (majorRadius + effectiveMinorRadius * Math.cos(v)) * Math.sin(u);

        mesh.position.set(x, y, z);

        const normal = new THREE.Vector3(x, y, z).normalize();
        mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            normal
        );

        scene.add(mesh);
    }
    console.log('Finished generating meshes.');


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
        console.info('Benchmark started (capturing Performance Data).');
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

        scene.rotation.y += delta * 0.1;


        await renderer.render(scene, camera);

        if (renderer instanceof WebGPURenderer) {
            await renderer.resolveTimestampsAsync(THREE.TimestampQuery.RENDER);
        }

        stats.end();
        stats.update();

        updateFrameStats(capturing, stats, lastLogCount, startTime, frameData);

    });
}
