# Audio Support Integration Guide

This guide explains how to integrate with or extend the audio support features in the Archive Browser.

## Overview

The Archive Browser now supports audio messages with transcriptions and audio file playback. This document provides information for developers who need to:

1. Work with audio files in conversations
2. Extend the existing audio support
3. Integrate with other components

## Message Structure

Audio messages in ChatGPT conversations typically have two main components:

1. **Audio Transcription**: Text content generated from speech recognition
2. **Audio Asset Pointer**: Reference to the actual audio file

Here's an example of a typical audio message structure:

```json
{
  "content": {
    "content_type": "multimodal_text",
    "parts": [
      {
        "content_type": "audio_transcription",
        "text": "This is the transcribed text from the audio recording."
      },
      {
        "content_type": "audio_asset_pointer",
        "asset_pointer": "file-XYZ123",
        "metadata": {
          "start": 0,
          "end": 10.5
        }
      }
    ]
  }
}
```

Alternative structure:

```json
{
  "content": {
    "content_type": "multimodal_text",
    "parts": [
      {
        "content_type": "audio_transcription",
        "text": "This is the transcribed text from the audio recording."
      },
      {
        "audio_asset_pointer": {
          "asset_pointer": "file-XYZ123",
          "metadata": {
            "start": 0,
            "end": 10.5
          }
        }
      }
    ]
  }
}
```

## Key Components and Utilities

### 1. Message Content Extraction

The `extractMessageContent` function in `messageUtils.js` handles parsing both audio transcriptions and audio asset pointers:

```javascript
// Example usage:
import { extractMessageContent } from '../utils/messageUtils';

const message = /* message object */;
const content = extractMessageContent(message);
// content.text will contain transcription
// content.mediaRefs will contain audio file references
```

### 2. Audio Rendering

The `MediaRenderer` component handles rendering audio players:

```javascript
// Example usage:
import MediaRenderer from './components/MediaRenderer';

<MediaRenderer 
  media={audioMedia}
  getMediaPath={getMediaPath}
  conversationFolder={conversationFolder}
/>
```

### 3. Media Path Resolution

Audio file paths are resolved using the `getMediaPath` function:

```javascript
// Example usage:
import { createMediaPathResolver } from './utils/mediaUtils';

const getMediaPath = createMediaPathResolver(folder, mediaFilenamesMap);
const audioPath = getMediaPath(audioFileId);
```

## Extending Audio Support

### Adding Custom Audio Players

To customize the audio player appearance or behavior:

1. Create a new component extending `MediaRenderer.jsx`
2. Override the audio rendering section
3. Use your custom component in place of `MediaRenderer`

Example:

```jsx
// CustomAudioPlayer.jsx
import React from 'react';
import { Box, Typography } from '@mui/material';

export default function CustomAudioPlayer({ media, getMediaPath }) {
  return (
    <Box sx={{ /* custom styling */ }}>
      <Typography variant="subtitle2">
        Custom Audio Player
      </Typography>
      <audio 
        controls 
        src={getMediaPath(media.filename)} 
        style={{ width: '100%' }} 
      />
      {/* Additional custom controls */}
    </Box>
  );
}
```

### Supporting New Audio Formats

To add support for additional audio formats:

1. Update the `determineMediaType` function in `mediaUtils.js` to recognize new extensions
2. Add appropriate MIME type handling if needed

## Troubleshooting Common Issues

### Audio Files Not Loading

If audio files aren't loading correctly:

1. Check that the file ID is correctly extracted from the message
2. Verify that the media filename mapping is working
3. Ensure the audio file exists in the expected folder
4. Check browser console for network errors

### Audio Transcription Issues

If audio transcriptions aren't displaying:

1. Verify the message structure contains an `audio_transcription` part
2. Check that the content extraction is working correctly
3. Ensure the transcription text is being passed to the renderer

## Best Practices

1. **Always provide fallbacks** for audio files that fail to load
2. **Handle alternative message structures** as the ChatGPT export format may evolve
3. **Use memoization** for expensive operations like URL construction
4. **Implement error boundaries** around audio components to prevent crashes
5. **Add appropriate ARIA attributes** for accessibility

## Performance Considerations

1. Avoid loading all audio files at once in large conversations
2. Consider implementing lazy loading for audio players
3. Use appropriate audio compression for faster loading
4. Cache audio file references to avoid redundant lookups

## Related Resources

- `AUDIO_TESTING_INSTRUCTIONS.md` for testing the audio support features
- `audio_verification.js` for automated validation of audio functionality

## Future Development

Areas for potential enhancement:

1. Adding waveform visualization
2. Supporting audio speed controls
3. Implementing audio bookmarks
4. Enhancing transcription display with timestamps

By following this guide, you should be able to work with, extend, or customize the audio support features in the Archive Browser application.
