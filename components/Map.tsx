// "use client";

// import { useEffect, useRef } from "react";
// import mapboxgl from "mapbox-gl";

// mapboxgl.accessToken =
//   "pk.eyJ1IjoidmlrcmFtMTQxMCIsImEiOiJjbTJubm41cDQwODJ6MmlwdGV4ZDFpbjFwIn0.CYMBhtTmE4ZSZY5PkSR1_A";

// export default function Map() {
//   const mapContainer = useRef<HTMLDivElement | null>(null);
//   const mapInstance = useRef<mapboxgl.Map | null>(null);

//   useEffect(() => {
//     if (!mapContainer.current) return;

//     mapInstance.current = new mapboxgl.Map({
//       container: mapContainer.current,
//       style: "mapbox://styles/vikram1410/cm6ty9mct01bi01ryb4681g81?fresh=true", // Ensure this is a dark mode style
//       center: [-79.1880, 43.7854], // UTSC Coordinates
//       zoom: 14, // Adjust zoom level as needed
//     });

//     return () => mapInstance.current?.remove();
//   }, []);

//   return <div ref={mapContainer} className="w-full h-full" />;
// }
