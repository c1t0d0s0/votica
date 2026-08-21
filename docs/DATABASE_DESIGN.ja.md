# Votica - Firestore データベース・ストレージ設計書

本ドキュメントは、決選投票対応 汎用投票プラットフォーム **Votica** のデータベース設計、スキーマ定義、セキュリティルール、インデックス設計、およびクライアント側ローカルストレージ仕様について詳細にまとめたものです。

---

## 1. 概要とデータアーキテクチャ

Votica は **Google Cloud Firestore** をバックエンドに採用したサーバーレスなドキュメント指向データモデルで設計されています。以下の基本原則に基づいています。

1. **サブコレクション階層構造**: 投票イベント本体の下にラウンド、さらにその下に各投票データが階層配置されます（`/polls/{pollId}/rounds/{roundNumber}/votes/{userId}`）。
2. **1人1票の冪等性保証**: 投票者の識別子（`userId` / `auth.uid`）をドキュメントIDとして使用することで、DBレベルで厳格な1人1票と投票の更新をアトミックに保証します。
3. **マルチラウンド・決選投票管理**: 単一の投票ドキュメント配下で複数ラウンド（第1回投票 -> 第2回決選投票...）の進行状態を一元管理します。
4. **デュアル環境対応**: Firebase未設定時やオフライン時でも、ブラウザの `localStorage` とイベント駆動型リアクティブ更新によるローカルデモモードが完全互換で動作します。
5. **URL限定アクセス（非公開設計）**: 投票はデフォルトで全体リスト非公開です。共有リンク（URL）または投票IDを知っているユーザーのみがアクセス可能となります。

---

## 2. Firestore コレクション & スキーマ定義

```
firestore-root
└── polls/ {pollId}
    ├── (投票ドキュメント)
    └── rounds/ {roundNumber}
        ├── (ラウンドドキュメント)
        └── votes/ {userId}
            └── (投票ドキュメント)
```

---

### 2.1 `polls` コレクション

- **パス**: `/polls/{pollId}`
- **ドキュメントID**: 一意な英数字文字列（`poll_[random_base36]_[timestamp_base36]`）
- **説明**: 投票イベント全体の基本情報、設定、管理者権限、現在ラウンドを保持する最上位ドキュメントです。

| フィールド名 | 型 | 必須 | デフォルト値 | 説明 |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `string` | ◯ | 自動生成 | ドキュメントIDと同一の識別子。 |
| `title` | `string` | ◯ | - | 投票タイトル（1〜100文字）。 |
| `description` | `string` | - | `""` | 投票の趣旨や補足説明。 |
| `creatorUid` | `string` | ◯ | - | 作成者（管理者）の Firebase Auth UID。 |
| `creatorDisplayName`| `string` | ◯ | `"管理者"` | 管理者の表示名。 |
| `creatorEmail` | `string` | - | `undefined`| 管理者のメールアドレス（Google認証時）。 |
| `creatorPhotoURL` | `string` | - | `undefined`| 管理者のプロフィール画像URL。 |
| `status` | `string` | ◯ | `'active'` | 投票全体の状態: `'active'`（進行中） \| `'closed'`（決着終了） \| `'archived'`（アーカイブ）。 |
| `isPublicResult` | `boolean`| ◯ | `false` | `true`: 参加者全員に結果公開 / `false`: 管理者のみ閲覧（デフォルト）。 |
| `requireAuth` | `boolean`| ◯ | `true` | `true`: Google認証必須（厳格な1人1票） / `false`: ログイン不要（自己申告ニックネーム）。 |
| `showVoterNames` | `boolean`| ◯ | `false` | `true`: 記名投票（結果画面で投票者名を表示） / `false`: 匿名投票（デフォルト）。 |
| `currentRound` | `number` | ◯ | `1` | 現在進行中の最新ラウンド番号（1, 2, 3...）。 |
| `totalRounds` | `number` | ◯ | `1` | これまでに作成された総ラウンド数。 |
| `createdAt` | `Timestamp` / `string` | ◯ | サーバー時刻 | 作成日時（ISO 8601 または Server Timestamp）。 |
| `updatedAt` | `Timestamp` / `string` | ◯ | サーバー時刻 | 最終更新日時。 |

