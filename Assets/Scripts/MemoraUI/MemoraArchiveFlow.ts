// MEMAR — Done archive flow (plain class, owned by MemoraMain).
//
// Owns: when the "ArchivePanel" is open, what it lists (store.getCompletedMemories(5)),
// Restore (store.restoreMemory) and Clear done (store.clearCompleted), and where
// the panel sits (next to the desk centre, inside the view, facing the user).
// Must NOT: keep its own copy of memories; it re-reads the store on every render.

import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import animate from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {MemoraApp} from "../Memora/MemoraApp"
import {findObject} from "../Memora/MemoraObjects"
import {MemoraArchiveUI} from "./MemoraArchiveUI"
import {formatWhen} from "./MemoraFormat"
import {panelPlacement} from "./MemoraPlacement"
import {THEME} from "./MemoraThemeUI"

export class MemoraArchiveFlow {
  constructor(
    private readonly app: MemoraApp,
    readonly ui: MemoraArchiveUI,
    private readonly desk: SceneObject,
    /** The desk strip, kept clear of the panel's footer. */
    private readonly strip?: SceneObject,
  ) {
    ui.onRestore.add((id) => this.restore(id))
    ui.onClearDone.add(() => this.app.store.clearCompleted())
    ui.onClose.add(() => this.close())
  }

  isOpen(): boolean {
    return this.ui.isOpen()
  }

  toggle(): void {
    if (this.isOpen()) this.close()
    else this.open()
  }

  /** Opens beside the desk; the memory card closes so only one panel is up. */
  open(): void {
    if (this.app.selectedObjectId) this.app.clearSelection()
    this.render()
    this.place()
    this.ui.setOpen(true)
  }

  close(): void {
    this.ui.setOpen(false)
  }

  /** Re-reads the store (call on every store change while open). */
  render(): void {
    const now = Date.now()
    this.ui.show(
      this.app.store.getCompletedMemories(5).map((m) => ({
        id: m.id,
        title: m.title,
        detail: `${findObject(m.objectId)?.name ?? m.objectName} · done ${formatWhen(m.completedAt ?? m.updatedAt, now)}`,
      })),
    )
  }

  private restore(id: string): void {
    this.app.store.restoreMemory(id)
  }

  /**
   * Opens where the laptop card would: next to the desk centre, fully inside the narrow SPECS
   * view (MemoraPlacement). The memory card is closed while the Done list is open.
   */
  private place(): void {
    const camT = WorldCameraFinderProvider.getInstance().getTransform()
    const deskCentre = this.desk.getTransform().getWorldTransform().multiplyPoint(new vec3(0, 11, -2.5))
    const p = panelPlacement(
      camT.getWorldPosition(),
      camT.back,
      deskCentre,
      16.5,
      THEME.archive.widthCm,
      Math.max(this.ui.getHeightCm(), 20),
      this.strip ? this.strip.getTransform().getWorldPosition() : undefined,
    )
    const t = this.ui.getSceneObject().getTransform()
    t.setWorldPosition(p.pos)
    t.setWorldRotation(p.rot)
    // Quick scale-in (like the memory card) so the panel opens instead of blinking on.
    t.setLocalScale(new vec3(p.scale * 0.9, p.scale * 0.9, p.scale * 0.9))
    animate({
      duration: 0.15,
      easing: "ease-out-quad",
      update: (k: number) => {
        const s = p.scale * (0.9 + 0.1 * k)
        t.setLocalScale(new vec3(s, s, s))
      },
    })
  }
}
