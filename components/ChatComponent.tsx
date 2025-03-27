"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import polyline from "@mapbox/polyline";
import { 
  X, 
  Plus, 
  Send, 
  ArrowLeft, 
  ArrowRight, 
  Menu, 
  Trash, 
  Edit,
  ArrowUpIcon,
  ArrowDownIcon,
  CornerUpLeft,
  CornerUpRight,
  MoveRight,
  Milestone
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

// ----- Types -----
interface TimelineEvent {
  time: string;
  title: string;
  description: string;
}

interface LegInfo {
  distance: string;  // e.g. "0.8 km"
  duration: string;  // e.g. "2 mins"
}

interface DirectionsResponse {
  polyline: string | null;
  instructions: string[];
  waypoints: WaypointDetail[];
  round_trip: boolean;
  notes: string;
  legs: LegInfo[];
}

interface WaypointDetail {
  name: string;
  address: string;
  coordinates: [number, number]; // [lat, lng]
  type: string;
  hours: string[];
  photos: string[];
}

interface ChatSession {
  id: string;
  name: string;           // Display name (defaulted to last-modified date/time)
  lastModified: number;   // Timestamp (Date.now())
  messages: string[];     // Chat text messages
  timeline: TimelineEvent[];
  waypoints: WaypointDetail[];
  legs?: LegInfo[];
  totalDistance?: number; // in km
  totalDuration?: number; // in minutes
  responseIndices: number[]; // Track which messages have responses
}




interface ChatProps {
  isOpen: boolean;
  onClose: () => void;
  // We'll send the route geometry + waypoint markers back up:
  onRouteUpdate: (routeGeometry: [number, number][], waypointCoords: [number, number][]) => void;
}

export default function Chat({ isOpen, onClose, onRouteUpdate }: ChatProps) {
  // ---- Expandable/Resizable Chat ----
  const [chatWidth, setChatWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth / 3 : 400
  );
  const resizableRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = chatWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth - (e.clientX - startX);
      const minWidth = window.innerWidth / 3;
      if (newWidth >= minWidth && newWidth <= window.innerWidth) {
        setChatWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // ---- Greeting logic ----
  const [greeting, setGreeting] = useState("");
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting("Good Morning, Vikram!");
    } else if (hour < 18) {
      setGreeting("Good Afternoon, Vikram!");
    } else {
      setGreeting("Good Evening, Vikram!");
    }
  }, []);

  // ---- Chat Sessions (History) ----
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedChatIndex, setSelectedChatIndex] = useState<number>(0); // which chat is active
  const [showHistory, setShowHistory] = useState(false);

  // Initialize with a default chat session (so you're never empty)
  useEffect(() => {
    if (chatSessions.length === 0) {
      createNewChat(); // create one right away
    }
  }, [chatSessions]);

  function createNewChat() {
    const now = Date.now();
    const newChat: ChatSession = {
      id: crypto.randomUUID(),
      name: new Date(now).toLocaleString(), // default name
      lastModified: now,
      messages: [],
      timeline: [],
      waypoints: [],
      legs: [],
      totalDistance: 0,
      totalDuration: 0,
      responseIndices: [], // Initialize empty response indices
    };
    setChatSessions((prev) => {
      const updated = [...prev, newChat];
      setSelectedChatIndex(updated.length - 1); // select the newly created chat
      return updated;
    });
  }

  function deleteChat(index: number) {
    setChatSessions((prev) => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
    // Adjust selected chat
    if (selectedChatIndex >= index && selectedChatIndex > 0) {
      setSelectedChatIndex(selectedChatIndex - 1);
    }
  }

  function renameChat(index: number, newName: string) {
    setChatSessions((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        name: newName,
      };
      return updated;
    });
  }

  function selectChat(index: number) {
    setSelectedChatIndex(index);
  }

  // Handy reference to the *active* chat session
  const activeChat = chatSessions[selectedChatIndex];

  // ---- Chat content: message input, timeline, waypoints, etc. ----
  const [message, setMessage] = useState("");
  const [showDirections, setShowDirections] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [currentWaypoint, setCurrentWaypoint] = useState<WaypointDetail | null>(null);

  // Because we store timeline/waypoints in the active chat session, any "update"
  // to them will happen here. Just be sure to replicate the changes back to
  // `chatSessions` so that they persist.
  const timeline = activeChat?.timeline || [];
  const waypoints = activeChat?.waypoints || [];

  const openImage = (photo: string, waypoint: WaypointDetail, index: number) => {
    setSelectedImage(photo);
    setCurrentWaypoint(waypoint);
    setCurrentImageIndex(index);
  };

  const closeImage = () => {
    setSelectedImage(null);
    setCurrentWaypoint(null);
  };

  const nextImage = () => {
    if (!currentWaypoint) return;
    const nextIndex = (currentImageIndex + 1) % currentWaypoint.photos.length;
    setSelectedImage(currentWaypoint.photos[nextIndex]);
    setCurrentImageIndex(nextIndex);
  };

  const prevImage = () => {
    if (!currentWaypoint) return;
    const prevIndex =
      (currentImageIndex - 1 + currentWaypoint.photos.length) % currentWaypoint.photos.length;
    setSelectedImage(currentWaypoint.photos[prevIndex]);
    setCurrentImageIndex(prevIndex);
  };

  function computeTotalDistanceTime(legs: LegInfo[]) {
    let totalDistance = 0; // store in km
    let totalDuration = 0; // store in minutes

    for (const leg of legs) {
      // distance => "0.8 km" or "1.2 mi"
      totalDistance += parseDistance(leg.distance);
      // duration => "2 mins" or "1 hour 3 mins"
      totalDuration += parseDuration(leg.duration);
    }

    return { totalDistance, totalDuration };
  }

  // Example parse for distance. If your API consistently returns "km", great.
  // If it returns "mi", you can detect that and convert, or just store them separately.
  function parseDistance(distStr: string): number {
    // e.g. "0.8 km"
    const parts = distStr.split(" ");
    if (parts.length < 2) return 0;
    const numericVal = parseFloat(parts[0]);
    const unit = parts[1].toLowerCase();

    if (isNaN(numericVal)) return 0;
    if (unit === "km") return numericVal;
    if (unit === "mi") return numericVal * 1.60934; // convert miles to km
    return numericVal;
  }

  // Example parse for duration: "2 mins" or "1 hour 20 mins"
  function parseDuration(durationStr: string): number {
    // returns total minutes
    const lower = durationStr.toLowerCase();
    const hourRegex = /(\d+)\s*hour/;
    const minuteRegex = /(\d+)\s*min/;

    let hours = 0;
    let minutes = 0;

    const hourMatch = lower.match(hourRegex);
    const minuteMatch = lower.match(minuteRegex);

    if (hourMatch && hourMatch[1]) {
      hours = parseInt(hourMatch[1]);
    }
    if (minuteMatch && minuteMatch[1]) {
      minutes = parseInt(minuteMatch[1]);
    }

    return hours * 60 + minutes;
  }

  async function handleSendMessage() {
    if (!message.trim() || !activeChat) return;

    // 1) Add the user's message to the active chat
    const currentMessage = message.trim();
    setMessage("");
    const messageIndex = activeChat.messages.length; // Get the index of the new message

    // Update messages in state
    setChatSessions((prev) => {
      const updated = [...prev];
      updated[selectedChatIndex] = {
        ...updated[selectedChatIndex],
        messages: [...updated[selectedChatIndex].messages, currentMessage],
        lastModified: Date.now(),
      };
      return updated;
    });

    // 2) Call your directions API (example)
    try {
      const res = await fetch("https://polaris-backend-mauve.vercel.app/api/directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentMessage }),
      });

      if (!res.ok) {
        console.error("API error", res.statusText);
        return;
      }

      const data: DirectionsResponse = await res.json();

      const { totalDistance, totalDuration } = computeTotalDistanceTime(data.legs);

      // Decode the polyline => array of [lat, lng]
      let routeGeometry: [number, number][] = [];
      if (data.polyline) {
        const decoded = polyline.decode(data.polyline);
        // Flip to [lng, lat] for map usage
        routeGeometry = decoded.map(([lat, lng]) => [lng, lat]) as [number, number][];
      }

      // Build array of waypoint coords [lng, lat]
      const waypointCoords: [number, number][] = data.waypoints.map((wp) => {
        const [lat, lng] = wp.coordinates;
        return [lng, lat];
      });

      // Build a timeline from instructions
      const timelineEvents: TimelineEvent[] = data.instructions.map((inst, idx) => ({
        time: `Step ${idx + 1}`,
        title: `Instruction ${idx + 1}`,
        description: inst,
      }));

      // Send route geometry & waypoint coords up to the parent
      onRouteUpdate(routeGeometry, waypointCoords);

      // Update the active chat with the new timeline & waypoints
      setChatSessions((prev) => {
        const updated = [...prev];
        updated[selectedChatIndex] = {
          ...updated[selectedChatIndex],
          timeline: timelineEvents,
          waypoints: data.waypoints,
          legs: data.legs,
          totalDistance,
          totalDuration,
          lastModified: Date.now(),
          responseIndices: [...updated[selectedChatIndex].responseIndices, messageIndex], // Add this message index to responses
        };
        return updated;
      });
    } catch (error) {
      console.error("Error fetching route", error);
    }
  }

  // Helper to parse & highlight hours for waypoints
  function parseTimeString(timeStr: string): number {
    if (!timeStr) return -1;
    const [timePart, ampm] = timeStr.trim().split(" ");
    if (!timePart) return -1;

    const [hourStr, minuteStr = "0"] = timePart.split(":");
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if (ampm?.toUpperCase() === "PM" && hour < 12) {
      hour += 12;
    }
    if (ampm?.toUpperCase() === "AM" && hour === 12) {
      hour = 0;
    }

    return hour + minute / 60;
  }

  function formatTotalDistance(km: number): string {
    return `${km.toFixed(1)} km`;
  }

  function formatTotalDuration(minutes: number): string {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hrs > 0) {
      return `${hrs} hr${hrs === 1 ? "" : "s"} ${mins} min${mins === 1 ? "" : "s"}`;
    }
    return `${minutes} min${minutes === 1 ? "" : "s"}`;
  }

  function formatHours(hours: string[]) {
    const now = new Date();
    const currentDay = now.toLocaleDateString("en-US", { weekday: "long" });
    const currentHourVal = now.getHours() + now.getMinutes() / 60;

    return hours.map((hourStr, index) => {
      const [day, timeRange] = hourStr.split(": ");
      const [openStr, closeStr] = timeRange ? timeRange.split(" – ") : [null, null];

      const isToday = day === currentDay;
      let isOpenNow = false;
      if (openStr && closeStr && isToday) {
        const openVal = parseTimeString(openStr);
        const closeVal = parseTimeString(closeStr);
        isOpenNow = currentHourVal >= openVal && currentHourVal <= closeVal;
      }

      return (
        <p
          key={index}
          className={
            "text-xs " +
            (isToday
              ? isOpenNow
                ? "text-green-500"  // Open now
                : "text-red-500"    // Closed now
              : "text-gray-400")    // Not today
          }
        >
          {day}: {timeRange || "Closed"}
        </p>
      );
    });
  }

  // Helper to get the appropriate icon for a direction
  function getDirectionIcon(instruction: string) {
    const lowerInstruction = instruction.toLowerCase();
    if (lowerInstruction.includes("left")) return <CornerUpLeft className="w-5 h-5" />;
    if (lowerInstruction.includes("right")) return <CornerUpRight className="w-5 h-5" />;
    if (lowerInstruction.includes("north")) return <ArrowUpIcon className="w-5 h-5" />;
    if (lowerInstruction.includes("south")) return <ArrowDownIcon className="w-5 h-5" />;
    if (lowerInstruction.includes("head") || lowerInstruction.includes("continue")) return <MoveRight className="w-5 h-5" />;
    return <Milestone className="w-5 h-5" />;
  }

  // Helper to extract distance from instruction
  function extractDistance(instruction: string): string {
    const kmMatch = instruction.match(/\(([\d.]+)\s*km\)/);
    if (kmMatch) return kmMatch[1] + " km";
    return "";
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed top-4 right-4 bottom-4 shadow-lg rounded-2xl flex flex-col p-4 z-40"
      style={{ width: `${chatWidth}px`, backgroundColor: "#222222" }}
    >
      {/* -- Resizable Divider -- */}
      <div
        ref={resizableRef}
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-transparent"
      >
        <div className="h-full flex items-center justify-center">
          <div className="w-0.5 h-6 bg-gray-600 mx-0.5 rounded" />
          <div className="w-0.5 h-6 bg-gray-600 mx-0.5 rounded" />
        </div>
      </div>

      {/* -- Close Button -- */}
      <Button
        className="absolute top-4 left-4 p-2 rounded-full shadow-md bg-[#222222] border border-white border-opacity-20 hover:bg-gray-600"
        onClick={onClose}
      >
        <X className="w-5 h-5 text-white" />
      </Button>

      {/* -- History Button -- */}
      <Button
        className="absolute top-4 right-4 p-2 rounded-full shadow-md bg-[#222222] border border-white border-opacity-20 hover:bg-gray-600"
        onClick={() => setShowHistory(!showHistory)}
      >
        <Menu className="w-5 h-5 text-white" />
      </Button>

      {/* -- History Sidebar -- */}
      {showHistory && (
        <div className="absolute top-14 right-full mr-2 w-64 max-h-[80vh] overflow-y-auto bg-[#1a1a1a] p-2 rounded-xl shadow-xl z-50 border border-gray-600">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-white font-bold text-sm">Chat History</h2>
            <Button
              onClick={createNewChat}
              variant="outline"
              className="bg-[#2a2a2a] hover:bg-gray-700 text-gray-300 px-2 py-1 rounded-lg text-sm"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {chatSessions.map((session, idx) => (
            <div
              key={session.id}
              className={`p-2 rounded-md mb-1 cursor-pointer ${
                idx === selectedChatIndex ? "bg-[#333]" : "hover:bg-[#2a2a2a]"
              }`}
            >
              <div className="flex justify-between items-center gap-2">
                <div onClick={() => selectChat(idx)} className="flex-1">
                  <p className="text-white text-sm truncate">{session.name}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const newName = prompt("Enter new chat name:", session.name);
                      if (newName) renameChat(idx, newName.trim());
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteChat(idx)}
                    className="text-gray-400 hover:text-white"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -- Chat Body -- */}
      <div className="flex-1 overflow-y-auto mt-12 flex flex-col p-4">
        {!activeChat?.messages.length ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-4/5 drop-shadow-lg max-w-[300px]">
              <Image
                src="/logo.png"
                alt="Logo"
                width={300}
                height={150}
                className="rounded-2xl"
              />
            </div>
            <p className="text-white text-lg font-semibold mt-4 shadow-md">
              {greeting}
            </p>
          </div>
        ) : (
          <>
            {/* Chat Messages and Responses */}
            <div className="flex flex-col gap-4">
              {activeChat.messages.map((msg, idx) => (
                <div key={idx} className="space-y-4">
                  {/* User Message */}
                  <div className="flex justify-end">
                    <div className="bg-[#161616] text-white p-3 rounded-xl max-w-sm shadow-md">
                      {msg}
                    </div>
                  </div>

                  {/* AI Response - Only show if we have a response for this specific message */}
                  {activeChat.responseIndices.includes(idx) && (
                    <>
                      {/* Waypoints Card */}
                      <Card className="bg-[#161616] border-gray-800">
                        <CardHeader>
                          <CardTitle className="text-white text-lg">Stops</CardTitle>
                          <CardDescription className="text-gray-400">Places along your route</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Route Summary Section */}
                          {activeChat?.legs && activeChat.legs.length > 0 && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-[#1a1e2e] p-3 rounded-lg">
                                <p className="text-sm text-gray-400">Total Distance</p>
                                <p className="text-white font-semibold">{formatTotalDistance(activeChat.totalDistance || 0)}</p>
                              </div>
                              <div className="bg-[#1a1e2e] p-3 rounded-lg">
                                <p className="text-sm text-gray-400">Total Time</p>
                                <p className="text-white font-semibold">{formatTotalDuration(activeChat.totalDuration || 0)}</p>
                              </div>
                            </div>
                          )}

                          {/* Waypoints List */}
                          {waypoints.map((wp, wpIdx) => (
                            <div
                              key={wpIdx}
                              className="bg-[#1a1e2e] p-4 rounded-lg space-y-3"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="text-white font-semibold">{wp.name}</h3>
                                  <p className="text-sm text-gray-400">{wp.address}</p>
                                </div>
                                {wpIdx > 0 && activeChat?.legs && activeChat.legs[wpIdx - 1] && (
                                  <div className="text-right">
                                    <p className="text-white font-semibold text-lg">{activeChat.legs[wpIdx - 1].duration}</p>
                                    <p className="text-sm text-gray-400">{activeChat.legs[wpIdx - 1].distance}</p>
                                  </div>
                                )}
                              </div>
                              {wp.hours.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-sm text-gray-400">Hours</p>
                                  <div className="flex flex-wrap gap-2">
                                    {formatHours(wp.hours)}
                                  </div>
                                </div>
                              )}
                              {wp.photos.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-sm text-gray-400">Photos</p>
                                  <div className="flex gap-2 overflow-x-auto pb-2">
                                    {wp.photos.map((photo, pIdx) => (
                                      <div
                                        key={pIdx}
                                        className="relative w-32 h-20 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => openImage(photo, wp, pIdx)}
                                      >
                                        <Image
                                          src={photo}
                                          alt={`${wp.name} image`}
                                          fill
                                          className="rounded-lg object-cover"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      {/* Directions Card */}
                      {timeline.length > 0 && (
                        <Card className="bg-[#161616] border-gray-800 mt-4">
                          <CardHeader 
                            className="cursor-pointer hover:bg-[#1a1e2e] rounded-lg transition-colors"
                            onClick={() => setShowDirections(!showDirections)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-white text-lg">Directions</CardTitle>
                                <CardDescription className="text-gray-400">Step-by-step instructions</CardDescription>
                              </div>
                              <div className="text-gray-400">
                                {showDirections ? "▼" : "▶"}
                              </div>
                            </div>
                          </CardHeader>
                          {showDirections && (
                            <CardContent>
                              <div className="space-y-3">
                                {timeline.map((event, index) => (
                                  <div key={index} className="flex items-center gap-3 bg-[#1a1e2e] p-3 rounded-lg">
                                    <div className="text-blue-500">
                                      {getDirectionIcon(event.description)}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-white font-medium">{event.description.split('(')[0].trim()}</p>
                                      <p className="text-sm text-gray-400">{extractDistance(event.description)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {selectedImage && (
              <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
                <Button onClick={closeImage} className="absolute top-4 right-4 p-2 bg-gray-700 rounded-full">
                  <X className="text-white" />
                </Button>
                <Button onClick={prevImage} className="absolute left-4 p-2 bg-gray-700 rounded-full">
                  <ArrowLeft className="text-white" />
                </Button>
                <Image src={selectedImage} alt="Enlarged" width={600} height={400} className="rounded-xl object-cover" />
                <Button onClick={nextImage} className="absolute right-4 p-2 bg-gray-700 rounded-full">
                  <ArrowRight className="text-white" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* -- Chat Input -- */}
      <div className="pt-2 bg-[#161616] p-2 rounded-2xl">
        <div className="flex items-center gap-2 mb-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Give me a route..."
            className="flex-1 rounded-xl resize-none p-2 border border-gray-700 bg-[#161616] text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            rows={1}
            style={{ minHeight: "40px", maxHeight: "150px", overflowY: "auto" }}
          />
          <Button
            variant="default"
            size="icon"
            className="rounded-xl bg-blue-600 hover:bg-blue-500 border border-white border-opacity-20"
            onClick={handleSendMessage}
          >
            <Send className="w-4 h-4 text-white" />
          </Button>
        </div>

        {/* Additional Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl border bg-[#161616] border-white border-opacity-20 text-gray-400 hover:bg-gray-700"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            className="rounded-xl border border-white bg-[#161616] border-opacity-20 text-gray-400 hover:bg-gray-700 text-sm"
          >
            DeepRoute
          </Button>
        </div>
      </div>
    </div>
  );
}
