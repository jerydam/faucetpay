"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface SpinRoom {
  id: string;
  name: string;
  description: string;
  participants: string[];
  createdAt: Date;
  winners: string[];
}

interface SpinContextType {
  rooms: SpinRoom[];
  addRoom: (room: SpinRoom) => void;
  deleteRoom: (id: string) => void;
  updateRoom: (id: string, updatedRoom: Partial<SpinRoom>) => void;
}

const SpinContext = createContext<SpinContextType | undefined>(undefined);

export function SpinProvider({ children }: { children: ReactNode }) {
  const [rooms, setRooms] = useState<SpinRoom[]>([]);

  // Load from local storage on mount so rooms persist across page reloads
  useEffect(() => {
    const saved = localStorage.getItem("spinRooms");
    if (saved) {
      setRooms(JSON.parse(saved));
    } else {
      // Default demo room
      setRooms([{
        id: "demo",
        name: "Demo Room",
        description: "A sample spin room to get you started",
        participants: ["Alice", "Bob", "Carol", "David", "Eve", "Frank"],
        createdAt: new Date(),
        winners: [],
      }]);
    }
  }, []);

  // Save to local storage whenever rooms change
  useEffect(() => {
    if (rooms.length > 0) {
      localStorage.setItem("spinRooms", JSON.stringify(rooms));
    }
  }, [rooms]);

  const addRoom = (room: SpinRoom) => setRooms((prev) => [room, ...prev]);
  const deleteRoom = (id: string) => setRooms((prev) => prev.filter((r) => r.id !== id));
  const updateRoom = (id: string, updates: Partial<SpinRoom>) => {
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  return (
    <SpinContext.Provider value={{ rooms, addRoom, deleteRoom, updateRoom }}>
      {children}
    </SpinContext.Provider>
  );
}

export const useSpin = () => {
  const context = useContext(SpinContext);
  if (!context) throw new Error("useSpin must be used within a SpinProvider");
  return context;
};