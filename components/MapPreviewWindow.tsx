import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { MapData, Spawn, Monster, SpotType } from '../types';

interface MapPreviewWindowProps {
  mapData: MapData | null;
  allMonsters: Monster[];
  onClose: () => void;
  show: boolean;
  selectedMonsterForAdd: Monster | null;
  onAddSpawn: (x: number, y: number) => void;
  onAddAreaSpawn: (startX: number, startY: number, endX: number, endY: number) => void;
}

const MapPreviewWindow: React.FC<MapPreviewWindowProps> = ({ mapData, allMonsters, onClose, show, selectedMonsterForAdd, onAddSpawn, onAddAreaSpawn }) => {
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [isDraggingWindow, setIsDraggingWindow] = useState(false);
    const [rel, setRel] = useState<{x: number, y: number} | null>(null);
    const [hoveredSpawn, setHoveredSpawn] = useState<Spawn | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    const [isDraggingArea, setIsDraggingArea] = useState(false);
    const [dragArea, setDragArea] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);

    const windowRef = useRef<HTMLDivElement>(null);

    const onWindowMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0 || !windowRef.current) return;
        const target = e.target as HTMLElement;
        if (target.closest('.map-interaction-area')) {
            return; 
        }
        const pos = windowRef.current.getBoundingClientRect();
        setIsDraggingWindow(true);
        setRel({
            x: e.pageX - pos.left,
            y: e.pageY - pos.top,
        });
        e.stopPropagation();
        e.preventDefault();
    };

    const onWindowMouseUp = useCallback(() => {
        setIsDraggingWindow(false);
    }, []);

    const onWindowMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingWindow || !rel || !windowRef.current) return;
        setPosition({
            x: e.pageX - rel.x,
            y: e.pageY - rel.y,
        });
        e.stopPropagation();
        e.preventDefault();
    }, [isDraggingWindow, rel]);

    useEffect(() => {
        if (isDraggingWindow) {
            document.addEventListener('mousemove', onWindowMouseMove);
            document.addEventListener('mouseup', onWindowMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', onWindowMouseMove);
            document.removeEventListener('mouseup', onWindowMouseUp);
        };
    }, [isDraggingWindow, onWindowMouseMove, onWindowMouseUp]);

    const getCoords = (e: React.MouseEvent<HTMLDivElement>): { x: number; y: number } => {
        if (!mapContainerRef.current) return { x: 0, y: 0 };
        const rect = mapContainerRef.current.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / 2);
        const y = Math.floor((e.clientY - rect.top) / 2);
        return { x: Math.max(0, Math.min(255, x)), y: Math.max(0, Math.min(255, y)) };
    };

    const handleMapMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!selectedMonsterForAdd) return;
        const { x, y } = getCoords(e);
        setIsDraggingArea(true);
        setDragArea({ startX: x, startY: y, endX: x, endY: y });
    };

    const handleMapMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDraggingArea || !dragArea) return;
        const { x, y } = getCoords(e);
        setDragArea({ ...dragArea, endX: x, endY: y });
    };

    const handleMapMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDraggingArea || !dragArea) return;
        const { x, y } = getCoords(e);
        const isClick = Math.abs(dragArea.startX - x) < 5 && Math.abs(dragArea.startY - y) < 5;

        if (isClick) {
            onAddSpawn(dragArea.startX, dragArea.startY);
        } else {
            const startX = Math.min(dragArea.startX, x);
            const startY = Math.min(dragArea.startY, y);
            const endX = Math.max(dragArea.startX, x);
            const endY = Math.max(dragArea.startY, y);
            onAddAreaSpawn(startX, startY, endX, endY);
        }
        
        setIsDraggingArea(false);
        setDragArea(null);
    };

    const handleSpawnHover = (spawn: Spawn | null, e?: React.MouseEvent) => {
        if (!mapContainerRef.current) return;
        setHoveredSpawn(spawn);
        if (e) {
            const mapRect = mapContainerRef.current.getBoundingClientRect();
            setTooltipPos({ x: e.clientX - mapRect.left + 15, y: e.clientY - mapRect.top + 15 });
        }
    }
    
    const getMonsterName = (index: number) => allMonsters.find(m => m.index === index)?.name || 'Unknown Monster';
    const getSpotType = (spawn: Spawn) => {
        const spot = mapData?.spots.find(s => s.spawns.some(sp => sp.uuid === spawn.uuid));
        if (!spot) return "Unknown";
        switch (spot.type) {
            case 0: return "NPC/Trap";
            case 1: return "Multi-Spawn";
            case 2: return "Single";
            case 3: return "Elemental";
            default: return "Unknown";
        }
    }

    if (!show) return null;

    return (
        <div
            ref={windowRef}
            className="fixed bg-gray-800 border border-gray-600 shadow-2xl flex flex-col z-50"
            style={{ left: position.x, top: position.y, width: '550px', height: '600px', cursor: isDraggingWindow ? 'grabbing' : 'default' }}
            onMouseDown={onWindowMouseDown}
        >
            <div className="bg-gray-900 p-2 flex justify-between items-center cursor-grab">
                <h3 className="text-sm font-bold">{mapData?.name || 'Map Preview'}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
            </div>
            <div className="p-4 flex-grow bg-blue-900/50 overflow-auto relative">
                <div 
                    ref={mapContainerRef} 
                    className="w-[512px] h-[512px] bg-blue-900 border-2 border-orange-500 relative map-interaction-area" 
                    style={{ 
                        transform: 'scale(1)', 
                        transformOrigin: 'top left',
                        cursor: selectedMonsterForAdd ? 'crosshair' : 'default'
                    }}
                    onMouseDown={handleMapMouseDown}
                    onMouseMove={handleMapMouseMove}
                    onMouseUp={handleMapMouseUp}
                >
                    {mapData?.spots.flatMap(spot => spot.spawns).map((spawn) => {
                         const isArea = spawn.endX > spawn.startX || spawn.endY > spawn.startY;
                         const width = isArea ? (spawn.endX - spawn.startX) * 2 : (spawn.distance || 1) * 4;
                         const height = isArea ? (spawn.endY - spawn.startY) * 2 : (spawn.distance || 1) * 4;
                         const left = isArea ? spawn.startX * 2 : (spawn.startX * 2) - width / 2;
                         const top = isArea ? spawn.startY * 2 : (spawn.startY * 2) - height / 2;
                        
                        return (
                            <div
                                key={spawn.uuid}
                                className="absolute bg-orange-500/50 border border-orange-400 hover:bg-orange-400/80"
                                style={{
                                    left,
                                    top,
                                    width: Math.max(4, width),
                                    height: Math.max(4, height),
                                }}
                                onMouseEnter={(e) => handleSpawnHover(spawn, e)}
                                onMouseLeave={() => handleSpawnHover(null)}
                            ></div>
                        );
                    })}
                     {isDraggingArea && dragArea && (
                        <div
                            className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/20 pointer-events-none"
                            style={{
                                left: Math.min(dragArea.startX, dragArea.endX) * 2,
                                top: Math.min(dragArea.startY, dragArea.endY) * 2,
                                width: Math.abs(dragArea.endX - dragArea.startX) * 2,
                                height: Math.abs(dragArea.endY - dragArea.startY) * 2,
                            }}
                        />
                    )}
                     {hoveredSpawn && (
                        <div className="absolute bg-gray-900/90 border border-gray-500 p-2 text-xs rounded-md pointer-events-none" style={{ left: tooltipPos.x, top: tooltipPos.y, transform: 'translateY(-100%)' }}>
                            <p className="font-bold text-cyan-400">{getMonsterName(hoveredSpawn.index)}</p>
                             <p>Type: {getSpotType(hoveredSpawn)}</p>
                            <p>Location: {hoveredSpawn.startX}x{hoveredSpawn.startY}</p>
                            <p>Count: {hoveredSpawn.count}</p>
                            <p>Radius: {hoveredSpawn.distance}</p>
                            <p>Dir: {hoveredSpawn.dir}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MapPreviewWindow;
