import './style.css';
import { loadScene1 } from './scenes/scene1';
import Stats from 'stats-gl';

type ApiType = 'webgl' | 'webgpu' | string;
type BenchmarkType = 'scene1';

const apiSelector = document.getElementById('api-selector') as HTMLSelectElement;
const sceneSelector = document.getElementById('scene-selector') as HTMLSelectElement;
const confirmButton = document.getElementById('confirm-button') as HTMLButtonElement;

//const benchmarkData = [];

confirmButton?.addEventListener('click', () => {
  const selectedScene = sceneSelector.value as BenchmarkType;
  const selectedApi = apiSelector.value as ApiType;
  
  if (!selectedScene || !selectedApi) {
    console.warn("No scene or API selected.");
    return;
  }

  const benchmarkData: number[] = [];
  const stats = new Stats();

  switch(selectedScene) {
    case 'scene1':
      loadScene1(selectedApi, stats, benchmarkData);
      break;
    default:
      console.warn('Nothing was selected');
  }

})