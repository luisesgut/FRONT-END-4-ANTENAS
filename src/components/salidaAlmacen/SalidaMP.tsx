import React, { useState, useEffect } from 'react';
import './SalidaMP.scss';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';

// Definimos los tipos para Producto
interface Producto {
    id?: number; // Si el id existe, lo agregamos como opcional
    urlImagen: string;
    fecha: string;
    area: string;
    claveProducto: string;
    nombreProducto: string;
    pesoBruto: string | number;
    pesoNeto: string | number;
    pesoTarima: string | number;
    piezas: string | number;
    uom: string;
    fechaSalida: string; // Cambiado para Salida
    productPrintCard: string;
}

const subject = new Subject<string>();

// Función para obtener datos del endpoint
const fetchData = async (epc: string): Promise<Producto | null> => {
    try {
        const response = await fetch(`http://172.16.10.31/api/socket/${epc}`);
        if (!response.ok) {
            throw new Error('Error al obtener los datos');
        }
        const data = await response.json();
        console.log("Datos obtenidos:", data);
        return data as Producto; 
    } catch (error) {
        console.error("Error al realizar la petición:", error);
        return null; 
    }
};

// Cargar datos
const loadData = async (epc: string, setProductos: React.Dispatch<React.SetStateAction<Producto[]>>) => {
    const data = await fetchData(epc);
    if (data) {

        const imageResponse = await fetch(`http://172.16.10.31/api/Image/${data.productPrintCard}`);
        const imageBase64 = imageResponse.ok ? await imageResponse.text() : 'https://www.jnfac.or.kr/img/noimage.jpg';

        setProductos((prev) => [
            {
                urlImagen: imageBase64,
                fecha: data.fecha || 'N/A',
                area: data.area || 'N/A',
                claveProducto: data.claveProducto || 'N/A',
                nombreProducto: data.nombreProducto || 'N/A',
                pesoBruto: data.pesoBruto || 'N/A',
                pesoNeto: data.pesoNeto || 'N/A',
                pesoTarima: data.pesoTarima || 'N/A',
                piezas: data.piezas || 'N/A',
                uom: data.uom || 'N/A',
                fechaSalida: data.fechaSalida || 'N/A', // Cambiado para Salida
                productPrintCard: data.productPrintCard || 'N/A'
            },
            ...prev
        ]);
    }
};

