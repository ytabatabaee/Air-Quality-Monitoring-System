// Virtual Front Panel - Javascript Framework.

var svgNS = 'http://www.w3.org/2000/svg';
var vfpNS = 'http://www.labcenter.com/namespaces/vfp';

var panelBounds = null;
var controlObjects = [];
var pageTitle = "";
var activeTab = null;
var capture = null;
    
function initPage() {
   window.onbeforeunload = function() { if (typeof(editor)=='object') removeSignalHandlers(); statusAbort(); };       
   
   if (typeof(statusRequest) != "function") {
      container.innerHTML = "<P class=\"error\">File 'transport.js' is missing.<BR>Please update the driver of the VFP server.</P>";                     
      return;
   }
   
   if (typeof(transport) == "object") {
      // Simulation mode: cheat by loading the panel directly:
      var content = transport.loadResource("panel.svg"); // TBD - choose form factor?
      if (content != "") {
         var div = document.createElement("div");
         div.innerHTML = content;               
         var panelRoot = div.firstElementChild;
         panelRoot.setAttribute("class", "panel");                                    
         container.replaceChild(panelRoot, container.firstChild);        
         initPanel(panelRoot); 
         return;
      }
   }

   var xhttp = new XMLHttpRequest();
   xhttp.onreadystatechange = function() {
      if (xhttp.readyState == 4) {
         if (xhttp.status == 200) {
            var container = document.getElementById("container");                                    
            var panelDoc = xhttp.responseXML; 
            var panelRoot = panelDoc.documentElement;
            panelRoot.setAttribute("class", "panel");                                    
            container.replaceChild(panelRoot, container.firstChild);
            initPanel(panelRoot);
         }
         else if (xhttp.status == 404) {
            var container = document.getElementById("container");                     
            container.innerHTML = "<P class=\"error\">PANEL.SVG not found - please refer to the documentation</P>";                     
         }          
      }
   };
   xhttp.open("GET", "/panel.svg", true);
   xhttp.send(); 
}

function initPanel (svg) {
   // Set the pageTitle and active tab.
   var tabs = getTabsArray();
   if (svg.hasAttribute('vfp:title'))
      pageTitle = svg.getAttribute('vfp:title');
   else
      pageTitle = document.title;

   // If operating under viewer, we may need to resize to the panel and pass over the tab names:
   if (typeof(viewer) == 'object') {
      if (viewer.setTabNames != undefined) {
         var tabNames = [];
         for (var i=0; i<tabs.length; ++i)
            tabNames.push(tabs[i].id);
         viewer.setTabNames(tabNames);      
      }
      if (viewer.resize != undefined) {
         var panelRect = svg.getBoundingClientRect();
         viewer.resize(panelRect.width, panelRect.height);
      }      
   } 
      
   // Set up for either editing or viewing:
   if (typeof(editor) == 'object')
      initEditor(tabs.length == 0);
   else {
      // Set up for touch vs mouse operation:
      if ('ontouchstart' in window) {
         window.addEventListener("touchstart", onpaneltouchstart, {passive: false} );
         window.addEventListener("touchmove", onpaneltouchmove, {passive: false} );
         window.addEventListener("touchend", onpaneltouchend, {passive: false} );
         removeScrollers();
         convertToStrip();
      } else { 
         window.onmousedown=onpanelmousedown;
         window.onmouseup=onpanelmouseup;
         window.onmousemove=onpanelmousemove;            
      }
      
      // Select the first tab:
      selectTabByOrdinal(0);   
   }
 
   // Show the scrollers (if not removed above) for a multi-tab display:  
   if (tabs.length > 1)
      showScrollers();        
      
   // Store this for future use:   
   panelBounds = panel.createSVGRect();
   panelBounds.width = panelWidth();
   panelBounds.height = panelHeight();
   panelBounds.x = -panelBounds.width/2;
   panelBounds.y = -panelBounds.height/2;
   
   // Create the controls:
   for (var i=0; i<tabs.length; i++) {
      var controlNodes = tabs[i].getElementsByTagName("g");
      for (var j=0; j<controlNodes.length; j++) {         
         if (controlNodes[j].hasAttribute("vfp:class")) {
            var root = controlNodes[j];
            var control = initControl(root, getControlConfig(root), false);
            if (control != null) {
                controlObjects[root.id]=control;
                console.log("Created",  control, "with id", root.id);            
            }
         }
      }
   }   
   

   // Update the overlays after a tick - this issues related to the nested CSS layout:
   window.setTimeout(updateOverlays, 1);
      
   // Kick off the reverse AJAX process:
   statusRequest(); 
}

