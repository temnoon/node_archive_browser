// Helper: Recursively index conversations and messages from the new JSON-based structure
async function indexArchive() {
  const conversations = [];
  try {
    if (!await fs.pathExists(ARCHIVE_ROOT)) {
      console.error(`Archive root directory not found: ${ARCHIVE_ROOT}`);
      return [];
    }
    
    // Read all conversation directories
    const allDirs = await fs.readdir(ARCHIVE_ROOT);
    
    // Only include actual conversation directories (using a more flexible pattern)
    const convDirs = allDirs.filter(dir => {
      // Check for conversation.json file to determine valid conversation directory
      const jsonPath = path.join(ARCHIVE_ROOT, dir, 'conversation.json');
      return fs.existsSync(jsonPath);
    });
    
    console.log(`Found ${convDirs.length} conversation directories`);
    
    for (const convDir of convDirs) {
      const convPath = path.join(ARCHIVE_ROOT, convDir);
      const jsonPath = path.join(convPath, 'conversation.json');
      
      // Load the full conversation JSON
      const conversation = await fs.readJson(jsonPath);
      
      // Extract gizmo IDs
      const gizmoIds = Array.from(new Set(
        Object.values(conversation.mapping || {})
          .filter(m => m.message?.metadata?.gizmo_id)
          .map(m => m.message.metadata.gizmo_id)
      ));

      // Resolve gizmo names
      const gizmoNames = {};
      if (gizmoIds.length > 0) {
        for (const gizmoId of gizmoIds) {
          gizmoNames[gizmoId] = await gizmoResolver.resolveGizmoName(gizmoId);
        }
      }
      
      // Extract essential metadata
      const metadata = {
        id: conversation.id || conversation.conversation_id,
        title: conversation.title || 'Untitled',
        create_time: conversation.create_time,
        update_time: conversation.update_time,
        folder: convDir,
        message_count: conversation.mapping ? Object.keys(conversation.mapping).length : 0,
        // Include whether this conversation has gizmo/Custom GPT content
        has_gizmo: gizmoIds.length > 0,
        // Store gizmo info if available
        gizmo_ids: gizmoIds,
        gizmo_names: gizmoNames,
        // Include whether conversation has canvas content
        has_canvas: Object.values(conversation.mapping || {}).some(
          m => canvasProcessor.extractCanvasReferences(m.message).length > 0
        ),
        // Include model types used
        models: [...new Set(
          Object.values(conversation.mapping || {})
            .filter(m => m.message?.metadata?.model_slug)
            .map(m => m.message.metadata.model_slug)
        )],
        // Include if conversation has web search results
        has_web_search: Object.values(conversation.mapping || {}).some(
          m => m.message?.author?.role === 'tool' && m.message?.author?.name === 'web'
        ),
        // Include if conversation has media files
        has_media: await fs.pathExists(path.join(convPath, 'media')) && 
                  (await fs.readdir(path.join(convPath, 'media'))).length > 0
      };
      
      conversations.push(metadata);
    }
    
    // Sort conversations by create_time in descending order (newest first)
    conversations.sort((a, b) => (b.create_time || 0) - (a.create_time || 0));
    
  } catch (err) {
    console.error('Error indexing archive:', err);
  }
  
  return conversations;
}
