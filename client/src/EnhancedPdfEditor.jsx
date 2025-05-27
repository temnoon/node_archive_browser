import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Paper,
  Grid,
  IconButton,
  Tabs,
  Tab,
  Card,
  CardContent,
  Slider,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Menu,
  MenuList,
  MenuItem as MenuItemComponent,
  Divider,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  TextFields as TextIcon,
  Crop as CropIcon,
  Rectangle as RectangleIcon,
  Circle as CircleIcon,
  Image as ImageIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  FormatAlignLeft as AlignLeftIcon,
  FormatAlignCenter as AlignCenterIcon,
  FormatAlignRight as AlignRightIcon,
  FormatAlignJustify as AlignJustifyIcon,
  ExpandMore as ExpandMoreIcon,
  Folder as FolderIcon,
  FontDownload as FontIcon,
  Layers as LayersIcon,
  GridOn as GridIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon
} from '@mui/icons-material';
import LatexMarkdownRenderer from './components/LatexMarkdownRenderer';

// Utility function to add delays between API calls
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Markdown parsing utility with table support
const parseMarkdown = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  // Function to parse markdown tables
  const parseTable = (tableText) => {
    console.log('EnhancedPdfEditor: parseTable called with text:', tableText);
    
    const lines = tableText.trim().split('\n').filter(line => line.trim());
    console.log('EnhancedPdfEditor: parseTable lines after filtering:', lines);
    
    if (lines.length < 3) {
      console.log('EnhancedPdfEditor: parseTable - not enough lines:', lines.length);
      return null;
    }
    
    // Parse header row - remove leading/trailing pipes and split
    const headerLine = lines[0].trim();
    console.log('EnhancedPdfEditor: parseTable headerLine:', headerLine);
    
    if (!headerLine.includes('|')) {
      console.log('EnhancedPdfEditor: parseTable - no pipes in header');
      return null;
    }
    
    const headerCells = headerLine.split('|')
      .map(cell => cell.trim())
      .filter((cell, index, array) => {
        // Remove empty cells only at start/end (leading/trailing pipes)
        return !(cell === '' && (index === 0 || index === array.length - 1));
      });
    
    console.log('EnhancedPdfEditor: parseTable headerCells:', headerCells);
    
    // Check separator row (line 1)
    const separatorLine = lines[1].trim();
    console.log('EnhancedPdfEditor: parseTable separatorLine:', separatorLine);
    
    if (!separatorLine.includes('-') || !separatorLine.includes('|')) {
      console.log('EnhancedPdfEditor: parseTable - invalid separator');
      return null;
    }
    
    // Parse data rows - maintain same structure as headers
    const dataRows = lines.slice(2).map((line, index) => {
      const trimmedLine = line.trim();
      console.log(`EnhancedPdfEditor: parseTable processing data row ${index}:`, trimmedLine);
      
      if (!trimmedLine.includes('|')) {
        console.log(`EnhancedPdfEditor: parseTable - no pipes in data row ${index}`);
        return null;
      }
      
      const cells = trimmedLine.split('|')
        .map(cell => cell.trim())
        .filter((cell, index, array) => {
          // Remove empty cells only at start/end (leading/trailing pipes)
          return !(cell === '' && (index === 0 || index === array.length - 1));
        });
      
      console.log(`EnhancedPdfEditor: parseTable data row ${index} cells:`, cells);
      
      // Ensure row has same number of cells as headers (pad with empty if needed)
      while (cells.length < headerCells.length) {
        cells.push('');
      }
      
      return cells.slice(0, headerCells.length); // Truncate if too many cells
    }).filter(row => row !== null);
    
    console.log('EnhancedPdfEditor: parseTable final dataRows:', dataRows);
    
    if (dataRows.length === 0) {
      console.log('EnhancedPdfEditor: parseTable - no valid data rows');
      return null;
    }
    
    const result = {
      headers: headerCells,
      rows: dataRows
    };
    
    console.log('EnhancedPdfEditor: parseTable final result:', result);
    
    return result;
  };
  
  // Function to render table with Material-UI styling
  const renderTable = (tableData, tableIndex) => {
    return (
      <Box key={`table-${tableIndex}`} sx={{ 
        margin: '16px 0',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#fff'
      }}>
        <Box sx={{ 
          backgroundColor: '#f5f5f5',
          borderBottom: '2px solid #1976d2',
          padding: '8px 0'
        }}>
          <Box sx={{ display: 'flex' }}>
            {tableData.headers.map((header, index) => (
              <Box key={index} sx={{ 
                flex: 1,
                padding: '8px 12px',
                fontWeight: 'bold',
                fontSize: '14px',
                color: '#1976d2',
                borderRight: index < tableData.headers.length - 1 ? '1px solid #e0e0e0' : 'none'
              }}>
                {header}
              </Box>
            ))}
          </Box>
        </Box>
        <Box>
          {tableData.rows.map((row, rowIndex) => (
            <Box key={rowIndex} sx={{ 
              display: 'flex',
              backgroundColor: rowIndex % 2 === 0 ? '#fff' : '#f9f9f9',
              '&:hover': { backgroundColor: '#f0f7ff' },
              borderBottom: rowIndex < tableData.rows.length - 1 ? '1px solid #e0e0e0' : 'none'
            }}>
              {row.map((cell, cellIndex) => (
                <Box key={cellIndex} sx={{ 
                  flex: 1,
                  padding: '12px',
                  fontSize: '13px',
                  borderRight: cellIndex < row.length - 1 ? '1px solid #e0e0e0' : 'none'
                }}>
                  {parseMarkdownToReact(cell)}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    );
  };
  
  // Simple markdown parsing with React elements
  const parseMarkdownToReact = (str) => {
    const parts = [];
    let currentIndex = 0;
    
    // Patterns for markdown elements
    const patterns = [
      { regex: /\*\*(.*?)\*\*/g, component: (match, content) => <strong key={currentIndex++}>{content}</strong> },
      { regex: /\*(.*?)\*/g, component: (match, content) => <em key={currentIndex++}>{content}</em> },
      { regex: /`(.*?)`/g, component: (match, content) => <code key={currentIndex++} style={{backgroundColor: '#f5f5f5', padding: '2px 4px', borderRadius: '3px', fontFamily: 'Courier'}}>{content}</code> },
      { regex: /~~(.*?)~~/g, component: (match, content) => <span key={currentIndex++} style={{textDecoration: 'line-through'}}>{content}</span> }
    ];
    
    let processedText = str;
    const replacements = [];
    
    // Find all markdown patterns and their positions
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(str)) !== null) {
        replacements.push({
          start: match.index,
          end: match.index + match[0].length,
          component: pattern.component(match[0], match[1]),
          original: match[0]
        });
      }
    });
    
    // Sort replacements by position
    replacements.sort((a, b) => a.start - b.start);
    
    // Build the result with React elements
    if (replacements.length === 0) {
      return str;
    }
    
    const result = [];
    let lastEnd = 0;
    
    replacements.forEach((replacement, index) => {
      // Add text before this replacement
      if (replacement.start > lastEnd) {
        result.push(str.substring(lastEnd, replacement.start));
      }
      
      // Add the replacement component
      result.push(replacement.component);
      lastEnd = replacement.end;
    });
    
    // Add remaining text
    if (lastEnd < str.length) {
      result.push(str.substring(lastEnd));
    }
    
    return result;
  };
  
  // Check for tables first (multi-line processing) - improved regex for table detection
  console.log('EnhancedPdfEditor: parseMarkdown input text:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
  
  const tableRegex = /(\|[^|\n]*\|[^\n]*\n\|[^|\n]*[-:]+[^|\n]*\|[^\n]*(?:\n\|[^|\n]*\|[^\n]*)*)/g;
  const tables = [];
  let match;
  
  console.log('EnhancedPdfEditor: Starting table detection with regex:', tableRegex);
  
  while ((match = tableRegex.exec(text)) !== null) {
    console.log('EnhancedPdfEditor: Table regex match found:', {
      index: match.index,
      matchLength: match[0].length,
      matchContent: match[1]
    });
    
    const tableData = parseTable(match[1]);
    console.log('EnhancedPdfEditor: parseTable returned:', tableData);
    
    if (tableData) {
      const tableEntry = {
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        data: tableData
      };
      tables.push(tableEntry);
      console.log('EnhancedPdfEditor: Added table to tables array:', tableEntry);
    } else {
      console.log('EnhancedPdfEditor: parseTable returned null, skipping table');
    }
  }
  
  console.log('EnhancedPdfEditor: Final tables array:', tables);
  
  // If we found tables, process the text with table replacements
  if (tables.length > 0) {
    const result = [];
    let lastEnd = 0;
    
    tables.forEach((table, tableIndex) => {
      // Add text before this table
      if (table.start > lastEnd) {
        const beforeText = text.substring(lastEnd, table.start);
        const lines = beforeText.split('\n');
        lines.forEach((line, index) => {
          result.push(
            <div key={`text-${lastEnd}-${index}`} style={{ marginBottom: line.trim() === '' ? '8px' : '0' }}>
              {parseMarkdownToReact(line)}
            </div>
          );
        });
      }
      
      // Add the table
      result.push(renderTable(table.data, tableIndex));
      lastEnd = table.end;
    });
    
    // Add remaining text
    if (lastEnd < text.length) {
      const remainingText = text.substring(lastEnd);
      const lines = remainingText.split('\n');
      lines.forEach((line, index) => {
        result.push(
          <div key={`text-${lastEnd}-${index}`} style={{ marginBottom: line.trim() === '' ? '8px' : '0' }}>
            {parseMarkdownToReact(line)}
          </div>
        );
      });
    }
    
    return result;
  }
  
  // No tables found, process normally
  const lines = text.split('\n');
  return lines.map((line, index) => (
    <div key={index} style={{ marginBottom: line.trim() === '' ? '8px' : '0' }}>
      {parseMarkdownToReact(line)}
    </div>
  ));
};

const EnhancedPdfEditor = () => {
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  // Core state
  const [document, setDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedElement, setSelectedElement] = useState(null);
  const [selectedTool, setSelectedTool] = useState('select');
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Conversation data for media paths
  const [conversationData, setConversationData] = useState(null);

  // Font management state
  const [availableFonts, setAvailableFonts] = useState([]);
  const [selectedFont, setSelectedFont] = useState('Helvetica');
  const [fontSize, setFontSize] = useState(12);
  const [fontWeight, setFontWeight] = useState('normal');
  const [fontStyle, setFontStyle] = useState('normal');
  const [textColor, setTextColor] = useState('#000000');
  const [textAlign, setTextAlign] = useState('left');

  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [propertyPanelOpen, setPropertyPanelOpen] = useState(true);
  const [layerPanelOpen, setLayerPanelOpen] = useState(true);
  const [fontDialogOpen, setFontDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Resizing state
  const [resizingElement, setResizingElement] = useState(null);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartBounds, setResizeStartBounds] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Drag and drop state
  const [draggingElement, setDraggingElement] = useState(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragStartBounds, setDragStartBounds] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [dropZones, setDropZones] = useState([]);

  // Refs
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Calculate dynamic height based on content
  const calculateElementHeight = useCallback((element) => {
    if (element.type === 'text') {
      const style = element.style || {};
      const fontSize = style.fontSize || 12;
      const lineHeight = style.lineHeight || 1.4;
      const contentWidth = element.bounds?.width || 400;
      
      // Estimate text height based on content and styling
      const content = element.content || '';
      const avgCharsPerLine = Math.floor(contentWidth / (fontSize * 0.6)); // Rough character width estimation
      const estimatedLines = Math.ceil(content.length / avgCharsPerLine);
      const minLines = content.split('\n').length;
      const totalLines = Math.max(estimatedLines, minLines);
      
      return Math.max(totalLines * fontSize * lineHeight, 20);
    } else if (element.type === 'image') {
      // For images, maintain aspect ratio or use specified height
      return element.bounds?.height || 200;
    }
    
    // Default height for other elements
    return element.bounds?.height || 50;
  }, []);

  // Resize handler functions
  const handleResizeStart = useCallback((element, handle, event) => {
    event.stopPropagation();
    setResizingElement(element);
    setResizeHandle(handle);
    setResizeStartPos({ x: event.clientX, y: event.clientY });
    setResizeStartBounds({ ...element.bounds });
    
    console.log('EnhancedPdfEditor: Resize started', { elementId: element.id, handle });
  }, []);

  const handleResizeMove = useCallback((event) => {
    if (!resizingElement || !resizeHandle) return;
    
    const deltaX = event.clientX - resizeStartPos.x;
    const deltaY = event.clientY - resizeStartPos.y;
    
    let newBounds = { ...resizeStartBounds };
    
    // Calculate new bounds based on resize handle
    switch (resizeHandle) {
      case 'se': // Southeast corner
        newBounds.width = Math.max(50, resizeStartBounds.width + deltaX);
        newBounds.height = Math.max(20, resizeStartBounds.height + deltaY);
        break;
      case 'e': // East edge
        newBounds.width = Math.max(50, resizeStartBounds.width + deltaX);
        break;
      case 's': // South edge
        newBounds.height = Math.max(20, resizeStartBounds.height + deltaY);
        break;
      case 'sw': // Southwest corner
        newBounds.width = Math.max(50, resizeStartBounds.width - deltaX);
        newBounds.height = Math.max(20, resizeStartBounds.height + deltaY);
        newBounds.x = resizeStartBounds.x + deltaX;
        break;
      case 'w': // West edge
        newBounds.width = Math.max(50, resizeStartBounds.width - deltaX);
        newBounds.x = resizeStartBounds.x + deltaX;
        break;
      case 'nw': // Northwest corner
        newBounds.width = Math.max(50, resizeStartBounds.width - deltaX);
        newBounds.height = Math.max(20, resizeStartBounds.height - deltaY);
        newBounds.x = resizeStartBounds.x + deltaX;
        newBounds.y = resizeStartBounds.y + deltaY;
        break;
      case 'n': // North edge
        newBounds.height = Math.max(20, resizeStartBounds.height - deltaY);
        newBounds.y = resizeStartBounds.y + deltaY;
        break;
      case 'ne': // Northeast corner
        newBounds.width = Math.max(50, resizeStartBounds.width + deltaX);
        newBounds.height = Math.max(20, resizeStartBounds.height - deltaY);
        newBounds.y = resizeStartBounds.y + deltaY;
        break;
    }
    
    // Update element bounds
    updateElement(resizingElement.id, { bounds: newBounds });
  }, []);

  // Page flow recalculation (moved up to fix reference error)
  const recalculatePageFlow = useCallback(async () => {
    if (!document || !document.pages) return;
    
    console.log('EnhancedPdfEditor: Recalculating page flow');
    
    // Get all elements sorted by their vertical position
    const allElements = [];
    document.pages.forEach((page, pageIndex) => {
      if (page.elements) {
        page.elements.forEach(element => {
          allElements.push({
            ...element,
            originalPageIndex: pageIndex,
            absoluteY: pageIndex * 842 + element.bounds.y // A4 height = 842 points
          });
        });
      }
    });
    
    // Sort by absolute Y position
    allElements.sort((a, b) => a.absoluteY - b.absoluteY);
    
    // Redistribute elements across pages
    const pageHeight = 842; // A4 height
    const margins = { top: 72, bottom: 72 }; // 1 inch margins
    const contentHeight = pageHeight - margins.top - margins.bottom;
    
    let currentPageIndex = 0;
    let currentY = margins.top;
    
    for (const element of allElements) {
      const elementHeight = calculateElementHeight(element);
      
      // Check if element fits on current page
      if (currentY + elementHeight > margins.top + contentHeight) {
        // Move to next page
        currentPageIndex++;
        currentY = margins.top;
        
        // Create new page if needed
        if (currentPageIndex >= document.pages.length) {
          try {
            await apiCall(`/documents/${document.id}/pages`, {
              method: 'POST',
              body: JSON.stringify({
                size: 'A4',
                orientation: 'portrait',
                margins: { top: 72, right: 72, bottom: 72, left: 72 }
              })
            });
          } catch (error) {
            console.error('Failed to create new page:', error);
            break;
          }
        }
      }
      
      // Update element position if it changed
      if (element.originalPageIndex !== currentPageIndex || element.bounds.y !== currentY) {
        const newBounds = { ...element.bounds, y: currentY };
        
        try {
          // Move element to new page/position
          await apiCall(`/documents/${document.id}/pages/${document.pages[currentPageIndex].id}/elements`, {
            method: 'POST',
            body: JSON.stringify({
              ...element,
              bounds: newBounds
            })
          });
          
          // Remove from old page if different
          if (element.originalPageIndex !== currentPageIndex) {
            await apiCall(`/documents/${document.id}/pages/${document.pages[element.originalPageIndex].id}/elements/${element.id}`, {
              method: 'DELETE'
            });
          }
        } catch (error) {
          console.error('Failed to move element:', error);
        }
      }
      
      currentY += elementHeight + 10; // Add spacing between elements
    }
    
    // Refresh document state
    const updatedDoc = await apiCall(`/documents/${document.id}`);
    setDocument(updatedDoc.document);
    
  }, []);

  const handleResizeEnd = useCallback(() => {
    if (resizingElement) {
      console.log('EnhancedPdfEditor: Resize ended', { elementId: resizingElement.id });
      
      // Trigger page flow recalculation after resize
      recalculatePageFlow();
    }
    
    setResizingElement(null);
    setResizeHandle(null);
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((element, event) => {
    if (resizingElement) return; // Don't drag while resizing
    
    event.stopPropagation();
    setDraggingElement(element);
    setDragStartPos({ x: event.clientX, y: event.clientY });
    setDragStartBounds({ ...element.bounds });
    
    // Calculate drop zones for reordering
    calculateDropZones(element);
    
    console.log('EnhancedPdfEditor: Drag started', { elementId: element.id });
  }, []);

  const handleDragMove = useCallback((event) => {
    if (!draggingElement) return;
    
    const deltaX = event.clientX - dragStartPos.x;
    const deltaY = event.clientY - dragStartPos.y;
    
    const newBounds = {
      ...dragStartBounds,
      x: dragStartBounds.x + deltaX,
      y: dragStartBounds.y + deltaY
    };
    
    // Update element position during drag
    updateElement(draggingElement.id, { bounds: newBounds });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggingElement) {
      console.log('EnhancedPdfEditor: Drag ended', { elementId: draggingElement.id });
      
      // Check if dropped in a reorder zone
      checkForReorder();
      
      // Clear drop zones
      setDropZones([]);
      
      // Trigger page flow recalculation
      recalculatePageFlow();
    }
    
    setDraggingElement(null);
  }, []);

  const calculateDropZones = useCallback((draggingEl) => {
    if (!document || !document.pages[currentPage]) return;
    
    const zones = [];
    const elements = document.pages[currentPage].elements.filter(el => el.id !== draggingEl.id);
    
    // Sort elements by Y position
    elements.sort((a, b) => a.bounds.y - b.bounds.y);
    
    // Add drop zone before first element
    if (elements.length > 0) {
      zones.push({
        id: 'before-first',
        y: elements[0].bounds.y - 20,
        insertIndex: 0
      });
    }
    
    // Add drop zones between elements
    for (let i = 0; i < elements.length - 1; i++) {
      const currentEl = elements[i];
      const nextEl = elements[i + 1];
      const midY = currentEl.bounds.y + currentEl.bounds.height + 
                   (nextEl.bounds.y - (currentEl.bounds.y + currentEl.bounds.height)) / 2;
      
      zones.push({
        id: `between-${i}-${i + 1}`,
        y: midY,
        insertIndex: i + 1
      });
    }
    
    // Add drop zone after last element
    if (elements.length > 0) {
      const lastEl = elements[elements.length - 1];
      zones.push({
        id: 'after-last',
        y: lastEl.bounds.y + lastEl.bounds.height + 20,
        insertIndex: elements.length
      });
    }
    
    setDropZones(zones);
  }, []);

  const checkForReorder = useCallback(() => {
    if (!draggingElement || dropZones.length === 0) return;
    
    const dragY = draggingElement.bounds.y + draggingElement.bounds.height / 2;
    
    // Find the closest drop zone
    let closestZone = null;
    let minDistance = Infinity;
    
    dropZones.forEach(zone => {
      const distance = Math.abs(zone.y - dragY);
      if (distance < minDistance && distance < 30) { // 30px tolerance
        minDistance = distance;
        closestZone = zone;
      }
    });
    
    if (closestZone) {
      console.log('EnhancedPdfEditor: Reordering element', { 
        elementId: draggingElement.id, 
        newIndex: closestZone.insertIndex 
      });
      
      // Trigger reorder
      reorderElements(draggingElement.id, closestZone.insertIndex);
    }
  }, []);

  const reorderElements = useCallback(async (elementId, newIndex) => {
    if (!document || !document.pages[currentPage]) return;
    
    try {
      // Call API to reorder elements
      await apiCall(`/documents/${document.id}/pages/${document.pages[currentPage].id}/elements/reorder`, {
        method: 'POST',
        body: JSON.stringify({
          elementId,
          newIndex
        })
      });
      
      // Refresh document
      const updatedDoc = await apiCall(`/documents/${document.id}`);
      setDocument(updatedDoc.document);
      
    } catch (error) {
      console.error('Failed to reorder elements:', error);
    }
  }, []);

  // Mouse event handlers for global resize and drag
  useEffect(() => {
    if (resizingElement) {
      window.document.addEventListener('mousemove', handleResizeMove);
      window.document.addEventListener('mouseup', handleResizeEnd);
      window.document.body.style.cursor = 'nw-resize';
      
      return () => {
        window.document.removeEventListener('mousemove', handleResizeMove);
        window.document.removeEventListener('mouseup', handleResizeEnd);
        window.document.body.style.cursor = 'default';
      };
    } else if (draggingElement) {
      window.document.addEventListener('mousemove', handleDragMove);
      window.document.addEventListener('mouseup', handleDragEnd);
      window.document.body.style.cursor = 'move';
      
      return () => {
        window.document.removeEventListener('mousemove', handleDragMove);
        window.document.removeEventListener('mouseup', handleDragEnd);
        window.document.body.style.cursor = 'default';
      };
    }
  }, [resizingElement, draggingElement, handleResizeMove, handleResizeEnd, handleDragMove, handleDragEnd]);

  // API base URL
  const API_BASE = '/api/enhanced-pdf';

  // API calls (moved up to fix reference error)
  const apiCall = useCallback(async (endpoint, options = {}) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }, [API_BASE]);

  // Update element function (moved up to fix reference error)
  const updateElement = async (elementId, updates) => {
    if (!document || !document.pages[currentPage]) return;
    
    try {
      const response = await apiCall(`/documents/${document.id}/pages/${document.pages[currentPage].id}/elements/${elementId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      
      if (response.success) {
        // Update local state
        setDocument(prev => {
          const newDoc = { ...prev };
          const page = newDoc.pages[currentPage];
          const elementIndex = page.elements.findIndex(el => el.id === elementId);
          if (elementIndex !== -1) {
            page.elements[elementIndex] = { ...page.elements[elementIndex], ...updates };
          }
          return newDoc;
        });
      }
    } catch (error) {
      console.error('Failed to update element:', error);
      setError('Failed to update element');
    }
  };

  // Load conversation data to get folder for media paths
  const loadConversationData = useCallback(async (convId) => {
    if (!convId) return;
    
    try {
      console.log('EnhancedPdfEditor: Loading conversation data for:', convId);
      const response = await fetch(`/api/conversations/${convId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('EnhancedPdfEditor: Conversation data loaded:', {
          id: data.id,
          folder: data.folder,
          title: data.title
        });
        setConversationData(data);
        return data;
      } else {
        console.warn('EnhancedPdfEditor: Failed to load conversation data:', response.status);
        return null;
      }
    } catch (error) {
      console.error('EnhancedPdfEditor: Error loading conversation data:', error);
      return null;
    }
  }, []);

  // Image proxy helper function
  const proxyImageUrl = async (originalUrl) => {
    try {
      console.log('EnhancedPdfEditor: Proxying image URL:', originalUrl);
      
      const response = await fetch(`${API_BASE}/images/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: originalUrl })
      });

      if (!response.ok) {
        throw new Error(`Proxy request failed: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        console.log('EnhancedPdfEditor: Image proxied successfully:', result.data.proxyUrl);
        return result.data.proxyUrl;
      } else {
        throw new Error(result.error || 'Failed to proxy image');
      }
    } catch (error) {
      console.error('EnhancedPdfEditor: Image proxy failed:', error);
      return null;
    }
  };

  // Initialize editor
  useEffect(() => {
    const source = searchParams.get('source');
    console.log('EnhancedPdfEditor: useEffect initialization', {
      conversationId,
      source,
      searchParams: Object.fromEntries(searchParams.entries()),
      currentURL: window.location.href
    });
    
    if (source === 'collected') {
      console.log('EnhancedPdfEditor: Taking collected messages path');
      createFromCollectedMessages();
    } else if (conversationId) {
      console.log('EnhancedPdfEditor: Taking single conversation path', { conversationId });
      createFromConversation();
    } else {
      console.log('EnhancedPdfEditor: Taking new document path');
      createNewDocument();
    }
    loadFonts();
  }, [conversationId, searchParams]);

  // Debug document elements
  useEffect(() => {
    if (document && document.pages && document.pages.length > 0) {
      console.log('EnhancedPdfEditor: Document elements analysis', {
        totalPages: document.pages.length,
        currentPage: currentPage,
        currentPageElements: document.pages[currentPage]?.elements?.length || 0
      });
      
      // Check for image elements across all pages
      let totalImageElements = 0;
      document.pages.forEach((page, pageIndex) => {
        const imageElements = page.elements.filter(el => el.type === 'image');
        totalImageElements += imageElements.length;
        
        if (imageElements.length > 0) {
          console.log(`EnhancedPdfEditor: Found ${imageElements.length} image elements on page ${pageIndex + 1}`, {
            imageElements: imageElements.map(el => ({
              id: el.id,
              url: el.content?.url,
              bounds: el.bounds,
              hasContent: !!el.content,
              contentKeys: el.content ? Object.keys(el.content) : null
            }))
          });
        }
      });
      
      console.log('EnhancedPdfEditor: Total image elements in document:', totalImageElements);
    }
  }, [document, currentPage]);



  const createNewDocument = async () => {
    setLoading(true);
    try {
      const response = await apiCall('/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: 'New Document',
          size: 'A4',
          orientation: 'portrait'
        })
      });
      setDocument(response.document);
      setSuccess('Document created successfully');
    } catch (error) {
      setError('Failed to create document');
    } finally {
      setLoading(false);
    }
  };

  const createFromConversation = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('EnhancedPdfEditor: Creating document from conversation', { conversationId });
      
      // Load conversation data for media paths
      await loadConversationData(conversationId);
      
      const response = await apiCall(`/from-conversation/${conversationId}`, {
        method: 'POST',
        body: JSON.stringify({
          template: 'conversation',
          options: { includeMetadata: true }
        })
      });
      
      console.log('EnhancedPdfEditor: Conversation import response', {
        success: response.success,
        documentId: response.document?.id,
        pageCount: response.document?.pages?.length,
        elementsOnFirstPage: response.document?.pages?.[0]?.elements?.length
      });
      
      if (!response.success || !response.document) {
        throw new Error('Invalid response from conversation import');
      }
      
      // Reload the document from server to ensure it's fresh and complete
      console.log('EnhancedPdfEditor: Reloading document from server for verification');
      const reloadedDoc = await apiCall(`/documents/${response.document.id}`);
      
      console.log('EnhancedPdfEditor: Reloaded document', {
        documentId: reloadedDoc.document?.id,
        pageCount: reloadedDoc.document?.pages?.length,
        elementsOnFirstPage: reloadedDoc.document?.pages?.[0]?.elements?.length,
        firstElementContent: reloadedDoc.document?.pages?.[0]?.elements?.[0]?.content?.substring(0, 100)
      });
      
      setDocument(reloadedDoc.document);
      setCurrentPage(0); // Reset to first page
      setSelectedElement(null); // Clear any selection
      
      setSuccess(`Document created from conversation with ${reloadedDoc.document.pages?.[0]?.elements?.length || 0} elements`);
    } catch (error) {
      console.error('EnhancedPdfEditor: Failed to create document from conversation', error);
      setError(`Failed to create document from conversation: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createFromCollectedMessages = async () => {
    setLoading(true);
    try {
      // Get collected messages from sessionStorage
      const collectedMessages = JSON.parse(sessionStorage.getItem('documentBuilder_messages') || '[]');
      const collectedConversations = JSON.parse(sessionStorage.getItem('documentBuilder_conversations') || '[]');
      
      console.log('EnhancedPdfEditor: createFromCollectedMessages', {
        collectedMessagesLength: collectedMessages.length,
        collectedConversationsLength: collectedConversations.length,
        sessionStorageKeys: Object.keys(sessionStorage),
        collectedMessagesPreview: collectedMessages.slice(0, 3).map(m => ({
          id: m.id,
          conversationId: m.conversationId,
          hasContent: !!m.content
        }))
      });
      
      if (collectedMessages.length === 0) {
        console.error('EnhancedPdfEditor: No collected messages found in sessionStorage');
        throw new Error('No collected messages found');
      }

      // Create a new document
      const response = await apiCall('/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: `Collected Messages Document (${collectedConversations.length} conversations)`,
          template: 'multi-conversation',
          pageFormat: 'A4'
        })
      });

      // Process collected messages into document elements
      let yPosition = 100;
      const pageWidth = 595;
      const pageHeight = 842; // A4 height in points
      const margins = { left: 72, right: 72, top: 72, bottom: 72 };
      const contentWidth = pageWidth - margins.left - margins.right;
      const maxContentHeight = pageHeight - margins.top - margins.bottom;
      let currentPageIndex = 0;
      
      // Helper function to create new page when content overflows
      const createNewPageIfNeeded = async (requiredHeight = 50) => {
        if (yPosition + requiredHeight > maxContentHeight) {
          console.log('EnhancedPdfEditor: Creating new page due to content overflow', {
            currentYPosition: yPosition,
            requiredHeight,
            maxContentHeight,
            currentPageIndex
          });
          
          // Add new page to document
          const newPageResponse = await apiCall(`/documents/${response.document.id}/pages`, {
            method: 'POST',
            body: JSON.stringify({
              size: 'A4',
              orientation: 'portrait',
              margins: margins,
              background: { color: '#ffffff' }
            })
          });
          
          // Add delay after page creation
          await delay(200);
          
          if (newPageResponse.success) {
            response.document.pages.push(newPageResponse.page);
            currentPageIndex = response.document.pages.length - 1;
            yPosition = margins.top + 20; // Reset Y position for new page
            console.log('EnhancedPdfEditor: New page created successfully', {
              newPageId: newPageResponse.page.id,
              currentPageIndex,
              resetYPosition: yPosition
            });
          }
        }
      };

      // Group messages by conversation
      const messagesByConversation = collectedMessages.reduce((acc, message) => {
        if (!acc[message.conversationId]) {
          acc[message.conversationId] = {
            title: message.conversationTitle,
            messages: []
          };
        }
        acc[message.conversationId].messages.push(message);
        return acc;
      }, {});

      // Add content for each conversation
      for (const [conversationId, convData] of Object.entries(messagesByConversation)) {
        // Load conversation data for media paths
        const currentConversationData = await loadConversationData(conversationId);
        
        // Add conversation title
        try {
          await createNewPageIfNeeded(35); // Check if we need new page for title
          
          console.log('EnhancedPdfEditor: Adding conversation title element', {
            conversationId,
            title: convData.title,
            yPosition,
            documentId: response.document.id,
            pageId: response.document.pages[currentPageIndex].id,
            currentPageIndex
          });
          
          const titleResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
            method: 'POST',
            body: JSON.stringify({
              type: 'text',
              content: convData.title,
              bounds: { x: margins.left, y: yPosition, width: contentWidth, height: 25 },
              style: {
                fontFamily: 'Helvetica',
                fontSize: 16,
                fontWeight: 'bold',
                color: '#1976D2'
              }
            })
          });
          
          // Add delay to prevent rate limiting
          await delay(150);
          
          console.log('EnhancedPdfEditor: Conversation title element added successfully', {
            response: titleResponse,
            success: titleResponse.success
          });
        } catch (error) {
          console.error('EnhancedPdfEditor: Failed to add conversation title element', {
            error: error.message,
            conversationId,
            title: convData.title
          });
        }
        yPosition += 35;

        // Add messages
        console.log('EnhancedPdfEditor: Processing messages for conversation', {
          conversationId,
          messageCount: convData.messages.length,
          messages: convData.messages.slice(0, 3).map(m => ({
            id: m.id,
            hasContent: !!m.content,
            contentType: typeof m.content,
            hasParts: !!(m.content && m.content.parts),
            partsLength: m.content?.parts?.length,
            authorRole: m.author?.role,
            actualContent: JSON.stringify(m.content, null, 2),
            messageStructure: Object.keys(m)
          }))
        });
        
        for (const message of convData.messages) {
          console.log('EnhancedPdfEditor: Processing individual message', {
            messageId: message.id,
            hasContent: !!message.message?.content,
            contentStructure: message.message?.content ? Object.keys(message.message.content) : null,
            hasParts: !!(message.message?.content && message.message.content.parts),
            partsCount: message.message?.content?.parts?.length || 0,
            parts: message.message?.content?.parts?.slice(0, 2), // First 2 parts for debugging
            authorRole: message.message?.author?.role
          });
          
          if (message.message?.content && message.message.content.parts) {
            console.log('EnhancedPdfEditor: Message has content and parts, processing...');
            for (const part of message.message.content.parts) {
              console.log('EnhancedPdfEditor: Processing message part', {
                partType: typeof part,
                isString: typeof part === 'string',
                hasContent: typeof part === 'string' && part.trim().length > 0,
                partLength: typeof part === 'string' ? part.length : 'not string',
                partPreview: typeof part === 'string' ? part.substring(0, 100) + '...' : part,
                isImageAsset: part && typeof part === 'object' && part.content_type === 'image_asset_pointer',
                hasAssetPointer: part && typeof part === 'object' && part.asset_pointer,
                contentType: part && typeof part === 'object' ? part.content_type : null,
                objectKeys: part && typeof part === 'object' ? Object.keys(part) : null,
                fullObject: part && typeof part === 'object' ? JSON.stringify(part, null, 2) : null
              });
              
              // Handle image content - check for local file IDs from asset_pointer
              if (part && typeof part === 'object' && 
                  part.content_type === 'image_asset_pointer' && part.asset_pointer) {
                
                console.log('EnhancedPdfEditor: Local image detected!', {
                  contentType: part.content_type,
                  assetPointer: part.asset_pointer,
                  width: part.width,
                  height: part.height,
                  imageData: JSON.stringify(part, null, 2)
                });
                try {
                  const imageHeight = 200; // Standard image height
                  await createNewPageIfNeeded(imageHeight + 30);
                  
                  // Extract file ID from asset_pointer and create local media path
                  const fileMatch = part.asset_pointer.match(/([^/\\]+)$/);
                  const fileId = fileMatch ? fileMatch[1] : part.asset_pointer;
                  const localImageUrl = `/api/media/${currentConversationData?.folder || conversationId}/${fileId}`;
                  const imageWidth = part.width || 400;
                  const sourceImageHeight = part.height || 300;
                  
                  console.log('EnhancedPdfEditor: Processing local image element', {
                    messageId: message.id,
                    fileId: fileId,
                    localImageUrl: localImageUrl,
                    imageWidth: imageWidth,
                    imageHeight: sourceImageHeight,
                    yPosition,
                    currentPageIndex,
                    conversationFolder: currentConversationData?.folder || conversationId
                  });
                  
                  const imageResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
                    method: 'POST',
                    body: JSON.stringify({
                      type: 'image',
                      content: {
                        url: localImageUrl,
                        fileId: fileId,
                        originalWidth: imageWidth,
                        originalHeight: sourceImageHeight,
                        isLocal: true
                      },
                      bounds: { 
                        x: margins.left, 
                        y: yPosition, 
                        width: Math.min(contentWidth, imageWidth || 400),
                        height: imageHeight 
                      },
                      style: {
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }
                    })
                  });
                  
                  console.log('EnhancedPdfEditor: Image element added successfully', {
                    response: imageResponse,
                    success: imageResponse.success,
                    elementId: imageResponse.element?.id
                  });

                  yPosition += imageHeight + 15;
                  
                } catch (error) {
                  console.error('EnhancedPdfEditor: Failed to add image element', {
                    error: error.message,
                    messageId: message.id,
                    fileId: fileId,
                    localImageUrl: localImageUrl,
                    partData: JSON.stringify(part, null, 2)
                  });
                }
              }
              // Handle code blocks
              else if (typeof part === 'string' && part.trim() && (part.includes('```') || part.match(/^\s*```/m))) {
                try {
                  // Detect and process code blocks
                  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
                  const parts = [];
                  let lastIndex = 0;
                  let match;
                  
                  while ((match = codeBlockRegex.exec(part)) !== null) {
                    // Add text before code block
                    if (match.index > lastIndex) {
                      const textBefore = part.substring(lastIndex, match.index).trim();
                      if (textBefore) {
                        parts.push({ type: 'text', content: textBefore });
                      }
                    }
                    
                    // Add code block
                    const language = match[1] || 'text';
                    const codeContent = match[2];
                    parts.push({ type: 'code', content: codeContent, language });
                    
                    lastIndex = match.index + match[0].length;
                  }
                  
                  // Add remaining text after last code block
                  if (lastIndex < part.length) {
                    const textAfter = part.substring(lastIndex).trim();
                    if (textAfter) {
                      parts.push({ type: 'text', content: textAfter });
                    }
                  }
                  
                  // If no code blocks found, treat as regular text
                  if (parts.length === 0) {
                    parts.push({ type: 'text', content: part.trim() });
                  }
                  
                  // Process each part
                  for (const partItem of parts) {
                    if (partItem.type === 'code') {
                      // Add role header for code blocks
                      const roleText = message.message?.author?.role === 'user' ? 'User:' : 'Assistant:';
                      await createNewPageIfNeeded(25);
                      
                      const roleResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
                        method: 'POST',
                        body: JSON.stringify({
                          type: 'text',
                          content: roleText,
                          bounds: { x: margins.left, y: yPosition, width: contentWidth, height: 20 },
                          style: {
                            fontFamily: 'Helvetica',
                            fontSize: 12,
                            fontWeight: 'bold',
                            color: message.message?.author?.role === 'user' ? '#2E7D32' : '#1976D2'
                          }
                        })
                      });
                      yPosition += 25;
                      
                      // Calculate code block height
                      const codeLines = partItem.content.split('\n');
                      const codeHeight = Math.max(40, codeLines.length * 14 + 20);
                      
                      await createNewPageIfNeeded(codeHeight + 20);
                      
                      console.log('EnhancedPdfEditor: Adding code block element', {
                        messageId: message.id,
                        language: partItem.language,
                        lineCount: codeLines.length,
                        codeHeight,
                        yPosition,
                        currentPageIndex
                      });
                      
                      const codeResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
                        method: 'POST',
                        body: JSON.stringify({
                          type: 'text',
                          content: partItem.content,
                          bounds: { x: margins.left, y: yPosition, width: contentWidth, height: codeHeight },
                          style: {
                            fontFamily: 'Courier',
                            fontSize: 9,
                            color: '#000000',
                            backgroundColor: '#f5f5f5',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            padding: '8px',
                            whiteSpace: 'pre',
                            overflow: 'auto'
                          }
                        })
                      });
                      
                      console.log('EnhancedPdfEditor: Code block element added successfully', {
                        response: codeResponse,
                        success: codeResponse.success,
                        elementId: codeResponse.element?.id,
                        language: partItem.language
                      });

                      yPosition += codeHeight + 15;
                      
                    } else if (partItem.type === 'text') {
                      // Process as regular text (reuse existing text processing logic)
                      const roleText = message.message?.author?.role === 'user' ? 'User:' : 'Assistant:';
                      await createNewPageIfNeeded(25);
                      
                      const roleResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
                        method: 'POST',
                        body: JSON.stringify({
                          type: 'text',
                          content: roleText,
                          bounds: { x: margins.left, y: yPosition, width: contentWidth, height: 20 },
                          style: {
                            fontFamily: 'Helvetica',
                            fontSize: 12,
                            fontWeight: 'bold',
                            color: message.message?.author?.role === 'user' ? '#2E7D32' : '#1976D2'
                          }
                        })
                      });
                      yPosition += 25;
                      
                      // Process text content as single block
                      const textContent = partItem.content.trim();
                      const estimatedLines = Math.ceil(textContent.length / 80);
                      const textHeight = Math.max(40, estimatedLines * 14);
                      
                      await createNewPageIfNeeded(textHeight + 15);
                      
                      const contentResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
                        method: 'POST',
                        body: JSON.stringify({
                          type: 'text',
                          content: textContent,
                          bounds: { x: margins.left, y: yPosition, width: contentWidth, height: textHeight },
                          style: {
                            fontFamily: 'Helvetica',
                            fontSize: 11,
                            color: '#000000',
                            lineHeight: 1.4,
                            whiteSpace: 'pre-wrap'
                          }
                        })
                      });
                      
                      // Add delay between content blocks
                      await delay(75);

                      yPosition += textHeight + 15;
                    }
                  }
                  
                } catch (error) {
                  console.error('EnhancedPdfEditor: Failed to process code block content', {
                    error: error.message,
                    messageId: message.id,
                    contentLength: part.length
                  });
                }
              }
              // Handle regular text content
              else if (typeof part === 'string' && part.trim()) {
                // Add role header
                const roleText = message.message?.author?.role === 'user' ? 'User:' : 'Assistant:';
                try {
                  await createNewPageIfNeeded(25); // Check if we need new page for role header
                  
                  console.log('EnhancedPdfEditor: Adding role header element', {
                    roleText,
                    messageId: message.id,
                    authorRole: message.message?.author?.role,
                    yPosition,
                    currentPageIndex
                  });
                  
                  const roleResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
                    method: 'POST',
                    body: JSON.stringify({
                      type: 'text',
                      content: roleText,
                      bounds: { x: margins.left, y: yPosition, width: contentWidth, height: 20 },
                      style: {
                        fontFamily: 'Helvetica',
                        fontSize: 12,
                        fontWeight: 'bold',
                        color: message.message?.author?.role === 'user' ? '#2E7D32' : '#1976D2'
                      }
                    })
                  });
                  
                  // Add delay between API calls
                  await delay(100);
                  
                  console.log('EnhancedPdfEditor: Role header element added successfully', {
                    response: roleResponse,
                    success: roleResponse.success
                  });
                } catch (error) {
                  console.error('EnhancedPdfEditor: Failed to add role header element', {
                    error: error.message,
                    roleText,
                    messageId: message.id
                  });
                }
                yPosition += 20;

                // Combine content into larger blocks to reduce API calls
                const fullContent = part.trim();
                const estimatedLines = Math.ceil(fullContent.length / 80);
                const contentHeight = Math.max(60, estimatedLines * 14);
                
                try {
                  await createNewPageIfNeeded(contentHeight + 20);
                  
                  console.log('EnhancedPdfEditor: Adding combined message content', {
                    messageId: message.id,
                    contentLength: fullContent.length,
                    estimatedLines,
                    contentHeight,
                    yPosition,
                    currentPageIndex
                  });
                  
                  const contentResponse = await apiCall(`/documents/${response.document.id}/pages/${response.document.pages[currentPageIndex].id}/elements`, {
                    method: 'POST',
                    body: JSON.stringify({
                      type: 'text',
                      content: fullContent,
                      bounds: { x: margins.left, y: yPosition, width: contentWidth, height: contentHeight },
                      style: {
                        fontFamily: 'Helvetica',
                        fontSize: 11,
                        color: '#000000',
                        lineHeight: 1.4,
                        whiteSpace: 'pre-wrap'
                      }
                    })
                  });
                  
                  // Add delay between major content blocks
                  await delay(100);
                  
                  console.log('EnhancedPdfEditor: Combined content element added successfully', {
                    response: contentResponse,
                    success: contentResponse.success,
                    elementId: contentResponse.element?.id
                  });

                  yPosition += contentHeight + 20;
                  
                } catch (error) {
                  console.error('EnhancedPdfEditor: Failed to add combined content element', {
                    error: error.message,
                    messageId: message.id,
                    contentLength: fullContent.length
                  });
                }
              }
            }
          }
        }
        yPosition += 30; // Space between conversations
      }

      // Get updated document
      try {
        console.log('EnhancedPdfEditor: Fetching updated document after element creation');
        const updatedDoc = await apiCall(`/documents/${response.document.id}`);
        console.log('EnhancedPdfEditor: Updated document fetched', {
          documentId: updatedDoc.document.id,
          elementsCount: updatedDoc.document.pages[0]?.elements?.length || 0,
          elements: updatedDoc.document.pages[0]?.elements?.map(e => ({
            id: e.id,
            type: e.type,
            content: e.content?.substring(0, 50) + '...'
          })) || []
        });
        setDocument(updatedDoc.document);
        setSuccess(`Document created with ${collectedMessages.length} messages from ${collectedConversations.length} conversations`);
      } catch (error) {
        console.error('EnhancedPdfEditor: Failed to fetch updated document', {
          error: error.message,
          documentId: response.document.id
        });
        // Still set the original document if update fetch fails
        setDocument(response.document);
        setSuccess(`Document created with ${collectedMessages.length} messages (may need refresh)`);
      }
      
      // Clear collected messages
      console.log('EnhancedPdfEditor: Clearing sessionStorage after successful import');
      sessionStorage.removeItem('documentBuilder_messages');
      sessionStorage.removeItem('documentBuilder_conversations');
      
    } catch (error) {
      setError('Failed to create document from collected messages: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFonts = async () => {
    try {
      const response = await apiCall('/fonts');
      setAvailableFonts(response.fonts);
    } catch (error) {
      setError('Failed to load fonts');
    }
  };

  // Check server connectivity
  const checkServerConnectivity = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`, { 
        method: 'GET',
        timeout: 5000 
      });
      return response.ok;
    } catch (error) {
      console.warn('Server connectivity check failed:', error);
      return false;
    }
  };

  const saveDocument = async () => {
    if (!document) {
      setError('No document to save');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('EnhancedPdfEditor: Starting document save (download)', {
        documentId: document.id,
        title: document.metadata.title
      });
      
      // Check server connectivity first
      const serverAvailable = await checkServerConnectivity();
      if (!serverAvailable) {
        throw new Error('Server is not available. Please check your connection and try again.');
      }
      
      // First save to server
      console.log('EnhancedPdfEditor: Saving document to server...');
      await apiCall(`/documents/${document.id}`, {
        method: 'PUT',
        body: JSON.stringify(document)
      });
      
      // Debug: Compare frontend vs backend document state
      console.log('EnhancedPdfEditor: Checking document state before export...');
      const backendDoc = await apiCall(`/documents/${document.id}`);
      
      console.log('EnhancedPdfEditor: Document state comparison', {
        documentId: document.id,
        frontend: {
          pageCount: document.pages?.length || 0,
          elementsOnPage0: document.pages?.[0]?.elements?.length || 0,
          firstElementContent: document.pages?.[0]?.elements?.[0]?.content?.substring(0, 100) || 'none'
        },
        backend: {
          pageCount: backendDoc.document?.pages?.length || 0,
          elementsOnPage0: backendDoc.document?.pages?.[0]?.elements?.length || 0,
          firstElementContent: backendDoc.document?.pages?.[0]?.elements?.[0]?.content?.substring(0, 100) || 'none'
        }
      });
      
      // Then trigger download
      console.log('EnhancedPdfEditor: Requesting PDF export...');
      const response = await fetch(`${API_BASE}/documents/${document.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'pdf', quality: 'high' })
      });
      
      console.log('EnhancedPdfEditor: Save export response', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length')
      });
      
      if (!response.ok) {
        let errorText = `HTTP ${response.status} ${response.statusText}`;
        try {
          const responseText = await response.text();
          if (responseText) errorText = responseText;
        } catch (e) {
          console.warn('Could not read error response:', e);
        }
        throw new Error(`Save failed: ${errorText}`);
      }
      
      const blob = await response.blob();
      console.log('EnhancedPdfEditor: Save blob created', {
        size: blob.size,
        type: blob.type
      });
      
      if (blob.size === 0) {
        throw new Error('Export returned empty file. Please try again.');
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.metadata.title || 'document'}.pdf`;
      a.style.display = 'none';
      window.document.body.appendChild(a);
      
      console.log('EnhancedPdfEditor: Triggering save download', {
        filename: a.download,
        blobSize: blob.size
      });
      
      a.click();
      
      // Clean up
      setTimeout(() => {
        try {
          window.URL.revokeObjectURL(url);
          window.document.body.removeChild(a);
        } catch (cleanupError) {
          console.warn('EnhancedPdfEditor: Cleanup error', cleanupError);
        }
      }, 100);
      
      setSuccess(`Document saved and downloaded as ${a.download}`);
    } catch (error) {
      console.error('EnhancedPdfEditor: Save error', error);
      if (error.message.includes('Server is not available')) {
        setError('Server connection failed. Please ensure the server is running and try again.');
      } else if (error.message.includes('Failed to fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(`Failed to save document: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Page navigation functions
  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setSelectedElement(null); // Clear selection when changing pages
    }
  };

  const goToNextPage = () => {
    if (document && currentPage < document.pages.length - 1) {
      setCurrentPage(currentPage + 1);
      setSelectedElement(null); // Clear selection when changing pages
    }
  };

  const goToPage = (pageNumber) => {
    if (document && pageNumber >= 1 && pageNumber <= document.pages.length) {
      setCurrentPage(pageNumber - 1); // Convert to 0-based index
      setSelectedElement(null); // Clear selection when changing pages
    }
  };

  const addElement = async (elementData) => {
    if (!document || !document.pages[currentPage]) return;
    
    try {
      const response = await apiCall(
        `/documents/${document.id}/pages/${document.pages[currentPage].id}/elements`,
        {
          method: 'POST',
          body: JSON.stringify(elementData)
        }
      );
      
      // Update local state
      const updatedDocument = { ...document };
      updatedDocument.pages[currentPage].elements.push(response.element);
      setDocument(updatedDocument);
      setSelectedElement(response.element);
    } catch (error) {
      setError('Failed to add element');
    }
  };

  const deleteElement = async (elementId) => {
    if (!document || !document.pages[currentPage]) return;
    
    try {
      await apiCall(
        `/documents/${document.id}/pages/${document.pages[currentPage].id}/elements/${elementId}`,
        { method: 'DELETE' }
      );
      
      // Update local state
      const updatedDocument = { ...document };
      updatedDocument.pages[currentPage].elements = updatedDocument.pages[currentPage].elements.filter(
        el => el.id !== elementId
      );
      setDocument(updatedDocument);
      if (selectedElement && selectedElement.id === elementId) {
        setSelectedElement(null);
      }
    } catch (error) {
      setError('Failed to delete element');
    }
  };

  const exportDocument = async (format = 'pdf') => {
    if (!document) {
      setError('No document to export');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('EnhancedPdfEditor: Starting document export', {
        documentId: document.id,
        format,
        title: document.metadata.title
      });
      
      // Check server connectivity first
      const serverAvailable = await checkServerConnectivity();
      if (!serverAvailable) {
        throw new Error('Server is not available. Please check your connection and try again.');
      }
      
      // First ensure document is saved to server
      console.log('EnhancedPdfEditor: Ensuring document is saved to server...');
      await apiCall(`/documents/${document.id}`, {
        method: 'PUT',
        body: JSON.stringify(document)
      });
      
      // Debug: Compare frontend vs backend document state
      console.log('EnhancedPdfEditor: Checking document state before export...');
      const backendDoc = await apiCall(`/documents/${document.id}`);
      
      console.log('EnhancedPdfEditor: Export document state comparison', {
        documentId: document.id,
        frontend: {
          pageCount: document.pages?.length || 0,
          elementsOnPage0: document.pages?.[0]?.elements?.length || 0,
          firstElementContent: document.pages?.[0]?.elements?.[0]?.content?.substring(0, 100) || 'none'
        },
        backend: {
          pageCount: backendDoc.document?.pages?.length || 0,
          elementsOnPage0: backendDoc.document?.pages?.[0]?.elements?.length || 0,
          firstElementContent: backendDoc.document?.pages?.[0]?.elements?.[0]?.content?.substring(0, 100) || 'none'
        }
      });
      
      console.log('EnhancedPdfEditor: Requesting export...');
      const response = await fetch(`${API_BASE}/documents/${document.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, quality: 'high' })
      });
      
      console.log('EnhancedPdfEditor: Export response received', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length')
      });
      
      if (!response.ok) {
        let errorText = `HTTP ${response.status} ${response.statusText}`;
        try {
          const responseText = await response.text();
          if (responseText) errorText = responseText;
        } catch (e) {
          console.warn('Could not read error response:', e);
        }
        console.error('EnhancedPdfEditor: Export failed', { 
          status: response.status, 
          error: errorText 
        });
        throw new Error(`Export failed: ${errorText}`);
      }
      
      const blob = await response.blob();
      console.log('EnhancedPdfEditor: Export blob created', {
        size: blob.size,
        type: blob.type
      });
      
      if (blob.size === 0) {
        throw new Error('Export returned empty file. Please try again.');
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.metadata.title || 'document'}.${format}`;
      a.style.display = 'none';
      window.document.body.appendChild(a);
      
      console.log('EnhancedPdfEditor: Triggering download', {
        filename: a.download,
        blobSize: blob.size
      });
      
      a.click();
      
      // Clean up
      setTimeout(() => {
        try {
          window.URL.revokeObjectURL(url);
          window.document.body.removeChild(a);
        } catch (cleanupError) {
          console.warn('EnhancedPdfEditor: Cleanup error', cleanupError);
        }
      }, 100);
      
      setSuccess(`Document exported successfully as ${a.download}`);
    } catch (error) {
      console.error('EnhancedPdfEditor: Export error', error);
      if (error.message.includes('Server is not available')) {
        setError('Server connection failed. Please ensure the server is running and try again.');
      } else if (error.message.includes('Failed to fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(`Failed to export document: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Tool handlers
  const handleToolSelect = (tool) => {
    setSelectedTool(tool);
    setSelectedElement(null);
  };

  const handleCanvasClick = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if (selectedTool === 'text') {
      addTextElement(x, y);
    } else if (selectedTool === 'rectangle') {
      addShapeElement('rectangle', x, y);
    } else if (selectedTool === 'circle') {
      addShapeElement('circle', x, y);
    }
  };

  const addTextElement = (x, y) => {
    const elementData = {
      type: 'text',
      bounds: { x, y, width: 200, height: 40 },
      content: 'Double-click to edit',
      style: {
        fontFamily: selectedFont,
        fontSize: fontSize,
        fontWeight: fontWeight,
        fontStyle: fontStyle,
        color: textColor,
        textAlign: textAlign
      }
    };
    addElement(elementData);
  };

  const addShapeElement = (shape, x, y) => {
    const elementData = {
      type: 'shape',
      bounds: { x, y, width: 100, height: 100 },
      content: { shape },
      style: {
        fill: '#e3f2fd',
        stroke: '#2196f3',
        strokeWidth: 2
      }
    };
    addElement(elementData);
  };

  // Render methods
  const renderToolbar = () => (
    <Paper elevation={1} sx={{ p: 1, mb: 1 }}>
      <Grid container spacing={1} alignItems="center">
        <Grid item>
          <Button
            variant={selectedTool === 'select' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => handleToolSelect('select')}
          >
            Select
          </Button>
        </Grid>
        <Grid item>
          <IconButton
            color={selectedTool === 'text' ? 'primary' : 'default'}
            onClick={() => handleToolSelect('text')}
          >
            <TextIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <IconButton
            color={selectedTool === 'rectangle' ? 'primary' : 'default'}
            onClick={() => handleToolSelect('rectangle')}
          >
            <RectangleIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <IconButton
            color={selectedTool === 'circle' ? 'primary' : 'default'}
            onClick={() => handleToolSelect('circle')}
          >
            <CircleIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <IconButton onClick={() => fileInputRef.current?.click()}>
            <ImageIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <Divider orientation="vertical" flexItem />
        </Grid>
        <Grid item>
          <Tooltip title="Save & Download PDF">
            <IconButton onClick={saveDocument} disabled={loading}>
              <SaveIcon />
            </IconButton>
          </Tooltip>
        </Grid>
        <Grid item>
          <Tooltip title="Export Options">
            <IconButton onClick={() => setExportDialogOpen(true)} disabled={loading}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Grid>
        <Grid item>
          <Divider orientation="vertical" flexItem />
        </Grid>
        <Grid item>
          <IconButton onClick={() => setZoom(Math.max(25, zoom - 25))}>
            <ZoomOutIcon />
          </IconButton>
        </Grid>
        <Grid item>
          <Typography variant="body2">{zoom}%</Typography>
        </Grid>
        <Grid item>
          <IconButton onClick={() => setZoom(Math.min(400, zoom + 25))}>
            <ZoomInIcon />
          </IconButton>
        </Grid>
      </Grid>
    </Paper>
  );

  const renderCanvas = () => (
    <Box>
      {/* Page indicator */}
      <Box sx={{ mb: 1, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Page {currentPage + 1} {document ? `of ${document.pages.length}` : ''}
        </Typography>
      </Box>
      
      <Paper
        elevation={2}
        sx={{
          height: 800,
          width: '100%',
          position: 'relative',
          overflow: 'auto',
          backgroundColor: '#f5f5f5',
          backgroundImage: showGrid ? 'radial-gradient(circle, #ccc 1px, transparent 1px)' : 'none',
          backgroundSize: showGrid ? '20px 20px' : 'auto'
        }}
        ref={canvasRef}
        onClick={handleCanvasClick}
      >
      {document && document.pages[currentPage] && (
        <Box
          sx={{
            width: 595, // A4 width in points
            height: 842, // A4 height in points
            backgroundColor: 'white',
            margin: '20px auto',
            position: 'relative',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'center top',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            cursor: selectedTool === 'select' ? 'default' : 'crosshair'
          }}
        >
          {/* Render drop zones when dragging */}
          {draggingElement && dropZones.map((zone) => (
            <Box
              key={zone.id}
              sx={{
                position: 'absolute',
                left: 72,
                top: zone.y - 2,
                width: 451,
                height: 4,
                backgroundColor: '#2196f3',
                borderRadius: '2px',
                opacity: 0.7,
                zIndex: 1001
              }}
            />
          ))}
          
          {document.pages[currentPage].elements.map((element) => (
            <Box
              key={element.id}
              sx={{
                position: 'absolute',
                left: element.bounds.x,
                top: element.bounds.y,
                width: element.bounds.width,
                height: element.bounds.height,
                border: selectedElement?.id === element.id ? '2px solid #2196f3' : '1px solid transparent',
                cursor: draggingElement?.id === element.id ? 'move' : 'pointer',
                opacity: draggingElement?.id === element.id ? 0.7 : 1,
                zIndex: draggingElement?.id === element.id ? 1000 : 1,
                ...getElementStyles(element)
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedElement(element);
              }}
              onMouseDown={(e) => {
                if (selectedTool === 'select' && !resizingElement) {
                  handleDragStart(element, e);
                }
              }}
            >
              {renderElementContent(element)}
              {renderResizeHandles(element)}
            </Box>
          ))}
        </Box>
      )}
    </Paper>
    </Box>
  );

  const getElementStyles = (element) => {
    const styles = {};
    
    if (element.type === 'text') {
      styles.fontFamily = element.style?.fontFamily || 'Helvetica';
      styles.fontSize = element.style?.fontSize || 12;
      styles.fontWeight = element.style?.fontWeight || 'normal';
      styles.fontStyle = element.style?.fontStyle || 'normal';
      styles.color = element.style?.color || '#000000';
      styles.textAlign = element.style?.textAlign || 'left';
      styles.display = 'flex';
      styles.alignItems = 'center';
      styles.padding = '4px';
    } else if (element.type === 'shape') {
      styles.backgroundColor = element.style?.fill || 'transparent';
      styles.border = element.style?.stroke ? `${element.style.strokeWidth || 1}px solid ${element.style.stroke}` : 'none';
      if (element.content?.shape === 'circle') {
        styles.borderRadius = '50%';
      }
    }
    
    return styles;
  };

  const renderElementContent = (element) => {
    if (element.type === 'text') {
      const content = element.content || '';
      return (
        <LatexMarkdownRenderer
          style={{
            fontSize: element.style?.fontSize || 12,
            fontFamily: element.style?.fontFamily || 'Helvetica',
            color: element.style?.color || '#000000',
            lineHeight: element.style?.lineHeight || 1.4,
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
            height: '100%'
          }}
        >
          {content}
        </LatexMarkdownRenderer>
      );
    } else if (element.type === 'shape') {
      return null; // Shape styling is handled by CSS
    } else if (element.type === 'image') {
      console.log('EnhancedPdfEditor: Rendering image element', {
        elementId: element.id,
        imageUrl: element.content?.url,
        fileId: element.content?.fileId,
        isLocal: element.content?.isLocal,
        elementContent: element.content,
        hasUrl: !!element.content?.url
      });

      const imageUrl = element.content?.url;
      const fileId = element.content?.fileId;
      const isLocal = element.content?.isLocal;
      
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt="Conversation image"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                borderRadius: element.style?.borderRadius || '4px'
              }}
              onLoad={() => {
                console.log('EnhancedPdfEditor: Image loaded successfully', {
                  elementId: element.id,
                  imageUrl: imageUrl,
                  fileId: fileId,
                  isLocal: isLocal
                });
              }}
              onError={async (e) => {
                console.error('EnhancedPdfEditor: Local image failed to load', {
                  elementId: element.id,
                  imageUrl: imageUrl,
                  fileId: fileId,
                  isLocal: isLocal,
                  error: e.target.error,
                  errorEvent: e
                });
              }}
              crossOrigin="anonymous"
            />
          ) : (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#666',
              fontSize: '12px',
              textAlign: 'center',
              background: '#f5f5f5',
              padding: '10px',
              borderRadius: '4px',
              border: '1px dashed #ccc'
            }}>
              {fileId ? 'Local Image Loading Failed' : 'No Image File'}
              {fileId && (
                <div style={{ marginTop: '5px', fontSize: '10px', color: '#999' }}>
                  File ID: {fileId}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Render resize handles for selected element
  const renderResizeHandles = (element) => {
    if (!selectedElement || selectedElement.id !== element.id) return null;
    
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    
    return handles.map(handle => {
      let style = {
        position: 'absolute',
        width: '8px',
        height: '8px',
        backgroundColor: '#1976d2',
        border: '1px solid #fff',
        borderRadius: '2px',
        cursor: getCursorForHandle(handle),
        zIndex: 1000
      };
      
      // Position handle based on type
      switch (handle) {
        case 'nw':
          style = { ...style, top: '-4px', left: '-4px' };
          break;
        case 'n':
          style = { ...style, top: '-4px', left: '50%', transform: 'translateX(-50%)' };
          break;
        case 'ne':
          style = { ...style, top: '-4px', right: '-4px' };
          break;
        case 'e':
          style = { ...style, right: '-4px', top: '50%', transform: 'translateY(-50%)' };
          break;
        case 'se':
          style = { ...style, bottom: '-4px', right: '-4px' };
          break;
        case 's':
          style = { ...style, bottom: '-4px', left: '50%', transform: 'translateX(-50%)' };
          break;
        case 'sw':
          style = { ...style, bottom: '-4px', left: '-4px' };
          break;
        case 'w':
          style = { ...style, left: '-4px', top: '50%', transform: 'translateY(-50%)' };
          break;
      }
      
      return (
        <div
          key={handle}
          style={style}
          onMouseDown={(e) => handleResizeStart(element, handle, e)}
        />
      );
    });
  };

  // Get cursor style for resize handle
  const getCursorForHandle = (handle) => {
    const cursors = {
      'nw': 'nw-resize',
      'n': 'n-resize',
      'ne': 'ne-resize',
      'e': 'e-resize',
      'se': 'se-resize',
      's': 's-resize',
      'sw': 'sw-resize',
      'w': 'w-resize'
    };
    return cursors[handle] || 'default';
  };

  const renderPropertyPanel = () => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Properties
        </Typography>
        
        {selectedElement ? (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {selectedElement.type === 'text' ? 'Text Element' : 
               selectedElement.type === 'image' ? 'Image Element' : 'Shape Element'}
            </Typography>
            
            {selectedElement.type === 'image' && (
              <Box>
                <TextField
                  label="Image URL"
                  fullWidth
                  margin="dense"
                  value={selectedElement.content?.url || ''}
                  onChange={(e) => {
                    const newUrl = e.target.value;
                    updateElement(selectedElement.id, {
                      content: { 
                        ...selectedElement.content, 
                        url: newUrl,
                        isLocal: newUrl.startsWith('/api/media/')
                      }
                    });
                  }}
                />
                {selectedElement.content?.fileId && (
                  <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                    File ID: {selectedElement.content.fileId}
                    {selectedElement.content?.isLocal && ' (Local Media)'}
                  </Typography>
                )}
                <Typography variant="subtitle2" sx={{ mt: 2 }}>Position</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <TextField
                      label="X Position"
                      type="number"
                      size="small"
                      value={selectedElement.bounds?.x || 0}
                      onChange={(e) => updateElement(selectedElement.id, {
                        bounds: { ...selectedElement.bounds, x: parseInt(e.target.value) }
                      })}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Y Position"
                      type="number"
                      size="small"
                      value={selectedElement.bounds?.y || 0}
                      onChange={(e) => updateElement(selectedElement.id, {
                        bounds: { ...selectedElement.bounds, y: parseInt(e.target.value) }
                      })}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Width"
                      type="number"
                      size="small"
                      value={selectedElement.bounds?.width || 0}
                      onChange={(e) => {
                        const newWidth = parseInt(e.target.value);
                        updateElement(selectedElement.id, {
                          bounds: { ...selectedElement.bounds, width: newWidth }
                        });
                        // Trigger page reflow after manual size change
                        setTimeout(recalculatePageFlow, 100);
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Height"
                      type="number"
                      size="small"
                      value={selectedElement.bounds?.height || 0}
                      onChange={(e) => {
                        const newHeight = parseInt(e.target.value);
                        updateElement(selectedElement.id, {
                          bounds: { ...selectedElement.bounds, height: newHeight }
                        });
                        // Trigger page reflow after manual size change
                        setTimeout(recalculatePageFlow, 100);
                      }}
                    />
                  </Grid>
                </Grid>
                <Grid container spacing={1} sx={{ mt: 1 }}>
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      onClick={() => {
                        const autoHeight = calculateElementHeight(selectedElement);
                        updateElement(selectedElement.id, {
                          bounds: { ...selectedElement.bounds, height: autoHeight }
                        });
                        setTimeout(recalculatePageFlow, 100);
                      }}
                    >
                      Auto-fit Height
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      onClick={() => {
                        recalculatePageFlow();
                      }}
                    >
                      Reflow Page
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            )}
            
            {selectedElement.type === 'text' && (
              <Box>
                <FormControl fullWidth margin="dense">
                  <InputLabel>Font Family</InputLabel>
                  <Select
                    value={selectedElement.style?.fontFamily || 'Helvetica'}
                    onChange={(e) => updateElement(selectedElement.id, {
                      style: { ...selectedElement.style, fontFamily: e.target.value }
                    })}
                  >
                    {availableFonts.map((font) => (
                      <MenuItem key={font.familyName} value={font.familyName}>
                        {font.familyName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <TextField
                  fullWidth
                  margin="dense"
                  label="Font Size"
                  type="number"
                  value={selectedElement.style?.fontSize || 12}
                  onChange={(e) => updateElement(selectedElement.id, {
                    style: { ...selectedElement.style, fontSize: parseInt(e.target.value) }
                  })}
                />
                
                <TextField
                  fullWidth
                  margin="dense"
                  label="Text Color"
                  type="color"
                  value={selectedElement.style?.color || '#000000'}
                  onChange={(e) => updateElement(selectedElement.id, {
                    style: { ...selectedElement.style, color: e.target.value }
                  })}
                />
                
                <TextField
                  fullWidth
                  margin="dense"
                  label="Content"
                  multiline
                  rows={3}
                  value={selectedElement.content || ''}
                  onChange={(e) => updateElement(selectedElement.id, {
                    content: e.target.value
                  })}
                />
              </Box>
            )}
            
            <Box mt={2}>
              <Typography variant="subtitle2">Position</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    label="X"
                    type="number"
                    size="small"
                    value={selectedElement.bounds?.x || 0}
                    onChange={(e) => updateElement(selectedElement.id, {
                      bounds: { ...selectedElement.bounds, x: parseInt(e.target.value) }
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Y"
                    type="number"
                    size="small"
                    value={selectedElement.bounds?.y || 0}
                    onChange={(e) => updateElement(selectedElement.id, {
                      bounds: { ...selectedElement.bounds, y: parseInt(e.target.value) }
                    })}
                  />
                </Grid>
              </Grid>
            </Box>
            
            <Box mt={2}>
              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={() => deleteElement(selectedElement.id)}
              >
                Delete Element
              </Button>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Select an element to edit its properties
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const renderLayerPanel = () => (
    <Card sx={{ height: '100%', backgroundColor: '#ffffff' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ color: '#000000' }}>
          Layers
        </Typography>
        
        {document && document.pages[currentPage] && (
          <List dense>
            {document.pages[currentPage].elements.map((element, index) => (
              <ListItem
                key={element.id}
                selected={selectedElement?.id === element.id}
                onClick={() => setSelectedElement(element)}
                sx={{ 
                  cursor: 'pointer',
                  backgroundColor: selectedElement?.id === element.id ? 'rgba(25, 118, 210, 0.12)' : 'transparent',
                  color: '#000000',
                  '&:hover': {
                    backgroundColor: selectedElement?.id === element.id ? 'rgba(25, 118, 210, 0.2)' : 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                <ListItemIcon sx={{ color: '#000000' }}>
                  {element.type === 'text' ? <TextIcon /> : 
                   element.type === 'image' ? <ImageIcon /> : <RectangleIcon />}
                </ListItemIcon>
                <ListItemText
                  primary={`${element.type} ${index + 1}`}
                  secondary={
                    element.type === 'text' 
                      ? (typeof element.content === 'string' ? element.content.substring(0, 30) + '...' : 'Text element')
                      : element.type === 'shape' 
                      ? (element.content?.shape || 'Shape')
                      : element.type === 'image'
                      ? 'Image'
                      : 'Element'
                  }
                  sx={{ 
                    '& .MuiListItemText-primary': { color: '#000000' },
                    '& .MuiListItemText-secondary': { color: '#666666' }
                  }}
                />
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteElement(element.id);
                  }}
                  sx={{ color: '#666666' }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );

  if (loading && !document) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      {renderToolbar()}
      
      {/* Main editor area */}
      <Box sx={{ flex: 1, display: 'flex', gap: 1 }}>
        {/* Left sidebar - Properties */}
        <Box sx={{ width: 300, display: propertyPanelOpen ? 'block' : 'none' }}>
          {renderPropertyPanel()}
        </Box>
        
        {/* Canvas area */}
        <Box sx={{ flex: 1 }}>
          {renderCanvas()}
        </Box>
        
        {/* Right sidebar - Layers */}
        <Box sx={{ width: 250, display: layerPanelOpen ? 'block' : 'none' }}>
          {renderLayerPanel()}
        </Box>
      </Box>
      
      {/* Status bar */}
      <Paper elevation={1} sx={{ p: 1 }}>
        <Grid container justifyContent="space-between" alignItems="center">
          <Grid item>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={goToPreviousPage}
                disabled={!document || currentPage === 0}
              >
                Previous
              </Button>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2">Page</Typography>
                <TextField
                  size="small"
                  type="number"
                  value={currentPage + 1}
                  onChange={(e) => goToPage(parseInt(e.target.value))}
                  inputProps={{ 
                    min: 1, 
                    max: document?.pages?.length || 1,
                    style: { width: '60px', textAlign: 'center' }
                  }}
                  sx={{ width: '80px' }}
                />
                <Typography variant="body2">
                  of {document ? document.pages.length : 0}
                </Typography>
              </Box>
              
              <Button
                size="small"
                variant="outlined"
                onClick={goToNextPage}
                disabled={!document || currentPage >= (document?.pages?.length - 1)}
              >
                Next
              </Button>
            </Box>
          </Grid>
          <Grid item>
            <FormControlLabel
              control={
                <Switch
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
              }
              label="Grid"
            />
          </Grid>
        </Grid>
      </Paper>
      
      {/* Hidden file input for image uploads */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={(e) => {
          // Handle image upload
          console.log('Image upload:', e.target.files[0]);
        }}
      />
      
      {/* Export Dialog */}
      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Export Document</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Choose the format to export your document:
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Format</InputLabel>
            <Select
              value="pdf"
              label="Format"
              disabled
            >
              <MenuItem value="pdf">PDF (Recommended)</MenuItem>
              <MenuItem value="png" disabled>PNG (Coming Soon)</MenuItem>
              <MenuItem value="html" disabled>HTML (Coming Soon)</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              setExportDialogOpen(false);
              exportDocument('pdf');
            }}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Export PDF'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar notifications */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
      
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EnhancedPdfEditor;