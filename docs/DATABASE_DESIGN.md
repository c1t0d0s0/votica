# Votica - Firestore Database & Storage Design Specification

This document details the database architecture, schema definitions, security rules, indexes, and client-side storage mechanisms for the **Votica** voting platform.

---

## 1. Overview & Data Architecture

Votica employs a serverless, document-oriented data model powered by **Google Cloud Firestore**. The database architecture is designed with the following core principles:

1. **Subcollection Hierarchy**: Rounds and votes are organized hierarchically under parent poll documents (`/polls/{pollId}/rounds/{roundNumber}/votes/{userId}`).
2. **One-Vote-Per-User Idempotency**: Individual votes use the voter's Unique Identifier (`userId` / `auth.uid`) as the Firestore Document ID, inherently guaranteeing atomic 1-person-1-vote at the database level.
3. **Multi-Round Lifecycle**: Each poll maintains a state machine across successive rounds (Round 1 -> Round 2 Runoff -> ... -> Concluded).
4. **Dual-Environment Architecture**: Seamlessly falls back to structured `localStorage` with event-driven reactivity when running in Offline/Demo Mode.
5. **URL-Access Privacy**: Polls are unlisted by default. Third parties without the link or ID cannot browse or query unshared polls.

---

## 2. Firestore Collections & Schema Definitions

```
firestore-root
└── polls/ {pollId}
    ├── (Poll Document)
    └── rounds/ {roundNumber}
        ├── (Round Document)
        └── votes/ {userId}
            └── (Vote Document)
```

---

### 2.1 `polls` Collection

- **Path**: `/polls/{pollId}`
- **Document ID**: Unique alphanumeric string (`poll_[random_base36]_[timestamp_base36]`).
- **Description**: Top-level entity representing a voting event, its settings, ownership, and current round state.

| Field Name | Type | Required | Default | Description |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `string` | Yes | Auto | Unique identifier matching the document ID. |
| `title` | `string` | Yes | - | Title of the poll (1–100 characters). |
| `description` | `string` | No | `""` | Detailed description or context for voters. |
| `creatorUid` | `string` | Yes | - | Firebase Auth UID of the poll administrator/creator. |
| `creatorDisplayName`| `string` | Yes | `"Admin"` | Display name of the administrator. |
| `creatorEmail` | `string` | No | `undefined`| Email address of the creator (if authenticated). |
| `creatorPhotoURL` | `string` | No | `undefined`| Avatar URL of the creator (from Google OAuth). |
| `status` | `string` | Yes | `'active'` | Overall poll status: `'active'` \| `'closed'` \| `'archived'`. |
| `isPublicResult` | `boolean`| Yes | `false` | If `true`, all voters can view tally charts. If `false`, only the creator can view. |
| `requireAuth` | `boolean`| Yes | `true` | If `true`, requires Google login. If `false`, allows guest/nickname voting. |
| `showVoterNames` | `boolean`| Yes | `false` | If `true`, voter names appear beside options in results (Named Voting). If `false`, votes are anonymous. |
| `currentRound` | `number` | Yes | `1` | The currently active round number (1, 2, 3...). |
| `totalRounds` | `number` | Yes | `1` | Total number of rounds created so far. |
| `pollType` | `string` | No | `'poll'` | `'poll'` (standard) \| `'schedule'` (schedule adjustment). |
| `decision` | `ScheduleDecision \| null` | No | `undefined` | Confirmed event date for schedule polls (set / cleared by the admin only). See below. |
| `location` | `string` | No | `undefined` | Event location (schedule polls, max 200 chars). |
| `locationUrl` | `string` | No | `undefined` | Map / venue URL (`http(s)://` only, validated on save and render). |
| `fee` | `string` | No | `undefined` | Fee / budget (max 100 chars). |
| `notes` | `string` | No | `undefined` | Notes (max 1000 chars). |
| `capacity` | `number \| null` | No | `undefined` | Per-candidate attendee limit for schedule polls (number of ◯, 1–1000). Full candidates accept no new ◯ (existing ◯ are kept). Unlimited when unset. Note: Security Rules cannot aggregate votes, so the check runs on the client right before saving (all votes are fetched). Near-simultaneous submissions may slightly exceed the limit; the admin can then correct or delete responses. Admin edits are not restricted. |
| `createdAt` | `Timestamp` / `string` | Yes | Server | ISO 8601 string or Firestore Server Timestamp. |
| `updatedAt` | `Timestamp` / `string` | Yes | Server | Timestamp of last modification. |

