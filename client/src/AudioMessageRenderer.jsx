import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Component to render audio messages with transcription.
 * This component is used in ConversationView when displaying audio content.
 */
export default function AudioMessageRenderer({ message, getMediaPath }) {
  const folder = window.currentConversationFolder;
  
  console.log('AudioMessageRenderer: Started rendering message with folder:', folder);

  if (!message || !message.content) {
    console.log('AudioMessageRenderer: Message or content is null');
    return null;
  }
  
  // Extract audio transcription and audio files
  const { transcription, audioFiles } = extractAudioContent(message);
  
  console.log('AudioMessageRenderer: Processed message', {
    hasTranscription: !!transcription,
    transcriptionLength: transcription ? transcription.length : 0,
    audioFilesCount: audioFiles.length,
    audioFiles: audioFiles
  });
  
  return (
    <Box>
      {/* Display transcription */}
      {transcription && (
        <Typography variant="body1" sx={{ mb: 2 }}>
          {transcription}
        </Typography>
      )}
      
      {/* Display audio players for all audio files */}
      {audioFiles.length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {audioFiles.map((audio, index) => (
            <Box 
              key={index} 
              sx={{ 
                p: 2,
                textAlign: 'center',
                bgcolor: '#f0f7ff', 
                borderRadius: 1, 
                minWidth: 250,
                maxWidth: '100%',
              }}
            >
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Audio Message
              </Typography>
              <audio 
                controls 
                src={getMediaPath(audio.filename)} 
                style={{ width: '100%' }} 
                onError={(e) => {
                  console.log('Audio error, trying direct path:', audio.filename);
                  // Try a fallback if the audio fails to load
                  e.target.src = `/api/media/${folder}/${audio.filename}`;
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {audio.duration > 0 ? `${audio.duration.toFixed(1)}s` : ''}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * Extract audio content (transcriptions and audio files) from a message
 */
function extractAudioContent(message) {
  if (!message || !message.content) {
    console.log('extractAudioContent: Message or content is null');
    return { transcription: '', audioFiles: [] };
  }
  
  const content = message.content;
  const audioFiles = [];
  let transcription = '';
  
  console.log('extractAudioContent: Processing message', {
    messageId: message.id,
    contentType: content.content_type,
    hasParts: Array.isArray(content.parts),
    partsCount: Array.isArray(content.parts) ? content.parts.length : 0
  });
  
  // Handle different content types
  if (content.content_type === 'multimodal_text' && Array.isArray(content.parts)) {
    // Process each part of the multimodal content
    content.parts.forEach((part, index) => {
      console.log(`extractAudioContent: Processing part ${index}`, {
        contentType: part ? part.content_type : 'null',
        hasText: part && part.text ? 'yes' : 'no',
        hasAssetPointer: part && part.asset_pointer ? 'yes' : 'no',
        hasAudioAssetPointer: part && part.audio_asset_pointer ? 'yes' : 'no'
      });
      
      // Extract transcriptions
      if (part && part.content_type === 'audio_transcription' && part.text) {
        console.log(`extractAudioContent: Found transcription in part ${index}:`, part.text);
        transcription += part.text + '\n\n';
      }
      
      // Extract audio asset pointers
      if (part && 
         ((part.content_type === 'audio_asset_pointer' && part.asset_pointer) || 
          (part.audio_asset_pointer && part.audio_asset_pointer.asset_pointer))) {
        
        const assetPointer = part.asset_pointer || 
          (part.audio_asset_pointer && part.audio_asset_pointer.asset_pointer);
          
        console.log(`extractAudioContent: Found audio asset in part ${index}:`, assetPointer);
          
        if (assetPointer) {
          const fileMatch = assetPointer.match(/([^/\\]+)$/); // Get last part of path/URL
          
          if (fileMatch) {
            const fileId = fileMatch[1];
            console.log(`extractAudioContent: Extracted file ID: ${fileId}`);
            
            // Add to audio files if not already present
            if (!audioFiles.some(file => file.filename === fileId)) {
              const duration = part.metadata?.end || 
                (part.audio_asset_pointer && part.audio_asset_pointer.metadata?.end) || 0;
              
              audioFiles.push({
                filename: fileId,
                duration
              });
              
              console.log(`extractAudioContent: Added audio file ${fileId} with duration ${duration}s`);
            }
          }
        }
      }
    });
  }
  
  console.log('extractAudioContent: Final result', {
    transcriptionLength: transcription.length,
    audioFilesCount: audioFiles.length,
    audioFiles
  });
  
  return {
    transcription: transcription.trim(),
    audioFiles
  };
}