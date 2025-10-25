import './style.css';
import { loadScene1 } from './scenes/scene1';
import Stats from 'stats-gl';

type ApiType = 'webgl' | 'webgpu' | string;
type BenchmarkType = 'scene1';

const apiSelector = document.getElementById('api-selector') as HTMLSelectElement;
const sceneSelector = document.getElementById('scene-selector') as HTMLSelectElement;
const confirmButton = document.getElementById('confirm-button') as HTMLButtonElement;
const container = document.getElementById('button-container') as HTMLDivElement;

let benchmarkRunning = false;
//const benchmarkData = [];

confirmButton?.addEventListener('click', () => {
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
  
  const benchmarkData: number[] = [];
  const stats = new Stats({
    trackGPU: true,
    logsPerSecond: 4,
    samplesLog: 200,
    samplesGraph: 10,
    precision: 2,
    horizontal: true,
    minimal: false,
  });
  container.appendChild(stats.dom);

  const onBenchmarkComplete = () => {
    benchmarkRunning = false;
    confirmButton.disabled = false;
    confirmButton.textContent = 'Start Benchmark';
    console.info('Benchmark completed and ready for another run.');
  }

  switch(selectedScene) {
    case 'scene1':
      loadScene1(selectedApi, stats, benchmarkData, onBenchmarkComplete);
      break;
    default:
      console.warn('Nothing was selected');
      benchmarkRunning = false;
      confirmButton.disabled = false;
      confirmButton.textContent = 'Start Benchmark';
  }

})