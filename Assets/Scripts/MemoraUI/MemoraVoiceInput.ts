// MEMAR — one spoken phrase in, via the Specs ASR module (works in Lens Studio
// Preview with the computer mic; needs internet and a signed-in Lens Studio).
// Created at runtime by MemoraMain on the SceneObject "Voice"; reach it from LEAF
// with MemoraVoiceInput.instance.
//
// Owns: the ASR session. The mic is on only between start() (called from the Speak
// pinch, never at start-up) and the end of that one phrase: the first final
// transcript, a timeout (10 s to start, 2.5 s after the last partial words), an
// error, or stop() (cancel / close / object change).
// Nothing is recorded; only the text the user later saves is stored.
// Must NOT: create memories or touch the card. It reports partial / final / error
// and MemoraMain decides what to show.

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

/** Time to start speaking after Speak. */
const START_TIMEOUT_S = 10
/** After the last partial words, finish with what we have if no final arrives. */
const AFTER_PARTIAL_S = 2.5
const SILENCE_MS = 1000

@component
export class MemoraVoiceInput extends BaseScriptComponent {
  static instance: MemoraVoiceInput | undefined

  // Kept as fields for the component's whole life, like Snap's ASR examples: the ASR session
  // only holds a weak link to the options and their callbacks, so options created as a local
  // inside start() were collected and the engine logged "update is null" (no transcripts ever).
  private asr: AsrModule | undefined
  private options: AsrModule.AsrTranscriptionOptions | undefined
  private listening = false
  private timeoutAt = 0
  private lastPartial = ""
  private _onPartial = new Event<string>()
  private _onFinal = new Event<string>()
  private _onError = new Event<string>()

  get onPartial(): PublicApi<string> {
    return this._onPartial.publicApi()
  }
  get onFinal(): PublicApi<string> {
    return this._onFinal.publicApi()
  }
  get onError(): PublicApi<string> {
    return this._onError.publicApi()
  }

  onAwake(): void {
    MemoraVoiceInput.instance = this
    this.createEvent("UpdateEvent").bind(() => this.tick())
    this.createEvent("OnDestroyEvent").bind(() => this.stop())
  }

  isListening(): boolean {
    return this.listening
  }

  /** Creates the ASR module and the options once (callbacks stay alive with this component). */
  private ensureSession(): {asr: AsrModule; options: AsrModule.AsrTranscriptionOptions} {
    if (!this.asr) this.asr = require("LensStudio:AsrModule") as AsrModule
    if (!this.options) {
      const options = AsrModule.AsrTranscriptionOptions.create()
      options.mode = AsrModule.AsrMode.HighAccuracy
      options.silenceUntilTerminationMs = SILENCE_MS
      options.onTranscriptionUpdateEvent.add((e: AsrModule.TranscriptionUpdateEvent) => this.onUpdate(e))
      options.onTranscriptionErrorEvent.add((code: AsrModule.AsrStatusCode) => {
        if (!this.listening) return
        let message = "Voice isn't available right now — pick a preset"
        if (code === AsrModule.AsrStatusCode.NoInternet) message = "Voice needs internet — pick a preset instead"
        else if (code === AsrModule.AsrStatusCode.Unauthenticated) message = "Voice needs Lens Studio signed in — pick a preset"
        this.fail(`asr error ${code}`, message)
      })
      this.options = options
    }
    return {asr: this.asr, options: this.options}
  }

  /** Starts listening for one phrase. Call only in response to the user's Speak pinch. */
  start(): void {
    if (this.listening) return
    this.listening = true
    this.lastPartial = ""
    this.timeoutAt = getTime() + START_TIMEOUT_S
    try {
      const s = this.ensureSession()
      s.asr.startTranscribing(s.options)
    } catch (e) {
      this.fail(`asr unavailable: ${e}`, "Voice isn't available here — pick a preset")
    }
  }

  private onUpdate(e: AsrModule.TranscriptionUpdateEvent): void {
    if (!this.listening) return
    const text = (e.text ?? "").trim()
    if (text.length === 0) return
    if (e.isFinal) {
      this.finish(text)
      return
    }
    this.lastPartial = text
    // Still talking: give them a little longer than the last words.
    this.timeoutAt = Math.max(this.timeoutAt, getTime() + AFTER_PARTIAL_S)
    this._onPartial.invoke(text)
  }

  /** Stops listening now (cancel, close, object change). Safe to call any time. */
  stop(): void {
    const was = this.listening
    this.listening = false
    if (was && this.asr) {
      this.asr.stopTranscribing().catch(() => undefined)
    }
  }

  /** LEAF hook: feeds a final transcript through the same handler a real final phrase uses. */
  submitTranscriptForTest(text: string): void {
    this.listening = true
    this.finish(text)
  }

  private finish(text: string): void {
    this.stop()
    this._onFinal.invoke(text)
  }

  /** `reason` goes to the log; `message` is what the card shows (onError carries it). */
  private fail(reason: string, message: string = "Couldn't hear that — try again or pick a preset"): void {
    this.stop()
    print(`[MEMAR] voice: ${reason}`)
    this._onError.invoke(message)
  }

  private tick(): void {
    if (!this.listening || getTime() < this.timeoutAt) return
    if (this.lastPartial.trim().length > 0) this.finish(this.lastPartial)
    else this.fail("nothing heard (check the microphone)", "Couldn't hear that — check the mic, try again or pick a preset")
  }
}
