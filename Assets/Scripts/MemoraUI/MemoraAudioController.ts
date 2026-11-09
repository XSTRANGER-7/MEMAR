// MEMAR — short, quiet feedback sounds (tick on Done, chime on save, pop when a card
// opens, ping when look-to-detect finds something, swish on Scan).
// Lives on the authored SceneObject "Audio" under MemoraWorld.
//
// Owns: one AudioComponent per cue, all LowLatency because they answer a pinch.
// Expects: the three generated WAVs from Assets/GeneratedSFX wired in the Inspector.
// Must NOT: decide when to play; MemoraMain calls play*().

@component
export class MemoraAudioController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MemoraAudioController – pinch feedback sounds</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @allowUndefined
  @hint("Played when a memory is marked done")
  doneSound!: AudioTrackAsset

  @input
  @allowUndefined
  @hint("Played when a new memory is saved")
  savedSound!: AudioTrackAsset

  @input
  @allowUndefined
  @hint("Played when the memory card opens on an object")
  openSound!: AudioTrackAsset

  @input
  @allowUndefined
  @hint("Played when look-to-detect locks onto an object")
  foundSound!: AudioTrackAsset

  @input
  @allowUndefined
  @hint("Played when Scan sweeps the area")
  scanSound!: AudioTrackAsset
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Volume for all MEMAR sounds")
  @widget(new SliderWidget(0, 1, 0.05))
  volume: number = 0.6
  @ui.group_end

  private done: AudioComponent | undefined
  private saved: AudioComponent | undefined
  private open: AudioComponent | undefined
  private found: AudioComponent | undefined
  private scan: AudioComponent | undefined

  onAwake(): void {
    this.done = this.makePlayer(this.doneSound)
    this.saved = this.makePlayer(this.savedSound)
    this.open = this.makePlayer(this.openSound)
    this.found = this.makePlayer(this.foundSound)
    this.scan = this.makePlayer(this.scanSound)
  }

  playFound(): void {
    this.play(this.found)
  }

  playScan(): void {
    this.play(this.scan)
  }

  playDone(): void {
    this.play(this.done)
  }

  playSaved(): void {
    this.play(this.saved)
  }

  playOpen(): void {
    this.play(this.open)
  }

  private makePlayer(track: AudioTrackAsset | undefined): AudioComponent | undefined {
    if (!track) return undefined
    const audio = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    audio.audioTrack = track
    audio.volume = this.volume
    // Input-reactive cue: LowLatency so the sound lands with the pinch, not after it.
    audio.playbackMode = Audio.PlaybackMode.LowLatency
    return audio
  }

  private play(audio: AudioComponent | undefined): void {
    if (!audio) return
    if (audio.isPlaying()) audio.stop(false)
    audio.play(1)
  }
}
