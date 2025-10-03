# Lightning Network Testnet Connectivity Test
Write-Host "🔍 Lightning Network Testnet Connectivity Test" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Testnet nodes to check
$testnetNodes = @(
    @{
        Name = "ACINQ Testnet Node"
        Address = "52.47.128.185"
        Port = 9735
        NodeID = "0279b31b6c1e2e94d473274f26dbb5f7f882b6d1e9d07eecb9d0d08b1b8b9f7e05"
    },
    @{
        Name = "Lightning Labs Testnet Node (LND team)"
        Address = "34.239.230.56"
        Port = 9735
        NodeID = "0284f3f5d0c99f388fc8fa8a1a8966bb10d1b3e508a403ef2e1d5c7a7c36a1543c"
    },
    @{
        Name = "Blockstream Testnet Node"
        Address = "testnet.lightning.blockstream.com"
        Port = 9735
        NodeID = "030e7d7dbce01d6f8d1d9b6b8b6c1c6d9b7d5c8f0f6a0f2b0d2a9d8f7e5b2c1a9b"
    },
    @{
        Name = "Opennode Testnet"
        Address = "testnet.opennode"
        Port = 9735
        NodeID = "032b2cfaaeb4a64bbdd62cbf50f4dc9b6a27a2449c9f748c70a0b7e7d8c8f2b3c4"
    }
)

$results = @()
$connectedCount = 0
$totalResponseTime = 0

Write-Host "`nTesting connectivity to Lightning Network testnet nodes..." -ForegroundColor Yellow

foreach ($node in $testnetNodes) {
    Write-Host "`n🔍 Testing $($node.Name)..." -ForegroundColor White
    
    $startTime = Get-Date
    $connectionResult = $false
    $errorMessage = ""
    
    try {
        # Test TCP connection with timeout
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connectTask = $tcpClient.ConnectAsync($node.Address, $node.Port)
        $timeoutTask = Start-Sleep -Seconds 5 -PassThru
        
        $completedTask = $connectTask, $timeoutTask | Wait-Any -Timeout 5
        
        if ($completedTask -eq 0) {
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
    $totalResponseTime += $responseTime
    
    $status = if ($connectionResult) { "✅ CONNECTED" } else { "❌ DISCONNECTED" }
    $statusColor = if ($connectionResult) { "Green" } else { "Red" }
    
    Write-Host "   Status: $status" -ForegroundColor $statusColor
    Write-Host "   Address: $($node.Address):$($node.Port)" -ForegroundColor Gray
    Write-Host "   Node ID: $($node.NodeID)" -ForegroundColor Gray
    Write-Host "   Response Time: $([math]::Round($responseTime, 2))ms" -ForegroundColor Gray
    
    if (-not $connectionResult) {
        Write-Host "   Error: $errorMessage" -ForegroundColor Red
    }
    
    if ($connectionResult) {
        $connectedCount++
    }
    
    $results += @{
        Name = $node.Name
        Address = $node.Address
        Port = $node.Port
        Connected = $connectionResult
        ResponseTime = $responseTime
        Error = $errorMessage
    }
}

# Calculate statistics
$totalNodes = $testnetNodes.Count
$disconnectedCount = $totalNodes - $connectedCount
$averageResponseTime = if ($totalNodes -gt 0) { $totalResponseTime / $totalNodes } else { 0 }
$healthStatus = if ($connectedCount -gt 0) { "HEALTHY" } else { "UNHEALTHY" }
$healthColor = if ($connectedCount -gt 0) { "Green" } else { "Red" }

# Print summary
Write-Host "`n📊 Network Statistics:" -ForegroundColor Cyan
Write-Host "   Total Nodes: $totalNodes" -ForegroundColor White
Write-Host "   Connected: $connectedCount" -ForegroundColor Green
Write-Host "   Disconnected: $disconnectedCount" -ForegroundColor Red
Write-Host "   Average Response Time: $([math]::Round($averageResponseTime, 2))ms" -ForegroundColor White
Write-Host "   Testnet Health: $healthStatus" -ForegroundColor $healthColor

# Print detailed results
Write-Host "`n📋 Detailed Results:" -ForegroundColor Cyan
foreach ($result in $results) {
    $status = if ($result.Connected) { "✅" } else { "❌" }
    Write-Host "   $status $($result.Name) - $($result.Address):$($result.Port) ($([math]::Round($result.ResponseTime, 2))ms)" -ForegroundColor White
}

# Recommendations
Write-Host "`n💡 Recommendations:" -ForegroundColor Yellow
if ($connectedCount -eq 0) {
    Write-Host "   ❌ No testnet nodes are reachable. Check your internet connection and firewall settings." -ForegroundColor Red
    Write-Host "   🔧 Ensure port 9735 is not blocked by your firewall." -ForegroundColor Yellow
    Write-Host "   🌐 Try using a VPN if you're behind a restrictive network." -ForegroundColor Yellow
} elseif ($connectedCount -lt $totalNodes) {
    Write-Host "   ⚠️  Some testnet nodes are unreachable. This is normal - not all nodes may be online." -ForegroundColor Yellow
    Write-Host "   ✅ You have $connectedCount working testnet connections." -ForegroundColor Green
} else {
    Write-Host "   ✅ All testnet nodes are reachable! Your Lightning Network connectivity is excellent." -ForegroundColor Green
}

Write-Host "`n🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. If nodes are connected, you can proceed with Lightning Network testing" -ForegroundColor White
Write-Host "   2. Use the connected nodes for channel opening and payment testing" -ForegroundColor White
Write-Host "   3. Monitor node availability as Lightning Network topology changes frequently" -ForegroundColor White

Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "Test completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

