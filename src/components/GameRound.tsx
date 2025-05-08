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

  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const newZoom = Math.min(prev + 0.2, 10);
      if (newZoom !== prev) {
        // Reset drag position when zooming
        setDragPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      // Set minimum zoom to 1 (100%)
      const newZoom = Math.max(prev - 0.2, 1);
      if (newZoom !== prev) {
        // Reset drag position when zooming
        setDragPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
    // Prevent page scrolling when hovering over the image
    e.stopPropagation();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomLevel <= 1) return; // Only allow dragging when zoomed in
    
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
    
    setDragPosition({ x: newX, y: newY });
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
    if (zoomLevel <= 1) return;
    
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
    
    setDragPosition({ x: newX, y: newY });
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
                      transition: isDragging ? 'none' : 'transform 0.1s ease-out',
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
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
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