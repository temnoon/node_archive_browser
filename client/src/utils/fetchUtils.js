/**
 * Enhanced fetch API utilities for the Archive Browser
 * Provides error handling, timeouts, and auto-retry for API requests
 */

/**
 * Enhanced fetch API with proper error handling, timeouts, and auto-retry
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options with additional retry configuration
 * @returns {Promise<Object>} - The parsed JSON response
 */
export function fetchAPI(url, options = {}) {
  // Apply default timeout of 30 seconds
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  // Default retry options
  const retryOptions = {
    maxRetries: options.maxRetries || 3,
    retryDelay: options.retryDelay || 1000,
    retryOn: options.retryOn || [429], // Retry on 429 Too Many Requests by default
    currentRetry: options.currentRetry || 0
  };
  
  // Merge provided options with defaults
  const fetchOptions = {
    ...options,
    signal: controller.signal,
    headers: {
      ...options.headers,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  };
  
  return fetch(url, fetchOptions)
    .then(res => {
      clearTimeout(timeoutId);
      
      // Handle 429 Too Many Requests with exponential backoff
      if (retryOptions.retryOn.includes(res.status) && retryOptions.currentRetry < retryOptions.maxRetries) {
        // Get retry delay from header or use exponential backoff
        const retryAfter = res.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 
                    retryOptions.retryDelay * Math.pow(2, retryOptions.currentRetry);
        
        console.log(`Rate limited (${res.status}). Retrying in ${delay}ms (attempt ${retryOptions.currentRetry + 1}/${retryOptions.maxRetries})`);
        
        // Retry with incremented retry count after delay
        return new Promise(resolve => setTimeout(resolve, delay))
          .then(() => fetchAPI(url, {
            ...options,
            maxRetries: retryOptions.maxRetries,
            retryDelay: retryOptions.retryDelay,
            retryOn: retryOptions.retryOn,
            currentRetry: retryOptions.currentRetry + 1
          }));
      }
      
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    })
    .catch(err => {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out or was aborted');
      }
      throw err;
    });
}

/**
 * Handles pagination for API requests
 * @param {string} id - The conversation ID
 * @param {number} page - The page number to fetch
 * @param {number} perPage - Items per page
 * @param {Function} setData - State setter function for the data
 * @param {Function} setMediaFilenames - State setter function for media filenames
 * @param {Function} loadMediaFilenames - Function to load media filenames
 * @param {boolean} initialLoad - Whether this is the initial load
 * @param {Object} scrollRefs - References to scroll elements
 * @returns {Promise<void>}
 */
export function handlePagination(
  id, 
  page, 
  perPage, 
  setData, 
  setMediaFilenames, 
  loadMediaFilenames, 
  initialLoad,
  scrollRefs
) {
  // Create an AbortController to cancel requests if component unmounts or new fetch starts
  const controller = new AbortController();
  const signal = controller.signal;
  
  // Store the controller so we can abort it if needed
  if (handlePagination.controller) {
    handlePagination.controller.abort(); // Cancel any in-flight request
  }
  handlePagination.controller = controller;
  
  // Show loading indicator if not initial load
  if (!initialLoad) {
    setData(prev => ({ ...prev, isLoading: true }));
  }
  
  // Use our enhanced fetchAPI with auto-retry
  return fetchAPI(`/api/conversations/${id}?page=${page}&limit=${perPage}`, {
    signal,
    maxRetries: 3,
    retryDelay: 1000 // Start with 1 second, will increase exponentially
  })
  .then(res => {
    console.log('Received conversation data:', {
      title: res.title,
      folder: res.folder,
      hasMedia: res.has_media,
      messageCount: res.messages?.length || 0,
      initialLoad
    });
    
    // Always reset and use the data from the server directly
    // Never preserve metadata between conversations
    setData({ ...res, isLoading: false });
    window.currentConversationId = id;
    window.currentConversationFolder = res.folder;
    
    // After data is set, load media filenames
    if (res.folder) {
      console.log('Loading media for folder:', res.folder);
      // Use setTimeout to avoid state updates during rendering
      setMediaFilenames({}); // Clear existing filenames first
      setTimeout(() => loadMediaFilenames(res.folder), 100);
    }
    
    // Scroll to top of messages on page change, but not on initial load
    if (!initialLoad && scrollRefs?.scrollRef?.current) {
      scrollRefs.scrollRef.current.scrollTop = 0;
      // Also scroll the page to the top pagination controls
      if (scrollRefs?.topRef?.current) {
        scrollRefs.topRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
    
    return res;
  })
  .catch(err => {
    // Only show error if not aborted
    if (err.name !== 'AbortError') {
      console.error('Error fetching conversation:', err);
      setData(prev => ({ ...prev, isLoading: false, error: err.message }));
    }
    throw err;
  });
}
