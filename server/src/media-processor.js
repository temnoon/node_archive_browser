// Enhanced Media File Processor for Archive Import
const fs = require('fs-extra');
const path = require('path');
const { promisify } = require('util');
const readChunk = promisify(fs.read);

// Magic bytes for common file types
const FILE_SIGNATURES = {
  // Images
  jpeg: [
    { bytes: [0xFF, 0xD8, 0xFF], offset: 0 }
  ],
  png: [
    { bytes: [0x89, 0x50, 0x4E, 0x47], offset: 0 }
  ],
  gif: [
    { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0 }
  ],
  webp: [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }
  ],
  svg: [
    { bytes: [0x3C, 0x73, 0x76, 0x67], offset: 0 } // "<svg"
  ],
  // Audio
  mp3: [
    { bytes: [0x49, 0x44, 0x33], offset: 0 }, // ID3v2
    { bytes: [0xFF, 0xFB], offset: 0 }        // MPEG frame sync
  ],
  wav: [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 } // "RIFF"
  ],
  ogg: [
    { bytes: [0x4F, 0x67, 0x67, 0x53], offset: 0 } // "OggS"
  ],
  // Video
  mp4: [
    { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 } // "ftyp" at offset 4
  ],
  webm: [
    { bytes: [0x1A, 0x45, 0xDF, 0xA3], offset: 0 } // EBML header
  ]
};

// Extension to MIME type mapping
const MIME_TYPES = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
  webm: 'video/webm'
};

// Cache file lists for better performance
let dalleGenerationCache = null;
let filesDirectoryCache = null;
let allFilesCache = null;

// Extract file ID from an asset pointer string
function extractFileId(assetPointer) {
  if (!assetPointer || typeof assetPointer !== 'string') {
    return null;
  }
  
  console.log(`Extracting file ID from: ${assetPointer}`);
  
  // Handle "file-service:" prefix (used for uploaded files and old style generations)
  if (assetPointer.startsWith('file-service:')) {
    // Extract the part after "file-service:" (which could be "//file-XYZ" or just "file-XYZ")
    const parts = assetPointer.split('file-service:');
    if (parts.length > 1) {
      const path = parts[1].trim();
      // Extract the file ID part
      const match = path.match(/file-([\w\d]+)/);
      if (match && match[1]) {
        const fileId = `file-${match[1]}`;
        console.log(`  → Extracted file ID from file-service: ${fileId}`);
        return fileId;
      }
    }
    // Unable to extract valid file ID from file-service: URL
    console.log(`  → Could not extract file ID from file-service: URL, original: ${assetPointer}`);
    return assetPointer; // Return the original pointer for direct file search
  }
  
  // Handle "sediment:" prefix (used for new style AI generations)
  if (assetPointer.startsWith('sediment:')) {
    // Extract the part after "sediment:" 
    const parts = assetPointer.split('sediment:');
    if (parts.length > 1) {
      const path = parts[1].trim();
      // Extract the file ID part (file_XYZ format)
      const match = path.match(/file_([\w\d]+)/);
      if (match && match[1]) {
        const fileId = `file_${match[1]}`;
        console.log(`  → Extracted file ID from sediment: ${fileId}`);
        return fileId;
      }
    }
    // Unable to extract valid file ID from sediment: URL
    console.log(`  → Could not extract file ID from sediment: URL, original: ${assetPointer}`);
    return assetPointer; // Return the original pointer for direct file search
  }
  
  // Handle direct "file-XYZ" format (without prefix)
  if (assetPointer.includes('file-')) {
    const match = assetPointer.match(/file-([\w\d]+)/);
    if (match && match[1]) {
      const fileId = `file-${match[1]}`;
      console.log(`  → Extracted file ID: ${fileId}`);
      return fileId;
    }
  }
  
  // Handle direct "file_XYZ" format (without prefix)
  if (assetPointer.includes('file_')) {
    const match = assetPointer.match(/file_([\w\d]+)/);
    if (match && match[1]) {
      const fileId = `file_${match[1]}`;
      console.log(`  → Extracted file ID: ${fileId}`);
      return fileId;
    }
  }
  
  // If it's a simple file ID without prefix, add file- prefix if numeric/alphanumeric
  if (/^[\w\d]+$/.test(assetPointer)) {
    const fileId = `file-${assetPointer}`;
    console.log(`  → Added file- prefix to simple ID: ${fileId}`);
    return fileId;
  }
  
  console.log(`  → Using original as file ID: ${assetPointer}`);
  return assetPointer; // Return the original string as a fallback
}

