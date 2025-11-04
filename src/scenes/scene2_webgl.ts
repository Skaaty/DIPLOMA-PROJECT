import * as THREE from 'three';
import type Stats from 'stats-gl';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

import { createStopButton, removeStopButton } from '../ui/benchmarkControls';
import { exportToCSV } from '../utils/exportToCSV';

let scene: THREE.Scene;
let camera: THREE.Camera;
let renderer: THREE.WebGLRenderer;
let material: THREE.Material;
let geometries: THREE.BufferGeometry[];

export async function initScene2Webgl(stats: Stats, onComplete: () => void): Promise<void> {
    const oldCanvas = document.getElementById('my-canvas');

    if (oldCanvas && oldCanvas.parentNode) {
        oldCanvas.parentNode.removeChild(oldCanvas);
    }

    const canvas = document.createElement('canvas');
    canvas.id = 'my-canvas';
    document.body.appendChild(canvas);

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#000000')

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.set(0, 0, 4);

    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        stencil: false,
        depth: true,
        alpha: true,
        powerPreference: 'high-performance',
    })

    const hdrLoader = new HDRLoader();
    const pmrem = new THREE.PMREMGenerator(renderer);

}