// Create a controller class object for the specified group element:
function initControl (root, config, reconfigure) {
   var control = null;
   var className = root.getAttribute("vfp:class");
   if (eval("typeof "+className+" == \"function\"")) {
      control = eval(" new "+className+"(root, config)");
      control.id = root.id;
      root.obj = control; // allows access to the class object from the element
      
      if (reconfigure && control.reconfigure != undefined) {
         var newinstance = (getVfpConfig(root) === undefined);
         control.reconfigure(newinstance);
      }
   }
   return control;
}

function showScrollers () {
   var scrollers = document.getElementsByClassName("scroller");
   for (var i=0; i<scrollers.length; ++i)
      scrollers[i].style.display="inline";
}   

// Remove the scrollers. 
function removeScrollers() {
    var cells = document.getElementsByTagName("td");
    if (cells.length == 3) {
       cells[0].innerHTML = "";
       cells[2].innerHTML = "";
    }
}   

// Reconfigure the panel for touch/swipe scrolling:
function convertToStrip() {
   // Relocate the tabs to form a horizontal strip and make them all visible:
   var tabs = getTabsArray();
   for (var i=0; i<tabs.length; ++i) {
       if (i > 0) {
          var t = panel.createSVGTransform();
          var offset = i*panelWidth();
          t.setTranslate(offset, 0);
          tabs[i].transform.baseVal.initialize(t, 0);
       }
       tabs[i].style.display="inline";
   }
   
   // Duplicate the background.
   // The existing background image is moved into a group:
   var background = document.getElementById("Background");
   var image = background.firstElementChild;
   if (image.firstElementChild == null) {
      var group = document.createElementNS(svgNS, 'g');
      background.replaceChild(group, image);
      group.appendChild(image);
       
      // Step repeat for the additonal tabs. 
      for (var i=1; i<tabs.length; ++i) {
          var copy = image.cloneNode(true);
          var t = panel.createSVGTransform();
          var offset = i*panelWidth();
          t.setTranslate(offset, 0);
          copy.transform.baseVal.appendItem(t, 0);
          group.appendChild(copy);
      }
   }
}

// Revert the actions of convert to strip - this is largely for debugging:
function revertToStack() {
   // Remove transforms from the tabs:
   var tabs = getTabsArray();
   for (var i=1; i<tabs.length; ++i) {
      tabs[i].transform.baseVal.clear();
      tabs[i].style.display= tabs[i] == activeTab ? "inline" : "none";
   }
   
   // Remove duplicated background images:
   var background = document.getElementById("Background");
   var group = background.firstElementChild;
   var image = group.firstElementChild;
   if (image != null)
      background.replaceChild(image, group);   
   
   // Reset the viewbox:   
   scrollToTab(0);   
}   

function isScrollable() {
   var background = document.getElementById("Background");
   var image = background.firstElementChild;
   return image.firstElementChild != null;
} 


// Example POST method implementation:
async function postData(url = '', data = {}) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json'
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data) // body data type must match "Content-Type" header
  });
  return response.json(); // parses JSON response into native JavaScript objects
}

var elastic_counter = 0;
async function elasticFunction(data) {
	var thisDevice = 3;
	//postData('http://localhost:9200/iot/_delete_by_query', 
	//{
	//"query": {
	//	"match": {
	//		"device": thisDevice
    //}
    //}
    //})
	//.then(data => {
	//	console.log(data); // JSON data parsed by `data.json()` call
	//});
	
	postData('http://localhost:9200/iot/_doc', 
	{
	"device": thisDevice,
	"i": elastic_counter,
	"data": data,
    })
	.then(data => {
		elastic_counter += 1;
		console.log(data); // JSON data parsed by `data.json()` call
	});
}


