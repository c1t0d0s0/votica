# Votica (ヴォティカ) - 決選投票対応 汎用投票プラットフォーム

[English](README.md) | **日本語**

多人数での決選投票や同率1位の自動再投票機能を備えた、GitHub Pages + Firebase (Authentication & Firestore) で動作する汎用投票Webアプリケーションです。

---

## 🌟 特徴・主な機能

- **多人数での決選投票 (Runoff Voting)**: 複数候補から上位候補や同率1位候補のみを抽出した決選投票ラウンド（第2回投票、第3回投票…）を簡単に実施可能
- **同率1位の自動検出**: 投票結果が同率1位となった場合、管理者にアラートを表示し、ワンクリックで決選投票ラウンドを作成
- **Google認証による厳格な1人1票保証**: Firebase Authentication (Googleログイン) を使用し、Firestore のドキュメントキーに UID を使用して多重投票を防止
- **柔軟な選択肢 & 上限設定**: 選択肢は最大20個まで設定可能。投票者は「1つのみ投票」または「最大N個まで投票」を選択可能
- **誰でも投票フォーム作成可能**: Googleログインユーザーなら誰でも新しい投票を作成し、その投票の管理者になれます
- **結果の公開/非公開制御**: デフォルトでは結果は「管理者のみ」閲覧可能。管理者がいつでも「全員に公開」へ切り替え可能
- **リアルタイム集計**: Firestore のリアルタイム同期により、投票状況がグラフとランキングに即時反映
- **GitHub Pages 完全対応**: 静的SPAとしてビルド可能。QRコード共有・SNSシェア対応

---

## 🚀 クイックスタート (ローカル開発)

### 1. 依存関係のインストール
```bash
npm install
```

### 2. 環境変数の設定 (Firebase)
`.env.example` をコピーして `.env.local` を作成し、Firebase プロジェクトの認証情報を入力します。
```bash
cp .env.example .env.local
```

> **Note**: Firebase設定を行わない場合でも、ブラウザのローカルストレージを使用した「デモモード」で全機能をローカルで試用できます。また、画面ヘッダーの「Firebase」設定ボタンから画面上で直接Firebase設定を入力・保存することも可能です。

### 3. 開発サーバーの起動
```bash
npm run dev
```

### 4. テストの実行
```bash
npm run test
```

### 5. プロダクションビルド
```bash
npm run build
```

---

## 🔥 Firebase のセットアップ手順

