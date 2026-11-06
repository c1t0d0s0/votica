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
| `pollType` | `string` | - | `'poll'` | `'poll'`（通常投票） \| `'schedule'`（日程調整）。 |
| `decision` | `ScheduleDecision \| null` | - | `undefined` | 日程調整の開催決定情報（管理者のみ設定・取消可）。下記参照。 |
| `location` | `string` | - | `undefined` | 開催場所（日程調整、最大200文字）。 |
| `locationUrl` | `string` | - | `undefined` | 地図・お店のURL（`http(s)://` のみ。保存時と表示時に検証）。 |
| `fee` | `string` | - | `undefined` | 会費・予算（最大100文字）。 |
| `notes` | `string` | - | `undefined` | 備考（最大1000文字）。 |
| `capacity` | `number \| null` | - | `undefined` | 日程調整の各候補の参加上限（◯の人数、1〜1000）。上限に達した候補には新しく◯を付けられない（既存の◯は維持）。未設定なら無制限。※Security Rules では票を集計できないため、上限の確認は保存直前にクライアント側で全票を取得して行う。ほぼ同時に送信された場合はわずかに超える可能性があり、その場合は管理者が修正・削除で調整する。管理者による修正は上限の対象外。 |
| `createdAt` | `Timestamp` / `string` | ◯ | サーバー時刻 | 作成日時（ISO 8601 または Server Timestamp）。 |
| `updatedAt` | `Timestamp` / `string` | ◯ | サーバー時刻 | 最終更新日時。 |

---

#### ネストオブジェクト: `ScheduleDecision`
```typescript
interface ScheduleDecision {
  optionId: string;    // 決定した候補の PollOption.id
  label: string;       // 決定時点の候補テキスト
  date: string;        // YYYY-MM-DD（閲覧者のローカル時刻として解釈）
  startTime?: string;  // HH:mm（終日の場合は省略）
  endTime?: string;    // HH:mm（省略時は .ics / Google カレンダーで開始+2時間）
  allDay: boolean;
  decidedAt: string;   // ISO 8601
}
```
決定後も回答の受付は継続します（締め切る場合はラウンドを終了）。

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
| `options` | `Array<PollOption>` | ◯ | - | 候補選択肢の配列（2〜20件）。日程調整では最大30件で、古い順に並べて保存・表示し、管理者が作成後に追加できる（重複はスキップ、`maxChoices` は候補数に追従）。 |
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
  dateInfo?: {         // 日程調整のみ: 候補テキストから解析した日時（解析できない場合は省略）
    date: string;      // YYYY-MM-DD
    startTime?: string;// HH:mm
    endTime?: string;  // HH:mm
    allDay?: boolean;
  };
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
| `scheduleResponses` | `Record<string, 'circle'\|'triangle'\|'cross'>` | - | `undefined` | 日程調整の候補ごとの出欠。 |
| `comment` | `string` | - | `undefined` | 一言コメント。 |
| `isAnonymous` | `boolean` | - | `undefined` | `true`: ログインなし回答で、編集キー（`voteSecrets`）で保護されている。 |
| `editedByAdmin` | `boolean` | - | `undefined` | 管理者が修正した回答。 |
| `votedAt` | `Timestamp` / `string` | ◯ | サーバー時刻 | 投票・更新日時。 |

### 2.4 `voteSecrets` / `voteProofs` サブコレクション（匿名回答の編集パスワード）

- **パス**: `/polls/{pollId}/rounds/{roundNumber}/voteSecrets/{voteId}`、`/polls/{pollId}/rounds/{roundNumber}/voteProofs/{voteId}`
- **説明**: ログインなしで回答した人が、自分の回答だけを編集・削除できるようにするためのデータです。どちらも一般には読み取れません（管理者のみ読み取り可）。

| ドキュメント | フィールド | 説明 |
| :--- | :--- | :--- |
| `voteSecrets/{voteId}` | `hash: string` | `sha256hex(proof)`。回答の新規作成と同じ batch でのみ作成できる。 |
| `voteProofs/{voteId}` | `proof: string` | 編集・削除時に同じ batch で書き込む `proof`。 |

- `proof = sha256hex("{pollId}:{voteId}:{パスワード}")` をクライアント（`crypto.subtle`）で計算します。パスワード未設定の場合は端末ごとのランダムキー（localStorage `votica_anon_editkey`）をパスワードとして使います。
- セキュリティルールは `hashing.sha256(getAfter(voteProofs).proof) == get(voteSecrets).hash` を確認し、一致した場合のみ回答の更新・削除・パスワード変更を許可します。
- この機能より前に保存された匿名回答（`isAnonymous` なし・secret なし）は、管理者のみ編集・削除できます。

---

## 3. Cloud Firestore セキュリティルール

