import React, { useState, useEffect } from 'react';
import './EntradaAlmacen.scss';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import Swal from 'sweetalert2';

// Definimos los tipos para Producto
interface Producto {
    id?: number; 
    Imagen: string;
    fecha: string;
    area: string;
    claveProducto: string;
    nombreProducto: string;
    pesoBruto: string | number;
    pesoNeto: string | number;
    pesoTarima: string | number;
    piezas: string | number;
    uom: string;
    fechaEntrada: string;
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
    try {
        const data = await fetchData(epc);
        if (data) {

            const imageResponse = await fetch(`http://172.16.10.31/api/Image/${data.productPrintCard}`);
            const imageData = await imageResponse.json();
            const imageString = imageData.imageBase64;

            console.log(imageString);
            setProductos((prev) => [
                {
                    Imagen: imageString || 'https://www.jnfac.or.kr/img/noimage.jpg',
                    fecha: data.fecha || 'N/A',
                    area: data.area || 'N/A',
                    claveProducto: data.claveProducto || 'N/A',
                    nombreProducto: data.nombreProducto || 'N/A',
                    pesoBruto: data.pesoBruto || 'N/A',
                    pesoNeto: data.pesoNeto || 'N/A',
                    pesoTarima: data.pesoTarima || 'N/A',
                    piezas: data.piezas || 'N/A',
                    uom: data.uom || 'N/A',
                    fechaEntrada: data.fechaEntrada || 'N/A',
                    productPrintCard: data.productPrintCard || 'N/A'
                },
                ...prev
            ]);
        } else {
            console.warn(`No se encontraron datos para el EPC: ${epc}`);
        }
    } catch (error) {
        console.error("Error al cargar los datos del EPC:", error);
    }
};


// Función para cambiar el estado
const updateStatus = async (epc: string, newStatus: number) => {
    try {
        
        const response = await fetch(`http://172.16.10.31/api/RfidLabel/UpdateStatusByRFID/${epc}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus }) // Usa el nuevo estado que pasaste como parámetro
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


// Función para hacer registro de entradas en ExtraInfo
const extraInfo = async (epc: string, antena: string, fecha : string ) => {
    try {

        const epcData = await fetchData(epc);


        // Comprobar si se obtuvo el ID del EPC
        if (!epcData || !epcData.id) {
            console.error("No se pudo obtener el ID del EPC");
            return null;
        }

        const prodEtiquetaRFIDId = epcData.id;
        console.log("ID del producto para EPC:", prodEtiquetaRFIDId);
        
        const response = await fetch('http://172.16.10.31/api/ProdExtraInfo/EntradaAlmacen', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prodEtiquetaRFIDId: prodEtiquetaRFIDId,
                fechaEntrada: new Date().toISOString(),
                antena: 'EntradaPT'
            })
        });

        if (!response.ok) {
            console.error("Error al registrar la información. Estado:", response.status, response.statusText);
            return null;
        }

        const result = await response.json();
        console.log("Respuesta del servidor:", result);
        return result;


    } catch (error) {
        console.error("Error al conectarse con el endpoint de registro:", error);
        return null;
    }
};




const ProductDetail: React.FC = () => {
    const [productos, setProductos] = useState<Producto[]>([]); // Lista de productos

    useEffect(() => {
        const connection = new signalR.HubConnectionBuilder()
            .withUrl("http://localhost:5239/message")
            .configureLogging(signalR.LogLevel.Information)
            .build();
    
        connection.start()
            .then(() => {
                console.log("Conectado");
                connection.invoke("JoinGroup", "EntradaPT")
                    .then(() => console.log("Unido al grupo EntradaPT"))
                    .catch(err => console.error("Error al unirse al grupo:", err));
            })
            .catch((err) => console.error("Error de conexión:", err));
    
        connection.on("sendEpc", (message) => {
            console.log("Mensaje recibido:", message);
            subject.next(message);  // Asegúrate de que el formato de mensaje es correcto
        });
    
        const processMessage = (message: any) => {
            if (message && message.epc) {  // Asegúrate de que coincida con las propiedades en minúsculas
                const { antennaPort, epc, rssi, firstSeenTime, lastSeenTime, readerIP } = message;
                const epcSinEspacios = epc.replace(/\s+/g, '');
        
                console.log("Antena:", antennaPort);
                console.log("EPC:", epcSinEspacios);
                console.log("RSSI:", rssi);
                console.log("First Seen:", firstSeenTime);
                console.log("Last Seen:", lastSeenTime);
                console.log("Reader IP:", readerIP);
        
                // Procesar los datos según lo necesites
                loadData(epcSinEspacios, setProductos);
                updateStatus(epcSinEspacios, 2); // Cambia el estado de EPC
                extraInfo(epcSinEspacios, antennaPort,lastSeenTime); // Registra la información adicional
            } else {
                console.warn("Formato de mensaje incorrecto o faltan datos:", message);
            }
        };
        
    
        const subscription = subject.subscribe(processMessage);
    
        return () => {
            if (connection.state === signalR.HubConnectionState.Connected) {
                connection.invoke("LeaveGroup", "EntradaPT")
                    .then(() => {
                        console.log("Desconectado del grupo EntradaPT");
                        return connection.stop();
                    })
                    .catch(err => console.error("Error al salir del grupo:", err));
            } else {
                connection.stop().then(() => console.log("Conexión detenida"));
            }
    
            subscription.unsubscribe();
        };
    }, [setProductos]);
    
    

    return (
        <div className="outer-container">
            <div className="product-list-container">
                <div className="entry-title">
                    <h2>Entradas</h2>
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
                        <img src={productos[0].Imagen} alt="Imagen del Producto" />
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
                                <p><strong>Fecha de Entrada:</strong> <span>{productos[0].fechaEntrada}</span></p>
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

export default ProductDetail;