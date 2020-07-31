// Virtual Front Panel Editor

var signalHandlers = []

var svgDragId = "";
var svgDragName = ""
var svgDragFile = ""
var svgDragElements = 1;
var svgDragConfig = {};
var svgDragGroup = null;
var svgPreviousInstance = null;

var marquee = null;
var marqueeX = 0;
var marqueeY = 0;

var selection = null;
var defaultStyle = {};
var cc = null;

function initEditor (createNewPanel) {
   if (createNewPanel) {
      createTab("Main Controls"); 
      setPanelSize(panelWidth(), panelHeight());
   }
   installEventHandlers();
   installSignalHandlers();
   defaultStyle = editor.getCurrentStyle();
   
   // legacy - remove tab labels
   var tabs = getTabsArray();
   for (i=0; i<tabs.length; ++i) {
      var l = tabs[i].getElementsByClassName('tabLabel')[0];
      if (l != undefined) tabs[i].removeChild(l);      
   }
}

function installEventHandlers() {      
   window.onmousedown=oneditormousedown;
   window.onmouseup=oneditormouseup;
   window.onmousemove=oneditormousemove;
         
   window.oncontextmenu = function (evt) { evt.preventDefault(); }
      
   panel.ondragenter = onsvgdragenter;
   panel.ondragleave = onsvgdragleave;
   panel.ondragover = onsvgdragover;
   panel.ondrop = onsvgdrop;      
}    

// Install connections to the editor's signals:
function installSignalHandlers () {      
   function connect (object, func) {
      signalHandlers.push({ disconnect : object.disconnect, slot : func });
      object.connect(func);   
   }   

   connect(editor.selectTabByOrdinal, selectTabByOrdinal);
   connect(editor.selectTabByName, selectTabByName);
   connect(editor.selectControlByName, selectControlByName);
   connect(editor.clearSelection, clearSelection);   
   connect(editor.createTab, createTab);
   connect(editor.setTabName, setTabName);
   connect(editor.setPanelSize, setPanelSize);
   connect(editor.setBackgroundImage, setBackgroundImage);
   connect(editor.setDragControl, setDragControl);
   connect(editor.setControlProperty, setNamedControlProperty);
   connect(editor.setPanelText, setPanelSVG);
   connect(editor.showGrid, showGrid);
   connect(editor.applyStyle, applyStyle);
   
   connect(editor.alignLeft, function() { align('l'); });
   connect(editor.alignCentre, function() { align('c'); });
   connect(editor.alignRight, function() { align('r'); });
   connect(editor.alignTop, function() { align('t'); });
   connect(editor.alignMiddle, function() { align('m'); });
   connect(editor.alignBottom, function() { align('b'); });
   connect(editor.rotateCW, function() { transform(+90, false, false); });
   connect(editor.rotateCCW, function() { transform(-90, false, false); });
   connect(editor.rotate180, function() { transform(+180, false, false); });
   connect(editor.reflectHoz, function() { transform(0, true, false); });
   connect(editor.reflectVert, function() { transform(0, false, -true); });
   connect(editor.restoreAspect, restoreAspect);
   connect(editor.toBack, sendToBack);
   connect(editor.toFront, sendToFront);
   connect(editor.makeGroup, makeGroup);
   connect(editor.breakGroups, breakGroups);
   connect(editor.cut, cutSelection);
   connect(editor.copy, copySelection);
   connect(editor.paste, pasteSelection);
   connect(editor.duplicate, duplicateSelection);
   connect(editor.remove, deleteSelection);
}   


// Disconnect all signal connections made above:
function removeSignalHandlers () {      
   for (var i = 0; i<signalHandlers.length; ++i)
      signalHandlers[i].disconnect(signalHandlers[i].slot);
   signalHandlers = [];
}


/*********************************************************************
**** Methods ****
****************/

// Create a new tab with the specified name
// The tab is created an inkscape compatible layer with the id set to the tab name.
function createTab (name) {
   var tab = document.createElementNS(svgNS, 'g');
   tab.id = name;
   tab.setAttribute("inkscape:groupmode","layer");
   panel.appendChild(tab);
   
   // Set the tab name:
   var tabs = getTabsArray();
   setTabName(tabs.length-1, name);
   editor.setDirty(false);    
}       

// Rename the specified tab:
function setTabName (index, name) {
   var tabs = getTabsArray();
   if (index >= 0 && index<tabs.length) {
      tabs[index].id = name;            
      showTabLabel(true);
   }   
}

// Update the tab label to show the active tab name
function showTabLabel (flag) {   
   if (activeTab != null) {
      var text = document.getElementById('tablabel');   
      if (text == undefined) {
         // Legacy - the label should be part of the panel SVG:
         var background = document.getElementById('Background');
         var text = document.createElementNS(svgNS, 'text');    
         text.id='tablabel';
         text.addClass('tablabel');
         background.appendChild(text);
      }
      text.setAttribute('x',"0");
      text.setAttribute('y',"0");
      text.style.fontWeight="bold";
      text.style.fontFamily="sans-serif";
      text.style.textAnchor="middle";
      text.style.fill="#C0C0C0";
      text.style.stroke="none";
      text.style.cursor="none";
      text.style.pointerEvents="none";
      text.style.fontSize=panelHeight()/25+'px';
      text.textContent =  'IOT Builder ('+activeTab.id+')';
      text.style.display = flag ? 'inherit' : 'none';
   }
}

// Show or hide the grid.
function showGrid (flag) {
   var grid = document.getElementById('grid');   
   if (grid == undefined) {  
      // Legacy - an empty grid be part of the panel SVG.
      var background = document.getElementById('Background');
      var grid = document.createElementNS(svgNS, 'path');    
      grid.addClass("grid");
      grid.id='grid';
      background.appendChild(grid);
   }
   if (flag) {
      var path = "";
      var w = panelWidth();
      var h = panelHeight();
      var g = panelGrid();
      w = Math.ceil(w / (2*g)) * 2*g;
      h = Math.ceil(h / (2*g)) * 2*g;
      for (var x = -w/2; x<=w/2; x += g)
         path = path + ' M '+ x + ' ' + -h/2 + ' l 0 ' + h;
      for (var y = -h/2; y<=h/2; y += g)
         path = path + ' M '+ -w/2 + ' ' + y + ' l ' + w + ' 0';
      grid.style.pointerEvents="none";
      grid.style.stroke = '#C0C0C0';   
      grid.style.strokeWidth = 0.5
      grid.style.fill = 'none';
      grid.setAttribute('d', path);
   }
   else
      grid.setAttribute('d', 'M 0 0');  
   grid.style.display = flag ? 'inherit' : 'none';
}

// Apply a graphics style to the selected graphics objects.
// The new style element(s) are applied to graphics objects inside groups as well as top level objects.
function applyStyle (style) {
   if (selection == null) {
      defaultStyle = editor.getCurrentStyle();
   } else {   
      var graphics = [];
      editor.storeUndo();
      for (var i=0; i<selection.objects.length; ++i) 
         getGraphicsObjects(graphics, selection.objects[i]);     
      for (var i=0; i<graphics.length; ++i) {
         var obj = graphics[i];         
         if (style.strokeWidth != undefined)
            obj.style.strokeWidth = style.strokeWidth;
         if (style.strokeColour != undefined) {
            obj.style.stroke = style.strokeColour;
            obj.style.strokeOpacity = style.strokeOpacity;
         }
         if (style.fillColour != undefined) {
            obj.style.fill = style.fillColour;
            obj.style.fillOpacity = style.fillOpacity;              
         }
      }    
   }
}



// Set a new size for the panel
function setPanelSize (width, height) {
   var svg = container.firstElementChild;
   var x = -width/2;
   var y = -height/2;
   panelBounds = panel.createSVGRect();
   panelBounds.x = x;
   panelBounds.y = y;
   panelBounds.width = width;
   panelBounds.height = height;

   svg.setAttribute("width", width);
   svg.setAttribute("height", height);
   svg.setAttribute("viewBox", x.toString()+","+y.toString()+","+width.toString()+","+height.toString());
   
   var background = document.getElementById("Background");
   var image = background.firstElementChild;
   image.setAttribute("x", x);
   image.setAttribute("y", y);
   image.setAttribute("width", width);
   image.setAttribute("height", height);
   
   showTabLabel(true);
      
}   
    
  
// Replaces the background rectangle with an image tag that then loads the specified image file.
// The image can be jpeg, png or svg but must have an 8.3 filename.
function setBackgroundImage (filename) {
    var background = document.getElementById("Background");
    var oldImage = background.firstElementChild;
    var newImage = document.createElementNS(svgNS, 'image');    
    editor.clearCaches();
    newImage.setAttribute("xlink:href", filename);
    newImage.setAttribute("x", -panelWidth()/2);
    newImage.setAttribute("y", -panelHeight()/2);
    newImage.setAttribute("width", panelWidth());
    newImage.setAttribute("height", panelHeight());
    newImage.setAttribute("preserveAspectRatio", "none");
    background.replaceChild(newImage, oldImage);
    editor.setDirty(false);
    reloadPanel();
}    

function selectControlByName (id) {
   var control = document.getElementById(id);
   if (control != null) {
      var parent = findParentObject(control);
      var tabs = getTabsArray();
      for (var i=0; i<tabs.length; ++i) {
         if (tabs[i] == parent.parentNode) {
            editor.setCurrentTab(i);
            break;
         }
      }
      selectObject(control, false);
   } else {
      clearSelection();
   }
}

