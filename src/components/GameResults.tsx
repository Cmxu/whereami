import { useState } from 'react';
import { Round } from '../types';
import { Map } from './Map';

interface GameResultsProps {
  rounds: Round[];
  totalScore: number;
  onPlayAgain: () => void;
}

export const GameResults = ({ rounds, totalScore, onPlayAgain }: GameResultsProps) => {
  const [selectedRound, setSelectedRound] = useState(rounds.length > 0 ? rounds[0] : null);
  const [forceUpdateKey, setForceUpdateKey] = useState(0);

  const handleRoundSelect = (roundId: number) => {
    const round = rounds.find(r => r.id === roundId);
    if (round) {
      setSelectedRound(round);
      setForceUpdateKey(prev => prev + 1);
    }
  };

  return (
    <>
      <div className="round-navigation">
        <div className="round-tabs">
          {rounds.map((round) => (
            <button
              key={round.id}
              className={`round-tab ${selectedRound?.id === round.id ? 'active' : ''}`}
              onClick={() => handleRoundSelect(round.id)}
              style={{
                padding: '8px 12px',
                marginRight: '5px',
                backgroundColor: selectedRound?.id === round.id ? '#4a89dc' : '#f5f5f5',
                color: selectedRound?.id === round.id ? 'white' : 'black',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Round {round.id} ({round.score} pts)
            </button>
          ))}
        </div>
      </div>
      
      <div className="game-round final-results">
        {selectedRound && (
          <div className="game-round-content">
            <div className="image-map-container">
              <div className="image-container">
                <div className="image-zoom-container">
                  <div 
                    className="image-wrapper"
                    style={{ 
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                  >
                    <img 
                      src={selectedRound.image.src} 
                      alt={`Round ${selectedRound.id} image`}
                      style={{ 
                        maxWidth: '100%',
                        pointerEvents: 'none'
                      }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="map-container">
                <Map 
                  key={`map-${selectedRound.id}-${forceUpdateKey}`}
                  selectedLocation={selectedRound.userGuess}
                  actualLocation={selectedRound.image.location}
                  showActualLocation={true}
                  showLine={true}
                  onLocationSelect={() => {}} 
                  isGuessingPhase={false}
                  initialExpanded={false}
                  hideExpandButton={true}
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
          </div>
        )}
      </div>
    </>
  );
}; 