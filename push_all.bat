@echo off
chcp 65001 >nul
echo ========================================
echo   Push All Changes to GitHub
echo ========================================
echo.

:: เข้า folder
cd /d "C:\Users\USER\Desktop\code lab\gold-stat"

:: แสดงไฟล์ที่เปลี่ยนแปลง
echo [1/4] Checking changes...
git status --short
echo.

:: ถามยืนยัน
set /p confirm="Push all changes? (y/n): "
if /i not "%confirm%"=="y" (
    echo Cancelled.
    pause
    exit /b
)

:: เพิ่มไฟล์ทั้งหมด
echo.
echo [2/4] Adding files...
git add .

:: ถาม commit message
echo.
set /p msg="Enter commit message: "
if "%msg%"=="" set msg=Update code

:: Commit
echo.
echo [3/4] Committing...
git commit -m "%msg%"

:: Push
echo.
echo [4/4] Pushing to GitHub...
git push

echo.
echo ========================================
echo   Done!
echo ========================================
pause
