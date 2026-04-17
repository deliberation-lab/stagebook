// Pure per-channel mute logic — no React/DOM dependencies.
// Used by MediaPlayer to toggle GainNode values for channel mute/unmute
// while leaving the analyser (waveform capture) path untouched.

/** Minimal GainNode-like shape — enough to test without a real AudioContext. */
export interface GainLike {
  gain: { value: number };
}

/**
 * Apply a mute state to one channel's GainNode. Muted channels are silenced
 * (gain 0); unmuted channels play at unity gain. No-op when the channel
 * index is out of range.
 */
export function setChannelGain(
  gainNodes: GainLike[],
  channel: number,
  muted: boolean,
): void {
  const node = gainNodes[channel];
  if (!node) return;
  node.gain.value = muted ? 0 : 1;
}

/**
 * Apply a full mute-state array to a set of GainNodes. Channels beyond the
 * end of either array are ignored. Missing entries in `muteState` are
 * treated as unmuted.
 */
export function applyMuteState(
  gainNodes: GainLike[],
  muteState: readonly boolean[],
): void {
  for (let ch = 0; ch < gainNodes.length; ch++) {
    setChannelGain(gainNodes, ch, muteState[ch] ?? false);
  }
}
