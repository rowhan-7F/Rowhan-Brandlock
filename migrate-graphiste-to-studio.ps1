# ============================================================
#  MIGRATION COSMÉTIQUE : graphiste → studio (visible user only)
#
#  ✅ Ne touche PAS au rôle technique "graphist" en DB
#  ✅ Ne touche PAS aux commentaires de code
#  ✅ Ne touche PAS aux noms de variables JavaScript
#  ✅ Touche UNIQUEMENT les textes visibles à l'utilisateur
#
#  Backup automatique avant modifs dans .backup-graphiste/
#  Rollback possible avec restore-backup.ps1
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host "🎯 Migration cosmétique : graphiste → studio" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# ÉTAPE 1 — Créer un backup
# ============================================================
$backupDir = ".backup-graphiste-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-Host "📦 Création du backup dans $backupDir..." -ForegroundColor Yellow

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$filesToBackup = @(
    "src\app\admin\tenant\library\page.tsx",
    "src\app\admin\tenant\projects\[projectId]\page.tsx",
    "src\app\admin\tenant\page.tsx",
    "src\components\admin\PendingImagesValidation.tsx",
    "src\components\EmptyState.tsx",
    "src\components\ProjectCommentsSection.tsx",
    "src\app\super-admin\clients\new\page.tsx",
    "src\app\super-admin\clients\[tenantId]\page.tsx",
    "src\app\super-admin\clients\page.tsx",
    "src\app\super-admin\page.tsx",
    "src\app\super-admin\analytics\page.tsx",
    "src\app\api\admin\tasks\[taskId]\route.ts",
    "src\app\api\studio\projects\[projectId]\comments\route.ts"
)

foreach ($file in $filesToBackup) {
    if (Test-Path $file) {
        $destPath = Join-Path $backupDir $file
        $destDir = Split-Path $destPath -Parent
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        Copy-Item $file $destPath -Force
    }
}

Write-Host "✅ Backup créé : $backupDir" -ForegroundColor Green
Write-Host ""

# ============================================================
# ÉTAPE 2 — Définition des remplacements
# Chaque remplacement est ciblé pour ne PAS toucher :
# - Les commentaires (// graphiste)
# - Les noms de variables (graphistesPerf)
# - Les chaînes "graphist" (rôle technique)
# ============================================================

$replacements = @(
    # admin/tenant/library/page.tsx
    @{
        File = "src\app\admin\tenant\library\page.tsx"
        Find = "Les graphistes n'ont pas d'image en attente."
        Replace = "Le studio n'a pas d'image en attente."
    },
    # admin/tenant/projects/[projectId]/page.tsx
    @{
        File = "src\app\admin\tenant\projects\[projectId]\page.tsx"
        Find = ">Graphiste</div>"
        Replace = ">Studio</div>"
    },
    @{
        File = "src\app\admin\tenant\projects\[projectId]\page.tsx"
        Find = "Besoin d'ajouter un message au graphiste ?"
        Replace = "Besoin d'ajouter un message au studio ?"
    },
    @{
        File = "src\app\admin\tenant\projects\[projectId]\page.tsx"
        Find = "Le graphiste travaille encore sur ce projet."
        Replace = "Le studio travaille encore sur ce projet."
    },
    @{
        File = "src\app\admin\tenant\projects\[projectId]\page.tsx"
        Find = "Le graphiste sera notifié."
        Replace = "Le studio sera notifié."
    },
    # admin/tenant/page.tsx
    @{
        File = "src\app\admin\tenant\page.tsx"
        Find = "Les graphistes verront automatiquement les briefs ouverts"
        Replace = "Le studio verra automatiquement les briefs ouverts"
    },
    @{
        File = "src\app\admin\tenant\page.tsx"
        Find = "automatiquement validées et visibles en priorité pour le graphiste."
        Replace = "automatiquement validées et visibles en priorité pour le studio."
    },
    # components/admin/PendingImagesValidation.tsx
    @{
        File = "src\components\admin\PendingImagesValidation.tsx"
        Find = "Ces images ont été uploadées par le graphiste"
        Replace = "Ces images ont été uploadées par le studio"
    },
    # components/EmptyState.tsx
    @{
        File = "src\components\EmptyState.tsx"
        Find = "Tes graphistes sont efficaces, ou il n'y a rien de nouveau."
        Replace = "Ton studio est efficace, ou il n'y a rien de nouveau."
    },
    # components/ProjectCommentsSection.tsx
    @{
        File = "src\components\ProjectCommentsSection.tsx"
        Find = 'graphist: "Graphiste"'
        Replace = 'graphist: "Studio"'
    },
    # super-admin/clients/new/page.tsx
    @{
        File = "src\app\super-admin\clients\new\page.tsx"
        Find = "Au moins 1 admin obligatoire. Tu peux ajouter plusieurs admins ou graphistes."
        Replace = "Au moins 1 admin obligatoire. Tu peux ajouter plusieurs admins ou membres studio."
    },
    @{
        File = "src\app\super-admin\clients\new\page.tsx"
        Find = "Ajouter un graphiste"
        Replace = "Ajouter un membre studio"
    },
    @{
        File = "src\app\super-admin\clients\new\page.tsx"
        Find = '"tenant_admin" ? "Admin client" : "Graphiste"'
        Replace = '"tenant_admin" ? "Admin client" : "Studio"'
    },
    @{
        File = "src\app\super-admin\clients\new\page.tsx"
        Find = '"tenant_admin" ? "Admin" : "Graphiste"'
        Replace = '"tenant_admin" ? "Admin" : "Studio"'
    },
    # super-admin/clients/[tenantId]/page.tsx
    @{
        File = "src\app\super-admin\clients\[tenantId]\page.tsx"
        Find = 'label="Graphistes"'
        Replace = 'label="Studio"'
    },
    @{
        File = "src\app\super-admin\clients\[tenantId]\page.tsx"
        Find = '"tenant_admin" ? "Admin" : "Graphiste"'
        Replace = '"tenant_admin" ? "Admin" : "Studio"'
    },
    # super-admin/clients/page.tsx
    @{
        File = "src\app\super-admin\clients\page.tsx"
        Find = '} · {tenant.graphists_count} graphiste{tenant.graphists_count > 1 ? "s" : ""}'
        Replace = '} · {tenant.graphists_count} membre studio{tenant.graphists_count > 1 ? "s" : ""}'
    },
    # super-admin/page.tsx
    @{
        File = "src\app\super-admin\page.tsx"
        Find = 'label="Graphistes"'
        Replace = 'label="Studio"'
    },
    # super-admin/analytics/page.tsx
    @{
        File = "src\app\super-admin\analytics\page.tsx"
        Find = '<Card title="Top graphistes">'
        Replace = '<Card title="Top membres studio">'
    },
    # api/admin/tasks/[taskId]/route.ts (visible dans toasts/messages d'erreur)
    @{
        File = "src\app\api\admin\tasks\[taskId]\route.ts"
        Find = '"Action réservée aux graphistes"'
        Replace = '"Action réservée au studio"'
    },
    # api/studio/projects/[projectId]/comments/route.ts (visible dans notification title)
    @{
        File = "src\app\api\studio\projects\[projectId]\comments\route.ts"
        Find = '"💬 Nouveau commentaire graphiste"'
        Replace = '"💬 Nouveau commentaire du studio"'
    }
)

