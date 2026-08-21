# Votica - シーケンス図・フロー図仕様書

本ドキュメントは、**Votica** における主要なユースケースのシーケンス図および処理フロー図をまとめた仕様書です。

---

## 1. 投票フォーム新規作成フロー

Googleログイン済みの管理者が、初期ラウンド（第1回投票）を含む新しい投票フォームを作成するシーケンスです。

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 投票作成者（管理者）
    participant UI as CreatePollPage (React)
    participant Auth as AuthContext (Google OAuth)
    participant Service as FirestoreService
    participant DB as Cloud Firestore / LocalStorage
    participant Router as React Router

    Admin->>UI: タイトル、説明、日時、選択肢（2〜20個）、ルールを入力
    Admin->>UI: 「投票フォームを作成する」をクリック
    UI->>Auth: currentUser (Googleログイン状態) を確認
    alt 未ログインの場合
        Auth-->>UI: 未認証
        UI-->>Admin: ログイン促進トーストを表示
    else ログイン済みの場合
        Auth-->>UI: currentUser.uid を取得
        UI->>Service: createPoll(pollData, round1Data)
        Service->>DB: setDoc(/polls/{pollId}, pollData)
        Service->>DB: setDoc(/polls/{pollId}/rounds/1, round1Data)
        Service->>Service: recordAccessedPoll(pollId)
        Service-->>UI: 生成された pollId を返却
        UI->>Router: navigate('/poll/' + pollId)
        Router-->>Admin: 投票画面（第1回）へ遷移して表示
    end
```

---

## 2. 投票受付・1人1票保証フロー

参加者（Google認証ユーザー、またはニックネーム投票ユーザー）が投票または再投票を行うシーケンスです。

```mermaid
sequenceDiagram
    autonumber
    actor Voter as 参加者（投票者）
    participant UI as PollVotingPage
    participant Service as FirestoreService
    participant DB as Cloud Firestore (votes subcollection)
    participant Confetti as Canvas Confetti (紙吹雪)

    Voter->>UI: /poll/{pollId} にアクセス
    UI->>Service: subscribePoll({pollId}) & subscribeRound({pollId}, roundNum)
    Service->>DB: onSnapshot(/polls/{pollId}) & (/rounds/{roundNum})
    DB-->>UI: リアルタイムな投票・ラウンド設定データを受信
    Service->>Service: recordAccessedPoll(pollId)

    Voter->>UI: 選択肢を選択（上限数 maxChoices 内）
    alt ログイン不要設定の場合 (requireAuth == false)
        Voter->>UI: 自己申告のニックネームを入力
    end

    Voter->>UI: 「投票を送信する」または「投票内容を変更して再投票」をクリック
    UI->>UI: 選択肢数 <= round.maxChoices かつ 受付期間中であることを検証

    UI->>Service: castVote(pollId, roundNum, votePayload)
    Service->>DB: round.status == 'open' かつ 現在時刻 <= round.endDate を検証
    alt 受付期間終了または締切済みの場合
        DB-->>UI: エラー: 受付期間は終了しています
        UI-->>Voter: エラートーストを表示
    else 受付中の場合
        Service->>DB: setDoc(/polls/{pollId}/rounds/{roundNum}/votes/{userId}, voteData)
        DB-->>Service: 書き込み完了
        Service-->>UI: 成功
        UI->>Confetti: お祝いの紙吹雪アニメーションを発火
        UI-->>Voter: 「投票が完了しました！」トーストを表示
    end
```

---

## 3. リアルタイム集計 & ライブチャート更新フロー

Firestore のリアルタイムリスナーにより、投票が送信された瞬間に全員の画面で得票グラフとランキングが自動再計算・更新されるシーケンスです。

```mermaid
sequenceDiagram
    autonumber
    participant DB as Firestore (/votes サブコレクション)
    participant Service as subscribeRoundVotes
    participant Utils as calculateRoundResults (runoffUtils)
    participant ResultsUI as PollResultsPage / ResultBarChart

    DB->>Service: onSnapshot 発火（投票ドキュメントの追加・更新を検知）
    Service->>ResultsUI: 最新の Vote[] 一覧をコールバックに通知
    ResultsUI->>Utils: calculateRoundResults(currentRoundData, votes)
    
    rect rgb(240, 245, 255)
        Note over Utils: 1. 選択肢ごとの得票数を集計<br/>2. 標準競技順位（1位, 1位, 3位...）を算出<br/>3. 投票者得票率（得票数 / 総投票者数）を計算<br/>4. 同率1位の有無（tiedFirstOptions）または単独勝者を判定
    end

    Utils-->>ResultsUI: RoundResultSummary を返却
    ResultsUI->>ResultsUI: ResultBarChart および WinnerBadge を再描画
    Note over ResultsUI: 画面のリロードなしで即時にグラフと順位がアニメーション更新
