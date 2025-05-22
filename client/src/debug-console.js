/**
 * Debug Console Script
 * 
 * This script helps identify excessive console logging issues in the application.
 * Run this in the browser console to monitor and analyze logging patterns.
 */

(function() {
  // Count of console messages by type
  const messageCounts = {
    log: 0,
    info: 0,
    warn: 0,
    error: 0,
    debug: 0
  };
  
  // Track message content frequency
  const messageFrequency = {};
  
  // Store original console methods
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };
  
  // Truncate long messages for frequency counting
  function truncateMessage(args) {
    const message = Array.from(args).map(arg => {
      if (typeof arg === 'string') {
        return arg.length > 100 ? arg.substring(0, 100) + '...' : arg;
      }
      return typeof arg;
    }).join(' | ');
    
    return message;
  }
  
  // Override console methods
  console.log = function() {
    messageCounts.log++;
    const message = truncateMessage(arguments);
    messageFrequency[message] = (messageFrequency[message] || 0) + 1;
    originalConsole.log.apply(console, arguments);
  };
  
  console.info = function() {
    messageCounts.info++;
    const message = truncateMessage(arguments);
    messageFrequency[message] = (messageFrequency[message] || 0) + 1;
    originalConsole.info.apply(console, arguments);
  };
  
  console.warn = function() {
    messageCounts.warn++;
    const message = truncateMessage(arguments);
    messageFrequency[message] = (messageFrequency[message] || 0) + 1;
    originalConsole.warn.apply(console, arguments);
  };
  
  console.error = function() {
    messageCounts.error++;
    const message = truncateMessage(arguments);
    messageFrequency[message] = (messageFrequency[message] || 0) + 1;
    originalConsole.error.apply(console, arguments);
  };
  
  console.debug = function() {
    messageCounts.debug++;
    const message = truncateMessage(arguments);
    messageFrequency[message] = (messageFrequency[message] || 0) + 1;
    originalConsole.debug.apply(console, arguments);
  };
  
  // Function to get message statistics
  window.getConsoleStats = function() {
    originalConsole.log('Console message counts:', messageCounts);
    
    // Sort messages by frequency
    const sortedMessages = Object.entries(messageFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20); // Show top 20 most frequent messages
    
    originalConsole.log('Top 20 most frequent console messages:');
    sortedMessages.forEach(([message, count]) => {
      originalConsole.log(`${count} times: ${message}`);
    });
    
    return {
      counts: messageCounts,
      topMessages: sortedMessages
    };
  };
  
  // Function to reset statistics
  window.resetConsoleStats = function() {
    for (const key in messageCounts) {
      messageCounts[key] = 0;
    }
    
    for (const key in messageFrequency) {
      delete messageFrequency[key];
    }
    
    originalConsole.log('Console statistics reset');
  };
  
  // Function to restore original console methods
  window.restoreConsole = function() {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
    
    originalConsole.log('Original console methods restored');
  };
  
  originalConsole.log('Console debug script initialized. Use window.getConsoleStats() to view statistics.');
})();