function parseResponse (responseText) {
   var lines = responseText.split('\n');
   for (var i in lines) {
      if (lines[i].length > 0) {
         // The regex parses object.member = args and object.member (args)
         var rx = /([$a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_\.]*)\s*\=?\s*(.*)/;
         var parts = rx.exec(lines[i]);
         var command;
         if (parts != null && parts.length == 4) {
            var ctl = parts[1];
            var member = parts[2];
            var args = parts[3];
            if (ctl=="$") {              
               switch(member.split('.')[0]) {
                  case "title" :  pageTitle = eval(args); updateDocumentTitle(); break;
                  case "create" :
                     var control = member.split('.')[1];
                     var className = eval(args);
                     controlObjects[control] = eval(" new "+className+"('"+control+"')");
                     break;
               }                        
            } else if (typeof controlObjects[ctl] == "object") {
               console.log(lines[i]); 
			   if (lines[i].includes("IotChart1.append", 0)){
					elasticFunction(lines[i]);
			   }
               if (args[0] == '(') {
                  // Simple method call:
                  command = 'controlObjects[ctl].'+member+args; 
               } else {
                  // Assignments are translated to a setXXX call here, if such a function is defined or setState(member, value) if that is defined.
                  // This could be removed once we know we have ECMA 6 browsers everywhere since we could use actual setters
                  var setter = 'set'+member[0].toUpperCase()+member.substring(1);
                  if (controlObjects[ctl][setter] != undefined)   
                     command = 'controlObjects[ctl].'+setter+'('+args+')'; 
                  else if (controlObjects[ctl].setState != undefined)
                     command = 'controlObjects[ctl].'+setState+'("'+member+'",'+args+')'; 
                  else
                     command = 'controlObjects[ctl].'+member+'='+args;
               }
               if (typeof command === "string") {
                  try {
                     eval(command);
                  } catch(err) {
                     console.log("Eval:"+err.message)   
                  }
               }
            }
         }
      }
   }
}

// Select next tab:
function selectNextTab () {
   var tabs = getTabsArray();
   var idx = getTabIndex();
   if (idx < tabs.length-1)
      selectTabByOrdinal(idx+1)
   else   
      selectTabByOrdinal(idx);
}   

// Select previous tab:
function selectPreviousTab () {
   var tabs = getTabsArray();
   var idx = getTabIndex();
   if (idx > 0)
      selectTabByOrdinal(idx-1)      
   else   
      selectTabByOrdinal(0)      
}

// Select a tab by zero based ordinal.
// Note that the first layer is always the background image.
function selectTabByOrdinal (n) {
   var tabs = getTabsArray();
   var prevTab = activeTab;
   if (isScrollable())
      scrollToTab(n, true);
   else {
      for (var i=0; i<tabs.length; ++i) {
         if (i == n) 
            tabs[i].style.display="inline";
         else
            tabs[i].style.display="none";
      } 
   }
   activeTab = tabs[n];
   updateDocumentTitle();
   updateOverlays();

   if (typeof(editor) == 'object' && activeTab != prevTab) {
     clearSelection();
     showTabLabel(true);   
   }
} 


// Show the named tab, hide all the others
// Note that the first layer is always the background image.
function selectTabByName (name) {
   var tabs = getTabsArray();
   var prevTab = activeTab;
   for (var i=0; i<tabs.length; ++i) {
      if (tabs[i].id == name) {
         tabs[i].style.display = "inline";
         activeTab = tabs[i];
         updateDocumentTitle();
      }
      else
         tabs[i].style.display = "none";
   }
  if (typeof(editor) == 'object' && activeTab != prevTab) {
     clearSelection();
     showTabLabel(true);   
  }
  updateOverlays();
}   