// Función para cambiar el estado
const updateStatus = async (epc: string, status: number) => {
    try {
        const response = await fetch(`http://172.16.10.31/api/RfidLabel/Status/${epc}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            console.log("Estado actualizado correctamente");
        } else {
            const errorText = await response.text();
            console.error("Error al actualizar el estado:", response.status, errorText);
        }
    } catch (error) {
        console.error("Error al conectarse con el endpoint:", error);
    }
};

// Función para hacer registro de salidas en ExtraInfo
const extraInfo = async (epc: string, antena: string) => {
    try {
        const epcData = await fetchData(epc);

        if (epcData && epcData.id) {
            const prodEtiquetaRFIDId = epcData.id;
            console.log(prodEtiquetaRFIDId);
            
            // Cambiado a endpoint de SalidaAlmacen
            const response = await fetch('http://172.16.10.31/api/ProdExtraInfo/SalidaAlmacen', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prodEtiquetaRFIDId: prodEtiquetaRFIDId,
                    ubicacion: "AlmacenMP", // Ajuste para Salida
                    fechaSalida: new Date().toISOString(),
                    antena: antena
                })
            });

            if (response.ok) {
                const result = await response.json();
                return result;
            } else {
                console.error("Error al registrar la información:", response.statusText);
                return null;
            }
        } else {
            console.error("No se pudo obtener el ID del EPC");
            return null;
        }
    } catch (error) {
        console.error("Error al conectarse con el endpoint de registro:", error);
        return null;
    }
};

const SalidaMP: React.FC = () => {
    const [productos, setProductos] = useState<Producto[]>([]); // Lista de productos

    useEffect(() => {
        const connection = new signalR.HubConnectionBuilder()
            .withUrl("http://localhost:5239/message")
            .configureLogging(signalR.LogLevel.Information)
            .build();
    
        connection.start()
            .then(() => {
                console.log("Conectado");
                // Unirse al grupo "Embarque-Carril-1"
                connection.invoke("JoinGroup", "EntradaMP")
                    .then(() => console.log("Unido al grupo EntradaMP"))
                    .catch(err => console.error("Error al unirse al grupo:", err));
            })
            .catch((err) => console.error("Error de conexión:", err));
    
        connection.on("sendEpc", (message) => {
            console.log("Mensaje recibido:", message);
            subject.next(message);
        });
    
        const processMessage = (message: any) => {
            // Accede directamente a las propiedades del objeto recibido desde el backend
            const antena = message.AntennaPort;
            const epc = message.EPC;
            const rssi = message.RSSI;
            const firstSeenTime = message.FirstSeenTime;
            const lastSeenTime = message.LastSeenTime;
            const readerIP = message.ReaderIP;
    
            console.log("Antena:", antena);
            console.log("EPC:", epc);
            console.log("RSSI:", rssi);
            console.log("First Seen:", firstSeenTime);
            console.log("Last Seen:", lastSeenTime);
            console.log("Reader IP:", readerIP);
    
            // Procesar los datos según lo necesites
            loadData(epc, setProductos);
            updateStatus(epc, 2); // Cambia el estado de EPC
            extraInfo(epc, antena); // Registra la información adicional
        };
    
        const subscription = subject.subscribe(processMessage);
    
        // Cuando el componente se desmonte, se debe salir del grupo
        return () => {
            if (connection.state === signalR.HubConnectionState.Connected) {
                connection.invoke("LeaveGroup", "EntradaMP")
                    .then(() => {
                        console.log("Desconectado del grupo EntradaMP");
                        return connection.stop();
                    })
                    .catch(err => console.error("Error al salir del grupo:", err));
            } else {
                connection.stop().then(() => console.log("Conexión detenida"));
            }
    
            subscription.unsubscribe();
        };
    }, []);

    return (
        <div className="outer-container">
            <div className="product-list-container">
                <div className="entry-title">
                    <h2>Salidas</h2> {/* Cambiado para Salida */}
                </div>
                {productos.map((producto, index) => (
                    <div className="entry-product" key={index}>
                        <p><strong>Área:</strong> <span>{producto.area}</span></p>
                        <p><strong>Clave de Producto:</strong> <span>{producto.claveProducto}</span></p>
                        <p><strong>Producto:</strong> <span>{producto.nombreProducto}</span></p>
                        <p><strong>Peso Neto:</strong> <span>{producto.pesoNeto}</span></p>
                        <p><strong>Piezas:</strong> <span>{producto.piezas}</span></p>
                        <p><strong>Unidad de Medida:</strong> <span>{producto.uom}</span></p>
                    </div>
                ))}
            </div>
            <div className="container">
                {productos.length > 0 && (
                    <div className="product-image">
                        <img src={productos[0].urlImagen} alt="Imagen del Producto" />
                    </div>
                )}
                <div className="product-details">
                    <h1>Detalles del Producto</h1>
                    {productos.length > 0 && (
                        <>
                            <div className="detail-row">
                                <p><strong>Área:</strong> <span>{productos[0].area}</span></p>
                                <p><strong>Fecha:</strong> <span>{productos[0].fecha}</span></p>
                            </div>
                            <div className="">
                                <p><strong>Clave de Producto:</strong> <span>{productos[0].claveProducto}</span></p>
                                <p><strong>Producto:</strong> <span>{productos[0].nombreProducto}</span></p>
                            </div>
                            <div className="detail-row">
                                <p><strong>Peso Bruto:</strong> <span>{productos[0].pesoBruto}</span></p>
                                <p><strong>Peso Neto:</strong> <span>{productos[0].pesoNeto}</span></p>
                            </div>
                            <div className="detail-row">
                                <p><strong>Piezas:</strong> <span>{productos[0].piezas}</span></p>
                                <p><strong>Peso Tarima:</strong> <span>{productos[0].pesoTarima}</span></p>
                            </div>
                            <div className="">
                                <p><strong>Fecha de Salida:</strong> <span>{productos[0].fechaSalida}</span></p> {/* Cambiado a Salida */}
                                <p><strong>Unidad de Medida:</strong> <span>{productos[0].uom}</span></p>
                            </div>
                            <p><strong>PrintCard:</strong> <span>{productos[0].productPrintCard}</span></p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SalidaMP;