function setNamedControlProperty (id, group, name, value) {
   var control = document.getElementById(id);
   if (group == 'geometry') {
      // Change the position or size:
      var t = panel.createSVGTransform();
      var m = panel.createSVGMatrix();
      var rect = selection.bounds;
      var ax = rect.x; // +rect.width/2;
      var ay = rect.y; // +rect.height/2;
      if (name == 'x')
         t.setTranslate(parseFloat(value)-rect.x,0);
      else if (name == 'y')   
         t.setTranslate(0, parseFloat(value)-rect.y,0);
      else if (name == 'width') {
         m = m.translate(ax, ay); // Move back to the anchor point.
         m = m.scaleNonUniform(parseFloat(value)/rect.width, 1.0);     
         m = m.translate(-ax, -ay); // Move the anchor point to the origin.
         t.setMatrix(m);
      }         
      else if (name == 'height') {
         m = m.translate(ax, ay); // Move back to the anchor point.
         m = m.scaleNonUniform(1.0, parseFloat(value)/rect.height);    
         m = m.translate(-ax, -ay); // Move the anchor point to the origin.
         t.setMatrix(m);
      }
      control.transform.baseVal.insertItemBefore(t, 0);
      control.transform.baseVal.consolidate();   
   } else if (control.tagName != 'g') {
      // Perform a get/set to modify the specific property:
      var props = {}
      getGraphicsProperties(control, props);
      setGroupProperty(props, group, name, value);
      setGraphicsProperties(control, props);
   } else {
      // Default - set control config property:
      setConfigProperty(control, group, name, value);
      replicateControl(control, getControlConfig(control));
      initControl(control, getControlConfig(control), true);
   }
   
   
   // Set or ipdate the selection
   if (selection == null)
      selectControl(control);
   else   
      selection.updateBounds();   
      
   // Panel is modified:
   editor.setDirty(false);   
  
}
   
function align (edge) {   
   if (selection == null) return;
   editor.storeUndo();
    
   var edgex, edgey
   switch (edge) {
      case 'l' : edgex = selection.bounds.p1().x; break;
      case 'c' : edgex = selection.bounds.centre().x; break;
      case 'r' : edgex = selection.bounds.p2().x; break;
      case 't' : edgey = selection.bounds.p1().y; break;
      case 'm' : edgey = selection.bounds.centre().y; break;
      case 'b' : edgey = selection.bounds.p2().y; break;
   }

   var objects=selection.objects;
   var dx=0, dy=0;
   for (var i=0; i<objects.length; ++i) {
      var crect = getBoundingRect(objects[i]);
      switch (edge) {
          case 'l' : dx = edgex-crect.p1().x; break;
          case 'c' : dx = edgex-crect.centre().x; break;
          case 'r' : dx = edgex-crect.p2().x; break;
          case 't' : dy = edgey-crect.p1().y; break;
          case 'm' : dy = edgey-crect.centre().y; break;
          case 'b' : dy = edgey-crect.p2().y; break;

      }
     objects[i].translate(dx, dy);
   }
   
   selection.update();
}


function transform (rot, flipX, flipY) {
    if (selection == null) return;
    editor.storeUndo();
   
   var objects=selection.objects;
   var c=selection.bounds.centre();

   for (var i=0; i<objects.length; ++i) {
      var t = panel.createSVGTransform();      
      var m = panel.createSVGMatrix();
      m = m.translate(c.x, c.y); // Move back to the anchor point.
      if (flipX)
         m = m.flipX();
      if (flipY)
         m = m.flipY();
      if (rot != 0)      
         m = m.rotate(rot);
      m = m.translate(-c.x, -c.y); // Move the anchor point to the origin.
      t.setMatrix(m);
      objects[i].transform.baseVal.insertItemBefore(t, 0);         
      objects[i].transform.baseVal.consolidate();
   }
   selection.update();
}


function restoreAspect () {
    if (selection == null) return;
    editor.storeUndo();
   
   var objects=selection.objects;
   for (var i=0; i<objects.length; ++i) {
      var t = objects[i].transform.baseVal;
      var m = t.consolidate();
      if (m.matrix.a > m.matrix.d)
         m.matrix.a = m.matrix.d;
      else
         m.matrix.d = m.matrix.a;   
      t.replaceItem(m, 0);         
   }
   selection.update();
}
    

function sendToBack () {
    if (selection == null) return;
    editor.storeUndo();
   
    var obj = activeTab.removeChild(selection.obj);
    for (var i=selection.objects.length-1; i>=0; --i) {         
       activeTab.removeChild(selection.objects[i]);
       activeTab.insertBefore(selection.objects[i], activeTab.firstElementChild);
    }
    activeTab.appendChild(obj);
}   

function sendToFront () {
    if (selection == null) return;
    editor.storeUndo();

    activeTab.removeChild(selection.obj);
    for (var i=0; i<selection.objects.length; ++i) {
       activeTab.removeChild(selection.objects[i]);
       activeTab.appendChild(selection.objects[i]);
    }
    activeTab.appendChild(selection.obj);
}   

function makeGroup () {
    if (selection == null) return;
    editor.storeUndo();
    
    var g = document.createElementNS(svgNS, 'g');
    for (var i=0; i<selection.objects.length; ++i) {
       activeTab.removeChild(selection.objects[i]);
       g.appendChild(selection.objects[i]);
    }
    g.id = getUniqueObjectId(g);
    activeTab.appendChild(g);
    selectObject(g, false);        
}

function breakGroups () {
    var groups = [];
    for (var i=0; i<selection.objects.length; ++i)
       if (selection.objects[i].tagName == 'g') 
          groups.push(selection.objects[i]);
        
    clearSelection();
    editor.storeUndo();
    for (var i=0; i<groups.length; ++i) {
       var g = groups[i];
       if (!g.hasAttribute('vfp:class'))  { // controls cannot be smashed.
          var t = g.transform.baseVal.consolidate();
          var obj, next;
          for (obj=g.firstElementChild; obj != null; obj=next) {
             if (t != null) {
               obj.transform.baseVal.insertItemBefore(t, 0);
               obj.transform.baseVal.consolidate();
             }
             next = obj.nextElementSibling;
             g.removeChild(obj);
             activeTab.appendChild(obj);
          }
       }
    }
}

function cutSelection () {
   copySelection();
   deleteSelection();
}

function copySelection () {
   var svg = getSelectionSVG();
   editor.setClipboardData(svg);
}

function pasteSelection (data) {
   var copy = document.createElement('div');
   copy.innerHTML = data != undefined ? data : editor.getClipboardData();
   editor.storeUndo()

   // Pasting is designed to copy graphics objects only - these will have been placed into a top level group:
   var svg = copy.firstElementChild;   
   g = svg.getElementById('selection');
   var objects = [], controls = [];
   var duplicates = false;
   for (var e=g.firstElementChild; e != null; e=e.nextElementSibling) {
       var object = e.cloneNode(true);
       duplicates |= setUniqueObjectIds(object);
       getControlObjects(controls, object);       
       activeTab.appendChild(object);
       objects.push(object);          
   }    
   
   // If there were duplicate objects, then offset the pasting:
   var svgGrid = panelGrid();
   if (duplicates)
      for (var i = 0; i<objects.length; ++i)
         objects[i].translate(svgGrid, svgGrid);
       
   // If there were controls then re-initialize them to create the control classes etc.
   for (var i=0; i<controls.length; ++i)      
      initControl(controls[i], getControlConfig(controls[i]), false);          
       
   selectObjects(objects);   
   editor.panelChanged(true);
}

function duplicateSelection () {
   var svg = getSelectionSVG();
   pasteSelection(svg);
}   

function deleteSelection () {
   if (selection == null) return;
   editor.storeUndo();

   for (var i=0; i<selection.objects.length; ++i) {
      activeTab.removeChild(selection.objects[i]);
   }
   clearSelection();
   updateOverlays();
}


function getSelectionSVG () {
   var copy = container.cloneNode(true), layer, next;
   var svg = copy.firstElementChild;
   for (layer=svg.firstElementChild; layer != null; layer=next) {
       next = layer.nextElementSibling;
       if (layer.tagName=='g')
          svg.removeChild(layer);
   }   
   
   // The selected objects are assembled into a single top level group:
   var g = document.createElementNS(svgNS, 'g')
   g.id = 'selection';
   for (var i=0; i<selection.objects.length; ++i) 
      g.appendChild(selection.objects[i].cloneNode(true));
   svg.appendChild(g);
   return copy.innerHTML;
}   

// Return the panel svg as a string.
// The selection and any other temporary objects are removed first.
function getPanelSVG() {
   if (container.firstElementChild.tagName != "svg")
      return "";
         
   // Take a copy of the panel:      
   var copy = container.cloneNode(true);

   // Remove any elements after the first - this will strip
   // the marquee, input fields, canvases etc.
   var child = null, next = copy.firstElementChild;
   do {
      next = next.nextElementSibling;
      if (child != null)
         copy.removeChild(child);
      child = next;   
   } while (child != null);
      

   // Remove the selection
   if (selection != null) {
      var sel = copy.getElementsByClassName('selection')[0];   
      sel.parentNode.removeChild(sel);
   }

   // Hide the tab label 
   var text = copy.getElementsByClassName('tablabel')[0];
   if (text != undefined) {
      text.style.display = 'none';
   }      
   
   // Remove/hide the grid.
   var path = copy.getElementsByClassName('grid')[0];
   if (path != undefined) {
      path.setAttribute('d', 'M 0 0');
      path.style.display = 'none';
   }      
         
   return copy.innerHTML;
}

// Set the panel svg as a string. This will invalidate the selection, the active tab and the control objects (if relevant)
// The full set of JS control classes is then rebuilt.
function setPanelSVG(text) {
   // Re-assign the panel:
   container.innerHTML = text;
   installEventHandlers();
   
   // Rebuild the control classes:
   var controls = [];
   getControlObjects(controls, panel);
   for (var i=0; i<controls.length; i++) {         
      var root = controls[i];
      initControl(root, getControlConfig(root), false);
   }   
   updateOverlays();
   
   // Reset 
   editor.setSelection(0, {});
   activeTab = null;
   selection = null;
}

   

/*********************************************************************
**** Drag Handling ****
**********************/


function setDragControl (id, name, file, elements, config) 
 { svgDragId = id;
   svgDragName = name;
   svgDragFile = file;
   svgDragElements = elements; 
   svgDragConfig = config;
 }

