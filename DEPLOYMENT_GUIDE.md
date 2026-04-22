# Deployment Guide: How to make your Krsnaa MIS App Public

This guide explains how to take your local application and deploy it to the internet so that anyone with the URL can access it.

## 1. Prerequisites
*   A **GitHub** account to host your code.
*   A **Supabase** account (You are already using this for your database).
*   A **Vercel** account (For the Frontend).
*   A **Render** or **Railway** account (For the Backend).

---

## 2. Step 1: Upload Code to GitHub
1.  Create a new private repository on GitHub.
2.  Push your entire project folder to this repository.
    ```bash
    git init
    git add .
    git commit -m "Initial commit for production"
    git remote add origin <your-github-repo-url>
    git push -u origin main
    ```

---

## 3. Step 2: Deploy Backend (FastAPI) to Render.com
1.  Log in to [Render.com](https://render.com).
2.  Click **New +** and select **Web Service**.
3.  Connect your GitHub repository.
4.  Configure the service:
    *   **Runtime**: Python
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5.  Add **Environment Variables**:
    *   `DATABASE_URL`: (Your Supabase string from `.env`)
    *   `JWT_SECRET`: (A long random string for security)
6.  Click **Deploy**. Once finished, copy the URL (e.g., `https://krsnaa-backend.onrender.com`).

---

## 4. Step 3: Deploy Frontend (Next.js) to Vercel
1.  Log in to [Vercel.com](https://vercel.com).
2.  Click **Add New** -> **Project**.
3.  Import your GitHub repository.
4.  In **Project Settings**, go to **Environment Variables**:
    *   Add `NEXT_PUBLIC_API_URL`: (Paste your Render Backend URL here).
5.  Click **Deploy**. Vercel will give you a public URL (e.g., `https://krsnaa-mis.vercel.app`).

---

## 5. Step 4: Final Security Polish (CORS)
To allow your Frontend to talk to your Backend safely, you must update the CORS settings in the backend code.

1.  Open `backend/app/main.py`.
2.  Update the `allow_origins` list:
    ```python
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "https://your-vercel-app-url.vercel.app", # Add your public URL here
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    ```

---

## 6. Going Live with a Custom Domain
If you want a professional address like `mis.krsnaadiagnostics.com`:
1.  Buy the domain (GoDaddy, Namecheap, etc.).
2.  In Vercel, go to **Settings > Domains** and follow the instructions to connect it.

---

**Need Help?** Just ask me to "Prepare the code for Vercel/Render" and I will create the necessary configuration files (`requirements.txt`, `procfile`, etc.) for you.
