import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";

const canvas = document.getElementById("game-canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing #game-canvas");
}

const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new Scene();
scene.background = new Color(0xd7d7c7);
scene.add(new GridHelper(6, 6, 0x707070, 0xb0b0b0));
scene.add(new AmbientLight(0xffffff, 0.8));

const sun = new DirectionalLight(0xffffff, 1.5);
sun.position.set(4, 6, 5);
scene.add(sun);

const camera = new PerspectiveCamera(44, 1, 0.1, 100);
camera.position.set(4.5, 5.2, 6);
camera.lookAt(0, 0, 0);

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

window.addEventListener("resize", resize);
resize();

function loop(): void {
  requestAnimationFrame(loop);
  renderer.render(scene, camera);
}

loop();
