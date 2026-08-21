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
| `createdAt` | `Timestamp` / `string` | Yes | Server | ISO 8601 string or Firestore Server Timestamp. |
| `updatedAt` | `Timestamp` / `string` | Yes | Server | Timestamp of last modification. |

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
| `options` | `Array<PollOption>` | Yes | - | Array of selectable candidate options (2 to 20 items). |
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
| `votedAt` | `Timestamp` / `string` | Yes | Server | Timestamp when ballot was submitted or updated. |

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

    // Poll Document
    match /polls/{pollId} {
      // Direct access allowed if URL/ID is known
      allow read: if true;

      // Authenticated users can create polls
      allow create: if request.auth != null 
                    && request.resource.data.creatorUid == request.auth.uid;

      // Creator only can update or delete
      allow update, delete: if request.auth != null 
                            && resource.data.creatorUid == request.auth.uid;

      // Round Subcollection
      match /rounds/{roundNumber} {
        allow read: if true;
        allow write: if isPollCreator(pollId);

        // Vote Subcollection (1 vote per user ID)
        match /votes/{userId} {
          allow read: if true;

          allow create, update: if (
            // Google Authenticated: Auth UID matches Document ID & payload
            (request.auth != null && request.auth.uid == userId && request.resource.data.userId == request.auth.uid) ||
            // Anonymous Allowed: Poll configured with requireAuth == false
            (isAnonymousAllowed(pollId) && request.resource.data.userId == userId)
          );

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

### Reactive Sync via Custom Events
In offline/demo mode, database writes automatically dispatch the window event `votica_mock_update`:
```typescript
window.dispatchEvent(new Event('votica_mock_update'));
```
All active subscription hooks (`subscribePoll`, `subscribeRound`, `subscribeRoundVotes`, `subscribeUserVote`) listen to this event, enabling seamless real-time reactivity without a server.
