# 🚀 DEPLOYMENT GUIDE - KRSNAA MIS Application

## Complete Step-by-Step Guide to Host from GitHub

This guide will help you deploy your KRSNAA MIS application to cloud platforms using your GitHub repository.

---

## 📋 **Architecture Overview**

```
Frontend (Next.js) → Vercel (Free)
Backend (FastAPI) → Render/Railway (Free)
Database → Supabase/Neon (Free PostgreSQL)
```

---

## 🗄️ **STEP 1: Setup Database (PostgreSQL)**

### Option A: Supabase (Recommended - Free)

1. **Go to:** https://supabase.com
2. **Sign up** with GitHub account
3. **Click "New Project"**
4. **Fill in:**
   - Project name: `krsnaa-mis`
   - Database password: (create a strong password)
   - Region: Choose closest to you
5. **Wait 2 minutes** for database to be ready
6. **Go to Project Settings → Database**
7. **Copy Connection String** (URI format):
   ```
   postgresql://postgres.[project-id]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
   ```

### Option B: Neon Database (Free)

1. **Go to:** https://neon.tech
2. **Sign up** with GitHub
3. **Create Project**
4. **Copy Connection String**

---

## 🔧 **STEP 2: Deploy Backend (FastAPI)**

### Platform: Render.com (Free Tier)

1. **Go to:** https://render.com
2. **Sign up** with GitHub account
3. **Click "New +" → "Web Service"**
4. **Connect Repository:**
   - Select: `vikrant9729/krsnaa_mis`
   - If not visible, grant access to repository
5. **Configure:**
   - **Name:** `krsnaa-mis-backend`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** `Free`

6. **Add Environment Variables:**
   Click "Advanced" → "Add Environment Variable":
   
   ```
   DATABASE_URL=postgresql://[your-supabase-connection-string]
   SECRET_KEY=your-super-secret-random-string-here
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   FRONTEND_URL=https://your-frontend-url.vercel.app
   ENVIRONMENT=production
   ```

7. **Click "Create Web Service"**
8. **Wait 5-10 minutes** for deployment
9. **Copy your backend URL:**
   ```
   https://krsnaa-mis-backend.onrender.com
   ```

### Alternative: Railway.app (Free Tier)

1. **Go to:** https://railway.app
2. **Sign up** with GitHub
3. **New Project → Deploy from GitHub repo**
4. **Select:** `vikrant9729/krsnaa_mis`
5. **Configure:**
   - Root directory: `/backend`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. **Add environment variables** (same as above)
7. **Deploy**

---

## 🎨 **STEP 3: Deploy Frontend (Next.js)**

### Platform: Vercel (Free - Made by Next.js creators)

1. **Go to:** https://vercel.com
2. **Sign up** with GitHub account
3. **Click "Add New..." → "Project"**
4. **Import Repository:**
   - Select: `vikrant9729/krsnaa_mis`
5. **Configure:**
   - **Framework Preset:** `Next.js`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)

6. **Add Environment Variable:**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.onrender.com
   ```
   **IMPORTANT:** Replace with your actual backend URL from Step 2!

7. **Click "Deploy"**
8. **Wait 3-5 minutes** for deployment
9. **Your frontend URL:**
   ```
   https://krsnaa-mis.vercel.app
   ```

---

## 🔐 **STEP 4: Configure CORS**

After deployment, update backend CORS settings:

1. **Go to your Render backend dashboard**
2. **Edit `backend/app/main.py`** or add environment variable
3. **Update allowed origins:**

```python
# In backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://krsnaa-mis.vercel.app",  # Your Vercel URL
        "http://localhost:3000",  # Local development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

4. **Redeploy backend** (automatic on push)

---

## 👤 **STEP 5: Create Admin User**

After backend is deployed:

1. **Go to your backend URL:**
   ```
   https://your-backend.onrender.com/docs
   ```

2. **Use the API to create admin:**
   - Go to `/users` endpoint
   - OR SSH into backend and run:
   ```bash
   python create_admin.py
   ```

3. **Default admin credentials:**
   ```
   Username: admin
   Password: admin123
   ```
   **Change this immediately after first login!**

---

## ✅ **STEP 6: Verify Deployment**

### Test Backend:

1. **Open:** `https://your-backend.onrender.com/docs`
2. **You should see:** Swagger API documentation
3. **Test endpoint:** `/api/health`
4. **Expected response:**
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "environment": "production"
   }
   ```

### Test Frontend:

1. **Open:** `https://your-frontend.vercel.app`
2. **You should see:** Login page
3. **Login with admin credentials**
4. **Test features:**
   - Dashboard
   - Centers
   - Master Data
   - Rate Management

