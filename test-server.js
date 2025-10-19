/**
 * Simple test script to verify server functionality
 * Run this after starting the server to test basic endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testServer() {
  console.log('🧪 Testing Quiz Server...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Health check passed:', healthResponse.data.message);

    // Test 2: User signup
    console.log('\n2. Testing user signup...');
    const signupData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'TestPass123'
    };
    
    let authToken;
    try {
      const signupResponse = await axios.post(`${BASE_URL}/api/auth/signup`, signupData);
      console.log('✅ User signup successful:', signupResponse.data.data.user.name);
      authToken = signupResponse.data.data.token;
    } catch (error) {
      if (error.response?.status === 400 && error.response.data.message.includes('already exists')) {
        console.log('ℹ️  User already exists, testing login instead...');
        
        // Test login instead
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
          email: signupData.email,
          password: signupData.password
        });
        console.log('✅ User login successful:', loginResponse.data.data.user.name);
        authToken = loginResponse.data.data.token;
      } else {
        throw error;
      }
    }

    // Test 3: Create quiz
    console.log('\n3. Testing quiz creation...');
    const quizData = {
      title: 'Test Quiz',
      authorName: 'Test Author',
      questions: [
        {
          questionText: 'What is 2 + 2?',
          options: ['3', '4', '5', '6'],
          correctAnswerIndex: 1
        },
        {
          questionText: 'What is the capital of France?',
          options: ['London', 'Berlin', 'Paris', 'Madrid'],
          correctAnswerIndex: 2
        }
      ]
    };

    const quizResponse = await axios.post(`${BASE_URL}/api/quizzes`, quizData, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    console.log('✅ Quiz created successfully:', quizResponse.data.data.quiz.title);
    const quizId = quizResponse.data.data.quiz.id;

    // Test 4: Get quiz
    console.log('\n4. Testing quiz retrieval...');
    const getQuizResponse = await axios.get(`${BASE_URL}/api/quizzes/${quizId}`);
    console.log('✅ Quiz retrieved successfully:', getQuizResponse.data.data.quiz.title);

    // Test 5: Get all quizzes
    console.log('\n5. Testing quiz listing...');
    const listQuizzesResponse = await axios.get(`${BASE_URL}/api/quizzes`);
    console.log('✅ Quiz listing successful:', listQuizzesResponse.data.data.quizzes.length, 'quizzes found');

    // Test 6: WebSocket endpoint info
    console.log('\n6. Testing WebSocket endpoint...');
    const wsResponse = await axios.get(`${BASE_URL}/ws`);
    console.log('✅ WebSocket endpoint active:', wsResponse.data.message);

    console.log('\n🎉 All tests passed! Server is working correctly.');
    console.log('\n📋 Next steps:');
    console.log('   - Test Socket.io events using a client (see API_DOCUMENTATION.md)');
    console.log('   - Create a frontend application to interact with the server');
    console.log('   - Test real-time quiz functionality');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Check if axios is available
try {
  require.resolve('axios');
  testServer();
} catch (error) {
  console.log('📦 Installing axios for testing...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install axios', { stdio: 'inherit' });
    console.log('✅ Axios installed, running tests...');
    testServer();
  } catch (installError) {
    console.error('❌ Failed to install axios:', installError.message);
    console.log('\n💡 Manual testing instructions:');
    console.log('   1. Start the server: npm start');
    console.log('   2. Test endpoints using Postman or curl');
    console.log('   3. Test Socket.io using a client library');
  }
}
