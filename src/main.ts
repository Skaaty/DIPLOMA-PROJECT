import './style.css';
import Stats from 'stats-gl';

import { initScene1Webgl } from './scenes/scene1_webgl';
import { initScene1Webgpu } from './scenes/scene1_webgpu';

type BenchmarkType = 'scene1' | 'scene2';

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

  const selectedScene = sceneSelector.value as BenchmarkType;
  
  if (!selectedScene) {
    console.warn("No scene or API selected.");
    return;
  }

  benchmarkRunning = true;
  confirmButton.disabled = true;
  confirmButton.textContent = 'Running...';
  
  const stats = new Stats({
    trackGPU: true,
    trackCPT: false,
    logsPerSecond: 6,
    samplesLog: 400,
    samplesGraph: 10,
    precision: 4,
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

  switch(selectedScene) {
    case 'scene1':
      await initScene1Webgpu(stats, onBenchmarkComplete);
      break;
    case 'scene2':
      await initScene1Webgl(stats, onBenchmarkComplete);
      break;
    default:
      console.warn('Nothing was selected');
      benchmarkRunning = false;
      confirmButton.disabled = false;
      confirmButton.textContent = 'Start Benchmark';
  }

})

function resizeInput(this: HTMLInputElement) {
  this.style.width = this.value.length + "ch";
}