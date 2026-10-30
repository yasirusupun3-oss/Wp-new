# Wp-earn-money — Deployment Guide

## 1. GitHub වලට Upload කරන විදිය

```bash
cd Wpliveapp
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

> `.gitignore` එකේ `node_modules`, `.next`, සහ `.env*` files ඔක්කොම exclude කරලා තියෙනවා —
> ඒ නිසා ඔයාගේ real secret keys accidentally commit වෙන්නේ නෑ.

## 2. Vercel වලට Deploy කරන විදිය

1. [vercel.com](https://vercel.com) → **New Project** → ඔයාගේ GitHub repo එක import කරන්න.
2. **Environment Variables** step එකේදී (හෝ Project → Settings → Environment Variables
   එකෙන් පස්සේ) පහත list එකේ තියෙන variable ඔක්කොම **Production** environment එකට add
   කරන්න — විස්තර සම්පූර්ණයෙන් `.env.example` file එකේ තියෙනවා:

   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (quotes ඇතුළත paste කරන්න, `\n` escapes ඒ විදියටම තියෙන්න දෙන්න)
   - `NEXT_PUBLIC_AGORA_APP_ID`
   - `AGORA_APP_CERTIFICATE`
   - `OXA_PAY_API_KEY`
   - `OXA_PAY_BASE_URL`
   - `OXA_PAY_WEBHOOK_SECRET` (optional)
   - `NEXT_PUBLIC_BASE_URL` (Vercel domain එක දාන්න, e.g. `https://your-app.vercel.app`)

3. **Deploy** click කරන්න.
4. Deploy වුනාට පස්සේ, OxaPay dashboard එකේ webhook URL එක
   `https://<your-domain>/api/oxapay/webhook` කියලා set කරන්න.

## 3. Firestore Setup (එක පාරක් විතරයි)

- Firebase Console → Firestore Database → Create database (production mode).
- `users/{uid}` document එකක් register වෙනකොට automatic-ම හැදෙනවා
  (`coinBalance` field එකත් එක්කම).
- Security Rules: authenticated user කෙනෙක්ට තමන්ගේම data එක read/write කරන්න
  සහ තමන් සම්බන්ධ chats/messages access කරන්න පුළුවන් විදියට rules සකසන්න.

## 4. Local එකේ test කරන විදිය

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```
