# 밤 실행(batch_review.py)이 끝나면 1시간 뒤 PC 를 끕니다 (사용자 2026-11-04 "전부 끝나고 한 시간 뒤에 전원 꺼 줘").
# 취소: 관리자 아니어도 됨 — 알림이 뜬 뒤라면 `shutdown /a`, 그 전이면 작업 관리자에서 이 powershell 을 끝냄.
$log = Join-Path $env:USERPROFILE 'Desktop\덴트버드_밤작업\밤작업_진행.txt'
function Say($m) { Add-Content -Path $log -Value ("[{0}] (전원) {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) -Encoding utf8 }
function Running { [bool](Get-CimInstance Win32_Process -Filter "name like 'python%'" | Where-Object { $_.CommandLine -match 'batch_review' }) }

Say '밤 실행이 끝나면 1시간 뒤에 PC 를 끕니다'
# 단추(.cmd)가 바퀴 사이에 10초 쉬므로, 5분 동안 실행이 없어야 '끝' 으로 봅니다
$idle = 0
while ($idle -lt 300) {
    if (Running) { $idle = 0 } else { $idle += 30 }
    Start-Sleep -Seconds 30
}
Say '밤 실행이 끝났습니다 — 60분 뒤에 끕니다 (취소: shutdown /a 또는 이 창 닫기)'
Start-Sleep -Seconds 3600
Say 'PC 를 끕니다'
shutdown /s /t 60 /c "DenFlow night run finished - shutting down in 60s (cancel: shutdown /a)"