// Function to handle specific file-service URLs
function handleFileServiceUrl(url) {
  if (!url || typeof url !== 'string') return null;
  
  // Handle various formats of file-service URLs
  if (url.startsWith('file-service:')) {
    // Extract the file ID after the prefix
    const parts = url.split('file-service:');
    if (parts.length > 1) {
      const path = parts[1].trim();
      
      // Match file-XXXX pattern (common in uploaded files)
      const fileMatch = path.match(/file-([\w\d-]+)/);
      if (fileMatch && fileMatch[1]) {
        return `file-${fileMatch[1]}`;
      }
      
      // Match //file-XXXX pattern (alternative format)
      const slashMatch = path.match(/\/\/file-([\w\d-]+)/);
      if (slashMatch && slashMatch[1]) {
        return `file-${slashMatch[1]}`;
      }
    }
  }
  
  return null;
}

// Extract all media asset references from a conversation or message
function extractMediaReferences(obj) {
  const references = new Set();
  
  try {
    // Helper function to recursively process objects
    function processObject(obj) {
      if (!obj || typeof obj !== 'object') return;
      
      // Check if this is an asset pointer
      if (obj.asset_pointer && typeof obj.asset_pointer === 'string') {
      // First try the specialized file-service handler
      const fileServiceId = handleFileServiceUrl(obj.asset_pointer);
      if (fileServiceId) {
        console.log(`File service URL detected and processed: ${fileServiceId}`);
          references.add(fileServiceId);
      } else {
        // Fallback to regular extraction
        const fileId = extractFileId(obj.asset_pointer);
        if (fileId) {
          references.add(fileId);
        }
      }
    }
      
      // Check attachments in metadata
      if (obj.metadata && obj.metadata.attachments && Array.isArray(obj.metadata.attachments)) {
        obj.metadata.attachments.forEach(attachment => {
          if (attachment.id) {
            references.add(attachment.id);
          }
        });
      }
      
      // Check content sections that might have image attachments
      if (obj.content && obj.content.parts && Array.isArray(obj.content.parts)) {
        obj.content.parts.forEach(part => {
          // Check for image asset pointers (common in ChatGPT exports)
          if (part && typeof part === 'object' && part.asset_pointer) {
            // First try the specialized file-service handler
            const fileServiceId = handleFileServiceUrl(part.asset_pointer);
            if (fileServiceId) {
              console.log(`File service URL detected in content part: ${fileServiceId}`);
              references.add(fileServiceId);
            } else {
              // Fallback to regular extraction
              const fileId = extractFileId(part.asset_pointer);
              if (fileId) {
                references.add(fileId);
              }
            }
          }
          
          // Check for content types that might contain file references
          if (part && typeof part === 'object' && part.content_type === 'image_asset_pointer') {
            // First try the specialized file-service handler
            const fileServiceId = handleFileServiceUrl(part.asset_pointer);
            if (fileServiceId) {
              console.log(`File service URL detected in image_asset_pointer: ${fileServiceId}`);
              references.add(fileServiceId);
            } else {
              // Fallback to regular extraction
              const fileId = extractFileId(part.asset_pointer);
              if (fileId) {
                references.add(fileId);
              }
            }
          }
        });
      }
      
      // For arrays, process each element
      if (Array.isArray(obj)) {
        obj.forEach(item => processObject(item));
        return;
      }
      
      // For objects, process each property
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] !== null && typeof obj[key] === 'object') {
          processObject(obj[key]);
        }
      }
    }
    
    processObject(obj);
    const result = Array.from(references).filter(ref => ref); // Filter out any null/undefined
    console.log(`Extracted ${result.length} media references`);
    return result;
  } catch (err) {
    console.error('Error extracting media references:', err);
    return [];
  }
}

