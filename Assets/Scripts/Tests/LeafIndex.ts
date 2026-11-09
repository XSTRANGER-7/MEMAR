// MEMAR — LEAF scenario index: one scenario per done criterion (docs/04_TEST_PLAN.md, Layer 2).
// Lives on the root SceneObject "LeafIndex". Run them from the LEAF panel, one at a time
// (each run resets the Lens; every scenario also starts from MemoraApp.instance.resetForTest()).
import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {MemoraC01BadgesScenario} from "./MemoraC01BadgesScenario"
import {MemoraC02RecallScenario} from "./MemoraC02RecallScenario"
import {MemoraC03DoneUndoScenario} from "./MemoraC03DoneUndoScenario"
import {MemoraC04PresetScenario} from "./MemoraC04PresetScenario"
import {MemoraC05DeleteScenario} from "./MemoraC05DeleteScenario"
import {MemoraC06ZonesScenario} from "./MemoraC06ZonesScenario"
import {MemoraC07DetectScenario} from "./MemoraC07DetectScenario"
import {MemoraC08DoneListScenario} from "./MemoraC08DoneListScenario"
import {MemoraC09VoiceScenario} from "./MemoraC09VoiceScenario"
import {MemoraC10ScanScenario} from "./MemoraC10ScanScenario"
import {MemoraC11RoutineScenario} from "./MemoraC11RoutineScenario"
import {MemoraC12SnoozeScenario} from "./MemoraC12SnoozeScenario"
import {MemoraC13LeaveScenario} from "./MemoraC13LeaveScenario"
import {MemoraC14HelpScenario} from "./MemoraC14HelpScenario"

/** Each scenario takes 5–40 s; a stuck one is cut off after 4 minutes. */
const TIMEOUT = {__leaf__timeout_secs: "240"}

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "memora-c01-badges", typename: MemoraC01BadgesScenario.getTypeName(), parameters: TIMEOUT},
    {id: "memora-c02-recall", typename: MemoraC02RecallScenario.getTypeName(), parameters: TIMEOUT},
    {id: "memora-c03-done-undo", typename: MemoraC03DoneUndoScenario.getTypeName(), parameters: TIMEOUT},
    {id: "memora-c04-preset", typename: MemoraC04PresetScenario.getTypeName(), parameters: TIMEOUT},
    {id: "memora-c05-delete", typename: MemoraC05DeleteScenario.getTypeName(), parameters: TIMEOUT},
    {id: "memora-c06-zones", typename: MemoraC06ZonesScenario.getTypeName(), parameters: TIMEOUT},
    {id: "memora-c07-detect", typename: MemoraC07DetectScenario.getTypeName(), parameters: TIMEOUT},
    {id: "memora-c08-done-list", typename: MemoraC08DoneListScenario.getTypeName(), parameters: TIMEOUT},
    {id: "memora-c09-voice", typename: MemoraC09VoiceScenario.getTypeName(), parameters: TIMEOUT},
    {id: "memora-c10-scan", typename: MemoraC10ScanScenario.getTypeName(), parameters: TIMEOUT},
    {id: "memora-c11-routine", typename: MemoraC11RoutineScenario.getTypeName(), parameters: TIMEOUT},
    {id: "memora-c12-snooze", typename: MemoraC12SnoozeScenario.getTypeName(), parameters: TIMEOUT},
    {id: "memora-c13-leave", typename: MemoraC13LeaveScenario.getTypeName(), parameters: TIMEOUT},
    {id: "memora-c14-help", typename: MemoraC14HelpScenario.getTypeName(), parameters: TIMEOUT},
  ]
}
