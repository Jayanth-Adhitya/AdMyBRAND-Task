param([int]$Duration=30,[string]$Mode="wasm",[string]$Room="demo")
Invoke-WebRequest -Uri "http://localhost:3000/bench/start?duration=$Duration&mode=$Mode&room=$Room" | Out-Null
Start-Sleep -Seconds ($Duration + 3)
(Invoke-WebRequest -Uri "http://localhost:3000/metrics.json").Content | Tee-Object -FilePath "metrics.json"
