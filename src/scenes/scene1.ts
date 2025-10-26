import type Stats from 'stats-gl';
import * as THREE from 'three';
import { MeshNormalNodeMaterial, WebGPURenderer } from 'three/webgpu';

import { createStopButton, removeStopButton } from '../ui/benchmarkControls';

function createMaterial(rendererType: string): THREE.Material {
    if (rendererType === 'webgl') {
        return new THREE.MeshNormalMaterial();
    } else {
        return new MeshNormalNodeMaterial();
    }
}

function initGeometries(): THREE.BufferGeometry[] {
    const geometries = [
        new THREE.ConeGeometry(0.06, 0.06, 40),
        new THREE.BoxGeometry(0.06, 0.06, 0.06, 2, 2, 1),
        new THREE.SphereGeometry(0.06, 8, 6),
    ];
    return geometries;
}

function initMeshes(
    scene: THREE.Scene,
    geometries: THREE.BufferGeometry[],
    objNum: number,
    rendererType: string
): void {
    const material = createMaterial(rendererType);

    const geometryCount = objNum;
    const vertexCount = geometries.length * 512;
    const indexCount = geometries.length * 1024;

    const majorRadius = 10;
    const minorRadius = 4;

    const batchedMesh = new THREE.BatchedMesh(
        geometryCount,
        vertexCount,
        indexCount,
        material
    ) as THREE.Object3D & {
        addGeometry: (geometry: THREE.BufferGeometry) => number;
        addInstance: (geometryId: number) => number;
        setMatrixAt: (instanceId: number, matrix: THREE.Matrix4) => void;
    };

    const geometryIds: number[] = geometries.map((geo) =>
        batchedMesh.addGeometry(geo)
    );

    for (let i = 0; i < objNum; i++) {
        const geometryId = geometryIds[i % geometries.length];
        const instanceId = batchedMesh.addInstance(geometryId);

        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * Math.PI * 2;

        const radialOffset = (Math.random() * 2 - 1) * 0.6;
        const effectiveMinorRadius = minorRadius * (1 + radialOffset * 0.5);

        const x = (majorRadius + effectiveMinorRadius * Math.cos(v)) * Math.cos(u);
        const y = effectiveMinorRadius * Math.sin(v);
        const z = (majorRadius + effectiveMinorRadius * Math.cos(v)) * Math.sin(u);

        const pos = new THREE.Vector3(x, y, z);

        const normal = new THREE.Vector3(x, y, z).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), // original "up" direction
            normal
        );

        const matrix = new THREE.Matrix4().compose(pos, quaternion, new THREE.Vector3(1, 1, 1));

        batchedMesh.setMatrixAt(instanceId, matrix);
    }

    batchedMesh.frustumCulled = false;
    scene.add(batchedMesh);
}

function setupCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 20, 25);
    camera.lookAt(0, 0, 5);
    return camera;
}

function setupScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d0c18');
    return scene;
}

async function setupRenderer(canvas: HTMLCanvasElement, rendererType: string) {
    if (rendererType === 'webgpu' && !navigator.gpu) {
        console.warn('WebGPU not supported. Falling back to WebGL.');
        rendererType = 'webgl';
    }

    console.info(`${rendererType.toUpperCase()} selected`);

    let renderer: THREE.WebGLRenderer | WebGPURenderer;

    if (rendererType === 'webgl') {
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            stencil: false,
            depth: false,
            alpha: false,
            powerPreference: 'high-performance',
        });
    } else {
        renderer = await createWebGPURenderer(canvas);
    }

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    console.log(renderer instanceof WebGPURenderer ? 'Using WebGPU' : 'Using WebGL');

    return renderer;
}

async function createWebGPURenderer(canvas: HTMLCanvasElement): Promise<WebGPURenderer> {
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) {
        throw new Error('Failed to get WebGPU context');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error('WebGPU adapter not available');
    }

    const device = await adapter.requestDevice();
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format,
        alphaMode: 'opaque',
    });

    return new WebGPURenderer({
        canvas,
        context,
        antialias: true,
        stencil: false,
        depth: false,
        alpha: true,
    })
}