function updateDocumentTitle () { 
   var tabs = getTabsArray();
   if (tabs.length > 1)
      document.title = pageTitle + " - " + activeTab.id;
   else
      document.title = pageTitle;   
   if (typeof(viewer) == 'object' && viewer.setConnected != undefined) 
      viewer.setConnected(1); // This needed for IoS - we should really have a hander in the app but it was messy - 

}   

// Return the array of top level <g> elements excluding the background.
function getTabsArray () {
   var tabs = [];
   var count = 0;
   for (var child=panel.firstElementChild; child != null; child=child.nextElementSibling)
      if (child.tagName == 'g' && count++ > 0)
         tabs.push(child);
   return tabs;         
}

// Return the ordinal of the current tab.
function getTabIndex () {
   var tabs = getTabsArray();
   for (var i=0; i<tabs.length; ++i)
      if (tabs[i] == activeTab)
         return i;
   return 0; // default      
}

// Translate mouse coords to a point within an svg object by using that object's CTM.
function getEventPos (evt, obj) {   
   var panelRect = panel.getBoundingClientRect();
   var p = panel.createSVGPoint();
   var ctm = obj.getCTM();
   p.x = evt.clientX-panelRect.left;
   p.y = evt.clientY-panelRect.top;
   p = p.matrixTransform(ctm.inverse());
   return p;

}

function isVisible (obj) {
   while (obj != null && obj != panel) {
      if (obj.style.display == 'none')
         return false;
      obj = obj.parentNode;   
   }
   return true;   
}   

// Return true if a control has been configured:
function hasControlConfig (control) {
   return control.hasAttribute('vfp:config') || control.getElementsByTagName('vfp:config')[0] != undefined;   
}    

// Return the control config properties as a JS object.
// Attribute names containing ',' characters result in a hierarchical object definition.
function getControlConfig(control) {
   // Control config, if present:   
   var config = {};      
   var elem = getVfpConfig(control);
   if (elem != undefined) {
      if (elem.firstChild != null) {
         // New style: JSON string is stored as escaped text
         config = JSON.parse(elem.textContent);
      }
      else if (elem.hasAttributes()) {
         // Legacy - config is stored as attributes of a vfp:config element
         // These are parsed in order to re-assemble the config object.
         while (elem.attributes.length > 0) {
            var name = elem.attributes[0].name;
            var names = name.split('.');
            var item = config;
            for (var j=0; j<names.length-1; ++j) {
               var group = names[j];
               if (item[group] == undefined)
                  item[group] = {};
               item = item[group];   
            }
            item[names[j]] = elem.attributes[0].value;               
            elem.removeAttribute(name);
         }
                        
         // Re-store as JSON text
         setControlConfig(control, config);   
      }      
   }          
   return config;
}

// Store a config object as escaped JSON text
function setControlConfig (control, config) {
   var configNode = getVfpConfig(control);
   var json = JSON.stringify(config);
   if (configNode == undefined) {
      configNode = document.createElement('vfp:config'); // May not work in newer browsers
      control.appendChild(configNode);
   }
   configNode.textContent = json;
}   

// Return the vfp:config element - this is a bit quirky due to namespace issues in webkit
function getVfpConfig (control) {
   var elem = control.getElementsByTagNameNS(vfpNS, 'config')[0];
   if (elem == undefined)
      elem = control.getElementsByTagName('vfp:config')[0]; // For legacy webkit
   return elem;   
}    


// Create a JS element over to overlay a specified region of a control 
function createOverlay (owner, target, elementType) {
   if (target.overlay == undefined)
      target.overlay = document.createElement(elementType);      

   var panelRect = container.getBoundingClientRect();
   var ctrlRect = target.getBoundingClientRect();
   var top = ctrlRect.top - panelRect.top;
   var left = ctrlRect.left - panelRect.left;
   var width = ctrlRect.right - ctrlRect.left; 
   var height = ctrlRect.bottom - ctrlRect.top;
   var overlay = target.overlay;   
   overlay.onmousedown = function (e) { e.stopPropagation(); }
   overlay.onmouseup   = function (e) { e.stopPropagation(); }   
   overlay.style.position = "absolute"
   overlay.style.top = top+"px";
   overlay.style.left = left+"px";
   overlay.style.width = width +"px";
   overlay.style.height = height +"px";
   overlay.style.paddingLeft = "0px";
   overlay.style.paddingRight = "0px";
   overlay.style.paddingTop = "0px";
   overlay.style.paddingBottom = "0px";
   overlay.style.background = 'none';
   overlay.style.borderStyle = "none";
   container.appendChild(overlay);
   overlay.owner = owner;
   overlay.target = target;
   return overlay;
}

