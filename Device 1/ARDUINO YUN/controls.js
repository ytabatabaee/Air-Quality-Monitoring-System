// C:/Program Files (x86)/Labcenter Electronics/Proteus 8 Professional/VSM Studio/controls/PanelMeter/control.js

function PanelMeter(root, config) {
   var obj = this;
   var scale = root.getElementsByClassName('scale')[0];
   var scaleArc = scale.getElementsByTagName('path')[0];
   var needle = root.getElementsByClassName('needle')[0];
   var labelText = root.getElementsByClassName('label')[0];
   
   var minValue = parseFloat(config.min);
   var maxValue = parseFloat(config.max);   
   var numDivs = parseInt(config.numDivs);
   var numSubDivs = parseInt(config.numSubDivs);
   var tickLength = parseFloat(config.tickLength); 
   var subTickLength = parseFloat(config.subTickLength);
   var showTicks = parseInt(config.showTicks);
   var showLabels = parseInt(config.showLabels);
   
   var numTicks = numDivs * numSubDivs;
   var range = maxValue - minValue;   
   var valuePrecision = ((maxValue - minValue) % numTicks == 0) ? 0 : 2;

   // Use the endpoints of the scale path to compute the minimum and maximum angles:
   // The scale path must be an unclosed path running left to right, typically it will be an arc.
   var l = scaleArc.getTotalLength();
   var p1 = scaleArc.getPointAtLength(0);
   var p2 = scaleArc.getPointAtLength(l);
   var hdx = (p2.x-p1.x)/2;
   var arcRadius = Math.sqrt(p1.x*p1.x+p1.y*p1.y);
   
   if(p1.y < 0){
   var amin = -Math.asin(hdx/arcRadius);
   var amax = +Math.asin(hdx/arcRadius);
   } else {
   var amin = -Math.acos(hdx/arcRadius) - Math.atan(1)*2;
   var amax = +Math.acos(hdx/arcRadius) + Math.atan(1)*2;}
   
   
   // Needle animation variables
   var curValue = minValue; // Current value of the needle as it is moving during the animation
   var targetValue; // Target value of the needle - where it is heading for and should settle 
                    // (what the user has set using setValue() )
   var velocity = 0; // Current velocity of the needle
   var tmrAnim = null; // Timer / interval used for the animation callbacks

   // Needle animation parameters
   var useAnim = parseInt(config.animateNeedle); // Enable or disable animation
   var intAnim = 50; // Animation interval (milliseconds)
   var accelFactor = 1 / 1000; // How fast the needle accelerates
   var frictFactor = 300 / 1000; // Resistance slowing the needle down
   var targetStickyness = 10 / 100000; // The needle will eventually jump or stick to the target value, 
                                      // this determines how quickly that happens

   labelText.style.pointerEvents = "none";   
   
   this.reconfigure = function (newInstance) {      
      // Default font configuration is taken from valueText
      if (newInstance) {
         if (config.label == undefined)
            config.label = labelText.textContent;
         config.scaleColour = scaleArc.style.stroke;
         config.labelFont = getFontStyle(labelText.style); 
         config.scaleFont = getFontStyle(labelText.style); 
         config.scaleFont.size = 0.75*config.labelFont.size;
      }      
      
      // Set the initial value - this sets the position of the rotor in the svg so only 
      // needs to be done at config time.
      setFontStyle(labelText.style, config.labelFont);                     

      // Create the ticks and labels as required:
      createTicks();
      createLabels(); 
      //curValue = minValue; // Already done above at curValue declaration
      this.setValue(minValue);
      
      labelText.textContent = config.label;
      scaleArc.style.stroke = config.scaleColour;
   
      t = labelText;    
      c = config;         
   }

   function setAngleByValue(value) { 
      // Calculate and apply the needle angle (rotation transform) from the set value
      var angle = amin + (value - minValue) / (maxValue - minValue) * (amax - amin);
      angle = angle*180/Math.PI;
      needle.setAttribute("transform", "rotate(" + angle + ")");                 
   }

   function updateAngle() { // Update the needle angle using curValue
     setAngleByValue(curValue);
   }

   function animUpdate() { // Update the needle animation
     // Calculate how far the needle is from the destination,
     // scaling by range to bring the value into the range of 0-1
     // (so that the animation calibration values can be used consistently
     //  accross different ranges)
     var dist = (targetValue - curValue) / range;
     // Calculate and apply the needle acceleration (change in velocity)
     var dV = (dist * accelFactor) - (velocity * frictFactor);
     velocity += dV;
     //console.log("Dist: " + dist + ", Velocity: " + velocity);
     // Calculate the new needle position using the calculated change in velocity, 
     // taking into account "stickyness" (which causes the needle to jump to the target value 
     // and end the animation
     if ((Math.abs(dist) < (targetStickyness)) && 
         (Math.abs(velocity) < (targetStickyness))) {
       // The needle is close enough to the destination (target) and also moving slowly, 
       // so jump it to the final value and end the animation
       curValue = targetValue;
       velocity = 0;
       clearInterval(tmrAnim);
       tmrAnim = null;
     } else {
       // Calculate the new needle position using the change in velocity,
       // also scaling it back into the proper range
       curValue += ((velocity * intAnim) * range);
     }
     updateAngle();
   }
    
   this.setValue = function(v) {
      value = parseFloat(v);
      if (value < minValue)
         value = minValue;
      else if (value > maxValue)
         value = maxValue;

      targetValue = value;
      if (useAnim) {
        if (!tmrAnim) {tmrAnim = setInterval(function() {animUpdate();}, intAnim);}
      } else {
        curValue = targetValue;
        updateAngle();
      }
            
   }
    
   this.setLabel = function(text) {
      labelText.textContent = text;
   }
         
   function createTicks () {
      // Remove previous ticks:
      var ticks = root.getElementsByClassName('tick');
      while (ticks.length > 0)
         scale.removeChild(ticks[0]);
      
      if (showTicks) {
         // Create ticks as paths and append them to the document
         var radius = arcRadius;
         var angleStep = (amax - amin) / numDivs;
         var angleSubStep = angleStep / numSubDivs;
         var angleStart = amin;
         for (var i=0; i<=numDivs; i++) {
            var angle = angleStart + angleStep * i;
       
            for (var j=0; j<numSubDivs; j++) {
               var x = Math.sin(angle);
               var y = -Math.cos(angle);
               var len = (j==0 ? tickLength : subTickLength);
               
               var tick = document.createElementNS(svgNS, "path");            
               tick.style.fill = 'none';
               tick.style.stroke = config.scaleColour;
               tick.style.strokeWidth = '1.5px';
               tick.setAttribute('class', 'tick');
               tick.setAttribute("d", "m " +
                  (x * radius) + "," + 
                  (y * radius) + " " +
                  (x * len) + "," +
                  (y * len));
               scale.appendChild(tick);
               
               if (i == numDivs)
                  break;
               angle += angleSubStep;
            }
         }      
      }
   }    

   function createLabels () {
      // Remove previous labels:
      var labels = scale.getElementsByClassName('value');
      while (labels.length > 0)
         scale.removeChild(labels[0]);
      
      if (showLabels) {
         // Create labels based on the font settings of the value text (or possibly a font config) and append them to the document
         var radius = arcRadius + 2.0 + (showTicks ? tickLength : 0);
         var angleStart = amin;
         var angleStep = (amax - amin) / numDivs;
         var valueStart = minValue;
         var valueStep = (maxValue-minValue) / numDivs;
         var labelPrecision = (range % numDivs == 0) ? 0 : 1;
         for (var i=0; i<=numDivs; i++) {
            var label = labelText.cloneNode(true);
            var angle = angleStart + angleStep * i;
            var value = valueStart + valueStep * i;
            label.setAttribute('class', 'value');
            label.style.dominantBaseline="central";
            setFontStyle(label.style, config.scaleFont);         
            label.textContent = value.toFixed(labelPrecision);
            scale.appendChild(label);
   
            // TBD, attempt to offset for size of the text box 
            var w = label.getBBox().width;
            var h = label.getBBox().height * 0.6;
            var x = (radius+w/2)*Math.sin(angle);
            var y = (radius+h/2)*-Math.cos(angle); 
            label.setAttribute('x', x);
            label.setAttribute('y', y);
         }             
      }                       
   }
   
   return this;
      
};


