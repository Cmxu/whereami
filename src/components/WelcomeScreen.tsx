import { FC } from 'react';
import { CreatedBy } from './CreatedBy';

interface WelcomeScreenProps {
  onStartGame: (rounds: number) => void;
}

export const WelcomeScreen: FC<WelcomeScreenProps> = ({ onStartGame }) => {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="logo-container">
          <h1 className="game-logo">WhereAmI</h1>
          <p className="tagline">Test your skills by locating where my photos were taken, enjoy the game!</p>
        </div>

        <div className="game-options">
          <div className="option-buttons">
            <button 
              className="option-button quick-game" 
              onClick={() => onStartGame(3)}
            >
              <div className="option-icon">🚀</div>
              <div className="option-text">
                <span className="option-title">Quick Game</span>
                <span className="rounds-info">3 Rounds</span>
              </div>
            </button>
            
            <button 
              className="option-button full-game" 
              onClick={() => onStartGame(10)}
            >
              <div className="option-icon">🌍</div>
              <div className="option-text">
                <span className="option-title">Full Game</span>
                <span className="rounds-info">10 Rounds</span>
              </div>
            </button>
          </div>
        </div>
        
        <div className="welcome-footer">
          <CreatedBy light={true} />
        </div>
      </div>
    </div>
  );
}; 