function onsvgdragenter (evt) {
    evt.preventDefault();    
}

function onsvgdragover (evt) {    
    evt.preventDefault();

    if (svgDragGroup == null) { 
       var svgContainer = document.createElement("div");
       var svgControl = null;

       editor.prepareUndo();
    
       clearSelection();
       editor.loadControl(svgDragFile, svgContainer);
       svgRoot = svgContainer.firstElementChild;
      
       svgPreviousInstance = document.getElementById(svgDragId);
       if (svgPreviousInstance != null) {
          // If there is a previous instance, we hide it but leave it in situ
          svgPreviousInstance.style.display="none"; 
       }
    
       if (svgRoot != null) {
          // Create a new top level group  to carry the control:
          var control = instantiateControl(svgDragId, svgDragElements, svgRoot);  
          control.style.pointerEvents = "inherit";

          activeTab.appendChild(control);
          activeTab.style.pointerEvents="none";
          
          // Set attributes - these are used to assist in situations where a control is cloned.
          control.setAttribute("vfp:name", svgDragName);
          control.setAttribute("vfp:file", svgDragFile);
          
          // Set up replication:
          if (svgDragElements != -1 && svgDragConfig.replicate == undefined) {
             var replicate = {};
             replicate.count = svgDragElements;
             replicate.spacing = 0;
             replicate.direction = 0;
             replicate.width = parseInt(svgRoot.getAttribute('width'));
             replicate.height = parseInt(svgRoot.getAttribute('height'));
             svgDragConfig.replicate = replicate;
          }
          
          
          // Create an empty translate transform at the head of the transform list. This will be manipulated
          // by subsequent calls and determines the position of the control on the panel.
          var t = panel.createSVGTransform();
          t.setTranslate(0,0);
          control.transform.baseVal.insertItemBefore(t, 0);
          svgDragGroup = control;
      
          // Create the control using the incoming JSON config
          // Code within the control constructor will fill out any missing config properties 
          // using values extracted from the SVG itself.
          replicateControl(control, svgDragConfig);
          initControl(control, svgDragConfig, true);
          
          // Webkit doesn't cope will with the replacements, above, so we need to force it to rebuild the inter-element links for
          // all the controls of the same class on the current tab:
          var controls = [];
          var className = control.getAttribute('vfp:class');
          getControlObjects (controls, activeTab);
          for (var i=0; i<controls.length; i++ )
             if (controls[i].getAttribute("vfp:class") == className && controls[i].id != svgDragId)
               rebuildUrlRefs(controls[i]);
                    
          // Store the modified config:
          setControlConfig(control, svgDragConfig);
       }
    }
    
    if (svgDragGroup != null) {      
      // Reposition the drag group
      var pos = panelPos(evt, true);
      
      // Update the first item in the transform list with the desired position.
      var transform = svgDragGroup.transform.baseVal.getItem(0);
      transform.setTranslate(pos.x, pos.y);
      
      // Update the overlays
      updateOverlays();
    }
}
   


function onsvgdrop (evt) {    
    evt.preventDefault();    
    if (svgPreviousInstance != null)  {
       var svgPreviousTab = svgPreviousInstance.parentElement;
       svgPreviousTab.removeChild(svgPreviousInstance);
       svgPreviousInstance = null;
    }
       
    if (svgDragGroup != null) {
       activeTab.style.pointerEvents="";              
       selectObject(svgDragGroup, false);
       editor.storeUndo();
       svgDragGroup = null;
    }
    updateOverlays(); 
}

function onsvgdragleave (evt) {
    evt.preventDefault();
    if (svgPreviousInstance != null) {
       svgPreviousInstance.style.display="inline";
       svgPreviousInstance = null;
    }
    if (svgDragGroup != null) {
      activeTab.removeChild(svgDragGroup);
      activeTab.style.pointerEvents="";
      editor.clearUndo();
      svgDragGroup = null;      
    }
    updateOverlays();
}

/*********************************************************************
**** Marquee Selection ****
**************************/

function oneditormousedown (evt) {
    if (capture == null) {
       if (evt.button == 0)
          var placer = null;
          switch (editor.getSelectedPaletteItem()) {
              case 'line'   : setCapture(placer = new ShapePlacementTool(activeTab, 'line')); break;
              case 'rect'   : setCapture(placer = new ShapePlacementTool(activeTab, 'rect')); break;
              case 'circle' : setCapture(placer = new ShapePlacementTool(activeTab, 'circle')); break;
              case 'arc'    : setCapture(placer = new ShapePlacementTool(activeTab, 'arc')); break;
              case 'path'   : setCapture(placer = new PathPlacementTool(activeTab)); break;
              case 'text'   : setCapture(placer = new TextPlacementTool(activeTab)); break;
              case 'image'  : setCapture(placer = new ImagePlacementTool(activeTab)); break;
           }
           if (placer != null) {
              editor.prepareUndo();
              placer.commit = function(obj) { editor.storeUndo(); editor.selectPaletteItem('select'); selectObject(obj, false); }
              placer.cancel = function() { editor.clearUndo(); }
    }      }
       
    if (onpanelmousedown(evt) || editor.testMode()) {
       if (editor.testMode())
          clearSelection();
       return true;
    } else if (marquee == null) {    
      marquee = document.createElement("div");
      marquee.style.position = "fixed";
      marquee.style.borderStyle = "dashed";
      marquee.style.borderWidth = "2px";
      marquee.style.background = "none";      
      marquee.style.display = "none";
      marqueeX = event.clientX;
      marqueeY = event.clientY;     
      container.appendChild(marquee);      
    }
 }

function oneditormousemove (evt) {
    if (onpanelmousemove(evt) || editor.testMode())
      return true;
    else if (marquee != null) {
      clearSelection();    
      if (evt.clientX >= marqueeX) {
         marquee.style.left = marqueeX+"px";
         marquee.style.width = evt.clientX-marqueeX+"px";
      } else {
         marquee.style.left = event.clientX+"px";
         marquee.style.width = marqueeX-event.clientX+"px";
      }
      if (evt.clientY >= marqueeY) {
         marquee.style.top = marqueeY+"px";
         marquee.style.height = evt.clientY-marqueeY+"px";
      } else {
         marquee.style.top = event.clientY+"px";
         marquee.style.height = marqueeY-event.clientY+"px";
      }
      marquee.style.display = "inline";  
   }
 }

function oneditormouseup (evt) {
   if (onpanelmouseup(evt) || editor.testMode())
      return true;
   else if (marquee != null) {
      var panelRect = panel.getBoundingClientRect();
      var panelBox = panel.getBBox();
      var offsetX = panelRect.left-panelBox.x;
      var offsetY = panelRect.top-panelBox.y;
      var rect = panel.createSVGRect();
     
      if (marquee.style.left == "" ||  marquee.style.top == "") {
          // Clicked at a point - select or deselect based on the event target.
          // This gives the best hit-testing
          selectObject(evt.target, evt.ctrlKey);

      } else {
          // Dragged out a marquee
          rect.x = parseInt(marquee.style.left)-offsetX;
          rect.y = parseInt(marquee.style.top)-offsetY;
          rect.width = Math.max(parseInt(marquee.style.width), 1);
          rect.height = Math.max(parseInt(marquee.style.height), 1);   
          selectArea(rect);      
      } 
      container.removeChild(marquee);
      marquee = null;            
   } 
   if (evt.button == 2)
      editor.showContextMenu(evt.screenX, evt.screenY); 
 }

// Select an object, or the parent level object that owns it:
function selectObject (object, additive) {
   var objects = [];
   if (!additive)
      clearSelection();
   else if (selection != null) {
      objects = selection.objects;
      clearSelection();
   }
   
   if (object != null && !editor.testMode()) {
      // Object is at root level - treat as a normal/single selection.
      object = findParentObject(object);
      if (object != null) {
         var idx = objects.indexOf(object);
         if (idx == -1 || !additive)  
            objects.push(object);
         else 
            objects.splice(idx, 1); // remove the object
               
         selection = new Selection(objects, false);
         activeTab.appendChild(selection.obj);
   
      }
   }
}   

// Select objects wholly enclosed within the specified area:
function selectArea (rect) {   
   var items=panel.getEnclosureList(rect);
   var objects = []; // this array ensures that we only process each top level object once.
   for (var i=items.length-1; i>=0; --i) {
      var object = findParentObject(items[i]);
      if (object != null && objects.indexOf(object) == -1) 
         if (object.parentNode == activeTab)
            objects.push(object);
   }      
   if (objects.length != 0) 
      selectObjects(objects);
   else
      clearSelection(); 
       
}


// Select a control. If the control is not a top level object
// then only the property page is displayed.
function selectControl (object) {
   if (object != null && !editor.testMode()) {
      if (object == findParentObject(object)) {
         // Object is at root level - treat as a normal/single selection.
         var objects = [];
         objects.push(findParentObject(object));
         selectObjects(objects);
      }
      else if (object.hasAttribute('vfp:class')) {
         // Object is a control that is embedded in a group:
         // This is purely to allow config editing of grouped controls.
         var control = object;
         var props = {}
         props.id = control.id;          
         props.class = control.getAttribute('vfp:class');
         props.config = getControlConfig(control);
         editor.setSelection(1, props);
      }        
   }      
}   

function selectObjects (objects) {
   clearSelection();
   if (objects.length > 0 && !editor.testMode()) {
      selection = new Selection(objects, true);
      activeTab.appendChild(selection.obj);
   }   
}


function clearSelection () {
   if (selection != null) {
      var parent = selection.obj.parentNode;
      parent.removeChild(selection.obj);
      selection = null;
      capture = null; // just in case.
      editor.setSelection(0, {});
      editor.setCurrentStyle(defaultStyle);
   }
}  





/*********************************************************************
**** Selection Object ****
*************************/

