import { PageProvider } from './context/PageContext';
import { Editor } from './components/Editor';
import './styles/index.css';

function App() {
  return (
    <PageProvider>
      <Editor />
    </PageProvider>
  );
}

export default App;
