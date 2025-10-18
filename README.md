# Quiz Platform Backend

A Node.js backend for a real-time, multiplayer game-based learning platform built with Express.js and MongoDB.

## 🚀 Features

- **RESTful API** for managing user-generated quizzes
- **MongoDB** database with Mongoose ODM
- **Clean Architecture** with separated routes, controllers, services, and models
- **Input Validation** using express-validator
- **Error Handling** with comprehensive middleware
- **Environment Configuration** for different deployment stages
- **Prepared for WebSocket** integration (future real-time features)

## 📋 API Endpoints

### Quiz Management
- `POST /api/quizzes` - Create a new quiz
- `GET /api/quizzes` - List all quizzes (with pagination and search)
- `GET /api/quizzes/:id` - Get quiz by ID (without answers)
- `GET /api/quizzes/:id/answers` - Get quiz with correct answers

### System
- `GET /` - API information
- `GET /api/health` - Health check
- `GET /ws` - WebSocket info (future feature)

## 🛠️ Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **express-validator** - Input validation
- **helmet** - Security middleware
- **cors** - Cross-origin resource sharing
- **morgan** - HTTP request logger
- **dotenv** - Environment variables

## 📁 Project Structure

```
├── config/
│   └── database.js          # Database configuration
├── controllers/
│   └── quizController.js    # Quiz request handlers
├── middleware/
│   ├── errorHandler.js      # Global error handling
│   ├── notFound.js          # 404 handler
│   └── validateRequest.js   # Request validation
├── models/
│   ├── Quiz.js              # Quiz model
│   └── Question.js          # Question schema
├── routes/
│   ├── index.js             # Main routes
│   └── quizRoutes.js        # Quiz routes
├── services/
│   └── quizService.js       # Business logic
├── server.js                # Main server file
├── package.json             # Dependencies
├── env.example              # Environment variables template
└── README.md                # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd multiple-choice-quizzes-BE
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   MONGODB_URI=mongodb://localhost:27017/quiz-platform
   PORT=3000
   NODE_ENV=development
   ```

4. **Start MongoDB**
   ```bash
   # Using MongoDB service
   sudo systemctl start mongod
   
   # Or using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **Start the server**
   ```bash
   # Development mode (with auto-restart)
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Verify installation**
   ```bash
   curl http://localhost:3000/api/health
   ```

## 📊 Database Models

### Quiz Model
```javascript
{
  title: String (required, max 200 chars),
  authorName: String (optional, max 100 chars),
  questions: [Question] (required, min 1),
  createdAt: Date,
  updatedAt: Date
}
```

### Question Model (Embedded)
```javascript
{
  questionText: String (required, max 500 chars),
  options: [String] (required, exactly 4),
  correctAnswerIndex: Number (required, 0-3)
}
```

## 🔧 API Usage Examples

### Create a Quiz
```bash
curl -X POST http://localhost:3000/api/quizzes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "JavaScript Basics",
    "authorName": "John Doe",
    "questions": [
      {
        "questionText": "What is JavaScript?",
        "options": [
          "A programming language",
          "A markup language",
          "A styling language",
          "A database"
        ],
        "correctAnswerIndex": 0
      }
    ]
  }'
```

### Get All Quizzes
```bash
curl http://localhost:3000/api/quizzes?page=1&limit=10&sortBy=createdAt&sortOrder=desc
```

### Get Quiz by ID
```bash
curl http://localhost:3000/api/quizzes/QUIZ_ID
```

### Search Quizzes
```bash
curl "http://localhost:3000/api/quizzes?search=javascript&page=1&limit=5"
```

## 🛡️ Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error message",
      "value": "invalidValue"
    }
  ]
}
```

## 🔮 Future Features

- **WebSocket Integration** for real-time multiplayer sessions
- **User Authentication** and authorization
- **Room Management** for quiz sessions
- **Real-time Scoring** and leaderboards
- **Quiz Analytics** and statistics
- **File Upload** for quiz images
- **Quiz Categories** and tags
- **Rate Limiting** and API throttling

## 🧪 Development

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-restart
- `npm test` - Run tests (to be implemented)

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/quiz-platform` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |

## 📝 License

This project is licensed under the ISC License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support and questions, please open an issue in the repository.