```

---

## 4. 決選投票ラウンド作成フロー（同率1位・上位K件）

投票期間終了時に同率1位や上位候補による決選投票ラウンド（第2回、第3回...）を開始するシーケンスです。

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 投票作成者（管理者）
    participant ResultsUI as PollResultsPage / PollVotingPage
    participant Modal as RunoffWizardModal
    participant Utils as filterCandidatesForRunoff
    participant Service as createRunoffRound
    participant DB as Cloud Firestore
    actor Voters as 全参加者のブラウザ

    Note over ResultsUI: 投票期間終了、または管理者が早期終了し同率1位を検出
    ResultsUI-->>Admin: アラートバナー: 「同率1位が検出されました！決選投票を開始してください」
    Admin->>ResultsUI: 「決選投票を開始」ボタンをクリック
    ResultsUI->>Modal: RunoffWizardModal を開く（前ラウンド集計, 次ラウンド=2）
    
    Admin->>Modal: 候補抽出方法を選択（'tie_breaker'同率1位 / 'top_k'上位K件 / 'manual'手動選択）
    Modal->>Utils: filterCandidatesForRunoff(summary, mode)
    Utils-->>Modal: 抽出された候補選択肢リスト
    Admin->>Modal: 第2回のタイトル、期間、上限選択数を設定
    Admin->>Modal: 「第2回 決選投票を開始」をクリック

    Modal->>Service: createRunoffRound(pollId, round2Data, nextRoundNumber=2)
    Service->>DB: updateDoc(/rounds/1, { status: 'closed' })  ※前ラウンドを終了
    Service->>DB: setDoc(/rounds/2, round2Data)               ※新ラウンド作成
    Service->>DB: updateDoc(/polls/{pollId}, { currentRound: 2, totalRounds: 2 })
    Service-->>Modal: 成功（nextRoundNumber=2）
    Modal-->>ResultsUI: モーダルを閉じ、第2回の表示へ切り替え

    Note over DB,Voters: リアルタイムリスナーが接続中の全参加者ブラウザに通知
    DB-->>Voters: currentRound: 2 への更新をブロードキャスト
    Voters-->>Voters: UI上で「第2回 決選投票へ移動」ボタンが表示され、決選投票へ参加
```

---

## 5. 管理者権限・結果公開設定コントロールフロー

管理画面における「結果公開/非公開切替」「投票者内訳（記名/匿名）切替」「ラウンド早期終了/再開」のシーケンスです。

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 投票作成者（管理者）
    participant UI as PollResultsPage (管理者パネル)
    participant Service as FirestoreService
    participant DB as Cloud Firestore
    actor Public as 一般参加者

    %% 1. 結果閲覧権限の切替
    rect rgb(245, 255, 245)
        Note over Admin,Public: 1. 結果公開/非公開の切替
        Admin->>UI: 「結果非公開 (管理者のみ)」をクリックして公開に切り替え
        UI->>Service: updatePollVisibility(pollId, isPublicResult=true)
        Service->>DB: updateDoc(/polls/{pollId}, { isPublicResult: true })
        DB-->>Public: onSnapshot で isPublicResult: true を受信
        Public->>Public: 結果画面（/poll/{pollId}/results）の閲覧が許可され、グラフが表示される
    end

    %% 2. 投票者内訳の表示切替
    rect rgb(255, 250, 240)
        Note over Admin,Public: 2. 投票者内訳の表示/非表示切替（記名投票 / 匿名投票）
        Admin->>UI: 「投票者内訳: 非表示」をクリックして表示中に切り替え
        UI->>Service: updatePollVoterNamesVisibility(pollId, showVoterNames=true)
        Service->>DB: updateDoc(/polls/{pollId}, { showVoterNames: true })
        DB-->>Public: onSnapshot で showVoterNames: true を受信
        Public->>Public: 各選択肢バーの下に投票者のお名前一覧が表示される
    end

    %% 3. ラウンド早期終了 / 再開
    rect rgb(255, 245, 245)
        Note over Admin,Public: 3. ラウンドの即時締切 / 受付再開
        Admin->>UI: 「このラウンドを早期終了する」をクリック
        UI->>Service: updateRoundStatus(pollId, roundNum, 'closed')
        Service->>DB: updateDoc(/rounds/{roundNum}, { status: 'closed' })
        DB-->>Public: onSnapshot で status: 'closed' を受信
        Public->>Public: 投票ボタンが無効化され、受付終了状態へ切り替わる
    end