// C:/Program Files (x86)/Labcenter Electronics/Proteus 8 Professional/VSM Studio/controls/PushButton/control.js

function PushButton (root, config) {    
      var obj = this;     
      var bounds = root.getElementsByClassName("bounds")[0];
      var lamp = root.getElementsByClassName("lamp")[0];
      var bbox = bounds.getBBox();
      var label = root.getElementsByTagName("text")[0];
      var icons = root.getElementsByClassName('buttonIcon');         
      var faces = root.getElementsByClassName('buttonFace');         
      var mode = parseInt(config.mode);  
      var autoLamp = parseInt(config.autoLamp);
      var pressed = false;
      var state = false;
      var isIconButton = (icons.length != 0);
      
	    if (faces.length<1){
	    	  config.faceColour = undefined 
	    }else{
	    	  config.faceColour = config.faceColour === undefined ? faces[0].style.fill : config.faceColour;
	    }
	    
	    if (!isIconButton){
	    	config.icon = undefined
	    }else{
	    	config.icon = config.icon === undefined ? "0" : config.icon;
	    }
      
	    
	    var symbols = !isIconButton ? root.getElementsByTagName("g") : icons[parseInt(config.icon)].getElementsByTagName("g") ; 
	  
      setHotSpot(this, root);     

      // Fix legacy issues with inkscape:
      symbols[0].removeAttribute('display');
      symbols[1].removeAttribute('display');

      this.reconfigure = function (newinstance) {
         if (newinstance) {
            
           config.labelFont = getFontStyle(label);
            
            // Set thelamp colours from the skin. 
            config.lampColour = lamp != undefined ? lamp.style.fill : undefined;
         }   
   
         label.firstChild.nodeValue = config.labelText;
         label.style.pointerEvents = "none";   
         setFontStyle(label, config.labelFont);
         
         var x = null, y = null;
         var h = label.getBBox().height * 0.6;
         var s = parseInt(config.labelSpacing);
         switch (parseInt(config.labelPosition)) {
            case 1 : label.style.textAnchor = "middle"; x = bbox.width/2; y = -s;  break;
            case 2 : label.style.textAnchor = "middle"; x = bbox.width/2; y = bbox.height+s + h; break;
            case 3 : label.style.textAnchor = "end"; x = -s; y = bbox.height/2 + h/2; break;
            case 4 : label.style.textAnchor = "start";  x = bbox.width+s; y = bbox.height/2 + h/2; break;            
         }   
         
         if (x != null && y != null) { 
            label.setAttribute('x', x);
            label.setAttribute('y', y); 
            label.style.display = "inherit"; 
         } else {
            label.style.display = "none"; 
         }
         
         // Display only the selected icon. This code does nothing if there are no icons.
         for (var i = 0; i<icons.length; ++i)
            icons[i].style.display = i==config.icon ? 'inline' : 'none';
        
         // Set the face colour for all icons or faces
         for (var i = 0; i<faces.length; ++i) 
            faces[i].style.fill = config.faceColour;    
                  
         this.setState(false, true);
         this.setLamp(false);
         display(false);
      };
      
      this.onmousedown = function (evt) {
         if (mode == 0) {
             this.setState(true);
         } if (mode == 1) {
             this.setState(true);
             postEvent(obj.id, 1);               
         }                              
         display(true);
         buttonClick();
      };
      
      this.onmousemove = function(evt) {
         var p = getEventPos(evt, bounds);
         var r = bbox;
         var hit = p.x >= r.x && p.y >= r.y && p.x<=r.x+r.width && p.y<=r.y+r.height;

         if (mode == 0) {
           this.setState(hit);
         } else if (mode == 1) {
            if (hit != pressed) {
               this.setState(hit);
               postEvent(obj.id, hit ? 1 : 0);                      
            }
         }             
         display(hit);         
         
      };
      
      this.onmouseup = function (evt) {
         if (pressed) {
            display(false);
            if (mode == 0) {
               this.setState(false); 
               postEvent(obj.id, -1);
            } else if (mode == 1) {
               this.setState(false); 
               postEvent(obj.id, 0);               
            } else if (mode == 2)  {                   
               this.setState(!state); 
               postState(obj.id, "state", state ? 1 : 0);               
            }
         }
      };
  
     this.setState = function (newstate, force) {
         if (newstate != state || force == true) {
            state = newstate
         }
         if (autoLamp)
            obj.setLamp(state);
     }; 

     this.setLamp = function (flag) {
        if (lamp != undefined) {
           lamp.style.fill = config.lampColour;
           lamp.style.opacity = flag ? 1.0 : 0.2;
        }         
     };
      
     function display (down) {
         if (down) {
            symbols[0].style.display = 'none';
            symbols[1].style.display = 'inline';
         } else {
            symbols[0].style.display = 'inline';
            symbols[1].style.display = 'none';
         }
         pressed = down;
     }    
     
     return this;
}   





