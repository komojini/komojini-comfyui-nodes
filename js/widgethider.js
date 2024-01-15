import { app } from "../../scripts/app.js";
import { findWidgetByName, doesInputWithNameExist } from "./utils.js";

let origProps = {};
let initialized = false;

const HIDDEN_TAG = "komojinihide";

const WIDGET_HEIGHT = 24;

// Toggle Widget + change size
function toggleWidget(node, widget, show = false, suffix = "") {
    if (!widget || doesInputWithNameExist(node, widget.name)) return;

    // Store the original properties of the widget if not already stored
    if (!origProps[widget.name]) {
        origProps[widget.name] = { origType: widget.type, origComputeSize: widget.computeSize };
    }

    const origSize = node.size;

    // Set the widget type and computeSize based on the show flag
    widget.type = show ? origProps[widget.name].origType : HIDDEN_TAG + suffix;
    widget.computeSize = show ? origProps[widget.name].origComputeSize : () => [0, -4];

    // Recursively handle linked widgets if they exist
    widget.linkedWidgets?.forEach(w => toggleWidget(node, w, ":" + widget.name, show));

    // Calculate the new height for the node based on its computeSize method
    const newHeight = node.computeSize()[1];
    node.setSize([node.size[0], newHeight]);
}


// Use for Multiline Widget Nodes (aka Efficient Loaders)
function toggleWidget_2(node, widget, show = false, suffix = "") {
    if (!widget || doesInputWithNameExist(node, widget.name)) return;
    
    const isCurrentlyVisible = widget.type !== HIDDEN_TAG + suffix;
    if (isCurrentlyVisible === show) return; // Early exit if widget is already in the desired state

    if (!origProps[widget.name]) {
        origProps[widget.name] = { origType: widget.type, origComputeSize: widget.computeSize };
    }

    widget.type = show ? origProps[widget.name].origType : HIDDEN_TAG + suffix;
    widget.computeSize = show ? origProps[widget.name].origComputeSize : () => [0, -4];

    if (initialized){
        const adjustment = show ? WIDGET_HEIGHT : -WIDGET_HEIGHT;
        node.setSize([node.size[0], node.size[1] + adjustment]);
    }
}

// New function to handle widget visibility based on input_mode
function handleInputModeWidgetsVisibility(node, inputModeValue) {

    const nodeVisibilityMap = {
        "UltimateVideoLoader": {
            "filepath": ["youtube_url", "upload"],
            "YouTube": ["video", "upload"],
            "fileupload": ["youtube_url", "video"],
        },
        "UltimateVideoLoader (simple)": {
            "filepath": ["youtube_url", "upload"],
            "YouTube": ["video", "upload"],
            "fileupload": ["youtube_url", "video"],
        },
    };

    const inputModeVisibilityMap = nodeVisibilityMap[node.comfyClass];
    
    if (!inputModeVisibilityMap || !inputModeVisibilityMap[inputModeValue]) return;

    // Reset all widgets to visible
    for (const key in inputModeVisibilityMap) {
        for (const widgetName of inputModeVisibilityMap[key]) {
            const widget = findWidgetByName(node, widgetName);
            toggleWidget(node, widget, true);
        }
    }

    // Hide the specific widgets for the current input_mode value
    for (const widgetName of inputModeVisibilityMap[inputModeValue]) {
        const widget = findWidgetByName(node, widgetName);
        toggleWidget(node, widget, false);
    }
}


// Create a map of node titles to their respective widget handlers
const nodeWidgetHandlers = {
    "UltimateVideoLoader": {
        "source": handleUltimateVideoLoaderSource,
    },
    "UltimateVideoLoader (simple)": {
        "source": handleUltimateVideoLoaderSource,
    },
};

// In the main function where widgetLogic is called
function widgetLogic(node, widget) {
    // Retrieve the handler for the current node title and widget name
    const handler = nodeWidgetHandlers[node.comfyClass]?.[widget.name];
    if (handler) {
        handler(node, widget);
    }
}


function handleUltimateVideoLoaderVisibility(node, source) {
    const commonWidgets = ["start_sec", "end_sec", "force_size", "max_fps", "frame_load_cap"];
    const baseNamesMap = {
        "YouTube": ["youtube_url", ...commonWidgets],
        "filepath": ["video", ...commonWidgets],
        "fileupload": ["fileupload", ...commonWidgets],
    };

    for (var key in baseNamesMap) {
        var toggle;
        if (key === source) {
            toggle = true;
        } else {
            toggle = false;
        }
        var baseNames = baseNamesMap[key];

        for (var nodeName in baseNames) {
            var widget = findWidgetByName(node, nodeName);
            toggleWidget(node, widget, toggle);
        }
    }
}


function handleUltimateVideoLoaderSource(node, widget) {
    handleInputModeWidgetsVisibility(node, widget.value);
    handleUltimateVideoLoaderVisibility(node, widget.value);
}



app.registerExtension({
    name: "komojini.widgethider",
    nodeCreated(node) {
        for (const w of node.widgets || []) {
            let widgetValue = w.value;

            // Store the original descriptor if it exists
            let originalDescriptor = Object.getOwnPropertyDescriptor(w, 'value');

            widgetLogic(node, w);

            Object.defineProperty(w, 'value', {
                get() {
                    // If there's an original getter, use it. Otherwise, return widgetValue.
                    let valueToReturn = originalDescriptor && originalDescriptor.get
                        ? originalDescriptor.get.call(w)
                        : widgetValue;

                    return valueToReturn;
                },
                set(newVal) {

                    // If there's an original setter, use it. Otherwise, set widgetValue.
                    if (originalDescriptor && originalDescriptor.set) {
                        originalDescriptor.set.call(w, newVal);
                    } else {
                        widgetValue = newVal;
                    }

                    widgetLogic(node, w);
                }
            });
        }
        setTimeout(() => {initialized = true;}, 500);
    }
});

