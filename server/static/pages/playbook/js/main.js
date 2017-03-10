$(function(){
    $(".nav-tabs a").click(function(){
        $(this).tab('show');
    });

});

$("#executeWorkflowButton").on("click", function(e){
    var result = function () {
        var tmp = null;
        $.ajax({
            'async': false,
            'type': "POST",
            'global': false,
            'headers':{"Authentication-Token":authKey},
            'url': "/workflow/" + currentWorkflow + "/execute",
            'success': function (data) {
                tmp = data;
            }
        });
        return tmp;
    }();
    console.log(JSON.parse(result));
    notifyMe();
})

if(currentWorkflow){
    var workflowData = function () {
        var tmp = null;
        $.ajax({
            'async': false,
            'type': "POST",
            'global': false,
            'headers':{"Authentication-Token":authKey},
            'url': "/workflow/" + currentWorkflow + "/cytoscape",
            'success': function (data) {
                tmp = data;
            }
        });
        return tmp;
    }();
}

function notifyMe() {
  if (!Notification) {
    console.log('Desktop notifications not available in your browser. Try Chromium.');
    return;
  }

  if (Notification.permission !== "granted")
    Notification.requestPermission();
  else {
    var notification = new Notification('WALKOFF event', {
      icon: 'http://cdn.sstatic.net/stackexchange/img/logos/so/so-icon.png',
      body: currentWorkflow + " was executed!",
    });

    notification.onclick = function () {
      window.open("https://github.com/iadgov");
    };

  }
}

console.log(workflowData);


