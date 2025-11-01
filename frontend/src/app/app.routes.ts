import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/start/start-game.component').then((m) => m.StartGameComponent)
  },
  {
    path: 'play/:collectionId',
    loadComponent: () =>
      import('./pages/game/game-board.component').then((m) => m.GameBoardComponent)
  },
  { path: '**', redirectTo: '' }
];
