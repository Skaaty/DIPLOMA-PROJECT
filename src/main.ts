import './style.css';
import * as THREE from 'three';
import { scene1 } from './scenes/scene1';

type ApiType = 'webgl' | 'webgpu' | string;
type BenchmarkType = 'scene1';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

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

  switch(selectedScene) {
    case 'scene1':
      loadNormals()
      break;
  }

})