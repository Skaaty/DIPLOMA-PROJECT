import './style.css';
import Stats from 'stats-gl';

import { initScene1Webgl } from './scenes/scene1_webgl';
import { initScene1Webgpu } from './scenes/scene1_webgpu';
//import { initScene1WebGLNaive } from './scenes/scene1_webgl_naive';
//import { initScene1WebGPUNaive } from './scenes/scene1_webgpu_naive';
import { initScene2Webgl } from './scenes/scene2_webgl';
import { initScene2Webgpu } from './scenes/scene2_webgpu';
import { init1SceneWebGLInstancedRaw } from './scenes/scene1_webgl_raw';
import { init1SceneWebGPUInstancedRaw } from './scenes/scene1_webgpu_raw';
import { resizeInput } from './ui/resizeInput';

const sceneSelector = document.getElementById('scene-selector') as HTMLSelectElement;
const confirmButton = document.getElementById('confirm-button') as HTMLButtonElement;

const input = document.querySelector('input') as HTMLInputElement;
input?.addEventListener('input', resizeInput);
resizeInput.call(input);

let benchmarkRunning = false;

confirmButton?.addEventListener('click', async () => {
  if (benchmarkRunning) {
    console.warn('A benchmark is already running.');
    return;
  }
  const selectedScene = sceneSelector.value as string;

  if (!selectedScene) {
    console.warn("No scene or API selected.");
    return;
  }

  benchmarkRunning = true;
  confirmButton.disabled = true;
  confirmButton.textContent = 'Running...';

  let stats: Stats;

  if (selectedScene !== 'scene3' && selectedScene !== 'scene4') {
    stats = new Stats({
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
  }

  const onBenchmarkComplete = () => {
    if (stats?.dom?.parentNode) {
      stats.dom.parentNode.removeChild(stats.dom);
    }

    benchmarkRunning = false;
    confirmButton.disabled = false;
    confirmButton.textContent = 'Start Benchmark';
    console.info('Benchmark completed and ready for another run.');
  }

  switch (selectedScene) {
    case 'scene1':
      await initScene1Webgpu(stats!, onBenchmarkComplete);
      break;
    case 'scene2':
      await initScene1Webgl(stats!, onBenchmarkComplete);
      break;
    case 'scene3':
      await init1SceneWebGLInstancedRaw(onBenchmarkComplete);
      break;
    case 'scene4':
      await init1SceneWebGPUInstancedRaw(onBenchmarkComplete);
      break;
    case 'scene5':
      await initScene2Webgl(stats!, onBenchmarkComplete);
      break;
    case 'scene6':
      await initScene2Webgpu(stats!, onBenchmarkComplete);
      break;
    default:
      console.warn('Nothing was selected');
      benchmarkRunning = false;
      confirmButton.disabled = false;
      confirmButton.textContent = 'Start Benchmark';
  }
})