function Selection (objects, multi) {
   var sel = this;   
   this.objects = objects;   
   
   this.obj = document.createElementNS(svgNS, "g");
   this.obj.id = "selection";
   this.obj.addClass('selection');
      
   if (objects.length > 1 || multi) {
      this.editor = new GroupEditor(this); 
   } else {
      var object = objects[0];
      switch (object.tagName) {
         case 'line'    : this.editor = new LineEditor (this, object); break;
         case 'rect'    : this.editor = new RectEditor (this, object); break;
         case 'circle'  : this.editor = new CircleEditor (this, object); break;
         case 'path'    : this.editor = new PathEditor(this, object); break;
         case 'image'   : this.editor = new RectEditor (this, object); break;
         default        : this.editor = new GroupEditor(this); break;
      }
   }      
   
   this.update();

   // Set up the mouse handler - n.b. doesn't capture if ctrl is pressed
   this.obj.onmousedown = function (evt) {
      evt.preventDefault(); 
      if (evt.button != 0)
         evt.stopPropagation();         
      else if (!evt.ctrlKey) {
         setCapture(sel);
      }
   }  
                                                                    
   return this;   
}

Selection.prototype.onmousedown = function (evt) {
   this.dragAnchor = panelPos(evt, true);   
   this.dragOrg = this.bounds.p1();
   this.dragWidth = this.bounds.width;
   this.dragHeight = this.bounds.height;            
   this.dragHandle = this.handles.indexOf(evt.target);
   this.dragMoved = false;   
   editor.prepareUndo();
   
   // Set up a temporary / extra transform on each object whilst we are dragging.
   // These are used to implement translation and also reszing etc. for the group editor.
   for (var i=0; i<this.objects.length; ++i) {
       var t = panel.createSVGTransform();
       this.objects[i].transform.baseVal.insertItemBefore(t, 0);
   }
               
   return true;
}   

Selection.prototype.onmousemove = function (evt) {
   var pos = panelPos(evt, true);
   if (this.editor.onmousemove != undefined)
      this.editor.onmousemove(evt);
   else if (this.dragHandle == -1) {   
      // Simple movement:
      var dx = pos.x - this.dragAnchor.x;
      var dy = pos.y - this.dragAnchor.y;            
      for (var i=0; i<this.objects.length; ++i) {
          var t = this.objects[i].transform.baseVal.getItem(0);
          t.setTranslate(dx, dy);
      }
      this.updateBounds();            
   } else if (this.editor.setHandlePos != undefined) {      
      // Movement of a handle:
      this.editor.setHandlePos(this.dragHandle, pos);
   }
   updateOverlays();
   this.dragMoved = true;         
   return true;
}
  
Selection.prototype.onmouseup = function (evt) {      
   // Consolidate the transforms:
   for (var i=0; i<this.objects.length; ++i) 
      this.objects[i].transform.baseVal.consolidate();
       
   // Store/cancel the editor in the undo system:    
   if (this.dragMoved) {
      this.update();
      editor.storeUndo();
   }
   else
      editor.clearUndo();   
      
   return false; // capturing ends
}

Selection.prototype.createRect = function (multi) {
   this.multi = multi;
   this.rect = document.createElementNS(svgNS, "rect");
   this.rect.addClass(this.multi ? 'multisel' : 'singlesel');
   this.rect.style.cursor = 'move';
   this.obj.appendChild(this.rect);
   return this.rect;
}

Selection.prototype.createHandles = function (n, node) {
   this.handles = [];
   for (var i=0; i<n; ++i) {
      var hdl = document.createElementNS(svgNS, "rect");
      hdl.addClass(this.multi ? 'handle' : 'node');
      this.handles.push(hdl);
      this.obj.appendChild(hdl);    
   }
   return this.handles;
}


// Re-compute the bounding rect of the selected objects, and then update the editor as well:
Selection.prototype.update = function () {
   this.updateBounds();
   
   // Update the editor with new geometry etc.
   var objects = this.objects;
   var props = {}  
   if (objects.length == 1) {
       // Single object:
       var object = objects[0]; 
       props.id = object.id;
          
       // Geometry
       var geometry = {}
       var rect = getBoundingRect(object);
       geometry.x = rect.x;
       geometry.y = rect.y;
       geometry.width = rect.width;
       geometry.height = rect.height;
       props.geometry = geometry;
       
       // Element specific properties for our own graphics primitives only:
       if (object.tagName != 'g') 
          getGraphicsProperties(object, props);       

       // Control config if the object is a control
       if (object.hasAttribute('vfp:class')) {
          props.class = object.getAttribute('vfp:class');
          props.config = getControlConfig(object);
          props.replicate = props.config.replicate;
          props.config.replicate = undefined; // avoid double refeerence 
       }         
       editor.setSelection(objects.length, props);
       
       // For debugging - this lets us make calls on the currently selected control.
       cc = object;
   }
   else {
      // Multiple objects:
      editor.setSelection(objects.length, {})   
      cc = null;
   }    
    
   // Determine the graphics style, if any from the selection. Where multiple objects and/or groups are selected,
   // the code sets only the members of 'style' which are the same.
   var graphics = [];
   var style = undefined;
   for (var i=0; i<objects.length; ++i)  
      getGraphicsObjects(graphics, objects[i]);         
   for (i=0; i<graphics.length; ++i) {
      var objStyle = getGraphicsStyle(graphics[i]);
      if (style == undefined)
         style = objStyle;
      else {
         if (objStyle.strokeColour != style.strokeColour)
            style.strokeColour = undefined;
         if (objStyle.strokeOpacity != style.strokeOpacity)
            style.strokeOpacity = undefined;
         if (objStyle.strokeWidth != style.strokeWidth)
            style.strokeWidth = undefined;
         if (objStyle.fillColour != style.fillColour)
            style.fillColour = undefined;
         if (objStyle.fillOpacity != style.fillOpacity)
            style.fillOpacity = undefined;                           
      }                           
   }
   if (style != undefined) 
      editor.setCurrentStyle(style);
}         

// Update the bounds and handles based on the new location of the objects:
Selection.prototype.updateBounds = function () {         
   // Caculate the new bounding rect:
   var bounds = null;
   for (var i=0; i<this.objects.length; ++i) {
      var obj = this.objects[i];
      var controls = [], overlays = [];
      getControlObjects(controls, obj);
      for (var j=0; j<controls.length; ++j)      
         if (controls[j].obj != undefined && controls[j].obj.update != undefined)
            controls[j].obj.update();  
      bounds = unionSVGRect(bounds, getBoundingRect(obj));               
   }
   this.bounds = bounds;   

   // Editor classes can implement either or both of setBounds and getHandlePos in order to
   // update the displayed selection:
   if (this.editor.setBounds != undefined)
      this.editor.setBounds(bounds);
   else if (this.rect != undefined) {
      this.rect.setAttribute('x', bounds.x);
      this.rect.setAttribute('y', bounds.y);
      this.rect.setAttribute('width', bounds.width);
      this.rect.setAttribute('height', bounds.height);   
   }
   if (this.editor.getHandlePos != undefined)   
      for (var i=0; i<this.handles.length; ++i) {
         var pt = this.editor.getHandlePos(i);
         this.setHandlePos(i, pt);
      }        

   // Update the overlays:      
   updateOverlays();      
             
}   

// Set the position of the specified handle
Selection.prototype.setHandlePos = function (idx, pt) {
   var hdl = this.handles[idx];
   var hw = this.multi ? 10 : 8;
   hdl.setAttribute('x', pt.x-hw/2); 
   hdl.setAttribute('y', pt.y-hw/2);
   hdl.setAttribute('width', hw); 
   hdl.setAttribute('height', hw);
}   
     

/*********************************************************************
**** Line Editor ****
********************/

function LineEditor (sel, line) {
   var rect = sel.createRect(false);
   var handles = sel.createHandles(2);
   var x1 = line.x1.baseVal.value; 
   var y1 = line.y1.baseVal.value;
   var x2 = line.x2.baseVal.value; 
   var y2 = line.y2.baseVal.value;
   
   
   this.setHandlePos  = function (idx, pos) {
      pos = toObjectPos(pos, line);
      switch (idx) {
         case 0 : x1 = pos.x; y1 = pos.y; break;
         case 1 : x2 = pos.x; y2 = pos.y; break;
      }      
      line.setAttribute('x1', x1); line.setAttribute('y1', y1); 
      line.setAttribute('x2', x2); line.setAttribute('y2', y2); 
      sel.updateBounds();
   }
      
   this.getHandlePos = function (idx) {
      var pt = panel.createSVGPoint();
      switch (idx) {
         case 0 : pt.x = x1; pt.y = y1; break;
         case 1 : pt.x = x2; pt.y = y2; break;
      }
      return toPanelPos(pt, line);
   }
   
   return this;
}   


/*********************************************************************
**** Rect Editor ****
********************/

function RectEditor (sel, rect) {
   var brect = sel.createRect(false);
   var handles = sel.createHandles(4);
   var x1 = rect.x.baseVal.value;
   var y1 = rect.y.baseVal.value;
   var x2 = x1 + rect.width.baseVal.value;
   var y2 = y1 + rect.height.baseVal.value;

   
   this.setHandlePos = function (idx, pos) {
      pos = toObjectPos(pos, rect);      
      switch (idx) {
         case 0 : x1 = pos.x; y1 = pos.y; break;
         case 1 : x2 = pos.x; y1 = pos.y; break;
         case 2 : x2 = pos.x; y2 = pos.y; break;
         case 3 : x1 = pos.x; y2 = pos.y; break;
      }      
      rect.setAttribute('x', x1 <= x2 ? x1 : x2);
      rect.setAttribute('y', y1 <= y2 ? y1 : y2);
      rect.setAttribute('width', Math.abs(x2-x1));
      rect.setAttribute('height', Math.abs(y2-y1));               
      sel.updateBounds();
   }
   
   this.getHandlePos = function (idx) {
      var pt = panel.createSVGPoint();
      switch (idx) {
         case 0 : pt.x = x1; pt.y = y1; break;
         case 1 : pt.x = x2; pt.y = y1; break;
         case 2 : pt.x = x2; pt.y = y2; break;
         case 3 : pt.x = x1; pt.y = y2; break;
      }
      return toPanelPos(pt, rect);
   }
   
   return this;
}   


