import { useState, useEffect, useRef } from 'react';
import { Map } from './Map';
import { Location, Round } from '../types';

// Import RoundResultData interface from App.tsx
interface RoundResultData {
  userGuess: Location;
  score: number;
  distance: number;
  formattedDistance: string;
  isLastRound: boolean;
}

interface GameRoundProps {
  round: Round;
  onSubmitGuess: (location: Location) => void;
  isLastRound: boolean;
  roundComplete: boolean;
  resultData: RoundResultData | null;
  onContinue: () => void;
  roundNumber?: number;
  totalRounds?: number;
  guessLocation?: Location | undefined;
  actualLocation?: Location | undefined;
  score?: number;
  distance?: number | undefined;
  onViewMap?: () => void;
}

export const GameRound = ({ 
  round, 
  onSubmitGuess, 
  isLastRound,
  roundComplete,
  resultData,
  onContinue,
  roundNumber,
  totalRounds,
  guessLocation,
  actualLocation,
  score,
  distance,
  onViewMap
}: GameRoundProps) => {
  const [selectedLocation, setSelectedLocation] = useState<Location | undefined>(round.userGuess);
  const [isGuessing, setIsGuessing] = useState(!roundComplete);
  const [imageError, setImageError] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [startDragPosition, setStartDragPosition] = useState({ x: 0, y: 0 });
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapZoom, setMapZoom] = useState(2);
  const [mapCenter, setMapCenter] = useState({ lat: 0, lng: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Utility function to clamp drag position based on zoom level with a smoother transition
  const clampDragPosition = (x: number, y: number, currentZoom: number): { x: number, y: number } => {
    // If zoom level is 1 (minimum), always center the image
    if (currentZoom <= 1) {
      return { x: 0, y: 0 };
    }
    
    // Calculate the maximum allowed drag distance based on zoom level
    const container = imageContainerRef.current;
    const image = imageRef.current;
    
    if (!container || !image) {
      return { x, y }; // Can't clamp without references
    }
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Calculate the scaled dimensions of the image
    const scaledWidth = image.naturalWidth * currentZoom;
    const scaledHeight = image.naturalHeight * currentZoom;
    
    // Calculate the maximum allowed drag in each direction
    const maxDragX = Math.max(0, (scaledWidth - containerWidth) / 2);
    const maxDragY = Math.max(0, (scaledHeight - containerHeight) / 2);
    
    // Simple clamping to ensure the image stays within the allowed range
    return {
      x: Math.min(maxDragX, Math.max(-maxDragX, x)),
      y: Math.min(maxDragY, Math.max(-maxDragY, y))
    };
  };

  // Reset state when round changes
  useEffect(() => {
    setSelectedLocation(round.userGuess);
    setIsGuessing(!roundComplete);
    setImageError(false);
    // Reset zoom level when toggling map expansion
    setZoomLevel(1);
    setDragPosition({ x: 0, y: 0 });
    // Always reset map zoom to zoomed all the way out (2 is the default minimum zoom)
    setMapZoom(2);
    
    // Set map to expanded view by default when showing results
    if (roundComplete) {
      setIsMapExpanded(true);
    } else {
      setIsMapExpanded(false);
    }
  }, [round, roundComplete]);

  // Handle map expansion state based on screen size
  useEffect(() => {
    const handleResize = () => {
      // For small screens, clicking on the map expands it automatically
      if (window.innerWidth < 768) {
        // Only update when needed to avoid unnecessary renders
        if (!isMapExpanded && !isGuessing) {
          setIsMapExpanded(true);
        }
      }
    };

    // Run once on mount
    handleResize();

    // Add event listener for window resizing
    window.addEventListener('resize', handleResize);
    
    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isMapExpanded, isGuessing]);

  const handleLocationSelect = (location: Location) => {
    if (!isGuessing) return;
    setSelectedLocation(location);
    
    // Immediately pass the selected location to the parent component
    onSubmitGuess(location);
  };

  const handleImageError = () => {
    console.error(`Failed to load image: ${round.image.src}`);
    setImageError(true);
  };

  // Simplified zoom in handler
  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const newZoom = Math.min(prev + 0.2, 10);
      
      // Only update if zoom level actually changed
      if (newZoom !== prev) {
        // When zooming in, scale from the current center point
        const scaleFactor = newZoom / prev;
        
        // Scale drag position relative to current position
        const scaledX = dragPosition.x * scaleFactor;
        const scaledY = dragPosition.y * scaleFactor;
        
        // Ensure image stays in bounds
        const clampedPos = clampDragPosition(scaledX, scaledY, newZoom);
        setDragPosition(clampedPos);
      }
      
      return newZoom;
    });
  };

  // Simplified zoom out handler
  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 0.2, 1);
      
      // Only update if zoom level actually changed
      if (newZoom !== prev) {
        if (newZoom <= 1) {
          // At minimum zoom, always center
          setDragPosition({ x: 0, y: 0 });
        } else {
          // Scale drag position relative to current position 
          const scaleFactor = newZoom / prev;
          
          // When approaching min zoom, gradually reduce drag amount
          const centeringFactor = Math.min(1, Math.max(0, 1 - (newZoom - 1)));
          const scaledX = dragPosition.x * scaleFactor * (1 - centeringFactor);
          const scaledY = dragPosition.y * scaleFactor * (1 - centeringFactor);
          
          // Ensure image stays in bounds
          const clampedPos = clampDragPosition(scaledX, scaledY, newZoom);
          setDragPosition(clampedPos);
        }
      }
      
      return newZoom;
    });
  };

  // Revised wheel handler for smoother zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevent default page scrolling
    
    // Use a smaller zoom step for wheel events to make it smoother
    const zoomStep = 0.1;
    
    // Calculate zoom change - limit the step size for smoother zooming
    const delta = Math.sign(-e.deltaY) * zoomStep;
    const newZoomLevel = Math.max(1, Math.min(10, zoomLevel + delta));
    
    // Only process if zoom level actually changed
    if (newZoomLevel !== zoomLevel) {
      const container = imageContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        
        // Get mouse position relative to container
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Center point of container
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        if (delta > 0) {
          // ZOOMING IN: Focus on the point under the mouse
          const scaleFactor = newZoomLevel / zoomLevel;
          
          // Calculate offsets
          const offsetX = (mouseX - centerX);
          const offsetY = (mouseY - centerY); 
          
          // Calculate new position that keeps the point under the mouse in the same relative position
          const newX = dragPosition.x * scaleFactor + (offsetX * (1 - scaleFactor));
          const newY = dragPosition.y * scaleFactor + (offsetY * (1 - scaleFactor));
          
          // Apply clamping
          const clampedPos = clampDragPosition(newX, newY, newZoomLevel);
          
          // Update state
          setDragPosition(clampedPos);
        } else {
          // ZOOMING OUT: Move gradually toward center
          if (newZoomLevel <= 1) {
            // At minimum zoom, always center
            setDragPosition({ x: 0, y: 0 });
          } else {
            // Scale the position
            const scaleFactor = newZoomLevel / zoomLevel;
            
            // Apply centering factor as we approach zoom level 1
            // This gets stronger as we get closer to zoom level 1
            const centeringFactor = Math.min(1, Math.max(0, 1 - (newZoomLevel - 1)));
            const newX = dragPosition.x * scaleFactor * (1 - centeringFactor);
            const newY = dragPosition.y * scaleFactor * (1 - centeringFactor);
            
            // Apply clamping
            const clampedPos = clampDragPosition(newX, newY, newZoomLevel);
            setDragPosition(clampedPos);
          }
        }
      }
      
      // Update zoom level
      setZoomLevel(newZoomLevel);
    }
    
    e.stopPropagation();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomLevel <= 1) {
      // Don't allow dragging when fully zoomed out
      setDragPosition({ x: 0, y: 0 }); // Ensure position is reset
      return;
    }
    
    setIsDragging(true);
    setStartDragPosition({
      x: e.clientX - dragPosition.x,
      y: e.clientY - dragPosition.y
    });
    
    // Prevent default behavior and text selection during drag
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    const newX = e.clientX - startDragPosition.x;
    const newY = e.clientY - startDragPosition.y;
    
    // Apply clamping when setting the new position
    const clampedPosition = clampDragPosition(newX, newY, zoomLevel);
    setDragPosition(clampedPosition);
    
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle cases where mouse leaves the container while dragging
  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.preventDefault();
    e.stopPropagation();
  };

  // Implement touch support for mobile devices
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (zoomLevel <= 1) {
      // Don't allow dragging when fully zoomed out
      setDragPosition({ x: 0, y: 0 }); // Ensure position is reset
      return;
    }
    
    setIsDragging(true);
    setStartDragPosition({
      x: e.touches[0].clientX - dragPosition.x,
      y: e.touches[0].clientY - dragPosition.y
    });
    e.preventDefault();
    e.stopPropagation();
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    const newX = e.touches[0].clientX - startDragPosition.x;
    const newY = e.touches[0].clientY - startDragPosition.y;
    
    // Apply clamping when setting the new position
    const clampedPosition = clampDragPosition(newX, newY, zoomLevel);
    setDragPosition(clampedPosition);
    
    e.preventDefault();
    e.stopPropagation();
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.preventDefault();
    e.stopPropagation();
  };

  // Apply drag event listeners
  useEffect(() => {
    // Cleanup function to remove event listeners
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    // Add global event listeners to handle mouse up outside the component
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchend', handleGlobalMouseUp);
    
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, []);

  // Add a handler for map expansion state
  const handleMapExpansion = (expanded: boolean) => {
    setIsMapExpanded(expanded);
  };

  // Add a handler for map zoom changes
  const handleMapZoomChange = (zoom: number) => {
    setMapZoom(zoom);
  };

  // Add a handler for map center changes
  const handleMapCenterChange = (center: { lat: number, lng: number }) => {
    setMapCenter(center);
  };

  if (!round || !round.image) {
    return <div>Loading round data...</div>;
  }

  // Show results view if round is complete and result data is available
  if (roundComplete && resultData) {
    return (
      <div className="game-round">
        <div className="game-round-content">
          {/* Show image container in full size when map is not expanded */}
          {!isMapExpanded && (
            <div className="image-container" ref={imageContainerRef} onWheel={handleWheel}>
              {imageError ? (
                <div className="image-error">
                  <p>Failed to load image. Using placeholder.</p>
                  <div className="placeholder-image">
                    Image {round.id}
                  </div>
                </div>
              ) : (
                <div 
                  className="image-zoom-container"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  style={{ cursor: zoomLevel > 1 ? 'grab' : 'default' }}
                >
                  <div 
                    className="image-wrapper"
                    style={{ 
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'center center',
                      transition: isDragging ? 'none' : 'transform 0.2s ease-out, left 0.2s ease-out, top 0.2s ease-out',
                      position: 'relative',
                      left: `${dragPosition.x}px`,
                      top: `${dragPosition.y}px`
                    }}
                  >
                    <img 
                      ref={imageRef}
                      src={round.image.src} 
                      alt={`Round ${round.id} image`}
                      onError={handleImageError}
                      style={{ 
                        maxWidth: '100%',
                        pointerEvents: 'none'
                      }}
                    />
                  </div>

                  {/* Add zoom controls */}
                  <div className="zoom-controls">
                    <button className="zoom-button" onClick={handleZoomIn} title="Zoom In">+</button>
                    <button className="zoom-button" onClick={handleZoomOut} title="Zoom Out">-</button>
                  </div>

                  {/* Add the map overlay for guessing phase */}
                  <div className="map-overlay" style={{ width: '350px', height: '350px' }}>
                    <Map 
                      selectedLocation={selectedLocation}
                      actualLocation={round.image.location}
                      showActualLocation={true}
                      showLine={true}
                      onLocationSelect={handleLocationSelect}
                      isGuessingPhase={isGuessing}
                      onExpansionChange={handleMapExpansion}
                      initialExpanded={isMapExpanded}
                      initialZoom={mapZoom}
                      initialCenter={mapCenter}
                      onZoomChange={handleMapZoomChange}
                      onCenterChange={handleMapCenterChange}
                    />
                  </div>
                </div>
              )}
              
              {/* Display the map overlay below the image */}
              <div className="map-overlay" style={{ width: '350px', height: '350px' }}>
                <Map 
                  selectedLocation={selectedLocation}
                  actualLocation={round.image.location}
                  showActualLocation={true}
                  showLine={true}
                  onLocationSelect={handleLocationSelect}
                  isGuessingPhase={isGuessing}
                  onExpansionChange={handleMapExpansion}
                  initialExpanded={isMapExpanded}
                  initialZoom={mapZoom}
                  initialCenter={mapCenter}
                  onZoomChange={handleMapZoomChange}
                  onCenterChange={handleMapCenterChange}
                />
                <div className="location-legend">
                  <div className="legend-item">
                    <div className="legend-marker your-guess"></div>
                    <span>Your guess</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-marker actual-location"></div>
                    <span>Actual location</span>
                  </div>
                </div>
                {/* Add zoom controls */}
                <div className="zoom-controls">
                  <button className="zoom-button" onClick={handleZoomIn} title="Zoom In">+</button>
                  <button className="zoom-button" onClick={handleZoomOut} title="Zoom Out">-</button>
                </div>
              </div>
            </div>
          )}
          
          {/* Show expanded map when the swap button is clicked */}
          {isMapExpanded && (
            <div className="map-container">
              <Map 
                selectedLocation={selectedLocation}
                actualLocation={round.image.location}
                showActualLocation={true}
                showLine={true}
                onLocationSelect={handleLocationSelect}
                isGuessingPhase={isGuessing}
                onExpansionChange={handleMapExpansion}
                initialExpanded={isMapExpanded}
                initialZoom={mapZoom}
                initialCenter={mapCenter}
                onZoomChange={handleMapZoomChange}
                onCenterChange={handleMapCenterChange}
              />
              <div className="location-legend">
                <div className="legend-item">
                  <div className="legend-marker your-guess"></div>
                  <span>Your guess</span>
                </div>
                <div className="legend-item">
                  <div className="legend-marker actual-location"></div>
                  <span>Actual location</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Show image container as small when map is expanded */}
          {isMapExpanded && (
            <div className="image-container-small">
              <div className="image-zoom-container">
                <div className="image-wrapper">
                  <img 
                    src={round.image.src} 
                    alt={`Round ${round.id} image`}
                    style={{ 
                      maxWidth: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Standard guessing view
  return (
    <div className="game-round">
      <div className="game-round-content">
        {/* Show image container in full size when map is not expanded */}
        {!isMapExpanded && (
          <div className="image-container" ref={imageContainerRef} onWheel={handleWheel}>
            {imageError ? (
              <div className="image-error">
                <p>Failed to load image. Using placeholder.</p>
                {/* Display a colored rectangle as a placeholder */}
                <div className="placeholder-image">
                  Image {round.id}
                </div>
              </div>
            ) : (
              <div 
                className="image-zoom-container"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ cursor: zoomLevel > 1 ? 'grab' : 'default' }}
              >
                <div 
                  className="image-wrapper"
                  style={{ 
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.2s ease-out, left 0.2s ease-out, top 0.2s ease-out',
                    position: 'relative',
                    left: `${dragPosition.x}px`,
                    top: `${dragPosition.y}px`
                  }}
                >
                  <img 
                    ref={imageRef}
                    src={round.image.src} 
                    alt={`Round ${round.id} image`}
                    onError={handleImageError}
                    style={{ 
                      maxWidth: '100%',
                      pointerEvents: 'none'
                    }}
                  />
                </div>

                {/* Add zoom controls */}
                <div className="zoom-controls">
                  <button className="zoom-button" onClick={handleZoomIn} title="Zoom In">+</button>
                  <button className="zoom-button" onClick={handleZoomOut} title="Zoom Out">-</button>
                </div>

                {/* Add the map overlay for guessing phase */}
                <div className="map-overlay" style={{ width: '350px', height: '350px' }}>
                  <Map 
                    selectedLocation={selectedLocation}
                    actualLocation={undefined}
                    showActualLocation={false}
                    showLine={false}
                    onLocationSelect={handleLocationSelect}
                    isGuessingPhase={isGuessing}
                    onExpansionChange={handleMapExpansion}
                    initialExpanded={isMapExpanded}
                    initialZoom={mapZoom}
                    initialCenter={mapCenter}
                    onZoomChange={handleMapZoomChange}
                    onCenterChange={handleMapCenterChange}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Show expanded map when the map button is clicked */}
        {isMapExpanded && (
          <div className="map-container">
            <Map 
              selectedLocation={selectedLocation}
              actualLocation={undefined}
              showActualLocation={false}
              showLine={false}
              onLocationSelect={handleLocationSelect}
              isGuessingPhase={isGuessing}
              onExpansionChange={handleMapExpansion}
              initialExpanded={isMapExpanded}
              initialZoom={mapZoom}
              initialCenter={mapCenter}
              onZoomChange={handleMapZoomChange}
              onCenterChange={handleMapCenterChange}
            />
          </div>
        )}
        
        {/* Show small image thumbnail when map is expanded */}
        {isMapExpanded && (
          <div className="image-container-small">
            <div className="image-zoom-container">
              <div className="image-wrapper">
                <img 
                  src={round.image.src} 
                  alt={`Round ${round.id} image`}
                  style={{ 
                    maxWidth: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Helper text */}
        {isGuessing && isMapExpanded && (
          <div className="map-help-text" style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.8)',
            padding: '8px 16px',
            borderRadius: '20px',
            zIndex: 1000,
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
          }}>
            <p style={{ margin: 0 }}>Click on the map to place your guess</p>
          </div>
        )}
      </div>
    </div>
  );
}; 