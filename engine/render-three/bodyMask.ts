/**
 * Body-mask helpers for layered (upper/lower) character animation.
 *
 * Forge's data-only stand-in for Unreal's "Layered Blend Per Bone": a character
 * clip is split into two clips by the node subtree it drives. Playing the upper
 * clip on one mixer and the lower clip on another (the masks are disjoint and
 * cover every animated node) lets an upper-body montage run while the legs keep
 * their locomotion — no per-bone weight graph, just track filtering by node.
 *
 * Works for both skinned skeletons and rigid node-hierarchy rigs (the demo
 * Kenney characters), since glTF animation tracks target nodes by name either
 * way. Three-touching, so it lives in `engine/render-three`.
 */
import { AnimationClip, PropertyBinding, type Object3D } from "three";

/**
 * Collects the names of `rootBone` and every descendant under it — the set of
 * nodes that make up the upper body. Returns an empty set when the bone is
 * absent (caller then treats every clip as full-body / lower).
 */
export function collectSubtreeNodeNames(root: Object3D, rootBone: string): Set<string> {
  const names = new Set<string>();
  const start = root.name === rootBone ? root : root.getObjectByName(rootBone);
  if (!start) return names;
  start.traverse((node) => {
    if (node.name) names.add(node.name);
  });
  return names;
}

/** The two masked variants of a character's clip set, keyed by the same names. */
export interface SplitClips {
  /** Tracks that drive nodes NOT in the upper set (legs, root, pelvis). */
  readonly lower: AnimationClip[];
  /** Tracks that drive nodes in the upper set (torso, arms, head). */
  readonly upper: AnimationClip[];
}

/**
 * Splits every clip into lower- and upper-body variants by routing each track to
 * the half its target node belongs to. Track data is shared (tracks are
 * read-only during playback); only the per-half track lists differ. A variant
 * with no tracks is still emitted so both channels can resolve the clip by name.
 */
export function splitClipsByUpperBody(
  clips: readonly AnimationClip[],
  upperNodeNames: ReadonlySet<string>,
): SplitClips {
  const lower: AnimationClip[] = [];
  const upper: AnimationClip[] = [];
  for (const clip of clips) {
    const lowerTracks = [];
    const upperTracks = [];
    for (const track of clip.tracks) {
      const nodeName = PropertyBinding.parseTrackName(track.name).nodeName ?? "";
      if (upperNodeNames.has(nodeName)) upperTracks.push(track);
      else lowerTracks.push(track);
    }
    lower.push(new AnimationClip(clip.name, clip.duration, lowerTracks));
    upper.push(new AnimationClip(clip.name, clip.duration, upperTracks));
  }
  return { lower, upper };
}
