# Script untuk mengkonversi AUDIT_REPORT.md ke Word document
# Membutuhkan Microsoft Word terinstall

$markdownFile = "AUDIT_REPORT.md"
$wordFile = "AUDIT_REPORT.doc"

# Cek apakah file markdown ada
if (-not (Test-Path $markdownFile)) {
    Write-Host "Error: File $markdownFile tidak ditemukan!" -ForegroundColor Red
    exit 1
}

# Cek apakah Microsoft Word terinstall
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
} catch {
    Write-Host "Error: Microsoft Word tidak terinstall atau tidak dapat diakses!" -ForegroundColor Red
    Write-Host "Silakan gunakan opsi alternatif:" -ForegroundColor Yellow
    Write-Host "1. Buka AUDIT_REPORT.md di Microsoft Word secara manual" -ForegroundColor Yellow
    Write-Host "2. Gunakan online converter: https://www.markdowntoword.com/" -ForegroundColor Yellow
    Write-Host "3. Install VS Code extension 'Markdown to Word'" -ForegroundColor Yellow
    exit 1
}

try {
    Write-Host "Membuka file Markdown..." -ForegroundColor Cyan
    $doc = $word.Documents.Open((Get-Location).Path + "\" + $markdownFile)

    Write-Host "Menyimpan sebagai Word document..." -ForegroundColor Cyan
    $wdFormatDOC = 0  # Format untuk .doc (Word 97-2003)
    $doc.SaveAs((Get-Location).Path + "\" + $wordFile, $wdFormatDOC)

    Write-Host "Menutup document..." -ForegroundColor Cyan
    $doc.Close($false)

    Write-Host "Success! File tersimpan sebagai: $wordFile" -ForegroundColor Green
} catch {
    Write-Host "Error terjadi saat konversi: $_" -ForegroundColor Red
} finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
}