// C:/Program Files (x86)/Labcenter Electronics/Proteus 8 Professional/VSM Studio/controls/LineChart/control.js
require('moment.js');
require('chart.js');

// Used by Chart.JS 2.6.0 but part of ECMA 6
Number.MAX_SAFE_INTEGER = 9007199254740991;
Number.MIN_SAFE_INTEGER = -9007199254740991;


function LineChart (root, config)  {
   var xAxisType = root.getAttribute('vfp:xtype');
   var background = root.getElementsByTagName('rect')[0];
   var bounds = root.getElementsByTagName('rect')[1];
   var chartarea = root.getElementsByTagName('rect')[2];
   var obj = this;
            
   // Member variables:
   var chart = null;
   var ctx = null;
   var columns = [];
   var xAxis, xmin, xmax;
   var loadDataPending = false;
   var loadDataPendingRows = [];
      
   this.reconfigure = function(newInstance) {
      if (newInstance) {
         // Get rid of the design graphics:     
         root.removeChild(root.getElementsByTagName("path")[0]);

         // Create an empty columns array if not defined:
         if (config.columns ==  undefined)
            config.columns = {};
         
         // Remove unwanted x-axis groups from the config object:
         if (xAxisType != 'Numeric')
            delete config.xRange; 
         if (xAxisType != 'Time')  
            delete config.timeRange;              
            
         config.backGroundColour = background.style.fill; 
      }
            
      // Set up the correct number of column groups in the config object 
      var rebuild = false;
      var columns = config.columns;
      for (var i=0; i<10; ++i) {   
         var col = columns[i];
         if (i<config.numColumns) {
            if (col == undefined || col.name == undefined) {
               // Create default settings for a new column:
               col = {};
               col.name = "Column "+i;
               col.axis = "0";
               col.colour = "#000000";
               col.min = "0";
               col.max = "0";
               columns[i] = col;
               rebuild = true;
            }
         } else if (columns[i] != undefined) {
           // Remove the column data
           delete columns[i];
           rebuild = true;
         }            
      }
      
      // If the number of columns is changed, we need to do a full rebuild, otherwise we can just update the options:
      if (rebuild) {
         setControlConfig(root, config);
        rebuildChart();
      } else {
        updateChart();
      }
         
      
      // Update the background colour:
      background.style.fill = config.backGroundColour;
      
         
   };

   this.update = function () {
      // Fix the border width:
      var ctm = root.getCTM();
      var tbt = panel.createSVGTransform();
      tbt.setScale(1/ctm.a, 1/ctm.d);
      background.transform.baseVal.initialize(tbt);
      background.width.baseVal.value = bounds.  width.baseVal.value*ctm.a;
      background.height.baseVal.value = bounds.height.baseVal.value*ctm.d;      
      
      // Only needed for Chart.JS 2.2.2
      // chart.resize();
   };
   

   // Set up a numeric  x axis with the specified range (numeric data only)
   this.setXRange = function (xmin, xmax) {
      chart.options.scales.xAxes[0].display = true;
      chart.options.scales.xAxes[1].display = false;
      xAxis = chart.options.scales.xAxes[0];
      xAxis.ticks.min = xmin;
      xAxis.ticks.max = xmax;
      updateRange()
   };
   
   this.setTimeRange = function (unit, range, absolute) {
      chart.options.scales.xAxes[0].display = false;
      chart.options.scales.xAxes[1].display = true;
      xAxis = chart.options.scales.xAxes[1];
      
      // Choose a time unit and sensible step size            
      var timeUnits = [ 
       { name: 'second', secs: 1,      steps: [ 2, 5, 10, 30, 60, 120, 300, 600, 3600  ] }, 
       { name: 'minute', secs: 60,     steps: [ 2, 5, 10, 30, 60, 120, 300, 480, 1200 ] },
       { name: 'hour',   secs: 3600,   steps: [ 2, 4, 12, 24, 48,  120, 168, 336 ]  },
       { name: 'day',    secs: 86400,  steps: [ 2, 7, 14, 28, 35,  70,  140, 350, 700, 3500 ] },
       { name: 'week',   secs: 604800, steps: [ 2, 4,  8, 12, 26,  52,  104, 208, 408, 804 ] }
      ];
      xAxis.time.unit = timeUnits[unit].name;
      xAxis.time.unitStepSize = 1;
      for (var i = 0; i<timeUnits[unit].steps.length; i++)
         if (range / timeUnits[unit].steps[i] >= 4)
            xAxis.time.unitStepSize = timeUnits[unit].steps[i];     

      // this is what it's called in 2.6.0
      xAxis.time.stepSize =  xAxis.time.unitStepSize; 
      
      // Choose a display format based on abs/rel.
      if (absolute)               
          xAxis.time.displayFormats  = { second: 'HH:mm:ss', minute: 'HH:mm', hour: 'HH:mm', day: 'MMM DD', week: 'MMM YY' };
      else    
          xAxis.time.displayFormats  = { second: 'mm:ss', minute: 'HH:mm',    hour: 'HH:mm', day: 'DDD HH:mm', week: 'DDD' };
      xAxis.time.tooltipFormat = xAxis.time.displayFormats[xAxis.time.unit];        
      
      // These values are preserved/used by updateRange, not by chart.js.
      xAxis.time.absolute = absolute;  
      //xAxis.time.step =  xAxis.time.unitStepSize*timeUnits[unit].secs*1000; 
      xAxis.time.range = range*timeUnits[unit].secs*1000;      
      
      updateRange();
   };
            
   // Define a column  
   this.setColumn = function (column, _name, _axis, _colour) {
      var col = { name: _name, axis: _axis, colour: _colour, display: true  };
      col.dataset = {
          label: col.name,
          fill : false,
          borderColor : col.colour,
          lineTension : 0,
          xAxisID : xAxis.id,
          yAxisID : col.axis,
          data : []
      };  
      columns[column] = col;      
   };

   // Show or hide a column
   this.showColumn = function (column, _display) {
      columns[column].display = _display;
      if (_display)
         chart.data.datasets[column] = columns[column].dataset;
      else
         chart.data.datasets[column] = null;   
      updateScales();   
   };
 
   // Set suggest y range for an axis. The autoscale will override this if the data exceeds the specified range.  
   this.setYRange = function (axis, ymin, ymax) {
      if (ymin < ymax) { 
         chart.options.scales.yAxes[axis].ticks.suggestedMin = ymin;
         chart.options.scales.yAxes[axis].ticks.suggestedMax = ymax;
      } else {
         delete chart.options.scales.yAxes[axis].ticks.suggestedMin;
         delete chart.options.scales.yAxes[axis].ticks.suggestedMax;
      } 
      updateRange()      
   };

   
   // Load data from a file into the graph:
   // This will trigger an ajax request to fetch the data so operates asynchronously.
   // Note that because this is asynchronous it can result in the file data arriving after any recorded session data and this, in turn
   // can result in incorrect computation of the value of xmin for time relative mode. Therefore, any appendData() calls that arrive
   // whilst we are awaiting the file data are queued and then processed after the file data has arrived.
   this.setData = function (file) {                  
      // Start data queuing:
      loadDataPending = true;
      loadDataPendingRows = [];
      
      // Request the data file and load it into the graph:
      requestFile(file, function (text) {
         // Process log file:
         obj.clearData();
         if (text != null) {
            var lines = text.split('\n'); 
            for (var i in lines) 
                addDataRow(lines[i]);
         }

         // Process any queued data:
         for (var i in loadDataPendingRows)
            addDataRow(loadDataPendingRows[i]);
         loadDataPending = false;
         
         // Update the chart to display the new data:
         updateRange();   
      
      });

   };
   
   // Add new row of data and update the display
   this.appendData = function (line) {
      if (xAxis != null) {
         if (loadDataPending)
            loadDataPendingRows.push(line)
         else {
            addDataRow(line);
            updateRange();   
         }
      }
   }
   
   // Clear all the data stored in the graph
   this.clearData = function () {
      for (var i in columns)
         columns[i].dataset.data = [];
      xmin = null;
      xmax = null;
      updateRange();   
   }
   

   // Private: update/rebuild the chart from the config options.
   function rebuildChart () {
      // Destroy any existing chart:      
      if (chart != null) {
         chart.destroy();         
         columns = [];
      }
      div.innerHTML = '';         

      // Disable mouse interaction with the overlay:
      ctx = document.createElement('canvas');
      div.appendChild(ctx);
      div.style.pointerEvents='none';
      ctx.style.pointerEvents='none';
      ctx.style.width='100%';
      ctx.style.height='100%';
      ctx.style.background = 'none';
      ctx.style.borderStyle = "none";
   
      
      chart = new Chart(ctx, {
         type: 'line',
         data : { datasets: [] },
         options: {
            responsive: true,
            maintainAspectRatio: false,
             scales: {
                  xAxes: [{
                     id : 'x',
                     type: 'linear', 
                     display : false,
                     position: 'bottom',
                     ticks: {  fontColor: 'black' }
                  },{ id : 't',
                     type: 'time',
                     time: {  unit: 'minute' },
                     display : false,
                     position: 'bottom',
                     ticks: {  fontColor: 'black' }
                  }],
                  yAxes: [{
                      id: '0',
                      type: 'linear',
                      position: 'left',
                      ticks: {  fontColor: 'black' }
                  },{
                      id: '1',
                      type: 'linear',
                      position: 'right',
                      ticks: {  fontColor: 'black' }
                  }]
            }                                     
        }
      });
      
      // Store this in the root object so that we can retrieve it on reconstruction/rebinding.
      root.chart = chart;
      
      updateChart();            
   }   
      
      
   function updateChart() {
      // Set up the title
      chart.options.title.text = config.titleText;
      chart.options.title.display = config.titleText != undefined && config.titleText != '';
      chart.options.title.fontSize = parseInt(config.titleFontSize);
      
      // Set font sizes
      chart.options.legend.labels.fontSize = parseInt(config.labelFontSize);
      chart.options.legend.display = parseInt(config.showLegend);
      chart.options.scales.xAxes[0].ticks.fontSize = parseInt(config.scaleFontSize);
      chart.options.scales.xAxes[1].ticks.fontSize = parseInt(config.scaleFontSize);
      chart.options.scales.yAxes[0].ticks.fontSize = parseInt(config.scaleFontSize);
      chart.options.scales.yAxes[1].ticks.fontSize = parseInt(config.scaleFontSize);


      // Set the range for the x-asis
      switch (xAxisType) {
         case 'Numeric' : obj.setXRange(parseFloat(config.xRange.min), parseFloat(config.xRange.max)); break;            
         case 'Time'    : obj.setTimeRange(parseInt(config.timeRange.unit), parseInt(config.timeRange.range), parseInt(config.timeRange.absolute)); break;           
      }   
     
      // Rebuild the column settings:
      columns = [];
      for (var i=0; i<config.numColumns; ++i) { 
         if (i in config.columns) {
            var col = config.columns[i];
            obj.setColumn(i, col.name, col.axis, col.colour);      
         }
      } 
      
      // Update the Y axis settings. To do this, take the lowest/highest ymin/ymax from any column with valid settings:
      for (var axis = 0; axis < 2; ++axis) {
         var ymin=Number.MAX_VALUE, ymax=-Number.MAX_VALUE;
         for (var i=0; i<config.numColumns; ++i) { 
            if (i in config.columns) {
               var col = config.columns[i], cmin=parseFloat(col.min), cmax=parseFloat(col.max);
               if (col.axis == axis && cmin != cmax) {
                  if (cmin < ymin) ymin = cmin;
                  if (cmax > ymax) ymax = cmax;                                       
               }                              
            }
         }
         obj.setYRange(axis, ymin, ymax);
      }                    
      
  
      
      // Update the axis labels etc:
      updateScales();
      updateRange();
   }
           
   // Private: update the displayed datasets:
   function updateScales() {    
      // Choose colours for the axes - if there is only one data column for an
      // axis we can use that columns dataset colour, otherwise we use grey:
      var axes = chart.options.scales.yAxes;
      var leftColour, rightColour;
      var datasets = [];
      var i, j = 0;
      for (i in columns) {
          if (columns[i].display) { 
             if (columns[i].axis == 0) {
                if (leftColour == null)
                   leftColour = columns[i].colour;
                else
                   leftColour = 'black';
             } else {
                if (rightColour == null)
                   rightColour = columns[i].colour;
                else
                   rightColour = 'black';
             }
            
             if (columns[i].dataset != null) {
                datasets[j++] = columns[i].dataset;            
                columns[i].dataset.pointRadius = parseInt(config.pointRadius);
                columns[i].dataset.borderWidth = parseInt(config.lineWidth);
             }
          }
      }
      
      // Display only the axes that are in use:
      axes[0].display = leftColour != null;
      axes[1].display = rightColour != null;
      axes[0].ticks.fontColor = leftColour;
      axes[1].ticks.fontColor = rightColour;
                      
      // Display only the visible datasets:
      chart.data.datasets = datasets;
      chart.update();           
   }
   
   // Private: update the ranges on the x-axis.
   // The data is re-sorted in case it has arrived in the wrong order.
   function updateRange () {
      for (var i in columns) 
          if (columns[i].dataset != null)          
             columns[i].dataset.data.sort(function(a,b) { return a.x>b.x?1:a.x<b.x?-1:0; });             
      if (xAxis.id == 't') {
         var chartRange = xAxis.time.range;
         var dataRange  = moment(xmax)-moment(xmin);
         var tmin, tmax;
         if (xAxis.time.absolute) {
            tmax = moment(xmax);
            tmin = moment(xmin);
         } else {
            tmax = moment(moment(xmax)-moment(xmin));
            tmin = moment(0);
         }
            
         if (tmin % xAxis.time.step != 0)
            tmin = tmin.subtract(tmin % xAxis.time.step);                  
         if (tmax % xAxis.time.step != 0)
            tmax = tmax.add(xAxis.time.step - tmax % xAxis.time.step);                  
         if (dataRange > chartRange) {
            xAxis.time.max = tmax;
            xAxis.time.min = moment(tmax).subtract(chartRange);
         } else {
            xAxis.time.min = tmin;
            xAxis.time.max = moment(tmin).add(chartRange);
         }
      }
      chart.update();           
   }
   
   // Private: add a row of data and update xmin/max
   function addDataRow (line) {
      var row = CSVtoArray (line);
      if (row.length != 0) {
         if (xmin == null || row[0] < xmin) xmin = row[0];
         if (xmax == null || row[0] > xmax) xmax = row[0];
         for (var j=0; j<columns.length; j++) {
            if (xAxis.id == 'x')
               columns[j].dataset.data.push ({ x: parseFloat(row[0]), y: row[j+1]  });                                         
            else if (xAxis.time.absolute) 
               columns[j].dataset.data.push ({ x: moment(row[0]), y: row[j+1]  });                          
            else  // time, relative
               columns[j].dataset.data.push ({ x: moment(row[0])-moment(xmin), y: row[j+1] } );
         }
      }
   }

   // Construct the chart. If we are binding to a root object that already has an overlay then we can bypass the chart
   // recreation. This avoids fully reconstructing the chart after property edits.
   var div = createOverlay(root, chartarea, 'div');   
   if (root.chart == undefined)
      rebuildChart();
   else {
      chart = root.chart;
      updateChart();   
   }

   // Test data:
   //this.appendData("2017-07-16 12:23:40,1")
   //this.appendData("2017-07-16 12:25:40,2")   
   
   return this;
}



