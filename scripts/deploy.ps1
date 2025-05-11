
Remove-Item C:\signalk\signalkhome\.signalk\node_modules\signalk-ais-target-prioritizer\*.js
Remove-Item C:\signalk\signalkhome\.signalk\node_modules\signalk-ais-target-prioritizer\*.cjs
Remove-Item C:\signalk\signalkhome\.signalk\node_modules\signalk-ais-target-prioritizer\*.mjs
Remove-Item C:\signalk\signalkhome\.signalk\node_modules\signalk-ais-target-prioritizer\*.json

Copy-Item -Force -Path "..\public" -Destination "C:\signalk\signalkhome\.signalk\node_modules\signalk-ais-target-prioritizer\" -Recurse
Copy-Item -Force -Path "..\*.js" -Destination "C:\signalk\signalkhome\.signalk\node_modules\signalk-ais-target-prioritizer\"
Copy-Item -Force -Path "..\*.mjs" -Destination "C:\signalk\signalkhome\.signalk\node_modules\signalk-ais-target-prioritizer\"
Copy-Item -Force -Path "..\*.json" -Destination "C:\signalk\signalkhome\.signalk\node_modules\signalk-ais-target-prioritizer\"
