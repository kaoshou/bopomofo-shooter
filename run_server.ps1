# ㄅㄆㄇㄈ大挑戰 - Local HTTP Server (PowerShell Stable Version)
# ---------------------------------------------------------
# Usage: Execute this file in your PowerShell terminal to bypass CJK file:// CORS restrictions.

$ProgressPreference = 'SilentlyContinue'
$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".js"   = "application/javascript"
    ".css"  = "text/css"
    ".wasm" = "application/wasm"
    ".data" = "application/octet-stream"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".mp3"  = "audio/mpeg"
    ".wav"  = "audio/wav"
    ".ico"  = "image/x-icon"
}

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  🚀 Local HTTP Server Started successfully!" -ForegroundColor Green
    Write-Host "  🔗 Please open: http://localhost:$port/" -ForegroundColor Cyan
    Write-Host "  ⚠️  Press [Ctrl + C] in this console to stop the server" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Green

    # Automatically open local game URL
    Start-Process "http://localhost:$port/"

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") { $urlPath = "/index.html" }
        
        # Unescape path
        $decodedPath = [System.Uri]::UnescapeDataString($urlPath)
        # Use relative path .\ to resolve files under the workspace
        $filePath = Join-Path ".\" $decodedPath.TrimStart('/')
        
        if (Test-Path $filePath -PathType Leaf) {
            $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = $mimeTypes[$extension]
            if ($null -eq $mime) { $mime = "text/plain" }
            
            $response.ContentType = $mime
            # Access-Control CORS
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errorMessage = "404 Not Found: $decodedPath"
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes($errorMessage)
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.OutputStream.Close()
    }
} catch {
    Write-Host "❌ Failed to start server: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if ($null -ne $listener) {
        $listener.Close()
    }
}
