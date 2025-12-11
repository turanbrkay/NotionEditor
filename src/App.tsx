import { useState } from 'react';
import { PageProvider } from './context/PageContext';
import { Editor } from './components/Editor';
import { Sidebar } from './components/Sidebar';
import './styles/index.css';

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <PageProvider>
      <div className="app-shell">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
        />
        <div className={`app-main ${sidebarCollapsed ? 'app-main--expanded' : ''}`}>
          <Editor />
        </div>
      </div>
    </PageProvider>
  );
}

export default App;
