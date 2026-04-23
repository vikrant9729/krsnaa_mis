# 🚀 QUICK START - KRSNAA MIS

## ⚡ SUPER FAST SETUP (2 Steps)

### Step 1: Start Backend
```bash
cd backend
start_server.bat
```

### Step 2: Start Frontend (New Terminal)
```bash
cd frontend
npm run dev
```

### That's It! 🎉
Open browser: **http://localhost:3000**

Login: 
- Username: `admin`
- Password: `admin123`

---

## 📋 WHAT'S NEW?

### ✅ FULLY AUTOMATIC!

**No more running manual scripts!** All database setup, migrations, and fixes now happen automatically when you start the backend.

#### Old Way (Purana Tarika):
```
❌ Start Server
❌ Get Error
❌ Run check_db.py
❌ Run add_mrp_columns.py
❌ Run migrate_bill_type.py
❌ Run create_admin.py
❌ Run repair_mrp.py
❌ Run optimize_db.py
❌ Run sync_local_services.py
❌ ... and 15 more scripts!
❌ Finally works!
```

#### New Way (Naya Tarika):
```
✅ Start Server
✅ Automatic Setup Runs
✅ Works Perfectly!
```

---

## 🗂️ NEW FILES

| File | Purpose |
|------|---------|
| `auto_setup.py` | All-in-one automatic setup |
| `quick_check.py` | Database health checker |
| `start_server.bat` | Windows server starter (double-click!) |
| `start_server.ps1` | PowerShell server starter |
| `AUTO_SETUP.md` | Technical documentation |
| `README_HINDI.md` | Hindi/English guide |

---

## 🔧 COMMANDS

### Start Backend:
```bash
cd backend
start_server.bat
```

### Check Database Health:
```bash
cd backend
python quick_check.py
```

### Manual Setup (Rarely Needed):
```bash
cd backend
python auto_setup.py
```

### Start Frontend:
```bash
cd frontend
npm run dev
```

---

## 💡 TIPS

1. **Always start backend first**, then frontend
2. **Wait for** "Server is ready to accept requests" message
3. **Check console** for automatic setup progress
4. **Run quick_check.py** if something seems wrong

---

## 📚 DOCUMENTATION

- **Hindi Guide**: `backend/README_HINDI.md`
- **Technical Docs**: `backend/AUTO_SETUP.md`
- **Main README**: `README.md` (root folder)

---

## ❓ TROUBLESHOOTING

### Problem: Backend won't start
**Solution**: Check if port 8000 is already in use

### Problem: Database errors
**Solution**: Run `python auto_setup.py`

### Problem: Can't login
**Solution**: Run `python auto_setup.py` (creates admin user)

### Problem: Tests not showing
**Solution**: Automatic setup handles this on startup

---

## 🎯 WHAT AUTOMATIC SETUP DOES

1. ✅ Creates all database tables
2. ✅ Adds missing columns
3. ✅ Creates performance indexes
4. ✅ Backfills missing data
5. ✅ Creates admin user
6. ✅ Repairs center test rates
7. ✅ Syncs all services

**All in ~2-5 seconds!**

---

## 🚀 YOU'RE ALL SET!

Just run `start_server.bat` and enjoy your smooth-running KRSNAA MIS! 🎉
