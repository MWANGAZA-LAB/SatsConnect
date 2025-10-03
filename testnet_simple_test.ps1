# Lightning Network Testnet Connectivity Test
Write-Host "Lightning Network Testnet Connectivity Test" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Testnet nodes to check
$testnetNodes = @(
    @{
        Name = "ACINQ Testnet Node"
        Address = "52.47.128.185"
        Port = 9735
    },
    @{
        Name = "Lightning Labs Testnet Node"
        Address = "34.239.230.56"
        Port = 9735
    },
    @{
        Name = "Blockstream Testnet Node"
        Address = "testnet.lightning.blockstream.com"
        Port = 9735
    },
    @{
        Name = "Opennode Testnet"
        Address = "testnet.opennode"
        Port = 9735
    }
)

$connectedCount = 0
$totalNodes = $testnetNodes.Count

Write-Host "`nTesting connectivity to Lightning Network testnet nodes..." -ForegroundColor Yellow

foreach ($node in $testnetNodes) {
    Write-Host "`nTesting $($node.Name)..." -ForegroundColor White
    
    $startTime = Get-Date
    $connectionResult = $false
    $errorMessage = ""
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connectTask = $tcpClient.ConnectAsync($node.Address, $node.Port)
        $timeout = 5000  # 5 seconds timeout
        
        if ($connectTask.Wait($timeout)) {
            $connectionResult = $true
            $tcpClient.Close()
        } else {
            $errorMessage = "Connection timeout"
        }
    }
    catch {
        $errorMessage = $_.Exception.Message
    }
    finally {
        if ($tcpClient) {
            $tcpClient.Close()
        }
    }
    
    $endTime = Get-Date
    $responseTime = ($endTime - $startTime).TotalMilliseconds
    
    $status = if ($connectionResult) { "CONNECTED" } else { "DISCONNECTED" }
    $statusColor = if ($connectionResult) { "Green" } else { "Red" }
    
    Write-Host "   Status: $status" -ForegroundColor $statusColor
    Write-Host "   Address: $($node.Address):$($node.Port)" -ForegroundColor Gray
    Write-Host "   Response Time: $([math]::Round($responseTime, 2))ms" -ForegroundColor Gray
    
    if (-not $connectionResult) {
        Write-Host "   Error: $errorMessage" -ForegroundColor Red
    }
    
    if ($connectionResult) {
        $connectedCount++
    }
}

# Print summary
Write-Host "`nNetwork Statistics:" -ForegroundColor Cyan
Write-Host "   Total Nodes: $totalNodes" -ForegroundColor White
Write-Host "   Connected: $connectedCount" -ForegroundColor Green
Write-Host "   Disconnected: $($totalNodes - $connectedCount)" -ForegroundColor Red

$healthStatus = if ($connectedCount -gt 0) { "HEALTHY" } else { "UNHEALTHY" }
$healthColor = if ($connectedCount -gt 0) { "Green" } else { "Red" }
Write-Host "   Testnet Health: $healthStatus" -ForegroundColor $healthColor

Write-Host "`nTest completed at $(Get-Date)" -ForegroundColor Gray

