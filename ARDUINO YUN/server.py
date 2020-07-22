# Modular VFP Server
# Compatible with Arduino Yun, Yun Shield, Dragino, Seeeduino Cloud

import os, sys, stat, select, fcntl
import socket, select, struct
import time
import re

class VfpServer:
   def __init__(self):
      self.HOST = ''                # Symbolic name meaning all available interfaces
      self.PORT = 8080              # Arbitrary non-privileged port
      self.BUFFERSIZE = 4096
      self.transport = None

      self.INITD_SCRIPT = "/etc/init.d/iotbuilder-publish"
      self.AVAHI_DAEMON = "/etc/init.d/avahi-daemon"
      self.AVAHI_SERVICE = "/vsm/iotbuilder.service"
      self.PANEL_SVG = "/vsm/panel.svg"
      self.LOG_NAME = "/tmp/server.log"

      self.applianceName = ""
      self.clientAddress = None
      self.statusSocket = None
      self.statusBuffer = ""
      self.sessionState = {}
      self.sessionHistory = {}

      KEEPALIVE_INTERVAL = 10
      KEEPALIVE_TIMEOUT  = 30

      self.keepaliveTimer = Watchdog(KEEPALIVE_INTERVAL, self.keepaliveDue)
      self.statusTimeout = Watchdog(KEEPALIVE_TIMEOUT, self.lostStatus)
      
   def processRequest (self, conn, addr) :
         firstLine = ""
         currentLine = ""
         lines = [];
         done = False

         #self.writelog("Receiving...")
         conn.settimeout(5.0)

         connfile=conn.makefile('r', 1)

         while not done:
            try:
               data = connfile.readline()
               currentLine = data.split('\r')[0]
               currentLine = currentLine.split('\n')[0]
               if currentLine != "":
                  lines.append(currentLine)
               elif firstLine == "":
                  firstLine = lines[0]
                  done = firstLine.startswith('GET')
                  body = len(lines)
               else:
                  done = True
            except socket.timeout:
               self.writelog("Socket Timeout")
               conn.close()
               return
            except:
               self.writelog("Socket Error")
               conn.close()
               return

         conn.settimeout(None)

         if firstLine != "":
            self.writelog(firstLine)
            action = firstLine.split(' ')[0];
            if action=='GET':
               filename = firstLine.split(' ')[1];
               if filename == '/' :
                  #Process a page reload.
                  if self.clientAddress == None or self.clientAddress == addr:
                     # If this is a new connection, or a reload from the same client then this is processed normally:
                     filename = 'panel.htm'
                     self.writelog("Client Address:"+str(addr))
                     self.transport.sendReload(addr)

                     # Close any previous status connection and launch the status timeout. Anything that doesn't establish a
                     # status connection within the status timeout period will thus be disconnected.
                     self.clientAddress = addr
                     self.statusBuffer = ''
                     self.closeStatus()
                  else:
                     # If an attempt is made to connection from another client without first closing the other, then send a 403:
                     conn.sendall("HTTP/1.1 403 FORBIDDEN\n")
                     conn.sendall("Content-Type: text/html\n\n")
                     conn.sendall("<html>")
                     conn.sendall("<head><title>Appliance In Use</title></head>")
                     conn.sendall("<body><h1>")
                     conn.sendall("The '"+self.applianceName+"' is under the control of another client ["+str(self.clientAddress)+"].\n")
                     conn.sendall("</h1></body>")
                     conn.sendall("</html>")
                     conn.close()
                     self.writelog("Rejected connection from " +str(addr))
                     return

               elif filename == '/status':
                  #Process a status request.
                  if self.clientAddress == addr:
                     #We send a response header but then keep the connection
                     #open until we receive something to send to it from the Arduino
                     conn.sendall("HTTP/1.1 200 OK\n")
                     conn.sendall("Content-Type: text/plain\n")
                     conn.sendall("Connection: close\n")
                     conn.sendall("\n")
                     if self.statusBuffer == '':
                        self.openStatus(conn)
                     else:
                        conn.sendall(self.statusBuffer)
                        conn.close()
                        self.statusBuffer = ''
                  else:
                     # Another client is trying to use the appliance:
                     self.writelog("Rejected client:"+str(addr))
                     conn.sendall("HTTP/1.1 403 FORBIDDEN\n")
                     conn.sendall("Content-Type: text/plain\n")
                     conn.sendall("Connection: close\n")
                     conn.sendall("\n\n")
                     conn.close();
                  return
               elif filename == '/session':
                  #Process a session state request.
                  self.openStatus(conn)
                  self.sendState(conn)
                  self.closeStatus()
                  return
               elif filename.startswith('/'):
                  filename = filename[1:]
               self.sendFile(conn, filename)

            elif action=='POST' or action=='PUT' :
               # Process messages from the client/browser.
               # POST messages are passed on to the AVR, PUT messages merely update the session state.
               conn.sendall("HTTP/1.1 200 OK\n")
               conn.sendall("Content-Type: text/plain\n")
               conn.sendall("Connection: close\n")
               conn.sendall("\n")
               for i in range(body, len(lines)):
                  currentLine = lines[i]
                  self.writelog(currentLine)
                  if len(currentLine) > 0:
                     if action=='POST':
                        self.transport.sendEvent(currentLine)
                     else:
                        self.writelog("RECORD:"+currentLine)
                     self.saveState(currentLine)

         conn.close()
         
   #Opens a requested file
   def sendFile (self, conn, filename):
       #Records server acknowledgement
       self.writelog("Sending file '"+filename+"'")

       #Tries to send the file
       try:
           file = open(filename, "rb")
       except:
           conn.sendall("HTTP/1.1 404 Not Found\n")
           conn.sendall("Content-Type: text/html\n\n")
           conn.sendall("<html>")
           conn.sendall("<head><title> 404 NOT FOUND </title></head>")
           conn.sendall("<body><h1>")
           conn.sendall(filename+" - file not found")
           conn.sendall("</h1></body>")
           conn.sendall("</html>")
           self.writelog("File failed to send" + "\n")
       else:
           conn.sendall("HTTP/1.1 200 OK\n")
           conn.sendall("Content-Type: " + self.fileType(filename) + "\n\n")
           conn.sendall(file.read()) # TBD send in buffersize chunks?
           self.writelog("Transfer successful")

   #Send the session state (state variables of all controls)
   def sendState(self, conn):
      conn.sendall("HTTP/1.1 200 OK\n")
      conn.sendall("Content-Type: text/plain\n")
      conn.sendall("Connection: close\n")
      conn.sendall("\n")
      self.writelog("Sending session state")
      for key in self.sessionState:
         if not key.startswith('$.record'):
            conn.sendall(key+'='+self.sessionState[key]+'\n')
      for key in self.sessionHistory:
         conn.sendall(self.sessionHistory[key]);


   def fileType (self, filename):
       extn = filename.split('.')[1];
       if extn == "png":
           filetype = "image/png"
       elif extn == "gif":
           filetype = "image/gif"
       elif extn == "jpeg":
           filetype = "image/jpeg"
       elif extn == "svg":
           filetype = "image/svg+xml"
       elif extn == "js":
           filetype = "application/javascript"
       elif extn == "htm" or extn == "html":
           filetype = "text/html"
       elif extn == "txt":
           filetype = "text/html"
       elif extn == "css":
           filetype = "text/css"
       else:
           filetype = "application/octet-stream"
       return filetype

   def pollStatus (self) :
      # Read pending data from the transport
      data = ""
      while self.transport.hasData():
         line = self.transport.readLine()
         self.writelog("Status: "+line)
         if self.saveState(line):
            data += line+'\n'

      # If the keepalive timer has expired we need to send a keep alive packet
      if len(data) == 0 and self.keepaliveTimer.isDue():
         self.writelog('Sending Keepalive');
         data = "$.keepalive\n"
         self.keepaliveTimer.start()

      # If we have a status connection then use it to send the data,
      # otherwise we park it in a buffer unless the client has gone away.
      if len(data) != 0:
         if self.statusSocket != None:
            try:
              self.statusSocket.sendall(data)
            except IOError:
              pass
            self.closeStatus()
         elif self.clientAddress != None:
            self.statusBuffer += data
         else:
            self.statusBuffer = ''

      return

   # This is called when the client opens a reverse AJAX connection and we have nothing to send.
   def openStatus (self, sock):
      if self.statusSocket != None:
         self.statusSocket.close()
      self.statusSocket = sock
      self.keepaliveTimer.start()
      self.statusTimeout.stop()

   # This is called to close status connection because we want the client to process the information
   # that we have written to it. At this point we start the a timeout timer, because we except to receive
   # another status connection within this time frame.
   def closeStatus (self):
      if self.statusSocket != None:
         self.statusSocket.close()
         self.statusSocket = None
      self.keepaliveTimer.stop()
      self.statusTimeout.start()

   # This is triggered if/when the keepalive timer triggers.
   # It will cause the next call to pollStatus() to post a keepalive message and close the status pipe
   # at which point the server should request a new one.
   def keepaliveDue(self):
      pass

   # If the statusTimeout timer triggers then we can assume that we have lost contact with the client.
   def lostStatus(self):
      self.writelog("Client disconnected")
      self.clientAddress = None
      self.keepaliveTimer.stop()
      self.statusTimeout.stop()

   # Update the recorded state data.
   # Returns true is there is a state change which should be passed to the browser.
   def saveState(self, msg):
       m = re.match("([$a-zA-Z_][a-zA-Z0-9_\\.]*)\\s*=\\s*([^\\r\\n]*)", msg)
       dirty = False
       if m != None and len(m.groups()) == 2:
          # State assignment and history functions:
          key = m.group(1)
          value = m.group(2)
          if key.startswith("$.create"):
              dirty = True;
          elif key.startswith("$.record"):
              # Start recording for control with id=value
              id = value.replace('"', '')
              self.sessionState["$.record."+id] = "1"
          elif key.startswith("$.stop"):
              # Stop recording for control with id=value
              id = value.replace('"', '')
              self.sessionState["$.record."+id] = "0"
          elif key.startswith("$.erase"):
              # Erase recorded history for control with id=value
              id = value.replace('"', '')
              self.sessionHistory.pop(id, None)
          elif not key in self.sessionState or self.sessionState[key] != value:
              # Normal state assignment
              self.sessionState[key] = value
              dirty = True
       else:
          # Ordinary JS method call of form <id>.<method> (<args>)
          id = msg.split('.')[0]
          if self.sessionState.get("$.record."+id, '0') == '1':
             h = self.sessionHistory.get(id, '')+msg+'\n';
             self.sessionHistory[id] = h
          dirty = True;
       return dirty

   def writelog(self, msg):
       if os.path.exists(self.LOG_NAME):
          log = open(self.LOG_NAME, "w+")
          log.write(msg+'\n');
          log.close()

   def get_ip_address(self, ifname):
       s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
       return socket.inet_ntoa(fcntl.ioctl(
           s.fileno(),
           0x8915,  # SIOCGIFADDR
           struct.pack('256s', ifname[:15])
       )[20:24])

   def configure (self):
      # Create the IotBuilder publishing script within /etc/init.d
      self.writelog("Creating "+self.INITD_SCRIPT);
      file = open(self.INITD_SCRIPT, "w")
      file.write("#!/bin/sh /etc/rc.common\n")
      file.write("# Publish/Unpublish the IotBuilder service file.\n")
      file.write("STOP=99\n")
      file.write("start() {\n cp /vsm/iotbuilder.service /etc/avahi/services\n}\n")
      file.write("stop() {\n rm /etc/avahi/services/iotbuilder.service\n}\n")
      file.close()
      os.chmod(self.INITD_SCRIPT, 0o777) # mark as executable
      os.system(self.INITD_SCRIPT + " enable")

      # Create the avahi-service descriptor file
      self.writelog("Creating "+self.AVAHI_SERVICE);
      file = open(self.AVAHI_SERVICE,  "w")
      file.write("<?xml version='1.0' standalone='no'?>\n")
      file.write("<!DOCTYPE service-group SYSTEM 'avahi-service.dtd'>\n")
      file.write("<service-group>\n")
      file.write(" <name replace-wildcards='yes'>"+self.applianceName+" on %h</name>\n")
      file.write(" <service>\n")
      file.write("   <type>_vfpserver._tcp</type>\n")
      file.write("   <port>"+str(self.PORT)+"</port>\n") ## Could choose arbitrary/free port here
      file.write(" </service>\n")
      file.write("</service-group>\n")
      file.close();
      os.chmod(self.AVAHI_SERVICE, 0o644) # mark as non-executable

      # Publish the Service:
      os.system(self.INITD_SCRIPT + " start")
      os.system(self.AVAHI_DAEMON + " restart")

   def begin(self, port, transport):
      if port > 0:
         self.PORT  = port
      self.transport = transport

      # Set the CWD to where we are running:
      cwd = os.path.dirname(sys.argv[0])
      if cwd != "" :
         os.chdir(cwd)


      # Extract the project title from panel.svg
      # This should work using the XML library but the parser library is missing on the Yun Board.
      # The Seeeduino doesn't have HTMLParser either. 
      try:
         from HTMLParser import HTMLParser
         class SvgParser(HTMLParser):
            def __init__(self):
               HTMLParser.__init__(self)
               self.title = 'Virtual Front Panel'
   
            def handle_starttag(self, tag, attrs):
               if (tag == "svg"):
                  for attr in attrs:
                     if attr[0] == 'vfp:title':
                        self.title = attr[1]

         # instantiate the parser and feed it some HTML
         parser = SvgParser()
         parser.feed(open(self.PANEL_SVG).read())
         self.applianceName = parser.title
      except:
         #TBD Extract vfp:title attribute by some other means, probably regex.
         self.applianceName = "Virtual Front Panel"
         pass                  
      
      #Create, bind and listen on the socket:
      self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
      self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
      self.sock.bind((self.HOST, self.PORT))
      self.sock.listen(1)
      
      #Perform configuration operations:
      self.writelog("Configuring '"+self.applianceName+"'")
      self.configure()

      # Have we got wlan0:
      try:
         ipAddr = self.get_ip_address('wlan0')
         self.writelog("Listening on wlan0:"+ipAddr+":"+str(self.PORT))
      except:
         self.writelog("No IP for wlan0")

      # Have we got eth0:
      try:
         ipAddr = self.get_ip_address('eth0')
         self.writelog("Listening on eth0:"+ipAddr+":"+str(self.PORT))
      except:
         self.writelog("No IP for eth0")

      # Have we got eth1:
      try:
         ipAddr = self.get_ip_address('eth1')
         self.writelog("Listening on eth1:"+ipAddr+":"+str(self.PORT))
      except:
         self.writelog("No IP for eth1")

   def poll(self):
      try:
         self.sock.setblocking(False);
         conn, addr = self.sock.accept()
         self.processRequest(conn, addr[0]);
      except socket.error:
         #No connection
         pass
      self.keepaliveTimer.poll()
      self.statusTimeout.poll()      
      self.pollStatus()

