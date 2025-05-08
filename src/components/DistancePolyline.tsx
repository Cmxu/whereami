import { Polyline, Tooltip } from 'react-leaflet';
import { Location } from '../types';
import { formatDistance } from '../hooks/useGame';

// Component to display the distance between two locations on the map
interface DistancePolylineProps {
  selectedLocation: Location;
  actualLocation: Location;
}

export const DistancePolyline = ({ 
  selectedLocation, 
  actualLocation 
}: DistancePolylineProps) => {
  // Calculate distance using Haversine formula
  const calculateDistance = () => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371; // Earth's radius in km
    const dLat = toRad(actualLocation.lat - selectedLocation.lat);
    const dLng = toRad(actualLocation.lng - selectedLocation.lng);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(selectedLocation.lat)) * Math.cos(toRad(actualLocation.lat)) * 
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const distance = calculateDistance();
  const formattedDistance = formatDistance(distance);
  
  // Style color based on distance - gradient from red (far) to green (close)
  // Lower distance = better score = more green
  let lineColor = "#e74c3c"; // Default red for far distances
  
  if (distance < 10) { // Very close - within 10km
    lineColor = "#2ecc71"; // Green
  } else if (distance < 100) { // Moderately close - within 100km
    lineColor = "#27ae60"; // Darker green
  } else if (distance < 500) { // Somewhat close - within 500km
    lineColor = "#f39c12"; // Orange
  } else if (distance < 1000) { // Not too far - within 1000km
    lineColor = "#e67e22"; // Darker orange
  }
  
  // Animated rainbow pattern for very close guesses (less than 1km)
  const rainbowDashArray = distance < 1 ? "5, 10" : "";
  const normalDashArray = distance >= 1 ? "10, 15" : "";

  return (
    <Polyline 
      positions={[
        [selectedLocation.lat, selectedLocation.lng], 
        [actualLocation.lat, actualLocation.lng]
      ]}
      color={lineColor}
      opacity={0.8}
      weight={4}
      dashArray={distance < 1 ? rainbowDashArray : normalDashArray}
      className={distance < 1 ? "rainbow-line" : ""}
    >
      <Tooltip direction="center" permanent={true} className="distance-tooltip">
        <div style={{ 
          fontWeight: 'bold', 
          textAlign: 'center',
          fontSize: '14px',
          padding: '2px 4px',
          color: lineColor
        }}>
          {formattedDistance}
        </div>
      </Tooltip>
    </Polyline>
  );
}; 