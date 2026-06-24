# How to Deploy POS System

## Step 1 - Push to GitHub
1. Go to github.com and create a NEW repository called "pos-system"
2. Make it Private
3. Copy the repository URL (looks like https://github.com/yourusername/pos-system.git)
4. Run these commands in Cursor terminal:
   git remote add origin YOUR_GITHUB_URL_HERE
   git branch -M main
   git push -u origin main

## Step 2 - Deploy on Vercel
1. Go to vercel.com and sign in
2. Click "Add New Project"
3. Click "Import" next to your pos-system repository
4. Under "Environment Variables" add:
   - NEXT_PUBLIC_SUPABASE_URL = (your supabase project url)
   - NEXT_PUBLIC_SUPABASE_ANON_KEY = (your supabase anon key)
5. Click "Deploy"
6. Wait 2-3 minutes — your site will be live!

## Step 3 - Your live URL
Your POS will be live at: https://pos-system.vercel.app
Share this URL with clients!
