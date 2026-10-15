@echo off
setlocal
cd /d "%~dp0"

set "VENV_DIR=%~dp0.venv"
set "PYTHON_EXE=%VENV_DIR%\Scripts\python.exe"

if not exist "%PYTHON_EXE%" (
    where py >nul 2>nul
    if errorlevel 1 (
        where python >nul 2>nul
        if errorlevel 1 goto :python_missing
        python -m venv "%VENV_DIR%"
    ) else (
        py -3 -m venv "%VENV_DIR%"
    )
    if errorlevel 1 goto :setup_failed
)

if not exist "%PYTHON_EXE%" goto :setup_failed

"%PYTHON_EXE%" -c "import openai, rich, prompt_toolkit, pyfiglet, dotenv" >nul 2>nul
if errorlevel 1 (
    echo Installing CAMIN dependencies...
    "%PYTHON_EXE%" -m pip install --disable-pip-version-check -r "%~dp0requirements.txt"
    if errorlevel 1 goto :setup_failed
)

"%PYTHON_EXE%" -m py_compile "%~dp0cli.py"
if errorlevel 1 goto :setup_failed

echo Starting CAMIN...
"%PYTHON_EXE%" "%~dp0cli.py"
set "APP_EXIT_CODE=%ERRORLEVEL%"
if not "%APP_EXIT_CODE%"=="0" goto :app_failed

echo.
echo CAMIN closed.
pause
exit /b 0

:python_missing
echo Python 3 was not found. Install Python 3 and enable the Python Launcher or PATH.
goto :failed

:setup_failed
echo CAMIN setup failed. Check Python, your internet connection, and requirements.txt.
goto :failed

:app_failed
echo CAMIN exited with code %APP_EXIT_CODE%.

:failed
pause
exit /b 1
