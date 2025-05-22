/**
 * Audio Support Verification Script
 * 
 * This script helps verify that audio messages are properly supported in the Archive Browser.
 * Run this in your browser console when viewing a conversation with audio messages.
 */

// Verify audio transcription extraction
function verifyAudioTranscription() {
  console.group('Audio Transcription Verification');
  
  // Check if there are any messages in the current conversation
  const messages = window.__CONVERSATION_DATA?.messages || [];
  if (messages.length === 0) {
    console.warn('No messages found in current conversation');
    console.groupEnd();
    return false;
  }
  
  // Look for messages with audio transcriptions
  let foundTranscriptions = 0;
  let foundAudioAssets = 0;
  
  messages.forEach((msg, idx) => {
    if (!msg.message || !msg.message.content || !msg.message.content.parts) return;
    
    const content = msg.message.content;
    if (content.content_type === 'multimodal_text' && Array.isArray(content.parts)) {
      content.parts.forEach(part => {
        if (part && typeof part === 'object') {
          // Check for audio transcription
          if (part.content_type === 'audio_transcription' && part.text) {
            console.log(`Found audio transcription in message ${idx}:`, part.text.substring(0, 100) + '...');
            foundTranscriptions++;
          }
          
          // Check for audio asset pointers
          if ((part.content_type === 'audio_asset_pointer' || 
              (part.audio_asset_pointer && part.audio_asset_pointer.asset_pointer))) {
            const assetPointer = part.asset_pointer || 
                              (part.audio_asset_pointer && part.audio_asset_pointer.asset_pointer);
            console.log(`Found audio asset pointer in message ${idx}:`, assetPointer);
            foundAudioAssets++;
          }
        }
      });
    }
  });
  
  console.log(`Found ${foundTranscriptions} audio transcriptions and ${foundAudioAssets} audio assets`);
  
  // Check for rendered audio elements in the DOM
  const audioElements = document.querySelectorAll('audio');
  console.log(`Found ${audioElements.length} audio elements in the DOM`);
  
  // Check for any errors in loading audio
  const audioErrors = Array.from(audioElements).filter(audio => audio.error);
  if (audioErrors.length > 0) {
    console.warn(`Found ${audioErrors.length} audio elements with errors`);
    audioErrors.forEach((audio, i) => {
      console.warn(`Audio ${i} error:`, audio.error);
    });
  } else {
    console.log('No errors detected in audio elements');
  }
  
  console.groupEnd();
  return foundTranscriptions > 0 || foundAudioAssets > 0 || audioElements.length > 0;
}

// Verify media handling
function verifyMediaHandling() {
  console.group('Media Handling Verification');
  
  // Check mediaFilenames state
  const componentsWithMediaFilenames = Array.from(document.querySelectorAll('*')).filter(el => 
    el._reactProps && el._reactProps.mediaFilenames);
  
  if (componentsWithMediaFilenames.length > 0) {
    console.log(`Found ${componentsWithMediaFilenames.length} components with mediaFilenames`);
  } else {
    console.warn('No components with mediaFilenames found');
  }
  
  // Check for media renderers
  const mediaRenderers = Array.from(document.querySelectorAll('div')).filter(div => 
    div.innerHTML.includes('Audio File') || 
    div.innerHTML.includes('Video File') ||
    (div.querySelector('audio') || div.querySelector('video'))
  );
  
  console.log(`Found ${mediaRenderers.length} media renderer components`);
  
  console.groupEnd();
  return mediaRenderers.length > 0;
}

// Run all verifications
function verifyAudioSupport() {
  console.group('Archive Browser Audio Support Verification');
  
  const transcriptionResult = verifyAudioTranscription();
  const mediaResult = verifyMediaHandling();
  
  const overallResult = transcriptionResult || mediaResult;
  
  console.log('Verification complete!');
  console.log(overallResult ? 
    '✅ Audio support appears to be working correctly' : 
    '❌ Audio support issues detected - see warnings above');
  
  console.groupEnd();
  return overallResult;
}

// Auto-run verification
verifyAudioSupport();

// Instructions for manual verification
console.log(`
To manually verify audio support:
1. Look for audio messages in the conversation
2. Check if audio transcriptions are displayed
3. Check if audio players are rendered correctly
4. Try playing audio to verify it works

If you encounter any issues, check the console for errors.
`);

// Expose verification functions globally for easy access
window.verifyAudioSupport = verifyAudioSupport;
window.verifyAudioTranscription = verifyAudioTranscription;
window.verifyMediaHandling = verifyMediaHandling;
