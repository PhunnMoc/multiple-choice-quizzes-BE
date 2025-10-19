# Real-Time Multiple Choice Quiz Server

A comprehensive Node.js server built with Express, Socket.io, and MongoDB for real-time multiplayer quiz sessions.

## Features

- **User Authentication**: JWT-based authentication with signup/login
- **Quiz Management**: Create, read, and manage quizzes with multiple choice questions
- **Real-Time Rooms**: Create and join quiz rooms with unique codes
- **Synchronized Quizzes**: All participants see questions simultaneously
- **Timer System**: 30-second timer per question with auto-advance
- **Answer Tracking**: Store and score user responses
- **Real-Time Updates**: Live participant updates and results

## Technologies

- **Backend**: Node.js, Express.js
- **Real-Time**: Socket.io
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (jsonwebtoken)
- **Security**: bcryptjs for password hashing, helmet for security headers

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `env.example`:
   ```bash
   cp env.example .env
   ```

4. Update the `.env` file with your configuration:
   ```env
   MONGODB_URI=mongodb://localhost:27017/quiz-platform
   PORT=3000
   NODE_ENV=development
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRE=7d
   ```

5. Start MongoDB (make sure it's running on your system)

6. Start the server:
   ```bash
   npm start
   # or for development
   npm run dev
   ```

## API Endpoints

### Authentication

#### POST `/api/auth/signup`
Register a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt_token_here"
  }
}
```

#### POST `/api/auth/login`
Authenticate user and get JWT token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt_token_here"
  }
}
```

#### GET `/api/auth/me`
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

### Quiz Management

#### POST `/api/quizzes`
Create a new quiz (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "title": "JavaScript Fundamentals",
  "authorName": "John Doe",
  "questions": [
    {
      "questionText": "What is the result of 2 + 2?",
      "options": ["3", "4", "5", "6"],
      "correctAnswerIndex": 1
    },
    {
      "questionText": "Which keyword is used to declare variables in JavaScript?",
      "options": ["var", "let", "const", "all of the above"],
      "correctAnswerIndex": 3
    }
  ]
}
```

#### GET `/api/quizzes`
Get all quizzes with optional pagination and search.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `sortBy` (optional): Sort field (title, authorName, createdAt, updatedAt)
- `sortOrder` (optional): Sort order (asc, desc)
- `search` (optional): Search term

#### GET `/api/quizzes/:id`
Get a specific quiz by ID (without answers).

#### GET `/api/quizzes/:id/answers`
Get a specific quiz by ID with correct answers.

## Socket.io Events

### Client to Server Events

#### `create-room`
Create a new quiz room (requires authentication).

**Data:**
```json
{
  "quizId": "quiz_id_here"
}
```

**Response:**
```json
{
  "roomCode": "ABC123",
  "message": "Room created successfully"
}
```

#### `join-room`
Join an existing room.

**Data:**
```json
{
  "roomCode": "ABC123",
  "name": "Participant Name"
}
```

**Response:**
```json
{
  "roomCode": "ABC123",
  "message": "Successfully joined room",
  "quizTitle": "JavaScript Fundamentals",
  "participantCount": 3
}
```

#### `start-quiz`
Start the quiz (host only, requires authentication).

**Data:**
```json
{
  "roomCode": "ABC123"
}
```

**Broadcast to all participants:**
```json
{
  "question": {
    "questionIndex": 0,
    "questionText": "What is the result of 2 + 2?",
    "options": ["3", "4", "5", "6"],
    "timeRemaining": 30000
  },
  "participantCount": 3
}
```

#### `submit-answer`
Submit an answer for the current question.

**Data:**
```json
{
  "roomCode": "ABC123",
  "answer": 1
}
```

**Response:**
```json
{
  "isCorrect": true,
  "timeSpent": 15000,
  "currentScore": 1
}
```

#### `next-quiz`
Advance to the next question (host only, requires authentication).

**Data:**
```json
{
  "roomCode": "ABC123"
}
```

### Server to Client Events

#### `room-created`
Emitted when a room is successfully created.

#### `room-joined`
Emitted when successfully joining a room.

#### `participant-joined`
Emitted to other participants when someone joins.

#### `participant-left`
Emitted to other participants when someone leaves.

#### `quiz-started`
Emitted to all participants when the quiz starts.

#### `next-question`
Emitted to all participants when advancing to the next question.

#### `answer-submitted`
Emitted to the participant who submitted an answer.

#### `quiz-completed`
Emitted to all participants when the quiz ends.

**Data:**
```json
{
  "results": {
    "quizTitle": "JavaScript Fundamentals",
    "totalQuestions": 2,
    "participants": [
      {
        "name": "John Doe",
        "score": 2,
        "totalQuestions": 2,
        "answers": [...]
      }
    ],
    "completedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Quiz completed!"
}
```

#### `error`
Emitted when an error occurs.

**Data:**
```json
{
  "message": "Error description"
}
```

## Client Implementation Example

### JavaScript/Node.js Client

```javascript
const io = require('socket.io-client');

// Connect to server
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your_jwt_token_here' // Optional, for authenticated operations
  }
});

