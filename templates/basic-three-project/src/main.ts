import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  BoxGeometry,
} from "three";

const canvas = document.getElementById("game-canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing #game-canvas");
}

const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new Scene();
scene.background = new Color(0xd9d7c8);

const camera = new PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(3, 3, 5);
camera.lookAt(0, 0, 0);

scene.add(new AmbientLight(0xffffff, 0.7));
const sun = new DirectionalLight(0xffffff, 1.6);
sun.position.set(3, 5, 4);
scene.add(sun);

const cube = new Mesh(
  new BoxGeometry(1, 1, 1),
  new MeshStandardMaterial({ color: 0x4c8f7a }),
);
scene.add(cube);

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
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}

loop();
