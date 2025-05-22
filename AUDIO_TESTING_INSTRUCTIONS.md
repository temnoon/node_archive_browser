# Testing Audio Support in Archive Browser

This document provides instructions for testing the audio support features we've implemented in the Archive Browser application.

## Prerequisites

1. Make sure all refactored code has been deployed:
   - All utility modules in `/client/src/utils/`
   - All component files in `/client/src/components/`
   - The refactored `ConversationView.jsx`

2. Ensure your development environment is running:
   ```bash
   # Server
   cd /Users/tem/nab/server
   npm start
   
   # Client
   cd /Users/tem/nab/client
   npm run dev
   ```

## Test Scenarios

### Test 1: Loading a Conversation with Audio Messages

1. Navigate to a conversation you know contains audio messages.
   - URL format: `http://localhost:5173/conversations/{conversation_id}`

2. Check the console for any errors.

3. Observe if the audio transcriptions are displayed in the message content.

4. Check if audio players are properly rendered for audio files.

### Test 2: Audio Player Functionality

1. Try playing an audio file by clicking the play button.

2. Verify that the audio controls (play/pause, volume, timeline) work correctly.

3. Test audio playback with different browsers (Chrome, Firefox, Safari) to ensure compatibility.

### Test 3: Media Modal for Audio Files

1. Click on an audio player to open the media modal.

2. Check if the audio file details are correctly displayed in the modal.

3. If there are multiple media files, test the navigation buttons to move between media items.

### Test 4: Tool/System Message Toggle with Audio

1. If audio files are contained in tool messages, toggle the "Hide tool & system messages" option.

2. Verify that audio files from hidden tool messages are properly transferred to the associated assistant messages.

3. Check that these transferred audio files are correctly labeled as "From Hidden Message".

### Test 5: Run Verification Script

1. Open your browser's developer console (F12 or Ctrl+Shift+I).

2. Copy and paste the content of `/Users/tem/nab/client/src/audio_verification.js` into the console.

3. Run the script and check the verification results.

4. Address any issues identified by the verification script.

## Common Issues and Solutions

### Audio Files Not Loading

- Check the network tab in DevTools to see if there are any 404 errors for audio files.
- Verify that the file paths are correct in the `getMediaPath` function.
- Check if the audio file format is supported by the browser.

### Audio Transcriptions Not Displayed

- Inspect the JSON structure of messages to confirm if they contain audio transcriptions.
- Verify that the `extractMessageContent` function is correctly parsing audio transcription content.

### Audio Players Not Rendering

- Check if the `MediaRenderer` component is being rendered with the correct props.
- Ensure the audio element has a valid source URL.

## Reporting Issues

When reporting issues, please include:

1. The conversation ID where the issue occurs
2. The specific message or audio file causing the problem
3. Any console errors or warnings
4. The browser and device you're using
5. Screenshots if applicable

## Additional Testing Resources

- Use the verification script to automate testing
- Check browser compatibility with different audio formats
- Test with different network conditions to ensure graceful handling of slow connections