// Detect file type from binary content
async function detectFileType(filePath) {
  try {
    // Open the file
    const fd = await fs.open(filePath, 'r');
    
    // Read first 16 bytes - should be enough for most signatures
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await readChunk(fd, buffer, 0, 16, 0);
    await fs.close(fd);
    
    if (bytesRead === 0) {
      return { type: 'unknown', mimeType: 'application/octet-stream' };
    }
    
    // RIFF detection for WAV files (special handling)
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) { // 'RIFF'
      // Look for WAVE format identifier
      if (buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45) { // 'WAVE'
        console.log('Detected WAV file (RIFF/WAVE format)');
        return { 
          type: 'audio', 
          mimeType: 'audio/wav',
          extension: 'wav'
        };
      }
    }
    
    // Check file signatures
    for (const [type, signatures] of Object.entries(FILE_SIGNATURES)) {
      for (const sig of signatures) {
        const sliced = buffer.slice(sig.offset, sig.offset + sig.bytes.length);
        if (sliced.length === sig.bytes.length) {
          let match = true;
          for (let i = 0; i < sig.bytes.length; i++) {
            if (sliced[i] !== sig.bytes[i]) {
              match = false;
              break;
            }
          }
          if (match) {
            // Add higher-level type categorization
            let highLevelType = 'unknown';
            if (['jpeg', 'jpg', 'png', 'gif', 'webp', 'svg'].includes(type)) {
              highLevelType = 'image';
            } else if (['mp3', 'wav', 'ogg'].includes(type)) {
              highLevelType = 'audio';
            } else if (['mp4', 'webm'].includes(type)) {
              highLevelType = 'video';
            }
            
            return { 
              type: highLevelType,
              specificType: type,
              mimeType: MIME_TYPES[type] || 'application/octet-stream',
              extension: type
            };
          }
        }
      }
    }
    
    // Fallback - try to determine by reading text and checking first line for indicators
    try {
      // Read first 100 bytes as text to check for indicators
      const head = await fs.readFile(filePath, { encoding: 'utf8', length: 100 });
      const firstLine = head.split('\n')[0].trim().toLowerCase();
      
      // Check for JSON
      if (firstLine.startsWith('{') && firstLine.includes('"')) {
        console.log('Detected JSON content');
        return { 
          type: 'document', 
          specificType: 'json',
          mimeType: 'application/json', 
          extension: 'json' 
        };
      }
      
      // Check for SVG
      if (firstLine.includes('<svg') || head.includes('<svg')) {
        console.log('Detected SVG content');
        return { 
          type: 'image', 
          specificType: 'svg',
          mimeType: 'image/svg+xml', 
          extension: 'svg' 
        };
      }
      
      // Check for HTML
      if (firstLine.includes('<!doctype html>') || firstLine.includes('<html') || head.includes('<html')) {
        console.log('Detected HTML content');
        return { 
          type: 'document', 
          specificType: 'html',
          mimeType: 'text/html', 
          extension: 'html' 
        };
      }
    } catch (textErr) {
      // File might not be text-readable, continue to default
      console.log('Could not read file as text:', textErr.message);
    }
    
    // Default fallback
    console.log('Could not detect file type, using default');
    return { 
      type: 'unknown', 
      mimeType: 'application/octet-stream',
      extension: 'bin'
    };
  } catch (err) {
    console.error(`Error detecting file type for ${filePath}:`, err);
    return { type: 'unknown', mimeType: 'application/octet-stream' };
  }
}

