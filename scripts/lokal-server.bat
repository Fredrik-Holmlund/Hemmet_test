@echo off
rem Startar HEMMET lokalt på http://localhost:5173 och öppnar webbläsaren. Stäng fönstret för att stoppa.
cd /d "%~dp0.."
start "" http://localhost:5173
python scripts\serve.py
