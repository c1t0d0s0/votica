# Votica - Sequence & Flow Diagrams

This document illustrates the sequence diagrams and architectural flowcharts for key workflows in **Votica**.

---

## 1. Poll Creation Flow

Demonstrates an authenticated administrator creating a new multi-option poll with an initial round (Round 1).

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Poll Creator (Admin)
    participant UI as CreatePollPage (React)
    participant Auth as AuthContext (Google OAuth)
    participant Service as FirestoreService
    participant DB as Cloud Firestore / LocalStorage
    participant Router as React Router

    Admin->>UI: Fill Title, Description, Dates, Options (2 to 20), Rules
    Admin->>UI: Click Create Poll button
    UI->>Auth: Verify currentUser (Google Sign-In)
    alt User Not Logged In
        Auth-->>UI: Unauthenticated
        UI-->>Admin: Show login prompt toast
    else User Logged In
        Auth-->>UI: currentUser.uid verified
        UI->>Service: createPoll(pollData, round1Data)
        Service->>DB: setDoc(/polls/{pollId}, pollData)
        Service->>DB: setDoc(/polls/{pollId}/rounds/1, round1Data)
        Service->>Service: recordAccessedPoll(pollId)
        Service-->>UI: Returns pollId
        UI->>Router: navigate to /poll/{pollId}
        Router-->>Admin: Render PollVotingPage (Round 1)
    end
```

---

## 2. Voting Flow (Ballot Casting & One-Vote Enforcement)

Illustrates a participant (Google-authenticated or Guest Nickname) submitting or updating their ballot.

```mermaid
sequenceDiagram
    autonumber
    actor Voter as Participant (Voter)
    participant UI as PollVotingPage
    participant Service as FirestoreService
    participant DB as Cloud Firestore (votes subcollection)
    participant Confetti as Canvas Confetti

    Voter->>UI: Open /poll/{pollId}
    UI->>Service: subscribePoll({pollId}) and subscribeRound({pollId}, roundNum)
    Service->>DB: onSnapshot(/polls/{pollId}) and (/rounds/{roundNum})
    DB-->>UI: Real-time Poll and Round Data
    Service->>Service: recordAccessedPoll(pollId)

    Voter->>UI: Select options (within maxChoices limit)
    alt Guest Mode Enabled (requireAuth is false)
        Voter->>UI: Enter self-declared Nickname
    end

    Voter->>UI: Click Submit Vote or Update Vote
    UI->>UI: Validate choices count and check open deadline

    UI->>Service: castVote(pollId, roundNum, votePayload)
    Service->>DB: Check round status is open and current time is before deadline
    alt Round Expired or Closed
        DB-->>UI: Error: Voting period has ended
        UI-->>Voter: Show error toast
    else Round is Open
        Service->>DB: setDoc(/polls/{pollId}/rounds/{roundNum}/votes/{userId}, voteData)
        DB-->>Service: Write Successful
        Service-->>UI: Success
        UI->>Confetti: Trigger celebratory confetti particles
        UI-->>Voter: Show Vote submitted successfully toast
    end
```

---

## 3. Real-Time Result Tallying & Live Chart Updates

Shows how real-time database listeners update vote counts, percentages, and rankings automatically as votes are cast.

```mermaid
sequenceDiagram
    autonumber
    participant DB as Firestore (/votes collection)
    participant Service as subscribeRoundVotes
    participant Utils as calculateRoundResults (runoffUtils)
    participant ResultsUI as PollResultsPage / ResultBarChart

    DB->>Service: onSnapshot triggered (new or updated vote document)
    Service->>ResultsUI: Callback with Vote list
    ResultsUI->>Utils: calculateRoundResults(currentRoundData, votes)
    
    rect rgb(240, 245, 255)
        Note over Utils: 1. Count votes per option ID<br/>2. Compute standard competition rank (1, 1, 3...)<br/>3. Calculate voter percentage (votes / totalVoters)<br/>4. Detect 1st place tie or single winner
    end

    Utils-->>ResultsUI: Return RoundResultSummary
    ResultsUI->>ResultsUI: Re-render ResultBarChart and WinnerBadge
    Note over ResultsUI: Charts and animations update live without page reload
```

---

## 4. Runoff Round Creation Flow (Tie Break & Top-K)

Illustrates the administrator initiating a Runoff Round when a tie or top-candidate runoff is needed.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Poll Creator (Admin)
    participant ResultsUI as PollResultsPage / PollVotingPage
    participant Modal as RunoffWizardModal
    participant Utils as filterCandidatesForRunoff
    participant Service as createRunoffRound
    participant DB as Cloud Firestore
    actor Voters as All Participants

    Note over ResultsUI: Deadline passes or Admin closes round early with tie detected
    ResultsUI-->>Admin: Show tie alert banner
    Admin->>ResultsUI: Click Start Runoff Round
    ResultsUI->>Modal: Open RunoffWizardModal(summary, nextRound=2)
    
    Admin->>Modal: Choose candidate extraction mode (tie_breaker, top_k, or manual)
    Modal->>Utils: filterCandidatesForRunoff(summary, mode)
    Utils-->>Modal: Pre-populated candidate options
    Admin->>Modal: Configure Round 2 title, duration, max choices
    Admin->>Modal: Click Start Round 2 Runoff

    Modal->>Service: createRunoffRound(pollId, round2Data, 2)
    Service->>DB: updateDoc(/rounds/1, { status: 'closed' })
    Service->>DB: setDoc(/rounds/2, round2Data)
    Service->>DB: updateDoc(/polls/{pollId}, { currentRound: 2, totalRounds: 2 })
    Service-->>Modal: Success (nextRoundNumber=2)
    Modal-->>ResultsUI: Close modal and switch active view to Round 2

    Note over DB,Voters: Real-time listener notifies all connected participant browsers
    DB-->>Voters: Broadcast new currentRound: 2
    Voters-->>Voters: UI prompts participants to cast their Round 2 runoff vote
```

