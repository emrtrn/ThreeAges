/**
 * Worker Faz 7 (§13.1, second item): what the 65th joint costs.
 *
 * The plan's suspicion is that the new Worker pack's real expense is not its
 * 18,201 triangles — that number sits in the middle of the existing unit family
 * — but its skeleton, which is roughly twice the old pack's 33 joints. Triangles
 * are a GPU question a frame capture can answer. Joints are a CPU question about
 * `AnimationMixer`, and a frame capture cannot separate them from everything else
 * in the same region, because both rigs are never on the field at once.
 *
 * So this measures the mixer directly, off the renderer, with the *only*
 * difference between two runs being the joint count. The rigs are synthetic —
 * a chain of plain `Bone`s driven by three tracks each — and that is the point:
 * a synthetic rig at the shipped rig's shape isolates the variable, where
 * loading `worker.glb` twice would compare two assets that differ in a dozen
 * ways. The shape is read from the shipped asset rather than invented:
 * `worker.glb` carries 65 joints, 198 channels per clip and ~21 keyframes per
 * sampler, so that is what the synthetic clip carries too.
 *
 * What this does NOT measure: skinning on the GPU, draw submission, or the
 * per-frame cost of the clip *selector* around the mixer. Those live in the
 * browser capture (`perf:worker`).
 */
import { AnimationClip, AnimationMixer, Bone, QuaternionKeyframeTrack, Skeleton, VectorKeyframeTrack } from "three";

/** Read from `worker.glb`: 65 joints, 198 channels/clip, ~21 keys per sampler. */
const SHIPPED_JOINTS = 65;
/** The old Worker pack, and the plan's comparison point (§13.1). */
const LEGACY_JOINTS = 33;
const KEYFRAMES_PER_TRACK = 21;
const CLIP_SECONDS = 1.5;
const FRAME_SECONDS = 1 / 60;
const ARMIES = [16, 32, 44];
const WARMUP_FRAMES = 240;
const MEASURED_FRAMES = 1_800;

/**
 * A bone chain, not a star: `Skeleton.update` walks parents, so a flat rig would
 * make every bone's world matrix a one-multiply special case and understate the
 * hierarchy cost the real rig pays.
 */
function buildRig(jointCount) {
  const bones = [];
  for (let i = 0; i < jointCount; i += 1) {
    const bone = new Bone();
    bone.name = `joint_${i}`;
    bone.position.set(0, i === 0 ? 0 : 0.12, 0);
    if (i > 0) bones[i - 1].add(bone);
    bones.push(bone);
  }
  return { root: bones[0], bones, skeleton: new Skeleton(bones) };
}

function buildClip(bones) {
  const times = Array.from({ length: KEYFRAMES_PER_TRACK }, (_, i) => (i / (KEYFRAMES_PER_TRACK - 1)) * CLIP_SECONDS);
  const tracks = [];
  for (const bone of bones) {
    const position = [];
    const quaternion = [];
    const scale = [];
    for (let k = 0; k < KEYFRAMES_PER_TRACK; k += 1) {
      const phase = (k / KEYFRAMES_PER_TRACK) * Math.PI * 2;
      position.push(0, bone.position.y + Math.sin(phase) * 0.01, 0);
      // A real rotation track, normalised: an unnormalised quaternion would make
      // the interpolant's slerp take a different branch than the shipped one.
      const half = Math.sin(phase) * 0.2;
      const w = Math.cos(half);
      const s = Math.sin(half);
      quaternion.push(s, 0, 0, w);
      scale.push(1, 1, 1);
    }
    tracks.push(new VectorKeyframeTrack(`${bone.name}.position`, times, position));
    tracks.push(new QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, quaternion));
    tracks.push(new VectorKeyframeTrack(`${bone.name}.scale`, times, scale));
  }
  return new AnimationClip("Bench_Loop", CLIP_SECONDS, tracks);
}

function buildArmy(jointCount, units) {
  const members = [];
  for (let i = 0; i < units; i += 1) {
    const rig = buildRig(jointCount);
    const mixer = new AnimationMixer(rig.root);
    const action = mixer.clipAction(buildClip(rig.bones));
    action.play();
    // Staggered, so the whole army is never sampling the same keyframe interval —
    // which would let the interpolant cache hit in a way no real match does.
    mixer.setTime((i / Math.max(1, units)) * CLIP_SECONDS);
    members.push({ mixer, skeleton: rig.skeleton, root: rig.root });
  }
  return members;
}

/**
 * One frame as the runtime spends it: advance every mixer, then let the bone
 * world matrices and the skinning palette catch up. `Skeleton.update` is charged
 * here because the renderer calls it once per skinned mesh per frame, and it is
 * the half of the cost that scales with joints rather than with tracks.
 */
function stepArmy(army) {
  for (const member of army) member.mixer.update(FRAME_SECONDS);
  for (const member of army) {
    member.root.updateMatrixWorld(true);
    member.skeleton.update();
  }
}

function measure(jointCount, units) {
  const army = buildArmy(jointCount, units);
  for (let i = 0; i < WARMUP_FRAMES; i += 1) stepArmy(army);
  const started = performance.now();
  for (let i = 0; i < MEASURED_FRAMES; i += 1) stepArmy(army);
  const elapsedMs = performance.now() - started;
  for (const member of army) member.mixer.uncacheRoot(member.root);
  return {
    jointCount,
    units,
    msPerFrame: elapsedMs / MEASURED_FRAMES,
    msPerUnit: elapsedMs / MEASURED_FRAMES / units,
  };
}

function fixed(value, digits = 3) {
  return value.toFixed(digits).padStart(digits + 5);
}

console.log(`Worker mixer bench — ${MEASURED_FRAMES} frames after ${WARMUP_FRAMES} warm-up, ${KEYFRAMES_PER_TRACK} keys/track, 3 tracks/joint`);
console.log(`node ${process.version} · ${process.platform}/${process.arch}`);
console.log("");
console.log("| joints | army | ms/frame | ms/unit | vs 33-joint |");
console.log("| ---: | ---: | ---: | ---: | ---: |");
const rows = [];
for (const units of ARMIES) {
  const legacy = measure(LEGACY_JOINTS, units);
  const shipped = measure(SHIPPED_JOINTS, units);
  rows.push(legacy, shipped);
  console.log(`| ${LEGACY_JOINTS} | ${units} | ${fixed(legacy.msPerFrame)} | ${fixed(legacy.msPerUnit, 4)} | 1.00x |`);
  console.log(`| ${SHIPPED_JOINTS} | ${units} | ${fixed(shipped.msPerFrame)} | ${fixed(shipped.msPerUnit, 4)} | ${(shipped.msPerFrame / legacy.msPerFrame).toFixed(2)}x |`);
}
console.log("");
// The distance throttle does not make a mixer cheaper; it runs it less often.
// Stated as arithmetic on the measured cost rather than measured again, because
// a second benchmark of "the same work at 15 Hz" would only be re-measuring the
// scheduler in `consumeDistanceUpdateDelta`, which has its own unit tests.
const worst = rows.filter((row) => row.jointCount === SHIPPED_JOINTS).at(-1);
console.log(`At 44 shipped-rig Workers: ${worst.msPerFrame.toFixed(3)} ms/frame at 60 Hz, or ${(worst.msPerFrame / 4).toFixed(3)} ms/frame if every one of them sat beyond the 45-unit ring on the 15 Hz cadence.`);