// Initialize DALL-E generation cache by scanning the dalle-generations folder once
async function initDalleGenerationsCache(sourceDir) {
  if (dalleGenerationCache !== null) {
    return dalleGenerationCache;
  }
  
  const cache = new Map();
  const dalleDir = path.join(sourceDir, 'dalle-generations');
  
  try {
    if (!await fs.pathExists(dalleDir)) {
      console.log(`No dalle-generations folder found at: ${dalleDir}`);
      dalleGenerationCache = cache;
      return cache;
    }
    
    // Read all files in the dalle-generations folder
    const files = await fs.readdir(dalleDir);
    console.log(`Found ${files.length} files in dalle-generations folder`);
    
    // Populate cache with file_id -> full_filename mapping
    for (const file of files) {
      if (file.startsWith('file-')) {
        // Extract the file ID part (everything before the first dash after 'file-')
        const match = file.match(/file-([\w\d]+)/);
        if (match && match[1]) {
          const fileId = `file-${match[1]}`;
          cache.set(fileId, file);
          console.log(`Cached DALL-E generation: ${fileId} -> ${file}`);
        }
      }
    }
    
    console.log(`Cached ${cache.size} DALL-E generations`);
    dalleGenerationCache = cache;
    return cache;
  } catch (err) {
    console.error('Error initializing DALL-E generations cache:', err);
    dalleGenerationCache = cache;
    return cache;
  }
}

// Initialize files directory cache
async function initFilesDirectoryCache(sourceDir) {
  if (filesDirectoryCache !== null) {
    return filesDirectoryCache;
  }
  
  const cache = new Map();
  const filesDir = path.join(sourceDir, 'files');
  
  try {
    if (!await fs.pathExists(filesDir)) {
      console.log(`No files directory found at: ${filesDir}`);
      filesDirectoryCache = cache;
      return cache;
    }
    
    // Read all files in the files directory
    const files = await fs.readdir(filesDir);
    console.log(`Found ${files.length} files in files directory`);
    
    // Add all files to the cache with their base ID as key
    for (const file of files) {
      // Skip metadata files
      if (file.endsWith('_metadata.json')) {
        continue;
      }
      
      // Try to extract a file ID from the filename
      if (file.startsWith('file-') || file.startsWith('file_')) {
        // Store with the full filename as value
        cache.set(file.split('.')[0], file);
        console.log(`Cached file: ${file.split('.')[0]} -> ${file}`);
      }
    }
    
    console.log(`Cached ${cache.size} files from files directory`);
    filesDirectoryCache = cache;
    return cache;
  } catch (err) {
    console.error('Error initializing files directory cache:', err);
    filesDirectoryCache = cache;
    return cache;
  }
}

// Initialize a cache of all files in the source directory (top level and all subdirectories)
async function initAllFilesCache(sourceDir) {
  if (allFilesCache !== null) {
    return allFilesCache;
  }
  
  const cache = new Map();
  
  try {
    // Using a set to avoid duplicate entries
    const scannedFiles = new Set();
    
    // Scan top level directory
    const topLevelFiles = await fs.readdir(sourceDir);
    console.log(`Found ${topLevelFiles.length} files/directories in top level directory`);
    
    // Scan all files in top level
    for (const item of topLevelFiles) {
      const itemPath = path.join(sourceDir, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isFile()) {
        scannedFiles.add({
          path: itemPath,
          name: item
        });
      }
    }
    
    // Scan the files directory
    const filesDir = path.join(sourceDir, 'files');
    if (await fs.pathExists(filesDir)) {
      const files = await fs.readdir(filesDir);
      for (const file of files) {
        const filePath = path.join(filesDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          scannedFiles.add({
            path: filePath,
            name: file
          });
        }
      }
    }
    
    // Scan the dalle-generations directory
    const dalleDir = path.join(sourceDir, 'dalle-generations');
    if (await fs.pathExists(dalleDir)) {
      const files = await fs.readdir(dalleDir);
      for (const file of files) {
        const filePath = path.join(dalleDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          scannedFiles.add({
            path: filePath,
            name: file
          });
        }
      }
    }
    
    // Convert set to array and build the cache
    const allFiles = Array.from(scannedFiles);
    console.log(`Scanned a total of ${allFiles.length} files in the source directory`);
    
    // Build the cache with various access patterns
    for (const file of allFiles) {
      // Store by exact filename
      cache.set(file.name, file.path);
      
      // If it's a file ID, store by that too
      if (file.name.startsWith('file-') || file.name.startsWith('file_')) {
        const baseId = file.name.split('.')[0];
        cache.set(baseId, file.path);
        
        // Also store without the extension for partial matches
        const fileExtension = path.extname(file.name);
        if (fileExtension) {
          const fileNameWithoutExt = file.name.substring(0, file.name.length - fileExtension.length);
          if (!cache.has(fileNameWithoutExt)) {
            cache.set(fileNameWithoutExt, file.path);
          }
        }
      }
    }
    
    console.log(`Built cache with ${cache.size} entries`);
    allFilesCache = cache;
    return cache;
  } catch (err) {
    console.error('Error initializing all files cache:', err);
    allFilesCache = cache;
    return cache;
  }
}