---

#### Nested Object: `ScheduleDecision`
```typescript
interface ScheduleDecision {
  optionId: string;    // PollOption.id of the confirmed candidate
  label: string;       // Candidate text at the time of decision
  date: string;        // YYYY-MM-DD (interpreted in the viewer's local time)
  startTime?: string;  // HH:mm (omitted for all-day)
  endTime?: string;    // HH:mm (defaults to start + 2h in .ics / Google Calendar)
  allDay: boolean;
  decidedAt: string;   // ISO 8601
}
```
Responses stay open after the decision (close the round to stop accepting responses).

---

### 2.2 `rounds` Subcollection

- **Path**: `/polls/{pollId}/rounds/{roundNumber}`
- **Document ID**: String representation of the round number (e.g., `'1'`, `'2'`, `'3'`).
- **Description**: Stores configuration, candidates/options, and time limits for a specific voting round.

| Field Name | Type | Required | Default | Description |
| :--- | :--- | :---: | :---: | :--- |
| `roundNumber` | `number` | Yes | - | Numeric round index (1, 2, ...). |
| `title` | `string` | Yes | - | Title of the round (e.g., "Round 1 Voting", "Round 2 Runoff (Tied 1st)"). |
| `description` | `string` | No | `""` | Optional round-specific instructions. |
| `startDate` | `string` (ISO) | Yes | - | Voting start datetime in ISO 8601 format. |
| `endDate` | `string` (ISO) | Yes | - | Voting end/deadline datetime in ISO 8601 format. |
| `maxChoices` | `number` | Yes | `1` | Maximum number of options a voter can select (1 to N). |
| `options` | `Array<PollOption>` | Yes | - | Array of selectable candidate options (2 to 20 items). For schedule polls: up to 30, stored and displayed oldest first; admins can add more after creation (duplicates skipped, `maxChoices` follows the count). |
| `status` | `string` | Yes | `'open'` | Round status: `'scheduled'` \| `'open'` \| `'closed'`. |
| `runoffSourceRound`| `number` | No | `undefined`| The originating round number that prompted this runoff. |
| `candidateSource` | `string` | No | `'manual'` | Extraction method: `'manual'` \| `'tie_breaker'` \| `'top_k'`. |
| `createdAt` | `Timestamp` / `string` | Yes | Server | Creation timestamp. |

#### Nested Object: `PollOption`
```typescript
interface PollOption {
  id: string;          // Unique option ID (e.g., "opt_1", "opt_abc")
  text: string;        // Option title / candidate name
  description?: string;// Optional detail
  color?: string;      // Assigned hex color (e.g., "#6366f1")
  dateInfo?: {         // Schedule polls only: date/time parsed from the candidate text (omitted if unparseable)
    date: string;      // YYYY-MM-DD
    startTime?: string;// HH:mm
    endTime?: string;  // HH:mm
    allDay?: boolean;
  };
}
```

---

### 2.3 `votes` Subcollection

- **Path**: `/polls/{pollId}/rounds/{roundNumber}/votes/{userId}`
- **Document ID**: Voter's User ID (`auth.uid` for Google users, or persistent `anon_[random]` for guest voters).
- **Description**: Represents a single voter's ballot for that specific round.