---

## 🔧 **Environment Variables Reference**

### Backend (.env):

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SECRET_KEY=your-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
FRONTEND_URL=https://your-frontend.vercel.app
ENVIRONMENT=production

# Optional - AI Features
OPENAI_API_KEY=sk-xxx
GOOGLE_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
```

### Frontend (.env.local):

```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

---

## 📊 **Free Tier Limits**

### Render.com (Backend):
- ✅ 512 MB RAM
- ✅ 0.1 CPU
- ⚠️ Spins down after 15 min inactivity (30s wake-up)
- ✅ 100 GB bandwidth/month

### Vercel (Frontend):
- ✅ 100 GB bandwidth/month
- ✅ Automatic HTTPS
- ✅ Unlimited deployments
- ✅ Custom domains

### Supabase (Database):
- ✅ 500 MB database
- ✅ 2 GB bandwidth/month
- ✅ Daily backups
- ✅ Unlimited API requests

---

## 🎯 **Custom Domain (Optional)**

### For Frontend (Vercel):

1. **Go to Vercel Dashboard**
2. **Select your project**
3. **Settings → Domains**
4. **Add your domain:** `mis.krsnaa.com`
5. **Update DNS records** as instructed

### For Backend (Render):

1. **Go to Render Dashboard**
2. **Select your service**
3. **Settings → Custom Domain**
4. **Add domain:** `api.krsnaa.com`
5. **Update DNS CNAME record**

---

## 🔄 **Updating Your Application**

After deployment, updates are automatic:

```bash
# Make changes locally
git add .
git commit -m "your update"
git push origin main
```

**Result:**
- ✅ Backend auto-deploys on Render (~5 min)
- ✅ Frontend auto-deploys on Vercel (~3 min)

---

## 🐛 **Troubleshooting**

### Backend Won't Start:

**Check logs:**
1. Go to Render Dashboard
2. Click your service
3. View "Logs" tab

**Common issues:**
- ❌ Missing environment variables
- ❌ Database connection string wrong
- ❌ Requirements.txt missing packages

### Frontend Can't Connect to Backend:

**Check:**
1. `NEXT_PUBLIC_API_URL` is correct
2. Backend CORS includes frontend URL
3. Backend is running (check `/docs` endpoint)

### Database Connection Errors:

**Verify:**
1. DATABASE_URL format is correct
2. Database allows connections from Render
3. In Supabase: Settings → Database → Enable "Network Access"

---

## 💰 **Cost Breakdown**

### Completely FREE Option:
- Frontend: Vercel - $0/month
- Backend: Render - $0/month
- Database: Supabase - $0/month
- **Total: $0/month** ✨

### Production Option (Recommended):
- Frontend: Vercel Pro - $20/month
- Backend: Render Standard - $7/month
- Database: Supabase Pro - $25/month
- **Total: ~$52/month**

---

## 🚀 **Quick Deploy Commands**

After initial setup, deploy with:

```bash
# Push to GitHub (triggers auto-deploy)
git add .
git commit -m "update"
git push origin main

# Check deployment status
# Frontend: https://vercel.com/vikrant9729/krsnaa-mis
# Backend: https://dashboard.render.com
```

---

## 📞 **Need Help?**

### Documentation:
- Render: https://render.com/docs
- Vercel: https://vercel.com/docs
- Supabase: https://supabase.com/docs

### Your Repository:
- GitHub: https://github.com/vikrant9729/krsnaa_mis

---

## ✅ **Deployment Checklist**

- [ ] Database created (Supabase/Neon)
- [ ] Backend deployed (Render/Railway)
- [ ] Frontend deployed (Vercel)
- [ ] Environment variables set
- [ ] CORS configured
- [ ] Admin user created
- [ ] Tested login
- [ ] Tested all features
- [ ] Custom domain added (optional)
- [ ] SSL certificates active (automatic)

---

## 🎉 **You're Done!**

Your KRSNAA MIS application is now live and accessible from anywhere in the world!

**Example URLs:**
- Frontend: https://krsnaa-mis.vercel.app
- Backend: https://krsnaa-mis-backend.onrender.com
- API Docs: https://krsnaa-mis-backend.onrender.com/docs

---

**Last Updated:** 2025-04-23
**Repository:** https://github.com/vikrant9729/krsnaa_mis