---

### 2.2 `rounds` サブコレクション

- **パス**: `/polls/{pollId}/rounds/{roundNumber}`
- **ドキュメントID**: ラウンド番号の文字列（例: `'1'`, `'2'`, `'3'`）
- **説明**: 特定の投票ラウンド（第1回、決選投票など）における選択肢一覧、受付期間、選択上限数を保持します。

| フィールド名 | 型 | 必須 | デフォルト値 | 説明 |
| :--- | :--- | :---: | :---: | :--- |
| `roundNumber` | `number` | ◯ | - | ラウンド番号（1, 2, ...）。 |
| `title` | `string` | ◯ | - | ラウンド名（例: "第1回 投票", "第2回 決選投票 (同率1位)"）。 |
| `description` | `string` | - | `""` | ラウンドごとの説明文。 |
| `startDate` | `string` (ISO) | ◯ | - | 投票開始日時（ISO 8601 形式）。 |
| `endDate` | `string` (ISO) | ◯ | - | 投票終了日時・締切（ISO 8601 形式）。 |
| `maxChoices` | `number` | ◯ | `1` | 1人あたりの最大選択可能数（単一選択: 1、複数選択: 2以上）。 |
| `options` | `Array<PollOption>` | ◯ | - | 候補選択肢の配列（2〜20件）。 |
| `status` | `string` | ◯ | `'open'` | ラウンド状態: `'scheduled'`（開始前） \| `'open'`（受付中） \| `'closed'`（締切済み）。 |
| `runoffSourceRound`| `number` | - | `undefined`| 決選投票の元となった前ラウンド番号。 |
| `candidateSource` | `string` | - | `'manual'` | 候補抽出元: `'manual'`（手動） \| `'tie_breaker'`（同率1位のみ） \| `'top_k'`（上位K件）。 |
| `createdAt` | `Timestamp` / `string` | ◯ | サーバー時刻 | ラウンド作成日時。 |

#### ネストオブジェクト: `PollOption`
```typescript
interface PollOption {
  id: string;          // 選択肢の一意ID (例: "opt_1", "opt_abc")
  text: string;        // 選択肢の名称・候補名
  description?: string;// 選択肢の補足説明（任意）
  color?: string;      // グラフ表示用のカラーコード (例: "#6366f1")
}
```

---

### 2.3 `votes` サブコレクション

- **Path**: `/polls/{pollId}/rounds/{roundNumber}/votes/{userId}`
- **ドキュメントID**: 投票者のユーザーID（Googleログイン時は `auth.uid`、未ログイン投票時は端末固定の `anon_[random]`）
- **説明**: 特定ラウンドに対する1ユーザー分の投票内容（投票先選択肢IDの配列）を保持します。

| フィールド名 | 型 | 必須 | デフォルト値 | 説明 |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `string` | ◯ | - | `userId` およびドキュメントIDと一致。 |
| `userId` | `string` | ◯ | - | 投票者の一意識別子。 |
| `userDisplayName` | `string` | - | `"ユーザー"` | Google表示名または自己申告のニックネーム。 |
| `userPhotoURL` | `string` | - | `undefined`| Googleプロファイル画像URL（Google認証時）。 |
| `selectedOptionIds`| `Array<string>` | ◯ | - | 投票した選択肢IDの配列（長さ <= `maxChoices`）。 |
| `votedAt` | `Timestamp` / `string` | ◯ | サーバー時刻 | 投票・更新日時。 |

---

## 3. Cloud Firestore セキュリティルール

