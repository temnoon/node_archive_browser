import React from 'react';
import { Box, Pagination, Typography, Select, MenuItem, Tooltip, Badge } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';

/**
 * PaginationControls Component
 * Handles pagination for the conversation view with support for filtered views
 */
export default function PaginationControls({ 
  totalMessages, 
  visibleCount,
  requestedCount,
  currentPage, 
  perPage, 
  isFiltered,
  onPageChange, 
  onPerPageChange,
  topRef
}) {
  // Create a message about visible vs. requested count when filtering is active
  const messageSummary = isFiltered && visibleCount !== undefined && requestedCount !== undefined
    ? `Showing ${visibleCount} of ${requestedCount} requested messages (${totalMessages} total after filtering)`
    : `${totalMessages} total messages`;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, zIndex: 2 }}>
      {/* Per page selector with filtering indicator */}
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="body2">Messages per page</Typography>
          {isFiltered && (
            <Tooltip title="Filter active: Tool and system messages are hidden. Actual message count may be less than requested.">
              <Badge color="primary" variant="dot" sx={{ ml: 1 }}>
                <FilterListIcon fontSize="small" color="action" />
              </Badge>
            </Tooltip>
          )}
        </Box>
        <Select
          size="small" 
          value={perPage}
          onChange={onPerPageChange}
          sx={{ minWidth: 100 }}
        >
          <MenuItem value={5}>5</MenuItem>
          <MenuItem value={10}>10</MenuItem>
          <MenuItem value={25}>25</MenuItem>
          <MenuItem value={50}>50</MenuItem>
          <MenuItem value={100}>100</MenuItem>
        </Select>
        {isFiltered && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {visibleCount}/{requestedCount} visible
          </Typography>
        )}
      </Box>
      
      {/* Pagination controls */}
      {totalMessages > perPage && (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            mb: 1,
            overflow: 'hidden',
            position: 'sticky',
            top: '0',
            zIndex: 5,
            backgroundColor: 'white',
            borderBottom: '1px solid #eee',
            pb: 1,
            '& .MuiPagination-ul': {
              display: 'flex',
              width: '100%',
              justifyContent: 'center',
              '& .MuiPaginationItem-root': {
                margin: '0 2px' // Reduce margins between pagination items
              }
            }
          }}
          ref={topRef}
        >
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, textAlign: 'center' }}>
            {messageSummary}
          </Typography>
          <Pagination 
            count={Math.ceil(totalMessages / perPage)} 
            page={currentPage} 
            onChange={(e, page) => onPageChange(page)}
            size="small"
            siblingCount={1}           // Reduce sibling count to save space
            boundaryCount={1}          // Reduce boundary count to save space
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
}