// Find a file in the source directory based on file ID or original filename
async function findFileByIdOrName(sourceDir, fileId) {
  console.log(`Looking for file by ID or name: ${fileId}`);
  
  try {
    // Ensure all caches are initialized
    await Promise.all([
      initDalleGenerationsCache(sourceDir),
      initFilesDirectoryCache(sourceDir),
      initAllFilesCache(sourceDir)
    ]);
    
    // 1. First, check if it's a DALL-E generation
    if (fileId.startsWith('file-') && dalleGenerationCache.has(fileId)) {
      const filename = dalleGenerationCache.get(fileId);
      const filePath = path.join(sourceDir, 'dalle-generations', filename);
      if (await fs.pathExists(filePath)) {
        console.log(`Found as DALL-E generation: ${filename}`);
        return {
          path: filePath,
          originalFilename: filename
        };
      }
    }
    
    // 2. Check the files directory cache
    if (filesDirectoryCache.has(fileId)) {
      const filename = filesDirectoryCache.get(fileId);
      const filePath = path.join(sourceDir, 'files', filename);
      if (await fs.pathExists(filePath)) {
        console.log(`Found in files directory: ${filename}`);
        return {
          path: filePath,
          originalFilename: filename
        };
      }
    }
    
    // 3. Try common extensions for files directory
    if (fileId.startsWith('file-') || fileId.startsWith('file_')) {
      for (const ext of ['dat', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'mp3', 'mp4', 'pdf']) {
        const filename = `${fileId}.${ext}`;
        const filePath = path.join(sourceDir, 'files', filename);
        if (await fs.pathExists(filePath)) {
          console.log(`Found with extension .${ext}: ${filename}`);
          return {
            path: filePath,
            originalFilename: filename
          };
        }
      }
    }
    
    // 4. Check full file cache (all directories)
    if (allFilesCache.has(fileId)) {
      const filePath = allFilesCache.get(fileId);
      if (await fs.pathExists(filePath)) {
        console.log(`Found in all files cache: ${path.basename(filePath)}`);
        return {
          path: filePath,
          originalFilename: path.basename(filePath)
        };
      }
    }
    
    // 5. Special case for file-service: and sediment: URLs
    if (fileId.includes('://')) {
      // Try to extract file ID from the URL
      let extractedId = null;
      
      if (fileId.includes('file-service:')) {
        const parts = fileId.split('file-service:');
        if (parts.length > 1) {
          const urlPath = parts[1].trim();
          // Look for file-XYZ pattern
          const match = urlPath.match(/file-([\w\d]+)/);
          if (match && match[1]) {
            extractedId = `file-${match[1]}`;
          }
        }
      } else if (fileId.includes('sediment:')) {
        const parts = fileId.split('sediment:');
        if (parts.length > 1) {
          const urlPath = parts[1].trim();
          // Look for file_XYZ pattern
          const match = urlPath.match(/file_([\w\d]+)/);
          if (match && match[1]) {
            extractedId = `file_${match[1]}`;
          }
        }
      }
      
      if (extractedId) {
        console.log(`Extracted ID ${extractedId} from URL ${fileId}`);
        
        // Try to find the file with the extracted ID
        // Check all files cache
        if (allFilesCache.has(extractedId)) {
          const filePath = allFilesCache.get(extractedId);
          if (await fs.pathExists(filePath)) {
            console.log(`Found by extracted ID: ${path.basename(filePath)}`);
            return {
              path: filePath,
              originalFilename: path.basename(filePath)
            };
          }
        }
        
        // Try common extensions
        for (const ext of ['dat', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'mp3', 'mp4', 'pdf']) {
          const filename = `${extractedId}.${ext}`;
          const filePath = path.join(sourceDir, 'files', filename);
          if (await fs.pathExists(filePath)) {
            console.log(`Found with extension .${ext}: ${filename}`);
            return {
              path: filePath,
              originalFilename: filename
            };
          }
        }
      }
    }
    
    // 6. For file_XYZ pattern, check .dat file and metadata
    if (fileId.startsWith('file_')) {
      const datPath = path.join(sourceDir, 'files', `${fileId}.dat`);
      if (await fs.pathExists(datPath)) {
        console.log(`Found as .dat file: ${fileId}.dat`);
        
        // Check for metadata file to get proper extension
        const metadataPath = path.join(sourceDir, 'files', `${fileId}_metadata.json`);
        if (await fs.pathExists(metadataPath)) {
          try {
            const metadata = await fs.readJson(metadataPath);
            if (metadata.mime_type) {
              // Derive extension from mime type
              let ext = 'dat';
              if (metadata.mime_type.includes('/')) {
                ext = metadata.mime_type.split('/')[1];
                if (ext === 'jpeg') ext = 'jpg';
              }
              
              console.log(`Found mime_type in metadata: ${metadata.mime_type}, using extension .${ext}`);
              return {
                path: datPath,
                originalFilename: `${fileId}.${ext}`
              };
            }
          } catch (err) {
            console.error(`Error reading metadata for ${fileId}:`, err);
          }
        }
        
        // If metadata doesn't provide an extension, use .dat
        return {
          path: datPath,
          originalFilename: `${fileId}.dat`
        };
      }
    }
    
    // 7. Check the top level directory for files containing the file ID (for user uploaded files)
    const topLevelFile = await findFileInTopLevelByPartialId(sourceDir, fileId);
    if (topLevelFile) {
      console.log(`Found in top level directory: ${topLevelFile.originalFilename}`);
      return topLevelFile;
    }
    
    // File not found with any method
    console.warn(`Could not find file for: ${fileId}`);
    return null;
  } catch (err) {
    console.error(`Error finding file ${fileId}:`, err);
    return null;
  }
}

