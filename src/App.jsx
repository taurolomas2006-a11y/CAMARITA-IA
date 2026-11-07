import React from 'react';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col relative">
      
      {/* Elementos Estéticos de Fondo */}

      <header className="w-full max-w-6xl mx-auto mb-8 z-10 flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 tracking-tight">
             Camarita IA
           </h1>
           <p className="text-white/50 text-sm mt-1">Heladera · Cámara e inventario en tiempo real</p>
        </div>
        <button className="button secondary" onClick={() => window.location.reload()}>Actualizar aplicación</button>
      </header>

      <main className="flex-1 z-10">
        <Dashboard />
      </main>

    </div>
  );
}

export default App;