function deleteOverlay (overlay) {
   overlay.target.overlay = undefined;
   container.removeChild(overlay);
}

// Re-position all overlay objects to make them consistent with the panel.
function updateOverlays () {
   var panelRect = container.getBoundingClientRect();
   var overlay, next;
   for (overlay=panel.nextElementSibling; overlay != null; overlay=next) {
       var owner = overlay.owner;
       var target = overlay.target;
       next = overlay.nextElementSibling;
       if (target != undefined) {
           var ctrlRect = target.getBoundingClientRect();
           if (document.getElementById(target.id) == null)
              // The overlay has been orphaned, remove it
              container.removeChild(overlay);
           else if (!isVisible(target)) {
              // The target is not visible, hide the overlay:
              overlay.style.visibility = 'hidden';            
           } else {
              // Re-position the overlay over it's target
              var top = ctrlRect.top - panelRect.top;
              var left = ctrlRect.left - panelRect.left;
              var width = ctrlRect.right - ctrlRect.left;
              var height = ctrlRect.bottom - ctrlRect.top;       
              overlay.style.top = top+"px";
              overlay.style.left = left+"px";
              overlay.style.width = width +"px";
              overlay.style.height = height +"px";
              overlay.style.visibility = 'visible';
          
              // Set up clipping on the overlay. CSS clip is deprecated but CSS clip-path is not as yet in webkit
              // so it's probably OK to use clip.
              var ctop = Math.max(0, panelRect.top - ctrlRect.top)+'px';
              var cleft = Math.max(0, panelRect.left - ctrlRect.left)+'px';
              var cright = Math.max(0, panelRect.right - ctrlRect.left)+'px';
              var cbottom = Math.max(0, panelRect.bottom - ctrlRect.top)+'px';
              var clip = 'rect('+ctop+','+cright+','+cbottom+','+cleft+')';
              overlay.style.clip = clip;
           } 
       }  
   }       
}   


