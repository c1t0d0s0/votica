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

    Admin->>UI: Fills Title, Description, Dates, Options (2–20), Rules
    Admin->>UI: Clicks "Create Poll" button
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
        UI->>Router: navigate('/poll/' + pollId)
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

    Voter->>UI: Opens /poll/{pollId}
    UI->>Service: subscribePoll({pollId}) & subscribeRound({pollId}, roundNum)
    Service->>DB: onSnapshot(/polls/{pollId}) & (/rounds/{roundNum})
    DB-->>UI: Real-time Poll & Round Data
    Service->>Service: recordAccessedPoll(pollId)

    Voter->>UI: Selects options (within maxChoices limit)
    alt If Guest Mode Enabled (requireAuth == false)
        Voter->>UI: Enters self-declared Nickname
    end

    Voter->>UI: Clicks "Submit Vote" / "Update Vote"
    UI->>UI: Validate choices count <= round.maxChoices & deadline is open

    UI->>Service: castVote(pollId, roundNum, votePayload)
    Service->>DB: Check round.status == 'open' && now <= round.endDate
    alt Round Expired or Closed
        DB-->>UI: Error: Voting period has ended
        UI-->>Voter: Show error toast
    else Round is Open
        Service->>DB: setDoc(/polls/{pollId}/rounds/{roundNum}/votes/{userId}, voteData)
        DB-->>Service: Write Successful
        Service-->>UI: Success
        UI->>Confetti: Trigger celebratory confetti particles
        UI-->>Voter: Show "Vote submitted successfully" toast
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

    DB->>Service: onSnapshot triggered (new / updated vote document)
    Service->>ResultsUI: Callback with Vote[] list
    ResultsUI->>Utils: calculateRoundResults(currentRoundData, votes)
    
    rect rgb(240, 245, 255)
        Note over Utils: 1. Count votes per option ID<br/>2. Compute standard competition rank (1, 1, 3...)<br/>3. Calculate voter % (votes / totalVoters)<br/>4. Detect 1st place tie (tiedFirstOptions) or single winner
    end

    Utils-->>ResultsUI: Return RoundResultSummary
    ResultsUI->>ResultsUI: Re-render ResultBarChart & WinnerBadge
    Note over ResultsUI: Charts & animations update live without page reload
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

    Note over ResultsUI: Deadline passes or Admin closes round early with a tie detected
    ResultsUI-->>Admin: Banner: "Tie for 1st Place Detected! Start Runoff Round"
    Admin->>ResultsUI: Clicks "Start Runoff Round"
    ResultsUI->>Modal: Open RunoffWizardModal(summary, nextRound=2)
    
    Admin->>Modal: Choose candidate extraction mode ('tie_breaker' | 'top_k' | 'manual')
    Modal->>Utils: filterCandidatesForRunoff(summary, mode)
    Utils-->>Modal: Pre-populated candidate options
    Admin->>Modal: Configures Round 2 title, duration, max choices
    Admin->>Modal: Clicks "Start Round 2 Runoff"

    Modal->>Service: createRunoffRound(pollId, round2Data, nextRoundNumber=2)
    Service->>DB: updateDoc(/rounds/1, { status: 'closed' })
    Service->>DB: setDoc(/rounds/2, round2Data)
    Service->>DB: updateDoc(/polls/{pollId}, { currentRound: 2, totalRounds: 2 })
    Service-->>Modal: Success (nextRoundNumber=2)
    Modal-->>ResultsUI: Close modal & switch active view to Round 2

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

    %% 1. Results Visibility Toggle
    rect rgb(245, 255, 245)
        Note over Admin,Public: 1. Toggle Results Visibility (Public vs Admin Only)
        Admin->>UI: Clicks "Results: Private" -> Toggle to Public
        UI->>Service: updatePollVisibility(pollId, isPublicResult=true)
        Service->>DB: updateDoc(/polls/{pollId}, { isPublicResult: true })
        DB-->>Public: onSnapshot broadcast isPublicResult: true
        Public->>Public: Access /poll/{pollId}/results permitted; charts rendered
    end

    %% 2. Voter Names Visibility Toggle
    rect rgb(255, 250, 240)
        Note over Admin,Public: 2. Toggle Voter Name Breakdown (Named vs Anonymous)
        Admin->>UI: Clicks "Voter Breakdown: Hidden" -> Toggle to Visible
        UI->>Service: updatePollVoterNamesVisibility(pollId, showVoterNames=true)
        Service->>DB: updateDoc(/polls/{pollId}, { showVoterNames: true })
        DB-->>Public: onSnapshot broadcast showVoterNames: true
        Public->>Public: ResultBarChart displays participant names next to selected options
    end

    %% 3. Early Close / Reopen
    rect rgb(255, 245, 245)
        Note over Admin,Public: 3. Manual Round Early Close or Reopen
        Admin->>UI: Clicks "End this round early"
        UI->>Service: updateRoundStatus(pollId, roundNum, 'closed')
        Service->>DB: updateDoc(/rounds/{roundNum}, { status: 'closed' })
        DB-->>Public: onSnapshot broadcast status: 'closed'
        Public->>Public: Voting form closes immediately; results displayed
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

    Admin->>UI: Clicks "Delete Poll" icon / button
    UI->>Modal: Open DeletePollModal(pollTitle, pollId)
    Modal-->>Admin: Show confirmation warning: "This action cannot be undone."
    Admin->>Modal: Clicks "Delete Permanently"

    Modal->>Service: deletePoll(pollId, currentUser.uid)
    Service->>DB: Verify getDoc(/polls/{pollId}).creatorUid == currentUser.uid
    Service->>DB: Query and delete all docs in /rounds/{roundNumber}/votes
    Service->>DB: Query and delete all docs in /rounds/{roundNumber}
    Service->>DB: deleteDoc(/polls/{pollId})
    Service->>Service: removeAccessedPoll(pollId)
    Service-->>Modal: Success

    Modal-->>UI: Show "Poll deleted successfully" toast
    alt On VotingPage or ResultsPage
        UI->>Router: navigate('/') (Redirect to Home Dashboard)
    else On HomePage
        UI->>UI: Re-fetch user created polls & update dashboard list
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

    %% Scenario A: Stranger visits home
    rect rgb(255, 245, 245)
        Note over Stranger,Storage: Scenario A: Stranger visits Homepage without URL
        Stranger->>Home: Opens https://votica.app/
        Home->>Service: getPublicPolls()
        Service->>Storage: getAccessedPollIds() -> Returns []
        Service-->>Home: Returns []
        Home-->>Stranger: Displays empty state: "No public polls available (0)"
        Note over Stranger,Home: Stranger CANNOT view other people's unshared polls
    end

    %% Scenario B: Invited Participant accesses via URL or ID
    rect rgb(245, 255, 245)
        Note over Invited,Storage: Scenario B: Participant receives link and visits
        Invited->>Voting: Opens shared link /poll/poll_xyz
        Voting->>Storage: recordAccessedPoll('poll_xyz')
        Storage-->>Storage: Store ['poll_xyz', ...] (Max 50)
        Voting-->>Invited: Render poll voting interface

        Invited->>Home: Navigates back to Homepage (/)
        Home->>Service: getPublicPolls()
        Service->>Storage: getAccessedPollIds() -> ['poll_xyz']
        Service->>Service: Fetch poll details for 'poll_xyz'
        Service-->>Home: Returns [poll_xyz]
        Home-->>Invited: Displays 'poll_xyz' under "Public / Accessed Polls (1)"
    end
```