# ============================================================
# ÉTAPE 3 — Application des remplacements
# ============================================================

Write-Host "🔄 Application des remplacements..." -ForegroundColor Yellow
Write-Host ""

$totalReplacements = 0
$errors = @()

foreach ($r in $replacements) {
    $file = $r.File
    $find = $r.Find
    $replace = $r.Replace

    if (-not (Test-Path $file)) {
        Write-Host "  ⚠️  Fichier introuvable : $file" -ForegroundColor Yellow
        continue
    }

    try {
        $content = Get-Content $file -Raw -Encoding UTF8
        
        if ($content -match [regex]::Escape($find)) {
            $newContent = $content.Replace($find, $replace)
            Set-Content $file -Value $newContent -Encoding UTF8 -NoNewline
            $count = ([regex]::Matches($content, [regex]::Escape($find))).Count
            $totalReplacements += $count
            Write-Host "  ✅ $file" -ForegroundColor Green
            Write-Host "     '$find' → '$replace'" -ForegroundColor Gray
        } else {
            Write-Host "  ⏭️  $file (texte non trouvé, déjà migré ?)" -ForegroundColor DarkGray
        }
    } catch {
        $errors += "$file : $($_.Exception.Message)"
        Write-Host "  ❌ Erreur sur $file" -ForegroundColor Red
    }
}

# ============================================================
# RÉSUMÉ
# ============================================================
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ MIGRATION TERMINÉE" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total remplacements : $totalReplacements" -ForegroundColor White
Write-Host "Backup : $backupDir" -ForegroundColor White

if ($errors.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  Erreurs rencontrées :" -ForegroundColor Yellow
    foreach ($err in $errors) {
        Write-Host "   $err" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🚀 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "   1. Restart : Remove-Item -Recurse -Force .next ; npm run dev" -ForegroundColor White
Write-Host "   2. Test :" -ForegroundColor White
Write-Host "      - Login studio (user-demo@flag.ch) → vérifie l'affichage" -ForegroundColor White
Write-Host "      - Login admin (sauter.fabien@gmail.com) → vérifie l'affichage" -ForegroundColor White
Write-Host "      - Login super-admin → vérifie /super-admin/clients" -ForegroundColor White
Write-Host ""
Write-Host "🛟 Rollback si problème :" -ForegroundColor Yellow
Write-Host "   Copy-Item ""$backupDir\*"" -Destination . -Recurse -Force" -ForegroundColor White
Write-Host ""