// Convert CSV to an array of string values. Returns NULL if CSV string not well formed.
function CSVtoArray (text) {
    var re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
    var re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    // Return NULL if input string is not well formed CSV string.
    if (!re_valid.test(text)) return null;
    var a = [];                     // Initialize array to receive values.
    text.replace(re_value, // "Walk" the string using replace with callback.
        function(m0, m1, m2, m3) {
            // Remove backslash from \' in single quoted values.
            if      (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
            // Remove backslash from \" in double quoted values.
            else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
            else if (m3 !== undefined) a.push(m3);
            return ''; // Return empty string.
        });
    // Handle special case of empty last value.
    if (/,\s*$/.test(text)) a.push('');
    return a;
}

// Built in sound effects:
function buttonClick() { playSound(0); }
function playAlarm() { playSound(1); }
function playSound (effect) {
   if (typeof viewer == "object" && "play" in viewer) 
      viewer.play(effect);
}   

// Haptic feedback
function vibrate (t) {
   if (typeof viewer == "object" && "vibrate" in viewer)
       viewer.vibrate(t);   
   else if ("vibrate" in navigator)
      navigator.vibrate(t);
}   

// Return panel resolution properties in svg coords
function panelWidth() { return parseInt(panel.getAttribute("width")); }
function panelHeight() { return parseInt(panel.getAttribute("height")); }
function panelDpi() { return panel.hasAttribute("vfp:dpi") ? parseInt(panel.getAttribute("vfp:dpi")) : 163; }
function panelGrid() { return panel.hasAttribute("vfp:grid") ? parseInt(panel.getAttribute("vfp:grid")) : 10; }

// Mouse/touch handling:
// The aim here is to abstract mousedown/move/up gestures in a manner that is independent from mouse/touch functionality.
// Controls can then be developed in a mouse based environment with a good chance that they will work just as well on a touch screen.
// N.B. The presence of a window.touchstart function (outside of our webkit) indicates a touch device.

// Capture immediately over the whole window to a pure JS object
function setCapture (object, multi) {
   if (capture == null)
      capture = { control: object, element: null };
}

// Initiate capture when specified element is clicked
function setHotSpot(control, element) {
   if (control.onclick != undefined) {
      // Simulate a click to a JS object on an associated SVG element
      element.onclick = function(e) {
         if (capture == null)
            if (typeof(editor) != 'object' || editor.testMode()) 
               control.onclick(e, element);
      }
   } else { 
      // Capture to a JS object via an associated SVG element
      element.ontouchstart = function (e)  {
         if (capture == null)
            if (typeof(editor) != 'object' || editor.testMode()){  
               capture = { control: control, element: element };
            }             
      }
      element.onmousedown = function (e)  {
         if (capture == null)
            if (typeof(editor) != 'object' || editor.testMode()){  
               capture = { control: control, element: element };
            }
      }
   }
}   

// Cancel hotspot bindings
function clearHotSpot(control, element) {
    element.onclick = null;
    element.ontouchstart = null;
    element.onmousedown = null;
}

var touchTimer = null;
var touchFirst, touchLast;
var touchGesture;

function onpaneltouchstart (evt) {
   if (typeof popup_container == "object")
      return;
   touchFirst = touchLast = evt.touches.item(0);
   touchTimer = setTimeout (function () { 
         if (capture != null) {
            onpanelmousedown(touchToMouse(evt, touchFirst));
         } else {
            touchGesture = true;
         }
         touchTimer=null;
      }, 200);
   touchGesture = evt.touches.length > 1;
   evt.preventDefault();
   
}   

function onpaneltouchmove (evt) {
   if (typeof popup_container == "object")
      return;
   touchLast = evt.touches.item(0);
   if (touchGesture) {
     var dx = touchLast.screenX-touchFirst.screenX;
     var dy = touchLast.screenY-touchFirst.screenY;
     scrollToTab(scrollPosition-dx/window.innerWidth, false);
   } else if (evt.touches.length > 1) {  
     touchGesture = true;         
     clearTimeout(touchTimer);      
   } else if (touchTimer != null) {
      // Pointer is moved significantly during the disambiguation period.  Unless the mouse has been captured by a control's
      // ontouchstart handler, this is deemed to be the start of a touch gesture. Otherwise, nothing happens until the time code fires, at which point
      // the control will see a mousedown and then any further move messages.
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
         if (capture == null) {
            touchGesture = true;
            clearTimeout(touchTimer);
         }
      }   
   } else if (capture != null)
      onpanelmousemove(touchToMouse(evt, touchLast));   
   evt.preventDefault();
}   

function onpaneltouchend (evt) {   
   var dx = touchLast.screenX-touchFirst.screenX;
   if (typeof popup_container == "object")
      return;
   if (touchGesture) {  
      // If we've captured the scroll strip, what happens next depends on how far the user has dragged it.
      if (dx > window.innerWidth / 4) {
         // Finish a swipe right.
         scrollPosition -= dx / window.innerWidth;
         selectPreviousTab();
      }
      else if (dx < -window.innerWidth / 4) {
         // Finish a swipe left
         scrollPosition -= dx / window.innerWidth;
         selectNextTab();
      }
      else {
         // Revert to current tab.
         scrollToTab(scrollPosition, true)
      }
   } else if (touchTimer != null) {
      // Touch start/end in the disambiguation period
      if (dx > 10) {
         // Quick swipe right
         selectPreviousTab();
         capture = null;
      } else if (dx < -10) {
         // Quick swipe left
         selectNextTab();
         capture = null;
      } else {
         // Tap - simulated a mouse click
         setTimeout(function() { onpanelmousedown(touchToMouse(evt, touchFirst)); },0 );
         setTimeout(function() { onpanelmouseup(touchToMouse(evt, touchFirst)); }, 200);
      }
   } else if (touchTimer == null) {
      // End of standard mouse gesture. 
      setTimeout(function() { onpanelmouseup(touchToMouse(evt, touchLast)); }, 100);
   }
   clearTimeout(touchTimer);
   touchTimer = null;         
   evt.preventDefault();
}   

