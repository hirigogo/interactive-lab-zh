@echo off
REM 一键启动中文版「交互式实验室」
REM 双击本文件即可：自动启动本地服务器并打开浏览器。

setlocal
set "SITE_DIR=%~dp0docs"
set "PORT=4173"
set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"

if not exist "%PY%" (
  where python >nul 2>nul
  if errorlevel 1 (
    echo [错误] 未找到 Python。请先安装 Python 3，或修改本文件里的 PY 变量。
    pause
    exit /b 1
  )
  set "PY=python"
)

if not exist "%SITE_DIR%\index.html" (
  echo [错误] 未找到已构建的站点：%SITE_DIR%
  echo 请先在项目根目录运行：python i18n\inject.py ^&^& python i18n\build_site.py
  pause
  exit /b 1
)

echo 正在启动本地服务器 http://localhost:%PORT%
echo 关闭本窗口即可停止服务。
start "" "http://localhost:%PORT%/"
"%PY%" -m http.server %PORT% --directory "%SITE_DIR%"
