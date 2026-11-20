@echo off
cd /d "%~dp0"
node -v || (pause & exit /b 1)
if not exist data\ecosystem.sqlite.files\manifest.json if not exist data\ecosystem.sqlite set /p OWNER_PASSWORD=Choose owner password (at least 12 characters): 
npm.cmd start
pause