// Create a room
socket.emit('create-room', { quizId: 'quiz_id_here' });

// Join a room
socket.emit('join-room', { roomCode: 'ABC123', name: 'John Doe' });

// Start quiz (host only)
socket.emit('start-quiz', { roomCode: 'ABC123' });

// Submit answer
socket.emit('submit-answer', { roomCode: 'ABC123', answer: 1 });

// Listen for events
socket.on('room-created', (data) => {
  console.log('Room created:', data.roomCode);
});

socket.on('quiz-started', (data) => {
  console.log('Quiz started:', data.question);
});

socket.on('next-question', (data) => {
  console.log('Next question:', data.question);
});

socket.on('quiz-completed', (data) => {
  console.log('Quiz completed:', data.results);
});

socket.on('error', (error) => {
  console.error('Error:', error.message);
});
```

### HTML/JavaScript Client

```html
<!DOCTYPE html>
<html>
<head>
    <title>Quiz Client</title>
    <script src="/socket.io/socket.io.js"></script>
</head>
<body>
    <script>
        const socket = io('http://localhost:3000');
        
        // Your client implementation here
        socket.emit('join-room', { roomCode: 'ABC123', name: 'John Doe' });
        
        socket.on('quiz-started', (data) => {
            // Display question
            document.getElementById('question').textContent = data.question.questionText;
            // Display options
            data.question.options.forEach((option, index) => {
                const button = document.createElement('button');
                button.textContent = option;
                button.onclick = () => {
                    socket.emit('submit-answer', { roomCode: 'ABC123', answer: index });
                };
                document.getElementById('options').appendChild(button);
            });
        });
    </script>
</body>
</html>
```

## Database Models

### User
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  createdAt: Date,
  updatedAt: Date
}
```

### Quiz
```javascript
{
  title: String,
  creator: ObjectId (ref: User),
  authorName: String,
  questions: [{
    questionText: String,
    options: [String] (exactly 4),
    correctAnswerIndex: Number (0-3)
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### Answer
```javascript
{
  userId: ObjectId (ref: User),
  quizId: ObjectId (ref: Quiz),
  roomCode: String,
  responses: [{
    questionIndex: Number,
    answer: Number (0-3),
    isCorrect: Boolean,
    timeSpent: Number
  }],
  totalScore: Number,
  totalQuestions: Number,
  completedAt: Date,
  createdAt: Date
}
```

## Room Management

- Rooms are stored in-memory using a Map structure
- Each room has a unique 6-character code
- Rooms are automatically cleaned up when empty
- Timer system automatically advances questions after 30 seconds
- All participants see questions simultaneously
- Real-time score tracking and results

## Error Handling

The server includes comprehensive error handling for:
- Invalid authentication tokens
- Room not found errors
- Quiz not found errors
- Validation errors
- Database connection issues
- Socket.io connection errors

## Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- CORS configuration
- Helmet security headers
- Input validation with express-validator
- Rate limiting (can be added)

## Testing

You can test the API endpoints using tools like Postman or curl:

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"SecurePass123"}'

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"SecurePass123"}'
```

For Socket.io testing, you can use the Socket.io client library or create a simple HTML page with the Socket.io client script.

## Production Considerations

1. **Environment Variables**: Set proper JWT secrets and database URIs
2. **Password Hashing**: Already implemented with bcryptjs
3. **Rate Limiting**: Consider adding rate limiting middleware
4. **Logging**: Implement proper logging for production
5. **Monitoring**: Add health checks and monitoring
6. **Scaling**: Consider Redis for room management in multi-instance deployments
7. **SSL/TLS**: Use HTTPS in production
8. **Database**: Use MongoDB Atlas or a managed MongoDB service

## License

This project is licensed under the ISC License.