// Process a single media file, copying it to the media directory
async function processMediaFile(sourceDir, fileId, mediaDir) {
  try {
    console.log(`Processing media file: ${fileId}`);
    
    // Find the file by ID or name
    const file = await findFileByIdOrName(sourceDir, fileId);
    
    if (file) {
      // For .dat files, determine a better extension based on content type
      let originalFilename = file.originalFilename;
      let destFileName = originalFilename;
      
      if (originalFilename.endsWith('.dat')) {
        console.log(`Detecting content type for .dat file: ${originalFilename}`);
        // Detect the file type
        const detectedType = await detectFileType(file.path);
        console.log(`Detected type for ${originalFilename}: ${JSON.stringify(detectedType)}`);
        
        if (detectedType.type && detectedType.type !== 'unknown') {
          // Use detected extension
          destFileName = originalFilename.replace('.dat', `.${detectedType.extension}`);
          console.log(`Changed extension from .dat to .${detectedType.extension} based on content type`);
        }
      }
      
      // Copy the file with the proper extension
      const destPath = path.join(mediaDir, destFileName);
      await fs.copy(file.path, destPath);
      console.log(`Copied file to ${destPath}`);
      return destFileName;
    }
    
    return null;
  } catch (err) {
    console.error(`Error processing media file ${fileId}:`, err);
    return null;
  }
}

