# 🚀 QUICK DEPLOY - KRSNAA MIS

## Deploy Your App in 15 Minutes (FREE!)

### 📋 What You Need:
- ✅ GitHub account (already have: vikrant9729)
- ✅ 15 minutes of time
- ✅ Your code is already on GitHub!

---

## 🎯 Step-by-Step (Copy-Paste Friendly)

### STEP 1: Create Database (3 min)

1. Go to: **https://supabase.com**
2. Click **"Start your project"**
3. Sign in with GitHub
4. Click **"New Project"**
5. Fill in:
   ```
   Name: krsnaa-mis
   Password: [Create a strong password - SAVE IT!]
   Region: [Choose closest to you]
   ```
6. Wait 2 minutes
7. Go to: **Settings → Database**
8. Copy **Connection string** (URI format)
   ```
   postgresql://postgres.xxxxx:password@aws-0-xxxx.pooler.supabase.com:5432/postgres
   ```

---

### STEP 2: Deploy Backend (5 min)

1. Go to: **https://render.com**
2. Click **"Get Started for Free"**
3. Sign in with GitHub
4. Click **"New +"** → **"Web Service"**
5. Connect your repository:
   ```
   Select: vikrant9729/krsnaa_mis
   ```
6. Configure:
   ```
   Name: krsnaa-mis-backend
   Root Directory: backend
   Environment: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   Instance Type: Free
   ```

7. Add Environment Variables (click "Advanced"):
   ```
   DATABASE_URL=postgresql://[paste from Step 1]
   SECRET_KEY=my-super-secret-key-12345678901234567890
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   FRONTEND_URL=https://localhost:3000
   ENVIRONMENT=production
   ```

8. Click **"Create Web Service"**
9. Wait 5 minutes
10. **COPY YOUR BACKEND URL:**
    ```
    https://krsnaa-mis-backend-xxxx.onrender.com
    ```

---

### STEP 3: Deploy Frontend (3 min)

1. Go to: **https://vercel.com**
2. Click **"Sign Up"**
3. Sign in with GitHub
4. Click **"Add New..."** → **"Project"**
5. Import repository:
   ```
   Select: vikrant9729/krsnaa_mis
   ```
6. Configure:
   ```
   Framework Preset: Next.js
   Root Directory: frontend
   ```
7. Add Environment Variable:
   ```
   Name: NEXT_PUBLIC_API_URL
   Value: https://krsnaa-mis-backend-xxxx.onrender.com
   [Use your backend URL from Step 2!]
   ```
8. Click **"Deploy"**
9. Wait 3 minutes
10. **YOUR APP IS LIVE!**
    ```
    https://krsnaa-mis-xxxx.vercel.app
    ```

---

### STEP 4: Create Admin User (2 min)

1. Open your backend docs:
   ```
   https://krsnaa-mis-backend-xxxx.onrender.com/docs
   ```
2. Scroll to **`/api/users/`** POST endpoint
3. Click **"Try it out"**
4. Enter:
   ```json
   {
     "username": "admin",
     "password": "admin123",
     "role": "admin"
   }
   ```
5. Click **"Execute"**
6. **Login to your app!**

---

## ✅ You're Done!

**Your Links:**
- Frontend: `https://krsnaa-mis-xxxx.vercel.app`
- Backend: `https://krsnaa-mis-backend-xxxx.onrender.com`
- API Docs: `https://krsnaa-mis-backend-xxxx.onrender.com/docs`

---

## 🔄 Update Your App

Just push to GitHub:
```bash
git add .
git commit -m "update"
git push origin main
```

Auto-deploys in 3-5 minutes!

---

## 🆘 Need Help?

- Full Guide: `DEPLOYMENT_GUIDE.md`
- Render Docs: https://render.com/docs
- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs

---

## 💰 Cost: $0/month

- Frontend (Vercel): FREE
- Backend (Render): FREE  
- Database (Supabase): FREE

**Total: $0/month** ✨
