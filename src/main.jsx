import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { createDealsApi } from './pages/deals-list/api/createDealsApi.js';

const api = createDealsApi();

createRoot(document.getElementById('root')).render(<App api={api} />);