// Process all media files from a conversation
async function processConversationMedia(sourceDir, mediaDir, conversation) {
  const mediaFiles = new Map();
  
  try {
    // Ensure media directory exists
    await fs.ensureDir(mediaDir);
    
    // If no conversation provided, return empty map
    if (!conversation) {
      console.warn('No conversation provided, skipping media processing');
      return mediaFiles;
    }
    
    // Initialize all file caches
    await Promise.all([
      initDalleGenerationsCache(sourceDir),
      initFilesDirectoryCache(sourceDir),
      initAllFilesCache(sourceDir)
    ]);
    
    // Extract all media references
    const references = extractMediaReferences(conversation);
    
    if (references.length === 0) {
      console.log('No media references found in conversation');
      return mediaFiles;
    }
    
    console.log(`Processing ${references.length} media references`);
    
    // Process each referenced file
    for (const fileId of references) {
      const destFileName = await processMediaFile(sourceDir, fileId, mediaDir);
      
      if (destFileName) {
        mediaFiles.set(fileId, destFileName);
      }
    }
    
    console.log(`Processed ${mediaFiles.size} media files for conversation`);
    return mediaFiles;
  } catch (err) {
    console.error('Error processing conversation media:', err);
    return mediaFiles; // Return what we have so far
  }
}

// Update asset pointers in conversation JSON
function updateAssetPointers(json, mediaFiles) {
  // Deep clone to avoid modifying the original
  const updated = JSON.parse(JSON.stringify(json));
  
  // Helper function to recursively process objects
  function processObject(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    // Check if this is an asset pointer
    if (obj.asset_pointer && typeof obj.asset_pointer === 'string') {
      // Extract file ID from asset pointer
      const fileId = extractFileId(obj.asset_pointer);
      
      if (fileId && mediaFiles.has(fileId)) {
        // Update the asset pointer to reference local file
        obj.originalAssetPointer = obj.asset_pointer; // Keep original for reference
        obj.asset_pointer = `media/${mediaFiles.get(fileId)}`;
      }
    }
    
    // For arrays, process each element
    if (Array.isArray(obj)) {
      obj.forEach(item => processObject(item));
      return;
    }
    
    // For objects, process each property
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] !== null && typeof obj[key] === 'object') {
        processObject(obj[key]);
      }
    }
  }
  
  processObject(updated);
  return updated;
}

// Extract markdown content from message parts
function extractMarkdown(message) {
  if (!message) return '';
  
  // If there's no content, or content.parts, return empty string
  if (!message.content || !message.content.parts) return '';
  
  // Combine all text parts
  let markdown = '';
  for (const part of message.content.parts) {
    if (typeof part === 'string') {
      markdown += part + '\n\n';
    }
  }
  
  return markdown.trim();
}

// Add a function to search for files in the top level directory that contain a file ID
async function findFileInTopLevelByPartialId(sourceDir, fileId) {
  try {
    console.log(`Searching for file containing ID ${fileId} in top level directory`);
    
    // Check if the source directory exists
    if (!await fs.pathExists(sourceDir)) {
      console.log(`Source directory does not exist: ${sourceDir}`);
      return null;
    }
    
    // Read all files in the top-level directory
    const files = await fs.readdir(sourceDir);
    
    // Look for files that contain the fileId in their name
    const matchingFiles = files.filter(file => {
      // Skip directories
      const filePath = path.join(sourceDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) return false;
      } catch (err) {
        return false;
      }
      
      // Check if the filename contains the fileId
      return file.includes(fileId);
    });
    
    if (matchingFiles.length > 0) {
      const filePath = path.join(sourceDir, matchingFiles[0]);
      console.log(`Found file containing ID ${fileId}: ${matchingFiles[0]}`);
      return {
        path: filePath,
        originalFilename: matchingFiles[0]
      };
    }
    
    console.log(`No files found containing ID ${fileId} in top level directory`);
    return null;
  } catch (error) {
    console.error(`Error searching for file containing ID ${fileId}:`, error);
    return null;
  }
}

module.exports = {
  detectFileType,
  extractMediaReferences,
  extractFileId,
  handleFileServiceUrl,
  processMediaFile,
  processConversationMedia,
  updateAssetPointers,
  initDalleGenerationsCache,
  initFilesDirectoryCache,
  initAllFilesCache,
  findFileInTopLevelByPartialId,
  extractMarkdown
};