
export const findWidgetByName = (node, name) => {
    return node.widgets ? node.widgets.find((w) => w.name === name) : null;
}

export const doesInputWithNameExist = (node, name) => {
    return node.inputs ? node.inputs.some((input) => input.name === name) : false;
}

export const findWidgetsByType = (node, type) => {
    var widgets = [];
    node.widgets.map((widget) => {
        if (widget.type === type) {
            widgets.push(widget);
        }
    });
    return widgets;
}