本プロジェクトのセキュリティルール（[`firestore.rules`](../firestore.rules)）は、厳格な権限分離と整合性チェックを行います。

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function getPollData(pollId) {
      return get(/databases/$(database)/documents/polls/$(pollId)).data;
    }

    function isPollCreator(pollId) {
      return request.auth != null && getPollData(pollId).creatorUid == request.auth.uid;
    }

    function isAnonymousAllowed(pollId) {
      return ('requireAuth' in getPollData(pollId)) && getPollData(pollId).requireAuth == false;
    }

    function votePath(pollId, roundNumber, voteId) {
      return /databases/$(database)/documents/polls/$(pollId)/rounds/$(roundNumber)/votes/$(voteId);
    }

    function voteSecretPath(pollId, roundNumber, voteId) {
      return /databases/$(database)/documents/polls/$(pollId)/rounds/$(roundNumber)/voteSecrets/$(voteId);
    }

    function voteProofPath(pollId, roundNumber, voteId) {
      return /databases/$(database)/documents/polls/$(pollId)/rounds/$(roundNumber)/voteProofs/$(voteId);
    }

    // 匿名回答の編集キー照合:
    //   voteSecrets/{voteId}.hash == sha256(proof) であり、proof は同じ batch で voteProofs/{voteId} に書かれる。
    //   get() は batch 適用前、getAfter() は適用後の状態を返す。
    function hasValidEditProof(pollId, roundNumber, voteId) {
      let secretPath = voteSecretPath(pollId, roundNumber, voteId);
      let proofPath = voteProofPath(pollId, roundNumber, voteId);
      return exists(secretPath)
        && existsAfter(proofPath)
        && hashing.sha256(getAfter(proofPath).data.proof).toHexString().lower() == get(secretPath).data.hash;
    }

    // 投票ドキュメント
    match /polls/{pollId} {
      // 誰でも閲覧可能
      allow read: if true;

      // ログインユーザーのみ新規作成可能
      allow create: if request.auth != null
                    && request.resource.data.creatorUid == request.auth.uid;

      // 作成者（管理者）のみ更新・削除可能
      allow update, delete: if request.auth != null
                            && resource.data.creatorUid == request.auth.uid;

      // 各投票ラウンド
      match /rounds/{roundNumber} {
        // 誰でも閲覧可能
        allow read: if true;

        // 作成者のみラウンド作成・状態変更可能
        allow write: if isPollCreator(pollId);

        // 投票データ (1人1票: document ID = userId)
        match /votes/{userId} {
          // 誰でも投票結果・集計の読み取りが可能
          allow read: if true;

          // 新規投票
          allow create: if request.resource.data.userId == userId && (
            // Google認証ユーザー: UIDが一致すること
            (request.auth != null && request.auth.uid == userId) ||
            // ログイン不要設定の匿名回答: 編集キー（voteSecrets）を同じ batch で作成すること
            (isAnonymousAllowed(pollId)
              && request.resource.data.isAnonymous == true
              && existsAfter(voteSecretPath(pollId, roundNumber, userId)))
          );

          // 投票の更新（userId は変更不可）
          allow update: if request.resource.data.userId == resource.data.userId && (
            (request.auth != null && request.auth.uid == userId) ||
            // 管理者は他人の回答を修正可能
            isPollCreator(pollId) ||
            // 匿名回答: 編集キーが一致する場合のみ
            (isAnonymousAllowed(pollId)
              && resource.data.isAnonymous == true
              && request.resource.data.isAnonymous == true
              && hasValidEditProof(pollId, roundNumber, userId))
          );

          // 投票の取り消し
          allow delete: if (
            (request.auth != null && request.auth.uid == userId) ||
            isPollCreator(pollId) ||
            (resource.data.isAnonymous == true && hasValidEditProof(pollId, roundNumber, userId))
          );
        }

        // 匿名回答の編集キーのハッシュ（一般には非公開）
        match /voteSecrets/{voteId} {
          // 管理者のみ読み取り可（投票削除時のクリーンアップ用）
          allow read: if isPollCreator(pollId);

          // 回答の新規作成と同じ batch でのみ作成可能（他人の回答にキーを後付けできない）
          allow create: if !exists(votePath(pollId, roundNumber, voteId))
                        && existsAfter(votePath(pollId, roundNumber, voteId))
                        && request.resource.data.keys().hasOnly(['hash'])
                        && request.resource.data.hash is string
                        && request.resource.data.hash.size() == 64;

          // パスワード変更（現在のキーが一致する場合のみ）
          allow update: if hasValidEditProof(pollId, roundNumber, voteId)
                        && request.resource.data.keys().hasOnly(['hash'])
                        && request.resource.data.hash is string
                        && request.resource.data.hash.size() == 64;

          allow delete: if isPollCreator(pollId) || hasValidEditProof(pollId, roundNumber, voteId);
        }

        // 編集時に提示する proof（一般には非公開。上書きされても照合に影響しない）
        match /voteProofs/{voteId} {
          allow read: if isPollCreator(pollId);
          allow create, update: if request.resource.data.keys().hasOnly(['proof'])
                                && request.resource.data.proof is string
                                && request.resource.data.proof.size() <= 128;
          allow delete: if isPollCreator(pollId);
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
| `votica_anon_editkey` | `string` | パスワード未設定の匿名回答で使う端末ごとのランダム編集キー。 |
| `votica_vote_proofs` | `Record<string, string>` | 照合済みの編集キー proof のキャッシュ（`pollId/round/voteId` → proof、最大200件）。 |
| `votica_mock_vote_secrets` | `Record<string, string>` | デモモード用の `voteSecrets` 相当（`pollId/round/voteId` → hash）。 |

### カスタムイベントによるリアクティブ更新
ローカルデモモード時は、書き込み処理が発生するたびに `votica_mock_update` イベントが発行されます。
```typescript
window.dispatchEvent(new Event('votica_mock_update'));
```
すべてのリアルタイム購読関数（`subscribePoll`, `subscribeRound`, `subscribeRoundVotes`, `subscribeUserVote`）が本イベントをリッスンしており、Firestoreの `onSnapshot` と同等のリアルタイム即時画面更新を実現しています。