本プロジェクトのセキュリティルール（[`firestore.rules`](../firestore.rules)）は、厳格な権限分離と整合性チェックを行います。

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ヘルパー関数
    function getPollData(pollId) {
      return get(/databases/$(database)/documents/polls/$(pollId)).data;
    }

    function isPollCreator(pollId) {
      return request.auth != null && getPollData(pollId).creatorUid == request.auth.uid;
    }

    function isAnonymousAllowed(pollId) {
      return ('requireAuth' in getPollData(pollId)) && getPollData(pollId).requireAuth == false;
    }

    // 投票ドキュメント
    match /polls/{pollId} {
      // URLやIDを知っているユーザーは閲覧可能
      allow read: if true;

      // Googleログイン済みユーザーのみ新規投票フォームを作成可能
      allow create: if request.auth != null 
                    && request.resource.data.creatorUid == request.auth.uid;

      // 作成者（管理者）本人のみ更新・削除可能
      allow update, delete: if request.auth != null 
                            && resource.data.creatorUid == request.auth.uid;

      // 各投票ラウンド
      match /rounds/{roundNumber} {
        allow read: if true;
        allow write: if isPollCreator(pollId);

        // 投票データ (1人1票: document ID = userId)
        match /votes/{userId} {
          allow read: if true;

          // 投票の書き込み (Googleログイン済み または ログイン不要設定の投票)
          allow create, update: if (
            // Google認証ユーザーの場合: UIDが一致すること
            (request.auth != null && request.auth.uid == userId && request.resource.data.userId == request.auth.uid) ||
            // ログイン不要設定（requireAuth: false）の投票の場合
            (isAnonymousAllowed(pollId) && request.resource.data.userId == userId)
          );

          // 投票の取り消し
          allow delete: if (
            (request.auth != null && request.auth.uid == userId) ||
            isAnonymousAllowed(pollId)
          );
        }
      }
    }
  }
}
```

---

## 4. インデックス設計

### 複合インデックス (Composite Indexes)
管理者が作成した投票一覧をダッシュボードに作成日時降順で表示するため（`where('creatorUid', '==', userId).orderBy('createdAt', 'desc')`）、[`firestore.indexes.json`](../firestore.indexes.json) に以下の複合インデックスが定義されています。

```json
{
  "indexes": [
    {
      "collectionGroup": "polls",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "creatorUid", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 5. クライアント側ローカルストレージ仕様（デモモード & キャッシュ）

Firebase未接続時やローカルデモ動作時、Voticaは外部サーバー不要で動作する `localStorage` 設計を採用しています。

### LocalStorage キー一覧

| キー名 | 格納型 | 説明 |
| :--- | :--- | :--- |
| `votica_mock_polls` | `Record<string, Poll>` | 投票IDをキーとする `Poll` オブジェクトのマップ。 |
| `votica_mock_rounds` | `Record<string, Record<number, PollRound>>` | `[pollId][roundNumber]` の多層マップ構造。 |
| `votica_mock_votes` | `Record<string, Record<number, Record<string, Vote>>>` | `[pollId][roundNumber][userId]` の投票マップ。 |
| `votica_accessed_poll_ids` | `string[]` | 該当ブラウザでアクセス・投票した投票ID履歴（最大50件）。 |
| `votica_firebase_config` | `FirebaseConfig` | ユーザーがUI上で設定したカスタムFirebase接続情報。 |
| `votica_lang` | `'ja'` \| `'en'` | 選択中のUI言語（日本語/英語）。 |
| `votica_anon_uid` | `string` | ログイン不要投票時に生成・永続化される端末固定UID（`anon_...`）。 |
| `votica_anon_name` | `string` | 最後に使用した自己申告ニックネーム。 |

### カスタムイベントによるリアクティブ更新
ローカルデモモード時は、書き込み処理が発生するたびに `votica_mock_update` イベントが発行されます。
```typescript
window.dispatchEvent(new Event('votica_mock_update'));
```
すべてのリアルタイム購読関数（`subscribePoll`, `subscribeRound`, `subscribeRoundVotes`, `subscribeUserVote`）が本イベントをリッスンしており、Firestoreの `onSnapshot` と同等のリアルタイム即時画面更新を実現しています。
