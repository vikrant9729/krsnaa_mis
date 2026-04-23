@echo off
echo ============================================================
echo    PUSHING CODE TO GITHUB
echo ============================================================
echo.

cd /d "%~dp0"

echo Step 1: Adding all files...
git add .
echo.

echo Step 2: Committing changes...
git commit -m "feat: Complete system overhaul - Auto setup, bulk update fixes, error handling, and TypeScript fixes

- Added automatic database setup system (auto_setup.py)
- Fixed cross-network bulk update to auto-add missing tests
- Fixed React rendering errors with formatApiError
- Fixed TypeScript errors in MasterTest interface
- Added health check and diagnostic tools
- Added comprehensive documentation
- Improved error handling across all pages
- Added startup scripts for easy server management"
echo.

echo Step 3: Pulling latest changes...
git pull origin main --allow-unrelated-histories --no-edit
echo.

echo Step 4: Pushing to GitHub...
git push origin main
echo.

echo ============================================================
echo    DONE! Code pushed to GitHub successfully!
echo    Repository: https://github.com/vikrant9729/krsnaa_mis
echo ============================================================
echo.
pause
