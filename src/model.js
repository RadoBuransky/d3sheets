module.exports = function(spreadsheet) {
    var model = new Model();

    var nodeGroupTypes = getNodeGroupTypes(spreadsheet);
    model.nodeGroups = getNodeGroups(spreadsheet, nodeGroupTypes.nodeGroupNames);
    if (nodeGroupTypes.settingsGroupName != null)
        model.settings = spreadsheet.sheets[nodeGroupTypes.settingsGroupName];

    function getNodeGroups(spreadsheet, nodeGroupNames) {
        // Create nodes with properties
        var nodeGroups = new NodeGroups();
        $.each(nodeGroupNames, function(i, nodeGroupName) {
            nodeGroups[nodeGroupName] = getNodes(spreadsheet.sheets[nodeGroupName], nodeGroupName);
        });

        // Create reference names
        $.each(nodeGroupNames, function(i, nodeGroupName) {
            createRefNames(nodeGroups, spreadsheet.sheets[nodeGroupName], nodeGroupName);
        });

        // Create references from node sheets
        $.each(nodeGroupNames, function(i, nodeGroupName) {
            createRefs(nodeGroups, spreadsheet.sheets[nodeGroupName], nodeGroupName);
        });

        // TODO: Create references from reference sheets

        function createRefs(nodeGroups, nodeSheet, nodeGroupName) {
            var nodeGroup = nodeGroups[nodeGroupName];
            var colNames = nodeSheet.header();

            // For all sheet rows
            $.each(nodeSheet.rows, function(i, row) {
                if (i == 0)
                    return;

                // For all sheet columns
                $.each(colNames, function(j, colName) {
                    var value = nodeSheet.value(row, colName);
                    if (value == null)
                        return;

                    // If this is a reference column
                    var refTarget = parseColumnRefName(colName, nodeGroups);
                    if (refTarget != null) {
                        // Find index of the target node
                        $.each(nodeGroups[refTarget.sheetName].nodes, function(k, targetNode) {
                            // If target node property value matches
                            // TODO: We should properly split values using comma
                            if (value.indexOf(targetNode.value(refTarget.propertyName)) > -1) {
                                var refs = nodeGroup.nodes[i - 1].refs;
                                if (refs[refTarget.sheetName] == null)
                                    refs[refTarget.sheetName] = [];

                                // Add index of the target node to the nodeGroup node
                                refs[refTarget.sheetName].push(k);
                            }
                        });
                    }
                });
            });
        }

        function createRefNames(sheets, nodeSheet, nodeGroupName) {
            var source = sheets[nodeGroupName];

            // Get ref names
            $.each(nodeSheet.header(), function(i, propertyName) {
                var refTarget = parseColumnRefName(propertyName, sheets);
                if (refTarget != null)
                    source.refdNodeGroups.push(new RefdNodeGroup(refTarget.sheetName, refTarget.label));
            });
        }

        function getNodes(nodeSheet, nodeGroupName) {
            var header = nodeSheet.header();
            var result = new NodeGroup(nodeGroupName, header[0]);

            // Get nodes and properties
            $.each(nodeSheet.rows, function(i, row) {
                if (i == 0)
                    return;
                result.nodes.push(new Node(getNodeProperties(row, header)));
            });

            // Get property names
            $.each(header, function(i, colName) {
                var refTarget = colName.split(".");
                if (refTarget.length == 1)
                    result.propertyNames.push(colName);
            });

            return result;
        }

        function getNodeProperties(row, header) {
            var nodeProperties = [];
            $.each(row.rowCells, function(i, rowCell) {
                var colName = header[rowCell.colIndex];
                if (colName.indexOf(".") == -1)
                    nodeProperties.push(new NodeProperty(colName, rowCell.value));
            });
            return nodeProperties;
        }

        return nodeGroups;
    }

    function getNodeGroupTypes(spreadsheet) {
        var nodeGroupTypes = {
            nodeGroupNames: [],
            refSheetNames: [],
            settingsGroupName: null
        };
        var sheetNames = Object.keys(spreadsheet.sheets);
        $.each(sheetNames, function(i, sheetName) {
            if (sheetName == "settings") {
                nodeGroupTypes.settingsGroupName = sheetName;
                return;
            }

            if (sheetName.slice(0, 1) == "#")
                return;

            var refSheet = parseRefSheetName(sheetName)
            if ((refSheet != null) &&
                (sheetNames.indexOf(refSheet.source) > -1) &&
                (sheetNames.indexOf(refSheet.target) > -1)) {
                nodeGroupTypes.refSheetNames.push(sheetName)
                return;
            }

            nodeGroupTypes.nodeGroupNames.push(sheetName);
        });

        return nodeGroupTypes;
    }

    function parseColumnRefName(colName, sheets) {
        var refNames = colName.split(".");
        if ((refNames.length >= 2) &&
            (sheets[refNames[0]] != null) &&
            (sheets[refNames[0]].propertyNames.indexOf(refNames[1]) > -1)) {
            var result = {
                sheetName: refNames[0],
                propertyName: refNames[1]
            }

            if (refNames.length == 3)
                result.label = refNames[2];

            return result;
        }

        return null;
    }

    function parseRefSheetName(sheetName) {
        var nodeNames = sheetName.split("-");
        if (nodeNames.length == 2) {
            return {
                source: nodeNames[0],
                target: nodeNames[1]
            };
        }

        return null;
    }

    return model;
}

function Model() {
    this.nodeGroups = {};
    this.settings = {};
    return this;
}

function NodeGroups() {
    return this;
}

function NodeGroup(name, label) {
    this.name = name;
    this.label = label;
    this.propertyNames = [];
    this.refdNodeGroups = [];
    this.nodes = [];
    return this;
}

function RefdNodeGroup(name, label) {
    this.name = name;
    this.label = label;
    return this;
}

function Node(properties) {
    this.properties = properties;
    this.refs = {};
    return this;
}

Node.prototype.value = function(propertyName) {
    var result = null;
    $.each(this.properties, function(i, property) {
        if (property.name == propertyName) {
            result = property.value;
            return false;
        }
    });
    return result;
}

function NodeProperty(name, value) {
    this.name = name;
    this.value = value;
    return this;
}