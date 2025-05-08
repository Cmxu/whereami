import React from 'react';
import { CREATOR, APP_VERSION } from '../constants';

interface CreatedByProps {
  className?: string;
  light?: boolean;
}

/**
 * A reusable component for displaying the creator information
 * Props:
 * - className: optional CSS class
 * - light: if true, uses light theme styling (for dark backgrounds)
 */
export const CreatedBy: React.FC<CreatedByProps> = ({ className = 'created-by', light = false }) => {
  return (
    <p className={className}>
      Created by {CREATOR.name} with <a 
        href={CREATOR.toolUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className={light ? 'light-link' : ''}
      >
        {CREATOR.toolName}
      </a>, maps by <a 
        href={CREATOR.mapsUrl} 
        target="_blank" 
        rel="noopener noreferrer" 
        className={light ? 'light-link' : ''}
      >
        {CREATOR.mapsName}
      </a> - V{APP_VERSION}
    </p>
  );
}; 