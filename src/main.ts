import './style.css';
import Stats from 'stats-gl';

import { loadScene1 } from './scenes/scene1';

type ApiType = 'webgl' | 'webgpu' | string;
type BenchmarkType = 'scene1';

const apiSelector = document.getElementById('api-selector') as HTMLSelectElement;
const sceneSelector = document.getElementById('scene-selector') as HTMLSelectElement;
const confirmButton = document.getElementById('confirm-button') as HTMLButtonElement;
//const container = document.getElementById('button-container') as HTMLDivElement;
const input = document.querySelector('input') as HTMLInputElement;
input?.addEventListener('input', resizeInput);
resizeInput.call(input);

let benchmarkRunning = false;
//const benchmarkData = [];

confirmButton?.addEventListener('click', async () => {
  if (benchmarkRunning) {
    console.warn('A benchmark is already running.');
    return;
  }

  const selectedScene = sceneSelector.value as BenchmarkType;
  const selectedApi = apiSelector.value as ApiType;
  
  if (!selectedScene || !selectedApi) {
    console.warn("No scene or API selected.");
    return;
  }

  benchmarkRunning = true;
  confirmButton.disabled = true;
  confirmButton.textContent = 'Running...';
  
  const stats = new Stats({
    trackGPU: true,
    trackCPT: true,
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
      await loadScene1(selectedApi, stats, onBenchmarkComplete);
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