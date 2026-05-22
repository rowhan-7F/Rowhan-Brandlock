# Whisper.cpp — Binaries & Models

Ce dossier contient le moteur de transcription locale utilisé par le worker
BrandLock. Les binaires et modèles ne sont **PAS** versionnés (trop lourds,
~3 GB). Voir setup ci-dessous.

## 📁 Structure

worker/whisper-cpp/
├── bin/        # Binaires whisper-cli.exe + DLLs (~20 MB, .gitignore)
├── models/     # Modèle ggml-large-v3.bin (~2.95 GB, .gitignore)
├── samples/    # Audio de test, jamais commit (.gitignore)
└── README.md   # Ce fichier

## 🚀 Setup — Windows (dev local)

### 1. Binaires (v1.8.4 BLAS)

```powershell
cd worker/whisper-cpp/bin

# Download
$url = "https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.4/whisper-blas-bin-x64.zip"
Invoke-WebRequest -Uri $url -OutFile whisper-blas-bin-x64.zip -UseBasicParsing
Expand-Archive -Path whisper-blas-bin-x64.zip -DestinationPath . -Force

# Le zip contient un sous-dossier Release/ — on remonte
Move-Item -Path .\Release\* -Destination . -Force
Remove-Item -Path .\Release -Force
Remove-Item whisper-blas-bin-x64.zip
```

### 2. Modèle large-v3 (~2.9 GB, 3-10 min)

```powershell
cd worker/whisper-cpp/models

curl.exe -L --ssl-no-revoke -o ggml-large-v3.bin "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin"

# Vérifie la taille
Get-Item ggml-large-v3.bin | Select-Object Name, @{Name="SizeMB";Expression={[math]::Round($_.Length / 1MB, 2)}}
# Attendu : ~2952 MB
```

### 3. Test que ça marche

```powershell
cd worker/whisper-cpp
.\bin\whisper-cli.exe --help | Select-Object -First 10
# Doit afficher la liste des options whisper-cli
```

## 🐧 Setup — Linux VPS (production future)

Compilation depuis source (CPU optimisé pour le CPU réel du VPS) :

```bash
# Dépendances
sudo apt update
sudo apt install -y build-essential cmake git libopenblas-dev

# Clone + compile
cd /home/brandlock/worker/whisper-cpp
git clone https://github.com/ggml-org/whisper.cpp.git src
cd src
cmake -B build -DGGML_BLAS=1
cmake --build build -j --config Release

# Move binaries to expected location
mkdir -p ../bin
cp build/bin/whisper-cli ../bin/
cp build/bin/whisper-server ../bin/

# Download model (même fichier que Windows, c'est portable)
mkdir -p ../models
cd ../models
curl -L -o ggml-large-v3.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin

# Test
cd /home/brandlock/worker/whisper-cpp
./bin/whisper-cli --help
```

## ⚡ Performances observées (vidéo FR 94s)

| Setup                                   | Temps  | Ratio |
|-----------------------------------------|--------|-------|
| Win 11, CPU 16 threads + BLAS, no GPU   | ~107s  | 1.13x |
| Via Node spawn wrapper                  | ~138s  | 1.47x |
| Avec DTW activé (-nfa --dtw large.v3)   | ~150s  | 1.60x |

→ **Décision** : on n'utilise pas DTW (gain précision négligeable vs coût perf).

## 🚀 Setup — Windows (dev local)

### 1. Binaires (v1.8.4 BLAS)

```powershell
cd worker/whisper-cpp/bin

# Download
$url = "https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.4/whisper-blas-bin-x64.zip"
Invoke-WebRequest -Uri $url -OutFile whisper-blas-bin-x64.zip -UseBasicParsing
Expand-Archive -Path whisper-blas-bin-x64.zip -DestinationPath . -Force

# Le zip contient un sous-dossier Release/ — on remonte
Move-Item -Path .\Release\* -Destination . -Force
Remove-Item -Path .\Release -Force
Remove-Item whisper-blas-bin-x64.zip
```

### 2. Modèle large-v3 (~2.9 GB, 3-10 min)

```powershell
cd worker/whisper-cpp/models

curl.exe -L --ssl-no-revoke -o ggml-large-v3.bin "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin"

# Vérifie la taille
Get-Item ggml-large-v3.bin | Select-Object Name, @{Name="SizeMB";Expression={[math]::Round($_.Length / 1MB, 2)}}
# Attendu : ~2952 MB
```

### 3. Test que ça marche

```powershell
cd worker/whisper-cpp
.\bin\whisper-cli.exe --help | Select-Object -First 10
# Doit afficher la liste des options whisper-cli
```

## 🐧 Setup — Linux VPS (production future)

Compilation depuis source (CPU optimisé pour le CPU réel du VPS) :

```bash
# Dépendances
sudo apt update
sudo apt install -y build-essential cmake git libopenblas-dev

# Clone + compile
cd /home/brandlock/worker/whisper-cpp
git clone https://github.com/ggml-org/whisper.cpp.git src
cd src
cmake -B build -DGGML_BLAS=1
cmake --build build -j --config Release

# Move binaries to expected location
mkdir -p ../bin
cp build/bin/whisper-cli ../bin/
cp build/bin/whisper-server ../bin/

# Download model (même fichier que Windows, c'est portable)
mkdir -p ../models
cd ../models
curl -L -o ggml-large-v3.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin

# Test
cd /home/brandlock/worker/whisper-cpp
./bin/whisper-cli --help
```

## ⚡ Performances observées (vidéo FR 94s)

| Setup                                   | Temps  | Ratio |
|-----------------------------------------|--------|-------|
| Win 11, CPU 16 threads + BLAS, no GPU   | ~107s  | 1.13x |
| Via Node spawn wrapper                  | ~138s  | 1.47x |
| Avec DTW activé (-nfa --dtw large.v3)   | ~150s  | 1.60x |

→ **Décision** : on n'utilise pas DTW (gain précision négligeable vs coût perf).

## 🇨🇭 Pourquoi Whisper.cpp ?

- **Souveraineté maximale** : transcription 100% locale, zéro cloud externe
- **Word-level timestamps natifs** : précision ~50ms par mot
- **Pas de drift** sur vidéos longues (contrairement à Infomaniak)
- **Reproductible** : même binaire + modèle = même output exact
- **Pas de coût récurrent** par appel (vs API SaaS)