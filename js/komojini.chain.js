import { app } from "../../scripts/app.js";
import { api } from '../../scripts/api.js';
import { findWidgetByName, findWidgetsByType, enableOnlyRelatedNodes, waitForPromptId, DEBUG_STRING } from "./utils.js";
import * as shared from "./comfy_shared.js";


async function waitForQueueEnd(promptId) {
    while (true) {
        const { queue_running, queue_pending } = await fetch("/queue").then(re => re.json());
        const notFinishedIds = [
            ...queue_running.map(el => el[1]),
            ...queue_pending.map(el => el[1])
        ];
        if (!notFinishedIds.includes(promptId)) return;
        await new Promise(re => setTimeout(re, 1000));
    }
}


export async function executeAndWaitForTargetNode(app, targetNode) {
    const notAlreadyMutedBlacklist = enableOnlyRelatedNodes(targetNode);
    const promptIdPromise = waitForPromptId();
    await app.queuePrompt(0);
    for (const node of notAlreadyMutedBlacklist) node.mode = 0;
    const promptId = await promptIdPromise;
    await waitForQueueEnd(promptId);
}


export const EmptyLatentImageLoop = {
    beforeDef(nodeType, nodeData, app) {
        nodeType.prototype.onNodeCreated = function () {
            const loopIndex = findWidgetByName(this, 'loop_idx');
            loopIndex.value = 0;
            shared.hideWidgetForGood(node, loopIndex);

            const loopPreview = this.addCustomWidget(
                DEBUG_STRING('loop_preview', 'Iteration: Idle')
            );
            loopPreview.parent = this;
        }
    },
    whenCreated(node, app) {
        node.addWidget('button', `Queue`, 'queue', function () {
            return (async _ => {
                const numLoop = findWidgetByName(node, 'num_loop');
                const loopPreview = findWidgetByName(node, 'loop_preview');
                const loopIndex = findWidgetByName(this, 'loop_idx');
                loopIndex.value = 0;
                for (let i = 0; i < numLoop; i++) {
                    await executeAndWaitForTargetNode(app, node);
                    loopPreview.value = `current loop: ${i + 1}/${numLoop.value}`;
                    await new Promise(re => setTimeout(re, 1000));
                    loopIndex.value++;
                }
                loopPreview.value = 'Done 😎!';
                loopIndex.value = 0;
            })();

        });
    }
}