class Watchdog:
   def __init__(self, timeout, handler):
      self._timeout = timeout
      self._handler = handler
      self._timeoutTime = -1
      self._due = False
   
   def start(self):
      self._timeoutTime = self._getTime() + self._timeout
      self._due = False
   def stop(self):
      self._timeoutTime = -1
      self._due = False
   def isDue(self):
      return self._due
   def isRunning(self):
      return self._timeoutTime != -1
   def poll(self):
      if self._timeoutTime > 0:
         now = self._getTime()
         if now >= self._timeoutTime:
            self._timeoutTime = -1
            self._due = True
            if self._handler:
               self._handler()
   # Time in seconds
   def _getTime(self):
      return time.mktime(time.localtime())

class Arduino:
   def sendTime(self, now):
      print "TIME:"+str(now)+"*"
      
   def sendReload(self, addr):      
      print "RELOAD:*"
   
   def sendEvent(self, event):
      print "EVENT:"+event+"*"   
      
   def hasData(self):
      return sys.stdin in select.select([sys.stdin], [], [], 0)[0]
   
   def readLine(self):      
      return sys.stdin.readline()[:-1]


###########################################################
# Main 

server = VfpServer()
transport = Arduino()
port = 8080
if len(sys.argv) >= 2:
   port = int(sys.argv[1])
server.begin(port,transport)

# Start of 2017 - this will prevent us emitting the time until such time as the linux
# side has got a proper time off an internet time server.
next = 1483228800

while True:
    now = time.mktime(time.localtime())
    if now > next:
      transport.sendTime(now)
      next = now+3600;

    server.poll()