/*********************************************************************
**** Circle Editor ****
********************/

function CircleEditor (sel, circle) {
   var rect = sel.createRect(false);
   var handles = sel.createHandles(4);
   var x = circle.cx.baseVal.value;
   var y = circle.cy.baseVal.value;
   var r = circle.r.baseVal.value;
   
   this.setHandlePos = function (idx, pos) {
      pos = toObjectPos(pos, circle);      
      switch (idx) {
         case 0 : r = pos.y-y; break;
         case 1 : r = pos.x-x; break;
         case 2 : r = y-pos.y; break;
         case 3 : r = x-pos.x; break;
      }      
      circle.setAttribute('r', Math.abs(r));               
      sel.updateBounds();
   }
   
   this.getHandlePos = function (idx) {
      var pt = panel.createSVGPoint();
      switch (idx) {
         case 0 : pt.x = x;   pt.y = y-r; break;
         case 1 : pt.x = x+r; pt.y = y;   break;
         case 2 : pt.x = x;   pt.y = y+r; break;
         case 3 : pt.x = x-r; pt.y = y;   break;
      }
      return toPanelPos(pt, circle);
   }
   
   return this;
}   

/*********************************************************************
**** Path Editor ****
********************/

function PathEditor (sel, path) {
   // Extract absolute coords from the path. 
   // TBD, deal with relative segment types
   // TBD, deal with bezier segment types.
   var segList = path.pathSegList;
   var nodes = [];
   var closed = false;
   for (var i=0; i<segList.numberOfItems; ++i) {
       var seg = path.pathSegList.getItem(i);
       var st = seg.pathSegTypeAsLetter;
       var pt = panel.createSVGPoint();
       var node = { seg: i, pos: pt };
       node.pos.x = seg.x;
       node.pos.y = seg.y; 
       node.type = seg.pathSegTypeAsLetter;
       switch (node.type) {
         case 'M' : 
         case 'L' : 
               nodes.push(node);
               break;
         
         case 'A' : 
               var pseg = segList.getItem(i-1); 
               var dx = node.pos.x-pseg.x;
               var dy = node.pos.y-pseg.y;
               if (seg.sweepFlag)
                  node.htv = (dx > 0) == (dy > 0);
               else   
                  node.htv = (dx > 0) != (dy > 0);
               nodes.push(node);
               break;            
         
         case 'Z' :              
            closed = true;
            break;
       }
   }
   
   var rect = sel.createRect(false);
   var handles = sel.createHandles(closed ? nodes.length-1 : nodes.length);
   
   this.setHandlePos = function (idx, panelPos) {
      var node = nodes[idx];
      var seg = segList.getItem(node.seg);
      var pos = toObjectPos(panelPos, path);      

      node.pos = pos;
      
      
      seg.x = pos.x;
      seg.y = pos.y;
            
      
      if (node.seg > 0 && node.type == 'A') {
         // Adjust radius and sweep of preceeding arc:
         var pseg = segList.getItem(node.seg-1);
         var dx = pos.x - pseg.x, dy = pos.y - pseg.y;
         if (dx >= 0 && dy >= 0 || dx < 0 && dy < 0)
             seg.sweepFlag = node.htv ? 1 : 0;
         else 
             seg.sweepFlag = node.htv ? 0 : 1;
         seg.r1 = Math.abs(dx);
         seg.r2 = Math.abs(dy);
      }  

      if (idx < nodes.length-1 && nodes[idx+1].type == 'A') {
         // Adjust radius and sweep of suceeeding arc:
         var nnode = nodes[idx+1];
         var nseg = segList.getItem(nnode.seg);
         var dx = nseg.x - pos.x, dy = nseg.y - pos.y;
         if (dx >= 0 && dy >= 0 || dx < 0 && dy < 0)
            nseg.sweepFlag = nnode.htv ? 1 : 0;
         else 
            nseg.sweepFlag = nnode.htv ? 0 : 1;
         nseg.r1 = Math.abs(dx);
         nseg.r2 = Math.abs(dy);
      }  
      
      if (idx == 0 && closed) {
         // Fake a movement of the last node which doesn't have a handle but
         // is notionally in the same place as the starting node.
         this.setHandlePos(nodes.length-1, panelPos);
      }
      
      sel.updateBounds();      
   }
   
   this.getHandlePos = function (idx) {
      return toPanelPos(nodes[idx].pos, path);
   }
   
   return this;
}   



/*********************************************************************
**** Group Editor ****
********************/

function GroupEditor (sel) {
   
   // Create the graphic objects:
   var rect = sel.createRect(true);
   var handles = sel.createHandles(8);
   var margin = 10;
          
   this.setHandlePos = function (idx, pos) {      
      // Move a drag handle and resize the selection.
      var p1 = sel.bounds.p1();
      var p2 = sel.bounds.p2();
      var ax, ay, sx, sy;
      
      // The logic here works out the new location of bounds, and an anchor point (basically the opposing handle)
      // to be used as an origin for the scaling transform. Note that pos needs to be compensated because it
      // is the location of the handle, not the actual sizing point on the bounding box.
      var mg = margin;
      switch (idx) {
         case 0 : ax = p2.x; ay = p2.y; p1.x = pos.x+mg; p1.y = pos.y+mg; break;
         case 1 : ax = (p1.x+p2.x)/2; ay = p2.y; p1.y = pos.y+mg; p2.x = p1.x + sel.dragWidth; break;
         case 2 : ax = p1.x; ay = p2.y; p2.x = pos.x-mg; p1.y = pos.y+mg; break;
         case 3 : ax = p1.x; ay = (p1.y+p2.y)/2; p2.x = pos.x-mg; p2.y = p1.y + sel.dragHeight; break;
         case 4 : ax = p1.x; ay = p1.y; p2.x = pos.x-mg; p2.y = pos.y-mg; break;
         case 5 : ax = (p1.x+p2.x)/2; ay = p1.y; p2.y = pos.y-mg; p2.x = p1.x + sel.dragWidth; break;
         case 6 : ax = p2.x; ay = p1.y; p1.x = pos.x+mg; p2.y = pos.y-mg; break;
         case 7 : ax = p2.x; ay = (p1.y+p2.y)/2; p1.x = pos.x-mg; p2.y = p1.y + sel.dragHeight; break;
      }
      
      // Compute width/height subject to limit of 3 grid squares.
      var svgGrid = panelGrid();
      var w = Math.max(p2.x - p1.x, 3*svgGrid);
      var h = Math.max(p2.y - p1.y, 3*svgGrid);
         
      // Compute scaling transform with origin at ax/ay:
      var m = panel.createSVGMatrix();
      sx = w / sel.dragWidth;
      sy = h / sel.dragHeight;
      m = m.translate(ax, ay); // Move back to the anchor point.
      m = m.scaleNonUniform(sx, sy);      // Apply scaling in x/y
      m = m.translate(-ax, -ay); // Move the anchor point to the origin.
      
      // Re-position the actual bounds.
      // This is done by computation off the original stored values (sel.dragXXX) so that we don't get
      // 'funnies' with cumulative errors affecting the computed position of the anchor point.
      var newbounds = panel.createSVGRect();
      newbounds.x = sel.dragOrg.x;
      newbounds.y = sel.dragOrg.y
      newbounds.width = sel.dragWidth;
      newbounds.height = sel.dragHeight;            
      newbounds = newbounds.matrixTransform(m);
      this.setBounds(newbounds);   
      
      // Now we can apply the result:
      for (var i=0; i<sel.objects.length; ++i) {
          var t = sel.objects[i].transform.baseVal.getItem(0);
          t.setMatrix(m);
      }
   }

   this.setBounds = function (bounds) {         
      var area = bounds.expand(margin);
      
      // Position the rectangle:
      rect.setAttribute('x', area.x);
      rect.setAttribute('y', area.y);
      rect.setAttribute('width', area.width);
      rect.setAttribute('height', area.height);   
         
      // Position the handles:   
      for (var i=0; i<8; ++i) {
         var pt = panel.createSVGPoint();
         switch (i) {
            case 0 : pt.x = 0; y = 0; break;
            case 1 : pt.x = area.width/2; pt.y = 0; break;
            case 2 : pt.x = area.width; pt.y = 0; break;
            case 3 : pt.x = area.width; pt.y = area.height/2; break;
            case 4 : pt.x = area.width; pt.y = area.height; break;
            case 5 : pt.x = area.width/2; pt.y = area.height; break;
            case 6 : pt.x = 0; pt.y = area.height; break;
            case 7 : pt.x = 0; pt.y = area.height/2; break;
         }
         pt.x += area.x;
         pt.y += area.y;
         sel.setHandlePos(i, pt);
      }
   }


   return this;
  
}



  


 
/*********************************************************************
**** Graphics Placement Tools ****
*********************************/

