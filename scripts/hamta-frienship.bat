@echo off
rem Hämtar Frienship (Stitches EU, Hardcore) och bygger om sidan.
rem Körs var 30:e minut av Windows schemaläggare. Loggen hamnar i data\hc\hamtning.log
cd /d "%~dp0.."
echo ==== %date% %time% ==== >> data\hc\hamtning.log
python scripts\fetch_hemmet.py --realm stitches --guild "Frienship" --out data/hc >> data\hc\hamtning.log 2>&1
python scripts\build_hemmet.py >> data\hc\hamtning.log 2>&1
