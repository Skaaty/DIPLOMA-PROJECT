import type Stats from 'stats-gl';
import * as THREE from 'three';
import { MeshNormalNodeMaterial, WebGPURenderer } from 'three/webgpu';

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
    const boxRadius = 10;

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

        const angle = (i * Math.PI * 2) / objNum;
        const pos = new THREE.Vector3(
            Math.cos(angle) * boxRadius,
            Math.random() * 5.5 + 3,
            Math.sin(angle) * boxRadius
        );

        const matrix = new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z);
        batchedMesh.setMatrixAt(instanceId, matrix);
    }

    batchedMesh.frustumCulled = false;
    scene.add(batchedMesh);
}

function setupCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(1, 12, 14);
    camera.lookAt(0, 0, 0);
    return camera;
}

function setupScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d0c18');
    return scene;
}

function setupRenderer(canvas: HTMLCanvasElement, rendererType: string) {
    if (rendererType === 'webgpu' && !navigator.gpu) {
        console.warn('WebGPU not supported. Falling back to WebGL.');
        rendererType = 'webgl';
    }

    console.info(`${rendererType} selected`);

    let renderer: THREE.WebGLRenderer | WebGPURenderer;

    if (rendererType === 'webgl') {
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            stencil: true,
            depth: true,
            alpha: true,
        });
    } else {
        renderer = new WebGPURenderer({
            canvas,
            antialias: true,
            stencil: true,
            depth: true,
            alpha: true
        });
    }

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    console.log(renderer instanceof WebGPURenderer ? 'Using WebGPU' : 'Using WebGPU');

    return renderer;
}

const OBJECT_NUM = 10_000;
const WARMUP_TIME = 5_000;
const BENCHMARK_TIME = 30_000;

export function loadScene1(
    rendererType: string,
    stats: Stats,
    benchmarkData: number[],
    onComplete: () => void
): void {
    const oldCanvas = document.getElementById('my-canvas');
    if (oldCanvas && oldCanvas.parentNode) {
        oldCanvas.parentNode.removeChild(oldCanvas);
    }

    const canvas = document.createElement('canvas');
    canvas.id = 'my-canvas';
    document.body.appendChild(canvas);

    const scene = setupScene();
    const camera = setupCamera();
    const renderer = setupRenderer(canvas, rendererType);
    stats.init(renderer);
    const geometries = initGeometries();
    const userInput = document.getElementById('obj-count') as HTMLInputElement | null;
    const userNum = userInput ? parseFloat(userInput.value) : NaN;
    const objNum = isNaN(userNum) ? OBJECT_NUM : userNum;

    initMeshes(scene, geometries, objNum, rendererType);

    const clock = new THREE.Clock();
    let capturing = false;
    let startTime = 0;

    // Warmup phase for the benchmark
    console.info('Warming up for 5 seconds.');
    setTimeout(() => {
        capturing = true;
        startTime = performance.now();
        console.info('Benchmark started (Capturing Performance Data)');
                
    }, WARMUP_TIME);

    // Benchmark stopping after the capture
    setTimeout(() => {
        capturing = false;
        console.info('Benchmark finished.');

        renderer.setAnimationLoop(null);
        //scene.clear();
        //renderer.dispose();

        //if (canvas.parentNode) canvas.parentNode.removeChild(canvas);

        onComplete();
    }, WARMUP_TIME + BENCHMARK_TIME);

    renderer.setAnimationLoop(async () => {
        const delta = clock.getDelta();

        stats.begin();

        scene.traverse((object) => {
            if (object instanceof THREE.BatchedMesh) {
                object.rotation.y += delta * 0.5;
            }
        });

        renderer.render(scene, camera);

        if (renderer instanceof WebGPURenderer) {
            await renderer.resolveTimestampsAsync(THREE.TimestampQuery.RENDER);
        }

        stats.end();
        stats.update();

        if (capturing) {
            const fps = 1 / delta;
            benchmarkData.push(fps);
        }
    });
}