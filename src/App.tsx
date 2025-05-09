import { useEffect, useState } from 'react';
import './App.css';
import { GameRound } from './components/GameRound';
import { GameResults } from './components/GameResults';
import { WelcomeScreen } from './components/WelcomeScreen';
import { useGame } from './hooks/useGame';
import { Location } from './types';
import { CreatedBy } from './components/CreatedBy';

// Define an interface for the round result data
interface RoundResultData {
  userGuess: Location;
  score: number;
  distance: number;
  formattedDistance: string;
  isLastRound: boolean;
}

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [roundCount, setRoundCount] = useState(3);
  const { gameState, isLoading, error, submitGuess, proceedToNextRound, resetGame } = useGame(roundCount);
  const [roundComplete, setRoundComplete] = useState(false);
  const [roundResultData, setRoundResultData] = useState<RoundResultData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | undefined>(undefined);

  // Handle start game with selected number of rounds
  const handleStartGame = (rounds: number) => {
    setRoundCount(rounds);
    setShowWelcome(false);
    resetGame(rounds); // This will trigger loading the images
  };

  // Reset roundComplete when the current round changes
  useEffect(() => {
    setRoundComplete(false);
    setRoundResultData(null);
    setSelectedLocation(undefined);
  }, [gameState.currentRound]);

  // Prevent scrolling on mount
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle submitting a guess
  const handleSubmitGuess = (location: Location) => {
    const resultData = submitGuess(location);
    if (resultData) {
      setRoundResultData(resultData as RoundResultData);
      setRoundComplete(true);
    }
  };

  // Handle continuing to the next round
  const handleContinue = () => {
    proceedToNextRound();
  };

  // Handle returning to welcome screen
  const handleReturnToWelcome = () => {
    setShowWelcome(true);
  };

  // Handle location selection
  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location);
  };

  // Helper function to get the current header status text
  const getHeaderStatusText = () => {
    if (showWelcome) {
      return "";
    } else if (gameState.gameComplete) {
      return "Final Results";
    } else if (gameState.rounds.length > 0) {
      return `Round ${Math.min(gameState.currentRound + 1, gameState.rounds.length)} / ${gameState.rounds.length}`;
    }
    return "";
  };

  // Helper function to get the appropriate footer button
  const getFooterButton = () => {
    if (showWelcome) {
      return null;
    }
    
    if (gameState.gameComplete) {
      return (
        <button className="main-button play-again-button" onClick={handleReturnToWelcome}>
          Play Again
        </button>
      );
    }
    
    if (roundComplete) {
      return (
        <button 
          className="main-button continue-button"
          onClick={handleContinue}
        >
          {gameState.currentRound === gameState.rounds.length - 1 ? "See Final Results" : "Next Round"}
        </button>
      );
    }
    
    return (
      <button 
        className="main-button submit-button"
        onClick={() => {
          if (selectedLocation) {
            handleSubmitGuess(selectedLocation);
          }
        }}
        disabled={!selectedLocation}
      >
        Submit Guess
      </button>
    );
  };

  if (isLoading && !showWelcome) {
    return (
      <div className="app-wrapper">
        <header className="app-header">
          <div className="header-left">
            <button 
              className="title-button" 
              onClick={handleReturnToWelcome}
              title="Return to Welcome Screen"
            >
              WhereAmI
            </button>
          </div>
          <div className="header-center">
            <p>Loading...</p>
          </div>
          <div className="header-right"></div>
        </header>
        
        <main className="app-main loading">
          <p>Loading game...</p>
        </main>
        
        <footer className="app-footer">
          <div className="footer-left">
            <CreatedBy />
          </div>
          <div className="footer-center"></div>
          <div className="footer-right"></div>
        </footer>
      </div>
    );
  }

  if (error && !showWelcome) {
    return (
      <div className="app-wrapper">
        <header className="app-header">
          <div className="header-left">
            <button 
              className="title-button" 
              onClick={handleReturnToWelcome}
              title="Return to Welcome Screen"
            >
              WhereAmI
            </button>
          </div>
          <div className="header-center">
            <p>Error</p>
          </div>
          <div className="header-right"></div>
        </header>
        
        <main className="app-main error">
          <p>Error: {error}</p>
          <p>Please check the console for more details.</p>
        </main>
        
        <footer className="app-footer">
          <div className="footer-left">
            <CreatedBy />
          </div>
          <div className="footer-center">
            <button className="main-button" onClick={handleReturnToWelcome}>Try Again</button>
          </div>
          <div className="footer-right"></div>
        </footer>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {!showWelcome && (
        <header className="app-header">
          <div className="header-left">
            {!showWelcome && (
              <button 
                className="title-button" 
                onClick={handleReturnToWelcome}
                title="Return to Welcome Screen"
              >
                WhereAmI
              </button>
            )}
          </div>
          <div className="header-center">
            <p className="round-indicator">{getHeaderStatusText()}</p>
          </div>
          <div className="header-right">
            {!showWelcome && (
              <p className="score-display">
                {gameState.gameComplete 
                  ? `Total Score: ${gameState.totalScore} / ${gameState.rounds.length * 10000} (${((gameState.totalScore / (gameState.rounds.length * 10000)) * 100).toFixed(1)}%)`
                  : `Score: ${gameState.totalScore}`
                }
              </p>
            )}
          </div>
        </header>
      )}

      <main className={`app-main ${showWelcome ? 'welcome-main' : ''}`}>
        {showWelcome && (
          <WelcomeScreen onStartGame={handleStartGame} />
        )}

        {!showWelcome && !gameState.gameComplete && gameState.rounds.length > 0 && (
          <GameRound
            round={gameState.rounds[gameState.currentRound]}
            onSubmitGuess={handleLocationSelect}
            roundComplete={roundComplete}
            resultData={roundResultData}
          />
        )}

        {!showWelcome && gameState.gameComplete && (
          <GameResults 
            rounds={gameState.rounds} 
            totalScore={gameState.totalScore}
            onPlayAgain={handleReturnToWelcome}
          />
        )}
      </main>

      {!showWelcome && (
        <footer className="app-footer">
          <div className="footer-left">
            <CreatedBy />
          </div>
          <div className="footer-center">
            {getFooterButton()}
          </div>
          <div className="footer-right"></div>
        </footer>
      )}
    </div>
  );
}

export default App;
