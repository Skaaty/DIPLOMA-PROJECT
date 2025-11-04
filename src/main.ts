import './style.css';
import Stats from 'stats-gl';

import { initScene1Webgl } from './scenes/scene1_webgl';
import { initScene1Webgpu } from './scenes/scene1_webgpu';
import { initScene1WebGLNaive } from './scenes/scene1_webgl_naive';
import { initScene1WebGPUNaive } from './scenes/scene1_webgpu_naive';
import { resizeInput } from './ui/resizeInput';

<<<<<<< HEAD
type ApiType = 'webgl' | 'webgpu' | string;
type BenchmarkType = 'scene1' | 'scene2' | 'scene3';

const apiSelector = document.getElementById('api-selector') as HTMLSelectElement;
const sceneSelector = document.getElementById('scene-selector') as HTMLSelectElement;
const confirmButton = document.getElementById('confirm-button') as HTMLButtonElement;
=======
const sceneSelector = document.getElementById('scene-selector') as HTMLSelectElement;
const confirmButton = document.getElementById('confirm-button') as HTMLButtonElement;

>>>>>>> dev
const input = document.querySelector('input') as HTMLInputElement;
input?.addEventListener('input', resizeInput);
resizeInput.call(input);

let benchmarkRunning = false;

confirmButton?.addEventListener('click', async () => {
  if (benchmarkRunning) {
    console.warn('A benchmark is already running.');
    return;
  }

<<<<<<< HEAD
  const selectedScene = sceneSelector.value as BenchmarkType;
  const selectedApi = apiSelector.value as ApiType;

  if (!selectedScene || !selectedApi) {
=======
  const selectedScene = sceneSelector.value as string;
  
  if (!selectedScene) {
>>>>>>> dev
    console.warn("No scene or API selected.");
    return;
  }

  benchmarkRunning = true;
  confirmButton.disabled = true;
  confirmButton.textContent = 'Running...';

  const stats = new Stats({
    trackGPU: true,
    graphsPerSecond: 60,
    logsPerSecond: 20,
    samplesLog: 400,
    samplesGraph: 50,
    precision: 3,
    horizontal: true,
    minimal: false,
  });
  document.body.appendChild(stats.dom);
  stats.dom.style.position = 'fixed';
  stats.dom.style.top = '10px';
  stats.dom.style.left = '80%';

  const onBenchmarkComplete = () => {
    benchmarkRunning = false;
    confirmButton.disabled = false;
    confirmButton.textContent = 'Start Benchmark';
    console.info('Benchmark completed and ready for another run.');
  }

  switch (selectedScene) {
    case 'scene1':
      await initScene1Webgpu(stats, onBenchmarkComplete);
      break;
    case 'scene2':
      await initScene1Webgl(stats, onBenchmarkComplete);
      break;
    case 'scene3':
      await initScene1WebGLNaive(stats, onBenchmarkComplete);
      break;
    case 'scene4':
      await initScene1WebGPUNaive(stats, onBenchmarkComplete);
      break;
    default:
      console.warn('Nothing was selected');
      benchmarkRunning = false;
      confirmButton.disabled = false;
      confirmButton.textContent = 'Start Benchmark';
  }
})

