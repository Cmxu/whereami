import React, { useEffect, useRef, useCallback, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Location } from '../types';
import L from 'leaflet';
import { formatDistance } from '../hooks/useGame';
import { DistancePolyline } from './DistancePolyline';

// Fix for default marker icons in Leaflet with React
const DefaultIcon = new L.Icon({
  iconUrl: '/markers/marker-icon.png',
  shadowUrl: '/markers/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const GreenIcon = new L.Icon({
  iconUrl: '/markers/marker-icon-green.png',
  shadowUrl: '/markers/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Set default icon for all markers
L.Marker.prototype.options.icon = DefaultIcon;

interface MapClickHandlerProps {
  onLocationSelect: (location: Location) => void;
  isGuessingPhase: boolean;
}

// Component to handle map click events
const MapClickHandler = ({ onLocationSelect, isGuessingPhase }: MapClickHandlerProps) => {
  // Track drag state
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  // Track if we're on a touch device
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  // Detect touch device
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);
  
  const map = useMapEvents({
    // Set flag at the start of drag
    dragstart: () => {
      setIsDragging(true);
      setHasDragged(true);
    },
    // Process click events
    click: (e) => {
      // On touch devices, we'll handle clicks differently to avoid double-fire issues
      if (isTouchDevice) return;
      
      // Only process click if not dragging, not recently dragged, and in guessing phase
      if (onLocationSelect && !isDragging && !hasDragged && isGuessingPhase) {
        onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
    // Reset drag flags when drag ends
    dragend: () => {
      setIsDragging(false);
      // Keep hasDragged true for a short time to prevent click right after drag
      setTimeout(() => {
        setHasDragged(false);
      }, 100);
    },
    // Reset drag flag on mouse up
    mouseup: () => {
      setIsDragging(false);
    },
    // Additional handler for mouse down to reset state on new interactions
    mousedown: () => {
      if (!isDragging) {
        setHasDragged(false);
      }
    }
  });
  
  // Add a custom touch handler
  useEffect(() => {
    if (!map || !isTouchDevice) return;
    
    const handleTouchEnd = (e: TouchEvent) => {
      if (!isDragging && !hasDragged && isGuessingPhase && onLocationSelect) {
        // Get the touch position from the event
        const touch = e.changedTouches[0];
        const containerPoint = new L.Point(touch.clientX, touch.clientY);
        
        // Convert to map point and get latlng
        try {
          const mapEl = map.getContainer();
          const rect = mapEl.getBoundingClientRect();
          const point = new L.Point(
            touch.clientX - rect.left,
            touch.clientY - rect.top
          );
          const latlng = map.containerPointToLatLng(point);
          
          // Call the onLocationSelect with the latlng
          onLocationSelect({ lat: latlng.lat, lng: latlng.lng });
        } catch (err) {
          console.error('Error processing touch event:', err);
        }
      }
    };
    
    // Add touch event listener to the map container
    const container = map.getContainer();
    container.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [map, isDragging, hasDragged, isGuessingPhase, onLocationSelect, isTouchDevice]);
  
  return null;
};

// Component to handle map actions
const MapController = ({ 
  actualLocation,
  showActualLocation, 
  selectedLocation, 
  showLine, 
  initialZoom = 2,
  initialCenter,
  isExpanded
}: { 
  actualLocation?: Location;
  showActualLocation: boolean;
  selectedLocation?: Location;
  showLine?: boolean;
  initialZoom?: number;
  initialCenter?: Location;
  isExpanded?: boolean;
}) => {
  const map = useMap();
  // Track whether locations have been initialized
  const locationInitialized = useRef(false);
  // Track if expansion has occurred
  const wasExpanded = useRef(isExpanded);
  
  useEffect(() => {
    // Always invalidate size when expansion state changes to ensure proper rendering
    map.invalidateSize();
    
    // If this is just an expansion toggle with no location change, preserve the view
    if (isExpanded !== wasExpanded.current && locationInitialized.current) {
      wasExpanded.current = isExpanded;
      return;
    }
    
    // Get the current zoom level, we want to preserve it when possible
    const currentZoom = map.getZoom();
    const targetZoom = currentZoom || initialZoom;
    
    // If we're showing both the actual location and the user's guess with a line
    if (showActualLocation && actualLocation && showLine && selectedLocation) {
      // Create bounds that include both points
      const bounds = L.latLngBounds(
        [actualLocation.lat, actualLocation.lng],
        [selectedLocation.lat, selectedLocation.lng]
      );
      // Add padding for better visualization but don't adjust maxZoom
      map.fitBounds(bounds, { padding: [30, 30] });
      locationInitialized.current = true;
    } 
    // If we're showing the actual location and it's not yet been centered
    else if (showActualLocation && actualLocation && !locationInitialized.current) {
      // Center on the actual location but preserve zoom if possible
      map.setView([actualLocation.lat, actualLocation.lng], targetZoom);
      locationInitialized.current = true;
    } 
    // If we're showing the user's guess and haven't centered yet
    else if (selectedLocation && !locationInitialized.current) {
      // Center on the user guess but preserve zoom if possible
      map.setView([selectedLocation.lat, selectedLocation.lng], targetZoom);
      locationInitialized.current = true;
    } 
    // If we have an initial center and haven't initialized yet
    else if (initialCenter && !locationInitialized.current) {
      // Center on the initial center position
      map.setView([initialCenter.lat, initialCenter.lng], targetZoom);
      locationInitialized.current = true;
    }
    // If no locations are set and the map hasn't been initialized
    else if (!locationInitialized.current) {
      // Initialize to default zoom level but only change zoom, not center
      // This ensures we maintain the current view when expanding the map
      if (currentZoom !== targetZoom) {
        map.setZoom(targetZoom);
      }
      locationInitialized.current = true;
    }
    
    // Update expansion tracking
    wasExpanded.current = isExpanded;
    
  }, [
    map, 
    showActualLocation, 
    actualLocation?.lat, actualLocation?.lng, 
    selectedLocation?.lat, selectedLocation?.lng,
    showLine,
    initialZoom,
    initialCenter?.lat, initialCenter?.lng,
    isExpanded
  ]);
  
  return null;
};


// Add MapDragFix component to ensure drag behavior works properly
const MapDragFix = () => {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;
    
    // Make sure dragging is properly enabled
    map.dragging.enable();
    
    // Disable double click zoom to prevent accidental zooming
    map.doubleClickZoom.disable();
    
    // Handle stuck drags on document level
    const handleMouseUp = () => {
      // Force ending any potential stuck drag operation
      map.fire('mouseup');
      
      // Type-safe way to access internal properties if they exist
      const dragging = map.dragging as any;
      if (dragging._draggable && typeof dragging._draggable._onUp === 'function') {
        dragging._draggable._onUp();
      }
    };
    
    // Handle cases where mouse moved outside map during drag
    const handleMouseMove = (e: MouseEvent) => {
      const mapEl = map.getContainer();
      const rect = mapEl.getBoundingClientRect();
      
      // If mouse is outside the map bounds and a drag might be in progress
      if (
        e.clientX < rect.left || 
        e.clientX > rect.right || 
        e.clientY < rect.top || 
        e.clientY > rect.bottom
      ) {
        // Force end any potential drag
        handleMouseUp();
      }
    };
    
    // Handle touch events more explicitly
    const handleTouchEnd = () => {
      // Force ending any potential stuck drag operation
      map.fire('touchend');
      
      // Type-safe way to access internal properties if they exist
      const dragging = map.dragging as any;
      if (dragging._draggable && typeof dragging._draggable._onUp === 'function') {
        dragging._draggable._onUp();
      }
    };
    
    // Additional touch handler to prevent stuck touch states
    const handleTouchCancel = () => {
      handleTouchEnd();
    };
    
    document.addEventListener('mouseup', handleMouseUp, { capture: true });
    document.addEventListener('touchend', handleTouchEnd, { capture: true });
    document.addEventListener('touchcancel', handleTouchCancel, { capture: true });
    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.removeEventListener('touchend', handleTouchEnd, { capture: true });
      document.removeEventListener('touchcancel', handleTouchCancel, { capture: true });
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [map]);
  
  return null;
};

// Add ZoomTracker component to report zoom level changes back to parent
const ZoomTracker = ({ onZoomChange, onInternalZoomChange }: { 
  onZoomChange?: (zoom: number) => void;
  onInternalZoomChange?: (zoom: number) => void;
}) => {
  const map = useMapEvents({
    zoomend: () => {
      const zoom = map.getZoom();
      if (onZoomChange) onZoomChange(zoom);
      if (onInternalZoomChange) onInternalZoomChange(zoom);
    }
  });
  
  return null;
};

// Add a component to preserve map center and zoom
const CenterAndZoomPreserver = ({ onCenterChange }: { onCenterChange: (center: L.LatLng) => void }) => {
  const map = useMapEvents({
    moveend: () => {
      onCenterChange(map.getCenter());
    }
  });
  
  return null;
};

interface MapProps {
  onLocationSelect: (location: Location) => void;
  selectedLocation?: Location;
  actualLocation?: Location;
  showActualLocation?: boolean;
  showLine?: boolean;
  isGuessingPhase?: boolean;
  onExpansionChange?: (expanded: boolean) => void;
  initialExpanded?: boolean;
  initialZoom?: number;
  initialCenter?: Location;
  onZoomChange?: (zoom: number) => void;
  onCenterChange?: (center: Location) => void;
  hideExpandButton?: boolean;
}

export const Map = ({ 
  onLocationSelect, 
  selectedLocation, 
  actualLocation,
  showActualLocation = false,
  showLine = false,
  isGuessingPhase = true,
  onExpansionChange,
  initialExpanded = false,
  initialZoom = 2,
  initialCenter,
  onZoomChange,
  onCenterChange,
  hideExpandButton = false
}: MapProps) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapCenter, setMapCenter] = useState<L.LatLng>(
    initialCenter ? new L.LatLng(initialCenter.lat, initialCenter.lng) : new L.LatLng(0, 0)
  );
  const [currentZoom, setCurrentZoom] = useState(initialZoom);

  // Update internal state when external expansion state changes
  useEffect(() => {
    if (onExpansionChange) {
      setIsExpanded(initialExpanded);
    }
  }, [initialExpanded, onExpansionChange]);

  // Update internal center when initialCenter changes
  useEffect(() => {
    if (initialCenter) {
      setMapCenter(new L.LatLng(initialCenter.lat, initialCenter.lng));
    }
  }, [initialCenter?.lat, initialCenter?.lng]);

  // Calculate the distance if both points are available
  const calculateDistance = useCallback(() => {
    if (!selectedLocation || !actualLocation) return null;
    
    // Haversine formula to calculate distance between two points
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371; // Earth's radius in km
    const dLat = toRad(actualLocation.lat - selectedLocation.lat);
    const dLng = toRad(actualLocation.lng - selectedLocation.lng);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(selectedLocation.lat)) * Math.cos(toRad(actualLocation.lat)) * 
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  }, [selectedLocation, actualLocation]);

  // Format the distance for display
  const getFormattedDistance = useCallback(() => {
    const distance = calculateDistance();
    if (distance === null) return null;
    return formatDistance(distance);
  }, [calculateDistance]);

  const toggleExpanded = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    
    // Notify parent component of expansion state change
    if (onExpansionChange) {
      onExpansionChange(newExpandedState);
    }
  };

  // Determine map sizing and style 
  const getMapContainerStyle = () => {
    return { 
      height: '100%', 
      width: '100%',
      zIndex: 100
    };
  };

  // Update CenterAndZoomPreserver to call onCenterChange prop
  const handleCenterChange = (center: L.LatLng) => {
    setMapCenter(center);
    if (onCenterChange) {
      onCenterChange({ lat: center.lat, lng: center.lng });
    }
  };

  return (
    <div 
      className="map-wrapper full-size"
      ref={mapContainerRef}
      style={{ height: '100%', width: '100%', position: 'relative' }}
    >
      <style>
        {`
        .distance-tooltip {
          background-color: white;
          border: none;
          border-radius: 10px;
          padding: 4px 8px;
          font-size: 14px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        .distance-tooltip::before {
          display: none;
        }
        `}
      </style>
      {!hideExpandButton && (
        <button 
          className="map-expand-button" 
          onClick={toggleExpanded as any}
          onTouchEnd={(e) => {
            e.stopPropagation();
            toggleExpanded(e);
          }}
          title={isExpanded ? "Show image" : "Show map"}
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            zIndex: 1000,
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 1px 5px rgba(0,0,0,0.2)',
            cursor: 'pointer',
            fontSize: '18px',
            fontWeight: 'bold',
            padding: '0',
            color: 'black'
          }}
        >
          {isExpanded ? "↘" : "↖"}
        </button>
      )}

      <MapContainer 
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={currentZoom}
        style={getMapContainerStyle()}
        worldCopyJump={true}
        dragging={true}
        zoomControl={false}
        scrollWheelZoom={true}
        attributionControl={false}
        doubleClickZoom={false}
      >
        <ZoomTracker 
          onZoomChange={onZoomChange} 
          onInternalZoomChange={setCurrentZoom}
        />
        <CenterAndZoomPreserver onCenterChange={handleCenterChange} />
        <TileLayer
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png"
        />
        
        <MapClickHandler onLocationSelect={onLocationSelect} isGuessingPhase={isGuessingPhase} />
        <MapController 
          actualLocation={actualLocation}
          showActualLocation={showActualLocation}
          selectedLocation={selectedLocation}
          showLine={showLine}
          initialZoom={initialZoom}
          initialCenter={initialCenter}
          isExpanded={isExpanded}
        />
        <MapDragFix />
        
        {selectedLocation && (
          <>
            <Marker position={[selectedLocation.lat, selectedLocation.lng]}>

            </Marker>
          </>
        )}
        
        {showActualLocation && actualLocation && (
          <>
            <Marker 
              position={[actualLocation.lat, actualLocation.lng]} 
              icon={GreenIcon}
            >
              <Popup>
                Actual location
              </Popup>
            </Marker>
            
            {showLine && selectedLocation && actualLocation && (
              <DistancePolyline 
                selectedLocation={selectedLocation}
                actualLocation={actualLocation}
              />
            )}
          </>
        )}
        
      </MapContainer>
    </div>
  );
}; 