function ShapePlacementTool (parent, shape) {
    var state = 0;
    var p1, p2;
    var rect;
    var htv;

    var obj = document.createElementNS(svgNS, shape=='arc' ? 'path' : shape);        
    
    var style = editor.getCurrentStyle();    
    obj.style.strokeWidth = style.strokeWidth;
    obj.style.stroke = style.strokeColour;
    obj.style.strokeOpacity = style.strokeOpacity;
    obj.style.strokeLineCap='round';
    obj.style.fill = style.fillColour;
    obj.style.fillOpacity = style.fillOpacity; 
    
    obj.id = getUniqueObjectId(obj);    
    obj.addClass('graphics');

    this.onmousedown = function (evt) {
       if (state++ == 0) {
          parent.appendChild(obj);
          p1 = panelPos(evt, true);
          this.onmousemove(evt);
       }
       return true;
    }

    this.onmousemove = function (evt) {
       if (state == 1)
         p2 = panelPos(evt, true);
       switch (shape) {
           case 'line' :
              obj.style.fillOpacity = 0.0;              
              obj.setAttribute('x1', p1.x);
              obj.setAttribute('y1', p1.y);
              obj.setAttribute('x2', p2.x);
              obj.setAttribute('y2', p2.y);           
              break;
              
           case 'rect' :   
              var rect = makeSVGRect(p1, p2);       
              obj.setAttribute('x', rect.x);
              obj.setAttribute('y', rect.y);
              obj.setAttribute('width', rect.width);
              obj.setAttribute('height', rect.height);           
              break;

           case 'circle' :   
              var dx = p2.x-p1.x, dy = p2.y-p1.y;
              var radius = Math.sqrt(dx*dx+dy*dy);
              obj.setAttribute('cx', p1.x);
              obj.setAttribute('cy', p1.y);
              obj.setAttribute('r', radius);
              break;   
              
          case 'arc' : // quadrant arc                         
              var dx = p2.x-p1.x, dy = p2.y-p1.y;
              var sw;
              obj.style.fillOpacity = 0.0;
              if (p1.x == p2.x && p1.y == p2.y) {
                  htv = undefined;
                  obj.setAttribute('d','M '+p1.x+' '+p1.y);
              } else {               
                 if (htv == undefined)
                    htv = p1.x != p2.x;
                 if (dx >= 0 && dy >= 0 || dx < 0 && dy < 0)
                    sw = htv ? 1 : 0;
                 else 
                    sw = htv ? 0 : 1;
                 obj.setAttribute('d','M '+p1.x+' '+p1.y+' A '+Math.abs(dx)+' '+Math.abs(dy)+' 0 0 ' + sw + ' '+p2.x+' '+p2.y);
              }
              
       }
       
       return true;
    }
    
    this.onmouseup = function (evt) {    
        if (evt.button == 2) {
           parent.removeChild(obj); 
           this.cancel();
           return false;
        } else if (state == 2) {
           if (p1.x != p2.x || p1.y != p2.y)
              this.commit(obj);
           else {   
              parent.removeChild(obj); 
              this.cancel();
           }
           return false;
        }
        return true;
    }    
    
    this.commit = function () {} 
    this.cancel = function () {} 
}

function PathPlacementTool (parent) {
    var state = 0;
    var p0, p1, p2;
    var htv = undefined;
    var path, seg;
    var done = false;

    var obj = document.createElementNS(svgNS, 'path');        
    var style = editor.getCurrentStyle();    
    obj.style.strokeWidth = style.strokeWidth;
    obj.style.stroke = style.strokeColour;
    obj.style.strokeOpacity = style.strokeOpacity;
    obj.style.strokeLineCap='round';
    obj.style.fill = style.fillColour;
    obj.style.fillOpacity = 0;
    
    obj.id = getUniqueObjectId(obj);    
    obj.addClass('graphics');

    this.onmousedown = function (evt) {
       var pos = panelPos(evt, true);
       if (state++ == 0) {
          p0 = p1 = pos;
          path = 'M '+p0.x+' '+p0.y;
          parent.appendChild(obj);
       } else if (pos.x == p0.x && pos.y == p0.y) {
          // Closed the path and terminate
          obj.setAttribute('d', path+seg+'Z');
          obj.style.fillOpacity = style.fillOpacity;   
          done = true;   
       } else if (pos.x == p1.x && pos.y == p1.y) {
          // Two clicks at the same point - terminate an open path, last seg is null.
          obj.setAttribute('d', path);
          done = true;
       } else {
          // Add current segment and start a new one
          p1 = p2 = pos;
          path = path + seg;         
       } 
       return true;
    }

    this.onmousemove = function (evt) {
       if (!done) { 
          p2 = panelPos(evt, true);
          if (evt.ctrlKey == false)
              seg = 'L '+p2.x+' '+p2.y;
          else {
              var dx = p2.x-p1.x, dy = p2.y-p1.y;
              var sw;
              if (p1.x == p2.x && p1.y == p2.y) {
                 htv = undefined;
                 seg = "";
              } else {               
                 if (htv == undefined)
                    htv = p1.x != p2.x;
                 if (dx >= 0 && dy >= 0 || dx < 0 && dy < 0)
                    sw = htv ? 1 : 0;
                 else 
                    sw = htv ? 0 : 1;
                 seg = ' A '+Math.abs(dx)+' '+Math.abs(dy)+' 0 0 ' + sw + ' '+p2.x+' '+p2.y;
              }
          }
          obj.setAttribute('d', path+seg);
       }
       return true;
    }
    
    this.onmouseup = function (evt) {    
        if (evt.button == 2) {
           // TBD Possibility to undo segements here
           parent.removeChild(obj); 
           this.cancel();
           return false;
        } else if (done) {       
           this.commit(obj);
           return false;           
        }
        return true;
    }    
    
    this.commit = function () {} 
    this.cancel = function () {} 
}


function TextPlacementTool (parent) {
    var state = 0;
    var pos;

    var obj = document.createElementNS(svgNS, 'text');     
    
    obj.style.fontWeight="normal";
    obj.style.fontSize='20px';
    obj.style.fontFamily="sans-serif";
    obj.style.textAnchor="middle";
    obj.style.fill="#000000";
    obj.style.cursor = 'default';
    obj.textContent = 'text';
    
    obj.id = getUniqueObjectId(obj);    
    obj.addClass('text');

    this.onmousedown = function (evt) {
       if (state == 0) {
          parent.appendChild(obj);
          this.onmousemove(evt);
       }
       state++;
       return true;
    }

    this.onmousemove = function (evt) {
       pos = panelPos(evt, true);
       obj.setAttribute('x', pos.x);
       obj.setAttribute('y', pos.y);       
       return true;
    }
    
    this.onmouseup = function (evt) {    
        if (evt.button == 2) {
           parent.removeChild(obj); 
           this.cancel();
           return false;
        } else if (state == 2) {
           this.commit(obj);
           return false;
        }
        return true;
    }    

    this.commit = function () {} 
    this.cancel = function () {} 
}

function ImagePlacementTool (parent) {
    var state = 0;
    var p1, p2, rect

    var obj = document.createElementNS(svgNS, 'rect');             
    obj.addClass('image');

    this.onmousedown = function (evt) {
       if (state++ == 0) {
          p1 = panelPos(evt, true);       
          parent.appendChild(obj);
          this.onmousemove(evt);
       }
       return true;
    }

    this.onmousemove = function (evt) {
       if (state == 1) {
          p2 = panelPos(evt, true);
          rect = makeSVGRect(p1, p2);       
          obj.setAttribute('x', rect.x);
          obj.setAttribute('y', rect.y);
          obj.setAttribute('width', rect.width);
          obj.setAttribute('height', rect.height);    
       }
       return true;
    }
    
    this.onmouseup = function (evt) {    
        if (evt.button == 2) {
           parent.removeChild(obj); 
           this.cancel();
           return false;
        } else if (state == 2) {
           var fileName = editor.selectImageFile();
           if (fileName != "") {
              var image = document.createElementNS(svgNS, 'image');
              var id = image.id = getUniqueObjectId(obj);    
              image.setAttribute('xlink:href', fileName);
              image.setAttribute('x', rect.x);
              image.setAttribute('y', rect.y);
              image.setAttribute('width', rect.width);
              image.setAttribute('height', rect.height);    
              image.setAttribute("preserveAspectRatio", "xMidYMid");    
              parent.removeChild(obj); 
              parent.appendChild(image);
              reloadPanel();      
              image = document.getElementById(id);       
              this.commit(image);              
           } else {
              parent.removeChild(obj); 
              this.cancel();
           }
           return false;
        }
        return true;
    }    

    this.commit = function () {} 
    this.cancel = function () {} 
}


function getGraphicsProperties (obj, props) {
   switch (obj.tagName) {
      case 'line' :  
         props.style = getGraphicsStyle(obj, false); 
         break;
         
      case 'circle' :
      case 'ellipse' :
      case 'path' :   
         props.style = getGraphicsStyle(obj, true); 
         break;
         
      case 'rect' :
         props.style = getGraphicsStyle(obj, true); 
         props.rect = {}
         props.rect.rx = obj.rx.baseVal.value;
         props.rect.ry = obj.ry.baseVal.value;
         break;

      case 'text' :
         props.text = {}
         props.text.font = getFontStyle(obj); 
         props.text.content = obj.textContent;
         break;
         
      case 'image' :
         props.image = {}
         props.image.preserveAspectRatio = obj.getAttribute('preserveAspectRatio');
         break;      
   }
}

function setGraphicsProperties (obj, props) {
   switch (obj.tagName) {
      case 'line' :  
         setGraphicsStyle(obj, props.style); 
         break;
         
      case 'circle' :
      case 'ellipse' :
      case 'path' :   
         setGraphicsStyle(obj, props.style); 
         break;
         
      case 'rect' :
         setGraphicsStyle(obj, props.style);
         obj.setAttribute('rx', props.rect.rx);
         obj.setAttribute('ry', props.rect.ry);
         break;

      case 'text' :
         setFontStyle(obj, props.text.font);
         obj.textContent = props.text.content;
         break;
         
      case 'image' :
         obj.setAttribute('preserveAspectRatio', props.image.preserveAspectRatio);
         break;      
   }
}



/*********************************************************************
**** Support Functions ****
**************************/

