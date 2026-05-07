$c = Get-Content 'd:\esden-dashboard\src\app\dashboard\agents\page.tsx'
$newC = @()
for ($i=0; $i -lt $c.Length; $i++) {
    if ($i -ne 756) { # Line 757 is index 756
        $newC += $c[$i]
    }
}
$newC | Set-Content 'd:\esden-dashboard\src\app\dashboard\agents\page.tsx'
