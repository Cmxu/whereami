export interface Location {
  lat: number;
  lng: number;
}

export interface Image {
  id: string;
  src: string;
  location: Location;
}

export interface Round {
  id: number;
  image: Image;
  userGuess?: Location;
  score: number;
  distance?: number;
  formattedDistance?: string;
}

export interface GameState {
  rounds: Round[];
  currentRound: number;
  totalScore: number;
  gameComplete: boolean;
} 