// Instantiate a control, loading it from the control svg to the panel svg and merging any definitions.
function instantiateControl(id, elements,  svgroot) {
   // Duplicate the root level <g> object for the control:
   var control = findChildControl(svgroot);
   var carrier = control.cloneNode(true);
   carrier.id = id;
   
   // Remove inkscape stuff which might confuse manual editing:
   carrier.removeAttribute("inkscape:label");
   carrier.removeAttribute("inkscape:groupmode");   

   // Merge any new namespace declarations:
   mergeNameSpaces(svgroot, panel);
   
   // Merge defs into main document
   // This is potentially flawed in so much as that two different controls might use the same id for a gradient.
   // A work around is to ensure that the definitions are prefixed with the class name.
   // Alternatively, gradient and clip-path definitions can be located inside the control group - this may
   // require manual editing when working with inkscape.
   var panelDefs = container.getElementsByTagName("defs")[0];
   var controlDefs = svgroot.getElementsByTagName("defs")[0];   
   for (var newdef = controlDefs.firstElementChild; newdef != null; newdef = newdef.nextElementSibling) {
      for (olddef = panelDefs.firstElementChild; olddef != null; olddef = olddef.nextElementSibling) 
         if (olddef.id == newdef.id)  {
            break;
         }            
      if (olddef == null)   
         panelDefs.appendChild(newdef.cloneNode(true));      
      else {
         panelDefs.replaceChild(newdef.cloneNode(true), olddef);
      }            
   }

   // Look for and linear and radial gradients  so that they have unique ids:
   // N.B. concat is not implemented in our webkit
   var lgradients = carrier.getElementsByTagName('linearGradient');
   for (var i=0; i<lgradients.length; ++i) {
      var grad =  lgradients[i];
      var oldid = grad.id;
      grad.id = getUniqueObjectId(grad);
      rebindHrefs(carrier, 'xlink:href', oldid, grad.id);
      rebindHrefs(carrier, 'href', oldid, grad.id); // newer syntax
      rebindUrls(carrier, 'fill', oldid, grad.id);            
   }   
   var rgradients = carrier.getElementsByTagName('radialGradient');
   for (var i=0; i<rgradients.length; ++i) {
      var grad =  rgradients[i];
      var oldid = grad.id;
      grad.id = getUniqueObjectId(grad);
      rebindHrefs(carrier, 'xlink:href', oldid, grad.id);
      rebindHrefs(carrier, 'href', oldid, grad.id); // newer syntax
      rebindUrls(carrier, 'fill', oldid, grad.id);            
   }   
   
   // Look for and re-bind clip paths so that they have unique ids:
   var clipPaths = carrier.getElementsByTagName('clipPath');
   for (var i=0; i<clipPaths.length; ++i) {
      var path =  clipPaths[i];
      var oldid = path.id;
      path.id = getUniqueObjectId(path);
      rebindUrls(carrier, 'clip-path', oldid, path.id);            
   }   
   
   // Look for and re-annotate overlay targets so that they have unique ids:
   var targets = carrier.getElementsByClassName('target');
   for (var i=0; i<targets.length; ++i) 
      targets[i].id = getUniqueObjectId(targets[i]);
      
      
  return carrier; 
}     

function mergeNameSpaces (source, target) {
   var rx = /([a-zA-Z0-9_]*):([a-zA-Z0-9_\.]*)/;
   
   // Get the namespaces already declared in the target
   var namespaces = [];
   for (var i=0; i<target.attributes.length; ++i) {
      var parts = rx.exec(target.attributes[i].name);
      if (parts != null && parts.length == 3) 
         if (parts[1] == "xmlns")
            namespaces.push(parts[2]);
   }
      
   // Scan for namespace attributes in the source, adding any not already declared to the target:
   for (var i=0; i<source.attributes.length; ++i) {
      var parts = rx.exec(source.attributes[i].name);
      if (parts != null && parts.length == 3) {
         if (parts[1] == "xmlns") {
            if (namespaces.indexOf(parts[2]) == -1) {
               target.setAttribute(source.attributes[i].name, source.attributes[i].value)
               namespaces.push(parts[2]);
            }
         }
      }
   }         
}

function rebindHrefs (element, attribute, oldid, newid) {
   if (element.hasAttribute(attribute)) 
      if (element.getAttribute(attribute) == "#"+oldid)
         element.setAttribute(attribute, "#"+newid); 
   for (var child = element.firstElementChild; child != null; child=child.nextElementSibling) 
      rebindHrefs(child, attribute, oldid, newid);   
}

function rebindUrls (element, attribute, oldid, newid) {
   if (element.hasAttribute(attribute)) 
      if (element.getAttribute(attribute) == "url(#"+oldid+")")
         element.setAttribute(attribute, "url(#"+newid+")"); 
   if (element.style != undefined)
      if (element.style.getPropertyValue(attribute) == "#"+oldid) {
         var style = element.style;
         style.removeProperty(attribute);
         element.setAttribute("style", style.cssText+attribute+":url(#"+newid+");");
      }
   for (var child = element.firstElementChild; child != null; child=child.nextElementSibling) 
      rebindUrls(child, attribute, oldid, newid);   
}


function replicateControl (control, config) {
   var replicate = config.replicate;
   var elements = control.getElementsByClassName('element');
   if (replicate === undefined || elements.length == 0)
      return; // Control is not multi-element
   
   var numElements = parseInt(replicate.count);
   if (numElements != elements.length) {
      while (elements.length > 1)
         control.removeChild(elements[1]);
      for (var i=1; i<numElements; ++i)
         control.appendChild(elements[0].cloneNode(true));
   }
   
   var width = parseInt(replicate.width);
   var height = parseInt(replicate.height);
   var spacing = parseInt(replicate.spacing);
   var direction = parseInt(replicate.direction);   
   
   for (var i=1; i<numElements; ++i) {
      var dx=0, dy=0;
      switch (direction) {
         case 0 : dx = i*(width+spacing); break;
         case 1 : dy = i*(height+spacing); break;
         case 2 : dx = -i*(width+spacing); break;
         case 3 : dy = -i*(height+spacing); break;
      }
      elements[i].setAttribute('transform','translate('+dx+','+dy+')');
   }
       
}


// Set a single property or group value.
// This is now implemeneted as a get/set operation, whereby the new value  is assigned 
// directly to the  config object and then the config is re-assigned control element.
function setConfigProperty  (control, group, name, value) {
   var config = getControlConfig(control);
   setGroupProperty(config, group, name, value);
   setControlConfig(control, config);
}   

function setGroupProperty  (props, group, name, value) {
   var item = props
   if (group != "") { 
      var names = group.split('.');
      for (var j=0; j<names.length; ++j) {
         group = names[j];
         if (typeof (item[group]) != 'object')
            item[group] = {}; // create empty group
          item = item[group];   
      }         
   }
   item[name] = value;
}   

function getFontStyle (obj) {
   var style = obj.style != undefined ? obj.style : obj; // legacy
   var font = {};
   font.family = style.fontFamily;
   font.weight = style.fontWeight;
   font.style = style.fontStyle;
   font.decoration = style.textDecoration;
   font.colour = style.fill;
   font.size = parseInt(style.fontSize);
   return font;
}

function setFontStyle (obj, font) {
   var style = obj.style != undefined ? obj.style : obj; // legacy
   style.fontFamily = font.family;
   style.fontWeight = font.weight;
   style.fontStyle = font.style;
   style.textDecoration = font.decoration;
   style.fill = font.colour;
   style.fontSize = font.size+"px";
   return font;
}
   
function getGraphicsStyle (obj) {
   var gstyle = {};   
   var style = obj.style;
   gstyle.strokeColour = style.stroke;
   gstyle.strokeOpacity = style.strokeOpacity;
   gstyle.strokeWidth = parseFloat(style.strokeWidth);
   gstyle.fillColour = style.fill;
   gstyle.fillOpacity = style.fillOpacity;

   // Parse the stroke type - dashes are defined as being longer than the stroke width.
   var da = style.strokeDasharray.split(',');
   if (da.length < 2)
      gstyle.strokeType = 0; // solid
   else 
      gstyle.strokeType = (parseInt(da[0]) > parseInt(style.strokeWidth)) ? 2 : 1;            
   return gstyle;
}

function setGraphicsStyle (obj, gstyle) {
   var style = obj.style;
   style.stroke = gstyle.strokeColour;
   style.strokeOpacity = gstyle.strokeOpacity;
   style.strokeWidth = gstyle.strokeWidth;
   style.fill = gstyle.fillColour;
   style.fillOpacity = gstyle.fillOpacity;
   
   var sw = parseInt(gstyle.strokeWidth);
   switch (parseInt(gstyle.strokeType)) {
      default  : style.strokeDasharray = "none"; break;
      case 1   : style.strokeDasharray = sw+','+sw; break;
      case 2   : style.strokeDasharray = 5*sw+','+5*sw; break;
   }
}

// Return all the graphics primitives for obj.
// This includes both obj itself and also anything inside groups.
function getGraphicsObjects (graphics, obj) {
   if (isGraphicObject(obj))
      graphics.push(obj);
   else if (obj.tagName == 'g' && !isControlObject(obj))  // exclude controls
      for (var child=obj.firstElementChild; child != null; child=child.nextElementSibling)   
         getGraphicsObjects(graphics, child);
}   

function isGraphicObject (obj) {
   var types = ['line', 'rect', 'circle', 'ellipse', 'path' ];
   return types.indexOf(obj.tagName) != -1;
}   

// Return all the control objects for obj.
// This includes both obj itself and also anything inside groups.
function getControlObjects (controls, obj) {
   if (obj == undefined)
      return;
   if (isControlObject(obj))
      controls.push(obj);
   else 
      for (var child=obj.firstElementChild; child != null; child=child.nextElementSibling)  {
         getControlObjects(controls, child);
      }
}   
          
// Recurse the hierarchy of a control svg looking for the first 'g' record with a vfp:class attribute.
// This is the root level group of the control which is what we need to insert into the document.
function findChildControl (node) {
   var result = null;   
   for (var child=node.firstElementChild; child!=null && result==null; child=child.nextElementSibling) {
      if (child.tagName == 'g') {
         if (isControlObject(child))
            result = child;
         else
            result = findChildControl(child);
      }
   }
   return result;               
}   

