# Votica - General-Purpose Voting Platform with Runoff Voting

**English** | [日本語](README.ja.md)

A versatile voting web application built for GitHub Pages + Firebase (Authentication & Firestore), featuring multi-candidate runoff voting and automatic tie-break revoting.

---

## 🌟 Key Features

- **Multi-Round Runoff Voting**: Easily conduct successive runoff voting rounds (Round 2, Round 3, etc.) by extracting top candidates or tied winners.
- **Automatic Tie Detection**: Automatically alerts the administrator when a round ends in a tie for 1st place, allowing one-click runoff round creation.
- **Strict One-Vote-Per-Person Guarantee**: Powered by Firebase Authentication (Google Sign-In) and Firestore document security keyed by UID to prevent duplicate votes.
- **Flexible Options & Selection Limits**: Support for up to 20 options per poll. Voters can select "Single Choice" or "Multiple Choices (up to N options)".
- **Decentralized Poll Creation**: Any signed-in Google user can create polls and manage their own polls as an administrator.
- **Public / Admin-Only Results Visibility**: Results are restricted to the administrator by default. Admins can switch visibility to "Public" at any time.
- **Real-Time Live Results**: Live updates powered by Firestore real-time listeners instantly reflect votes in charts and rankings.
- **Full GitHub Pages Compatibility**: Compiles as a static SPA with QR code sharing and social media share links.

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables (Firebase)
Copy `.env.example` to `.env.local` and fill in your Firebase project credentials.
```bash
cp .env.example .env.local
```

> **Note**: Even without Firebase credentials, you can test all features locally using the built-in **Demo Mode** (persisted in browser localStorage). You can also configure and save Firebase credentials directly in the UI via the "Firebase" settings button in the navigation header.

### 3. Start Development Server
```bash
npm run dev
```

### 4. Run Tests
```bash
npm run test
```

### 5. Build for Production
```bash
npm run build
```

---

## 🔥 Firebase Setup Guide

### 1. Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add project**.
2. Enter a project name and follow the creation steps (Google Analytics is optional).

### 2. Enable Authentication (Google Sign-In)
1. Navigate to **Authentication** in the left sidebar and click **Get started**.
2. Under the **Sign-in method** tab, select **Google** and toggle **Enable**.
3. Select a project support email and save.
4. Under **Authorized domains**, add your GitHub Pages domain (e.g., `<username>.github.io`) and local development domain (`localhost`).

### 3. Create Cloud Firestore Database
1. Navigate to **Firestore Database** in the left sidebar and click **Create database**.
2. Select a database location (e.g., `asia-northeast1` or your preferred region).

### 4. Apply Firestore Security Rules
Copy the contents of `firestore.rules` from this repository and publish them in the **Firestore Database** -> **Rules** tab in the Firebase Console.

### 5. Create Firestore Composite Indexes
A composite index is required to query polls created by the user sorted by creation date (`creatorUid` + `createdAt`).

**Method A: Create via Firebase Console (Recommended & Easy)**
1. Open the **Firestore Database** -> **Indexes** tab in the Firebase Console and click **Add Index**.
2. Configure the following and click **Create index**:
   - **Collection ID**: `polls`
   - **Fields to index**:
     1. Field: `creatorUid` / Query scope: `Collection` / Order: `Ascending`
     2. Field: `createdAt` / Query scope: `Collection` / Order: `Descending`
3. Index building will complete in a few minutes.

> **Tip**: If a required index has not been created yet, Firebase will print a direct link in your browser's developer console when you access the app. Simply click the link and click **Create index**.

**Method B: Deploy with Firebase CLI**
You can deploy the index definition directly using `firestore.indexes.json` included in this repository:
```bash
firebase deploy --only firestore:indexes
```

### 6. Register Web App & Get API Keys
1. Go to **Project settings** (gear icon next to Project Overview).
2. Under **Your apps**, click the Web icon `</>` to register a web app.
3. Copy the values from `firebaseConfig` into your `.env.local` or GitHub repository Secrets.

---

## 🌐 Deploy to GitHub Pages

This repository includes `.github/workflows/deploy.yml` for automated CI/CD deployment on every push to GitHub.

### Setup Instructions:
1. **Configure Firebase Credentials (Secrets)**:
   - In your GitHub repository, go to **Settings** -> **Secrets and variables** -> **Actions**.
   - Under the **Secrets** tab, click **New repository secret** and add:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`
2. **Configure Google Analytics Tag ID (Variables, Optional)**:
   - Switch to the **Variables** tab under **Settings** -> **Secrets and variables** -> **Actions**.
   - Click **New repository variable** and add:
     - Name: `VITE_GA_MEASUREMENT_ID`
     - Value: `G-XXXXXXXXXX` (Your Google Analytics 4 Measurement ID / Tag ID)
   - *Note: If configured, the Google Analytics tracking script will automatically be injected during the build. If omitted, no tracking scripts are embedded.*
3. **Enable GitHub Pages**:
   - Go to **Settings** -> **Pages** and set **Source** to **GitHub Actions** under "Build and deployment".
4. **Deploy**:
   - Push your code to the `main` branch, and GitHub Actions will automatically build and deploy the app to GitHub Pages.

---

## 📁 Directory Structure

```
votica/
├── .github/workflows/deploy.yml # GitHub Pages automated deployment pipeline
├── public/
│   ├── favicon.svg             # App favicon
│   └── 404.html                # SPA fallback redirect for GitHub Pages
├── src/
│   ├── components/
│   │   ├── common/             # Button, Modal, FirebaseConfigModal
│   │   ├── layout/             # Header, Footer
│   │   ├── poll/               # OptionInputList, VoteOptionCard, CountdownTimer, ShareModal, RunoffWizardModal, PollCard
│   │   └── results/            # ResultBarChart, WinnerBadge, RoundSelector
│   ├── contexts/               # AuthContext, ToastContext
│   ├── lib/
│   │   ├── firebase.ts         # Firebase initialization & runtime config management
│   │   ├── firestoreService.ts # Firestore CRUD & real-time listeners
│   │   ├── runoffUtils.ts      # Runoff voting, tie detection, & ranking calculation
│   │   └── types.ts            # TypeScript type definitions
│   ├── pages/
│   │   ├── HomePage.tsx        # Home page (Poll list & join)
│   │   ├── CreatePollPage.tsx  # Poll creation page
│   │   ├── PollVotingPage.tsx  # Voting page
│   │   ├── PollResultsPage.tsx # Results & administration page
│   │   └── NotFoundPage.tsx    # 404 Not Found page
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── firestore.rules             # Cloud Firestore security rules
├── firestore.indexes.json      # Cloud Firestore composite index definitions
├── .env.example                # Environment variable template
└── package.json
```

---

## 📄 License

MIT License