// Convert a touch event to a mouse event
function touchToMouse (evt, t) {
  if (t != null) {
     evt.screenX = t.screenX;
     evt.screenY = t.screenY;
     evt.clientX = t.clientX;
     evt.clientY = t.clientY;
  }
  evt.button = 0;
  return evt;
}  


function onpanelmousedown (evt) {
    if (evt.target.tagName == "HTML")
       return true; // This occurs if the event is outside the document area, e.g. on the scrollbars.

    evt.preventDefault();
    
    if (capture != null) {
       if (capture.control.onmousedown != undefined)  {
          capture.control.onmousedown(evt, capture.element);
          vibrate(10);
       }   
       return true;
    }
    
    return false;
 }

function onpanelmousemove (evt) {
   evt.preventDefault();
   
   if (capture != null) {
      if (capture.control.onmousemove != undefined)  
        capture.control.onmousemove(evt, capture.element);      
      return true;
   }
   return false;
 }

function onpanelmouseup (evt) {
   evt.preventDefault();

   if (capture != null) { 
       if (capture.control.onmouseup != undefined)
          if (capture.control.onmouseup(evt, capture.element) == true)
             return true; // If the control's mouseup handler returns true, capturing continues
       capture = null;
       return true;
   }
      
   return false;
 }   

// Scroll the strip so that tab 'n' is visible in the svg viewport.
// n can be fractional so as to allow for swipe animation 
var scrollTarget = 0;    // Target scroll position
var scrollPosition = 0;  // Current scroll positiob
var scrollVelocity = 0;  // Current velocity of the scrolling
var scrollTimer = null;  // Timer / interval used for the animation callbacks
var scrollInterval = 50; // Scroll animation period (ms)

function scrollToTab(n, animate) {
   var numTabs = getTabsArray().length; 
   if (n < -0.1)
      n = -0.1;
   else if (n > numTabs-0.9)
      n = numTabs-0.9;         
   if (animate) {
      if (!scrollTimer) 
         scrollTimer = setInterval(scrollAnimate, scrollInterval); 
      scrollTarget = n;   
   } else {
      var w = panelWidth();
      var h = panelHeight();
      var viewBox = (n*panelWidth()-w/2)+" "+(-h/2)+" "+w+" "+h;
      panel.setAttribute("viewBox", viewBox);
      updateOverlays();     
   }
}   

function scrollAnimate () {
   // Calculate distance and velocity. 
   var accelFactor = 10 / 1000;   // How fast the movement accelerates wrt distance
   var frictFactor = 1; // Resistance slowing the needle down
   var stickyness = 1 / 10000; // The needle will eventually jump or stick to the target value, 
   var dist = scrollTarget - scrollPosition;
   var dV = (dist * accelFactor) - (scrollVelocity * frictFactor);
   scrollVelocity += dV;
     
   // Calculate the new scroll position using the calculated change in velocity, 
   // taking into account "stickyness" (which causes the needle to jump to the target value 
   // and end the animation
   if ((Math.abs(dist) < stickyness) && (Math.abs(scrollVelocity) < stickyness)) {
      // The current position is close enough to the destination (target) and also moving slowly, 
      // so jump it to the final value and end the animation
      scrollPosition = scrollTarget;
      scrollVelocity = 0;
      clearInterval(scrollTimer);
      scrollTimer = null;
   } else {
      // Calculate the new position using the change in velocity,
      // also scaling it back into actual pixels
      scrollPosition += (scrollVelocity * scrollInterval);
   }
   scrollToTab(scrollPosition, false);
}  