$(function(){

  //---------------------------
  // Create the Cytoscape graph
  //---------------------------

  var cy = cytoscape({
    container: document.getElementById('cy'),

    boxSelectionEnabled: false,
    autounselectify: false,
    wheelSensitivity: 0.1,
    style: [
      {
        selector: 'node',
        css: {
          'content': 'data(id)',
          'text-valign': 'center',
          'text-halign': 'center',
          'width':'50',
          'height':'50'
        }
      },
      {
        selector: '$node > node',
        css: {
          'padding-top': '10px',
          'padding-left': '10px',
          'padding-bottom': '10px',
          'padding-right': '10px',
          'text-valign': 'top',
          'text-halign': 'center',
          'background-color': '#bbb'
        }
      },
      {
        selector: 'edge',
        css: {
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
        }
      }
    ]
  });


  //------------------------------------
  // Enable various Cytoscape extensions
  //------------------------------------

  // Undo/Redo extension
  var ur = cy.undoRedo({});

  // Panzoom extension
  cy.panzoom({});

  // Extension for drawing edges
  cy.edgehandles({
      preview: false,
      toggleOffOnLeave: true,
      complete: function( sourceNode, targetNodes, addedEntities ) {
        // The edge hendles extension is not integrated into the undo/redo extension.
        // So in order that adding edges is contained in the undo stack,
        // remove the edge just added and add back in again using the undo/redo
        // extension. Also add info to edge which is displayed when user clicks on it.
        for (var i=0; i<targetNodes.length; ++i) {
            addedEntities[i].data('parameters', {
              flags: [],
              name: targetNodes[i].data().parameters.name,
              nextStep: targetNodes[i].data().parameters.name
            });
        }
        cy.remove(addedEntities); // Remove NOT using undo/redo extension
        var newEdges = ur.do('add',addedEntities); // Added back in using undo/redo extension
        newEdges.on('click', onClick);
      },
  });

  // Extension for copy and paste
  cy.clipboard();


  //-----------------------------
  // Load the data into the graph
  //-----------------------------
  cy.add(JSON.parse(workflowData));

  //-----------------
  // Setup the layout
  //-----------------
  // Setting up the layout must be done after loading the data. Otherwise
  // nodes will not be positioned correctly.
  cy.layout({
      name: 'breadthfirst',
      fit:true,
      padding: 5,
      root:"#start"
   });

  //--------------------------------
  // Define various helper functions
  //--------------------------------

  // This function displays info about a node/edge when clicked upon next to the graph
  function onClick(e) {

    function jsonStringifySort(obj) {
        // Sort keys so they are displayed in alphabetical order
        return JSON.stringify(Object.keys(obj).sort().reduce(function (result, key) {
          result[key] = obj[key];
          return result;
      }, {}), null, 2);
    }

    var ele = e.cyTarget;
    var parameters = ele.data().parameters;
    var parametersAsJsonString = jsonStringifySort(parameters);
    $("#parameters").text(parametersAsJsonString);
  }

  // This is called while the user is dragging
  function dragHelper( event ) {
    // Return empty div for helper so that original dragged item does not move
    return '<div></div>';
  }

  // This function is called when the user drops a new node onto the graph
  function handleDropEvent( event, ui ) {
    var draggable = ui.draggable;
    var draggableId   = draggable.attr('id');
    var draggableNode = $('#actions').jstree(true).get_node(draggableId);
    var app = draggableNode.data.app;
    var action = draggableNode.text;
      
    // The following coordinates is where the user dropped relative to the
    // top-left of the graph
    var x = event.pageX - this.offsetLeft;
    var y = event.pageY - this.offsetTop;

    // Find next available id
    var id = 1;
    while (true) {
        var element = cy.getElementById(id.toString());
        if (element.length === 0)
            break;
        id += 1;
    }

    // Add the node with the id just found to the graph in the location dropped
    // into by the mouse.
    var newNode = ur.do('add', {
      group: 'nodes',
      data: {
        id: id.toString(),
        parameters: {
            action: action,
            app: app,
            device: "None",
            errors: [
                {
                  name: "None",
                  nextStep: "None",
                  flags: []
                }
            ],
            input: {},            
            name: action,
            next: [
                {
                  name: "None",
                  nextStep: "None",
                  flags: []
                }
            ],
        }
      },
      renderedPosition: { x: x, y: y }
    });

    newNode.on('click', onClick);
  }

  // This function removes selected nodes and edges
  function removeSelectedNodes() {
      var selecteds = cy.$(":selected");
      if (selecteds.length > 0)
          ur.do("remove", selecteds);
  }

  function cut() {
      var selecteds = cy.$(":selected");
      if (selecteds.length > 0) {
          cy.clipboard().copy(selecteds);
          ur.do("remove", selecteds);
      }
  }

  function copy() {
      cy.clipboard().copy(cy.$(":selected"));
  }

  function paste() {
      var newNodes = ur.do("paste");
      newNodes.on('click', onClick);
  }

  //-------------------------
  // Configure event handlers
  //-------------------------

  // Configure handler when user clicks on node or edge
  cy.$('*').on('click', onClick);

  // Called to configure drops onto graph
  $(cy.container()).droppable( {
    drop: handleDropEvent
  } );

  // Handle undo button press
  $( "#undo-button" ).click(function() {
    ur.undo();
  });

  // Handle redo button press
  $( "#redo-button" ).click(function() {
    ur.redo();
  });

  // Handle delete button press
  $( "#remove-button" ).click(function() {
    removeSelectedNodes();
  });

  // Handle cut button press
  $( "#cut-button" ).click(function() {
      cut();
  });

  // Handle cut button press
  $( "#copy-button" ).click(function() {
      copy();
  });

  // Handle cut button press
  $( "#paste-button" ).click(function() {
      paste();
  });

  // The following handler ensures the graph has the focus whenever you click on it so
  // that the undo/redo works when pressing Ctrl+Z/Ctrl+Y
  $(cy.container()).on("mouseup mousedown", function(){
      $(cy.container()).focus();
  });

  // The following handler listens to keyboard presses
  $(cy.container()).on("keydown", function (e) {
      if(e.which === 46) { // Delete
          removeSelectedNodes();
      }
      else if (e.ctrlKey) {
          if (e.which === 90) // 'Ctrl+Z', Undo
            ur.undo();
          else if (e.which === 89) // 'Ctrl+Y', Redo
            ur.redo();
          else if (e.which == 67) // Ctrl + C, Copy
            copy();
          else if (e.which == 86) // Ctrl + V, Paste
              paste();
          else if (e.which == 88) // Ctrl + X, Cut
              cut();
          else if (e.which == 65) { // 'Ctrl+A', Select All
            cy.elements().select();
            e.preventDefault();
          }
      }
  });

    // Reformat the JSON data returned from the /apps/actions endpoint
    // into a format that jsTree can understand.
    function formatAppsActionJsonDataForJsTree(data) {
        data = JSON.parse(data);
        var jstreeData = [];
        $.each(data, function( key, value ) {
            var appName = key;
            var actionNames = data[key];
            var app = {};
            app.text = key;
            app.children = [];
            for (var i=0; i<actionNames.length; ++i) {
                app.children.push({text: actionNames[i], data: {app: appName}});
            }
            jstreeData.push(app);
        });
        return jstreeData;
    }

    // Download all actions in all apps for display in the Actions tree
    $.ajax({
        'async': true,
        'type': "POST",
        'global': false,
        'headers':{"Authentication-Token":authKey},
        'url': "/apps/actions",
        'success': function (data) {
            $('#actions').jstree({
                'core' : {
                    'data' : formatAppsActionJsonDataForJsTree(data)
                }
            })
            .bind("ready.jstree", function (event, data) {
                $(this).jstree("open_all"); // Expand all

                // Make each leaf node draggable onto the graph
                $('.jstree-leaf').each(function(){
                    $(this).draggable( {
                        cursor: 'copy',
                        cursorAt: { left: 0, top: 0 },
                        containment: 'document',
                        helper: dragHelper
                    });
                });
            });
        }
    });

});
