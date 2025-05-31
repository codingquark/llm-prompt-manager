const fetch = require('node-fetch');
require('dotenv').config();

async function testAnthropicAPI() {
  console.log('Testing Anthropic API integration...');
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not found in environment variables');
    console.log('Please create a .env file with your API key:');
    console.log('ANTHROPIC_API_KEY=your_api_key_here');
    return;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: 'Hello! Please respond with "API integration successful!" if you can read this.'
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ API call failed:', response.status, errorData);
      return;
    }

    const data = await response.json();
    
    if (data.content && data.content[0] && data.content[0].text) {
      console.log('✅ API integration successful!');
      console.log('Response:', data.content[0].text);
    } else {
      console.error('❌ Unexpected response structure:', data);
    }

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testAnthropicAPI(); 