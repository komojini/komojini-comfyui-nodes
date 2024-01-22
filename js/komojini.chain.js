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
    shared.log("executeAndWaitForTargetNode started");
    const notAlreadyMutedBlacklist = enableOnlyRelatedNodes(targetNode);
    const promptIdPromise = waitForPromptId();
    try {
        await app.queuePrompt(0, 1);
        
        const promptId = await promptIdPromise;

        for (const node of notAlreadyMutedBlacklist) node.mode = 0;
        shared.log(`new prompt id: ${promptId}`);
        await waitForQueueEnd(promptId);
    } 
    catch {
        console.error("Error while running flowbuilder queue");
    } 
}