| Field Name | Type | Required | Default | Description |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `string` | Yes | - | Matches `userId` and Document ID. |
| `userId` | `string` | Yes | - | Unique voter ID. |
| `userDisplayName` | `string` | No | `"User"` | Google display name or self-declared nickname. |
| `userPhotoURL` | `string` | No | `undefined`| Google profile photo URL (if logged in). |
| `selectedOptionIds`| `Array<string>` | Yes | - | Array of chosen `PollOption.id`s (length <= `maxChoices`). |
| `scheduleResponses` | `Record<string, 'circle'\|'triangle'\|'cross'>` | No | `undefined` | Per-candidate attendance for schedule polls. |
| `comment` | `string` | No | `undefined` | Short comment. |
| `isAnonymous` | `boolean` | No | `undefined` | `true`: no-login response protected by an edit key (`voteSecrets`). |
| `editedByAdmin` | `boolean` | No | `undefined` | Response was corrected by the admin. |
| `votedAt` | `Timestamp` / `string` | Yes | Server | Timestamp when ballot was submitted or updated. |

### 2.4 `voteSecrets` / `voteProofs` Subcollections (edit password for no-login responses)

- **Paths**: `/polls/{pollId}/rounds/{roundNumber}/voteSecrets/{voteId}`, `/polls/{pollId}/rounds/{roundNumber}/voteProofs/{voteId}`
- **Description**: Lets a no-login respondent edit or delete only their own response. Neither is publicly readable (admin only).

| Document | Field | Description |
| :--- | :--- | :--- |
| `voteSecrets/{voteId}` | `hash: string` | `sha256hex(proof)`. Can only be created in the same batch that creates the vote. |
| `voteProofs/{voteId}` | `proof: string` | The `proof` written in the same batch when editing or deleting. |

- `proof = sha256hex("{pollId}:{voteId}:{password}")` is computed on the client (`crypto.subtle`). Without a password, a random per-device key (localStorage `votica_anon_editkey`) is used as the password.
- The security rules check `hashing.sha256(getAfter(voteProofs).proof) == get(voteSecrets).hash` and only then allow updating, deleting, or changing the password.
- Anonymous responses saved before this feature (no `isAnonymous`, no secret) can only be edited or deleted by the admin.

---

## 3. Cloud Firestore Security Rules

The security rules ([`firestore.rules`](../firestore.rules)) enforce strict role-based access and data integrity:

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

## 4. Indexing Strategy

### Composite Indexes
To support the Creator Dashboard query (`where('creatorUid', '==', userId)` ordered by `createdAt DESC`), a composite index is defined in [`firestore.indexes.json`](../firestore.indexes.json):

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

## 5. Client-Side Storage Architecture (Local & Demo Mode)

When Firebase is not configured or during local demonstration, Votica uses an isolated, structured `localStorage` architecture with zero external dependencies.

### LocalStorage Schema Reference

| Key Name | Type | Description |
| :--- | :--- | :--- |
| `votica_mock_polls` | `Record<string, Poll>` | Map of poll ID to `Poll` object. |
| `votica_mock_rounds` | `Record<string, Record<number, PollRound>>` | Nested map: `[pollId][roundNumber] -> PollRound`. |
| `votica_mock_votes` | `Record<string, Record<number, Record<string, Vote>>>` | Nested map: `[pollId][roundNumber][userId] -> Vote`. |
| `votica_accessed_poll_ids` | `string[]` | Ordered array of poll IDs accessed by this client (max 50). |
| `votica_firebase_config` | `FirebaseConfig` | Custom Firebase connection parameters stored locally. |
| `votica_lang` | `'ja'` \| `'en'` | User's preferred interface language. |
| `votica_anon_uid` | `string` | Persistent device ID for guest voters (`anon_...`). |
| `votica_anon_name` | `string` | Last used self-declared voter nickname. |
| `votica_anon_editkey` | `string` | Random per-device edit key used for anonymous responses without a password. |
| `votica_vote_proofs` | `Record<string, string>` | Cache of verified edit-key proofs (`pollId/round/voteId` → proof, max 200). |
| `votica_mock_vote_secrets` | `Record<string, string>` | Demo-mode equivalent of `voteSecrets` (`pollId/round/voteId` → hash). |

### Reactive Sync via Custom Events
In offline/demo mode, database writes automatically dispatch the window event `votica_mock_update`:
```typescript
window.dispatchEvent(new Event('votica_mock_update'));
```
All active subscription hooks (`subscribePoll`, `subscribeRound`, `subscribeRoundVotes`, `subscribeUserVote`) listen to this event, enabling seamless real-time reactivity without a server.