function isControlObject (obj) {
   return obj != undefined && obj.tagName == 'g' && obj.hasAttribute('vfp:class');
}   

// Walk up the hierarchy from node to find the root level parent object.
// This will be one level down from the tab/layer groups.
function findParentObject (node) {
   while (node.tagName != 'BODY') {
      if (node.parentNode.getAttribute('inkscape:groupmode')=='layer')
         return node;
      node = node.parentNode;
   }
   return null;
}


// Walk up the hierarchy from node to find the parent 'g' record with a vfp:class attribute
function findParentControl (node) {
   while (node != panel) {
      if (node.hasAttribute('vfp:class'))
         return node;
      node = node.parentNode;     
   }
   return null;
}

// Force object and all it's children to have unique obeject ids.
// The object must *not* be in the document at the point of scanning.
function setUniqueObjectIds (object) {
   var duplicates = false;
   if (object.hasAttribute('id') &&  document.getElementById(object.id) != null) {
      object.id = getUniqueObjectId(object);
      duplicates = true;
   }
   for (var child=object.firstElementChild; child != null; child=child.nextElementChild)
      duplicates |= setUniqueObjectIds(child);
   return duplicates;   
}

// Choose a new unique object id for the specified object.
// This is quite simular to InkScape's id generation.
function getUniqueObjectId (object) {
   var stem = object.tagName;
   var id;
   do {
      var r = Math.floor(Math.random() * 10000);
      var s = '0000'+r;
      id =  stem+s.substr(s.length-4);
   } while (document.getElementById(id) != null);
   return id;
}

// Return the bounding box of an object in panel coordinates.
// This function will use any child objects with class 'bounds' if such exists in the control - otherwise it uses getBBox().
function getBoundingRect (object) { 
   var brect = null;
   var bounds = object.getElementsByClassName("bounds");
   if (object.hasAttribute('vfp:class') && bounds.length > 0)
       for (var i=0; i<bounds.length; ++i) {
          var rect = bounds[i].getBBox().matrixTransform(bounds[i].getCTM());
          brect = unionSVGRect(brect, rect);
       }
   else    
       brect = object.getBBox().matrixTransform(object.getCTM());   
   brect.x += panelBounds.x;
   brect.y += panelBounds.y;
   return brect;
}   

// Translate mouse coords to an SVG point.
function panelPos (evt, snap) {   
   var panelRect = panel.getBoundingClientRect();
   var panelBox = panel.getBBox();
   var grid = panelGrid();
   var x = event.clientX-panelRect.left+panelBox.x;
   var y = event.clientY-panelRect.top+panelBox.y;
   if (snap && editor.snapToGrid()) {
      x = grid*Math.round(x/grid);
      y = grid*Math.round(y/grid);
   }
   return { x: x, y: y };
}

// Translate an svg panel co-ordinate to an object co-ordinate
function toObjectPos (pt, obj) {
   var p = panel.createSVGPoint();
   var ctm = obj.getCTM();
   p.x = pt.x-panelBounds.x;
   p.y = pt.y-panelBounds.y;
   p = p.matrixTransform(ctm.inverse());
   return p;
}

// Translate from an object co-ordinate to a panel co-ordinate
function toPanelPos (pos, obj) {
   var p = panel.createSVGPoint();
   var ctm = obj.getCTM();
   p = pos.matrixTransform(ctm);
   p.x = p.x+panelBounds.x;
   p.y = p.y+panelBounds.y;
   return p;
}

// JS/Webkit hack to force a rebuild of xlink:href and url links.
function rebuildUrlRefs (element) {
   element.style.display="block";
   window.setTimeout(function() { element.style.display="inline";  }, 1); 
}

// JS/Webkit hack to rebuild the panel after importing images etc.
function reloadPanel () {    
    // Reload the panel svg element to force a refresh
    var activeTabId = activeTab.id;
    var svgText = container.innerHTML;
    setPanelSVG(svgText);
    selectTabByName(activeTabId);
} 
  
 
/*********************************************************************
**** SVG Utilities ****
**********************/

SVGElement.prototype.translate = function (x, y) {
    var t = panel.createSVGTransform();
    t.setTranslate(x, y);
    this.transform.baseVal.insertItemBefore(t, 0);
    this.transform.baseVal.consolidate();
}

// addClass method
SVGElement.prototype.addClass = function (classList) {
    // Because the className property can be animated through SVG, we have to reach
    // the baseVal property of the className SVGAnimatedString object.
    var currentClass = this.className.baseVal;

    // Note that all browsers which currently support SVG also support Array.forEach()
    classList.split(' ').forEach(function (newClass) {
        var tester = new RegExp('\\b' + newClass + '\\b', 'g');
         if (-1 === currentClass.search(tester)) {
            currentClass += ' ' + newClass;
        }
    });

    // The SVG className property is a readonly property so 
     // we must use the regular DOM API to write our new classes.
     this.setAttribute('class', currentClass);

     return this;
 };

// removeClass method
SVGElement.prototype.removeClass = function (classList) {
    "use strict";

    // Because the className property can be animated through SVG, we have to reach
    // the baseVal property of the className SVGAnimatedString object.
    var currentClass = this.className.baseVal;

    // Note that all browsers which currently support SVG also support Array.forEach()
    classList.split(' ').forEach(function (newClass) {
        var tester = new RegExp(' *\\b' + newClass + '\\b *', 'g');

        currentClass = currentClass.replace(tester, ' ');
    });

    // The SVG className property is a readonly property so 
    // we must use the regular DOM API to write our new classes.
    // Note that all browsers which currently support SVG also support String.trim()
    this.setAttribute('class', currentClass.trim());

     return this;
};

// toggleClass method
SVGElement.prototype.toggleClass = function (classList) {
    "use strict";

    // Because the className property can be animated through SVG, we have to reach
    // the baseVal property of the className SVGAnimatedString object.
    var currentClass = this.className.baseVal;

    // Note that all browsers which currently support SVG also support Array.forEach()
    classList.split(' ').forEach(function (newClass) {
        var tester = new RegExp(' *\\b' + newClass + '\\b *', 'g');

        if (-1 === currentClass.search(tester)) {
            currentClass += ' ' + newClass;
        } else {
            currentClass = currentClass.replace(tester, ' ');
        }
    });

    // The SVG className property is a readonly property so 
    // we must use the regular DOM API to write our new classes.
    // Note that all browsers which currently support SVG also support String.trim()
    this.setAttribute('class', currentClass.trim());

    return this;
};

SVGElement.prototype.hasClass = function (className) {
    // Because the className property can be animated through SVG, we have to reach
    // the baseVal property of the className SVGAnimatedString object.
    var currentClass = this.className.baseVal;
    var tester = new RegExp(' *\\b' + className  + '\\b *', 'g');
    return currentClass.search(tester) != -1;
};

SVGRect.prototype.p1 = function () {
   var p = panel.createSVGPoint();
   p.x = this.x;
   p.y = this.y;
   return p;
};  

SVGRect.prototype.p2 = function () {
   var p = panel.createSVGPoint();
   p.x = this.x + this.width;
   p.y = this.y + this.height;
   return p;
}   

SVGRect.prototype.centre = function () {
   var p = panel.createSVGPoint();
   p.x = this.x + this.width/2;
   p.y = this.y + this.height/2;
   return p;
}   

// Set a rectangle from two points.
SVGRect.prototype.set = function (p1, p2) {
   if (p2 == null) {
      this.x = p1.x; this.width = 1;
   } else if (p1.x < p2.x) {
      this.x = p1.x; this.width = p2.x-p1.x+1;
   } else {
      this.x = p2.x; this.width = p1.x-p2.x+1;
   }
   if (p2 == null) {
      this.y = p1.y; this.height = 1;
   } else if (p1.y < p2.y) {
      this.y = p1.y; this.height = p2.y-p1.y+1;
   } else {
      this.y = p2.y; this.height = p1.y-p2.y+1;
   }
  return this;    
}

// Return rect transformed by  ctm.
SVGRect.prototype.matrixTransform = function (ctm) {
   return makeSVGRect(this.p1().matrixTransform(ctm), this.p2().matrixTransform(ctm));
}   

// Return rect expanded by a distance.
SVGRect.prototype.expand = function (e) {
   var result = panel.createSVGRect();
   result.x = this.x-e;
   result.y = this.y-e;
   result.width = this.width+2*e;
   result.height = this.height+2*e;
   return result;
}   

// Make a new SVG rect from two points.
function makeSVGRect (p1, p2) {
   var r = panel.createSVGRect();
   if (p2 == null) {
      r.x = p1.x, r.width = 1;
   } else if (p1.x < p2.x) {
      r.x = p1.x; r.width = p2.x-p1.x+1;
   } else {
      r.x = p2.x; r.width = p1.x-p2.x+1;
   }
   if (p2 == null) {
      r.y = p1.y, r.height = 1;
   } else if (p1.y < p2.y) {
      r.y = p1.y; r.height = p2.y-p1.y+1;
   } else {
      r.y = p2.y; r.height = p1.y-p2.y+1;
   }
  return r;    
}

// Return the union of two rects
function unionSVGRect (r1, r2) {
   var result = null;
   if (r2 == null)
      result = r1;
   else if (r1 == null)   
      result = r2;
   else {
      result = panel.createSVGRect();
      result.x = r1.x < r2.x ? r1.x : r2.x;
      result.y = r1.y < r2.y ? r1.y : r2.y;
      result.width = r1.x+r1.width > r2.x+r2.width ? r1.x+r1.width-result.x : r2.x+r2.width-result.x;
      result.height = r1.y+r1.height > r2.y+r2.height ? r1.y+r1.height-result.y : r2.y+r2.height-result.y;
   }
   return result;   
}

// Return the intersection of two rects.
function intserectionSVGRect (r1, r2) {
   var result = null;
   if (r1 != null && r2 != null) {
      // TBD
   }
   return null; 
}

