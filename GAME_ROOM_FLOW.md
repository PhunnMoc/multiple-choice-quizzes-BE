# Real-Time Game Room Flow

## Lifecycle Overview

### 1. **Client Connection & Room Join**
```
Client → Server: WebSocket handshake
Client → Server: join-room { roomCode, name }
Server → Client: room-joined { playerId, gameSessionId, participantCount }
Server → Others: participant-joined { name, playerId, participantCount }
```

### 2. **Game Start (Host Only)**
```
Host → Server: start-quiz { roomCode }
Server → All: quiz-started { 
  question: { 
    questionIndex, 
    questionText, 
    options, 
    startAt, 
    duration, 
    timeRemaining 
  },
  gameSessionId,
  leaderboard
}
```

### 3. **Answer Submission**
```
Client → Server: submit-answer { roomCode, answer, clientTimeTaken? }
Server → Client: answer-submitted { 
  isCorrect, 
  timeSpent, 
  serverTimeSpent, 
  currentScore, 
  playerId 
}
Server → All: leaderboard-updated { participants, rankings }
```

### 4. **Question Progression**
```
Server → All: next-question { 
  question: { startAt, duration, ... }, 
  leaderboard 
}
```

### 5. **Game Completion**
```
Server → All: quiz-completed { 
  results: { 
    gameSessionId, 
    participants, 
    finalLeaderboard 
  }
}
Server: Save results to DB
Server: Clean up room after 30s
```

## Key Features

### **Server-Authoritative Scoring**
- Server validates all timing using `questionStartTime`
- Client time is validated against server time (±5s tolerance)
- All scores calculated server-side for fairness

### **Real-Time Leaderboard**
- Updated after each answer submission
- Available via `get-leaderboard` event
- Shows current question or overall scores

### **Player Management**
- Unique 8-character player IDs
- Room capacity limit (50 participants)
- Real-time participant count updates

### **Timer Synchronization**
- Server sends `startAt` timestamp for client-side countdown
- Server validates timing for scoring
- Auto-advance after question duration

## Events Reference

### Client → Server Events
- `create-room` - Create quiz room (auth required)
- `join-room` - Join existing room
- `start-quiz` - Start quiz (host only)
- `submit-answer` - Submit answer with optional client timing
- `next-quiz` - Advance to next question (host only)
- `get-leaderboard` - Request current leaderboard

### Server → Client Events
- `room-created` - Room creation confirmation
- `room-joined` - Successful room join
- `participant-joined` - New participant notification
- `participant-left` - Participant left notification
- `quiz-started` - Quiz begins with first question
- `next-question` - New question with leaderboard
- `answer-submitted` - Answer submission result
- `leaderboard-updated` - Real-time score updates
- `leaderboard-data` - Leaderboard response
- `quiz-completed` - Final results
- `error` - Error notifications

## Data Structures

### Question Object
```javascript
{
  questionIndex: number,
  questionText: string,
  options: string[],
  startAt: number,        // Client timer start timestamp
  duration: number,       // Question duration in ms
  timeRemaining: number,  // Server-calculated remaining time
  totalQuestions: number
}
```

### Leaderboard Object
```javascript
{
  questionIndex: number | null,  // null for overall leaderboard
  participants: [{
    playerId: string,
    name: string,
    score: number,
    totalQuestions: number,
    isReady: boolean
  }],
  totalParticipants: number,
  timestamp: Date
}
```

### Answer Object
```javascript
{
  questionIndex: number,
  answer: number,
  isCorrect: boolean,
  timeSpent: number,        // Used for scoring (client or server)
  serverTimeSpent: number,  // Server-authoritative timing
  submittedAt: Date
}
```

## Security & Validation

- **Room Capacity**: Maximum 50 participants per room
- **Answer Validation**: Server validates all submitted answers
- **Timing Validation**: Client time must be within 5 seconds of server time
- **Authentication**: Required for room creation and quiz management
- **Input Sanitization**: All inputs validated and sanitized

## Performance Considerations

- **In-Memory Storage**: Rooms stored in memory for fast access
- **Auto-Cleanup**: Rooms deleted after 30 seconds of completion
- **Efficient Broadcasting**: Only necessary data sent to relevant clients
- **Timer Management**: Server-side timers for question progression
