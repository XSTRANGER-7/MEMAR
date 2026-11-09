// MEMAR — one pinchable stand-in object ("Object-<id>"), generic over objectId.
//
// Owns: building itself from MemoraStandInCatalog (visual parts, hit box, badge
// position, card anchor), the box collider + SIK Interactable on this
// SceneObject, hover/selected feedback, and the "found it" call:
// pinch → MemoraApp.instance.selectObject(id, "stand-in").
// Authored children win over the catalog: if this SceneObject already has a
// "Visual", "Badge-<id>" (with MemoraBadgeUI) or "CardAnchor" child, it is used
// as-is; otherwise it is created from the catalog.
// Expects: objectId (an id from MEMORA_OBJECTS). MemoraMain also creates these at
// runtime with MemoraStandIn.spawn() for ids that have no authored object.
// Must NOT: touch the store or the card. MemoraMain reacts to the selection.
//
// This SceneObject is the collider wrapper: keep it at unit scale and identity
// rotation; scale/rotation live on the visual children.

import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {MemoraApp} from "../Memora/MemoraApp"
import {MemoraBadgeUI} from "./MemoraBadgeUI"
import {buildStandInVisual, specFor, StandInSpec, toVec3} from "./MemoraStandInCatalog"

@component
export class MemoraStandIn extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MemoraStandIn – pinchable stand-in object, built from MemoraStandInCatalog</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Object id from MEMORA_OBJECTS (laptop, keys, notebook, bag, ...). Looks, hit box, badge and card position come from MemoraStandInCatalog")
  objectId: string = ""

  @input
  @hint("Visual scale while the pinch ray hovers the object")
  @widget(new SliderWidget(1, 1.2, 0.01))
  hoverScale: number = 1.05
  @ui.group_end

  /** Pending-count badge above this object ("Badge-<id>"). */
  badge!: MemoraBadgeUI
  /** Empty SceneObject marking where the memory card opens. */
  cardAnchor!: SceneObject

  private visualRoot: SceneObject | undefined
  private selectionGlow: SceneObject | undefined
  private interactable: Interactable | undefined
  private collider: ColliderComponent | undefined
  private configured = false
  private started = false
  private hovered = false
  private selected = false
  private cancelScale: CancelFunction | undefined

  /** Id handed to onAwake by spawn(): runtime-created script components don't get reliable @input defaults. */
  private static pendingObjectId: string | undefined

  /** Creates "Object-<id>" under `parent` at `localPos` and builds it from the catalog. */
  static spawn(parent: SceneObject, objectId: string, localPos: vec3): MemoraStandIn {
    const so = global.scene.createSceneObject(`Object-${objectId}`)
    so.setParent(parent)
    so.getTransform().setLocalPosition(localPos)
    MemoraStandIn.pendingObjectId = objectId
    const standIn = so.createComponent(MemoraStandIn.getTypeName()) as MemoraStandIn
    MemoraStandIn.pendingObjectId = undefined
    standIn.configure(objectId) // no-op when onAwake already configured it
    return standIn
  }

  onAwake(): void {
    const id = MemoraStandIn.pendingObjectId ?? this.objectId
    if (id) this.configure(id)
    this.createEvent("OnStartEvent").bind(() => {
      this.started = true
      this.bindEvents()
    })
  }

  /** Builds the stand-in for `objectId`. Called automatically for authored objects. */
  configure(objectId: string): void {
    if (this.configured) return
    this.configured = true
    this.objectId = objectId
    const spec = specFor(objectId)

    this.collider = this.sceneObject.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = toVec3(spec.colliderCm)
    this.collider.shape = shape
    this.interactable = this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable
    this.interactable.targetingMode = 3 // direct poke + indirect ray (mouse in Preview)

    this.buildParts(spec)
    if (this.started) this.bindEvents()
  }

  /** The "found it" moment: same path as a pinch. */
  select(): void {
    const app = MemoraApp.instance
    if (!app) {
      print("[MEMAR] MemoraApp is missing; add it at the top of the hierarchy")
      return
    }
    app.selectObject(this.objectId, "stand-in")
  }

  setColliderDebug(on: boolean): void {
    if (this.collider) this.collider.debugDrawEnabled = on
  }

  private buildParts(spec: StandInSpec): void {
    const authoredVisual = this.findChild("Visual")
    if (authoredVisual) {
      this.visualRoot = authoredVisual
      this.selectionGlow = findDescendant(authoredVisual, "SelectionGlow")
    } else {
      const built = buildStandInVisual(this.sceneObject, spec)
      this.visualRoot = built.visual
      this.selectionGlow = built.glow
    }
    if (this.selectionGlow) this.selectionGlow.enabled = false

    const badgeName = `Badge-${this.objectId}`
    const badgeObj = this.findChild(badgeName)
    const authoredBadge = badgeObj ? (badgeObj.getComponent(MemoraBadgeUI.getTypeName()) as MemoraBadgeUI | null) : null
    if (authoredBadge) {
      this.badge = authoredBadge
    } else {
      const so = this.child(badgeName, toVec3(spec.badgeCm))
      this.badge = so.createComponent(MemoraBadgeUI.getTypeName()) as MemoraBadgeUI
    }
    this.badge.objectId = this.objectId

    this.cardAnchor = this.findChild("CardAnchor") ?? this.child("CardAnchor", toVec3(spec.cardCm))
  }

  private bindEvents(): void {
    if (!this.interactable || !this.configured) return
    const interactable = this.interactable
    this.interactable = undefined // bind once
    interactable.onTriggerEnd.add(() => this.select())
    interactable.onHoverEnter.add(() => {
      this.hovered = true
      this.updateScale()
    })
    interactable.onHoverExit.add(() => {
      this.hovered = false
      this.updateScale()
    })
    const app = MemoraApp.instance
    if (app) app.onSelectionChanged((id) => this.setSelected(id === this.objectId))
  }

  private setSelected(on: boolean): void {
    this.selected = on
    if (this.selectionGlow) this.selectionGlow.enabled = on
    this.updateScale()
  }

  private updateScale(): void {
    if (!this.visualRoot) return
    const target = this.hovered ? this.hoverScale : this.selected ? 1 + (this.hoverScale - 1) * 0.5 : 1
    const t = this.visualRoot.getTransform()
    const from = t.getLocalScale().x
    if (this.cancelScale) this.cancelScale()
    this.cancelScale = animate({
      duration: 0.15,
      easing: "ease-out-quad",
      update: (k: number) => {
        const v = from + (target - from) * k
        t.setLocalScale(new vec3(v, v, v))
      },
    })
  }

  private child(name: string, localPos: vec3): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.sceneObject)
    so.getTransform().setLocalPosition(localPos)
    return so
  }

  private findChild(name: string): SceneObject | undefined {
    for (let i = 0; i < this.sceneObject.getChildrenCount(); i++) {
      const c = this.sceneObject.getChild(i)
      if (c.name === name) return c
    }
    return undefined
  }
}

function findDescendant(root: SceneObject, name: string): SceneObject | undefined {
  for (let i = 0; i < root.getChildrenCount(); i++) {
    const c = root.getChild(i)
    if (c.name === name) return c
    const deeper = findDescendant(c, name)
    if (deeper) return deeper
  }
  return undefined
}
