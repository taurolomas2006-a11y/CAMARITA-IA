import React from 'react';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col relative">
      
      {/* Elementos Estéticos de Fondo */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <header className="w-full max-w-6xl mx-auto mb-8 z-10 flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 tracking-tight">
             Visión de Inventario PWA
           </h1>
           <p className="text-white/50 text-sm mt-1">Escaneo Autónomo & Tracking en Tiempo Real</p>
        </div>
      </header>

      <main className="flex-1 z-10">
        <Dashboard />
      </main>

    </div>
  );
}

export default App;