```

---

## 6. 投票削除フロー

作成者（管理者）が不要になった投票を完全に削除し、安全に関連サブコレクションおよびローカルキャッシュを破棄するシーケンスです。

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 投票作成者（管理者）
    participant UI as PollCard / VotingPage / ResultsPage
    participant Modal as DeletePollModal
    participant Service as deletePoll
    participant DB as Cloud Firestore
    participant Router as React Router

    Admin->>UI: ゴミ箱アイコン / 「投票を削除」ボタンをクリック
    UI->>Modal: DeletePollModal(pollTitle, pollId) を開く
    Modal-->>Admin: 「この操作は取り消せません」の警告確認を表示
    Admin->>Modal: 「完全に削除する」ボタンをクリック

    Modal->>Service: deletePoll(pollId, currentUser.uid)
    Service->>DB: getDoc(/polls/{pollId}).creatorUid == currentUser.uid を検証
    Service->>DB: /rounds/{roundNumber}/votes 配下の全投票ドキュメントを削除
    Service->>DB: /rounds/{roundNumber} 配下の全ラウンドドキュメントを削除
    Service->>DB: deleteDoc(/polls/{pollId}) で本体を削除
    Service->>Service: removeAccessedPoll(pollId) でローカルアクセス履歴から除外
    Service-->>Modal: 削除完了

    Modal-->>UI: 「投票を削除しました」トーストを表示
    alt 投票画面または集計画面にいた場合
        UI->>Router: navigate('/') (トップページへリダイレクト)
    else トップページにいた場合
        UI->>UI: 自分の作成した投票一覧を再取得して画面を更新
    end
```

---

## 7. URL限定公開 & アクセス履歴制御フロー

第三者にURLを知られていない投票がトップページに漏洩しないよう、URLアクセス履歴に基づき表示を制御するシーケンスです。

```mermaid
sequenceDiagram
    autonumber
    actor Stranger as URLを知らない初回来訪者
    actor Invited as URLを共有された参加者
    participant Home as トップページ (/)
    participant Voting as 投票画面 (/poll/{id})
    participant Storage as LocalStorage (votica_accessed_poll_ids)
    participant Service as getPublicPolls

    %% パターンA: URLを知らない第三者がアクセス
    rect rgb(255, 245, 245)
        Note over Stranger,Storage: パターンA: URLを知らない第三者がトップページを開く
        Stranger->>Home: https://votica.app/ にアクセス
        Home->>Service: getPublicPolls() を呼び出し
        Service->>Storage: getAccessedPollIds() -> [] (空配列)
        Service-->>Home: [] を返却
        Home-->>Stranger: 「現在公開中の投票はありません (0)」と表示
        Note over Stranger,Home: 第三者には他人の作成した投票が一切一覧表示されずプライバシーを保護
    end

    %% パターンB: 共有リンクを受け取った参加者がアクセス
    rect rgb(245, 255, 245)
        Note over Invited,Storage: パターンB: 共有URLを受け取った参加者がアクセス
        Invited->>Voting: 共有リンク /poll/poll_xyz を開く
        Voting->>Storage: recordAccessedPoll('poll_xyz') を記録
        Storage-->>Storage: ['poll_xyz', ...] として履歴に保存
        Voting-->>Invited: 投票画面を表示

        Invited->>Home: 後からトップページ (/) に戻る
        Home->>Service: getPublicPolls() を呼び出し
        Service->>Storage: getAccessedPollIds() -> ['poll_xyz'] を取得
        Service->>Service: poll_xyz のドキュメントを取得
        Service-->>Home: [poll_xyz] を返却
        Home-->>Invited: 「公開中の投票 (1)」に poll_xyz が表示され、再訪が容易に
    end
```
