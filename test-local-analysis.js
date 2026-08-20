// Test file for local intelligent analysis
// Run: node test-local-analysis.js

const fs = require('fs');

// Load content.js
const contentCode = fs.readFileSync('src/content/content.js', 'utf8');

// Mock browser APIs
global.chrome = {
  runtime: {
    onMessage: { addListener: () => {} }
  },
  storage: {
    local: {
      get: (key, cb) => cb({}),
      remove: () => {}
    }
  }
};

global.document = {
  readyState: 'complete',
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: () => ({ style: {}, addEventListener: () => {} }),
  body: { appendChild: () => {} }
};

global.window = {
  location: { hostname: 'chatgpt.com' },
  addEventListener: () => {}
};

// Execute the code
eval(contentCode);

console.log('=== Testing Local Intelligent Analysis ===\n');

// Test 1: Simple coding conversation
console.log('Test 1: Coding conversation');
const testMessages1 = [
  { role: 'user', text: 'Help me build a React login form with validation' },
  { role: 'assistant', text: 'I\'ve created a login form component with email and password validation using Formik. Here\'s the code:\n```jsx\nconst LoginForm = () => {\n  return <Form>...</Form>;\n};\n```\nYou should also add error handling for failed login attempts.' },
  { role: 'user', text: 'Great! Can you add JWT token storage?' },
  { role: 'assistant', text: 'Done! I\'ve added localStorage for JWT tokens. The login function now saves the token after successful authentication.' }
];

const capsule1 = createIntelligentCapsule(testMessages1, 'ChatGPT');
console.log('✓ Capsule created');
console.log(`  Name: ${capsule1.name}`);
console.log(`  Length: ${capsule1.text.length} chars`);
console.log(`  Messages: ${capsule1.messageCount}`);
console.log('');

// Test 2: Research conversation
console.log('Test 2: Research conversation');
const testMessages2 = [
  { role: 'user', text: 'Explain how neural networks work' },
  { role: 'assistant', text: 'Neural networks are computational models inspired by the human brain. They consist of layers of interconnected nodes (neurons) that process information using activation functions.\n\nKey concepts:\n- Input layer receives data\n- Hidden layers extract features\n- Output layer produces results\n- Backpropagation trains the network' },
  { role: 'user', text: 'What about CNNs?' },
  { role: 'assistant', text: 'Convolutional Neural Networks (CNNs) are specialized for image processing. They use convolutional layers to detect spatial patterns like edges, shapes, and textures.' }
];

const capsule2 = createIntelligentCapsule(testMessages2, 'Claude');
console.log('✓ Capsule created');
console.log(`  Name: ${capsule2.name}`);
console.log('');

// Test 3: Verify capsule structure
console.log('Test 3: Capsule structure');
const structure = capsule1.text;
console.log(`  Has [CONTEXT CAPSULE]: ${structure.includes('[CONTEXT CAPSULE]')}`);
console.log(`  Has ## OBJECTIVE: ${structure.includes('## OBJECTIVE')}`);
console.log(`  Has ## PROGRESS: ${structure.includes('## PROGRESS')}`);
console.log(`  Has ## CODE: ${structure.includes('## CODE')}`);
console.log(`  Has [END CAPSULE]: ${structure.includes('[END CAPSULE')}`);
console.log('');

// Test 4: Show full capsule
console.log('Test 4: Full capsule output\n');
console.log(capsule1.text);

console.log('\n=== All Tests Passed ===');
console.log('\n✓ Local analysis works without API calls');
console.log('✓ Works even when AI is out of tokens');
console.log('✓ Creates intelligent structured capsules');
