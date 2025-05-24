// Test script to check PDF service setup
console.log('=== PDF Service Diagnostic ===\\n');

// Test 1: Check if dependencies are available
try {
  const puppeteer = require('puppeteer');
  console.log('✅ Puppeteer loaded successfully');
} catch (error) {
  console.log('❌ Puppeteer failed to load:', error.message);
}

try {
  const handlebars = require('handlebars');
  console.log('✅ Handlebars loaded successfully');
} catch (error) {
  console.log('❌ Handlebars failed to load:', error.message);
}

// Test 2: Check if PDF service can be instantiated
try {
  const pdfService = require('./src/services/pdfService');
  console.log('✅ PDF Service loaded successfully');
} catch (error) {
  console.log('❌ PDF Service failed to load:', error.message);
  console.log('Error details:', error.stack);
}

// Test 3: Check if PDF controller can be instantiated  
try {
  const pdfController = require('./src/controllers/pdfController');
  console.log('✅ PDF Controller loaded successfully');
} catch (error) {
  console.log('❌ PDF Controller failed to load:', error.message);
  console.log('Error details:', error.stack);
}

// Test 4: Check if templates directory exists
const fs = require('fs');
const path = require('path');

const templatesPath = path.join(__dirname, 'src', 'templates');
if (fs.existsSync(templatesPath)) {
  console.log('✅ Templates directory exists');
  
  const files = fs.readdirSync(templatesPath);
  console.log('   Template files:', files);
  
  // Check specific templates
  if (files.includes('conversation.hbs')) {
    console.log('✅ conversation.hbs template found');
  } else {
    console.log('❌ conversation.hbs template missing');
  }
  
  if (files.includes('multi-conversation.hbs')) {
    console.log('✅ multi-conversation.hbs template found');
  } else {
    console.log('❌ multi-conversation.hbs template missing');
  }
} else {
  console.log('❌ Templates directory does not exist');
}

console.log('\\n=== Diagnostic Complete ===');
console.log('If all tests pass, restart the server and try again.');
console.log('If any tests fail, those are the issues to fix first.');