---

## 5. Poll & Results Visibility Management Flow

Demonstrates admin configuration controls: Public/Private results toggle, Voter name breakdown toggle, and Round status override.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Poll Creator (Admin)
    participant UI as PollResultsPage (Admin Panel)
    participant Service as FirestoreService
    participant DB as Cloud Firestore
    actor Public as Non-Admin Participant

    rect rgb(245, 255, 245)
        Note over Admin,Public: 1. Toggle Results Visibility (Public vs Admin Only)
        Admin->>UI: Switch results visibility from Private to Public
        UI->>Service: updatePollVisibility(pollId, true)
        Service->>DB: updateDoc(/polls/{pollId}, { isPublicResult: true })
        DB-->>Public: onSnapshot broadcasts isPublicResult is true
        Public->>Public: Results access permitted and charts rendered
    end

    rect rgb(255, 250, 240)
        Note over Admin,Public: 2. Toggle Voter Name Breakdown (Named vs Anonymous)
        Admin->>UI: Switch voter breakdown from Hidden to Visible
        UI->>Service: updatePollVoterNamesVisibility(pollId, true)
        Service->>DB: updateDoc(/polls/{pollId}, { showVoterNames: true })
        DB-->>Public: onSnapshot broadcasts showVoterNames is true
        Public->>Public: ResultBarChart displays participant names
    end

    rect rgb(255, 245, 245)
        Note over Admin,Public: 3. Manual Round Early Close or Reopen
        Admin->>UI: Click end round early
        UI->>Service: updateRoundStatus(pollId, roundNum, 'closed')
        Service->>DB: updateDoc(/rounds/{roundNum}, { status: 'closed' })
        DB-->>Public: onSnapshot broadcasts status is closed
        Public->>Public: Voting form closes immediately and results displayed
    end
```

---

## 6. Poll Deletion Flow

Shows the creator deleting their poll, including subcollections, and clearing local access caches.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Poll Creator (Admin)
    participant UI as PollCard / VotingPage / ResultsPage
    participant Modal as DeletePollModal
    participant Service as deletePoll
    participant DB as Cloud Firestore
    participant Router as React Router

    Admin->>UI: Click Delete Poll button
    UI->>Modal: Open DeletePollModal(pollTitle, pollId)
    Modal-->>Admin: Show confirmation warning (Action cannot be undone)
    Admin->>Modal: Click Delete Permanently

    Modal->>Service: deletePoll(pollId, currentUser.uid)
    Service->>DB: Verify getDoc(/polls/{pollId}).creatorUid matches currentUser.uid
    Service->>DB: Delete all documents in /rounds/{roundNumber}/votes
    Service->>DB: Delete all documents in /rounds/{roundNumber}
    Service->>DB: deleteDoc(/polls/{pollId})
    Service->>Service: removeAccessedPoll(pollId)
    Service-->>Modal: Success

    Modal-->>UI: Show poll deleted toast
    alt On VotingPage or ResultsPage
        UI->>Router: navigate to / (Redirect to Home Dashboard)
    else On HomePage
        UI->>UI: Re-fetch user created polls and update dashboard
    end
```

---

## 7. URL Discovery & Direct Access Flow

Illustrates how Votica enforces unlisted, URL-only discovery. Polls only appear in a visitor's history if they have accessed the URL or entered the ID.

```mermaid
sequenceDiagram
    autonumber
    actor Stranger as First-Time Visitor (No URL)
    actor Invited as Invited Participant (Has URL)
    participant Home as HomePage (/)
    participant Voting as PollVotingPage (/poll/{id})
    participant Storage as LocalStorage (votica_accessed_poll_ids)
    participant Service as getPublicPolls

    rect rgb(255, 245, 245)
        Note over Stranger,Storage: Scenario A: Stranger visits Homepage without URL
        Stranger->>Home: Opens https://votica.app/
        Home->>Service: getPublicPolls()
        Service->>Storage: getAccessedPollIds() returns empty array
        Service-->>Home: Returns empty array
        Home-->>Stranger: Displays empty state (No public polls available)
        Note over Stranger,Home: Stranger cannot view other users unshared polls
    end

    rect rgb(245, 255, 245)
        Note over Invited,Storage: Scenario B: Participant receives link and visits
        Invited->>Voting: Opens shared link /poll/poll_xyz
        Voting->>Storage: recordAccessedPoll('poll_xyz')
        Storage-->>Storage: Store poll_xyz in access history (Max 50)
        Voting-->>Invited: Render poll voting interface

        Invited->>Home: Navigates back to Homepage (/)
        Home->>Service: getPublicPolls()
        Service->>Storage: getAccessedPollIds() returns ['poll_xyz']
        Service->>Service: Fetch poll details for 'poll_xyz'
        Service-->>Home: Returns poll_xyz
        Home-->>Invited: Displays poll_xyz under Public / Accessed Polls
    end
```
