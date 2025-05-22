# Refactoring Deployment Plan

## Overview

We've refactored the ConversationView component into smaller, more maintainable pieces. This document outlines the steps to safely deploy these changes to production.

## Step 1: Backup Current Code

Before making any changes, create backups of the original files:

```bash
cp /Users/tem/nab/client/src/ConversationView.jsx /Users/tem/nab/client/src/ConversationView.jsx.backup
```

## Step 2: Deploy Utility Modules

1. First, deploy the utility modules as they don't affect existing functionality:

```bash
# Ensure the utils directory exists
mkdir -p /Users/tem/nab/client/src/utils

# Copy the utility files
cp /Users/tem/nab/client/src/utils/mediaUtils.js /Users/tem/nab/client/src/utils/
cp /Users/tem/nab/client/src/utils/messageUtils.js /Users/tem/nab/client/src/utils/ 
cp /Users/tem/nab/client/src/utils/fetchUtils.js /Users/tem/nab/client/src/utils/
```

## Step 3: Deploy Component Files

1. Create the components directory and deploy the component files:

```bash
# Ensure the components directory exists
mkdir -p /Users/tem/nab/client/src/components

# Copy the component files
cp /Users/tem/nab/client/src/components/MediaRenderer.jsx /Users/tem/nab/client/src/components/
cp /Users/tem/nab/client/src/components/MediaModal.jsx /Users/tem/nab/client/src/components/
cp /Users/tem/nab/client/src/components/ConversationHeader.jsx /Users/tem/nab/client/src/components/
cp /Users/tem/nab/client/src/components/ConversationControls.jsx /Users/tem/nab/client/src/components/
cp /Users/tem/nab/client/src/components/PaginationControls.jsx /Users/tem/nab/client/src/components/
cp /Users/tem/nab/client/src/components/MessageItem.jsx /Users/tem/nab/client/src/components/
cp /Users/tem/nab/client/src/components/CanvasSummary.jsx /Users/tem/nab/client/src/components/
```

## Step 4: Test in Development Environment

1. Run the application in the development environment to ensure everything works:

```bash
# Start the frontend development server
cd /Users/tem/nab/client
npm run dev
```

2. Verify the following functionality:
   - Conversation loading
   - Message rendering (especially audio messages)
   - Pagination
   - Media display
   - Tool message toggling
   - Gizmo editing

## Step 5: Deploy the Refactored ConversationView

1. Replace the original ConversationView with the refactored version:

```bash
cp /Users/tem/nab/client/src/ConversationView.jsx.refactored /Users/tem/nab/client/src/ConversationView.jsx
```

## Step 6: Verify Production Build

1. Create a production build to ensure there are no build-time errors:

```bash
cd /Users/tem/nab/client
npm run build
```

2. Test the production build locally:

```bash
npm run preview
```

## Step 7: Deploy to Production

1. Deploy the changes to production following your standard deployment process.

## Rollback Plan

If issues are encountered, roll back to the original version:

```bash
cp /Users/tem/nab/client/src/ConversationView.jsx.backup /Users/tem/nab/client/src/ConversationView.jsx
```

## Monitoring

After deployment, monitor:

1. Client-side errors in browser console
2. API error rates
3. User feedback on conversation display
4. Performance metrics

## Additional Notes

- The refactored code improves audio message support and fixes several UI issues
- The modular structure makes future maintenance and bug fixes easier
- Components are reusable across the application
