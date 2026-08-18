import { useEffect } from 'react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import ProjectPanel from './components/ProjectPanel';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const loadTopics = useStore(s => s.loadTopics);

  useEffect(() => {
    loadTopics();
  }, []);

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      <Sidebar />
      <ChatArea />
      <ProjectPanel />
      <SettingsModal />
    </div>
  );
}
