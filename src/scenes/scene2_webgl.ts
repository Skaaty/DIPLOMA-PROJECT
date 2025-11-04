import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

import { createStopButton, removeStopButton } from '../ui/benchmarkControls';
import { exportToCSV } from '../utils/exportToCSV';

let scene: THREE.Scene;
let camera: THREE.Camera;
let renderer: THREE.WebGLRenderer;
let material: THREE.Material;
let geometries: THREE.BufferGeometry[];