# IG-S8
Entrega de la Tarea de la S8 de la asignatura Informática Gráfica.
## Enunciado
Esta tarea consistirá en proponer una visualización de datos de acceso abierto que contengan información geográfica en threejs, con las habilidades adquiridas en las sesiones previas. Podrás optar bien por adoptar datos integrando información OSM o datos sobre mapas o su combinación. Es requisito necesario para superar la práctica incluir en la entrega una captura en vídeo (preferentemente de no más de 30 segundos) que ilustre el resultado de la visualización. La entrega se realiza a través del campus virtual proporcionando un enlace github.

## Desarrollo de la tarea
Tomando como partida el [mapa de las estaciones de la sitycleta](https://github.com/otsedom/otsedom.github.io/blob/main/IG/S8/code/script_24_mapasitycleta.js) que nos proporcionó el profesor [Modesto](https://github.com/otsedom/otsedom.github.io/tree/main) en clase, se me ocurrió hacer algo interesante con los datos de mis viajes de la sitycleta. Dado que mi uso de esta es muy frecuente, y empecé a usarla el 10/10/2025, decidí contear todos mis viajes hasta el 11/11/2025 (un mes de uso) y trabajar con estos datos para marcar las estaciones en el mapa que he visitado con más/menos frecuencia y las que todavía me quedan por visitar. 

Para conseguir los datos de mis viajes en un formato tratable contacté con [Sagulpa](https://www.sagulpa.com/contactar) para que me proporcionasen un archivo de mis datos en formato .csv o en cualquier archivo de texto a tratar. Como su respuesta fue inexistente y mi interés por realizar el proyecto era grande, decidí meter mi registro de viajes 1 a 1 en un archivo .csv para tratarlos en la práctica. Una vez realizado el [archivo de rutas](https://github.com/guillecab7/IG-S8/blob/main/src/SITYRUTAS-2025.csv) empezamos a realizar el proyecto.

## Realización de la practica

Ahora pasaré a explicar el código realizado del [marcador de mis estaciones recorridas](https://github.com/guillecab7/IG-S8/blob/main/src/Marcador_estaciones_recorridas.js).
Antes de nada comentar que tenemos un [catálogo con todas las estaciones de la sitycleta](https://github.com/guillecab7/IG-S8/blob/main/src/Geolocalizaci%C3%B3n%20estaciones%20sitycleta.csv), que es el que vamos a usar para marcar las estaciones en el [mapa de Las Palmas de Gran Canaria](https://github.com/guillecab7/IG-S8/blob/main/src/mapaLPGC.png).
