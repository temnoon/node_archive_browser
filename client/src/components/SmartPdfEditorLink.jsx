import React from 'react';
import { useNavigate } from 'react-router-dom';

const SmartPdfEditorLink = ({ children, onClick, ...props }) => {
  const navigate = useNavigate();

  const handleClick = (e) => {
    e.preventDefault();
    
    // Check if there are collected messages
    const collectedMessages = sessionStorage.getItem('documentBuilder_messages');
    if (collectedMessages && JSON.parse(collectedMessages).length > 0) {
      navigate('/pdf-editor?source=collected');
    } else {
      navigate('/pdf-editor');
    }
    
    // Call any additional onClick handler passed as prop
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <div onClick={handleClick} style={{ cursor: 'pointer' }} {...props}>
      {children}
    </div>
  );
};

export default SmartPdfEditorLink;