const OBJECT_NUM = 10_000;
const WARMUP_TIME = 5_000;
const BENCHMARK_TIME = 30_000;

export async function loadScene1(
    rendererType: string,
    stats: Stats,
    //benchmarkData: number[],
    onComplete: () => void
): Promise<void> {
    const oldCanvas = document.getElementById('my-canvas');

    if (oldCanvas && oldCanvas.parentNode) {
        oldCanvas.parentNode.removeChild(oldCanvas);
    }

    const canvas = document.createElement('canvas');
    canvas.id = 'my-canvas';
    document.body.appendChild(canvas);

    const scene = setupScene();
    const camera = setupCamera();
    const renderer = await setupRenderer(canvas, rendererType);
    //benchmarkData = [];

    await stats.init(renderer);

    const geometries = initGeometries();
    const userInput = document.getElementById('obj-count') as HTMLInputElement | null;
    const userNum = userInput ? parseFloat(userInput.value) : NaN;
    const objNum = isNaN(userNum) ? OBJECT_NUM : userNum;

    initMeshes(scene, geometries, objNum, rendererType);

    const clock = new THREE.Clock();
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

    // Warmup phase for the benchmark
    console.info('Warming up for 5 seconds.');
    createStopButton(stopBenchmark);

    const frameData: {
        time: number,
        fps: number,
        cpu: number;
        gpu: number,
        cpuUsage: number,
        gpuUsage: number
    }[] = [];

    setTimeout(() => {
        capturing = true;
        startTime = performance.now();
        console.info('Benchmark started (Capturing Performance Data)');
    }, WARMUP_TIME);

    // Benchmark stopping after the capture
    setTimeout(async () => {
        if (stoppedManually) return;
        capturing = false;
        console.info('Benchmark finished.');

        await renderer.setAnimationLoop(null);
        removeStopButton();
        //scene.clear();
        //renderer.dispose();

        //if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        exportToCSV(frameData);

        onComplete();
    }, WARMUP_TIME + BENCHMARK_TIME);



    await renderer.setAnimationLoop(async () => {
        const delta = clock.getDelta();

        stats.begin();

        scene.traverse((object) => {
            if (object instanceof THREE.BatchedMesh) {
                object.rotation.y += delta * 0.5;
            }
        });

        await renderer.render(scene, camera);

        if (renderer instanceof WebGPURenderer) {
            await renderer.resolveTimestampsAsync(THREE.TimestampQuery.RENDER);
        }

        stats.end();
        stats.update();

        if (capturing) {
            const fps = stats.averageFps.logs.at(-1) ?? 0;
            const cpu = stats.averageCpu.logs.at(-1) ?? 0;
            const gpu = stats.averageGpu.logs.at(-1) ?? 0;

            const frameBudget = fps > 0 ? 1000 / fps : 16.67;
            const cpuUsage = Math.min((cpu / frameBudget) * 100, 100);
            const gpuUsage = Math.min((gpu / frameBudget) * 100, 100);

            frameData.push({
                time: performance.now() - startTime,
                fps,
                cpu,
                gpu,
                cpuUsage,
                gpuUsage
            });
        }
    });
}

function exportToCSV(data: {
    time: number,
    fps: number,
    cpu: number,
    gpu: number,
    cpuUsage: number,
    gpuUsage: number
}[]) {
    const headers = ['Time (ms)', 'FPS', 'CPU (ms)', 'GPU (ms)', 'CPU (%)', 'GPU (%)'];
    const rows = data.map(d => [
        d.time.toFixed(2),
        d.fps.toFixed(2),
        d.cpu.toFixed(2),
        d.gpu.toFixed(2),
        d.cpuUsage.toFixed(2),
        d.gpuUsage.toFixed(2)
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'statsgl_benchmark.csv';
    a.click();
}