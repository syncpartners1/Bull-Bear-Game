// client/src/hooks/useGame.js
// Convenience hook that exposes derived state for components.
import { useGame as useGameContext } from '../context/GameContext.jsx';

export function useGame() {
  const ctx = useGameContext();

  const { gameState, myPlayer } = ctx;

  // Derived values
  const currentPlayer = gameState
    ? gameState.players[gameState.currentPlayerIndex]
    : null;

  const isMyTurn = currentPlayer?.id === myPlayer?.id;

  const myPortfolio = gameState && myPlayer
    ? gameState.players.find((p) => p.id === myPlayer.id)?.portfolio ?? []
    : [];

  const myMissions = gameState && myPlayer
    ? gameState.players.find((p) => p.id === myPlayer.id)?.missions ?? []
    : [];

  const opponents = gameState && myPlayer
    ? gameState.players.filter((p) => p.id !== myPlayer.id)
    : [];

  return {
    ...ctx,
    currentPlayer,
    isMyTurn,
    myPortfolio,
    myMissions,
    opponents,
  };
}
