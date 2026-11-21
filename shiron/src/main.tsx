import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SearchPage } from './components/SearchPage';
import { SongPage } from './components/SongPage';
import { ArtistPage } from './components/ArtistPage';
import { SourcesPage } from './components/SourcesPage';
import { useRoute } from './router';
import './styles.css';

function App() {
  const route = useRoute();
  switch (route.name) {
    case 'song':
      return <SongPage key={route.id} id={route.id} />;
    case 'artist':
      return <ArtistPage key={route.id} id={route.id} />;
    case 'sources':
      document.title = 'מקורות | שירון אקורדים';
      return <SourcesPage />;
    default:
      document.title = route.q ? `${route.q} | שירון אקורדים` : 'שירון אקורדים';
      return <SearchPage initialQ={route.q} mode={route.mode} />;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