// C:/Program Files (x86)/Labcenter Electronics/Proteus 8 Professional/VSM Studio/controls/Indicator/control.js
function Indicator (root, config) {    
      var obj = this;
      var symbols = root.getElementsByTagName("g");      
      var bounds = root.getElementsByClassName("bounds")[0];
      var bbox = bounds.getBBox();
      var label = root.getElementsByTagName("text")[0];
      var colour = root.getElementsByClassName("colour")[0];           
      
      //This code will run every time the user changes a property.            
      this.reconfigure = function (newinstance) {
      	//This grabs the pre existing styles from the SVG and puts them into the XML code,
      	//the two styles which are taken from the SVG are the label font and the LED colour.
      	//This will only run when the user drags the control from the list.
         if (newinstance) {
            config.labelFont = getFontStyle(label);
            if (colour!=undefined){
            config.ledColour = colour.style.fill;
           }else{
           	config.ledColour = undefined;
           }
         }   
         
         //This allows the user to set the colour of the LED. It takes the value from the XML and
         //applies it to the colour layer of the SVG.
         
         if(colour!=undefined){
   			 colour.style.fill = config.ledColour;
				 //code to try fix the blur refresh issue
				 //By transforming the SVG in any way it forces the web browser to update and allows the colour to update as well
				 //however the image i have already has a transform on it and therefore needs to keep it to remain looking nice
				 colour.setAttribute('transform', colour.getAttribute("transform"));  
         }
				 
				 //
         label.firstChild.nodeValue = config.labelText;
         label.style.pointerEvents = "none";   
         setFontStyle(label, config.labelFont);
         
         //This case is all to do with the location of the label. It takes the location set by the XML
         //and uses the bounds of the Indicator to set the location of the label.
         var x = null, y = null;
         var h = label.getBBox().height * 0.6;
         var s = parseInt(config.labelSpacing);
         switch (parseInt(config.labelPosition)) {
            case 1 : label.style.textAnchor = "middle"; x = bbox.width/2; y = -s;  break;
            case 2 : label.style.textAnchor = "middle"; x = bbox.width/2; y = bbox.height+s + h; break;
            case 3 : label.style.textAnchor = "end"; x = -s; y = bbox.height/2 + h/2; break;
            case 4 : label.style.textAnchor = "start";  x = bbox.width+s; y = bbox.height/2 + h/2; break;            
         }   
         
         //This allows the user to hide the text
         if (x != null && y != null) { 
            label.setAttribute('x', x);
            label.setAttribute('y', y); 
            label.style.display = "inherit"; 
         } else {
            label.style.display = "none"; 
         }
         
         //This sets the primary state of the LED to be off.           
         this.setState(false);
      };
      
     //This changes the state from "On" to "Off" by hiding and showing the "On" "Off" layers.      
     this.setState = function (down) {     	
         if (down) {
            symbols[0].style.display = 'none';
            symbols[1].style.display = 'inline';
         } else {
            symbols[0].style.display = 'inline';
            symbols[1].style.display = 'none';
         }  
     }         
}   





