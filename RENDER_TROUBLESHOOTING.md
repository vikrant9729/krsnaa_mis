# 🔧 RENDER DEPLOYMENT TROUBLESHOOTING

## ✅ FIX APPLIED - Push to GitHub Complete!

Your latest commit (`f3995d5`) includes the fix for the build error.

---

## 🎯 What Was Fixed:

### Problem:
```
error: metadata-generation-failed
× Encountered error while generating package metadata.
╰─> pydantic-core
```

### Root Cause:
- Render was using **Python 3.14** (too new, unstable)
- `pydantic-core` couldn't compile on Python 3.14
- Pinned dependency versions caused conflicts

### Solution Applied:
1. ✅ Changed dependencies from pinned (`==`) to flexible (`>=`) versions
2. ✅ Added `render.yaml` to force Python 3.11.0
3. ✅ Ensured compatible package versions

---

## 🚀 Next Steps on Render:

### Option 1: Manual Redeploy (Recommended)

1. **Go to:** https://dashboard.render.com
2. **Click** on your `krsnaa-mis-backend` service
3. **Click** "Manual Deploy" → "Deploy latest commit"
4. **Wait** 3-5 minutes
5. **Check** logs for successful build

### Option 2: Wait for Auto-Deploy

Since auto-deploy is enabled, Render will automatically:
1. Detect the new commit
2. Start a new build
3. Deploy if successful

**This should happen within 1-2 minutes**

---

## ✅ Expected Build Output (Successful):

```
==> Cloning from https://github.com/vikrant9729/krsnaa_mis
==> Checking out commit f3995d5 in branch main
==> Using Python version 3.11.0
==> Running build command 'pip install --upgrade pip && pip install -r requirements.txt'...
Requirement already satisfied: pip in /opt/render/project/src/.venv/lib/python3.11/site-packages
Collecting fastapi>=0.100.0,<1.0.0
  Downloading fastapi-0.115.11-py3-none-any.whl
Collecting pydantic>=2.0.0,<3.0.0
  Downloading pydantic-2.10.6-py3-none-any.whl
...
Successfully installed fastapi-0.115.11 pydantic-2.10.6 ...
==> Build complete ✅
==> Starting service...
```

---

## 🐛 If Build Still Fails:

### Issue 1: Still using Python 3.14

**Fix:**
1. Go to Render Dashboard
2. Click your service
3. Go to **Settings**
4. Scroll to **Python Version**
5. Manually set to: `3.11.0`
6. Save and redeploy

### Issue 2: Missing DATABASE_URL

**Error:**
```
ValidationError: database_url field required
```

**Fix:**
1. Go to Render Dashboard → Your service
2. Click **Environment** tab
3. Add environment variable:
   ```
   Key: DATABASE_URL
   Value: postgresql://postgres.xxx:password@aws-0-xxx.pooler.supabase.com:5432/postgres
   ```
4. Save and redeploy

### Issue 3: Missing SECRET_KEY

**Error:**
```
ValidationError: jwt_secret field required
```

**Fix:**
1. Go to Render Dashboard → Your service
2. Click **Environment** tab
3. Add environment variable:
   ```
   Key: SECRET_KEY
   Value: [generate a random 64-character string]
   ```
   
**Generate a secret key:**
- Visit: https://generate-secret.vercel.app/64
- Or run locally: `python -c "import secrets; print(secrets.token_urlsafe(64))"`

4. Save and redeploy

### Issue 4: Build timeout

**Error:**
```
Build timed out after 15 minutes
```

**Fix:**
1. The free tier has a 15-minute build limit
2. Try again (sometimes it's just slow)
3. If persistent, consider upgrading to Render Pro ($7/month)

---

## 📋 Required Environment Variables:

Make sure ALL of these are set in Render:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | `postgresql://...` | ✅ Yes |
| `SECRET_KEY` | `random-64-char-string` | ✅ Yes |
| `ALGORITHM` | `HS256` | ✅ Yes |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | ✅ Yes |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` | ✅ Yes |
| `ENVIRONMENT` | `production` | ✅ Yes |

---

## 🔍 How to Check Logs:

1. **Go to:** https://dashboard.render.com
2. **Click** your backend service
3. **Click** "Logs" tab
4. **Look for:**
   - ✅ `INFO: Application startup complete.` (Success)
   - ❌ `ERROR: Failed to start` (Problem)

### Common Log Messages:

**✅ Success:**
```
INFO:     Started server process [1]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:10000
```

**❌ Database Error:**
```
sqlalchemy.exc.OperationalError: could not connect to server
```
**Fix:** Check DATABASE_URL is correct

**❌ Missing Environment Variable:**
```
pydantic_core.ValidationError: field required
```
**Fix:** Add missing environment variable

---

## 🧪 Test After Deployment:

### 1. Check Health Endpoint:

```
GET https://your-backend.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "app": "KRSNAA MIS DOS Platform",
  "version": "2.0.0"
}
```

### 2. Check API Docs:

```
GET https://your-backend.onrender.com/docs
```

**Expected:** Swagger UI loads successfully

### 3. Test Database Connection:

```
GET https://your-backend.onrender.com/api/centers
```

**Expected:** Returns centers list (or empty array)

**If you get 500 error:** Database connection issue

---

## 🆘 Still Having Issues?

### Step 1: Check Render Logs

```
Dashboard → Your Service → Logs
```

### Step 2: Verify Environment Variables

```
Dashboard → Your Service → Environment
```

### Step 3: Test Locally

```bash
cd backend
python -m uvicorn app.main:app --reload
```

If it works locally but not on Render → Environment variable issue

### Step 4: Check GitHub Commit

```
https://github.com/vikrant9729/krsnaa_mis/commit/f3995d5
```

Verify the latest commit is deployed

---

## 📞 Render Support Resources:

- **Docs:** https://render.com/docs
- **Python Guide:** https://render.com/docs/python
- **Troubleshooting:** https://render.com/docs/troubleshooting-deploys
- **Community:** https://community.render.com

---

## ✅ Success Checklist:

After deployment, verify:

- [ ] Build completed successfully (green checkmark)
- [ ] Service status: "Live"
- [ ] Health endpoint returns 200 OK
- [ ] API docs load (`/docs`)
- [ ] Can login to frontend
- [ ] Database queries work
- [ ] No errors in logs

---

## 🎯 Quick Commands:

### View Latest Commit:
```bash
git log --oneline -1
```

### Check Remote:
```bash
git remote -v
```

### View Render Service:
```
https://dashboard.render.com
```

---

## 💡 Pro Tips:

1. **Always check logs first** when deployment fails
2. **Environment variables are case-sensitive**
3. **DATABASE_URL must include full connection string**
4. **SECRET_KEY should be at least 32 characters**
5. **Free tier spins down after 15 min** (first request after spin-down takes 30s)

---

## 🎉 After Successful Deployment:

Your backend will be available at:
```
https://krsnaa-mis-backend.onrender.com
```

**Next step:** Deploy frontend to Vercel and connect to this backend!

---

**Last Updated:** 2025-04-23
**Latest Commit:** f3995d5
