"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2 } from "lucide-react";
import mapboxgl from "mapbox-gl";
import Chat from "@/components/ChatComponent";
import "mapbox-gl/dist/mapbox-gl.css";
import { QRCodeCanvas } from "qrcode.react";
import { QrCode } from "lucide-react"; // optional QR icon


mapboxgl.accessToken = "pk.eyJ1IjoidmlrcmFtMTQxMCIsImEiOiJjbTJubm41cDQwODJ6MmlwdGV4ZDFpbjFwIn0.CYMBhtTmE4ZSZY5PkSR1_A";

export default function Home() {
  const [showQR, setShowQR] = useState(false);
  const [gmapsUrl, setGmapsUrl] = useState<string | null>(null);
  const [isGeolocating, setIsGeolocating] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const geoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // The final route geometry decoded from Google polyline ([lng, lat] pairs)
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);

  // The raw waypoint locations from the user (start, stops, end)
  const [waypointCoords, setWaypointCoords] = useState<[number, number][]>([]);

  // Keep track of markers so we can remove them when they change
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Handle user geolocation
  useEffect(() => {
    // Set a timeout to switch to globe view if geolocation takes too long
    geoTimeoutRef.current = setTimeout(() => {
      if (!userLocation) {
        setIsGeolocating(false);
        setGeoError("Geolocation is taking too long, showing globe view");
      }
    }, 5000);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation([longitude, latitude]);
          setIsGeolocating(false);
          
          if (geoTimeoutRef.current) {
            clearTimeout(geoTimeoutRef.current);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          setGeoError(`Geolocation error: ${error.message}`);
          setIsGeolocating(false);
          
          if (geoTimeoutRef.current) {
            clearTimeout(geoTimeoutRef.current);
          }
        },
        { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      setGeoError("Geolocation is not supported by this browser");
      setIsGeolocating(false);
      
      if (geoTimeoutRef.current) {
        clearTimeout(geoTimeoutRef.current);
      }
    }

    return () => {
      if (geoTimeoutRef.current) {
        clearTimeout(geoTimeoutRef.current);
      }
    };
  }, []);

  // Initialize the map after getting user location or fallback to globe view
  useEffect(() => {
    if (!mapContainer.current) return;
    
    // Only initialize the map when we have user location or we've decided to show globe
    if ((userLocation || geoError) && !isGeolocating) {
      if (mapInstance.current) {
        mapInstance.current.remove();
      }
      
      const initialLocation = userLocation || [-0.1278, 51.5074]; // Default to London if no user location
      const initialZoom = userLocation ? 13 : 1.5; // Zoom out for globe view if no user location
      
      mapInstance.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: initialLocation,
        zoom: initialZoom,
        projection: userLocation ? undefined : 'globe', // Use globe projection for fallback
      });

      // Add user location marker if we have it
      if (userLocation) {
        const el = document.createElement("div");
        el.className = "user-location-marker";
        el.style.width = "20px";
        el.style.height = "20px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#4285F4";
        el.style.boxShadow = "0 0 0 4px rgba(66, 133, 244, 0.4)";
        el.style.border = "2px solid white";
        el.style.cursor = "pointer";
        
        userMarkerRef.current = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
        .setLngLat(userLocation)
        .addTo(mapInstance.current);
        
        // Add a pulsing effect with a popup
        const popup = new mapboxgl.Popup({ closeButton: false })
          .setHTML('<div>Your location</div>');
          
        el.addEventListener('mouseenter', () => {
          userMarkerRef.current?.setPopup(popup);
          popup.addTo(mapInstance.current!);
        });
        
        el.addEventListener('mouseleave', () => {
          popup.remove();
        });
      } else if (mapInstance.current) {
        // Start a spinning animation for the globe
        const rotateCamera = () => {
          if (!mapInstance.current) return;
          
          // Get the map's current center
          const center = mapInstance.current.getCenter();
          // Update the longitude to create rotation, keeping latitude the same
          center.lng -= 0.5;
          
          // Animate to the new center
          mapInstance.current.easeTo({
            center: center,
            duration: 1000,
            easing: (t) => t
          });
          
          // Request the next frame
          requestAnimationFrame(rotateCamera);
        };
        
        mapInstance.current.on('load', () => {
          rotateCamera();
        });
      }
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
      }
    };
  }, [userLocation, geoError, isGeolocating]);

  /**
   * When the Chat passes us (routeGeometry, waypointCoords),
   * store them in state. This triggers the next effect below.
   */
  function handleRouteUpdate(
    route: [number, number][],
    waypoints: [number, number][]
  ) {
    setRouteGeometry(route);
    setWaypointCoords(waypoints);
  }

  /**
   * 1) Draw the route geometry on the map
   * 2) Fit the map to the bounding box of the route
   */
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || routeGeometry.length < 2) return;

    // Remove existing route layer/source if present
    if (map.getSource("route")) {
      map.removeLayer("route");
      map.removeSource("route");
    }

    // Add new route source
    map.addSource("route", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: routeGeometry, // Already in [lng, lat]
        },
      },
    });

    // Add new route layer
    map.addLayer({
      id: "route",
      type: "line",
      source: "route",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#3498db",
        "line-width": 4,
      },
    });

    // Fit bounds to the route
    const bounds = routeGeometry.reduce(
      (b, coord) => b.extend(coord),
      new mapboxgl.LngLatBounds(routeGeometry[0], routeGeometry[0])
    );

    // If the chat is open, add some right padding so the route is still visible
    const chatScreenWidth = isChatOpen ? 400 : 0;
    const padding = {
      top: 50,
      bottom: 50,
      left: 50,
      right: chatScreenWidth + 50,
    };

    map.fitBounds(bounds, { padding });
  }, [routeGeometry, isChatOpen]);

  /**
   * Add markers for the waypoints:
   *  - The first waypoint in green (start)
   *  - The last waypoint in red (destination)
   *  - All others in blue
   */
  useEffect(() => {
    if (!mapInstance.current) return;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    waypointCoords.forEach((coord, index) => {
      let marker: mapboxgl.Marker;
    
      // Custom blue circle for the start location
      if (index === 0) {
        const el = document.createElement("div");
        el.style.width = "20px";
        el.style.height = "20px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "blue";
        el.style.boxShadow = "0 0 4px rgba(0, 0, 255, 0.6)";
        el.style.border = "2px solid white";
    
        marker = new mapboxgl.Marker({ element: el }).setLngLat(coord);
      } else {
        const color = index === waypointCoords.length - 1 ? "red" : "blue";
        marker = new mapboxgl.Marker({ color }).setLngLat(coord);
      }
    
      marker.addTo(mapInstance.current!);
      markersRef.current.push(marker);
    });
    
  }, [waypointCoords]);


  return (
    <div className="w-screen h-screen relative bg-[#161616]">
      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Geolocation loader */}
      {isGeolocating && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50 z-10">
          <div className="bg-[#1a1e2e] p-5 rounded-xl shadow-lg flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
            <p className="text-white text-center">Locating you...</p>
            <p className="text-gray-400 text-xs mt-1 text-center">
              This helps us provide better routes
            </p>
          </div>
        </div>
      )}

      {/* Chat Component */}
      <Chat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onRouteUpdate={handleRouteUpdate}
      />

      {/* Button to open Chat */}
      {!isChatOpen && (
        <Button
          className="fixed top-4 right-4 z-50 p-2 rounded-full shadow-md bg-[#222222] border border-white border-opacity-20 hover:bg-gray-600"
          onClick={() => setIsChatOpen(true)}
        >
          <MessageCircle className="w-5 h-5 text-white" />
        </Button>
      )}

      {/* Button to open route in Google Maps, shown only if we have at least two waypoints */}
      {waypointCoords.length > 1 && (
        <>
          <button
            onClick={() => {
              if (waypointCoords.length < 2) return;

              const [originLng, originLat] = waypointCoords[0];
              const [destLng, destLat] = waypointCoords[waypointCoords.length - 1];

              const intermediateWaypoints = waypointCoords
                .slice(1, waypointCoords.length - 1)
                .map(([lng, lat]) => `${lat},${lng}`)
                .join("|");

              const gmUrl = new URL("https://www.google.com/maps/dir/");
              gmUrl.searchParams.append("api", "1");
              gmUrl.searchParams.append("origin", `${originLat},${originLng}`);
              gmUrl.searchParams.append("destination", `${destLat},${destLng}`);
              gmUrl.searchParams.append("travelmode", "driving");
              if (intermediateWaypoints) {
                gmUrl.searchParams.append("waypoints", intermediateWaypoints);
              }

              const finalUrl = gmUrl.toString();
              setGmapsUrl(finalUrl);
              window.open(finalUrl, "_blank");
            }}
            className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-lg hover:scale-105 transition-transform border border-gray-300"
          >
            <img src="/google.png" alt="Google Maps" className="w-5 h-5" />
            <span className="text-sm font-medium text-black">Open in Google Maps</span>
          </button>

          <button
            onClick={() => {
              if (waypointCoords.length < 2) return;

              // Build the Google Maps URL using the same logic
              const [originLng, originLat] = waypointCoords[0];
              const [destLng, destLat] = waypointCoords[waypointCoords.length - 1];
              const intermediateWaypoints = waypointCoords
                .slice(1, waypointCoords.length - 1)
                .map(([lng, lat]) => `${lat},${lng}`)
                .join("|");

                const gmUrl = new URL("https://www.google.com/maps/dir/");
                gmUrl.searchParams.append("api", "1");
                gmUrl.searchParams.append("origin", `${originLat},${originLng}`);
                gmUrl.searchParams.append("destination", `${destLat},${destLng}`);
                gmUrl.searchParams.append("travelmode", "driving");
                gmUrl.searchParams.append("dir_action", "navigate"); // This line triggers navigation mode
                if (intermediateWaypoints) {
                  gmUrl.searchParams.append("waypoints", intermediateWaypoints);
                }
                const finalUrl = gmUrl.toString();
                

              setGmapsUrl(finalUrl); // Set the URL state
              setShowQR(true);       // Then open the QR modal
            }}
            className="fixed bottom-4 left-56 z-50 flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-lg hover:scale-105 transition-transform border border-gray-300"
          >
            <QrCode className="w-5 h-5 text-black" />
            <span className="text-sm font-medium text-black">Scan QR</span>
          </button>

        </>
      )}


      {showQR && gmapsUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center">
            <h2 className="mb-4 text-lg font-semibold text-black">Scan to Open on Your Phone</h2>
            <QRCodeCanvas value={gmapsUrl} size={200} />
            <button
              onClick={() => setShowQR(false)}
              className="mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      )}


    </div>
  );
}
