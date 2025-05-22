/**
 * Media utility functions for the Archive Browser
 * Handles media type detection, path resolution, and filename mapping
 */

/**
 * Determines the media type based on filename/extension
 * @param {string} filename - The filename to analyze
 * @returns {string} - The detected media type ('image', 'audio', 'video', or 'unknown')
 */
export function determineMediaType(filename) {
  if (!filename) return 'unknown';
  
  const lowerExt = filename.toLowerCase();
  
  // Image formats
  if (lowerExt.endsWith('.jpg') || lowerExt.endsWith('.jpeg') || 
      lowerExt.endsWith('.png') || lowerExt.endsWith('.gif') || 
      lowerExt.endsWith('.webp') || lowerExt.endsWith('.svg')) {
    return 'image';
  }
  
  // Audio formats
  if (lowerExt.endsWith('.mp3') || lowerExt.endsWith('.wav') || 
      lowerExt.endsWith('.ogg') || lowerExt.endsWith('.m4a')) {
    return 'audio';
  }
  
  // Video formats
  if (lowerExt.endsWith('.mp4') || lowerExt.endsWith('.webm') || 
      lowerExt.endsWith('.mov')) {
    return 'video';
  }
  
  return 'unknown';
}

/**
 * Creates a function to resolve media paths with fallbacks
 * @param {string} folder - The conversation folder 
 * @param {Object} mediaFilenames - Mapping of file IDs to full filenames
 * @returns {Function} - A function that resolves media paths
 */
export function createMediaPathResolver(folder, mediaFilenames) {
  return function getMediaPath(filename) {
    if (!folder) return '';
    
    // Try the mapped filename first, then fallback to the original
    const mappedFilename = mediaFilenames[filename] || filename;
    return `/api/media/${folder}/${mappedFilename}`;
  };
}

/**
 * Helper function to find the full filename in the media folder that contains a given file ID
 * @param {string} folder - The conversation folder
 * @param {string} fileId - The file ID to match
 * @returns {Promise<string>} - The full filename if found, or the original fileId
 */
export async function findFullFilename(folder, fileId) {
  try {
    // API call to find the full filename
    const response = await fetch(`/api/media-file/${fileId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.matches && data.matches.length > 0) {
        // Find the match for this conversation
        const match = data.matches.find(m => m.folder === folder);
        if (match) {
          return match.originalFilename;
        } else if (data.matches[0].originalFilename) {
          // Just use the first match if no specific conversation match
          return data.matches[0].originalFilename;
        }
      }
    }
    // Fallback - just use the file ID
    return fileId;
  } catch (error) {
    console.error('Error finding full filename:', error);
    return fileId;
  }
}

// Cache for media filenames to prevent redundant API calls
const mediaFilenameCache = new Map();

/**
 * Loads all media filenames for a conversation folder
 * @param {string} folder - The conversation folder
 * @param {Function} fetchAPI - The enhanced fetch function with retry capability
 * @returns {Promise<Object>} - A mapping of file IDs to full filenames
 */
export async function loadMediaFilenames(folder, fetchAPI) {
  if (!folder) return {}; // Guard against empty folder
  
  // Check cache first
  if (mediaFilenameCache.has(folder)) {
    console.log('Using cached media filenames for folder:', folder);
    return mediaFilenameCache.get(folder);
  }
  
  try {
    console.log('Loading media filenames for folder:', folder);
    const data = await fetchAPI(`/api/media/${folder}`, {
      maxRetries: 2, // Fewer retries for media filenames
      retryDelay: 500, // Start with half a second
      // Add cache control to ensure we get fresh data
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (data && Array.isArray(data)) {
      // Create a map of partial file IDs to full filenames
      const filenameMap = {};
      data.forEach(file => {
        // Extract the file ID from the filename
        const fileIdMatch = file.match(/file[-_][\w\d]+/);
        if (fileIdMatch) {
          const fileId = fileIdMatch[0];
          filenameMap[fileId] = file;
        }
        // Also add the full filename as a key
        filenameMap[file] = file;
      });
      
      // Store in cache
      mediaFilenameCache.set(folder, filenameMap);
      
      console.log('Media filenames loaded:', Object.keys(filenameMap).length);
      return filenameMap;
    }
    return {};
  } catch (error) {
    console.error('Error loading media filenames:', error);
    return {}; // Return empty object on error
  }
}

/**
 * Clears the media filename cache for a specific folder or all folders
 * @param {string} [folder] - Optional folder to clear cache for (clears all if omitted)
 */
export function clearMediaFilenameCache(folder) {
  if (folder) {
    mediaFilenameCache.delete(folder);
    console.log('Cleared media filename cache for folder:', folder);
  } else {
    mediaFilenameCache.clear();
    console.log('Cleared all media filename caches');
  }
}