### 1. Firebase プロジェクトの作成
1. [Firebase Console](https://console.firebase.google.com/) にアクセスし、「プロジェクトを追加」をクリックします。
2. プロジェクト名を入力して作成します (Google Analytics は任意)。

### 2. Authentication (Google認証) の有効化
1. 左メニューの「Authentication」を開き、「使ってみる」をクリックします。
2. 「ログイン方法 (Sign-in method)」タブで「Google」を選択し、「有効にする」をオンにします。
3. プロジェクトのサポートメールを選択して保存します。
4. 「承認済みドメイン (Authorized domains)」に、GitHub Pagesのドメイン（例: `<username>.github.io`）やローカル環境 (`localhost`) を追加します。

### 3. Cloud Firestore データベースの作成
1. 左メニューの「Firestore Database」を開き、「データベースの作成」をクリックします。
2. ロケーション（例: `asia-northeast1` (東京)）を選択します。

### 4. Firestore セキュリティルールの適用
Firebase コンソールの「Firestore Database」->「ルール」タブに、本リポジトリの `firestore.rules` の内容をコピーして公開します。

### 5. Firestore 複合インデックスの作成
「自分が作成した投票一覧」を作成日時順に取得するため、Firestore の複合インデックス（Composite Index）が必要です。

**方法 A: Firebase コンソールから作成（推奨・簡単）**
1. Firebase コンソールの「Firestore Database」->「インデックス」タブを開き、「インデックスを追加」をクリックします。
2. 以下を設定して「インデックスを作成」をクリックします：
   - **コレクション ID**: `polls`
   - **インデックスを作成するフィールド**:
     1. フィールド: `creatorUid` / クエリ スコープ: `コレクション` / 順序: `昇順`
     2. フィールド: `createdAt` / クエリ スコープ: `コレクション` / 順序: `降順`
3. 数分でビルドが完了します。

> **Tip**: アプリ実行時にインデックス未作成の場合、ブラウザの開発者コンソールにインデックス作成用の直接リンクが出力されます。そのリンクをクリックして「インデックスを作成」を押すだけでも作成可能です。

**方法 B: Firebase CLI を使用する場合**
本リポジトリに含まれる `firestore.indexes.json` を使用してコマンドからデプロイできます：
```bash
firebase deploy --only firestore:indexes
```

### 6. Webアプリの登録 & APIキーの取得
1. プロジェクトの概要 (歯車アイコン) ->「プロジェクトの設定」を開きます。
2. 「マイアプリ」の Web アイコン `</>` をクリックしてアプリを登録します。
3. 表示された `firebaseConfig` の各値を `.env.local` または GitHub Secrets に設定します。

---

## 🌐 GitHub Pages へのデプロイ手順

本リポジトリには `.github/workflows/deploy.yml` が含まれており、GitHub にプッシュするだけで自動デプロイされます。

### 手順:
1. **Firebase 認証情報 (Secrets) の設定**:
   - GitHub リポジトリの「**Settings**」->「**Secrets and variables**」->「**Actions**」を開きます。
   - 「**Secrets**」タブの「New repository secret」をクリックし、以下の Repository Secrets を登録します:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`
2. **Google Analytics タグID (Variables) の設定 (任意)**:
   - 同じ「Actions」設定画面内の「**Variables**」タブに切り替えます。
   - 「New repository variable」をクリックし、以下を登録します:
     - Name: `VITE_GA_MEASUREMENT_ID`
     - Value: `G-XXXXXXXXXX` (Google Analytics 4 の測定ID / タグID)
   - ※ 設定されている場合のみ、デプロイビルド時に Google Analytics タグが自動的に埋め込まれます（未設定時はタグが挿入されず安全です）。
3. **GitHub Pages の有効化**:
   - GitHub リポジトリの「**Settings**」->「**Pages**」を開き、「Build and deployment」の Source を **GitHub Actions** に設定します。
4. **デプロイの実行**:
   - コードを `main` ブランチにプッシュすると、自動的に GitHub Pages にデプロイされます。

---

## 📁 ディレクトリ構成

```
votica/
├── .github/workflows/deploy.yml # GitHub Pages 自動デプロイパイプライン
├── public/
│   ├── favicon.svg             # アプリアイコン
│   └── 404.html                # GitHub Pages SPA用リダイレクトフォールバック
├── src/
│   ├── components/
│   │   ├── common/             # Button, Modal, FirebaseConfigModal
│   │   ├── layout/             # Header, Footer
│   │   ├── poll/               # OptionInputList, VoteOptionCard, CountdownTimer, ShareModal, RunoffWizardModal, PollCard
│   │   └── results/            # ResultBarChart, WinnerBadge, RoundSelector
│   ├── contexts/               # AuthContext, ToastContext
│   ├── lib/
│   │   ├── firebase.ts         # Firebase初期化 & 設定管理
│   │   ├── firestoreService.ts # Firestore CRUD & リアルタイム購読
│   │   ├── runoffUtils.ts      # 決選投票・同率1位検出・ランキング計算ロジック
│   │   └── types.ts            # TypeScript 型定義
│   ├── pages/
│   │   ├── HomePage.tsx        # トップページ (一覧・参加)
│   │   ├── CreatePollPage.tsx  # 投票作成ページ
│   │   ├── PollVotingPage.tsx  # 投票ページ
│   │   ├── PollResultsPage.tsx # 結果・管理ページ
│   │   └── NotFoundPage.tsx    # 404ページ
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── firestore.rules             # Cloud Firestore セキュリティルール
├── firestore.indexes.json      # Cloud Firestore 複合インデックス定義
├── .env.example                # 環境変数テンプレート
└── package.json
```

---

## 📄 ライセンス

MIT License
