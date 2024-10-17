import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.scss'; // Ajuste de importación para TSX, sin extensión
import { Dashboard } from './components/dashboard/Dashboard';
import EntradaAlmacen from './components/entradaAlmacen/EntradaAlmacen';
import SalidaMP from './components/salidaAlmacen/SalidaMP'; 
import Cortina1 from './components/embarque1/Cortina1';
import Cortina2 from './components/embarque2/Cortina2';
import Cortina3 from './components/embarque3/Cortina3';


// Definir los componentes funcionales con TypeScript
// const Cortina-1: React.FC = () => <div>Embarque 1</div>;
//const Embarque2: React.FC = () => <div>Embarque 2</div>;
const Embarque3: React.FC = () => <div>Embarque 3</div>;
const SalidaAlmacen: React.FC = () => <div>Salida Almacén</div>;

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
        {/* Rutas de la aplicación */}
        <Routes>
          <Route path="/" element={<Dashboard />} /> {/* Dashboard principal */}
          <Route path="/salida-almacen" element={<SalidaMP />} /> {/* Vista Salida Almacén */}
          <Route path="/entrada-almacen" element={<EntradaAlmacen />} /> {/* Vista Entrada Almacén */}
          <Route path="/embarque-1" element={<Cortina1 />} />
          <Route path="/embarque-2" element={<Cortina2 />} />
          <Route path="/embarque-3" element={<Cortina3 />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;